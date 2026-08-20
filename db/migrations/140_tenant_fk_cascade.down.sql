SET FOREIGN_KEY_CHECKS = 0;  -- down 回滚：MySQL 受外键约束影响，先禁用检查
ALTER TABLE resource_tag_relations DROP FOREIGN KEY fk_resource_tag_relations_tenant;
ALTER TABLE tags DROP FOREIGN KEY fk_tags_tenant;
ALTER TABLE tenant_settings DROP FOREIGN KEY fk_tenant_settings_tenant;
ALTER TABLE student_honors DROP FOREIGN KEY fk_student_honors_tenant;
ALTER TABLE community_topics DROP FOREIGN KEY fk_community_topics_tenant;
ALTER TABLE certification_point_levels DROP FOREIGN KEY fk_certification_point_levels_tenant;
ALTER TABLE task_eval_score_rules DROP FOREIGN KEY fk_task_eval_score_rules_tenant;
ALTER TABLE certification_weights DROP FOREIGN KEY fk_certification_weights_tenant;
ALTER TABLE alliance_school_info DROP FOREIGN KEY fk_alliance_school_info_tenant;
ALTER TABLE alliance_projects DROP FOREIGN KEY fk_alliance_projects_tenant;
ALTER TABLE alliance_project_milestones DROP FOREIGN KEY fk_alliance_project_milestones_tenant;
ALTER TABLE alliance_permissions DROP FOREIGN KEY fk_alliance_permissions_tenant;
ALTER TABLE alliance_experts DROP FOREIGN KEY fk_alliance_experts_tenant;
ALTER TABLE alliance_enterprises DROP FOREIGN KEY fk_alliance_enterprises_tenant;
ALTER TABLE alliance_enterprise_agreements DROP FOREIGN KEY fk_alliance_enterprise_agreements_tenant;
ALTER TABLE alliance_brands DROP FOREIGN KEY fk_alliance_brands_tenant;
ALTER TABLE alliance_brand_topics DROP FOREIGN KEY fk_alliance_brand_topics_tenant;
ALTER TABLE alliance_agreements DROP FOREIGN KEY fk_alliance_agreements_tenant;
ALTER TABLE alliance_achievements DROP FOREIGN KEY fk_alliance_achievements_tenant;

SET FOREIGN_KEY_CHECKS = 1;