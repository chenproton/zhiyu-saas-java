-- 工作台核心查询索引：教师/学生排课（tenant 前缀过滤）、班级多归属 GIN、待办审批计数
CREATE INDEX IF NOT EXISTS idx_schedule_entries_tenant_teacher ON schedule_entries(tenant_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_tenant_class ON schedule_entries(tenant_id, class_node_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_class_node_ids_gin ON schedule_entries USING GIN (class_node_ids);
CREATE INDEX IF NOT EXISTS idx_approval_records_status_tenant ON approval_records(status, tenant_id);
