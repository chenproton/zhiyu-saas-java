-- 158_snapshot_versioning 回滚：恢复删题级联、删版本列、删快照表
-- 注意：升级后若已有题目被删除（question_id 被置 NULL），恢复 NOT NULL 会失败，需先人工处理这些行。

ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_question_id_fkey;
ALTER TABLE exam_questions ALTER COLUMN question_id SET NOT NULL;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_question_id_fkey
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE;

ALTER TABLE exam_results              DROP COLUMN version;
ALTER TABLE course_evaluation_results DROP COLUMN version;
ALTER TABLE node_evaluation_results   DROP COLUMN version;
ALTER TABLE scene_evaluation_results  DROP COLUMN version;
ALTER TABLE exam_usages    DROP COLUMN exam_version;
ALTER TABLE schedule_entries DROP COLUMN resource_version;

DROP TABLE resource_snapshots;
