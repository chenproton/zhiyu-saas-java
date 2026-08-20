-- 清理共建导师影子账号遗留数据：旧功能（mentor-link）创建的 portal 平台账号
-- （username 规则 em_<enterpriseID前8>_<expertID前8>，platform=portal，绑定 enterprise_mentor 角色）。
-- 影子账号已无业务引用（JSON 共建人列、任务分配、评分记录均已迁移/确认无残留），直接删除。
-- 注意：仅清理按影子账号命名规则的账号，不影响正常用户。
-- MySQL 版：PG unnest/array_agg/&& 数组操作以 JSON_TABLE + JSON_ARRAYAGG + JSON_OVERLAPS 等价实现；
-- LIKE 'em\\_%'（SQL 源码双反斜杠）在 MySQL 中转义为字面下划线，与 PG 语义一致。

-- 1) 从业务数组列中移除影子账号 id（防御性清理，正常应无匹配）
UPDATE career_positions SET collaborators = COALESCE((
    SELECT JSON_ARRAYAGG(c)
    FROM JSON_TABLE(collaborators, '$[*]' COLUMNS (c CHAR(36) PATH '$')) jt
    WHERE c NOT IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal')
), JSON_ARRAY())
WHERE JSON_OVERLAPS(collaborators, (
    SELECT JSON_ARRAYAGG(id) FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal'
));
UPDATE scenarios SET co_builder_ids = COALESCE((
    SELECT JSON_ARRAYAGG(c)
    FROM JSON_TABLE(co_builder_ids, '$[*]' COLUMNS (c CHAR(36) PATH '$')) jt
    WHERE c NOT IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal')
), JSON_ARRAY())
WHERE JSON_OVERLAPS(co_builder_ids, (
    SELECT JSON_ARRAYAGG(id) FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal'
));
UPDATE question_banks SET collaborator_ids = COALESCE((
    SELECT JSON_ARRAYAGG(c)
    FROM JSON_TABLE(collaborator_ids, '$[*]' COLUMNS (c CHAR(36) PATH '$')) jt
    WHERE c NOT IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal')
), JSON_ARRAY())
WHERE JSON_OVERLAPS(collaborator_ids, (
    SELECT JSON_ARRAYAGG(id) FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal'
));
UPDATE exams SET collaborator_ids = COALESCE((
    SELECT JSON_ARRAYAGG(c)
    FROM JSON_TABLE(collaborator_ids, '$[*]' COLUMNS (c CHAR(36) PATH '$')) jt
    WHERE c NOT IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal')
), JSON_ARRAY())
WHERE JSON_OVERLAPS(collaborator_ids, (
    SELECT JSON_ARRAYAGG(id) FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal'
));
UPDATE teaching_plans SET collaborators = COALESCE((
    SELECT JSON_ARRAYAGG(c)
    FROM JSON_TABLE(collaborators, '$[*]' COLUMNS (c CHAR(36) PATH '$')) jt
    WHERE c NOT IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal')
), JSON_ARRAY())
WHERE JSON_OVERLAPS(collaborators, (
    SELECT JSON_ARRAYAGG(id) FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal'
));
UPDATE training_programs SET collaborators = COALESCE((
    SELECT JSON_ARRAYAGG(c)
    FROM JSON_TABLE(collaborators, '$[*]' COLUMNS (c CHAR(36) PATH '$')) jt
    WHERE c NOT IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal')
), JSON_ARRAY())
WHERE JSON_OVERLAPS(collaborators, (
    SELECT JSON_ARRAYAGG(id) FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal'
));
UPDATE task_review_steps SET assigned_user_ids = COALESCE((
    SELECT JSON_ARRAYAGG(c)
    FROM JSON_TABLE(assigned_user_ids, '$[*]' COLUMNS (c CHAR(36) PATH '$')) jt
    WHERE c NOT IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal')
), JSON_ARRAY())
WHERE JSON_OVERLAPS(assigned_user_ids, (
    SELECT JSON_ARRAYAGG(id) FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal'
));

-- 2) 评分记录中的评分人引用置空（保留评分结果本身）
UPDATE scene_evaluation_results SET evaluator_id = NULL WHERE evaluator_id IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal');
UPDATE scene_evaluation_results SET graded_by = NULL WHERE graded_by IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal');

-- 3) 删除角色绑定与账号
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal');
DELETE FROM users WHERE username LIKE 'em\\_%' AND platform = 'portal';
