-- 098: 节点作业提交/批改支持
-- 1) 补齐 node_homeworks 缺失字段（与 ensureNodeHomework 插入语句一致）
-- 2) 新建 node_homework_submissions 表，用于学生提交和教师批改

ALTER TABLE node_homeworks
    ADD COLUMN creator_id CHAR(36) REFERENCES users(id),
    ADD COLUMN status VARCHAR(16) DEFAULT 'published' NOT NULL,
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS node_homework_submissions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL REFERENCES tenants(id),
    node_id CHAR(36) NOT NULL REFERENCES system_course_nodes(id),
    homework_id CHAR(36) NOT NULL REFERENCES node_homeworks(id),
    student_id CHAR(36) NOT NULL REFERENCES users(id),
    content LONGTEXT,
    attachment_urls JSON DEFAULT (JSON_ARRAY()),
    status VARCHAR(16) NOT NULL DEFAULT 'submitted',
    score NUMERIC(7,2),
    total_score NUMERIC(7,2) DEFAULT 100,
    comment LONGTEXT,
    graded_at DATETIME,
    graded_by CHAR(36) REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (homework_id, student_id)
);

CREATE INDEX idx_node_hw_sub_tenant ON node_homework_submissions(tenant_id);
CREATE INDEX idx_node_hw_sub_node ON node_homework_submissions(node_id);
CREATE INDEX idx_node_hw_sub_homework ON node_homework_submissions(homework_id);
CREATE INDEX idx_node_hw_sub_student ON node_homework_submissions(student_id);
