-- 回滚：按 166/167 语义恢复旧分散授权键（teacher/student 三前台路径 + 落地页，
-- school_admin 有 menus 者同），并移除单一开关键。幂等。
UPDATE roles
SET permissions = JSON_SET(
    JSON_SET(
        JSON_SET(
            JSON_SET(permissions, '$.menus."/portal/apps/ai/chat"', TRUE),
            '$.menus."/portal/apps/ai/square"', TRUE
        ),
        '$.menus."/portal/apps/ai/studio"', TRUE
    ),
    '$.menus."/portal/ai/landing"', TRUE
)
WHERE code IN ('teacher', 'student', 'school_admin')
  AND JSON_CONTAINS_PATH(permissions, 'one', '$.menus')
  AND JSON_CONTAINS(permissions, '"/portal/apps/ai"', '$.menus');

UPDATE roles
SET permissions = JSON_REMOVE(permissions, '$.menus."/portal/apps/ai"')
WHERE JSON_CONTAINS_PATH(permissions, 'one', '$.menus')
  AND JSON_CONTAINS(permissions, '"/portal/apps/ai"', '$.menus');
