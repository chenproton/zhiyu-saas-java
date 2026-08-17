-- 题库列表页批量操作权限对齐试卷：school_admin/teacher 角色补充 evaluation.question-banks 动作。
-- 该页面渲染的批量按钮（提交审批/撤回审批/发布/取消发布/删除）由前端 hasPermission 门控，
-- 存量租户默认角色仅配置了 evaluation.exams，导致题库页批量操作按钮缺失。
UPDATE roles
SET permissions = jsonb_set(
    permissions,
    '{evaluation,question-banks}',
    '["submit_approval","withdraw_approval","publish","unpublish","delete","review","reject"]'::jsonb,
    true
)
WHERE code IN ('school_admin', 'teacher')
  AND permissions ? 'evaluation';
