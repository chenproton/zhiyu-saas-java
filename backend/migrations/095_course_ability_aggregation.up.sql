-- 095: 课程评价结果汇入岗位能力汇聚
-- 1) 课程支持关联能力点（与知识点平行）
-- 2) 新建课程级统一评价结果表，承接考试/作业/评审等结果
-- 3) 为能力模型加载提供课程链路

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS ability_point_ids UUID[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_courses_ability_point_ids
    ON courses USING GIN (ability_point_ids);

CREATE TABLE IF NOT EXISTS course_evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    course_id UUID NOT NULL REFERENCES courses(id),
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_eval_results_tenant ON course_evaluation_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_eval_results_course ON course_evaluation_results(course_id);
CREATE INDEX IF NOT EXISTS idx_course_eval_results_evaluatee ON course_evaluation_results(evaluatee_id);
CREATE INDEX IF NOT EXISTS idx_course_eval_results_course_evaluatee ON course_evaluation_results(course_id, evaluatee_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_eval_results_unique
    ON course_evaluation_results (tenant_id, course_id, evaluatee_id, method_key);
