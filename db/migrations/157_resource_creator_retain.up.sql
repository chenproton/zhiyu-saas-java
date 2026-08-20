-- 用户删除后保留其创建的资源：资源类表的 creator 外键由 ON DELETE CASCADE 改为 ON DELETE SET NULL。
-- 原则：岗位/场景/课程/题库/题目/试卷等资源属于租户资产，创建人离职后应保留；
-- 学生成绩/行为/评价等记录仍随用户级联清理（保持 115 迁移的既定语义）。
-- 需要 SET NULL 且列原为 NOT NULL 的（scenarios/courses/question_banks）先放开非空约束。
-- MySQL 版：ALTER COLUMN ... DROP NOT NULL 改 MODIFY COLUMN ... NULL；DROP CONSTRAINT IF EXISTS 改 DROP FOREIGN KEY（全新初始化时约束必存在）。

ALTER TABLE scenarios MODIFY COLUMN creator_id CHAR(36) NULL;
CALL drop_fk_if_exists('scenarios', 'creator_id', 'users');
ALTER TABLE scenarios ADD CONSTRAINT fk_scenarios_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE courses MODIFY COLUMN creator_id CHAR(36) NULL;
CALL drop_fk_if_exists('courses', 'creator_id', 'users');
ALTER TABLE courses ADD CONSTRAINT fk_courses_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE question_banks MODIFY COLUMN creator_id CHAR(36) NULL;
CALL drop_fk_if_exists('question_banks', 'creator_id', 'users');
ALTER TABLE question_banks ADD CONSTRAINT fk_question_banks_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('knowledge_points', 'creator_id', 'users');
ALTER TABLE knowledge_points ADD CONSTRAINT fk_knowledge_points_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

CALL drop_fk_if_exists('exams', 'creator_id', 'users');
ALTER TABLE exams ADD CONSTRAINT fk_exams_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
