-- Enable Row Level Security on key tables
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable RLS
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_group_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE options_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shadow_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all tables
CREATE POLICY "Authenticated users can read trades"
  ON trades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read strategies"
  ON strategies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read position_group_map"
  ON position_group_map FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read options_cache"
  ON options_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read strategy_evaluations"
  ON strategy_evaluations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read shadow_audit_logs"
  ON shadow_audit_logs FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update/delete (full CRUD for dashboard)
CREATE POLICY "Authenticated users can insert trades"
  ON trades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update trades"
  ON trades FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete trades"
  ON trades FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert strategies"
  ON strategies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update strategies"
  ON strategies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete strategies"
  ON strategies FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert position_group_map"
  ON position_group_map FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update position_group_map"
  ON position_group_map FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete position_group_map"
  ON position_group_map FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update settings"
  ON settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert strategy_evaluations"
  ON strategy_evaluations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert shadow_audit_logs"
  ON shadow_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Also allow the service_role to bypass (it does by default, but explicit)
-- Note: service_role bypasses RLS automatically in Supabase
