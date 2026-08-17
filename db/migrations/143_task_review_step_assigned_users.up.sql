-- 企业平台（Partner）阶段二 B12：任务级企业导师分配
-- task_review_steps 增加 assigned_user_ids：subject_type='enterprise_mentor' 的评审步骤
-- 可指定具体评分人（本校已启用 mentor_links 的影子账号 users.id 集合，service 层校验）。

ALTER TABLE task_review_steps ADD COLUMN IF NOT EXISTS assigned_user_ids uuid[] NOT NULL DEFAULT '{}';
