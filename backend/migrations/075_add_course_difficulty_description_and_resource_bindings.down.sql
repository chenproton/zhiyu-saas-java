-- 回滚：删除课程资源绑定表、课程难度和简介字段
DROP TABLE IF EXISTS course_resource_bindings CASCADE;
ALTER TABLE courses DROP COLUMN IF EXISTS difficulty;
ALTER TABLE courses DROP COLUMN IF EXISTS description;
