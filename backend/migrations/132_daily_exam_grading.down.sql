-- 日常考试评价：回滚考试结果评分字段
ALTER TABLE public.exam_results
    DROP COLUMN IF EXISTS grading_status,
    DROP COLUMN IF EXISTS grading_scores,
    DROP COLUMN IF EXISTS grading_comment,
    DROP COLUMN IF EXISTS grader_id,
    DROP COLUMN IF EXISTS graded_at;
