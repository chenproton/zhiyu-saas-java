-- 123 回滚：评价标准"纯复制"语义
-- 注意：评分规则项复制到任务侧后，回滚不恢复 rubric_template_id 引用（信息已完整保留在任务侧）。

DROP TABLE IF EXISTS public.task_eval_score_rules;

ALTER TABLE public.task_evaluation_methods
    DROP COLUMN IF EXISTS standard_name,
    DROP COLUMN IF EXISTS standard_mode;
