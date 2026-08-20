-- 158_snapshot_versioning 回滚：恢复删题级联、删版本列、删快照表
-- 注意：升级后若已有题目被删除（question_id 被置 NULL），恢复 NOT NULL 会失败，需先人工处理这些行。

SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
CALL drop_all_fks('exam_questions');ALTER TABLE exam_questions DROP INDEX exam_questions_question_id_fkey;
ALTER TABLE exam_questions MODIFY COLUMN question_id CHAR(36) NOT NULL;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

ALTER TABLE exam_results              DROP COLUMN version;
ALTER TABLE course_evaluation_results DROP COLUMN version;
ALTER TABLE node_evaluation_results   DROP COLUMN version;
ALTER TABLE scene_evaluation_results  DROP COLUMN version;
ALTER TABLE exam_usages    DROP COLUMN exam_version;
ALTER TABLE schedule_entries DROP COLUMN resource_version;

DROP TABLE resource_snapshots;

SET FOREIGN_KEY_CHECKS = 1;