-- 回滚：恢复 majors.org_node_id 字段（数据已丢失，仅恢复结构）
ALTER TABLE majors ADD COLUMN IF NOT EXISTS org_node_id UUID;
