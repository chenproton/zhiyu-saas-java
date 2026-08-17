ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source_type VARCHAR(64);
ALTER TABLE knowledge_points ADD COLUMN IF NOT EXISTS source_id UUID;
