-- 070_soft_delete_eval_methods_and_templates
-- 测评方式取消勾选改为软删除（隐藏），模板删除改为软删除，确保历史任务不受影响

ALTER TABLE task_evaluation_methods
    ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE rubric_templates
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_task_evaluation_methods_enabled
    ON task_evaluation_methods(task_id, tenant_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_rubric_templates_deleted
    ON rubric_templates(tenant_id, is_deleted);
