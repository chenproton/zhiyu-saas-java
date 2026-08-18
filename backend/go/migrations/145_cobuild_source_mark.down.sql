DROP INDEX IF EXISTS idx_scenarios_source_enterprise;
ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS scenarios_source_type_check;
ALTER TABLE scenarios DROP COLUMN IF EXISTS source_enterprise_id;
ALTER TABLE scenarios DROP COLUMN IF EXISTS source_type;

DROP INDEX IF EXISTS idx_career_positions_source_enterprise;
ALTER TABLE career_positions DROP CONSTRAINT IF EXISTS career_positions_source_type_check;
ALTER TABLE career_positions DROP COLUMN IF EXISTS source_enterprise_id;
ALTER TABLE career_positions DROP COLUMN IF EXISTS source_type;
