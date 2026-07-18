-- 回填通过 SaveFull 写入但遗漏 tenant_id 的工作职责及证书
-- 使其与岗位所属租户保持一致

UPDATE position_responsibilities pr
SET tenant_id = cp.tenant_id
FROM career_positions cp
WHERE pr.career_position_id = cp.id
  AND pr.tenant_id IS NULL
  AND cp.tenant_id IS NOT NULL;

UPDATE position_certificates pc
SET tenant_id = cp.tenant_id
FROM career_positions cp
WHERE pc.career_position_id = cp.id
  AND pc.tenant_id IS NULL
  AND cp.tenant_id IS NOT NULL;
