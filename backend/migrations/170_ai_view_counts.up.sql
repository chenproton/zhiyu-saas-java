-- 170: 浏览量统计（spec §2.1 v2.2 B5）：详情页被非 owner/editor 查看时 +1，卡片展示 👁
ALTER TABLE ai_knowledge_bases ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE ai_agents ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0;
