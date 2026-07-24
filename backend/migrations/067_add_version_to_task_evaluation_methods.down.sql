-- 067_add_version_to_task_evaluation_methods
-- Remove version column

ALTER TABLE task_evaluation_methods DROP COLUMN IF EXISTS version;
