-- 回退：将所有资源重新设为 tenant_id = NULL（无法精确恢复，因为 source 表可能已变）
UPDATE resource_library SET tenant_id = '11111111-1111-1111-1111-111111111111';
UPDATE on_site_question_library SET tenant_id = '11111111-1111-1111-1111-111111111111';
