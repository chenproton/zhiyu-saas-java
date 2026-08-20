-- 排课条目支持多班级
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS class_node_ids UUID[] NOT NULL DEFAULT '{}';

-- 回填现有单班级数据
UPDATE schedule_entries SET class_node_ids = ARRAY[class_node_id] WHERE class_node_id IS NOT NULL AND array_length(class_node_ids, 1) IS NULL;
