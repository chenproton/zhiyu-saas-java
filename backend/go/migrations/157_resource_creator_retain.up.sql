-- 用户删除后保留其创建的资源：资源类表的 creator 外键由 ON DELETE CASCADE 改为 ON DELETE SET NULL。
-- 原则：岗位/场景/课程/题库/题目/试卷等资源属于租户资产，创建人离职后应保留；
-- 学生成绩/行为/评价等记录仍随用户级联清理（保持 115 迁移的既定语义）。
-- 需要 SET NULL 且列原为 NOT NULL 的（scenarios/courses/question_banks）先放开非空约束。

ALTER TABLE scenarios ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS fk_scenarios_creator;
ALTER TABLE scenarios ADD CONSTRAINT fk_scenarios_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE courses ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE courses DROP CONSTRAINT IF EXISTS fk_courses_creator;
ALTER TABLE courses ADD CONSTRAINT fk_courses_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE question_banks ALTER COLUMN creator_id DROP NOT NULL;
ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS fk_question_banks_creator;
ALTER TABLE question_banks ADD CONSTRAINT fk_question_banks_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE knowledge_points DROP CONSTRAINT IF EXISTS fk_knowledge_points_creator;
ALTER TABLE knowledge_points ADD CONSTRAINT fk_knowledge_points_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE exams DROP CONSTRAINT IF EXISTS fk_exams_creator;
ALTER TABLE exams ADD CONSTRAINT fk_exams_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL;
