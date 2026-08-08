-- 为 091/101/123/124/127/129/136/137 等增量迁移中新建的租户表补 REFERENCES tenants 外键，
-- 使租户删除时级联清理对应数据，避免孤儿数据残留。
-- 加约束前先清理存量孤儿行（tenant_id 指向已删除租户的数据）。

-- ===== 联盟模块（101_alliance_brand）=====
DELETE FROM alliance_achievements WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_achievements.tenant_id);
ALTER TABLE alliance_achievements ADD CONSTRAINT fk_alliance_achievements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_agreements WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_agreements.tenant_id);
ALTER TABLE alliance_agreements ADD CONSTRAINT fk_alliance_agreements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_brand_topics WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_brand_topics.tenant_id);
ALTER TABLE alliance_brand_topics ADD CONSTRAINT fk_alliance_brand_topics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_brands WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_brands.tenant_id);
ALTER TABLE alliance_brands ADD CONSTRAINT fk_alliance_brands_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_dictionaries WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_dictionaries.tenant_id);
ALTER TABLE alliance_dictionaries ADD CONSTRAINT fk_alliance_dictionaries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_enterprise_agreements WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_enterprise_agreements.tenant_id);
ALTER TABLE alliance_enterprise_agreements ADD CONSTRAINT fk_alliance_enterprise_agreements_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_enterprises WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_enterprises.tenant_id);
ALTER TABLE alliance_enterprises ADD CONSTRAINT fk_alliance_enterprises_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_experts WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_experts.tenant_id);
ALTER TABLE alliance_experts ADD CONSTRAINT fk_alliance_experts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_permissions WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_permissions.tenant_id);
ALTER TABLE alliance_permissions ADD CONSTRAINT fk_alliance_permissions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_project_milestones WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_project_milestones.tenant_id);
ALTER TABLE alliance_project_milestones ADD CONSTRAINT fk_alliance_project_milestones_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_projects WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_projects.tenant_id);
ALTER TABLE alliance_projects ADD CONSTRAINT fk_alliance_projects_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM alliance_school_info WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = alliance_school_info.tenant_id);
ALTER TABLE alliance_school_info ADD CONSTRAINT fk_alliance_school_info_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ===== 评价规则（091/123）=====
DELETE FROM certification_weights WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = certification_weights.tenant_id);
ALTER TABLE certification_weights ADD CONSTRAINT fk_certification_weights_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM task_eval_score_rules WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = task_eval_score_rules.tenant_id);
ALTER TABLE task_eval_score_rules ADD CONSTRAINT fk_task_eval_score_rules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ===== 认证等级（124）=====
DELETE FROM certification_point_levels WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = certification_point_levels.tenant_id);
ALTER TABLE certification_point_levels ADD CONSTRAINT fk_certification_point_levels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ===== 社区（127）=====
DELETE FROM community_topics WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = community_topics.tenant_id);
ALTER TABLE community_topics ADD CONSTRAINT fk_community_topics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ===== 学生荣誉（129）=====
DELETE FROM student_honors WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = student_honors.tenant_id);
ALTER TABLE student_honors ADD CONSTRAINT fk_student_honors_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ===== 租户设置（136）=====
DELETE FROM tenant_settings WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = tenant_settings.tenant_id);
ALTER TABLE tenant_settings ADD CONSTRAINT fk_tenant_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- ===== 资源标签（137）=====
DELETE FROM tags WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = tags.tenant_id);
ALTER TABLE tags ADD CONSTRAINT fk_tags_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DELETE FROM resource_tag_relations WHERE tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants t WHERE t.id = resource_tag_relations.tenant_id);
ALTER TABLE resource_tag_relations ADD CONSTRAINT fk_resource_tag_relations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
