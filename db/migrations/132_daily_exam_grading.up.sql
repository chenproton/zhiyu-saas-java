-- 日常考试评价：考试结果增加教师评分字段
ALTER TABLE public.exam_results
    ADD COLUMN grading_status character varying(16) NOT NULL DEFAULT 'pending',
    ADD COLUMN grading_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN grading_comment text,
    ADD COLUMN grader_id uuid,
    ADD COLUMN graded_at timestamp with time zone;
