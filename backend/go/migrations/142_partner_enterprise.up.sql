-- 企业平台（Partner）阶段一：平台底座
-- 1. tenants 加 type（企业租户 = 'enterprise'）
-- 2. alliance_enterprises 重命名为 partner_enterprises（企业主体，全局唯一），
--    学校管理字段（评级/状态/类型/前台展示/二级学院等）下沉到 alliance_enterprise_links
-- 3. 新建 alliance_enterprise_links（学校-企业合作关联）
-- 4. alliance_experts 加 user_id（专家档案 ↔ 企业成员账号，可空不建 FK）
-- 5. 新建 alliance_expert_mentor_links（专家 ↔ 学校影子账号，阶段二互动使用，先建表）
-- 6. 联盟开发数据整体重置（TRUNCATE，不编写数据迁移）

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS type varchar(16) NOT NULL DEFAULT 'school';

-- ===== 企业主体：alliance_enterprises → partner_enterprises =====
ALTER TABLE alliance_enterprises RENAME TO partner_enterprises;

-- 移除学校管理字段（下沉到 link 表）；依赖列的索引（tenant_status/tenant_rating）随列自动删除
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS enterprise_type;
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS rating;
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS status;
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS is_public;
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS secondary_colleges;
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS rating_record;
ALTER TABLE partner_enterprises DROP COLUMN IF EXISTS created_by;

-- 企业侧"愿意对外展示"开关（互动流程一双控之一）
ALTER TABLE partner_enterprises ADD COLUMN IF NOT EXISTS enable_public boolean NOT NULL DEFAULT false;

-- 企业主体全局唯一
ALTER TABLE partner_enterprises ADD CONSTRAINT partner_enterprises_name_key UNIQUE (name);

CREATE INDEX IF NOT EXISTS idx_partner_enterprises_tenant ON partner_enterprises(tenant_id);

-- ===== 学校-企业合作关联 =====
CREATE TABLE IF NOT EXISTS alliance_enterprise_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,             -- 学校租户
    enterprise_id UUID NOT NULL REFERENCES partner_enterprises(id) ON DELETE CASCADE,
    relation_type varchar(32) NOT NULL DEFAULT 'alliance',  -- 预留：未来扩展合作类型
    status varchar(32) NOT NULL DEFAULT 'negotiating',      -- negotiating|active|paused|terminated
    rating varchar(32) DEFAULT 'general',                   -- strategic|deep|general
    enterprise_type varchar(32) NOT NULL DEFAULT 'cooperation', -- cooperation|third-party
    is_public boolean NOT NULL DEFAULT false,   -- 学校侧"在本校前台展示"开关
    secondary_colleges jsonb DEFAULT '[]',
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, enterprise_id)
);
CREATE INDEX IF NOT EXISTS idx_alliance_enterprise_links_enterprise ON alliance_enterprise_links(enterprise_id);

-- ===== 专家档案：绑定企业成员账号（可空，不建 FK，兼容解除绑定） =====
ALTER TABLE alliance_experts ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_alliance_experts_enterprise ON alliance_experts(enterprise_id);

-- ===== 专家 ↔ 学校影子账号（阶段二互动流程使用，本阶段仅建表） =====
CREATE TABLE IF NOT EXISTS alliance_expert_mentor_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,                 -- 学校租户
    expert_id UUID NOT NULL REFERENCES alliance_experts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,                   -- 学校租户内 enterprise_mentor 影子账号 users.id
    enabled boolean NOT NULL DEFAULT true,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, expert_id)            -- 同校不重复启用
);
CREATE INDEX IF NOT EXISTS idx_expert_mentor_links_tenant ON alliance_expert_mentor_links(tenant_id);

-- ===== 联盟开发数据整体重置 =====
TRUNCATE
    alliance_expert_mentor_links,
    alliance_enterprise_links,
    alliance_enterprise_agreements,
    alliance_project_milestones,
    alliance_projects,
    alliance_achievements,
    alliance_agreements,
    alliance_permissions,
    alliance_brands,
    alliance_brand_topics,
    alliance_experts,
    partner_enterprises;
