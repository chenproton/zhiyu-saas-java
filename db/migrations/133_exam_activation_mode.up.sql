-- 考试统一生命周期：启用条件列 + 状态归一化
ALTER TABLE exam_usages
    ADD COLUMN activation_mode VARCHAR(16) NOT NULL DEFAULT 'manual';

-- 状态归一化：in_progress 并入 published（三态：draft/published/finished）
UPDATE exam_usages SET status = 'published' WHERE status = 'in_progress';

-- 旧数据回填：场景任务（task）从测评方式配置读取启用条件，无配置时试卷默认 manual、题库/随堂测默认 always
UPDATE exam_usages eu
SET activation_mode = COALESCE((
    SELECT CASE
        WHEN tem.resource_config->>'$.activationMode' IS NOT NULL THEN tem.resource_config->>'$.activationMode'
        WHEN tem.method_key IN ('question_bank', 'quiz') THEN 'always'
        ELSE 'manual'
    END
    FROM task_evaluation_methods tem
    WHERE JSON_CONTAINS(eu.target_ids, JSON_QUOTE(tem.task_id), '$')
        AND eu.exam_id = COALESCE(
            NULLIF(tem.resource_config->>'$.paperId', ''),
            NULLIF(tem.resource_config->>'$.examId', '')
        )
    LIMIT 1
), 'manual')
WHERE eu.target_type = 'task';

-- 旧数据回填：课程节点（node）从节点 eval_data 的 methodResourceConfigs 读取
UPDATE exam_usages eu
SET activation_mode = COALESCE((
    SELECT CASE
        WHEN rc.rc_value->>'$.activationMode' IS NOT NULL THEN rc.rc_value->>'$.activationMode'
        WHEN rc.rc_key IN ('question_bank', 'quiz') THEN 'always'
        ELSE 'manual'
    END
    FROM system_course_nodes n
    JOIN LATERAL (
        SELECT k.rc_key AS rc_key,
               JSON_EXTRACT(
                   COALESCE(JSON_EXTRACT(n.eval_data, '$.evalRuleConfig.methodResourceConfigs'), JSON_OBJECT()),
                   CONCAT('$."', k.rc_key, '"')
               ) AS rc_value
        FROM JSON_TABLE(
            JSON_KEYS(COALESCE(JSON_EXTRACT(n.eval_data, '$.evalRuleConfig.methodResourceConfigs'), JSON_OBJECT())),
            '$[*]' COLUMNS (rc_key VARCHAR(64) PATH '$')
        ) k
    ) rc
    WHERE n.id = JSON_UNQUOTE(JSON_EXTRACT(eu.target_ids, '$[0]'))
        AND rc.rc_value->>'$.examId' IS NOT NULL
        AND rc.rc_value->>'$.examId' = CAST(eu.exam_id AS CHAR)
    LIMIT 1
), 'manual')
WHERE eu.target_type = 'node';
