CREATE TABLE IF NOT EXISTS affairs_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL,
    code VARCHAR(64),
    org_node_id UUID REFERENCES organizations(id),
    major_id UUID REFERENCES majors(id),
    workflow_id UUID,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    program_count INTEGER NOT NULL DEFAULT 0,
    published_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
