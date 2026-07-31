ALTER TABLE alliance_agreements ADD COLUMN IF NOT EXISTS project_ids JSONB DEFAULT '[]';
