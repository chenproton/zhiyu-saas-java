-- 094: 打通课程评价下游执行链路
-- 1) 排课表关联课程
-- 2) 新建课程级作业表

-- schedule_entries 增加 course_id，便于服务台课表直接跳转课程落地页
ALTER TABLE schedule_entries
    ADD COLUMN course_id CHAR(36) REFERENCES courses(id);

CREATE INDEX idx_schedule_course_id ON schedule_entries(course_id);

-- 回填已有传统课排课的 course_id（按 course_code 匹配 courses.code）
UPDATE schedule_entries se
JOIN courses c ON c.code = se.course_code
SET se.course_id = c.id
WHERE se.type = 'traditional'
  AND se.course_code IS NOT NULL
  AND se.course_code <> ''
  AND se.course_id IS NULL;

-- 课程级作业表（system 课程发布时依据 homework 评价方式生成）
CREATE TABLE IF NOT EXISTS course_homeworks (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL REFERENCES tenants(id),
    course_id CHAR(36) NOT NULL REFERENCES courses(id),
    title VARCHAR(256) NOT NULL,
    requirement LONGTEXT,
    need_attachment TINYINT(1) DEFAULT 0,
    deadline DATETIME,
    status VARCHAR(16) DEFAULT 'draft' NOT NULL,
    creator_id CHAR(36) REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_course_homeworks_tenant ON course_homeworks(tenant_id);
CREATE INDEX idx_course_homeworks_course ON course_homeworks(course_id);
