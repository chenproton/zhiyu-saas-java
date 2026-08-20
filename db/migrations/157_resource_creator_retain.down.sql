-- 回滚：恢复创建者外键为 ON DELETE CASCADE（资源随用户删除）。
-- 注意：若 157 之后有资源创建者被删除（creator_id 已置 NULL），此处恢复 SET NOT NULL 将失败；
-- 回滚前需人工回填 creator_id 或先恢复数据。

ALTER TABLE scenarios DROP CONSTRAINT IF EXISTS fk_scenarios_creator;
ALTER TABLE scenarios ADD CONSTRAINT fk_scenarios_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE scenarios ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE courses DROP CONSTRAINT IF EXISTS fk_courses_creator;
ALTER TABLE courses ADD CONSTRAINT fk_courses_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE courses ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS fk_question_banks_creator;
ALTER TABLE question_banks ADD CONSTRAINT fk_question_banks_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE question_banks ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE knowledge_points DROP CONSTRAINT IF EXISTS fk_knowledge_points_creator;
ALTER TABLE knowledge_points ADD CONSTRAINT fk_knowledge_points_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE exams DROP CONSTRAINT IF EXISTS fk_exams_creator;
ALTER TABLE exams ADD CONSTRAINT fk_exams_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
