-- 回滚：移除补充的租户外键，交易表外键改回 NO ACTION，恢复 industries 冗余外键

-- 3) 恢复 industries 冗余外键
DO $$ BEGIN ALTER TABLE industries ADD CONSTRAINT fk_industries_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) 交易表外键改回 NO ACTION
DO $$ BEGIN ALTER TABLE orders         DROP CONSTRAINT IF EXISTS orders_buyer_id_new_fkey;            ALTER TABLE orders         ADD CONSTRAINT orders_buyer_id_new_fkey            FOREIGN KEY (buyer_id)       REFERENCES institutions(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders         DROP CONSTRAINT IF EXISTS orders_seller_id_new_fkey;           ALTER TABLE orders         ADD CONSTRAINT orders_seller_id_new_fkey           FOREIGN KEY (seller_id)      REFERENCES institutions(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders         DROP CONSTRAINT IF EXISTS orders_resource_id_new_fkey;         ALTER TABLE orders         ADD CONSTRAINT orders_resource_id_new_fkey         FOREIGN KEY (resource_id)    REFERENCES resources(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE authorizations DROP CONSTRAINT IF EXISTS authorizations_buyer_id_new_fkey;    ALTER TABLE authorizations ADD CONSTRAINT authorizations_buyer_id_new_fkey    FOREIGN KEY (buyer_id)       REFERENCES institutions(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE authorizations DROP CONSTRAINT IF EXISTS authorizations_resource_id_new_fkey; ALTER TABLE authorizations ADD CONSTRAINT authorizations_resource_id_new_fkey FOREIGN KEY (resource_id)    REFERENCES resources(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE withdrawals    DROP CONSTRAINT IF EXISTS withdrawals_institution_id_new_fkey; ALTER TABLE withdrawals    ADD CONSTRAINT withdrawals_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) 移除补充的租户外键
ALTER TABLE announcements                DROP CONSTRAINT IF EXISTS fk_announcements_tenant;
ALTER TABLE app_modules                  DROP CONSTRAINT IF EXISTS fk_app_modules_tenant;
ALTER TABLE authorizations               DROP CONSTRAINT IF EXISTS fk_authorizations_tenant;
ALTER TABLE banner_configs               DROP CONSTRAINT IF EXISTS fk_banner_configs_tenant;
ALTER TABLE banners                      DROP CONSTRAINT IF EXISTS fk_banners_tenant;
ALTER TABLE certification_ability_items  DROP CONSTRAINT IF EXISTS fk_certification_ability_items_tenant;
ALTER TABLE certification_ability_points DROP CONSTRAINT IF EXISTS fk_certification_ability_points_tenant;
ALTER TABLE certification_related_tasks  DROP CONSTRAINT IF EXISTS fk_certification_related_tasks_tenant;
ALTER TABLE certification_rules          DROP CONSTRAINT IF EXISTS fk_certification_rules_tenant;
ALTER TABLE credit_conversion_rules      DROP CONSTRAINT IF EXISTS fk_credit_conversion_rules_tenant;
ALTER TABLE evaluation_method_categories DROP CONSTRAINT IF EXISTS fk_evaluation_method_categories_tenant;
ALTER TABLE evaluation_methods           DROP CONSTRAINT IF EXISTS fk_evaluation_methods_tenant;
ALTER TABLE graduation_project_topics    DROP CONSTRAINT IF EXISTS fk_graduation_project_topics_tenant;
ALTER TABLE institution_expertise_tags   DROP CONSTRAINT IF EXISTS fk_institution_expertise_tags_tenant;
ALTER TABLE institutions                 DROP CONSTRAINT IF EXISTS fk_institutions_tenant;
ALTER TABLE learn_roads                  DROP CONSTRAINT IF EXISTS fk_learn_roads_tenant;
ALTER TABLE micro_cert_templates         DROP CONSTRAINT IF EXISTS fk_micro_cert_templates_tenant;
ALTER TABLE orders                       DROP CONSTRAINT IF EXISTS fk_orders_tenant;
ALTER TABLE platform_links               DROP CONSTRAINT IF EXISTS fk_platform_links_tenant;
ALTER TABLE resource_tags                DROP CONSTRAINT IF EXISTS fk_resource_tags_tenant;
ALTER TABLE resources                    DROP CONSTRAINT IF EXISTS fk_resources_tenant;
ALTER TABLE task_resources               DROP CONSTRAINT IF EXISTS fk_task_resources_tenant;
ALTER TABLE view_logs                    DROP CONSTRAINT IF EXISTS fk_view_logs_tenant;
ALTER TABLE withdrawals                  DROP CONSTRAINT IF EXISTS fk_withdrawals_tenant;
