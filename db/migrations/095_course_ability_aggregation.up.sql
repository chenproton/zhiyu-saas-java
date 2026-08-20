-- 095: 课程评价结果汇入岗位能力汇聚
-- 1) 课程支持关联能力点（与知识点平行）
-- 2) 新建课程级统一评价结果表，承接考试/作业/评审等结果
-- 3) 为能力模型加载提供课程链路

ALTER TABLE courses
    ADD COLUMN ability_point_ids JSON DEFAULT (JSON_ARRAY());

CREATE INDEX idx_courses_ability_point_ids
    ON courses ((CAST(ability_point_ids AS CHAR(64) ARRAY)));

CREATE TABLE IF NOT EXISTS course_evaluation_results (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL REFERENCES tenants(id),
    course_id CHAR(36) NOT NULL REFERENCES courses(id),
    method_key VARCHAR(32) NOT NULL,
    evaluatee_id CHAR(36) NOT NULL REFERENCES users(id),
    evaluator_id CHAR(36) REFERENCES users(id),
    evaluator_type VARCHAR(16),
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    total_score NUMERIC(7,2),
    max_score NUMERIC(7,2) DEFAULT 100 NOT NULL,
    eval_point_scores JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    objective_answers JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    subjective_content JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    drawn_questions JSON DEFAULT (JSON_OBJECT()) NOT NULL,
    comment LONGTEXT,
    graded_at DATETIME,
    graded_by CHAR(36) REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_course_eval_results_tenant ON course_evaluation_results(tenant_id);
CREATE INDEX idx_course_eval_results_course ON course_evaluation_results(course_id);
CREATE INDEX idx_course_eval_results_evaluatee ON course_evaluation_results(evaluatee_id);
CREATE INDEX idx_course_eval_results_course_evaluatee ON course_evaluation_results(course_id, evaluatee_id);

CREATE UNIQUE INDEX idx_course_eval_results_unique
    ON course_evaluation_results (tenant_id, course_id, evaluatee_id, method_key);
