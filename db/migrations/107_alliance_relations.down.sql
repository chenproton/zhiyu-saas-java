ALTER TABLE alliance_agreements DROP COLUMN IF EXISTS created_by;
ALTER TABLE alliance_experts DROP COLUMN IF EXISTS created_by;
ALTER TABLE alliance_achievements DROP COLUMN IF EXISTS created_by;
ALTER TABLE alliance_projects DROP COLUMN IF EXISTS created_by;
ALTER TABLE alliance_enterprises DROP COLUMN IF EXISTS created_by;

ALTER TABLE alliance_experts DROP COLUMN IF EXISTS organization;
