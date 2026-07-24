CREATE TABLE random_draw_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    answer TEXT,
    major VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_rdq_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_rdq_tenant ON random_draw_questions(tenant_id);
CREATE INDEX idx_rdq_major ON random_draw_questions(major);
