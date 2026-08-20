-- 标签管理：标签表 + 资源标签多对多绑定表
CREATE TABLE tags (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    name        varchar(64) NOT NULL,
    color       varchar(16) NOT NULL DEFAULT '#6366f1',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, name)
);

CREATE TABLE resource_tag_relations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    tag_id CHAR(36) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    resource_type varchar(32) NOT NULL,
    resource_id CHAR(36) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, resource_type, resource_id, tag_id)
);

CREATE INDEX idx_resource_tag_relations_type_tag ON resource_tag_relations (tenant_id, resource_type, tag_id);
CREATE INDEX idx_resource_tag_relations_type_resource ON resource_tag_relations (tenant_id, resource_type, resource_id);
