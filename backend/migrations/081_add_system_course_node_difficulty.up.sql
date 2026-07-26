-- 为体系课节点增加难度字段，支持从引用的颗粒课复制难度
ALTER TABLE system_course_nodes ADD COLUMN IF NOT EXISTS difficulty INT;
