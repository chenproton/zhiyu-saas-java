-- Revert scenario industry/profession array columns.
ALTER TABLE scenarios
    DROP COLUMN IF EXISTS industry_ids,
    DROP COLUMN IF EXISTS profession_ids;
