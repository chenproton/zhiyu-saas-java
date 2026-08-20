SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
DROP TABLE IF EXISTS alliance_brand_topics CASCADE;
DROP TABLE IF EXISTS alliance_brands CASCADE;
DROP TABLE IF EXISTS alliance_dictionaries CASCADE;
DROP TABLE IF EXISTS alliance_permissions CASCADE;
DROP TABLE IF EXISTS alliance_agreements CASCADE;
DROP TABLE IF EXISTS alliance_experts CASCADE;
DROP TABLE IF EXISTS alliance_achievements CASCADE;
DROP TABLE IF EXISTS alliance_project_milestones CASCADE;
DROP TABLE IF EXISTS alliance_projects CASCADE;
DROP TABLE IF EXISTS alliance_enterprise_agreements CASCADE;
DROP TABLE IF EXISTS alliance_enterprises CASCADE;
DROP TABLE IF EXISTS alliance_school_info CASCADE;

SET FOREIGN_KEY_CHECKS = 1;