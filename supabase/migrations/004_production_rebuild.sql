-- Territory Mapper production security and synchronization foundation.
-- Additive and backward-compatible: legacy columns remain until a later cleanup release.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS congregation_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'overseer', 'publisher')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, congregation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS congregation_memberships_one_active_user
  ON congregation_memberships(user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS congregation_memberships_congregation
  ON congregation_memberships(congregation_id, status, role);

CREATE TABLE IF NOT EXISTS congregation_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  email CITEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'overseer', 'publisher')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT congregation_invites_seven_day_limit
    CHECK (expires_at <= created_at + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS congregation_invites_lookup
  ON congregation_invites(congregation_id, email, created_at DESC);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  house_id TEXT NOT NULL REFERENCES houses(id) ON DELETE RESTRICT,
  territory_id TEXT NOT NULL REFERENCES territories(id) ON DELETE RESTRICT,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  visitor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  outcome TEXT NOT NULL CHECK (
    outcome IN ('not-home', 'contacted', 'interested', 'return-visit', 'do-not-call')
  ),
  notes TEXT,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  follow_up_at TIMESTAMPTZ,
  mutation_id UUID NOT NULL UNIQUE,
  version BIGINT NOT NULL DEFAULT 1,
  server_updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visits_checkpoint
  ON visits(congregation_id, server_updated_at, id);
CREATE INDEX IF NOT EXISTS visits_return_visits
  ON visits(visitor_id, follow_up_at)
  WHERE follow_up_at IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE visits
  DROP CONSTRAINT IF EXISTS visits_dnc_notes_restricted;
ALTER TABLE visits
  ADD CONSTRAINT visits_dnc_notes_restricted
  CHECK (outcome <> 'do-not-call' OR notes IS NULL);

CREATE TABLE IF NOT EXISTS dnc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id TEXT NOT NULL UNIQUE REFERENCES houses(id) ON DELETE CASCADE,
  territory_id TEXT NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  address_ciphertext TEXT,
  notes_ciphertext TEXT,
  address_hash TEXT,
  key_version INTEGER NOT NULL DEFAULT 1 CHECK (key_version > 0),
  coordinates JSONB NOT NULL,
  warning_radius_m INTEGER NOT NULL DEFAULT 35
    CHECK (warning_radius_m BETWEEN 5 AND 500),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  migrated_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dnc_records_warning_lookup
  ON dnc_records(congregation_id, territory_id)
  WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS checkout_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id TEXT NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT checkout_links_expiry_limit
    CHECK (expires_at <= created_at + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS checkout_links_territory
  ON checkout_links(territory_id, created_at DESC);

ALTER TABLE territories
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_mutation_id UUID;

ALTER TABLE houses
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_mutation_id UUID;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS server_updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_mutation_id UUID;

CREATE INDEX IF NOT EXISTS territories_replication_checkpoint
  ON territories(congregation_id, server_updated_at, id);
CREATE INDEX IF NOT EXISTS houses_replication_checkpoint
  ON houses(congregation_id, server_updated_at, id);
CREATE INDEX IF NOT EXISTS assignments_replication_checkpoint
  ON assignments(congregation_id, server_updated_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_active_per_territory
  ON assignments(territory_id)
  WHERE status = 'active' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS territories_mutation_idempotency
  ON territories(last_mutation_id) WHERE last_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS houses_mutation_idempotency
  ON houses(last_mutation_id) WHERE last_mutation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS assignments_mutation_idempotency
  ON assignments(last_mutation_id) WHERE last_mutation_id IS NOT NULL;

-- Legacy QR values were generated client-side and were never authenticated.
UPDATE assignments SET qr_token = NULL WHERE qr_token IS NOT NULL;

INSERT INTO profiles (id, email, full_name, phone, created_at, updated_at)
SELECT
  id,
  COALESCE(email, id::TEXT || '@unknown.invalid'),
  COALESCE(raw_user_meta_data->>'full_name', ''),
  NULLIF(raw_user_meta_data->>'phone', ''),
  created_at,
  COALESCE(updated_at, created_at)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO congregation_memberships (
  user_id, congregation_id, role, status, joined_at, created_at, updated_at
)
SELECT
  users.id,
  (users.raw_user_meta_data->>'congregation_id')::UUID,
  CASE
    WHEN users.raw_user_meta_data->>'role' IN ('admin', 'overseer', 'publisher')
      THEN users.raw_user_meta_data->>'role'
    ELSE 'publisher'
  END,
  'active',
  users.created_at,
  users.created_at,
  COALESCE(users.updated_at, users.created_at)
FROM auth.users AS users
JOIN congregations AS congregations
  ON congregations.id::TEXT = users.raw_user_meta_data->>'congregation_id'
WHERE COALESCE(users.raw_user_meta_data->>'congregation_id', '')
  ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
ON CONFLICT (user_id, congregation_id) DO NOTHING;

-- Bootstrap one existing overseer as admin only where a congregation has no admin.
-- This preserves all accounts while ensuring invite and membership administration is reachable.
WITH ranked_overseers AS (
  SELECT membership.id,
    ROW_NUMBER() OVER (
      PARTITION BY membership.congregation_id
      ORDER BY membership.created_at, membership.id
    ) AS rank
  FROM congregation_memberships AS membership
  WHERE membership.role = 'overseer'
    AND membership.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM congregation_memberships AS admin_membership
      WHERE admin_membership.congregation_id = membership.congregation_id
        AND admin_membership.role = 'admin'
        AND admin_membership.status = 'active'
    )
)
UPDATE congregation_memberships
SET role = 'admin', updated_at = clock_timestamp()
WHERE id IN (SELECT id FROM ranked_overseers WHERE rank = 1);

-- Register legacy DNC rows without masking them yet. scripts/migrate-dnc.mjs encrypts,
-- verifies, and only then masks the legacy address/notes fields.
INSERT INTO dnc_records (
  house_id, territory_id, congregation_id, address_hash, coordinates, created_at, updated_at
)
SELECT
  id,
  territory_id,
  congregation_id,
  encode(digest(lower(trim(address)), 'sha256'), 'hex'),
  coordinates,
  created_at,
  updated_at
FROM houses
WHERE is_dnc = TRUE
ON CONFLICT (house_id) DO NOTHING;

CREATE OR REPLACE FUNCTION touch_replicated_document()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := COALESCE(NEW.version, 1);
  END IF;
  NEW.server_updated_at := clock_timestamp();
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_territories_replication ON territories;
CREATE TRIGGER touch_territories_replication
  BEFORE INSERT OR UPDATE ON territories
  FOR EACH ROW EXECUTE FUNCTION touch_replicated_document();
DROP TRIGGER IF EXISTS touch_houses_replication ON houses;
CREATE TRIGGER touch_houses_replication
  BEFORE INSERT OR UPDATE ON houses
  FOR EACH ROW EXECUTE FUNCTION touch_replicated_document();
DROP TRIGGER IF EXISTS touch_assignments_replication ON assignments;
CREATE TRIGGER touch_assignments_replication
  BEFORE INSERT OR UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION touch_replicated_document();

CREATE OR REPLACE FUNCTION current_membership()
RETURNS congregation_memberships
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT membership
  FROM congregation_memberships AS membership
  WHERE membership.user_id = auth.uid()
    AND membership.status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION current_congregation_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (current_membership()).congregation_id
$$;

CREATE OR REPLACE FUNCTION has_role(required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((current_membership()).role = ANY(required_roles), FALSE)
$$;

CREATE OR REPLACE FUNCTION has_active_assignment(target_territory_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM assignments
    WHERE territory_id = target_territory_id
      AND publisher_id = auth.uid()
      AND status = 'active'
      AND deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION current_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION current_congregation_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION has_role(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION has_active_assignment(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_membership() TO authenticated;
GRANT EXECUTE ON FUNCTION current_congregation_id() TO authenticated;
GRANT EXECUTE ON FUNCTION has_role(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_assignment(TEXT) TO authenticated;

-- Retain legacy helper signatures but route them through authoritative membership data.
CREATE OR REPLACE FUNCTION get_user_congregation_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT current_congregation_id() $$;

CREATE OR REPLACE FUNCTION is_user_overseer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT has_role(ARRAY['admin', 'overseer']) $$;

CREATE OR REPLACE FUNCTION is_user_in_congregation(target_congregation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT current_congregation_id() = target_congregation_id $$;

REVOKE ALL ON FUNCTION set_user_congregation_claim(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_congregation(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION join_congregation(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION checkout_territory(TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION return_territory(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_house_status(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_congregation_stats(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_overdue_assignments(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION search_houses(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cleanup_old_sync_states() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION assign_territory(
  target_territory_id TEXT,
  target_publisher_id UUID,
  target_due_date TIMESTAMPTZ DEFAULT NULL,
  target_mutation_id UUID DEFAULT gen_random_uuid()
)
RETURNS assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  territory_row territories;
  publisher_name TEXT;
  assignment_row assignments;
BEGIN
  IF NOT has_role(ARRAY['admin', 'overseer']) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;

  SELECT * INTO assignment_row
  FROM assignments
  WHERE last_mutation_id = target_mutation_id
    AND congregation_id = current_congregation_id();
  IF assignment_row.id IS NOT NULL THEN
    RETURN assignment_row;
  END IF;

  SELECT * INTO territory_row
  FROM territories
  WHERE id = target_territory_id
    AND congregation_id = current_congregation_id()
    AND deleted_at IS NULL
  FOR UPDATE;

  IF territory_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'TERRITORY_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM congregation_memberships
    WHERE user_id = target_publisher_id
      AND congregation_id = territory_row.congregation_id
      AND role = 'publisher'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PUBLISHER_NOT_IN_CONGREGATION';
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), email::TEXT)
    INTO publisher_name FROM profiles WHERE id = target_publisher_id;

  INSERT INTO assignments (
    id, territory_id, publisher_id, publisher_name, congregation_id,
    checked_out_by, due_date, status, last_mutation_id
  ) VALUES (
    gen_random_uuid()::TEXT, territory_row.id, target_publisher_id,
    COALESCE(publisher_name, 'Publisher'), territory_row.congregation_id,
    auth.uid(), target_due_date, 'active', target_mutation_id
  )
  RETURNING * INTO assignment_row;

  UPDATE territories
  SET status = 'out', last_mutation_id = target_mutation_id
  WHERE id = territory_row.id;

  RETURN assignment_row;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'TERRITORY_ALREADY_ASSIGNED';
END;
$$;

CREATE OR REPLACE FUNCTION redeem_checkout_link(
  target_token_hash TEXT,
  target_mutation_id UUID DEFAULT gen_random_uuid()
)
RETURNS assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  link_row checkout_links;
  territory_row territories;
  publisher_name TEXT;
  assignment_row assignments;
BEGIN
  IF NOT has_role(ARRAY['publisher']) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;

  SELECT * INTO assignment_row
  FROM assignments
  WHERE last_mutation_id = target_mutation_id
    AND publisher_id = auth.uid()
    AND congregation_id = current_congregation_id();
  IF assignment_row.id IS NOT NULL THEN
    RETURN assignment_row;
  END IF;

  SELECT * INTO link_row
  FROM checkout_links
  WHERE token_hash = target_token_hash
  FOR UPDATE;

  IF link_row.id IS NULL OR link_row.revoked_at IS NOT NULL OR link_row.used_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CHECKOUT_TOKEN_INVALID';
  END IF;
  IF link_row.expires_at <= NOW() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CHECKOUT_TOKEN_EXPIRED';
  END IF;
  IF current_congregation_id() IS DISTINCT FROM link_row.congregation_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;

  SELECT * INTO territory_row
  FROM territories
  WHERE id = link_row.territory_id AND deleted_at IS NULL
  FOR UPDATE;
  SELECT COALESCE(NULLIF(full_name, ''), email::TEXT)
    INTO publisher_name FROM profiles WHERE id = auth.uid();

  INSERT INTO assignments (
    id, territory_id, publisher_id, publisher_name, congregation_id,
    checked_out_by, status, last_mutation_id
  ) VALUES (
    gen_random_uuid()::TEXT, territory_row.id, auth.uid(),
    COALESCE(publisher_name, 'Publisher'), link_row.congregation_id,
    auth.uid(), 'active', target_mutation_id
  ) RETURNING * INTO assignment_row;

  UPDATE checkout_links SET used_at = clock_timestamp() WHERE id = link_row.id;
  UPDATE territories
  SET status = 'out', last_mutation_id = target_mutation_id
  WHERE id = territory_row.id;
  RETURN assignment_row;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'TERRITORY_ALREADY_ASSIGNED';
END;
$$;

CREATE OR REPLACE FUNCTION return_assignment(
  target_assignment_id TEXT,
  target_mutation_id UUID DEFAULT gen_random_uuid()
)
RETURNS assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  assignment_row assignments;
BEGIN
  SELECT * INTO assignment_row
  FROM assignments
  WHERE id = target_assignment_id
    AND last_mutation_id = target_mutation_id
    AND congregation_id = current_congregation_id();
  IF assignment_row.id IS NOT NULL THEN
    RETURN assignment_row;
  END IF;

  SELECT * INTO assignment_row
  FROM assignments
  WHERE id = target_assignment_id AND status = 'active' AND deleted_at IS NULL
  FOR UPDATE;
  IF assignment_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ASSIGNMENT_NOT_FOUND';
  END IF;
  IF assignment_row.congregation_id IS DISTINCT FROM current_congregation_id() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;
  IF assignment_row.publisher_id <> auth.uid()
    AND NOT has_role(ARRAY['admin', 'overseer']) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;

  UPDATE assignments
  SET status = 'returned', returned_at = clock_timestamp(), last_mutation_id = target_mutation_id
  WHERE id = assignment_row.id
  RETURNING * INTO assignment_row;
  UPDATE territories SET status = 'in-stock' WHERE id = assignment_row.territory_id;
  RETURN assignment_row;
END;
$$;

CREATE OR REPLACE FUNCTION accept_congregation_invite(target_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invite_row congregation_invites;
  auth_email CITEXT;
  auth_name TEXT;
  existing_congregation UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUTH_REQUIRED';
  END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', '')
    INTO auth_email, auth_name
  FROM auth.users
  WHERE id = auth.uid();

  SELECT * INTO invite_row
  FROM congregation_invites
  WHERE id = target_invite_id
  FOR UPDATE;

  IF invite_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'INVITE_NOT_FOUND';
  END IF;
  IF invite_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVITE_REVOKED';
  END IF;
  IF invite_row.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'INVITE_ACCEPTED';
  END IF;
  IF invite_row.expires_at <= NOW() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVITE_EXPIRED';
  END IF;
  IF auth_email IS DISTINCT FROM invite_row.email THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVITE_EMAIL_MISMATCH';
  END IF;

  SELECT congregation_id INTO existing_congregation
  FROM congregation_memberships
  WHERE user_id = auth.uid() AND status = 'active'
  FOR UPDATE;
  IF existing_congregation IS NOT NULL
    AND existing_congregation <> invite_row.congregation_id THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'ACTIVE_MEMBERSHIP_EXISTS';
  END IF;

  INSERT INTO profiles (id, email, full_name, updated_at)
  VALUES (auth.uid(), auth_email, auth_name, clock_timestamp())
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = EXCLUDED.updated_at;

  INSERT INTO congregation_memberships (
    user_id, congregation_id, role, status, invited_by, joined_at, updated_at
  ) VALUES (
    auth.uid(), invite_row.congregation_id, invite_row.role, 'active',
    invite_row.invited_by, clock_timestamp(), clock_timestamp()
  )
  ON CONFLICT (user_id, congregation_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        invited_by = EXCLUDED.invited_by,
        joined_at = COALESCE(congregation_memberships.joined_at, EXCLUDED.joined_at),
        updated_at = EXCLUDED.updated_at;

  UPDATE congregation_invites
  SET accepted_at = clock_timestamp(), accepted_by = auth.uid()
  WHERE id = invite_row.id;

  RETURN jsonb_build_object('accepted', TRUE, 'role', invite_row.role);
END;
$$;

CREATE OR REPLACE FUNCTION restrict_dnc_house(
  target_house_id TEXT,
  target_address_ciphertext TEXT,
  target_notes_ciphertext TEXT,
  target_address_hash TEXT,
  target_key_version INTEGER,
  target_warning_radius_m INTEGER
)
RETURNS dnc_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  house_row houses;
  dnc_row dnc_records;
  now_value TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT has_role(ARRAY['admin', 'overseer']) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;
  IF target_key_version < 1 OR target_warning_radius_m NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DNC_INPUT_INVALID';
  END IF;

  SELECT * INTO house_row
  FROM houses
  WHERE id = target_house_id
    AND congregation_id = current_congregation_id()
    AND deleted_at IS NULL
    AND is_dnc = FALSE
  FOR UPDATE;
  IF house_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'HOUSE_NOT_FOUND';
  END IF;

  INSERT INTO dnc_records (
    house_id, territory_id, congregation_id, address_ciphertext,
    notes_ciphertext, address_hash, key_version, coordinates,
    warning_radius_m, active, migrated_at, verified_at, created_by, updated_at
  ) VALUES (
    house_row.id, house_row.territory_id, house_row.congregation_id,
    target_address_ciphertext, target_notes_ciphertext, target_address_hash,
    target_key_version, house_row.coordinates, target_warning_radius_m,
    TRUE, now_value, now_value, auth.uid(), now_value
  )
  ON CONFLICT (house_id) DO UPDATE SET
    address_ciphertext = EXCLUDED.address_ciphertext,
    notes_ciphertext = EXCLUDED.notes_ciphertext,
    address_hash = EXCLUDED.address_hash,
    key_version = EXCLUDED.key_version,
    coordinates = EXCLUDED.coordinates,
    warning_radius_m = EXCLUDED.warning_radius_m,
    active = TRUE,
    migrated_at = now_value,
    verified_at = now_value,
    updated_at = now_value
  RETURNING * INTO dnc_row;

  UPDATE houses SET
    address = 'DNC address restricted',
    notes = NULL,
    is_dnc = TRUE,
    status = 'dnc',
    dnc_encrypted_address = NULL,
    return_visit_date = NULL,
    deleted_at = now_value
  WHERE id = house_row.id;
  RETURN dnc_row;
END;
$$;

CREATE OR REPLACE FUNCTION restore_dnc_house(
  target_record_id UUID,
  target_address TEXT,
  target_notes TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  dnc_row dnc_records;
  now_value TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF NOT has_role(ARRAY['admin', 'overseer']) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;
  SELECT * INTO dnc_row
  FROM dnc_records
  WHERE id = target_record_id
    AND congregation_id = current_congregation_id()
    AND active = TRUE
  FOR UPDATE;
  IF dnc_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'DNC_RECORD_NOT_FOUND';
  END IF;

  UPDATE houses SET
    address = target_address,
    notes = target_notes,
    is_dnc = FALSE,
    status = 'not-visited',
    deleted_at = NULL
  WHERE id = dnc_row.house_id;
  UPDATE dnc_records SET active = FALSE, updated_at = now_value WHERE id = dnc_row.id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION apply_visit_effect(
  target_visit_id TEXT,
  target_address_ciphertext TEXT DEFAULT NULL,
  target_notes_ciphertext TEXT DEFAULT NULL,
  target_address_hash TEXT DEFAULT NULL,
  target_key_version INTEGER DEFAULT NULL
)
RETURNS houses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  visit_row visits;
  house_row houses;
  now_value TIMESTAMPTZ := clock_timestamp();
  existing_dnc BOOLEAN;
BEGIN
  SELECT * INTO visit_row
  FROM visits
  WHERE id = target_visit_id
    AND congregation_id = current_congregation_id()
    AND (visitor_id = auth.uid() OR has_role(ARRAY['admin', 'overseer']))
  FOR SHARE;
  IF visit_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'VISIT_NOT_FOUND';
  END IF;

  SELECT * INTO house_row
  FROM houses
  WHERE id = visit_row.house_id
    AND territory_id = visit_row.territory_id
    AND congregation_id = visit_row.congregation_id
  FOR UPDATE;
  IF house_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'VISIT_SCOPE_INVALID';
  END IF;

  IF visit_row.outcome = 'do-not-call' THEN
    SELECT EXISTS (
      SELECT 1 FROM dnc_records WHERE house_id = house_row.id AND active = TRUE
    ) INTO existing_dnc;
    IF NOT existing_dnc AND (
      target_address_ciphertext IS NULL OR target_address_hash IS NULL OR target_key_version IS NULL
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'DNC_ENCRYPTION_REQUIRED';
    END IF;

    IF NOT existing_dnc THEN
      INSERT INTO dnc_records (
        house_id, territory_id, congregation_id, address_ciphertext,
        notes_ciphertext, address_hash, key_version, coordinates,
        warning_radius_m, active, migrated_at, verified_at, created_by, updated_at
      ) VALUES (
        house_row.id, house_row.territory_id, house_row.congregation_id,
        target_address_ciphertext, target_notes_ciphertext, target_address_hash,
        target_key_version, house_row.coordinates, 35, TRUE, now_value, now_value,
        visit_row.visitor_id, now_value
      );
    END IF;

    UPDATE houses SET
      address = 'DNC address restricted',
      notes = NULL,
      is_dnc = TRUE,
      status = 'dnc',
      last_visited = visit_row.visited_at,
      last_visitor = visit_row.visitor_id,
      return_visit_date = NULL,
      dnc_encrypted_address = NULL,
      deleted_at = COALESCE(house_row.deleted_at, now_value)
    WHERE id = house_row.id
    RETURNING * INTO house_row;
  ELSE
    UPDATE houses SET
      status = CASE visit_row.outcome
        WHEN 'not-home' THEN 'nah'
        WHEN 'contacted' THEN 'interest'
        WHEN 'interested' THEN 'interest'
        WHEN 'return-visit' THEN 'return-visit'
      END,
      last_visited = visit_row.visited_at,
      last_visitor = visit_row.visitor_id,
      return_visit_date = visit_row.follow_up_at
    WHERE id = house_row.id
    RETURNING * INTO house_row;
  END IF;
  RETURN house_row;
END;
$$;

CREATE OR REPLACE FUNCTION append_visit(
  target_id TEXT,
  target_house_id TEXT,
  target_territory_id TEXT,
  target_outcome TEXT,
  target_notes TEXT,
  target_visited_at TIMESTAMPTZ,
  target_follow_up_at TIMESTAMPTZ,
  target_mutation_id UUID
)
RETURNS visits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  visit_row visits;
BEGIN
  IF auth.uid() IS NULL OR NOT has_active_assignment(target_territory_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ASSIGNMENT_REQUIRED';
  END IF;
  IF target_outcome = 'do-not-call' AND target_notes IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DNC_NOTES_RESTRICTED';
  END IF;

  INSERT INTO visits (
    id, house_id, territory_id, congregation_id, visitor_id, outcome,
    notes, visited_at, follow_up_at, mutation_id
  ) VALUES (
    target_id, target_house_id, target_territory_id, current_congregation_id(),
    auth.uid(), target_outcome, target_notes, target_visited_at,
    target_follow_up_at, target_mutation_id
  )
  ON CONFLICT (mutation_id) DO NOTHING
  RETURNING * INTO visit_row;

  IF visit_row.id IS NULL THEN
    SELECT * INTO visit_row
    FROM visits
    WHERE mutation_id = target_mutation_id
      AND visitor_id = auth.uid()
      AND congregation_id = current_congregation_id();
  END IF;
  IF visit_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'MUTATION_ID_CONFLICT';
  END IF;
  RETURN visit_row;
END;
$$;

CREATE OR REPLACE FUNCTION update_congregation_member(
  target_user_id UUID,
  target_role TEXT DEFAULT NULL,
  target_status TEXT DEFAULT NULL
)
RETURNS congregation_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  membership_row congregation_memberships;
  active_admins INTEGER;
  congregation UUID := current_congregation_id();
BEGIN
  IF NOT has_role(ARRAY['admin']) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN';
  END IF;
  IF target_role IS NULL AND target_status IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MEMBERSHIP_CHANGE_REQUIRED';
  END IF;
  IF target_role IS NOT NULL AND target_role NOT IN ('admin', 'overseer', 'publisher') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MEMBERSHIP_ROLE_INVALID';
  END IF;
  IF target_status IS NOT NULL AND target_status NOT IN ('active', 'suspended', 'removed') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MEMBERSHIP_STATUS_INVALID';
  END IF;

  -- Serialize role administration for this congregation so two requests cannot
  -- concurrently remove its final active administrator.
  PERFORM pg_advisory_xact_lock(hashtext(congregation::TEXT));
  SELECT * INTO membership_row
  FROM congregation_memberships
  WHERE user_id = target_user_id
    AND congregation_id = congregation
  FOR UPDATE;
  IF membership_row.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MEMBER_NOT_FOUND';
  END IF;

  IF membership_row.role = 'admin'
    AND membership_row.status = 'active'
    AND (COALESCE(target_role, membership_row.role) <> 'admin'
      OR COALESCE(target_status, membership_row.status) <> 'active') THEN
    SELECT COUNT(*) INTO active_admins
    FROM congregation_memberships
    WHERE congregation_id = congregation
      AND role = 'admin'
      AND status = 'active';
    IF active_admins <= 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'LAST_ACTIVE_ADMIN';
    END IF;
  END IF;

  UPDATE congregation_memberships
  SET role = COALESCE(target_role, role),
      status = COALESCE(target_status, status),
      updated_at = clock_timestamp()
  WHERE id = membership_row.id
  RETURNING * INTO membership_row;
  RETURN membership_row;
END;
$$;

REVOKE ALL ON FUNCTION assign_territory(TEXT, UUID, TIMESTAMPTZ, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION redeem_checkout_link(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION return_assignment(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION accept_congregation_invite(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION restrict_dnc_house(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION restore_dnc_house(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_visit_effect(TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION append_visit(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_congregation_member(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_territory(TEXT, UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION redeem_checkout_link(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION return_assignment(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_congregation_invite(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restrict_dnc_house(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_dnc_house(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_visit_effect(TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION append_visit(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_congregation_member(UUID, TEXT, TEXT) TO authenticated;

-- Trigger-only, append-only audit log. Do not include row content in metadata.
ALTER TABLE activity_log ALTER COLUMN user_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  record_id TEXT;
  record_congregation UUID;
BEGIN
  record_id := COALESCE(NEW.id::TEXT, OLD.id::TEXT);
  record_congregation := COALESCE(NEW.congregation_id, OLD.congregation_id);
  INSERT INTO activity_log (user_id, congregation_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(), record_congregation, lower(TG_OP), TG_TABLE_NAME, record_id,
    jsonb_build_object(
      'request_id',
      COALESCE(NULLIF(current_setting('request.headers', TRUE), ''), '{}')::jsonb->>'x-request-id'
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUDIT_LOG_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS activity_log_immutable ON activity_log;
CREATE TRIGGER activity_log_immutable
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

CREATE OR REPLACE FUNCTION validate_visit_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM houses AS house
    JOIN territories AS territory ON territory.id = house.territory_id
    WHERE house.id = NEW.house_id
      AND house.territory_id = NEW.territory_id
      AND house.congregation_id = NEW.congregation_id
      AND territory.congregation_id = NEW.congregation_id
      AND house.deleted_at IS NULL
      AND territory.deleted_at IS NULL
      AND house.is_dnc = FALSE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'VISIT_SCOPE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_visit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'VISIT_HISTORY_APPEND_ONLY';
END;
$$;

DROP TRIGGER IF EXISTS visits_validate_scope ON visits;
CREATE TRIGGER visits_validate_scope
  BEFORE INSERT ON visits
  FOR EACH ROW EXECUTE FUNCTION validate_visit_scope();
DROP TRIGGER IF EXISTS visits_append_only ON visits;
CREATE TRIGGER visits_append_only
  BEFORE UPDATE OR DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION prevent_visit_mutation();
REVOKE ALL ON FUNCTION validate_visit_scope() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION prevent_visit_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_territories ON territories;
CREATE TRIGGER audit_territories AFTER INSERT OR UPDATE OR DELETE ON territories
  FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS audit_houses ON houses;
CREATE TRIGGER audit_houses AFTER INSERT OR UPDATE OR DELETE ON houses
  FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS audit_assignments ON assignments;
CREATE TRIGGER audit_assignments AFTER INSERT OR UPDATE OR DELETE ON assignments
  FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS audit_visits ON visits;
CREATE TRIGGER audit_visits AFTER INSERT OR UPDATE OR DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS audit_memberships ON congregation_memberships;
CREATE TRIGGER audit_memberships AFTER INSERT OR UPDATE OR DELETE ON congregation_memberships
  FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS audit_invites ON congregation_invites;
CREATE TRIGGER audit_invites AFTER INSERT OR UPDATE OR DELETE ON congregation_invites
  FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS audit_checkout_links ON checkout_links;
CREATE TRIGGER audit_checkout_links AFTER INSERT OR UPDATE OR DELETE ON checkout_links
  FOR EACH ROW EXECUTE FUNCTION log_activity();
DROP TRIGGER IF EXISTS audit_dnc_records ON dnc_records;
CREATE TRIGGER audit_dnc_records AFTER INSERT OR UPDATE OR DELETE ON dnc_records
  FOR EACH ROW EXECUTE FUNCTION log_activity();

-- Replace metadata-based RLS with membership and assignment policies.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE congregation_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE congregation_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their congregation" ON congregations;
DROP POLICY IF EXISTS "Only admins can create congregations" ON congregations;
DROP POLICY IF EXISTS "Only admins can update their congregation" ON congregations;
DROP POLICY IF EXISTS "Users can view territories in their congregation" ON territories;
DROP POLICY IF EXISTS "Overseers can create territories" ON territories;
DROP POLICY IF EXISTS "Overseers can update territories in their congregation" ON territories;
DROP POLICY IF EXISTS "Overseers can delete territories in their congregation" ON territories;
DROP POLICY IF EXISTS "Users can view houses in their congregation" ON houses;
DROP POLICY IF EXISTS "Overseers can create houses" ON houses;
DROP POLICY IF EXISTS "Users can update houses in their congregation" ON houses;
DROP POLICY IF EXISTS "Overseers can delete houses" ON houses;
DROP POLICY IF EXISTS "Users can view assignments in their congregation" ON assignments;
DROP POLICY IF EXISTS "Users can create assignments" ON assignments;
DROP POLICY IF EXISTS "Users can update assignments in their congregation" ON assignments;
DROP POLICY IF EXISTS "Overseers can delete assignments" ON assignments;
DROP POLICY IF EXISTS "Users can manage their sync state" ON sync_state;
DROP POLICY IF EXISTS "Users can view activity in their congregation" ON activity_log;
DROP POLICY IF EXISTS "System can insert activity" ON activity_log;

CREATE POLICY congregation_read_membership ON congregations FOR SELECT TO authenticated
  USING (id = current_congregation_id());
CREATE POLICY congregation_manage_admin ON congregations FOR UPDATE TO authenticated
  USING (id = current_congregation_id() AND has_role(ARRAY['admin']))
  WITH CHECK (id = current_congregation_id() AND has_role(ARRAY['admin']));

CREATE POLICY profiles_read_authorized ON profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid() OR (
      has_role(ARRAY['admin', 'overseer']) AND EXISTS (
        SELECT 1 FROM congregation_memberships member
        WHERE member.user_id = profiles.id
          AND member.congregation_id = current_congregation_id()
          AND member.status = 'active'
      )
    )
  );
CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY memberships_read_authorized ON congregation_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR (
      congregation_id = current_congregation_id()
      AND has_role(ARRAY['admin', 'overseer'])
    )
  );
CREATE POLICY memberships_admin_insert ON congregation_memberships FOR INSERT TO authenticated
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin']));
CREATE POLICY memberships_admin_update ON congregation_memberships FOR UPDATE TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin']))
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin']));

CREATE POLICY invites_admin_read ON congregation_invites FOR SELECT TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin']));
CREATE POLICY invites_admin_create ON congregation_invites FOR INSERT TO authenticated
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin']));
CREATE POLICY invites_admin_revoke ON congregation_invites FOR UPDATE TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin']))
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin']));

CREATE POLICY territories_read_authorized ON territories FOR SELECT TO authenticated
  USING (
    congregation_id = current_congregation_id() AND (
      has_role(ARRAY['admin', 'overseer']) OR has_active_assignment(id)
    )
  );
CREATE POLICY territories_manage_authorized ON territories FOR ALL TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']))
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']));

CREATE POLICY houses_read_authorized ON houses FOR SELECT TO authenticated
  USING (
    congregation_id = current_congregation_id() AND (
      has_role(ARRAY['admin', 'overseer']) OR (
        has_active_assignment(territory_id) AND (
          is_dnc = FALSE OR (
            is_dnc = TRUE
            AND deleted_at IS NOT NULL
            AND address = 'DNC address restricted'
            AND notes IS NULL
          )
        )
      )
    )
  );
CREATE POLICY houses_manage_authorized ON houses FOR ALL TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']))
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']));

CREATE POLICY assignments_read_authorized ON assignments FOR SELECT TO authenticated
  USING (
    congregation_id = current_congregation_id() AND (
      has_role(ARRAY['admin', 'overseer']) OR publisher_id = auth.uid()
    )
  );

CREATE POLICY visits_read_authorized ON visits FOR SELECT TO authenticated
  USING (
    congregation_id = current_congregation_id() AND (
      has_role(ARRAY['admin', 'overseer']) OR visitor_id = auth.uid()
    )
  );
CREATE POLICY visits_create_assigned ON visits FOR INSERT TO authenticated
  WITH CHECK (
    congregation_id = current_congregation_id()
    AND visitor_id = auth.uid()
    AND has_active_assignment(territory_id)
  );

CREATE POLICY dnc_manage_privileged ON dnc_records FOR ALL TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']))
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']));

CREATE POLICY checkout_links_privileged ON checkout_links FOR ALL TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']))
  WITH CHECK (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']));

CREATE POLICY sync_state_owner ON sync_state FOR ALL TO authenticated
  USING (user_id = auth.uid() AND congregation_id = current_congregation_id())
  WITH CHECK (user_id = auth.uid() AND congregation_id = current_congregation_id());

CREATE POLICY activity_read_privileged ON activity_log FOR SELECT TO authenticated
  USING (congregation_id = current_congregation_id() AND has_role(ARRAY['admin', 'overseer']));

REVOKE ALL ON TABLE profiles, congregation_memberships, congregation_invites, visits,
  dnc_records, checkout_links FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON activity_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON assignments FROM anon, authenticated;

GRANT SELECT, UPDATE (full_name, phone, updated_at) ON profiles TO authenticated;
GRANT SELECT ON congregation_memberships TO authenticated;
GRANT SELECT ON congregation_invites TO authenticated;
GRANT SELECT ON visits TO authenticated;
GRANT SELECT ON activity_log TO authenticated;

COMMENT ON TABLE congregation_memberships IS
  'Server-authoritative tenant membership and role source; never trust editable auth metadata.';
COMMENT ON TABLE dnc_records IS
  'Restricted exact DNC data. Publishers receive generic proximity warnings from a server endpoint.';
COMMENT ON TABLE visits IS
  'Append-only visit outcomes used for conflict-safe offline field work.';
