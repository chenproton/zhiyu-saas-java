-- 172: 通用（YIKnow）会话支持（spec §2.1 v2.2 A1）：agent_id 可空 = 全局助手会话
ALTER TABLE ai_conversations ALTER COLUMN agent_id DROP NOT NULL;
