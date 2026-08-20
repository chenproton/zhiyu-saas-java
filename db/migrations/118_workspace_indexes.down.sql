SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP INDEX idx_schedule_entries_tenant_teacher ON schedule_entries;
DROP INDEX idx_schedule_entries_tenant_class ON schedule_entries;
DROP INDEX idx_schedule_entries_class_node_ids_gin ON schedule_entries;
DROP INDEX idx_approval_records_status_tenant ON approval_records;

SET FOREIGN_KEY_CHECKS = 1;