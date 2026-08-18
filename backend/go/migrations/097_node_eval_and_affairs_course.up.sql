-- 097: 体系课测评下放节点 + Affairs 纳管体系课
-- 1) 节点级评价结果表（承接节点考试/作业/评审等得分）
-- 2) 人培方案/教学计划支持关联体系课 course_id
-- 3) exam_usages.target_type 已在代码层支持 'node'（字段为 varchar，无 CHECK 约束）

CREATE TABLE IF NOT EXISTS node_evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    node_id UUID NOT NULL REFERENCES system_course_nodes(id),
    method_key VARCHAR(32) NOT NULL,
    evaluatee_id UUID NOT NULL REFERENCES users(id),
    evaluator_id UUID REFERENCES users(id),
    evaluator_type VARCHAR(16),
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    total_score NUMERIC(7,2),
    max_score NUMERIC(7,2) DEFAULT 100 NOT NULL,
    eval_point_scores JSONB DEFAULT '{}'::jsonb NOT NULL,
    objective_answers JSONB DEFAULT '{}'::jsonb NOT NULL,
    subjective_content JSONB DEFAULT '{}'::jsonb NOT NULL,
    drawn_questions JSONB DEFAULT '{}'::jsonb NOT NULL,
    comment TEXT,
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, node_id, evaluatee_id, method_key)
);

CREATE INDEX IF NOT EXISTS idx_node_eval_results_tenant ON node_evaluation_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_node_eval_results_node ON node_evaluation_results(node_id);
CREATE INDEX IF NOT EXISTS idx_node_eval_results_evaluatee ON node_evaluation_results(evaluatee_id);
CREATE INDEX IF NOT EXISTS idx_node_eval_results_node_evaluatee ON node_evaluation_results(node_id, evaluatee_id);

-- Affairs: 人培方案课程设置支持关联体系课
ALTER TABLE training_program_courses
    ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);

CREATE INDEX IF NOT EXISTS idx_training_program_courses_course ON training_program_courses(course_id);

-- Affairs: 教学计划条目支持关联体系课
ALTER TABLE teaching_plan_entries
    ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);

CREATE INDEX IF NOT EXISTS idx_teaching_plan_entries_course ON teaching_plan_entries(course_id);
