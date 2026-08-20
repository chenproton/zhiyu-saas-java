-- 096: 课程作业提交与评分
CREATE TABLE IF NOT EXISTS course_homework_submissions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL REFERENCES tenants(id),
    course_id CHAR(36) NOT NULL REFERENCES courses(id),
    homework_id CHAR(36) NOT NULL REFERENCES course_homeworks(id),
    student_id CHAR(36) NOT NULL REFERENCES users(id),
    content LONGTEXT,
    attachment_urls JSON DEFAULT (JSON_ARRAY()),
    status VARCHAR(16) NOT NULL DEFAULT 'submitted',
    score NUMERIC(7,2),
    total_score NUMERIC(7,2) DEFAULT 100,
    graded_at DATETIME,
    graded_by CHAR(36) REFERENCES users(id),
    comment LONGTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_course_hw_sub_tenant ON course_homework_submissions(tenant_id);
CREATE INDEX idx_course_hw_sub_course ON course_homework_submissions(course_id);
CREATE INDEX idx_course_hw_sub_homework ON course_homework_submissions(homework_id);
CREATE INDEX idx_course_hw_sub_student ON course_homework_submissions(student_id);
CREATE UNIQUE INDEX idx_course_hw_sub_unique
    ON course_homework_submissions (homework_id, student_id);
