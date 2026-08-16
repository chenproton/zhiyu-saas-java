-- 注意：若已存在通用会话（agent_id IS NULL）本 down 会失败，需先人工清理
ALTER TABLE ai_conversations ALTER COLUMN agent_id SET NOT NULL;
