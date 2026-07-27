DELETE FROM certificate_library a
USING certificate_library b
WHERE a.ctid > b.ctid
  AND a.tenant_id = b.tenant_id
  AND a.name = b.name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_library_tenant_name ON certificate_library (tenant_id, name);
