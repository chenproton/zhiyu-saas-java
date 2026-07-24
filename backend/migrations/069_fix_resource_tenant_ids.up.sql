-- 069_fix_resource_tenant_ids: 修正 resource_library 的 tenant_id，
-- 根据 scenario_tasks.resource_ids 关联到的 scenario.tenant_id 设置，
-- 孤儿记录回退到最常用的 scenario 租户。同时修正 on_site_question_library。

-- 对能关联到 scenario 的资源，按 scenario 的 tenant_id 修正
UPDATE resource_library rl
SET tenant_id = sq.target_tenant_id
FROM (
    SELECT DISTINCT ON (rid) rid, s.tenant_id AS target_tenant_id
    FROM unnest(ARRAY(
        SELECT unnest(resource_ids) FROM scenario_tasks WHERE resource_ids IS NOT NULL
    )) AS rid
    JOIN scenario_tasks st2 ON rid = ANY(st2.resource_ids)
    JOIN scenarios s ON s.id = st2.scenario_id
) sq
WHERE rl.id = sq.rid;

-- 孤儿资源：分配给最常用的 scenario 租户
UPDATE resource_library rl
SET tenant_id = (
    SELECT tenant_id FROM scenarios
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id ORDER BY COUNT(*) DESC LIMIT 1
)
WHERE rl.tenant_id = '11111111-1111-1111-1111-111111111111';

-- 对 on_site_question_library，从 questions 表同步 tenant_id
UPDATE on_site_question_library osql
SET tenant_id = q.tenant_id
FROM questions q
WHERE osql.id = q.id AND q.tenant_id IS NOT NULL
  AND osql.tenant_id = '11111111-1111-1111-1111-111111111111';

-- 剩余的 on_site_question 孤儿记录也回退到最常用的 scenario 租户
UPDATE on_site_question_library
SET tenant_id = (
    SELECT tenant_id FROM scenarios
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id ORDER BY COUNT(*) DESC LIMIT 1
)
WHERE tenant_id = '11111111-1111-1111-1111-111111111111';
