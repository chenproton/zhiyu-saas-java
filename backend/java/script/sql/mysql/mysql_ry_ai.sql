-- ============================================================
-- Snail AI PostgreSQL 全量建表脚本（仅 CREATE，无 ALTER）
-- 使用：psql -U user -d snail_ai -f postgres_ry_ai.sql
-- 结构来源：snail_ai_schema.sql
-- ============================================================

-- ============================================================
-- 公共触发器函数：模拟 MySQL ON UPDATE CURRENT_TIMESTAMP
-- ============================================================
-- PL/pgSQL 触发器函数已删除：update 时间戳由应用层（MyBatis-Plus 自动填充）维护


-- PL/pgSQL 触发器函数已删除：update 时间戳由应用层（MyBatis-Plus 自动填充）维护


-- PL/pgSQL 触发器函数已删除：update 时间戳由应用层（MyBatis-Plus 自动填充）维护


-- ============================================================
-- 一、用户与权限
-- ============================================================

-- 1.1 用户表
CREATE TABLE sai_user
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    role INT,
    totals INT,
    username VARCHAR(255),
    nickname VARCHAR(128) DEFAULT NULL,
    email VARCHAR(64),
    password VARCHAR(255) NOT NULL,
    resource_id BIGINT DEFAULT NULL,
    create_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_username UNIQUE (username)
);

-- 列注释: sai_user.nickname = 用户昵称
-- 列注释: sai_user.resource_id = 头像资源ID，关联 sai_resource.id

-- 触发器已删除：update 时间戳由应用层自动填充


-- 1.2 OpenAPI 外部用户映射表
CREATE TABLE sai_openapi_user
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(128) NOT NULL,
    open_id VARCHAR(64) NOT NULL,
    platform_user_id BIGINT NOT NULL,
    external_id VARCHAR(256) DEFAULT NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_app_open UNIQUE (app_id, open_id),
    CONSTRAINT uk_app_external UNIQUE (app_id, external_id)
);

-- 表注释: sai_openapi_user = OpenAPI 外部用户映射表
-- 列注释: sai_openapi_user.app_id = 关联 sai_app.app_id
-- 列注释: sai_openapi_user.open_id = 平台分配的唯一标识（UUID）
-- 列注释: sai_openapi_user.platform_user_id = 关联 sai_user.id，注册时自动创建
-- 列注释: sai_openapi_user.external_id = 外部系统的用户标识（可选，幂等用）

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_open_id ON sai_openapi_user (open_id);
CREATE INDEX idx_platform_user ON sai_openapi_user (platform_user_id);

-- ============================================================
-- 二、AI 模型管理
-- ============================================================

-- 2.1 AI 模型提供商表
CREATE TABLE IF NOT EXISTS sai_model_provider
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    provider_key VARCHAR(50) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    is_enabled BOOLEAN DEFAULT TRUE,
    created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_provider_name UNIQUE (provider_name),
    CONSTRAINT uk_provider_key UNIQUE (provider_key)
);

-- 表注释: sai_model_provider = AI模型提供商表
-- 列注释: sai_model_provider.provider_name = 提供商名称
-- 列注释: sai_model_provider.provider_key = 提供商标识符
-- 列注释: sai_model_provider.description = 提供商描述
-- 列注释: sai_model_provider.icon_url = LOGO图标URL
-- 列注释: sai_model_provider.is_enabled = 是否启用
-- 列注释: sai_model_provider.created_dt = 创建时间
-- 列注释: sai_model_provider.updated_dt = 更新时间

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_provider_key ON sai_model_provider (provider_key);
CREATE INDEX idx_is_enabled ON sai_model_provider (is_enabled);

-- 2.2 AI模型配置表
CREATE TABLE IF NOT EXISTS sai_model_config
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider_id BIGINT NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    model_key VARCHAR(100) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    adapter_key VARCHAR(100),
    description VARCHAR(1000),
    api_key VARCHAR(1000),
    api_endpoint VARCHAR(500),
    config_json TEXT,
    owner_id BIGINT,
    scope VARCHAR(20) NOT NULL DEFAULT 'GLOBAL',
    is_default BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表注释: sai_model_config = AI模型配置表
-- 列注释: sai_model_config.provider_id = 提供商ID
-- 列注释: sai_model_config.model_name = 模型名称
-- 列注释: sai_model_config.model_key = 模型标识符
-- 列注释: sai_model_config.model_type = 模型类型(CHAT/EMBEDDING/RERANKER/IMAGE/SPEECH)
-- 列注释: sai_model_config.adapter_key = 底层协议适配器标识(openai-compatible/http等)
-- 列注释: sai_model_config.description = 模型描述
-- 列注释: sai_model_config.api_key = API密钥(加密存储)
-- 列注释: sai_model_config.api_endpoint = API端点URL
-- 列注释: sai_model_config.config_json = 模型参数配置(JSON格式)
-- 列注释: sai_model_config.owner_id = 所有者ID(NULL=全局,具体值=用户ID)
-- 列注释: sai_model_config.scope = 作用域(GLOBAL/PERSONAL)
-- 列注释: sai_model_config.is_default = 是否为默认模型
-- 列注释: sai_model_config.is_enabled = 是否启用
-- 列注释: sai_model_config.created_dt = 创建时间
-- 列注释: sai_model_config.updated_dt = 更新时间

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX fk_provider_id ON sai_model_config (provider_id);

CREATE INDEX idx_provider_model_type ON sai_model_config (provider_id, model_type);
CREATE INDEX idx_model_type_enabled ON sai_model_config (model_type, is_enabled);
CREATE INDEX idx_owner_id ON sai_model_config (owner_id);
CREATE INDEX idx_is_default ON sai_model_config (is_default);
CREATE INDEX idx_scope ON sai_model_config (scope);
CREATE INDEX idx_model_key ON sai_model_config (model_key);

-- 2.3 模型使用统计表
CREATE TABLE IF NOT EXISTS sai_model_usage_stat
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    model_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    total_calls BIGINT DEFAULT 0,
    success_calls BIGINT DEFAULT 0,
    failed_calls BIGINT DEFAULT 0,
    total_tokens_used BIGINT DEFAULT 0,
    total_cost DECIMAL(18, 8) DEFAULT 0,
    avg_response_time BIGINT DEFAULT 0,
    last_used_dt TIMESTAMP NULL DEFAULT NULL,
    created_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_model_user UNIQUE (model_id, user_id)
);

-- 表注释: sai_model_usage_stat = 模型使用统计表
-- 列注释: sai_model_usage_stat.model_id = 模型ID
-- 列注释: sai_model_usage_stat.user_id = 用户ID
-- 列注释: sai_model_usage_stat.total_calls = 总调用次数
-- 列注释: sai_model_usage_stat.success_calls = 成功调用次数
-- 列注释: sai_model_usage_stat.failed_calls = 失败调用次数
-- 列注释: sai_model_usage_stat.total_tokens_used = 总Token使用量
-- 列注释: sai_model_usage_stat.total_cost = 总费用
-- 列注释: sai_model_usage_stat.avg_response_time = 平均响应时间(毫秒)
-- 列注释: sai_model_usage_stat.last_used_dt = 最后使用时间
-- 列注释: sai_model_usage_stat.created_dt = 创建时间
-- 列注释: sai_model_usage_stat.updated_dt = 更新时间

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX fk_stat_model_id ON sai_model_usage_stat (model_id);

CREATE INDEX idx_model_id ON sai_model_usage_stat (model_id);
CREATE INDEX idx_user_id ON sai_model_usage_stat (user_id);
CREATE INDEX idx_last_used_dt ON sai_model_usage_stat (last_used_dt);

-- ============================================================
-- 三、智能体（Agent）
-- ============================================================

-- 3.1 智能体主表
CREATE TABLE IF NOT EXISTS sai_agent
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar VARCHAR(512),
    instruction TEXT,
    greeting TEXT,
    preset_questions TEXT,
    chat_model_id BIGINT,
    memory_enabled BOOLEAN DEFAULT FALSE,
    mcp_enabled BOOLEAN DEFAULT FALSE,
    skill_enabled BOOLEAN DEFAULT FALSE,
    web_search_enabled BOOLEAN DEFAULT FALSE,
    rag_enabled BOOLEAN DEFAULT FALSE,
    rag_ids VARCHAR(64) NULL,
    rag_call_mode SMALLINT DEFAULT 1,
    short_term_memory_size INT DEFAULT 20,
    creator_id BIGINT,
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    status SMALLINT DEFAULT 1,
    config TEXT,
    app_id VARCHAR(128) NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表注释: sai_agent = 智能体表
-- 列注释: sai_agent.name = 智能体名称
-- 列注释: sai_agent.description = 智能体描述
-- 列注释: sai_agent.avatar = 头像URL
-- 列注释: sai_agent.instruction = 系统指令(System Prompt)
-- 列注释: sai_agent.greeting = 欢迎语
-- 列注释: sai_agent.preset_questions = 预设问题列表（JSON数组字符串）
-- 列注释: sai_agent.chat_model_id = 关联的对话模型ID
-- 列注释: sai_agent.memory_enabled = 是否启用记忆库
-- 列注释: sai_agent.mcp_enabled = 是否启用MCP
-- 列注释: sai_agent.skill_enabled = 是否启用Skill
-- 列注释: sai_agent.web_search_enabled = 是否启用联网搜索
-- 列注释: sai_agent.rag_enabled = 是否启用RAG
-- 列注释: sai_agent.rag_ids = 绑定的RAG ID列表，逗号分隔，最多5个
-- 列注释: sai_agent.rag_call_mode = RAG调用方式: 1=智能调用 2=强制调用
-- 列注释: sai_agent.short_term_memory_size = 短期记忆滑动窗口保留条数
-- 列注释: sai_agent.creator_id = 创建者用户ID
-- 列注释: sai_agent.is_featured = 是否精选
-- 列注释: sai_agent.view_count = 浏览次数
-- 列注释: sai_agent.status = 状态: 1-活跃 2-非活跃 3-已废弃 4-已禁用
-- 列注释: sai_agent.config = 扩展配置(预留)
-- 列注释: sai_agent.app_id = 关联应用ID(NULL=本地执行)

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_agent_creator ON sai_agent (creator_id);
CREATE INDEX idx_agent_featured ON sai_agent (is_featured);

-- 3.2 智能体对话表
CREATE TABLE IF NOT EXISTS sai_agent_conversation
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    title VARCHAR(255),
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_conv_id UNIQUE (conversation_id)
);

-- 表注释: sai_agent_conversation = 智能体对话表
-- 列注释: sai_agent_conversation.agent_id = 智能体ID
-- 列注释: sai_agent_conversation.user_id = 用户ID
-- 列注释: sai_agent_conversation.conversation_id = 对话ID(UUID)
-- 列注释: sai_agent_conversation.title = 对话标题

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_agent_conv_agent ON sai_agent_conversation (agent_id);
CREATE INDEX idx_agent_conv_user ON sai_agent_conversation (user_id);

-- 3.3 智能体对话消息记录表
CREATE TABLE IF NOT EXISTS sai_agent_conversation_record
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    role VARCHAR(16) DEFAULT 'user',
    content TEXT,
    thinking TEXT,
    metadata TEXT NULL,
    status INT DEFAULT 1,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    cache_tokens INT DEFAULT 0,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表注释: sai_agent_conversation_record = 智能体对话消息记录
-- 列注释: sai_agent_conversation_record.agent_id = 智能体ID
-- 列注释: sai_agent_conversation_record.conversation_id = 对话ID
-- 列注释: sai_agent_conversation_record.user_id = 用户ID
-- 列注释: sai_agent_conversation_record.role = user/assistant
-- 列注释: sai_agent_conversation_record.content = 消息内容
-- 列注释: sai_agent_conversation_record.thinking = 思考过程（仅assistant）
-- 列注释: sai_agent_conversation_record.metadata = 消息扩展元数据JSON
-- 列注释: sai_agent_conversation_record.status = 1=成功,2=失败,3=进行中
-- 列注释: sai_agent_conversation_record.input_tokens = 输入Token数（prompt）
-- 列注释: sai_agent_conversation_record.output_tokens = 输出Token数（completion）
-- 列注释: sai_agent_conversation_record.cache_tokens = 缓存命中Token数

CREATE INDEX idx_agent_rec_conv ON sai_agent_conversation_record (conversation_id);

-- 3.4 智能体使用统计表
CREATE TABLE IF NOT EXISTS sai_agent_usage_stat
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    message_count INT DEFAULT 0,
    conversation_count INT DEFAULT 0,
    stat_date DATE NOT NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_agent_user_date UNIQUE (agent_id, user_id, stat_date)
);

-- 表注释: sai_agent_usage_stat = 智能体使用统计
-- 列注释: sai_agent_usage_stat.agent_id = 智能体ID
-- 列注释: sai_agent_usage_stat.user_id = 用户ID
-- 列注释: sai_agent_usage_stat.message_count = 消息条数
-- 列注释: sai_agent_usage_stat.conversation_count = 对话轮次
-- 列注释: sai_agent_usage_stat.stat_date = 统计日期

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_usage_agent ON sai_agent_usage_stat (agent_id);
CREATE INDEX idx_usage_date ON sai_agent_usage_stat (stat_date);

-- 3.5 用户订阅的智能体（多对多）
CREATE TABLE IF NOT EXISTS sai_user_agent
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    agent_id BIGINT NOT NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_agent UNIQUE (user_id, agent_id)
);

-- 表注释: sai_user_agent = 用户订阅的智能体
-- 列注释: sai_user_agent.user_id = 用户ID
-- 列注释: sai_user_agent.agent_id = 智能体ID

CREATE INDEX idx_user_agent_user ON sai_user_agent (user_id);

-- ============================================================
-- 四、RAG 知识库
-- ============================================================

-- 4.1 知识库主表
CREATE TABLE sai_rag
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(512),
    embedding_model_id BIGINT NOT NULL,
    dimension_of_vector_model INT NOT NULL,
    rerank_model_id BIGINT,
    search_engine_instance_id BIGINT,
    vector_store_instance_id BIGINT,
    search_engine_enable BOOLEAN DEFAULT FALSE,
    delimiter VARCHAR(32) DEFAULT '\n\n',
    rag_enhancement TEXT,
    config TEXT NULL,
    dedup_strategy SMALLINT NOT NULL DEFAULT 2,
    dedup_action SMALLINT NOT NULL DEFAULT 0,
    upload_confirm BOOLEAN NOT NULL DEFAULT TRUE,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 列注释: sai_rag.dimension_of_vector_model = 向量维度
-- 列注释: sai_rag.config = RAG检索和问答的页面配置参数
-- 列注释: sai_rag.dedup_strategy = 去重策略: 0=NONE 1=BY_NAME 2=BY_CONTENT 3=BY_NAME_OR_CONTENT
-- 列注释: sai_rag.dedup_action = 冲突动作: 0=REJECT 1=SKIP 2=OVERWRITE
-- 列注释: sai_rag.upload_confirm = 上传前二次确认: 0-关 1-开

-- 触发器已删除：update 时间戳由应用层自动填充


-- 4.2 RAG 文档表
CREATE TABLE sai_rag_document
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rag_id BIGINT NOT NULL,
    name VARCHAR(255),
    file_type VARCHAR(32),
    source_type VARCHAR(32),
    source_path VARCHAR(1024),
    storage_path VARCHAR(1024),
    storage_type VARCHAR(32) DEFAULT 'LOCAL',
    file_size BIGINT DEFAULT 0,
    content TEXT,
    status SMALLINT DEFAULT 0,
    error_msg TEXT,
    chunk_count INT DEFAULT 0,
    page_count INT DEFAULT 0,
    element_count INT DEFAULT 0,
    table_count INT DEFAULT 0,
    image_count INT DEFAULT 0,
    parse_time INT DEFAULT 0,
    md_content TEXT NULL,
    doc_metadata TEXT NULL,
    content_hash VARCHAR(64) DEFAULT NULL,
    resource_id BIGINT DEFAULT NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 列注释: sai_rag_document.status = 状态: 0-待处理 1-解析中 2-处理中 3-处理完成 4-处理失败
-- 列注释: sai_rag_document.content_hash = 文件内容SHA-256哈希，用于去重
-- 列注释: sai_rag_document.resource_id = 关联资源库 sai_resource.id

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_rag_doc_rag ON sai_rag_document (rag_id);
CREATE INDEX idx_rag_content_hash ON sai_rag_document (rag_id, content_hash);
CREATE INDEX idx_rag_name ON sai_rag_document (rag_id, name);
CREATE INDEX idx_rag_doc_resource ON sai_rag_document (resource_id);

CREATE TABLE sai_rag_document_image
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rag_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    chunk_id BIGINT DEFAULT NULL,
    resource_id BIGINT DEFAULT NULL,
    image_index INT,
    image_url VARCHAR(1024),
    caption TEXT,
    figure_no VARCHAR(64),
    figure_title VARCHAR(512),
    section_title VARCHAR(512),
    source_page INT,
    document_name VARCHAR(255),
    ocr_text TEXT,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表注释: sai_rag_document_image = RAG document parsed image table
-- 列注释: sai_rag_document_image.resource_id = Linked resource id in sai_resource

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_rag_doc_image_rag ON sai_rag_document_image (rag_id);
CREATE INDEX idx_rag_doc_image_document ON sai_rag_document_image (document_id);
CREATE INDEX idx_rag_doc_image_chunk ON sai_rag_document_image (chunk_id);
CREATE INDEX idx_rag_doc_image_resource ON sai_rag_document_image (resource_id);

-- 4.3 RAG 分块表
CREATE TABLE sai_rag_chunk
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rag_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL,
    paragraph_index INT,
    chunk_index INT,
    content TEXT,
    token_count INT,
    vector_id VARCHAR(128),
    content_hash VARCHAR(64) DEFAULT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'TEXT',
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 列注释: sai_rag_chunk.content_hash = chunk内容SHA-256，用于向量去重
-- 列注释: sai_rag_chunk.source_type = chunk来源类型：TEXT文本、IMAGE图片

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_rag_chunk_rag ON sai_rag_chunk (rag_id);
CREATE INDEX idx_rag_chunk_document ON sai_rag_chunk (document_id);
CREATE INDEX idx_chunk_rag_hash ON sai_rag_chunk (rag_id, content_hash);
CREATE INDEX idx_chunk_rag_source_type ON sai_rag_chunk (rag_id, source_type);

-- ============================================================
-- 五、MCP 服务管理
-- ============================================================

-- 5.1 MCP 服务配置表
CREATE TABLE IF NOT EXISTS sai_mcp_server
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    transport_type SMALLINT DEFAULT 1,
    base_uri VARCHAR(1024),
    endpoint VARCHAR(1024),
    command VARCHAR(1024),
    args TEXT,
    env_vars TEXT,
    timeout BIGINT DEFAULT 60000,
    headers TEXT,
    last_connect_dt TIMESTAMP NULL,
    creator_id BIGINT,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表注释: sai_mcp_server = MCP服务配置表
-- 列注释: sai_mcp_server.name = MCP服务名称
-- 列注释: sai_mcp_server.description = MCP服务描述
-- 列注释: sai_mcp_server.transport_type = 传输类型: 1-SSE 2-Streamable HTTP 3-Stdio
-- 列注释: sai_mcp_server.base_uri = 服务基础地址(SSE/Streamable HTTP时使用)
-- 列注释: sai_mcp_server.endpoint = 端点路径(SSE/Streamable HTTP时可选)
-- 列注释: sai_mcp_server.command = Stdio命令(Stdio时必填)
-- 列注释: sai_mcp_server.args = Stdio命令参数(JSON数组)
-- 列注释: sai_mcp_server.env_vars = Stdio环境变量(JSON对象)
-- 列注释: sai_mcp_server.timeout = 超时时间(毫秒)
-- 列注释: sai_mcp_server.headers = 请求头(JSON对象)
-- 列注释: sai_mcp_server.last_connect_dt = 最后连接时间
-- 列注释: sai_mcp_server.creator_id = 创建者用户ID

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_mcp_server_creator ON sai_mcp_server (creator_id);

-- 5.2 智能体与MCP服务关联表（多对多）
CREATE TABLE IF NOT EXISTS sai_agent_mcp_server
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    mcp_server_id BIGINT NOT NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_agent_mcp UNIQUE (agent_id, mcp_server_id)
);

-- 表注释: sai_agent_mcp_server = 智能体MCP服务关联表
-- 列注释: sai_agent_mcp_server.agent_id = 智能体ID
-- 列注释: sai_agent_mcp_server.mcp_server_id = MCP服务ID

CREATE INDEX idx_agent_mcp_agent ON sai_agent_mcp_server (agent_id);
CREATE INDEX idx_agent_mcp_server ON sai_agent_mcp_server (mcp_server_id);

-- ============================================================
-- 六、Skill 技能包管理
-- ============================================================

-- 6.1 Skill 技能包表
CREATE TABLE IF NOT EXISTS sai_skill
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255),
    file_path VARCHAR(1024),
    file_size BIGINT DEFAULT 0,
    skill_content TEXT,
    storage_path VARCHAR(500) DEFAULT NULL,
    version BIGINT DEFAULT 0,
    has_files BOOLEAN DEFAULT FALSE,
    creator_id BIGINT,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表注释: sai_skill = Skill技能包表
-- 列注释: sai_skill.name = Skill名称(从SKILL.md解析)
-- 列注释: sai_skill.description = Skill描述(从SKILL.md解析)
-- 列注释: sai_skill.file_name = 上传的zip文件名
-- 列注释: sai_skill.file_path = 解压后存储路径
-- 列注释: sai_skill.file_size = 文件大小(字节)
-- 列注释: sai_skill.skill_content = SKILL.md正文内容(去除frontmatter)
-- 列注释: sai_skill.storage_path = 对象存储相对路径前缀（如 skills/123/）
-- 列注释: sai_skill.version = 版本号，文件变更时自增，用于缓存一致性校验
-- 列注释: sai_skill.has_files = 是否包含支撑文件（0=仅SKILL.md，1=有scripts/references等）
-- 列注释: sai_skill.creator_id = 创建者用户ID

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_skill_creator ON sai_skill (creator_id);

-- 6.2 Skill 支撑文件内容表
CREATE TABLE IF NOT EXISTS sai_skill_file
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    skill_id BIGINT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    file_size INT NOT NULL,
    encoding VARCHAR(50) DEFAULT 'utf-8',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_skill_path UNIQUE (skill_id, file_path)
);

-- 表注释: sai_skill_file = Skill支撑文件内容表
-- 列注释: sai_skill_file.skill_id = Skill ID
-- 列注释: sai_skill_file.file_path = 文件相对路径
-- 列注释: sai_skill_file.content = 文件内容
-- 列注释: sai_skill_file.file_size = 文件大小(字节)
-- 列注释: sai_skill_file.encoding = 编码方式
-- 列注释: sai_skill_file.created_at = 创建时间
-- 列注释: sai_skill_file.updated_at = 更新时间

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_skill_id ON sai_skill_file (skill_id);

-- 6.3 智能体与Skill关联表（多对多）
CREATE TABLE IF NOT EXISTS sai_agent_skill
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    agent_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_agent_skill UNIQUE (agent_id, skill_id)
);

-- 表注释: sai_agent_skill = 智能体Skill关联表
-- 列注释: sai_agent_skill.agent_id = 智能体ID
-- 列注释: sai_agent_skill.skill_id = Skill ID

CREATE INDEX idx_agent_skill_agent ON sai_agent_skill (agent_id);
CREATE INDEX idx_agent_skill_skill ON sai_agent_skill (skill_id);

-- ============================================================
-- 七、客户端应用与节点
-- ============================================================

-- 7.1 客户端应用
CREATE TABLE IF NOT EXISTS sai_app
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(128) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    description VARCHAR(512),
    token VARCHAR(128) NOT NULL,
    route_strategy VARCHAR(32) DEFAULT 'LEAST_LOAD',
    status SMALLINT DEFAULT 1,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_app_id UNIQUE (app_id)
);

-- 表注释: sai_app = 客户端应用
-- 列注释: sai_app.app_id = 应用唯一标识
-- 列注释: sai_app.app_name = 应用名称
-- 列注释: sai_app.description = 应用描述
-- 列注释: sai_app.token = 通信认证令牌
-- 列注释: sai_app.route_strategy = 路由策略
-- 列注释: sai_app.status = 1=启用, 0=停用

-- 触发器已删除：update 时间戳由应用层自动填充


-- 7.2 AI客户端实例节点
CREATE TABLE IF NOT EXISTS sai_client_node
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    app_id VARCHAR(128) NOT NULL,
    host_id VARCHAR(128) NOT NULL,
    host_ip VARCHAR(64) NOT NULL,
    grpc_port INT NOT NULL,
    max_concurrent INT DEFAULT 10,
    active_chats INT DEFAULT 0,
    supported_providers TEXT,
    labels TEXT,
    expire_dt TIMESTAMP NOT NULL,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_client_node UNIQUE (app_id, host_id)
);

-- 表注释: sai_client_node = AI客户端实例节点
-- 列注释: sai_client_node.app_id = 所属应用ID
-- 列注释: sai_client_node.host_id = 客户端实例唯一标识
-- 列注释: sai_client_node.host_ip = 客户端IP
-- 列注释: sai_client_node.grpc_port = 客户端gRPC端口
-- 列注释: sai_client_node.max_concurrent = 最大并发对话数
-- 列注释: sai_client_node.active_chats = 当前活跃对话数
-- 列注释: sai_client_node.supported_providers = 支持的模型提供商(JSON数组)
-- 列注释: sai_client_node.labels = 路由标签
-- 列注释: sai_client_node.expire_dt = 过期时间(心跳更新)

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_app_expire ON sai_client_node (app_id, expire_dt);

-- ============================================================
-- 八、存储与资源
-- ============================================================

-- 8.1 存储实例
CREATE TABLE IF NOT EXISTS sai_store_instance
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    category SMALLINT NOT NULL,
    type SMALLINT NOT NULL,
    config TEXT NULL,
    status SMALLINT DEFAULT 1,
    is_default BOOLEAN DEFAULT FALSE,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 表注释: sai_store_instance = 存储实例
-- 列注释: sai_store_instance.name = 实例名称
-- 列注释: sai_store_instance.category = 分类: 1-向量库 2-搜索引擎
-- 列注释: sai_store_instance.type = 类型: 1-PG_VECTOR 2-MILVUS 3-ELASTICSEARCH 4-PG_FULLTEXT
-- 列注释: sai_store_instance.config = 连接参数 JSON
-- 列注释: sai_store_instance.status = 状态: 0-停用 1-启用
-- 列注释: sai_store_instance.is_default = 是否为该 category 下默认实例

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_store_instance_category ON sai_store_instance (category);
CREATE INDEX idx_store_instance_type ON sai_store_instance (type);

-- 8.2 通用资源存储
CREATE TABLE IF NOT EXISTS sai_resource
(
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    storage_key VARCHAR(512) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(128),
    storage_type VARCHAR(32) NOT NULL DEFAULT 'LOCAL',
    access_url VARCHAR(1024),
    biz_type VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
    biz_id BIGINT,
    creator_id BIGINT,
    create_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_storage_key UNIQUE (storage_key)
);

-- 表注释: sai_resource = 通用资源存储
-- 列注释: sai_resource.storage_key = 存储键（相对路径或对象Key）
-- 列注释: sai_resource.original_name = 原始文件名
-- 列注释: sai_resource.file_size = 文件大小(bytes)
-- 列注释: sai_resource.mime_type = MIME类型
-- 列注释: sai_resource.storage_type = 存储类型: LOCAL/MINIO
-- 列注释: sai_resource.access_url = 访问URL
-- 列注释: sai_resource.biz_type = 业务类型: AVATAR/ATTACHMENT/DOCUMENT/GENERAL
-- 列注释: sai_resource.biz_id = 关联业务ID
-- 列注释: sai_resource.creator_id = 上传者ID

-- 触发器已删除：update 时间戳由应用层自动填充


CREATE INDEX idx_biz ON sai_resource (biz_type, biz_id);
CREATE INDEX idx_creator ON sai_resource (creator_id);

-- ============================================================
-- 九、初始化数据
-- ============================================================

-- 默认管理员：admin / admin123
INSERT INTO sai_user VALUES (1, 2, NULL, 'admin', 'admin', '', 'pbkdf2$120000$c25haWwtYWktYWRtaW4tMQ==$kakglT/wYKOgv/77Ah1stie58d/JbY2nGgq5DwgUBw4=', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE id = id;


-- 插入常见的AI提供商
INSERT INTO sai_model_provider (provider_name, provider_key, description, is_enabled)
VALUES ('OpenAI', 'openai', 'OpenAI官方模型 (GPT-4, GPT-3.5等)', TRUE),
       ('Claude', 'claude', 'Anthropic Claude模型', TRUE),
       ('Ollama', 'ollama', '本地开源模型 (Llama, Mistral等)', TRUE),
       ('Google Gemini', 'gemini', 'Google Gemini模型', TRUE),
       ('阿里云百炼', 'qwen', '阿里云百炼 OpenAI 兼容模型 (Qwen等)', TRUE),
       ('DeepSeek', 'deepseek', 'DeepSeek OpenAI 兼容模型', TRUE),
       ('智谱AI', 'zhipu', '智谱AI OpenAI 兼容模型 (GLM等)', TRUE)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO sai_model_config VALUES (1, 5, 'glm-5.1', 'glm-5.1', 'CHAT', 'openai-compatible', '', '', 'https://dashscope.aliyuncs.com/compatible-mode/v1', '{"frequencyPenalty":0.0,"maxTokens":20000,"presencePenalty":0.0,"stopSequences":[],"stream":true,"temperature":0.7,"timeoutMs":300000,"topK":1,"topP":1.0}', NULL, 'GLOBAL', TRUE, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE id = id;


INSERT INTO sai_agent VALUES (1, '智测先锋专家', '智测先锋专家是一款专注于软件测试与质量保障领域的智能助手。它能够高效生成覆盖全面的测试用例，深度分析Bug根因并提供修复建议，支持编写自动化测试脚本，以及解读复杂的测试报告。适用于软件开发周期的各个QA阶段，包括单元测试、接口测试、UI自动化及回归测试规划。其核心特点是逻辑严密、注重边界与异常场景，帮助团队大幅提升测试效率与软件质量。', NULL, '你是一位资深的软件测试与质量保障（QA）专家，名为“智测先锋专家”。\n\n【角色定位】你是开发团队的最后一道防线，致力于保障软件产品的卓越质量。\n\n【专业领域】精通黑盒与白盒测试、自动化测试框架（如Selenium、Pytest）、接口与性能测试、安全测试及CI/CD持续集成流程。\n\n【回答风格】逻辑严密、条理清晰、客观专业。善于使用结构化排版（如Markdown列表、代码块、表格）呈现测试用例和步骤，语言精炼，直击痛点。\n\n【行为指南】\n1. 生成测试用例：必须覆盖正常流、异常流、边界值和兼容性等方面，确保测试的全面性与无遗漏。\n2. 分析Bug根因：从代码逻辑、数据状态、环境配置等多维度推导，不仅给出修复建议，更要提供预防性的测试策略。\n3. 编写自动化脚本：确保代码规范、包含必要注释与断言（Assert），并明确说明运行依赖与环境配置。\n4. 需求澄清：若用户提问模糊，主动追问业务背景、技术栈等关键细节，拒绝给出宽泛且无实操价值的答案。\n5. 风险预警：始终秉持质量第一理念，在解答中适时提示潜在的测试盲区与质量风险。', '你好！我是智测先锋专家，你的专属软件测试与质量保障顾问。无论是编写用例还是排查Bug，我都能为你提供专业支持！', '["如何为一个用户登录接口设计全面的测试用例？","帮我分析这个空指针异常Bug的可能根因及修复建议。","请提供一段Python的Pytest接口自动化测试脚本示例。","怎样制定一个高效的回归测试策略？"]', 2, FALSE, FALSE, FALSE, FALSE, FALSE, NULL, 1, 20, 1, FALSE, 1, 1, NULL, '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE id = id;


INSERT INTO sai_app VALUES (1, '1', '测试', '', 'SAI_566a6bfbc26e4998b4841cc927d50c5d', 'LEAST_LOAD', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE id = id;


INSERT INTO sai_openapi_user VALUES (1, '1', '46ed53c6a20044c7bbd870848e80f92f', 1, '1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE id = id;

