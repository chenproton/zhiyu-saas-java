-- 092_affairs: 教务管理服务平台（学期/人培方案/教学计划/场地节次/排课）
-- 全部表带 tenant_id，参照 baseline 风格

-- 学期
CREATE TABLE IF NOT EXISTS terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(64) NOT NULL,            -- 如 "2025-2026-1"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    weeks_count INT NOT NULL DEFAULT 16,
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_terms_tenant ON terms(tenant_id);

-- 人才培养方案
CREATE TABLE IF NOT EXISTS training_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    major_id UUID REFERENCES majors(id),
    entry_year INT NOT NULL,              -- 入学年份
    level VARCHAR(16),                    -- 中专/大专/本科
    duration INT,                         -- 学制（年）
    total_credits NUMERIC(6,1),
    status VARCHAR(16) NOT NULL DEFAULT 'draft',  -- draft/published
    description TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_training_programs_tenant ON training_programs(tenant_id);

-- 人培方案课程（含实践场景，course_type 区分）
CREATE TABLE IF NOT EXISTS training_program_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    credits NUMERIC(5,1) NOT NULL DEFAULT 0,
    hours INT NOT NULL DEFAULT 0,
    theory_hours INT NOT NULL DEFAULT 0,
    practice_hours INT NOT NULL DEFAULT 0,
    semester INT NOT NULL,                -- 第几学期
    nature VARCHAR(16) NOT NULL DEFAULT '必修',   -- 必修/选修/实践/场景
    assessment VARCHAR(16),               -- 考试/考查/场景测评
    scenario_id UUID REFERENCES scenarios(id),    -- 场景课程关联场景
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_training_program_courses_program ON training_program_courses(program_id);

-- 教学计划（从人培方案生成）
CREATE TABLE IF NOT EXISTS teaching_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    program_id UUID NOT NULL REFERENCES training_programs(id),
    term_id UUID NOT NULL REFERENCES terms(id),
    major_id UUID REFERENCES majors(id),
    entry_year INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'draft',  -- draft/confirmed
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    UNIQUE(program_id, term_id)
);
CREATE INDEX IF NOT EXISTS idx_teaching_plans_tenant_term ON teaching_plans(tenant_id, term_id);

-- 教学计划条目（排课的待排来源）
CREATE TABLE IF NOT EXISTS teaching_plan_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES teaching_plans(id) ON DELETE CASCADE,
    course_name VARCHAR(128) NOT NULL,
    course_code VARCHAR(64),
    type VARCHAR(16) NOT NULL DEFAULT 'theory',   -- theory/practice/scene
    nature VARCHAR(16),
    credits NUMERIC(5,1) DEFAULT 0,
    total_hours INT NOT NULL DEFAULT 0,
    week_hours INT NOT NULL DEFAULT 0,
    start_week INT NOT NULL DEFAULT 1,
    end_week INT NOT NULL DEFAULT 16,
    week_pattern VARCHAR(16) NOT NULL DEFAULT 'all',  -- all/odd/even
    class_node_id UUID REFERENCES organizations(id),  -- 授课班级（组织树节点）
    teacher_id UUID REFERENCES users(id),
    teacher_type VARCHAR(16),             -- 校本师资/企业导师
    venue_type VARCHAR(16),               -- 教室/机房/实训室/实验室/校外基地
    scenario_id UUID REFERENCES scenarios(id),
    status VARCHAR(16) NOT NULL DEFAULT 'planned'   -- planned/scheduled
);
CREATE INDEX IF NOT EXISTS idx_teaching_plan_entries_plan ON teaching_plan_entries(plan_id);

-- 场地
CREATE TABLE IF NOT EXISTS venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(64) NOT NULL,
    type VARCHAR(16) NOT NULL,            -- 教室/机房/实训室/实验室/校外基地
    capacity INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_venues_tenant ON venues(tenant_id);

-- 节次
CREATE TABLE IF NOT EXISTS period_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(32) NOT NULL,            -- 如 "上午1-2"
    sort_order INT NOT NULL,
    start_time TIME,
    end_time TIME
);
CREATE INDEX IF NOT EXISTS idx_period_slots_tenant ON period_slots(tenant_id);

-- 排课结果（课表核心表）
CREATE TABLE IF NOT EXISTS schedule_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    term_id UUID NOT NULL REFERENCES terms(id),
    plan_entry_id UUID REFERENCES teaching_plan_entries(id),
    course_name VARCHAR(128) NOT NULL,
    course_code VARCHAR(64),
    type VARCHAR(16) NOT NULL DEFAULT 'traditional',  -- traditional/scene
    class_node_id UUID NOT NULL REFERENCES organizations(id),
    teacher_id UUID REFERENCES users(id),
    day_of_week INT NOT NULL,             -- 1-7
    periods JSONB NOT NULL,               -- ["上午1-2"] 或 period_slot ids
    start_week INT NOT NULL,
    end_week INT NOT NULL,
    week_pattern VARCHAR(16) NOT NULL DEFAULT 'all',
    venue_id UUID REFERENCES venues(id),
    scenario_id UUID REFERENCES scenarios(id),   -- 场景课关联场景
    source VARCHAR(16) NOT NULL DEFAULT 'manual', -- manual/imported
    status VARCHAR(16) NOT NULL DEFAULT 'draft',  -- draft/published
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_term_class ON schedule_entries(term_id, class_node_id);
CREATE INDEX IF NOT EXISTS idx_schedule_term_teacher ON schedule_entries(term_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tenant_term ON schedule_entries(tenant_id, term_id);
