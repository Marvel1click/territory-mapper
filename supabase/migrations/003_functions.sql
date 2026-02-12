-- Utility Functions for Territory Mapper

-- Function to set user's congregation claim
CREATE OR REPLACE FUNCTION set_user_congregation_claim(p_user_id UUID, p_congregation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || 
    jsonb_build_object('congregation_id', p_congregation_id::text)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a congregation and set the creator as overseer
CREATE OR REPLACE FUNCTION create_congregation(
  p_name TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_congregation_id UUID;
BEGIN
  -- Create congregation
  INSERT INTO congregations (name)
  VALUES (p_name)
  RETURNING id INTO v_congregation_id;
  
  -- Update user metadata
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'congregation_id', v_congregation_id::text,
    'role', 'overseer'
  )
  WHERE id = p_user_id;
  
  RETURN v_congregation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to join a congregation
CREATE OR REPLACE FUNCTION join_congregation(
  p_congregation_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'publisher'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if congregation exists
  IF NOT EXISTS (SELECT 1 FROM congregations WHERE id = p_congregation_id) THEN
    RETURN FALSE;
  END IF;
  
  -- Update user metadata
  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object(
    'congregation_id', p_congregation_id::text,
    'role', p_role
  )
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to checkout a territory
CREATE OR REPLACE FUNCTION checkout_territory(
  p_territory_id TEXT,
  p_publisher_id UUID,
  p_publisher_name TEXT,
  p_due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_assignment_id TEXT;
  v_congregation_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Get congregation_id
  SELECT congregation_id INTO v_congregation_id
  FROM territories
  WHERE id = p_territory_id;
  
  IF v_congregation_id IS NULL THEN
    RAISE EXCEPTION 'Territory not found';
  END IF;
  
  -- Check if territory is already checked out
  IF EXISTS (
    SELECT 1 FROM assignments
    WHERE territory_id = p_territory_id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Territory is already checked out';
  END IF;
  
  -- Create assignment
  v_assignment_id := gen_random_uuid()::text;
  
  INSERT INTO assignments (
    id,
    territory_id,
    publisher_id,
    publisher_name,
    congregation_id,
    checked_out_by,
    due_date,
    status
  ) VALUES (
    v_assignment_id,
    p_territory_id,
    p_publisher_id,
    p_publisher_name,
    v_congregation_id,
    v_user_id,
    p_due_date,
    'active'
  );
  
  -- Update territory status
  UPDATE territories
  SET status = 'out', updated_at = NOW()
  WHERE id = p_territory_id;
  
  RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to return a territory
CREATE OR REPLACE FUNCTION return_territory(p_assignment_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_territory_id TEXT;
BEGIN
  -- Get territory_id and verify assignment exists
  SELECT territory_id INTO v_territory_id
  FROM assignments
  WHERE id = p_assignment_id
  AND status = 'active';
  
  IF v_territory_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update assignment
  UPDATE assignments
  SET 
    status = 'returned',
    returned_at = NOW(),
    updated_at = NOW()
  WHERE id = p_assignment_id;
  
  -- Update territory status
  UPDATE territories
  SET status = 'in-stock', updated_at = NOW()
  WHERE id = v_territory_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update house status
CREATE OR REPLACE FUNCTION update_house_status(
  p_house_id TEXT,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL,
  p_return_visit_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_house_congregation_id UUID;
  v_user_congregation_id UUID;
BEGIN
  -- Get house congregation
  SELECT congregation_id INTO v_house_congregation_id
  FROM houses
  WHERE id = p_house_id;
  
  IF v_house_congregation_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get user's congregation
  SELECT get_user_congregation_id() INTO v_user_congregation_id;
  
  -- Verify user is in same congregation
  IF v_house_congregation_id != v_user_congregation_id THEN
    RETURN FALSE;
  END IF;
  
  -- Update house
  UPDATE houses
  SET 
    status = p_status,
    notes = COALESCE(p_notes, notes),
    return_visit_date = COALESCE(p_return_visit_date, return_visit_date),
    last_visited = NOW(),
    last_visitor = auth.uid(),
    updated_at = NOW()
  WHERE id = p_house_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get congregation statistics
CREATE OR REPLACE FUNCTION get_congregation_stats(p_congregation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_territories', COUNT(DISTINCT t.id),
    'in_stock', COUNT(DISTINCT CASE WHEN t.status = 'in-stock' THEN t.id END),
    'checked_out', COUNT(DISTINCT CASE WHEN t.status = 'out' THEN t.id END),
    'total_houses', COUNT(DISTINCT h.id),
    'houses_visited', COUNT(DISTINCT CASE WHEN h.status != 'not-visited' THEN h.id END),
    'active_assignments', COUNT(DISTINCT CASE WHEN a.status = 'active' THEN a.id END),
    'dnc_count', COUNT(DISTINCT CASE WHEN h.is_dnc THEN h.id END)
  )
  INTO v_stats
  FROM territories t
  LEFT JOIN houses h ON h.territory_id = t.id
  LEFT JOIN assignments a ON a.territory_id = t.id
  WHERE t.congregation_id = p_congregation_id;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search houses by address
CREATE OR REPLACE FUNCTION search_houses(
  p_query TEXT,
  p_territory_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  address TEXT,
  territory_id TEXT,
  status TEXT,
  similarity FLOAT
) AS $$
DECLARE
  v_congregation_id UUID;
BEGIN
  v_congregation_id := get_user_congregation_id();
  
  RETURN QUERY
  SELECT 
    h.id,
    h.address,
    h.territory_id,
    h.status,
    similarity(h.address, p_query) as similarity
  FROM houses h
  JOIN territories t ON t.id = h.territory_id
  WHERE t.congregation_id = v_congregation_id
  AND (
    h.address ILIKE '%' || p_query || '%'
    OR similarity(h.address, p_query) > 0.3
  )
  AND (p_territory_id IS NULL OR h.territory_id = p_territory_id)
  AND h.is_dnc = FALSE
  ORDER BY similarity DESC, h.address
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Install pg_trgm extension for fuzzy search (if not exists)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function to clean up old sync states
CREATE OR REPLACE FUNCTION cleanup_old_sync_states()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM sync_state
  WHERE updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get overdue assignments
CREATE OR REPLACE FUNCTION get_overdue_assignments(p_congregation_id UUID)
RETURNS TABLE (
  assignment_id TEXT,
  territory_id TEXT,
  territory_name TEXT,
  publisher_name TEXT,
  checked_out_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  days_overdue INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id as assignment_id,
    a.territory_id,
    t.name as territory_name,
    a.publisher_name,
    a.checked_out_at,
    a.due_date,
    EXTRACT(DAY FROM NOW() - a.due_date)::INTEGER as days_overdue
  FROM assignments a
  JOIN territories t ON t.id = a.territory_id
  WHERE a.congregation_id = p_congregation_id
  AND a.status = 'active'
  AND a.due_date < NOW()
  ORDER BY a.due_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
