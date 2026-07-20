-- 053: Add description PDF URL to scenario tasks
ALTER TABLE scenario_tasks ADD COLUMN IF NOT EXISTS description_pdf TEXT;
