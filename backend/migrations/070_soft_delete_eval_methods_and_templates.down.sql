-- 070_soft_delete_eval_methods_and_templates down

DROP INDEX IF EXISTS idx_task_evaluation_methods_enabled;
DROP INDEX IF EXISTS idx_rubric_templates_deleted;

ALTER TABLE task_evaluation_methods
    DROP COLUMN IF EXISTS is_enabled;

ALTER TABLE rubric_templates
    DROP COLUMN IF EXISTS is_deleted;
