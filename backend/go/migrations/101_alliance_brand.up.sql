-- 学校信息
CREATE TABLE IF NOT EXISTS alliance_school_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL DEFAULT '',
    short_name VARCHAR(100),
    school_type VARCHAR(64),
    province VARCHAR(64),
    city VARCHAR(64),
    address TEXT,
    website VARCHAR(255),
    contact_phone VARCHAR(32),
    description TEXT,
    logo_url TEXT,
    scale_data JSONB DEFAULT '{}',
    secondary_colleges JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 合作企业
CREATE TABLE IF NOT EXISTS alliance_enterprises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    enterprise_type VARCHAR(32) NOT NULL DEFAULT 'platform',
    industry VARCHAR(128),
    region VARCHAR(128),
    description TEXT,
    logo_url TEXT,
    cover_image TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'negotiating',
    rating VARCHAR(32) DEFAULT 'general',
    cooperation_types JSONB DEFAULT '[]',
    contact_person VARCHAR(64),
    contact_phone VARCHAR(32),
    contact_email VARCHAR(255),
    address TEXT,
    unified_social_credit_code VARCHAR(64),
    established_year INT,
    employee_count INT,
    business_license_photos JSONB DEFAULT '[]',
    qualification_photos JSONB DEFAULT '[]',
    intellectual_property_photos JSONB DEFAULT '[]',
    cover_photos JSONB DEFAULT '[]',
    secondary_colleges JSONB DEFAULT '[]',
    rating_record JSONB,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_enterprises_tenant_status ON alliance_enterprises(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alliance_enterprises_tenant_rating ON alliance_enterprises(tenant_id, rating);

-- 企业合作协议（内嵌于企业）
CREATE TABLE IF NOT EXISTS alliance_enterprise_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    enterprise_id UUID NOT NULL REFERENCES alliance_enterprises(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64),
    start_date DATE,
    end_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    content TEXT,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_ent_agreements_enterprise ON alliance_enterprise_agreements(enterprise_id);

-- 合作项目
CREATE TABLE IF NOT EXISTS alliance_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64),
    description TEXT,
    phase VARCHAR(32) NOT NULL DEFAULT 'initiation',
    publish_status VARCHAR(32) NOT NULL DEFAULT 'draft',
    start_date DATE,
    end_date DATE,
    budget TEXT,
    cover_image TEXT,
    enterprise_ids JSONB DEFAULT '[]',
    secondary_colleges JSONB DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_projects_tenant_phase ON alliance_projects(tenant_id, phase);
CREATE INDEX IF NOT EXISTS idx_alliance_projects_tenant_publish ON alliance_projects(tenant_id, publish_status);

-- 项目里程碑
CREATE TABLE IF NOT EXISTS alliance_project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    project_id UUID NOT NULL REFERENCES alliance_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    completed_date DATE,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_project_milestones_project ON alliance_project_milestones(project_id);

-- 合作成果
CREATE TABLE IF NOT EXISTS alliance_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'custom',
    description TEXT,
    achievement_date DATE,
    cover_image TEXT,
    attachments JSONB DEFAULT '[]',
    enterprise_ids JSONB DEFAULT '[]',
    project_ids JSONB DEFAULT '[]',
    related_positions JSONB DEFAULT '[]',
    related_scenes JSONB DEFAULT '[]',
    related_courses JSONB DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    view_count INT DEFAULT 0,
    secondary_colleges JSONB DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_achievements_tenant_type ON alliance_achievements(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_alliance_achievements_tenant_status ON alliance_achievements(tenant_id, status);

-- 专家资源库
CREATE TABLE IF NOT EXISTS alliance_experts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(8) DEFAULT 'male',
    age INT,
    title VARCHAR(128),
    position VARCHAR(255),
    expert_type VARCHAR(64),
    industry VARCHAR(128),
    professional_fields JSONB DEFAULT '[]',
    specialties JSONB DEFAULT '[]',
    experience_years INT,
    education TEXT,
    introduction TEXT,
    work_experience TEXT,
    city VARCHAR(64),
    avatar_url TEXT,
    photos JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    enterprise_id UUID REFERENCES alliance_enterprises(id) ON DELETE SET NULL,
    rating VARCHAR(32) DEFAULT 'copper',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    secondary_colleges JSONB DEFAULT '[]',
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_experts_tenant_status ON alliance_experts(tenant_id, status);

-- 合作协议（独立模块）
CREATE TABLE IF NOT EXISTS alliance_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(64),
    content TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    enterprise_ids JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_agreements_tenant_status ON alliance_agreements(tenant_id, status);

-- 合作权限
CREATE TABLE IF NOT EXISTS alliance_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(32) NOT NULL DEFAULT 'enterprise',
    enterprise_id UUID REFERENCES alliance_enterprises(id) ON DELETE CASCADE,
    expert_id UUID REFERENCES alliance_experts(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    resource_permissions JSONB DEFAULT '[]',
    platform_permissions JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_permissions_tenant ON alliance_permissions(tenant_id);

-- 合作类型/评级字典
CREATE TABLE IF NOT EXISTS alliance_dictionaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    dict_type VARCHAR(32) NOT NULL,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, dict_type, code)
);
CREATE INDEX IF NOT EXISTS idx_alliance_dictionaries_tenant_type ON alliance_dictionaries(tenant_id, dict_type);

-- 品牌内容（统一表，brand_type 区分：talent/employer/job/major/teacher/culture）
CREATE TABLE IF NOT EXISTS alliance_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    brand_type VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    is_public BOOLEAN NOT NULL DEFAULT false,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    cover_image TEXT,
    cover_video TEXT,
    description TEXT,
    data JSONB NOT NULL DEFAULT '{}',
    sort_order INT DEFAULT 0,
    view_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_tenant_type ON alliance_brands(tenant_id, brand_type);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_tenant_status ON alliance_brands(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alliance_brands_tenant_public ON alliance_brands(tenant_id, is_public);

-- 品牌专题页
CREATE TABLE IF NOT EXISTS alliance_brand_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    theme VARCHAR(255),
    description TEXT,
    layout VARCHAR(32) NOT NULL DEFAULT 'grid',
    cover_image TEXT,
    content_blocks JSONB DEFAULT '[]',
    related_brand_ids JSONB DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    is_recommended BOOLEAN NOT NULL DEFAULT false,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alliance_brand_topics_tenant_status ON alliance_brand_topics(tenant_id, status);
