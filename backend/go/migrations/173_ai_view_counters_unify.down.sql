ALTER TABLE ai_knowledge_bases ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ai_agents ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0;
UPDATE ai_knowledge_bases kb SET view_count = vc.cnt FROM view_counters vc WHERE vc.target_type = 'ai_kb' AND vc.target_id = kb.id;
UPDATE ai_agents a SET view_count = vc.cnt FROM view_counters vc WHERE vc.target_type = 'ai_agent' AND vc.target_id = a.id;
DELETE FROM view_counters WHERE target_type IN ('ai_kb', 'ai_agent');
