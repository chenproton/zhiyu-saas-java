-- 考试统一生命周期：启用条件列 + 状态归一化
ALTER TABLE public.exam_usages
    ADD COLUMN activation_mode character varying(16) NOT NULL DEFAULT 'manual';

-- 状态归一化：in_progress 并入 published（三态：draft/published/finished）
UPDATE public.exam_usages SET status = 'published' WHERE status = 'in_progress';

-- 旧数据回填：场景任务（task）从测评方式配置读取启用条件，无配置时试卷默认 manual、题库/随堂测默认 always
UPDATE public.exam_usages eu
SET activation_mode = COALESCE((
    SELECT CASE
        WHEN tem.resource_config->>'activationMode' IS NOT NULL THEN tem.resource_config->>'activationMode'
        WHEN tem.method_key IN ('question_bank', 'quiz') THEN 'always'
        ELSE 'manual'
    END
    FROM task_evaluation_methods tem
    WHERE tem.task_id = ANY(eu.target_ids)
        AND eu.exam_id = COALESCE(
            NULLIF(tem.resource_config->>'paperId', ''),
            NULLIF(tem.resource_config->>'examId', '')
        )::uuid
    LIMIT 1
), 'manual')
WHERE eu.target_type = 'task';

-- 旧数据回填：课程节点（node）从节点 eval_data 的 methodResourceConfigs 读取
UPDATE public.exam_usages eu
SET activation_mode = COALESCE((
    SELECT CASE
        WHEN rc.value->>'activationMode' IS NOT NULL THEN rc.value->>'activationMode'
        WHEN rc.key IN ('question_bank', 'quiz') THEN 'always'
        ELSE 'manual'
    END
    FROM system_course_nodes n
    CROSS JOIN LATERAL jsonb_each(
        COALESCE(n.eval_data->'evalRuleConfig'->'methodResourceConfigs', '{}'::jsonb)
    ) rc
    WHERE n.id = eu.target_ids[1]
        AND rc.value->>'examId' IS NOT NULL
        AND rc.value->>'examId' = eu.exam_id::text
    LIMIT 1
), 'manual')
WHERE eu.target_type = 'node';
