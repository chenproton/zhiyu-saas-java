-- 169: 知识库/智能体封面字段（spec docs/spec/ai-service-center.md §2.1 v1.4）
-- 工坊/广场/大厅卡片封面横幅；空串=无封面（前端渐变兜底）
-- IF NOT EXISTS：开发库曾手动加过列，保证幂等
ALTER TABLE ai_knowledge_bases ADD COLUMN IF NOT EXISTS cover_image TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_agents ADD COLUMN IF NOT EXISTS cover_image TEXT NOT NULL DEFAULT '';
