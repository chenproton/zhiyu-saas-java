-- AI 智能服务中心：知识库 / 文档 / 分块 / 协作者 / 智能体 / 会话 / 第三方挂接 / 审核留痕
-- 决策依据：docs/spec/ai-service-center.md §4（D1 分块+pg_trgm 检索、D3 两档+审核、D9 协作者共建）。
-- 见 docs/spec/04-database-schema.md §2.19 字段级定义。

-- pg_trgm：中文分块相似度召回（三元组对中文子串匹配稳健，免切词器依赖）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ===== 知识库 =====
CREATE TABLE IF NOT EXISTS ai_knowledge_bases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    name varchar(200) NOT NULL,
    description text NOT NULL DEFAULT '',
    tags jsonb NOT NULL DEFAULT '[]',          -- 字符串数组，广场分类筛选
    status varchar(16) NOT NULL DEFAULT 'private'
        CHECK (status IN ('private','pending','published','rejected')),
    review_comment text NOT NULL DEFAULT '',   -- 最近一次审核意见
    reviewed_by UUID,
    reviewed_at timestamptz,
    doc_count integer NOT NULL DEFAULT 0,      -- ready 文档数（冗余展示）
    ask_count bigint NOT NULL DEFAULT 0,       -- 检索次数（D8）
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_kb_tenant_status ON ai_knowledge_bases(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_kb_owner ON ai_knowledge_bases(tenant_id, owner_id);

-- ===== 知识库文档 =====
CREATE TABLE IF NOT EXISTS ai_kb_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    kb_id UUID NOT NULL REFERENCES ai_knowledge_bases(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES users(id),
    name varchar(255) NOT NULL,                -- 原始文件名
    file_path text NOT NULL,                   -- UploadDir 相对路径
    file_size bigint NOT NULL DEFAULT 0,
    mime varchar(100) NOT NULL DEFAULT '',
    status varchar(16) NOT NULL DEFAULT 'parsing'
        CHECK (status IN ('parsing','ready','failed')),
    error text NOT NULL DEFAULT '',            -- 解析失败原因（文件加密/空内容/格式不支持等）
    chunk_count integer NOT NULL DEFAULT 0,
    char_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_kb_docs_kb ON ai_kb_documents(tenant_id, kb_id);

-- ===== 文档分块（检索单元）=====
CREATE TABLE IF NOT EXISTS ai_kb_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    doc_id UUID NOT NULL REFERENCES ai_kb_documents(id) ON DELETE CASCADE,
    kb_id UUID NOT NULL,                       -- 冗余（召回免 JOIN 文档表），随 doc 级联
    seq integer NOT NULL,                      -- 文档内序号（溯源「第 N 段」）
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_kb_chunks_kb ON ai_kb_chunks(tenant_id, kb_id);
CREATE INDEX IF NOT EXISTS idx_ai_kb_chunks_content_trgm ON ai_kb_chunks USING gin (content gin_trgm_ops);

-- ===== 知识库协作者 =====
CREATE TABLE IF NOT EXISTS ai_kb_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    kb_id UUID NOT NULL REFERENCES ai_knowledge_bases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role varchar(16) NOT NULL CHECK (role IN ('editor','viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_kb_collaborators_kb_user_key UNIQUE (kb_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_kb_collab_user ON ai_kb_collaborators(tenant_id, user_id);

-- ===== 自建智能体 =====
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    name varchar(100) NOT NULL,
    avatar varchar(500) NOT NULL DEFAULT '',   -- emoji（v1 用 emoji 选择器）
    description text NOT NULL DEFAULT '',
    greeting text NOT NULL DEFAULT '',
    system_prompt text NOT NULL,               -- 角色设定+回答规则（≤4000 字）
    status varchar(16) NOT NULL DEFAULT 'private'
        CHECK (status IN ('private','pending','published','rejected')),
    review_comment text NOT NULL DEFAULT '',
    reviewed_by UUID,
    reviewed_at timestamptz,
    chat_count bigint NOT NULL DEFAULT 0,      -- 对话轮数（D8）
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant_status ON ai_agents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_owner ON ai_agents(tenant_id, owner_id);

-- ===== 智能体关联知识库 =====
CREATE TABLE IF NOT EXISTS ai_agent_kbs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    kb_id UUID NOT NULL REFERENCES ai_knowledge_bases(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_agent_kbs_agent_kb_key UNIQUE (agent_id, kb_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_kbs_kb ON ai_agent_kbs(kb_id);

-- ===== 会话 =====
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    agent_id UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    title varchar(100) NOT NULL DEFAULT '',    -- 首条用户消息截 30 字
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(tenant_id, agent_id, user_id);

-- ===== 会话消息 =====
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role varchar(16) NOT NULL CHECK (role IN ('user','assistant')),
    content text NOT NULL,
    sources jsonb NOT NULL DEFAULT '[]',       -- [{doc_id,doc_name,seq,snippet}]
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, created_at);

-- ===== 第三方智能体/应用挂接（链接卡片）=====
CREATE TABLE IF NOT EXISTS ai_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    kind varchar(16) NOT NULL CHECK (kind IN ('agent','app')),
    name varchar(200) NOT NULL,
    description text NOT NULL DEFAULT '',
    url varchar(500) NOT NULL,                 -- 仅 http/https（XSS 防线在 service 校验）
    icon varchar(500) NOT NULL DEFAULT '',     -- emoji
    category varchar(50) NOT NULL DEFAULT '',
    sort integer NOT NULL DEFAULT 0,
    status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_by UUID,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_integrations_tenant ON ai_integrations(tenant_id, kind, status);

-- ===== 审核留痕 =====
CREATE TABLE IF NOT EXISTS ai_review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    target_type varchar(16) NOT NULL CHECK (target_type IN ('kb','agent')),
    target_id UUID NOT NULL,
    action varchar(16) NOT NULL CHECK (action IN ('submit','approve','reject','unpublish','takedown')),
    actor_id UUID NOT NULL,
    comment text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_review_logs_target ON ai_review_logs(tenant_id, target_type, target_id);
