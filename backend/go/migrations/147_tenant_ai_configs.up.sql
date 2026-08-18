CREATE TABLE tenant_ai_configs (
  tenant_id          uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  base_url           text NOT NULL,
  api_key_encrypted  text NOT NULL,
  model              text NOT NULL,
  extra              jsonb NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
