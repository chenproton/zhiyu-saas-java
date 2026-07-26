-- 为课程表补充难度、简介字段，并新增课程资源绑定表
ALTER TABLE courses ADD COLUMN IF NOT EXISTS difficulty INT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS course_resource_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(course_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_course_resource_bindings_course ON course_resource_bindings(course_id);
CREATE INDEX IF NOT EXISTS idx_course_resource_bindings_resource ON course_resource_bindings(resource_id);
