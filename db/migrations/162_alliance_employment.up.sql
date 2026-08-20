-- 人才与岗位供需服务大厅：就业项目 / 企业岗位 / 学生投递 三表
-- 数据链：alliance_employment_projects（学校租户）← alliance_employment_jobs.project_id
--        alliance_employment_jobs.enterprise_id → partner_enterprises(id)
--        alliance_employment_applications.job_id → alliance_employment_jobs(id)
-- 见 docs/spec/04-database-schema.md §2 字段级定义。

-- ===== 就业项目 =====
CREATE TABLE IF NOT EXISTS alliance_employment_projects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,               -- 学校租户
    name varchar(256) NOT NULL,
    type varchar(64) NOT NULL,             -- spring|autumn|directed|order|custom:<自定义文本>
    organizer varchar(256),                -- 发起单位（自定义文本）
    description LONGTEXT,
    start_date date,
    end_date date,
    publish_status varchar(16) NOT NULL DEFAULT 'draft',  -- draft|published（展示状态由日期派生，不落库）
    enterprise_ids JSON NOT NULL DEFAULT (JSON_ARRAY()),  -- 参与企业 partner_enterprises.id 数组（同 alliance_projects.enterprise_ids 模式）
    target_groups JSON NOT NULL DEFAULT (JSON_ARRAY()),   -- 面向学生群体 [{orgNodeId?,orgNodeName?,majorId?,majorName?,graduateYear?}]，组内 AND、组间 OR；空数组 = 面向全校
    created_by varchar(64),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_aep_tenant ON alliance_employment_projects(tenant_id);

-- ===== 企业岗位 =====
CREATE TABLE IF NOT EXISTS alliance_employment_jobs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,               -- 学校租户（岗位挂在学校联盟域下）
    enterprise_id CHAR(36) NOT NULL REFERENCES partner_enterprises(id) ON DELETE CASCADE,
    project_id CHAR(36) REFERENCES alliance_employment_projects(id) ON DELETE SET NULL,  -- NULL = 独立岗位（不上供需大厅）
    title varchar(256) NOT NULL,
    job_type varchar(32) NOT NULL DEFAULT 'full-time',  -- full-time|part-time|internship|apprentice
    location varchar(256),
    salary_min DECIMAL(10,2),              -- 千元/月
    salary_max DECIMAL(10,2),
    headcount INT,
    education varchar(64),
    suitable_majors JSON NOT NULL DEFAULT (JSON_ARRAY()),  -- 面向专业名称文本数组
    description LONGTEXT,
    responsibilities LONGTEXT,
    requirements LONGTEXT,
    contact_person varchar(128),
    contact_phone varchar(64),
    deadline date,
    status varchar(16) NOT NULL DEFAULT 'draft',  -- draft|published|closed
    created_by varchar(64),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_aej_tenant ON alliance_employment_jobs(tenant_id);
CREATE INDEX idx_aej_enterprise ON alliance_employment_jobs(enterprise_id);
CREATE INDEX idx_aej_project ON alliance_employment_jobs(project_id);

-- ===== 学生投递 =====
CREATE TABLE IF NOT EXISTS alliance_employment_applications (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,               -- 学校租户
    job_id CHAR(36) NOT NULL REFERENCES alliance_employment_jobs(id) ON DELETE CASCADE,
    enterprise_id CHAR(36) NOT NULL,           -- 冗余自岗位，供 partner 端按企业过滤（不建 FK，跟随岗位）
    student_id CHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 档案快照：投递时从 users/majors/organizations 带出落库，后续学籍变动不影响已投递内容
    student_name varchar(100),
    student_no varchar(64),
    major_name varchar(128),
    class_name varchar(128),
    phone varchar(32),
    email varchar(255),
    cover_letter LONGTEXT,
    status varchar(16) NOT NULL DEFAULT 'pending',  -- 本期固定 pending（为后续状态流转预留）
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (job_id, student_id)            -- 防重复投递
);
CREATE INDEX idx_aea_tenant ON alliance_employment_applications(tenant_id);
CREATE INDEX idx_aea_enterprise ON alliance_employment_applications(enterprise_id);
CREATE INDEX idx_aea_student ON alliance_employment_applications(student_id);
