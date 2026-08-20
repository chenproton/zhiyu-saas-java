-- 不可逆：删除 cert_issuance_records 中重复发放记录（保留最早一条），被删重复记录不可恢复。
-- 微证书批量发放防重复：同一模板同一用户仅一条发放记录
-- 先清理历史重复发放记录（保留最早一条），再建唯一约束
-- MySQL 版：PG 多表 DELETE ... USING 改 JOIN 删除；IS NOT DISTINCT FROM 用 <=>（null-safe 相等）。
DELETE a FROM cert_issuance_records a
JOIN cert_issuance_records b
  ON (a.tenant_id <=> b.tenant_id)
 AND a.template_id = b.template_id
 AND a.user_id = b.user_id
 AND a.id > b.id;

ALTER TABLE cert_issuance_records
    ADD CONSTRAINT cert_issuance_records_template_user_key UNIQUE (tenant_id, template_id, user_id);
