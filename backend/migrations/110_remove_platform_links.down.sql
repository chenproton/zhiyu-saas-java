-- 回滚：恢复 platform_links 与 app_modules 表（结构与 001_baseline 一致）
CREATE TABLE public.app_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform character varying(64) NOT NULL,
    title character varying(128) NOT NULL,
    description text,
    href text,
    sort_order integer DEFAULT 0 NOT NULL,
    tenant_id uuid
);

CREATE TABLE public.platform_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platform character varying(64) NOT NULL,
    url text,
    enabled boolean DEFAULT true NOT NULL,
    tenant_id uuid
);

ALTER TABLE ONLY public.app_modules
    ADD CONSTRAINT app_modules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_links
    ADD CONSTRAINT platform_links_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_links
    ADD CONSTRAINT platform_links_platform_key UNIQUE (platform);

CREATE INDEX idx_app_modules_platform ON public.app_modules USING btree (platform);
CREATE INDEX idx_appmodules_tenant ON public.app_modules USING btree (tenant_id);
CREATE INDEX idx_platformlinks_tenant ON public.platform_links USING btree (tenant_id);

ALTER TABLE ONLY public.app_modules
    ADD CONSTRAINT fk_app_modules_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.platform_links
    ADD CONSTRAINT fk_platform_links_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
