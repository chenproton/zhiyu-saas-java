-- 学校信息
CREATE TABLE IF NOT EXISTS alliance_school_info (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    short_name VARCHAR(100),
    school_type VARCHAR(64),
    province VARCHAR(64),
    city VARCHAR(64),
    address LONGTEXT,
    website VARCHAR(255),
    contact_phone VARCHAR(32),
    description LONGTEXT,
    logo_url LONGTEXT,
    scale_data JSON DEFAULT (JSON_OBJECT()),
    secondary_colleges JSON DEFAULT (JSON_ARRAY()),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 合作企业
CREATE TABLE IF NOT EXISTS alliance_enterprises (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enterprise_type VARCHAR(32) NOT NULL DEFAULT 'platform',
    industry VARCHAR(128),
    region VARCHAR(128),
    description LONGTEXT,
    logo_url LONGTEXT,
    cover_image LONGTEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'negotiating',
    rating VARCHAR(32) DEFAULT 'general',
    cooperation_types JSON DEFAULT (JSON_ARRAY()),
    contact_person VARCHAR(64),
    contact_phone VARCHAR(32),
    contact_email VARCHAR(255),
    address LONGTEXT,
    unified_social_credit_code VARCHAR(64),
    established_year INT,
    employee_count INT,
    business_license_photos JSON DEFAULT (JSON_ARRAY()),
    qualification_photos JSON DEFAULT (JSON_ARRAY()),
    intellectual_property_photos JSON DEFAULT (JSON_ARRAY()),
    cover_photos JSON DEFAULT (JSON_ARRAY()),
    secondary_colleges JSON DEFAULT (JSON_ARRAY()),
    rating_record JSON,
    is_public BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_enterprises_tenant_status ON alliance_enterprises(tenant_id, status);
CREATE INDEX idx_alliance_enterprises_tenant_rating ON alliance_enterprises(tenant_id, rating);

-- 企业合作协议（内嵌于企业）
CREATE TABLE IF NOT EXISTS alliance_enterprise_agreements (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    enterprise_id CHAR(36) NOT NULL REFERENCES alliance_enterprises(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64),
    start_date DATE,
    end_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    content LONGTEXT,
    attachments JSON DEFAULT (JSON_ARRAY()),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_ent_agreements_enterprise ON alliance_enterprise_agreements(enterprise_id);

-- 合作项目
CREATE TABLE IF NOT EXISTS alliance_projects (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64),
    description LONGTEXT,
    phase VARCHAR(32) NOT NULL DEFAULT 'initiation',
    publish_status VARCHAR(32) NOT NULL DEFAULT 'draft',
    start_date DATE,
    end_date DATE,
    budget LONGTEXT,
    cover_image LONGTEXT,
    enterprise_ids JSON DEFAULT (JSON_ARRAY()),
    secondary_colleges JSON DEFAULT (JSON_ARRAY()),
    is_public BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_projects_tenant_phase ON alliance_projects(tenant_id, phase);
CREATE INDEX idx_alliance_projects_tenant_publish ON alliance_projects(tenant_id, publish_status);

-- 项目里程碑
CREATE TABLE IF NOT EXISTS alliance_project_milestones (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    project_id CHAR(36) NOT NULL REFERENCES alliance_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description LONGTEXT,
    due_date DATE,
    completed_date DATE,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_project_milestones_project ON alliance_project_milestones(project_id);

-- 合作成果
CREATE TABLE IF NOT EXISTS alliance_achievements (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'custom',
    description LONGTEXT,
    achievement_date DATE,
    cover_image LONGTEXT,
    attachments JSON DEFAULT (JSON_ARRAY()),
    enterprise_ids JSON DEFAULT (JSON_ARRAY()),
    project_ids JSON DEFAULT (JSON_ARRAY()),
    related_positions JSON DEFAULT (JSON_ARRAY()),
    related_scenes JSON DEFAULT (JSON_ARRAY()),
    related_courses JSON DEFAULT (JSON_ARRAY()),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    view_count INT DEFAULT 0,
    secondary_colleges JSON DEFAULT (JSON_ARRAY()),
    is_public BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_achievements_tenant_type ON alliance_achievements(tenant_id, type);
CREATE INDEX idx_alliance_achievements_tenant_status ON alliance_achievements(tenant_id, status);

-- 专家资源库
CREATE TABLE IF NOT EXISTS alliance_experts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(8) DEFAULT 'male',
    age INT,
    title VARCHAR(128),
    position VARCHAR(255),
    expert_type VARCHAR(64),
    industry VARCHAR(128),
    professional_fields JSON DEFAULT (JSON_ARRAY()),
    specialties JSON DEFAULT (JSON_ARRAY()),
    experience_years INT,
    education LONGTEXT,
    introduction LONGTEXT,
    work_experience LONGTEXT,
    city VARCHAR(64),
    avatar_url LONGTEXT,
    photos JSON DEFAULT (JSON_ARRAY()),
    attachments JSON DEFAULT (JSON_ARRAY()),
    enterprise_id CHAR(36) REFERENCES alliance_enterprises(id) ON DELETE SET NULL,
    rating VARCHAR(32) DEFAULT 'copper',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    secondary_colleges JSON DEFAULT (JSON_ARRAY()),
    is_public BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_experts_tenant_status ON alliance_experts(tenant_id, status);

-- 合作协议（独立模块）
CREATE TABLE IF NOT EXISTS alliance_agreements (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64),
    content LONGTEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    enterprise_ids JSON DEFAULT (JSON_ARRAY()),
    attachments JSON DEFAULT (JSON_ARRAY()),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_agreements_tenant_status ON alliance_agreements(tenant_id, status);

-- 合作权限
CREATE TABLE IF NOT EXISTS alliance_permissions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL DEFAULT 'enterprise',
    enterprise_id CHAR(36) REFERENCES alliance_enterprises(id) ON DELETE CASCADE,
    expert_id CHAR(36) REFERENCES alliance_experts(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT 1,
    resource_permissions JSON DEFAULT (JSON_ARRAY()),
    platform_permissions JSON DEFAULT (JSON_ARRAY()),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_permissions_tenant ON alliance_permissions(tenant_id);

-- 合作类型/评级字典
CREATE TABLE IF NOT EXISTS alliance_dictionaries (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    dict_type VARCHAR(32) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, dict_type, code)
);
CREATE INDEX idx_alliance_dictionaries_tenant_type ON alliance_dictionaries(tenant_id, dict_type);

-- 品牌内容（统一表，brand_type 区分：talent/employer/job/major/teacher/culture）
CREATE TABLE IF NOT EXISTS alliance_brands (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    brand_type VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    is_public BOOLEAN NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT 0,
    cover_image LONGTEXT,
    cover_video LONGTEXT,
    description LONGTEXT,
    data JSON NOT NULL DEFAULT (JSON_OBJECT()),
    sort_order INT DEFAULT 0,
    view_count INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_brands_tenant_type ON alliance_brands(tenant_id, brand_type);
CREATE INDEX idx_alliance_brands_tenant_status ON alliance_brands(tenant_id, status);
CREATE INDEX idx_alliance_brands_tenant_public ON alliance_brands(tenant_id, is_public);

-- 品牌专题页
CREATE TABLE IF NOT EXISTS alliance_brand_topics (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    theme VARCHAR(255),
    description LONGTEXT,
    layout VARCHAR(32) NOT NULL DEFAULT 'grid',
    cover_image LONGTEXT,
    content_blocks JSON DEFAULT (JSON_ARRAY()),
    related_brand_ids JSON DEFAULT (JSON_ARRAY()),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    is_recommended BOOLEAN NOT NULL DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_alliance_brand_topics_tenant_status ON alliance_brand_topics(tenant_id, status);
