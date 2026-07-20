-- Certificate Library: tenant-scoped shared certificate pool
CREATE TABLE certificate_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(128) NOT NULL,
    url TEXT,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_certificate_library_tenant ON certificate_library(tenant_id);

-- Migrate existing position_certificates data into certificate_library
-- Deduplicate by (tenant_id, name), keep the first entry's url/description/image_url
INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url)
SELECT
    gen_random_uuid(),
    pc.tenant_id,
    pc.name,
    MIN(pc.url) FILTER (WHERE pc.url IS NOT NULL) AS url,
    MIN(pc.description) FILTER (WHERE pc.description IS NOT NULL) AS description,
    MIN(pc.image_url) FILTER (WHERE pc.image_url IS NOT NULL) AS image_url
FROM position_certificates pc
GROUP BY pc.tenant_id, pc.name;

-- Add FK column to position_certificates
ALTER TABLE position_certificates ADD COLUMN certificate_library_id UUID;

-- Backfill: link position_certificates rows to their library entry
UPDATE position_certificates pc
SET certificate_library_id = cl.id
FROM certificate_library cl
WHERE cl.tenant_id = pc.tenant_id AND cl.name = pc.name;

-- Drop old data columns
ALTER TABLE position_certificates
    DROP COLUMN name,
    DROP COLUMN url,
    DROP COLUMN description,
    DROP COLUMN image_url;

-- Make FK NOT NULL after backfill
ALTER TABLE position_certificates ALTER COLUMN certificate_library_id SET NOT NULL;
ALTER TABLE position_certificates
    ADD CONSTRAINT fk_position_certificates_library
    FOREIGN KEY (certificate_library_id) REFERENCES certificate_library(id) ON DELETE CASCADE;

CREATE INDEX idx_position_certificates_library ON position_certificates(certificate_library_id);
