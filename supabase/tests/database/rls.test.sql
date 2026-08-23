BEGIN;
SELECT plan(20);

INSERT INTO congregations (id, name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Tenant A'),
  ('20000000-0000-4000-8000-000000000002', 'Tenant B');

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'admin-a@example.test', '', NOW(), '{}', '{}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'publisher-a@example.test', '', NOW(), '{}', '{}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'unassigned-a@example.test', '', NOW(), '{}', '{}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'publisher-b@example.test', '', NOW(), '{}', '{}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'invited-a@example.test', '', NOW(), '{}', '{}', NOW(), NOW());

INSERT INTO profiles (id, email, full_name) VALUES
  ('10000000-0000-4000-8000-000000000010', 'admin-a@example.test', 'Admin A'),
  ('10000000-0000-4000-8000-000000000011', 'publisher-a@example.test', 'Publisher A'),
  ('10000000-0000-4000-8000-000000000012', 'unassigned-a@example.test', 'Unassigned A'),
  ('20000000-0000-4000-8000-000000000021', 'publisher-b@example.test', 'Publisher B');

INSERT INTO congregation_memberships (user_id, congregation_id, role, status, joined_at) VALUES
  ('10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'admin', 'active', NOW()),
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', 'publisher', 'active', NOW()),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', 'publisher', 'active', NOW()),
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000002', 'publisher', 'active', NOW());

INSERT INTO territories (id, name, congregation_id, boundary, center, status, color, created_by) VALUES
  ('tenant-a-assigned', 'A Assigned', '10000000-0000-4000-8000-000000000001', '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}'::jsonb, '[0.5,0.5]'::jsonb, 'out', '#2f6f4e', '10000000-0000-4000-8000-000000000010'),
  ('tenant-a-available', 'A Available', '10000000-0000-4000-8000-000000000001', '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}'::jsonb, '[0.5,0.5]'::jsonb, 'in-stock', '#2f6f4e', '10000000-0000-4000-8000-000000000010'),
  ('tenant-b-territory', 'B Private', '20000000-0000-4000-8000-000000000002', '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}'::jsonb, '[0.5,0.5]'::jsonb, 'in-stock', '#2f6f4e', '20000000-0000-4000-8000-000000000021');

INSERT INTO houses (id, territory_id, congregation_id, address, coordinates, status, is_dnc) VALUES
  ('house-a-callable', 'tenant-a-assigned', '10000000-0000-4000-8000-000000000001', '10 Callable Street', '[0.5,0.5]'::jsonb, 'not-visited', FALSE),
  ('house-a-dnc', 'tenant-a-assigned', '10000000-0000-4000-8000-000000000001', 'DNC address restricted', '[0.6,0.6]'::jsonb, 'dnc', TRUE),
  ('house-b-callable', 'tenant-b-territory', '20000000-0000-4000-8000-000000000002', '20 Tenant B Street', '[0.5,0.5]'::jsonb, 'not-visited', FALSE);

INSERT INTO dnc_records (house_id, territory_id, congregation_id, address_ciphertext, address_hash, coordinates, created_by)
VALUES ('house-a-dnc', 'tenant-a-assigned', '10000000-0000-4000-8000-000000000001', 'v1.test.test.test', 'hash', '[0.6,0.6]'::jsonb, '10000000-0000-4000-8000-000000000010');

UPDATE houses SET deleted_at = NOW() WHERE id = 'house-a-dnc';

INSERT INTO assignments (id, territory_id, publisher_id, publisher_name, congregation_id, checked_out_by, status)
VALUES ('assignment-a', 'tenant-a-assigned', '10000000-0000-4000-8000-000000000011', 'Publisher A', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000010', 'active');

INSERT INTO checkout_links (id, territory_id, congregation_id, token_hash, expires_at, created_by)
VALUES ('10000000-0000-4000-8000-000000000099', 'tenant-a-available', '10000000-0000-4000-8000-000000000001', 'test-checkout-hash', NOW() + INTERVAL '1 day', '10000000-0000-4000-8000-000000000010');

INSERT INTO congregation_invites (id, congregation_id, email, role, token_hash, expires_at, invited_by)
VALUES ('10000000-0000-4000-8000-000000000098', '10000000-0000-4000-8000-000000000001', 'invited-a@example.test', 'publisher', 'test-invite-hash', NOW() + INTERVAL '1 day', '10000000-0000-4000-8000-000000000010');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000011', TRUE);

SELECT is((SELECT COUNT(*)::INTEGER FROM territories), 1, 'publisher reads only assigned territory');
SELECT is((SELECT COUNT(*)::INTEGER FROM houses WHERE deleted_at IS NULL), 1, 'publisher reads the callable house');
SELECT is((SELECT COUNT(*)::INTEGER FROM houses WHERE deleted_at IS NOT NULL AND address = 'DNC address restricted'), 1, 'publisher reads only a masked DNC tombstone for offline eviction');
SELECT throws_ok(
  $$ SELECT COUNT(*) FROM dnc_records $$,
  '42501', NULL, 'publisher has no direct access to restricted DNC records'
);
SELECT throws_ok(
  $$ UPDATE congregation_memberships SET role = 'admin' WHERE user_id = '10000000-0000-4000-8000-000000000011' $$,
  '42501', NULL, 'publisher cannot elevate own role'
);
SELECT throws_ok(
  $$ SELECT assign_territory('tenant-a-available', '10000000-0000-4000-8000-000000000011', NULL, gen_random_uuid()) $$,
  '42501', 'FORBIDDEN', 'publisher cannot call manager assignment transaction'
);
SELECT lives_ok(
  $$ SELECT append_visit('visit-a', 'house-a-callable', 'tenant-a-assigned', 'contacted', NULL, NOW(), NULL, gen_random_uuid()) $$,
  'publisher can append a visit in an assigned territory'
);
SELECT throws_ok(
  $$ UPDATE visits SET notes = 'overwrite' WHERE id = 'visit-a' $$,
  '42501', NULL, 'visit history is append-only for clients'
);
SELECT throws_ok(
  $$ SELECT append_visit('visit-dnc-bad', 'house-a-callable', 'tenant-a-assigned', 'do-not-call', 'plaintext forbidden', NOW(), NULL, gen_random_uuid()) $$,
  '23514', 'DNC_NOTES_RESTRICTED', 'DNC notes cannot be stored in plaintext visit history'
);
SELECT throws_ok(
  $$ SELECT append_visit('visit-cross-tenant-house', 'house-b-callable', 'tenant-a-assigned', 'contacted', NULL, NOW(), NULL, gen_random_uuid()) $$,
  '23514', 'VISIT_SCOPE_INVALID', 'visit house, territory, and congregation must match'
);
SELECT lives_ok(
  $$ SELECT redeem_checkout_link('test-checkout-hash', gen_random_uuid()) $$,
  'first one-time checkout redemption succeeds'
);
SELECT throws_ok(
  $$ SELECT redeem_checkout_link('test-checkout-hash', gen_random_uuid()) $$,
  '22023', 'CHECKOUT_TOKEN_INVALID', 'checkout link cannot be redeemed twice'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000012', TRUE);
SELECT is((SELECT COUNT(*)::INTEGER FROM territories), 0, 'publisher cannot read unassigned congregation territories');
SELECT throws_ok(
  $$ INSERT INTO territories (id, name, congregation_id, boundary, center, status, created_by) VALUES ('cross-tenant-write', 'No', '20000000-0000-4000-8000-000000000002', '{}', '[]', 'in-stock', '10000000-0000-4000-8000-000000000012') $$,
  '42501', NULL, 'tenant A user cannot mutate tenant B'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000021', TRUE);
SELECT throws_ok(
  $$ SELECT return_assignment('assignment-a', gen_random_uuid()) $$,
  '42501', 'FORBIDDEN', 'tenant B publisher cannot return tenant A assignment'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000013', TRUE);
SELECT lives_ok(
  $$ SELECT accept_congregation_invite('10000000-0000-4000-8000-000000000098') $$,
  'invited user can accept a valid congregation invitation transactionally'
);
SELECT throws_ok(
  $$ SELECT accept_congregation_invite('10000000-0000-4000-8000-000000000098') $$,
  '23505', 'INVITE_ACCEPTED', 'invitation cannot be accepted twice'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000010', TRUE);
SELECT throws_ok(
  $$ SELECT update_congregation_member('10000000-0000-4000-8000-000000000010', 'overseer', NULL) $$,
  '23514', 'LAST_ACTIVE_ADMIN', 'concurrent-safe membership transaction preserves the final active admin'
);

RESET ROLE;
SELECT throws_ok(
  $$ UPDATE visits SET notes = 'service overwrite' WHERE id = 'visit-a' $$,
  '42501', 'VISIT_HISTORY_APPEND_ONLY', 'visit history remains append-only for privileged database callers'
);
SELECT throws_ok(
  $$ UPDATE activity_log SET action = 'tampered' WHERE id = (SELECT id FROM activity_log LIMIT 1) $$,
  '42501', 'AUDIT_LOG_IMMUTABLE', 'audit log cannot be updated even by a privileged database role'
);

SELECT * FROM finish();
ROLLBACK;
