-- 日常考试评价：考试结果增加教师评分字段
ALTER TABLE exam_results
    ADD COLUMN grading_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    ADD COLUMN grading_scores JSON NOT NULL DEFAULT (JSON_OBJECT()),
    ADD COLUMN grading_comment LONGTEXT,
    ADD COLUMN grader_id CHAR(36),
    ADD COLUMN graded_at DATETIME;
