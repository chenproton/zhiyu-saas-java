-- 066_resource_platform: 资源共享平台
-- resource_library: 场景任务资源库（文档/表格/图片/链接/音频/视频/压缩包/场地/设施设备/软件/其他）
-- on_site_question_library: 场景任务-测评方式-现场问答题库

DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM (
        'document', 'spreadsheet', 'image', 'link', 'audio',
        'video', 'archive', 'venue', 'facility', 'software', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE resource_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(256) NOT NULL,
    resource_type resource_type NOT NULL,
    url TEXT,
    description TEXT,
    thumbnail TEXT,
    file_size BIGINT,
    metadata JSONB DEFAULT '{}',
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_resource_library_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX idx_resource_library_tenant ON resource_library(tenant_id);
CREATE INDEX idx_resource_library_type ON resource_library(tenant_id, resource_type);

CREATE TABLE on_site_question_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    question_text TEXT NOT NULL,
    answer TEXT,
    question_type VARCHAR(32) NOT NULL DEFAULT 'short_answer',
    score FLOAT8 DEFAULT 0,
    difficulty VARCHAR(16),
    knowledge_point_ids UUID[],
    tags TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_osql_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX idx_on_site_question_library_tenant ON on_site_question_library(tenant_id);
