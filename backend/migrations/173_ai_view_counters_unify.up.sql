-- 173: AI 中心浏览量并入全局 view_counters/view_logs 机制（v2.2.1，对齐岗位/场景/联盟）
-- 存量计数搬入 view_counters 后删列；浏览记录走 view_logs + view_counters upsert（RecordView）
INSERT INTO view_counters (target_type, target_id, cnt)
SELECT 'ai_kb', id, view_count FROM ai_knowledge_bases WHERE view_count > 0;
INSERT INTO view_counters (target_type, target_id, cnt)
SELECT 'ai_agent', id, view_count FROM ai_agents WHERE view_count > 0;
ALTER TABLE ai_knowledge_bases DROP COLUMN view_count;
ALTER TABLE ai_agents DROP COLUMN view_count;
