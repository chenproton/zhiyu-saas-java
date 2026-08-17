-- 回滚 164_ai_service_center：删除 AI 智能服务中心 10 表。
-- 不可逆：DROP TABLE 后表内业务数据（知识库/文档/分块/智能体/会话/挂接/审核日志）不可恢复。
-- pg_trgm 扩展保留（可能被其他对象使用，DROP EXTENSION 风险大于收益）。
DROP TABLE IF EXISTS ai_review_logs;
DROP TABLE IF EXISTS ai_integrations;
DROP TABLE IF EXISTS ai_messages;
DROP TABLE IF EXISTS ai_conversations;
DROP TABLE IF EXISTS ai_agent_kbs;
DROP TABLE IF EXISTS ai_agents;
DROP TABLE IF EXISTS ai_kb_collaborators;
DROP TABLE IF EXISTS ai_kb_chunks;
DROP TABLE IF EXISTS ai_kb_documents;
DROP TABLE IF EXISTS ai_knowledge_bases;
