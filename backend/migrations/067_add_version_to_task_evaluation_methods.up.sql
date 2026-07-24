-- 067_add_version_to_task_evaluation_methods
-- Add optimistic locking version column to prevent concurrent overwrite

ALTER TABLE task_evaluation_methods ADD COLUMN version INT NOT NULL DEFAULT 1;
