-- 还原：移除存量租户角色上补充的 evaluation.question-banks 动作
UPDATE roles
SET permissions = JSON_REMOVE(permissions, '$.evaluation."question-banks"')
WHERE code IN ('school_admin', 'teacher')
  AND JSON_CONTAINS_PATH(permissions, 'one', '$.evaluation');
