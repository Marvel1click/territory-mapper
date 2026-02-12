-- Seed data for Territory Mapper development
-- Run this after migrations to populate initial data

-- Create a demo congregation
INSERT INTO congregations (id, name, settings)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'Demo Congregation',
  '{
    "default_map_center": [-74.006, 40.7128],
    "default_map_zoom": 13
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create sample territories (NYC area)
INSERT INTO territories (
  id, name, description, congregation_id, boundary, center, status, color, created_by
) VALUES 
(
  'territory-001',
  'Manhattan - Lower East Side',
  'Dense residential area with many apartment buildings',
  '550e8400-e29b-41d4-a716-446655440000',
  '{
    "type": "Polygon",
    "coordinates": [[
      [-73.991, 40.715],
      [-73.985, 40.715],
      [-73.985, 40.720],
      [-73.991, 40.720],
      [-73.991, 40.715]
    ]]
  }'::jsonb,
  '[-73.988, 40.7175]'::jsonb,
  'in-stock',
  '#3b82f6',
  '00000000-0000-0000-0000-000000000000'
),
(
  'territory-002',
  'Brooklyn - Williamsburg',
  'Mix of residential and commercial buildings',
  '550e8400-e29b-41d4-a716-446655440000',
  '{
    "type": "Polygon",
    "coordinates": [[
      [-73.965, 40.710],
      [-73.955, 40.710],
      [-73.955, 40.718],
      [-73.965, 40.718],
      [-73.965, 40.710]
    ]]
  }'::jsonb,
  '[-73.960, 40.714]'::jsonb,
  'in-stock',
  '#10b981',
  '00000000-0000-0000-0000-000000000000'
),
(
  'territory-003',
  'Queens - Astoria',
  'Residential neighborhood with houses and apartments',
  '550e8400-e29b-41d4-a716-446655440000',
  '{
    "type": "Polygon",
    "coordinates": [[
      [-73.930, 40.760],
      [-73.920, 40.760],
      [-73.920, 40.770],
      [-73.930, 40.770],
      [-73.930, 40.760]
    ]]
  }'::jsonb,
  '[-73.925, 40.765]'::jsonb,
  'out',
  '#f59e0b',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

-- Create sample houses for each territory
INSERT INTO houses (
  id, territory_id, congregation_id, address, coordinates, status, notes, is_dnc
) VALUES
-- Manhattan houses
('house-001', 'territory-001', '550e8400-e29b-41d4-a716-446655440000', '123 Orchard St, New York, NY 10002', '[-73.990, 40.718]', 'not-visited', null, false),
('house-002', 'territory-001', '550e8400-e29b-41d4-a716-446655440000', '125 Orchard St, New York, NY 10002', '[-73.989, 40.718]', 'nah', 'Not home on weekdays', false),
('house-003', 'territory-001', '550e8400-e29b-41d4-a716-446655440000', '127 Orchard St, New York, NY 10002', '[-73.988, 40.718]', 'interest', 'Interested in Bible study', false),
('house-004', 'territory-001', '550e8400-e29b-41d4-a716-446655440000', '129 Orchard St, New York, NY 10002', '[-73.987, 40.718]', 'return-visit', 'Return visit scheduled', false),
('house-005', 'territory-001', '550e8400-e29b-41d4-a716-446655440000', '131 Orchard St, New York, NY 10002', '[-73.986, 40.718]', 'dnc', null, true),

-- Brooklyn houses
('house-006', 'territory-002', '550e8400-e29b-41d4-a716-446655440000', '456 Bedford Ave, Brooklyn, NY 11211', '[-73.964, 40.715]', 'not-visited', null, false),
('house-007', 'territory-002', '550e8400-e29b-41d4-a716-446655440000', '458 Bedford Ave, Brooklyn, NY 11211', '[-73.963, 40.715]', 'interest', 'Took literature', false),
('house-008', 'territory-002', '550e8400-e29b-41d4-a716-446655440000', '460 Bedford Ave, Brooklyn, NY 11211', '[-73.962, 40.715]', 'nah', 'Work from home, try weekends', false),
('house-009', 'territory-002', '550e8400-e29b-41d4-a716-446655440000', '462 Bedford Ave, Brooklyn, NY 11211', '[-73.961, 40.715]', 'not-visited', null, false),

-- Queens houses
('house-010', 'territory-003', '550e8400-e29b-41d4-a716-446655440000', '789 30th Ave, Astoria, NY 11102', '[-73.929, 40.765]', 'not-visited', null, false),
('house-011', 'territory-003', '550e8400-e29b-41d4-a716-446655440000', '791 30th Ave, Astoria, NY 11102', '[-73.928, 40.765]', 'not-visited', null, false),
('house-012', 'territory-003', '550e8400-e29b-41d4-a716-446655440000', '793 30th Ave, Astoria, NY 11102', '[-73.927, 40.765]', 'dnc', null, true)
ON CONFLICT (id) DO NOTHING;

-- Create a sample assignment (territory-003 checked out)
INSERT INTO assignments (
  id, territory_id, publisher_id, publisher_name, congregation_id, 
  checked_out_by, due_date, status, qr_token
)
SELECT
  'assignment-001',
  'territory-003',
  auth.users.id,
  COALESCE(auth.users.raw_user_meta_data->>'full_name', 'Demo User'),
  '550e8400-e29b-41d4-a716-446655440000',
  auth.users.id,
  NOW() + INTERVAL '14 days',
  'active',
  'demo-qr-token-123'
FROM auth.users
WHERE auth.users.email = 'demo@example.com'
ON CONFLICT (id) DO NOTHING;

-- Add comments
COMMENT ON TABLE territories IS 'Stores territory boundaries and metadata';
COMMENT ON TABLE houses IS 'Individual addresses within territories';
COMMENT ON TABLE assignments IS 'Tracks territory checkouts to publishers';
COMMENT ON TABLE congregations IS 'Congregation settings and configuration';
