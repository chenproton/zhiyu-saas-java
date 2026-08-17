-- 回滚：按 166/167 语义恢复旧分散授权键（teacher/student 三前台路径 + 落地页，
-- school_admin 有 menus 者同），并移除单一开关键。幂等。
UPDATE roles
SET permissions = jsonb_set(
    jsonb_set(
        jsonb_set(
            jsonb_set(permissions, '{menus,/portal/apps/ai/chat}', 'true', true),
            '{menus,/portal/apps/ai/square}', 'true', true
        ),
        '{menus,/portal/apps/ai/studio}', 'true', true
    ),
    '{menus,/portal/ai/landing}', 'true', true
)
WHERE code IN ('teacher', 'student', 'school_admin')
  AND permissions ? 'menus'
  AND permissions -> 'menus' ? '/portal/apps/ai';

UPDATE roles
SET permissions = permissions #- '{menus,/portal/apps/ai}'
WHERE permissions ? 'menus'
  AND permissions -> 'menus' ? '/portal/apps/ai';
