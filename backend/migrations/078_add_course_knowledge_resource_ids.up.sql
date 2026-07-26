-- 为课程表增加知识点与资源数组字段，与场景任务保持一致
ALTER TABLE courses ADD COLUMN IF NOT EXISTS knowledge_point_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS resource_ids UUID[] NOT NULL DEFAULT '{}';

-- 把已有的课程级绑定数据迁移到新字段
UPDATE courses c
SET knowledge_point_ids = COALESCE((
    SELECT array_agg(ckb.knowledge_point_id)
    FROM course_knowledge_bindings ckb
    WHERE ckb.course_id = c.id AND ckb.bind_type = 'course'
), '{}');

UPDATE courses c
SET resource_ids = COALESCE((
    SELECT array_agg(crb.resource_id)
    FROM course_resource_bindings crb
    WHERE crb.course_id = c.id
), '{}');

-- 同步资源计数
UPDATE courses
SET resource_count = COALESCE(array_length(resource_ids, 1), 0);
