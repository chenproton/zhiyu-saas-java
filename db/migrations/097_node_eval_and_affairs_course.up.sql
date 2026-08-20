-- 097: 体系课测评下放节点 + Affairs 纳管体系课
-- 1) 节点级评价结果表（承接节点考试/作业/评审等得分）
-- 2) 人培方案/教学计划支持关联体系课 course_id
-- 3) exam_usages.target_type 已在代码层支持 'node'（字段为 varchar，无 CHECK 约束）

CREATE TABLE IF NOT EXISTS node_evaluation_results (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL REFERENCES tenants(id),
    node_id CHAR(36) NOT NULL REFERENCES system_course_nodes(id),
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
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, node_id, evaluatee_id, method_key)
);

CREATE INDEX idx_node_eval_results_tenant ON node_evaluation_results(tenant_id);
CREATE INDEX idx_node_eval_results_node ON node_evaluation_results(node_id);
CREATE INDEX idx_node_eval_results_evaluatee ON node_evaluation_results(evaluatee_id);
CREATE INDEX idx_node_eval_results_node_evaluatee ON node_evaluation_results(node_id, evaluatee_id);

-- Affairs: 人培方案课程设置支持关联体系课
ALTER TABLE training_program_courses
    ADD COLUMN course_id CHAR(36) REFERENCES courses(id);

CREATE INDEX idx_training_program_courses_course ON training_program_courses(course_id);

-- Affairs: 教学计划条目支持关联体系课
ALTER TABLE teaching_plan_entries
    ADD COLUMN course_id CHAR(36) REFERENCES courses(id);

CREATE INDEX idx_teaching_plan_entries_course ON teaching_plan_entries(course_id);
