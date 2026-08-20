-- 回滚 154：重建 mentor_links 表（assigned_user_ids 已映射为企业账号 id，影子账号分配数据不可逆恢复）；
-- 已创建的历史影子账号（users 记录）不受影响。

CREATE TABLE IF NOT EXISTS alliance_expert_mentor_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    expert_id UUID NOT NULL REFERENCES alliance_experts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, expert_id)
);
CREATE INDEX IF NOT EXISTS idx_expert_mentor_links_tenant ON alliance_expert_mentor_links(tenant_id);

ALTER TABLE graduation_project_topics ADD COLUMN IF NOT EXISTS enterprise_mentor_id uuid;
