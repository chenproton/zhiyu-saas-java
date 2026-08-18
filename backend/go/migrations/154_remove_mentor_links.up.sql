-- 移除共建导师影子账号体系：企业专家直接使用企业侧账号（alliance_experts.user_id）参与共建。
-- 1) 存量 task_review_steps.assigned_user_ids 中影子账号 id 映射为专家绑定账号 id（仅迁移可映射项）
-- 2) 删除 alliance_expert_mentor_links 表（影子账号 users 记录保留，避免业务表 uuid[] 引用悬空）
-- 3) 清理遗留列 graduation_project_topics.enterprise_mentor_id（全仓库无读写代码）

UPDATE task_review_steps rs
SET assigned_user_ids = ARRAY(
    SELECT e.user_id
    FROM unnest(rs.assigned_user_ids) AS a(id)
    JOIN alliance_expert_mentor_links ml ON ml.user_id = a.id
    JOIN alliance_experts e ON e.id = ml.expert_id
    WHERE e.user_id IS NOT NULL
)
WHERE EXISTS (
    SELECT 1 FROM unnest(rs.assigned_user_ids) AS a(id)
    JOIN alliance_expert_mentor_links ml ON ml.user_id = a.id
);

DROP TABLE IF EXISTS alliance_expert_mentor_links;

ALTER TABLE graduation_project_topics DROP COLUMN IF EXISTS enterprise_mentor_id;
