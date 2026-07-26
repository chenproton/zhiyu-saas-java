-- 回滚 node_resources 与 node_resource_bindings 的元数据字段

ALTER TABLE node_resources DROP COLUMN IF EXISTS created_at;
ALTER TABLE node_resource_bindings DROP COLUMN IF EXISTS tenant_id;
