-- 094: 打通课程评价下游执行链路
-- 1) 排课表关联课程
-- 2) 新建课程级作业表

-- schedule_entries 增加 course_id，便于服务台课表直接跳转课程落地页
ALTER TABLE schedule_entries
    ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id);

CREATE INDEX IF NOT EXISTS idx_schedule_course_id ON schedule_entries(course_id);

-- 回填已有传统课排课的 course_id（按 course_code 匹配 courses.code）
UPDATE schedule_entries se
SET course_id = c.id
FROM courses c
WHERE se.type = 'traditional'
  AND se.course_code IS NOT NULL
  AND se.course_code <> ''
  AND c.code = se.course_code
  AND se.course_id IS NULL;

-- 课程级作业表（system 课程发布时依据 homework 评价方式生成）
CREATE TABLE IF NOT EXISTS course_homeworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    course_id UUID NOT NULL REFERENCES courses(id),
    title VARCHAR(256) NOT NULL,
    requirement TEXT,
    need_attachment BOOLEAN DEFAULT false,
    deadline TIMESTAMPTZ,
    status VARCHAR(16) DEFAULT 'draft' NOT NULL,
    creator_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_homeworks_tenant ON course_homeworks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_homeworks_course ON course_homeworks(course_id);
