-- Row Level Security Policies for Territory Mapper
-- Implements congregation-level data isolation

-- Enable RLS on all tables
ALTER TABLE congregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
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

-- ===============================
-- CONGREGATIONS TABLE POLICIES
-- ===============================

-- Users can view their own congregation
CREATE POLICY "Users can view their congregation"
  ON congregations
  FOR SELECT
  USING (
    id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Only admins can create congregations
CREATE POLICY "Only admins can create congregations"
  ON congregations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- Only admins can update their congregation
CREATE POLICY "Only admins can update their congregation"
  ON congregations
  FOR UPDATE
  USING (
    id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- ===============================
-- TERRITORIES TABLE POLICIES
-- ===============================

-- Users can view territories in their congregation
CREATE POLICY "Users can view territories in their congregation"
  ON territories
  FOR SELECT
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Overseers can create territories
CREATE POLICY "Overseers can create territories"
  ON territories
  FOR INSERT
  WITH CHECK (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- Overseers can update territories in their congregation
CREATE POLICY "Overseers can update territories in their congregation"
  ON territories
  FOR UPDATE
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- Overseers can delete territories in their congregation
CREATE POLICY "Overseers can delete territories in their congregation"
  ON territories
  FOR DELETE
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- ===============================
-- HOUSES TABLE POLICIES
-- ===============================

-- Users can view houses in their congregation
CREATE POLICY "Users can view houses in their congregation"
  ON houses
  FOR SELECT
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Overseers can create houses
CREATE POLICY "Overseers can create houses"
  ON houses
  FOR INSERT
  WITH CHECK (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- All congregation members can update houses (for recording visits)
CREATE POLICY "Users can update houses in their congregation"
  ON houses
  FOR UPDATE
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Overseers can delete houses
CREATE POLICY "Overseers can delete houses"
  ON houses
  FOR DELETE
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- ===============================
-- ASSIGNMENTS TABLE POLICIES
-- ===============================

-- Users can view assignments in their congregation
-- Publishers can only see their own assignments
CREATE POLICY "Users can view assignments in their congregation"
  ON assignments
  FOR SELECT
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
    AND (
      -- Overseers can see all assignments
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
      )
      OR
      -- Publishers can only see their own
      publisher_id = auth.uid()
    )
  );

-- Users can create assignments (checkout)
CREATE POLICY "Users can create assignments"
  ON assignments
  FOR INSERT
  WITH CHECK (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- Users can update assignments in their congregation
-- Publishers can update their own, overseers can update any
CREATE POLICY "Users can update assignments in their congregation"
  ON assignments
  FOR UPDATE
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
    AND (
      -- Overseers can update any
      EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
      )
      OR
      -- Publishers can update their own
      publisher_id = auth.uid()
    )
  );

-- Overseers can delete assignments
CREATE POLICY "Overseers can delete assignments"
  ON assignments
  FOR DELETE
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
    )
  );

-- ===============================
-- SYNC STATE TABLE POLICIES
-- ===============================

-- Users can only manage their own sync state
CREATE POLICY "Users can manage their sync state"
  ON sync_state
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===============================
-- ACTIVITY LOG TABLE POLICIES
-- ===============================

-- Users can view activity in their congregation
CREATE POLICY "Users can view activity in their congregation"
  ON activity_log
  FOR SELECT
  USING (
    congregation_id IN (
      SELECT (raw_user_meta_data->>'congregation_id')::UUID
      FROM auth.users
      WHERE id = auth.uid()
    )
  );

-- System can insert activity (via trigger)
CREATE POLICY "System can insert activity"
  ON activity_log
  FOR INSERT
  WITH CHECK (true);

-- ===============================
-- HELPER FUNCTIONS
-- ===============================

-- Function to get user's congregation_id
CREATE OR REPLACE FUNCTION get_user_congregation_id()
RETURNS UUID AS $$
DECLARE
  congregation_id UUID;
BEGIN
  SELECT (raw_user_meta_data->>'congregation_id')::UUID
  INTO congregation_id
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN congregation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is overseer
CREATE OR REPLACE FUNCTION is_user_overseer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND raw_user_meta_data->>'role' IN ('admin', 'overseer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is in congregation
CREATE OR REPLACE FUNCTION is_user_in_congregation(p_congregation_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND (raw_user_meta_data->>'congregation_id')::UUID = p_congregation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON POLICY "Users can view their congregation" ON congregations IS 'Users can only view their own congregation data';
COMMENT ON POLICY "Users can view territories in their congregation" ON territories IS 'Congregation-level isolation for territories';
COMMENT ON POLICY "Users can view houses in their congregation" ON houses IS 'Congregation-level isolation for houses';
COMMENT ON POLICY "Users can view assignments in their congregation" ON assignments IS 'Congregation-level isolation with publisher filtering';
