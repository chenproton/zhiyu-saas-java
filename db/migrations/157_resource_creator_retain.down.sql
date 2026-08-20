-- 回滚：恢复创建者外键为 ON DELETE CASCADE（资源随用户删除）。
-- 注意：若 157 之后有资源创建者被删除（creator_id 已置 NULL），此处恢复 SET NOT NULL 将失败；
-- 回滚前需人工回填 creator_id 或先恢复数据。

SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('scenarios');CALL drop_all_fks('courses');CALL drop_all_fks('question_banks');CALL drop_all_fks('knowledge_points');CALL drop_all_fks('exams');ALTER TABLE scenarios ADD CONSTRAINT fk_scenarios_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE scenarios MODIFY COLUMN creator_id CHAR(36) NOT NULL;

ALTER TABLE courses ADD CONSTRAINT fk_courses_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE courses MODIFY COLUMN creator_id CHAR(36) NOT NULL;

ALTER TABLE question_banks ADD CONSTRAINT fk_question_banks_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE question_banks MODIFY COLUMN creator_id CHAR(36) NOT NULL;

ALTER TABLE knowledge_points ADD CONSTRAINT fk_knowledge_points_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE exams ADD CONSTRAINT fk_exams_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;