-- 专业表与组织架构解耦：删除 majors.org_node_id 字段
ALTER TABLE majors DROP COLUMN IF EXISTS org_node_id;
