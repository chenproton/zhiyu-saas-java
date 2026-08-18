-- 专家账号体系一期：学校-企业资源授权表 + 存量数据清理（按产品决策）
-- 1. alliance_resource_grants：学校对企业（企业内专家/管理员）的资源编辑授权
-- 2. career_positions/scenarios 加 source_resource_id（编辑学校自建资源时的 draft 副本关联原资源）
-- 3. 存量清理：专家档案清空、非初始企业管理员账号删除、旧版 alliance_permissions 清空

-- ===== 学校-企业资源授权 =====
CREATE TABLE IF NOT EXISTS alliance_resource_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,             -- 学校租户
    enterprise_id UUID NOT NULL REFERENCES partner_enterprises(id) ON DELETE CASCADE,
    resource_type varchar(32) NOT NULL,  -- position | scene
    resource_ids uuid[] NOT NULL DEFAULT '{}',
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, enterprise_id, resource_type)
);
CREATE INDEX IF NOT EXISTS idx_alliance_resource_grants_enterprise ON alliance_resource_grants(enterprise_id);

-- ===== 编辑学校自建资源的 draft 副本关联原资源 =====
ALTER TABLE career_positions ADD COLUMN IF NOT EXISTS source_resource_id uuid;
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS source_resource_id uuid;

-- ===== 存量清理（产品确认：专家库/成员账号/旧权限数据重建） =====
-- 专家档案清空（影子账号关联随 FK 级联删除）
TRUNCATE alliance_experts CASCADE;

-- 旧版联盟权限授权记录清空
TRUNCATE alliance_permissions;

-- 非初始企业管理员账号删除：每个企业租户保留最早创建的一个 enterprise_admin
-- （注册时自动生成的初始管理员），其余 partner 平台账号（含超管新建的企业管理员/成员）删除
DELETE FROM users u
WHERE u.platform = 'partner'
  AND u.id NOT IN (
      SELECT DISTINCT ON (u2.tenant_id) u2.id
      FROM users u2
      JOIN user_roles ur ON ur.user_id = u2.id
      JOIN roles r ON r.id = ur.role_id AND r.code = 'enterprise_admin'
      WHERE u2.platform = 'partner'
      ORDER BY u2.tenant_id, u2.created_at ASC
  );
