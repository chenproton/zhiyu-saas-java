-- 收敛租户数据边界：为所有带 tenant_id 但缺失租户外键的表补 ON DELETE CASCADE，
-- 使删除租户时不再残留孤儿数据；同时清理 industries 的冗余重复外键。
-- 平台级表（banners/platform_links/app_modules 等）tenant_id 均已有值且指向有效租户，一并纳入级联。

-- 1) 补租户级联外键
DO $$ BEGIN ALTER TABLE announcements                ADD CONSTRAINT fk_announcements_tenant                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE app_modules                  ADD CONSTRAINT fk_app_modules_tenant                  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE authorizations               ADD CONSTRAINT fk_authorizations_tenant               FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE banner_configs               ADD CONSTRAINT fk_banner_configs_tenant               FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE banners                      ADD CONSTRAINT fk_banners_tenant                      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE certification_ability_items  ADD CONSTRAINT fk_certification_ability_items_tenant  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE certification_ability_points ADD CONSTRAINT fk_certification_ability_points_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE certification_related_tasks  ADD CONSTRAINT fk_certification_related_tasks_tenant  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE certification_rules          ADD CONSTRAINT fk_certification_rules_tenant          FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE credit_conversion_rules      ADD CONSTRAINT fk_credit_conversion_rules_tenant      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE evaluation_method_categories ADD CONSTRAINT fk_evaluation_method_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE evaluation_methods           ADD CONSTRAINT fk_evaluation_methods_tenant           FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE graduation_project_topics    ADD CONSTRAINT fk_graduation_project_topics_tenant    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE institution_expertise_tags   ADD CONSTRAINT fk_institution_expertise_tags_tenant   FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE institutions                 ADD CONSTRAINT fk_institutions_tenant                 FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE learn_roads                  ADD CONSTRAINT fk_learn_roads_tenant                  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE micro_cert_templates         ADD CONSTRAINT fk_micro_cert_templates_tenant         FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders                       ADD CONSTRAINT fk_orders_tenant                       FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE platform_links               ADD CONSTRAINT fk_platform_links_tenant               FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE resource_tags                ADD CONSTRAINT fk_resource_tags_tenant                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE resources                    ADD CONSTRAINT fk_resources_tenant                    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE task_resources               ADD CONSTRAINT fk_task_resources_tenant               FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE view_logs                    ADD CONSTRAINT fk_view_logs_tenant                    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE withdrawals                  ADD CONSTRAINT fk_withdrawals_tenant                  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) 商城交易表引用 institutions/resources 的 NO ACTION 外键改为 CASCADE，
--    避免跨租户订单在租户删除级联 institutions 时再次阻断
DO $$ BEGIN ALTER TABLE orders         DROP CONSTRAINT IF EXISTS orders_buyer_id_new_fkey;            ALTER TABLE orders         ADD CONSTRAINT orders_buyer_id_new_fkey            FOREIGN KEY (buyer_id)       REFERENCES institutions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders         DROP CONSTRAINT IF EXISTS orders_seller_id_new_fkey;           ALTER TABLE orders         ADD CONSTRAINT orders_seller_id_new_fkey           FOREIGN KEY (seller_id)      REFERENCES institutions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE orders         DROP CONSTRAINT IF EXISTS orders_resource_id_new_fkey;         ALTER TABLE orders         ADD CONSTRAINT orders_resource_id_new_fkey         FOREIGN KEY (resource_id)    REFERENCES resources(id)    ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE authorizations DROP CONSTRAINT IF EXISTS authorizations_buyer_id_new_fkey;    ALTER TABLE authorizations ADD CONSTRAINT authorizations_buyer_id_new_fkey    FOREIGN KEY (buyer_id)       REFERENCES institutions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE authorizations DROP CONSTRAINT IF EXISTS authorizations_resource_id_new_fkey; ALTER TABLE authorizations ADD CONSTRAINT authorizations_resource_id_new_fkey FOREIGN KEY (resource_id)    REFERENCES resources(id)    ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE withdrawals    DROP CONSTRAINT IF EXISTS withdrawals_institution_id_new_fkey; ALTER TABLE withdrawals    ADD CONSTRAINT withdrawals_institution_id_new_fkey FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) 清理 industries 的冗余重复外键（与 fk_industries_tenant 完全相同）
ALTER TABLE industries DROP CONSTRAINT IF EXISTS fk_industries_tenant_fk;
