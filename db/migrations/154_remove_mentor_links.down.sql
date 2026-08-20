-- 回滚 154：重建 mentor_links 表（assigned_user_ids 已映射为企业账号 id，影子账号分配数据不可逆恢复）；
-- 已创建的历史影子账号（users 记录）不受影响。

CREATE TABLE IF NOT EXISTS alliance_expert_mentor_links (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    expert_id CHAR(36) NOT NULL REFERENCES alliance_experts(id) ON DELETE CASCADE,
    user_id CHAR(36) NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_by CHAR(36),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, expert_id)
);
CREATE INDEX idx_expert_mentor_links_tenant ON alliance_expert_mentor_links(tenant_id);

ALTER TABLE graduation_project_topics ADD COLUMN enterprise_mentor_id CHAR(36);
