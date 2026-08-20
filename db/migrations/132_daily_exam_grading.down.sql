-- 日常考试评价：回滚考试结果评分字段
SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE exam_results
    DROP COLUMN grading_status,
    DROP COLUMN grading_scores,
    DROP COLUMN grading_comment,
    DROP COLUMN grader_id,
    DROP COLUMN graded_at;

SET FOREIGN_KEY_CHECKS = 1;