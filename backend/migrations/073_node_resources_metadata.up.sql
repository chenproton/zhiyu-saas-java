-- 补充 node_resources 与 node_resource_bindings 的元数据字段，支持新版节点资源接口

ALTER TABLE node_resources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE node_resource_bindings ADD COLUMN IF NOT EXISTS tenant_id UUID;
