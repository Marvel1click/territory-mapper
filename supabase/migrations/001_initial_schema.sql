-- Initial Schema Migration for Territory Mapper
-- Creates tables with proper constraints and indexes

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Congregations table
CREATE TABLE IF NOT EXISTS congregations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB DEFAULT '{
    "default_map_center": [-74.006, 40.7128],
    "default_map_zoom": 12
  }'::jsonb
);

-- Territories table
CREATE TABLE IF NOT EXISTS territories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  boundary JSONB NOT NULL, -- GeoJSON Polygon
  center JSONB NOT NULL, -- [lng, lat]
  status TEXT NOT NULL CHECK (status IN ('in-stock', 'out', 'pending')),
  color TEXT DEFAULT '#3b82f6',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Houses table
CREATE TABLE IF NOT EXISTS houses (
  id TEXT PRIMARY KEY,
  territory_id TEXT NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  coordinates JSONB NOT NULL, -- [lng, lat]
  status TEXT NOT NULL CHECK (status IN ('not-visited', 'nah', 'interest', 'return-visit', 'dnc')),
  notes TEXT,
  is_dnc BOOLEAN DEFAULT FALSE,
  dnc_encrypted_address TEXT,
  last_visited TIMESTAMP WITH TIME ZONE,
  last_visitor UUID,
  return_visit_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  territory_id TEXT NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
  publisher_id UUID NOT NULL,
  publisher_name TEXT NOT NULL,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  checked_out_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checked_out_by UUID NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('active', 'returned', 'overdue')),
  qr_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sync state table (for tracking sync metadata)
CREATE TABLE IF NOT EXISTS sync_state (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  last_sync TIMESTAMP WITH TIME ZONE,
  pending_changes INTEGER DEFAULT 0,
  sync_status TEXT CHECK (sync_status IN ('idle', 'syncing', 'error')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, collection)
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  congregation_id UUID NOT NULL REFERENCES congregations(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'checkout', 'return'
  entity_type TEXT NOT NULL, -- 'territory', 'house', 'assignment'
  entity_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_territories_congregation ON territories(congregation_id);
CREATE INDEX idx_territories_status ON territories(status);
CREATE INDEX idx_territories_created_by ON territories(created_by);

CREATE INDEX idx_houses_territory ON houses(territory_id);
CREATE INDEX idx_houses_congregation ON houses(congregation_id);
CREATE INDEX idx_houses_status ON houses(status);
CREATE INDEX idx_houses_is_dnc ON houses(is_dnc);

CREATE INDEX idx_assignments_territory ON assignments(territory_id);
CREATE INDEX idx_assignments_publisher ON assignments(publisher_id);
CREATE INDEX idx_assignments_congregation ON assignments(congregation_id);
CREATE INDEX idx_assignments_status ON assignments(status);

CREATE INDEX idx_activity_log_congregation ON activity_log(congregation_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

CREATE INDEX idx_sync_state_user ON sync_state(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_territories_updated_at
  BEFORE UPDATE ON territories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_houses_updated_at
  BEFORE UPDATE ON houses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_state_updated_at
  BEFORE UPDATE ON sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to log activity
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_congregation_id UUID;
  v_action TEXT;
BEGIN
  -- Get user ID from current session
  v_user_id := auth.uid();
  
  -- Get congregation ID based on table
  IF TG_TABLE_NAME = 'territories' THEN
    v_congregation_id := NEW.congregation_id;
  ELSIF TG_TABLE_NAME = 'houses' THEN
    v_congregation_id := NEW.congregation_id;
  ELSIF TG_TABLE_NAME = 'assignments' THEN
    v_congregation_id := NEW.congregation_id;
  END IF;
  
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_congregation_id := OLD.congregation_id;
  END IF;
  
  -- Insert activity log
  INSERT INTO activity_log (user_id, congregation_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_user_id,
    v_congregation_id,
    v_action,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object('timestamp', NOW())
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE territories;
ALTER PUBLICATION supabase_realtime ADD TABLE houses;
ALTER PUBLICATION supabase_realtime ADD TABLE assignments;

-- Add comment for documentation
COMMENT ON TABLE territories IS 'Territory boundaries and metadata';
COMMENT ON TABLE houses IS 'Individual addresses within territories';
COMMENT ON TABLE assignments IS 'Territory checkouts to publishers';
COMMENT ON TABLE activity_log IS 'Audit trail for all data changes';
