-- 123: 评价标准"纯复制"语义
-- 任务侧独立保存评价标准数据（量规在 task_eval_points，评分规则在新表 task_eval_score_rules），
-- 不再依赖 rubric_template_id 引用；存量引用一次性清理（评分项复制到任务侧后置空）。

ALTER TABLE task_evaluation_methods
    ADD COLUMN standard_name VARCHAR(256),
    ADD COLUMN standard_mode VARCHAR(16);

CREATE TABLE task_eval_score_rules (
    id CHAR(36) DEFAULT (UUID()) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    config_id CHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description LONGTEXT,
    rule LONGTEXT,
    weight DECIMAL(5,2) DEFAULT 0 NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE task_eval_score_rules
    ADD CONSTRAINT task_eval_score_rules_pkey PRIMARY KEY (id);

ALTER TABLE task_eval_score_rules
    ADD CONSTRAINT task_eval_score_rules_config_id_fkey FOREIGN KEY (config_id) REFERENCES task_evaluation_methods(id) ON DELETE CASCADE;

CREATE INDEX idx_task_eval_score_rules_config ON task_eval_score_rules (config_id);

-- 存量：score_rule 任务把模板评分项复制到任务侧（软删模板也可读，避免丢数据）
INSERT INTO task_eval_score_rules (tenant_id, config_id, name, description, rule, weight, sort_order)
SELECT tem.tenant_id, tem.id, it.item->>'$.name', it.item->>'$.desc', it.item->>'$.rule',
       COALESCE(CAST(it.item->>'$.weight' AS DECIMAL(10,2)), 0), it.ord
FROM task_evaluation_methods tem
JOIN rubric_templates rt ON rt.id = tem.rubric_template_id
JOIN JSON_TABLE(rt.data, '$.scoreRuleItems[*]' COLUMNS (
    item JSON PATH '$',
    ord FOR ORDINALITY
)) AS it
WHERE rt.mode = 'score_rule' AND tem.rubric_template_id IS NOT NULL;

-- 存量：标准信息回填（名称/模式），并清除全部模板引用（量规已复制在 task_eval_points，无损）
UPDATE task_evaluation_methods tem
JOIN rubric_templates rt ON rt.id = tem.rubric_template_id
SET tem.standard_name = rt.name,
    tem.standard_mode = rt.mode,
    tem.rubric_template_id = NULL
WHERE tem.rubric_template_id IS NOT NULL;

-- 存量：悬空引用（模板已物理删除）直接置空
UPDATE task_evaluation_methods SET rubric_template_id = NULL WHERE rubric_template_id IS NOT NULL;
