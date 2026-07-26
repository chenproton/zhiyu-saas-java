-- 恢复 system_course_nodes 知识点与资源数组字段，与 scenario_tasks 保持一致
ALTER TABLE system_course_nodes ADD COLUMN IF NOT EXISTS knowledge_point_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE system_course_nodes ADD COLUMN IF NOT EXISTS resource_ids UUID[] NOT NULL DEFAULT '{}';

-- 把已有的节点级绑定数据迁移到新字段
UPDATE system_course_nodes scn
SET knowledge_point_ids = COALESCE((
    SELECT array_agg(nkpb.knowledge_point_id)
    FROM node_knowledge_point_bindings nkpb
    WHERE nkpb.node_id = scn.id
), '{}');

UPDATE system_course_nodes scn
SET resource_ids = COALESCE((
    SELECT array_agg(nrb.resource_id)
    FROM node_resource_bindings nrb
    WHERE nrb.node_id = scn.id
), '{}');
