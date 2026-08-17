-- 123: 评价标准"纯复制"语义
-- 任务侧独立保存评价标准数据（量规在 task_eval_points，评分规则在新表 task_eval_score_rules），
-- 不再依赖 rubric_template_id 引用；存量引用一次性清理（评分项复制到任务侧后置空）。

ALTER TABLE public.task_evaluation_methods
    ADD COLUMN standard_name character varying(256),
    ADD COLUMN standard_mode character varying(16);

CREATE TABLE public.task_eval_score_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    config_id uuid NOT NULL,
    name character varying(256) NOT NULL,
    description text,
    rule text,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.task_eval_score_rules
    ADD CONSTRAINT task_eval_score_rules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.task_eval_score_rules
    ADD CONSTRAINT task_eval_score_rules_config_id_fkey FOREIGN KEY (config_id) REFERENCES public.task_evaluation_methods(id) ON DELETE CASCADE;

CREATE INDEX idx_task_eval_score_rules_config ON public.task_eval_score_rules USING btree (config_id);

-- 存量：score_rule 任务把模板评分项复制到任务侧（软删模板也可读，避免丢数据）
INSERT INTO public.task_eval_score_rules (tenant_id, config_id, name, description, rule, weight, sort_order)
SELECT tem.tenant_id, tem.id, item->>'name', item->>'desc', item->>'rule', COALESCE((item->>'weight')::numeric, 0), ord
FROM public.task_evaluation_methods tem
JOIN public.rubric_templates rt ON rt.id = tem.rubric_template_id
CROSS JOIN LATERAL jsonb_array_elements(rt.data->'scoreRuleItems') WITH ORDINALITY AS it(item, ord)
WHERE rt.mode = 'score_rule' AND tem.rubric_template_id IS NOT NULL;

-- 存量：标准信息回填（名称/模式），并清除全部模板引用（量规已复制在 task_eval_points，无损）
UPDATE public.task_evaluation_methods tem
SET standard_name = rt.name,
    standard_mode = rt.mode,
    rubric_template_id = NULL
FROM public.rubric_templates rt
WHERE rt.id = tem.rubric_template_id AND tem.rubric_template_id IS NOT NULL;

-- 存量：悬空引用（模板已物理删除）直接置空
UPDATE public.task_evaluation_methods SET rubric_template_id = NULL WHERE rubric_template_id IS NOT NULL;
