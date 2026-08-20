-- 排课条目支持多班级
ALTER TABLE schedule_entries ADD COLUMN class_node_ids JSON NOT NULL DEFAULT (JSON_ARRAY());

-- 回填现有单班级数据
UPDATE schedule_entries SET class_node_ids = JSON_ARRAY(class_node_id)
WHERE class_node_id IS NOT NULL AND (class_node_ids IS NULL OR JSON_LENGTH(class_node_ids) = 0);
