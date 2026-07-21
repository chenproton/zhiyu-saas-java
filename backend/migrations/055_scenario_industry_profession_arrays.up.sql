-- Add array columns for scenario industries and professions to support multi-select.
ALTER TABLE scenarios
    ADD COLUMN IF NOT EXISTS industry_ids VARCHAR(64)[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS profession_ids UUID[] NOT NULL DEFAULT '{}';

-- Migrate existing single-value data into the new arrays.
UPDATE scenarios
SET industry_ids = CASE WHEN industry_id IS NOT NULL THEN ARRAY[industry_id] ELSE '{}' END,
    profession_ids = CASE WHEN profession_id IS NOT NULL THEN ARRAY[profession_id] ELSE '{}' END;
