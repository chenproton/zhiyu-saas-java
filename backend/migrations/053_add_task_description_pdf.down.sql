-- 053: Remove description PDF URL from scenario tasks
ALTER TABLE scenario_tasks DROP COLUMN IF EXISTS description_pdf;
