DROP INDEX IF EXISTS idx_ai_agents_dept;
DROP INDEX IF EXISTS idx_ai_agents_major;
DROP INDEX IF EXISTS idx_ai_kbs_dept;
DROP INDEX IF EXISTS idx_ai_kbs_major;
ALTER TABLE ai_agents DROP COLUMN department_id, DROP COLUMN major_id;
ALTER TABLE ai_knowledge_bases DROP COLUMN kb_type, DROP COLUMN department_id, DROP COLUMN major_id;
