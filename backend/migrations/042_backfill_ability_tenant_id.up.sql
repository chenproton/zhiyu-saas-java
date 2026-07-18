-- 回填通过 SaveFull 写入但遗漏 tenant_id 的能力点及能力绑定
-- 使其能被按租户过滤的列表接口正确返回

UPDATE ability_points ap
SET tenant_id = cp.tenant_id
FROM position_ability_bindings pab
JOIN career_positions cp ON cp.id = pab.career_position_id
WHERE ap.id = pab.ability_point_id
  AND ap.tenant_id IS NULL
  AND cp.tenant_id IS NOT NULL;

UPDATE position_ability_bindings pab
SET tenant_id = cp.tenant_id
FROM career_positions cp
WHERE pab.career_position_id = cp.id
  AND pab.tenant_id IS NULL
  AND cp.tenant_id IS NOT NULL;
