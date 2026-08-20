-- 098: 节点作业提交/批改支持
-- 1) 补齐 node_homeworks 缺失字段（与 ensureNodeHomework 插入语句一致）
-- 2) 新建 node_homework_submissions 表，用于学生提交和教师批改

ALTER TABLE node_homeworks
    ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) DEFAULT 'published' NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS node_homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    node_id UUID NOT NULL REFERENCES system_course_nodes(id),
    homework_id UUID NOT NULL REFERENCES node_homeworks(id),
    student_id UUID NOT NULL REFERENCES users(id),
    content TEXT,
    attachment_urls TEXT[] DEFAULT '{}',
    status VARCHAR(16) NOT NULL DEFAULT 'submitted',
    score NUMERIC(7,2),
    total_score NUMERIC(7,2) DEFAULT 100,
    comment TEXT,
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (homework_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_node_hw_sub_tenant ON node_homework_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_node_hw_sub_node ON node_homework_submissions(node_id);
CREATE INDEX IF NOT EXISTS idx_node_hw_sub_homework ON node_homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_node_hw_sub_student ON node_homework_submissions(student_id);
