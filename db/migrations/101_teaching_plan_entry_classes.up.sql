-- 教学计划条目多班级关联表
CREATE TABLE IF NOT EXISTS teaching_plan_entry_classes (
    entry_id CHAR(36) NOT NULL REFERENCES teaching_plan_entries(id) ON DELETE CASCADE,
    class_node_id CHAR(36) NOT NULL REFERENCES organizations(id),
    PRIMARY KEY (entry_id, class_node_id)
);

-- 迁移旧数据
INSERT IGNORE INTO teaching_plan_entry_classes (entry_id, class_node_id)
SELECT id, class_node_id FROM teaching_plan_entries WHERE class_node_id IS NOT NULL

