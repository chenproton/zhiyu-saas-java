CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_library_tenant_name ON certificate_library (tenant_id, name);
