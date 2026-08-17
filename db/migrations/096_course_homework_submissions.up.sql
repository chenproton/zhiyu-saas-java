-- 096: 课程作业提交与评分
CREATE TABLE IF NOT EXISTS course_homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    homework_id UUID NOT NULL REFERENCES course_homeworks(id),
    student_id UUID NOT NULL REFERENCES users(id),
    content TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    status VARCHAR(16) NOT NULL DEFAULT 'submitted',
    score NUMERIC(7,2),
    total_score NUMERIC(7,2) DEFAULT 100,
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES users(id),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_hw_sub_tenant ON course_homework_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_hw_sub_course ON course_homework_submissions(course_id);
CREATE INDEX IF NOT EXISTS idx_course_hw_sub_homework ON course_homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_course_hw_sub_student ON course_homework_submissions(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_hw_sub_unique
    ON course_homework_submissions (homework_id, student_id);
