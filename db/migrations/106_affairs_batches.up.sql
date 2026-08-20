CREATE TABLE IF NOT EXISTS affairs_batches (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    org_node_id CHAR(36) REFERENCES organizations(id),
    major_id CHAR(36) REFERENCES majors(id),
    workflow_id CHAR(36),
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    program_count INTEGER NOT NULL DEFAULT 0,
    published_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    tenant_id CHAR(36) REFERENCES tenants(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
