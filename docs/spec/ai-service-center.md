# AI 智能服务中心（ai-center）模块规格

> 子平台规格，套用 `docs/spec-standards.md` 三节模板（10 节结构）。
> 需求来源：重写旧 Python 系统 `zhiyu-ai`（仅借鉴业务逻辑，不复用代码），按 2026-02 用户拍板的 9 项决策收敛范围。

## 1. 背景与目标

### 1.1 为什么要做

现有「AI 智能服务平台」（`ai` 模块）只有通用 AI 助手对话与 AI 辅助表单填写，缺少知识沉淀与智能体搭建能力。旧系统 zhiyu-ai（Python/FastAPI 单体）验证过「知识库 + 智能体 + 广场 + 审核上架」的产品形态，现按本仓库 Go + Next.js 技术栈与多租户 SaaS 架构重写。

### 1.2 产品定位

面向租户内全体师生（teacher/student/school_admin）的轻量 AI 服务中心：

- **人人可建**：任何登录用户可创建知识库（上传文档）与智能体（提示词 + 关联知识库）
- **审核上架**：知识库/智能体默认私有，提交审核（school_admin）通过后发布到**租户内广场**
- **第三方挂接**：school_admin 维护第三方智能体/应用的链接卡片，在广场展示

### 1.3 已确认决策（2026-02 与用户逐条确认）

| # | 决策点 | 结论 |
|---|--------|------|
| D1 | 检索方式 | 分块 + PostgreSQL 全文/相似度检索（pg_trgm），召回 TopN 喂 LLM，附引用溯源；不引入向量数据库/embedding |
| D2 | 文档类型 | PDF / DOCX / TXT / Markdown（`.doc` 不支持，提示用户另存为 DOCX；不做 OCR/音视频/URL 抓取） |
| D3 | 权限模型 | 两档 + 审核：私有（创建者+协作者）→ 提交审核 → 发布后租户全员可见；不做组织级/文档级权限 |
| D4 | 智能体形态 | 名称/头像/欢迎语 + 角色提示词 + 关联知识库（多选）+ 自研对话界面；模型统一用租户 AI 配置（复用 AIService） |
| D5 | 对话输出 | 流式 SSE（按 `docs/ai-development.md` §6 扩展 `ai.Client.ChatCompletionStream`） |
| D6 | 第三方挂接 | 纯链接卡片（名称/图标/描述/URL/分类/排序/上下架），新窗口打开 |
| D7 | 审核后台 | school_admin 审核知识库/智能体上架（通过/驳回+理由）并维护第三方挂接；SaaS 超管不参与 |
| D8 | 互动统计 | 使用次数统计（知识库检索次数、智能体对话轮数）+ 收藏（复用通用收藏机制，扩展类型） |
| D9 | 协作共建 | 知识库支持邀请协作者（编辑者/查看者） |

### 1.4 边界与不做

- 广场为**租户内广场**，不跨租户；超管无跨租户读取特权（ADR-0003）
- 不做旧系统数据迁移；不做 Dify/LDAP/SSO 集成（复用现有账号体系与 AIService 底座）
- 不做文档版本管理/回滚（重新上传 = 新文档）；不做文档级权限、协作者链接邀请
- 不做点赞/评分/评论；不做每用户/每智能体独立模型 key 与额度拦截（防滥用沿用按用户限流）
- 收藏不进统一收藏列表页（v1 仅在广场卡片/详情页 toggle 与计数）

## 2. 平台级架构决策

### 2.1 与现有模块的关系

| 维度 | 决策 | 理由（回链决策） |
|------|------|-----------------|
| LLM 调用 | 全部经 `AIService`；新增 `ChatStream` 编排 + `ai.Client.ChatCompletionStream`（SSE 解析 + `http.Flusher` 透传） | D5 + ADR-0002 底座红线 |
| SSE 中间件兼容 | 修复 `middleware/oplog.go` statusRecorder 丢失 `http.Flusher` 的存量缺陷（透传 Flush + Unwrap）——否则所有写方法上的 SSE 端点被操作日志中间件降级为 500 | 实现期发现并修复，跨模块共享缺陷 |
| 检索 | 文档分块存 `ai_kb_chunks`，`pg_trgm` GIN 索引相似度召回，权限过滤在 SQL 层完成 | D1；避免召回后再过滤的越权窗口（安全锚点） |
| 文件存储 | 复用 `FileHandler.UploadDir` 布局（`{tenant}/ai-kb/{kb}/{doc}`），但上传走独立端点（落文档行 + 触发解析） | 复用上传基建，解析需异步流水线 |
| 文档解析 | 纯 Go：PDF 用 `github.com/ledongthuc/pdf`（纯 Go，goproxy 可达）；DOCX 用 archive/zip + encoding/xml 自解析 `document.xml`；TXT/MD 直读 | 运行镜像（alpine）无 LibreOffice，不能依赖外部命令 |
| 审核 | 自建轻量审核（状态字段 + `ai_review_logs` 留痕），**不接入** workflows/approval_records 重审批流 | 审核语义简单（单级通过/驳回），重审批流过度设计 |
| 收藏 | 扩展 `FavoritesStore` 类型 `ai_kb`/`ai_agent`（`user_favorites.target_type` 为 varchar 无枚举约束，无需迁移）；**仅 published 对象可收藏**（FavoriteTargetTenant 对非 published 返回 404，私有内容不暴露存在性） | D8 复用优先 |
| 前端落位 | 扩展现有 `apps/edu/app/portal/apps/ai/`（广场/工坊/对话/后台审核），不动现有 `/chat` 通用助手 | ai 模块已存在于应用中心 |
| 前台主页（落地页） | `/portal/apps/ai/landing` **单页集成前台全部功能**（v1.2，用户拍板"广场/工坊都集成在落地页，不二次跳转"）：LandingShell 骨架 hero + 统计条 → 「我的工坊」区块（#studio，知识库/智能体表格+新建+行内审核操作）→「AI 广场」区块（#square，三 Tab+搜索+排序+收藏）；两区块抽为共享组件 `_components/studio-section.tsx`/`square-section.tsx` 单一事实源。旧路由 `/square`、`/studio` 重定向至本页锚点（#square/#studio 平滑滚动）；侧边栏对齐其他平台惯例只列业务功能（AI 助手/平台管理，无「首页」项——落地页由卡片主入口进入）。对话页、库详情、智能体编辑器保持独立路由（创作/消费全屏页）；门户卡片与 INTERNAL_ROUTES 入口均指向本页 | 与六平台 landing 等地位且更进一步：落地页即工作台，师生一跳内完成创建与管理 |
| v1.3 前台视觉重构 | **对齐 docs/demo 原型（拍板：YIKnow 改造现有 chat 页/字段现有近似不动后端表/工坊留首页/本期只做大厅列表页）**：① 落地页 hero 主推 YIKnow（「立即体验 YIKnow」跳 /chat + 「逛逛 AI 广场」滚动 + 能力版图卡片标注待上线）；② /chat 改造为 YIKnow 对话页（全宽自渲染进 FULL_WIDTH_PAGES，左侧功能轨：智能对话 active，我的方案/岗位库/场景库/知识库/设置占位 toast；对话主区复用 sendAIChat）；③ 广场取消 Tab 三区平铺（智能体/知识库/第三方服务各配专属卡片，卡片族 `_components/hall-cards.tsx`，删 SquareSection）；④ 新大厅页 /hall/agents（搜索+最热/最新+加载更多）、/hall/kbs（统计条+tag chips+综合/最新/最近更新/资源最多排序+加载更多），共享骨架 `_components/hall-shell.tsx`；字段近似=对话数/提问数/创建者姓名，「新上线」徽标=创建≤7天前端推导 | 原型含模型广场/前沿动态/技能大厅/会员/需求收集/视图切换/内嵌详情——明确不做 |
| 菜单权限 | **纳入 menus 权限树，前台合并为单一开关**：权限树 ai 平台组 = 「AI 智能服务中心」(href=`/portal/apps/ai`，由 checkMenuPermission 前缀回溯覆盖助手/广场/工坊/落地页全部前台子路径）+「平台管理」组（内容审核/第三方挂接独立勾选）；`/portal/apps/ai` 挂订阅模块门禁（key=ai）。存量回填：166 授 chat/square/studio → 168 收敛为 `/portal/apps/ai` 一键并清理旧键（teacher/student/有 menus 的 school_admin 默认授予）；后端 `RequireRole(school_admin)` 仍为接口防线（非管理员一律 403） | 用户明确要求：前台都在门户内，一个菜单一起授权；管理功能需单独管控 |

### 2.2 安全锚点（检索越权防线）

召回 SQL 强制过滤：只召回 `kb.status='published'` 或「请求者是 owner」或「请求者是协作者」的知识库分块。**智能体发布与否不改变该规则**——即使已发布智能体关联了创建者的私有库，其他用户对话时也不会召回私有库内容（提交发布时前端/后端双重提示该限制）。

## 3. 核心流程（用户故事 + 时序）

### 3.1 用户故事

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| KB-1 | 作为 teacher/student，我希望创建知识库并上传 PDF/DOCX/TXT/MD 文档，以便沉淀可问答的知识 | 创建即私有；上传后异步解析（parsing→ready/failed），failed 带原因可删除重传；文档解析完成后参与检索 |
| KB-2 | 作为知识库所有者，我希望邀请同租户用户为协作者（编辑者/查看者），以便团队共建 | 编辑者可上传/删除文档；查看者仅查看与问答；协作者管理仅 owner |
| KB-3 | 作为所有者，我希望提交知识库上架审核，通过后出现在广场 | private→pending→published/rejected；驳回带理由；可重新提交；published 可下架回 private |
| KB-4 | 作为登录用户，我希望在广场浏览/搜索已发布知识库，进入详情查看文档目录并进行库内问答 | 广场仅 published；问答走 SSE 流式；回答附来源文档+片段 |
| AG-1 | 作为 teacher/student，我希望单页表单配置智能体（名称/头像/描述/开场白/角色提示词/关联知识库）并预览测试，以便低门槛搭建 | 关联范围=本人 owned/collaborating/published 的库；预览仅创建者可用（编辑器「预览对话」按钮任意状态可进对话页，后端 AgentChat 放行 owner） |
| AG-2 | 作为所有者，我希望提交智能体上架审核，通过后其他用户可在广场使用 | 状态机同 KB；发布时若关联私有库给出「私有库内容对他人不可见」提示 |
| AG-3 | 作为登录用户，我希望与已发布智能体流式对话，看到引用来源，并保留历史会话 | SSE delta/sources/done 事件；会话与消息落库；上下文记忆最近 5 轮 |
| AD-1 | 作为 school_admin，我希望审核知识库/智能体上架申请（通过/驳回+理由），以便管控广场内容 | 待审列表；动作写 `ai_review_logs`；可对已发布内容强制下架 |
| AD-2 | 作为 school_admin，我希望维护第三方智能体/应用链接卡片，以便丰富广场生态 | CRUD + 上下架 + 排序；kind=agent/app 分区展示 |
| ST-1 | 作为用户，我希望收藏知识库/智能体并看到使用热度，以便找到优质内容 | 收藏 toggle + 计数；知识库检索次数、智能体对话轮数在广场卡片展示 |

### 3.2 核心时序：智能体流式对话（含检索）

```
用户 → POST /ai/agents/{id}/chat {conversationId?, message}
  → handler：鉴权 + 租户归属 + 智能体可见性（published 或 owner）+ 护栏（message ≤2000 字，上下文 ≤5 轮）
  → service.AgentChat：
      1. 加载智能体 + 关联知识库
      2. 召回：ai_kb_chunks ⋈ 可见性过滤（published/owner/collaborator），pg_trgm 相似度 Top6
      3. 装配 messages：system_prompt + 「资料」段（【资料N】《文档名》片段）+ 近 5 轮历史 + 用户消息
      4. AIService.ChatStream → ai.Client.ChatCompletionStream（stream_options.include_usage）
  → SSE 事件流：meta(conversationId,messageId) → sources(召回片段) → delta×N → done(messageId)；usage 由 recordUsage 内部落库、不下发 
    失败路径：开始前校验失败直接 HTTP 错误码（412 ai_not_configured/403/404）；流中途失败发 error 事件
  → 落库：ai_messages(user+assistant 两条，assistant 带 sources jsonb)；agent.chat_count+1；涉及库 ask_count+1（best-effort）
```

### 3.3 核心时序：文档上传解析

```
POST /ai/kb/{id}/documents（multipart，≤10MB，uploadLimiter）
  → 校验扩展名白名单（.pdf/.docx/.txt/.md）+ 权限（owner/editor）
  → 文件落 UploadDir/{tenant}/ai-kb/{kb}/{uuid}{ext}（uuid 改名防路径穿越/泄露原名），插文档行 status=parsing
  → 后台 goroutine（5min timeout + panic recover + 状态守卫防重入）：
      提取文本（PDF: ledongthuc/pdf；DOCX: zip+XML；TXT/MD: 直读）→ 空文本/解析异常 → failed+原因
      → 分块（按段落聚合 ~500 字，重叠 50 字）→ 批量插 ai_kb_chunks → ready + chunk_count
```

## 4. 数据模型

> 全部表带 `tenant_id`（行级隔离）；物理删除（同本仓库内容实体惯例）。migration：164（pg_trgm + 10 表）。

### 4.1 `ai_knowledge_bases` — 知识库

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| tenant_id | uuid NOT NULL → tenants | 租户隔离 |
| owner_id | uuid NOT NULL → users | 创建者/所有者 |
| name | varchar(200) NOT NULL | 租户内不强制唯一（广场搜索用） |
| description | text DEFAULT '' | |
| tags | jsonb DEFAULT '[]' | 字符串数组，广场分类筛选 |
| status | varchar(16) NOT NULL DEFAULT 'private' | private/pending/published/rejected（CHECK） |
| review_comment | text DEFAULT '' | 最近一次审核意见 |
| reviewed_by / reviewed_at | uuid / timestamptz | 最近审核人与时间 |
| doc_count | int NOT NULL DEFAULT 0 | ready 文档数（冗余展示用） |
| ask_count | bigint NOT NULL DEFAULT 0 | 检索次数（D8） |
| created_at / updated_at | timestamptz | |

### 4.2 `ai_kb_documents` — 知识库文档

| 字段 | 类型 | 说明 |
|------|------|------|
| id / tenant_id / kb_id | uuid | kb_id → ai_knowledge_bases ON DELETE CASCADE |
| uploader_id | uuid → users | 上传者（协作者可上传） |
| name | varchar(255) NOT NULL | 原始文件名 |
| file_path | text NOT NULL | UploadDir 相对路径 |
| file_size | bigint NOT NULL | |
| mime | varchar(100) | |
| status | varchar(16) NOT NULL DEFAULT 'parsing' | parsing/ready/failed（CHECK） |
| error | text DEFAULT '' | 解析失败原因（如「文件加密」「空内容」「.doc 不支持」） |
| chunk_count | int NOT NULL DEFAULT 0 | |
| char_count | int NOT NULL DEFAULT 0 | |
| created_at | timestamptz | |

### 4.3 `ai_kb_chunks` — 文档分块（检索单元）

| 字段 | 类型 | 说明 |
|------|------|------|
| id / tenant_id | uuid | |
| doc_id | uuid NOT NULL → ai_kb_documents ON DELETE CASCADE | |
| kb_id | uuid NOT NULL（冗余） | 召回免 JOIN 文档表；随 doc 级联由 doc 删除触发 |
| seq | int NOT NULL | 文档内序号（溯源「第 N 段」） |
| content | text NOT NULL | 分块正文 |
| 索引 | | `GIN (content gin_trgm_ops)`（pg_trgm）；`btree (kb_id)`、`btree (tenant_id)` |

### 4.4 `ai_kb_collaborators` — 知识库协作者

| 字段 | 类型 | 说明 |
|------|------|------|
| id / tenant_id / kb_id | uuid | kb 级联删除 |
| user_id | uuid NOT NULL → users | 同租户校验在 service 层 |
| role | varchar(16) NOT NULL | editor/viewer（CHECK） |
| created_at | timestamptz | |
| 约束 | | UNIQUE(kb_id, user_id) |

### 4.5 `ai_agents` — 自建智能体

| 字段 | 类型 | 说明 |
|------|------|------|
| id / tenant_id / owner_id | uuid | 同知识库 |
| name | varchar(100) NOT NULL | |
| avatar | varchar(500) DEFAULT '' | emoji 或上传图片路径（v1 用 emoji 选择器） |
| description | text DEFAULT '' | 一句话描述（广场卡片） |
| greeting | text DEFAULT '' | 欢迎语 |
| system_prompt | text NOT NULL | 角色设定+回答规则（≤4000 字） |
| status / review_comment / reviewed_by / reviewed_at | 同 4.1 | 同一状态机 |
| chat_count | bigint NOT NULL DEFAULT 0 | 对话轮数（D8） |
| created_at / updated_at | timestamptz | |

### 4.6 `ai_agent_kbs` — 智能体关联知识库

`(agent_id, kb_id)` 复合唯一 + tenant_id；agent 删除级联。关联校验：agent owner 对该库须为 owner/collaborator 或库已发布。

### 4.7 `ai_conversations` / `ai_messages` — 会话与消息

- `ai_conversations`：id/tenant_id/agent_id/user_id/title(首条消息截 30 字)/created_at/updated_at；UNIQUE 无（每用户每智能体可多会话）
- `ai_messages`：id/tenant_id/conversation_id(级联)/role(user|assistant CHECK)/content text/sources jsonb DEFAULT '[]'/created_at；索引 `(conversation_id, created_at)`

### 4.8 `ai_integrations` — 第三方挂接

| 字段 | 说明 |
|------|------|
| id / tenant_id | |
| kind | varchar(16) CHECK agent/app |
| name / description / url | varchar(200)/text/varchar(500)；url 仅 http/https（XSS 防线） |
| icon | varchar(500) DEFAULT ''（emoji） |
| category | varchar(50) DEFAULT '' |
| sort | int DEFAULT 0 |
| status | varchar(16) DEFAULT 'active'（active/inactive） |
| created_by / created_at / updated_at | |

### 4.9 `ai_review_logs` — 审核留痕

id/tenant_id/target_type(kb|agent)/target_id/action(submit|approve|reject|unpublish|takedown)/actor_id/comment text/created_at；索引 `(tenant_id, target_type, target_id)`。

### 4.10 既有表扩展

- `user_favorites`：target_type 新增 `ai_kb`/`ai_agent`（代码层注册，无 DDL）
- 菜单：AI 中心页面不进入 `buildMenuTree()` 权限树（默认可见）；无 menus 回填迁移

## 5. API 契约

> 全部挂在 portal 平台组（`RequirePlatform(portal)`），路径前缀 `/ai/*`。列表统一 `{items, total}` + page/pageSize；错误映射沿用 4.4 状态码表（412 `ai_not_configured`、502 上游）。

### 5.1 知识库（任意登录用户；写操作 owner/editor 细分）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai/kb?scope=owned\|collaborating\|all&q=` | 我的知识库（默认 all=owned+collaborating） |

> 输入护栏（service 层统一归一/拒绝）：tags ≤10 个且单个 ≤30 字；知识库名 ≤200 字、知识库描述 ≤2000 字、智能体名 ≤100 字、智能体描述/开场白 ≤500 字、system_prompt ≤4000 字（超长 400）；协作者角色仅 editor/viewer；owner 不能被加为协作者。
| POST | `/ai/kb`（body 含 coverImage 可选） | 创建 `{name, description, tags[]}` → 私有 |
| GET | `/ai/kb/{id}` | 详情 + 我的角色（owner/editor/viewer/member）；收藏态另经通用收藏 `GET /favorites/ai_kb/{id}` 查询 |
| PUT | `/ai/kb/{id}`（body 含 coverImage 可选） | 编辑信息（owner） |
| DELETE | `/ai/kb/{id}` | 删除（owner；仅 private/rejected；级联文档与分块、删文件） |
| POST | `/ai/kb/{id}/submit` | 提交上架审核（private/rejected→pending） |
| POST | `/ai/kb/{id}/unpublish` | 下架（published→private，owner） |
| GET | `/ai/kb/{id}/documents` | 文档列表（可见者） |
| POST | `/ai/kb/{id}/documents` | multipart 上传（owner/editor；字段 `file`；≤10MB；扩展名白名单） |
| GET | `/ai/kb/{id}/documents/{docId}` | 单文档（状态轮询） |
| DELETE | `/ai/kb/{id}/documents/{docId}` | 删除文档（owner/editor） |
| GET | `/ai/kb/{id}/collaborators` | 协作者列表（含姓名，JOIN users） |
| POST | `/ai/kb/{id}/collaborators` | 邀请 `{user_id, role}`（owner；同租户校验） |
| PUT | `/ai/kb/{id}/collaborators/{userId}` | 改角色（owner） |
| DELETE | `/ai/kb/{id}/collaborators/{userId}` | 移除（owner） |
| POST | `/ai/kb/{id}/ask` | 库内问答/效果预览（SSE；`{message}` ≤2000 字；可见者） |

### 5.2 智能体与对话

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai/agents` | 我的智能体 |
| POST | `/ai/agents`（body 含 coverImage 可选） | 创建 `{name, avatar, description, greeting, system_prompt, kb_ids[]}` |
| GET | `/ai/agents/{id}` | 详情 + 关联库（published 或 owner 可见）；收藏态另经 `GET /favorites/ai_agent/{id}` 查询 |
| PUT | `/ai/agents/{id}`（body 含 coverImage 可选） | 编辑（owner；published 编辑不自动下架，状态不变） |
| DELETE | `/ai/agents/{id}` | 删除（owner；仅 private/rejected） |
| POST | `/ai/agents/{id}/submit` | 提交审核（关联私有库时**响应体**带 `warnings[]` 提示，不阻断） |
| POST | `/ai/agents/{id}/unpublish` | 下架（owner） |
| POST | `/ai/agents/{id}/chat` | 流式对话（SSE；`{conversationId?, message}`；published 或 owner） |
| GET | `/ai/agents/{id}/conversations` | 我在该智能体下的会话列表 |
| GET | `/ai/conversations/{id}` | 会话消息列表（仅本人） |
| DELETE | `/ai/conversations/{id}` | 删除会话（仅本人） |

### 5.3 广场与挂接展示

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai/square/kbs?q=&tag=&sort=hot\|new\|updated\|docs&page=&pageSize=` | 已发布知识库（hot=ask_count；updated=updated_at；docs=doc_count——知识库大厅排序扩展，未知值回落 created_at） |
| GET | `/ai/square/agents?q=&sort=hot\|new&page=&pageSize=` | 已发布智能体（hot=chat_count） |
| GET | `/ai/integrations?kind=` | active 挂接卡片（按 sort） |

### 5.4 管理端（`RequireRole(school_admin)`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ai/admin/reviews?type=kb\|agent&status=pending\|published\|rejected` | 审核列表（含提交人姓名） |
| POST | `/ai/admin/reviews/{type}/{id}/approve` | 通过 → published |
| POST | `/ai/admin/reviews/{type}/{id}/reject` | 驳回 `{comment}` 必填 → rejected |
| POST | `/ai/admin/reviews/{type}/{id}/takedown` | 强制下架 published→private `{comment}` |
| GET/POST | `/ai/admin/integrations` | 挂接列表（含 inactive）/ 创建 |
| PUT/DELETE | `/ai/admin/integrations/{id}` | 编辑 / 删除 |
| POST | `/ai/admin/integrations/{id}/toggle` | 上下架切换 |
| GET | `/ai/admin/overview` | 简统计：库数/智能体数/待审数/已发布数 |

### 5.5 代表性接口详写：`POST /ai/agents/{id}/chat`（SSE）

- 请求：`{conversationId?: string, message: string(1..2000)}`；`aiLimiter` 按用户限流（20/min）
- 响应 `Content-Type: text/event-stream`；事件：
  - `meta`：`{conversationId, messageId}`（首事件；字段统一 camelCase）
  - `sources`：`[{docId, docName, seq, snippet}]`（无召回时跳过）
  - `delta`：`{text}` 多次
  - `done`：对话 `{messageId}`（assistant 消息落库 id）；库内问答 `{answer}`（全文，便于前端一次性渲染兜底）；usage 由 AIService.recordUsage 内部落库，不下发
  - `error`：`{code, message}`（流中途失败；开始前失败直接 HTTP 4xx/5xx JSON）
- 无召回时照常回答并在系统提示中要求声明「知识库中未找到相关资料」

### 5.6 鉴权矩阵

| 端点组 | 中间件 | 业务校验 |
|--------|--------|---------|
| `/ai/kb*` `/ai/agents*` `/ai/square*` `/ai/integrations` `/ai/conversations*` | portal 平台组（任意登录角色） | handler 内租户归属 + 资源可见性（§2.2） |
| `/ai/kb/{id}/documents`（写）、`/ai/kb/{id}`（PUT/DELETE） | 同上 | owner/editor / owner |
| `/ai/admin/*` | `RequireRole(school_admin)` | `verifyTenantOwnership` |

## 6. 后端开发计划（WBS）

| # | 任务 | 依赖 |
|---|------|------|
| B1 | 迁移 164：pg_trgm + 10 表 + down 配对；04 §5 登记 | — |
| B2 | ~~menus 回填迁移~~（已取消：不进权限树，默认可见，见 §2.1） | — |
| B3 | `ai.Client.ChatCompletionStream`（SSE 解析 + include_usage）+ 单测 | — [P] |
| B4 | domain + store：`ai_center_store.go`（库/文档/分块/协作者/智能体/会话/挂接/审核日志 CRUD，全部 tenant 过滤） | B1 |
| B5 | service：`ai_center_kb.go`（库 CRUD/状态机/协作者/收藏集成）；`ai_center_doc.go`（上传+异步解析+分块，goroutine 超时+recover+状态守卫） | B4 |
| B6 | service：`ai_center_retrieval.go`（pg_trgm 召回 + 可见性过滤 + 提示词装配纯函数） | B4 |
| B7 | service：`ai_center_agent.go`（智能体 CRUD/状态机/对话编排 ChatStream/落库/计数） | B3、B6 |
| B8 | handler：`ai_center_handler.go` + `routes_ai_center.go`（5.1-5.4 全端点、SSE 透传、错误映射） | B5、B7 |
| B9 | 收藏类型扩展（ai_kb/ai_agent + FavoriteTargetTenant） | B1 [P] |
| B10 | 测试：handler 测试（可见性/越权矩阵）、解析+分块+提示词纯函数单测、召回 SQL store 测试 | B8 |

## 7. 前端开发计划（WBS）

> 均在 `apps/edu/app/portal/apps/ai/`；API 走 `packages/api-client/src/api/ai-center.ts`；SSE 用 fetch + ReadableStream（portalRequest 不支持流式，自封装带 token）。

| # | 任务 | 依赖 |
|---|------|------|
| F1 | api-client 封装（SSE 客户端统一为 `streamAICenter(path, body, callbacks, signal)`，chat/ask 共用，AbortSignal 取消） | B8 |
| F2 | 广场区块 `_components/square-section.tsx`（三 Tab：智能体/知识库/应用；卡片=图标/名称/描述/热度/收藏；v1.2 起嵌入落地页 #square，/square 路由重定向） | F1 [P] |
| F3 | 工坊区块 `_components/studio-section.tsx`（我的知识库/我的智能体 + 新建入口、状态徽标、提交/下架；v1.2 起嵌入落地页 #studio，/studio 路由重定向） | F1 [P] |
| F4 | 知识库管理 `studio/kb/[id]/page.tsx`（文档上传/解析状态轮询/删除；协作者管理；编辑+提交审核） | F1 |
| F5 | 智能体编辑 `studio/agents/new` + `studio/agents/[id]/page.tsx`（单页表单 AgentForm + 关联库多选 ≤5 + 「预览对话」入口走 agents/[id] 对话页） | F1 |
| F6 | 知识库详情 `kb/[id]/page.tsx`（文档目录 + 库内问答面板 SSE + 溯源展示） | F1 [P] |
| F7 | 智能体对话 `agents/[id]/page.tsx`（会话列表 + SSE 对话 + 来源卡片 + 收藏） | F1 |
| F8 | 管理端 `admin/reviews/page.tsx`（待审列表、通过/驳回+理由、强制下架）+ `admin/integrations/page.tsx`（挂接 CRUD/上下架/排序） | F1 [P] |
| F9 | 应用中心 ai 模块入口卡片挂载 + menus 权限路径接入 + i18n 文案 | F2-F8 |
| F10 | 412 引导复用 `AiNotConfiguredDialog`；空态/加载/错误态 | F2-F8 [P] |

## 8. 部署与验证

- 质量门禁：`go vet/build/gofmt` + `pnpm typecheck/lint/test` + `spec_check`（分层/AI 底座/migration 配对/schema↔migration）
- 验收 flow（`docs/spec/06-acceptance-flows.md` 新增）：
  1. 学生建库传文档 → 解析 ready → 库内问答有溯源
  2. 教师建智能体关联该库 → 提交审核 → school_admin 通过 → 广场可见 → 学生对话 SSE 出源流式回答
  3. 私有库泄露防线：他人对话该智能体时召回不到创建者私有库内容
  4. school_admin 挂接第三方应用 → 广场应用区可见可点
- `deploy.sh --branch` 部署后跑 `--flows`

## 9. 实施顺序与风险

### 9.1 实施顺序

B1/B2/B3（基建，部分并行）→ B4 → B5/B6 → B7 → B8 → B9/B10 → F1 → F2-F10 → spec_check → spec_analyze → 部署。

### 9.2 风险点

| 风险 | 缓解 |
|------|------|
| pg_trgm 中文召回质量不稳（整句相似度低） | 查询预处理：按标点切分取 Top3 子句（4~32 字）分别召回取并集，按 max(similarity) 排序；similarity 阈值 0.05、**无 ILIKE 兜底**（整串 ILIKE 误召回率高，宁缺毋滥）；召回为空走「未找到资料」话术（实现口径，原 0.08+ILIKE 方案在联调中弃用） |
| PDF 解析质量参差（扫描件无文本层） | 空文本 → failed「可能为扫描件，暂不支持 OCR」（D2 边界明示） |
| SSE 中途上游失败 | 已输出内容保留 + error 事件；不落残缺 assistant 消息（或落库标记 truncated——v1 不落残缺） |
| 新 Go 依赖（ledongthuc/pdf）vendor 同步 | go mod vendor 提交；goproxy.cn 已验证可达 |
| 大文档分块数量爆炸 | 单文档文本截断 200k 字符；chunks 上限 800；上传 ≤10MB（沿用安全规范） |
| 已发布智能体编辑后内容漂移 | v1 允许 published 直接编辑（同内容状态机 published 可编辑惯例），管理员可 takedown 兜底 |

## 10. 扩展性预留（暂不做）

- embedding/向量检索升级（pgvector 或外部向量库）；`ai_kb_chunks` 预留 `embedding` 列空间不在本期建
- 文档级权限、组织级可见范围、协作者链接邀请、文档版本管理
- Excel/PPT/图片 OCR/音视频/URL 抓取解析
- 每智能体模型选择与开放模型列表；每用户额度配额
- 智能体发布到「指定人群」、官方智能体（Dify 编排）形态
- 互动评论/评分、创建者数据看板、统一收藏列表页纳入 ai_kb/ai_agent

## 11. 复查收敛记录（v1 交付时）

- **菜单权限接入（v1.1）**：初版「不进权限树、后端 403 兜底」按用户反馈反转——AI 中心已纳入权限树（§2.1），侧边栏/权限门经 `apps/ai/layout.tsx` 落地，存量回填见迁移 166。
- **前台落地页（v1.1 补齐）**：初版未做 landing 页，按用户反馈补齐落地页并纳入权限树；v1.2 按「单一菜单开关」反馈将路径并入 `/portal/apps/ai/landing`（layout 全宽直出，同 alliance FULL_WIDTH_PAGES 模式），见 §2.1。
- **前台单页集成（v1.2）**：按用户拍板（广场/工坊都集成在落地页、不二次跳转、长页面上下分区、智能体表单保留跳编辑器页），落地页成为前台唯一主页；/square、/studio 旧路由重定向至落地页锚点，验收 flow 的 goto 目标经重定向仍有效（区块组件原样渲染，clickRow/click 定位不变）。
- **侧边栏无「首页」项（v1.2 修正）**：落地页集成后曾加「首页」侧边栏项，按用户反馈对齐其他平台惯例移除（平台侧边栏只列业务功能，落地页走卡片主入口 + 返回应用中心按钮）。
- **菜单单一开关（v1.2）**：初版权限树为 chat/square/studio/landing 四节点 + 管理组，按用户反馈收敛为 `/portal/apps/ai` 一个开关联动全部前台页面（迁移 168 收敛存量授权键）；管理组两项保持独立勾选。门户首页 INTERNAL_ROUTES 与卡片 href 统一指向落地页。
- **v2.0 落地页视觉重构**（对标 evaluation/landing 设计语言，用户确认三选：环图+卡片混排/各自白色面板/要底部行动卡）：① 工坊改大面板——图标头部 + 双胶囊 CTA + 左侧状态环图（recharts，我的知识库+智能体按状态聚合，纯前端不加接口）+ 右侧分组卡片（知识库/共享给我的/我的智能体），取消 Tabs；② 广场三板块各自白色面板（图标头 + 竖条标题 + 数量 + 查看更多）；③ 新增底部渐变行动卡（「把你的知识变成全校可用的 AI 服务」→ 滚动回工坊）；④ hero 右侧改聊天气泡预览卡 + 预留能力 chips；⑤ 二级页：hall 渐变页头（负边距出血）+ 筛选面板化、chat 空态建议问题 chips（点击直发）、kb 详情横幅加高 h-32；⑥ flow 删 3 处「click: 我的智能体」（无 Tab 了）。
- **v1.4 封面字段 + 工坊卡片化**：知识库/智能体新增 `cover_image` 字段（迁移 169，TEXT 空串=前端渐变兜底），贯通 domain/store/service（含 ListAgentKBs 手写列清单同步）；前端表单复用通用 `CoverImageUpload`+`fileApi.upload`（≤5MB，知识库新建对话框/智能体表单）。工坊从表格改为考试中心式卡片网格（封面横幅+右上角状态徽标+统计行+操作按钮，卡片带 `data-smoke-card`）；广场/大厅卡片族同步封面横幅化（无封面用 `coverGradientFor` 渐变+图标）；KB 详情页加封面横幅、智能体对话页有封面时顶部加横幅。巡检 DSL 新增 `clickCard` 动作（data-smoke-card 定位），工坊相关 flow 步骤由 clickRow 迁移。
- **v1.3.1 前后台严格分离**：前台浏览页一律全宽直出（无平台侧边栏）——FULL_WIDTH_PAGES 扩为 landing / chat(YIKnow) / hall/* / agents/[id] / kb/[id]；后台管理页（studio 工坊管理、admin 审核/集成）保留侧边栏。全宽页自带页面留白，对话详情页视口高度按仅顶栏重算（100vh-3.5rem）。
- **v1.3 前台视觉重构**（demo 原型对齐）：hero 主推 YIKnow + chat 改造 YIKnow 对话页 + 广场三区平铺（hall-cards 卡片族）+ hall/agents、hall/kbs 大厅页（hall-shell 骨架）+ KB 排序扩展 updated|docs（store 白名单，无注入面）；flow ai-kb-publish-loop 学生步去 Tab 点击。回归测试：TestAICenter_KBLifecycleAndVisibility 补 sort=docs/updated 断言。
- **动态路由参数事故（v1.2 修复）**：`studio/kb/[id]` 与 `studio/agents/[id]` 两页误用 Next 15+ 已废弃的同步 `params` 解构（`params.id` 读 Promise → undefined → 请求 `/ai/kb/undefined` 500，用户感知为「创建失败」）；同仓库 `useParams()` 正确写法已在 kb 详情/对话页使用，属实现不一致漏检。修复：两页改 `useParams()`；全仓审计无其他同步 params 页面；后端纵深防御 `aiCenterError` 将 PG 22P02（非法 UUID）映射 400 不再透 500。回归覆盖：后端 `TestAICenter_InvalidUUIDReturns400`（5 端点）；验收 flow 两条 AI 闭环补「进入库管理页/编辑器」断言步骤；巡检器新增 pageerror 哨兵（06 §1）。
- **空列表序列化（v1.1 修复）**：Go nil slice 会序列化为 `"items": null` 导致前端 `items.length` 崩溃（studio 页白屏事故根因）；store 层 14 处列表查询统一 `make([]T, 0)`，智能体 KbIDs/KbNames 同样非 nil 保证，回归测试 `TestAICenter_EmptyListsReturnEmptyArray` 覆盖 9 个列表端点。
- **广场卡片收藏态**：每张卡片挂载时 `GET /favorites/{type}/{id}`（N 卡 N 请求）。列表接口返回 isFavorite/favoriteCount 的批量方案留作性能优化项（当前广场数据量小，可接受）。
- **done 事件 usage 不下发**：token 用量由 `recordUsage` 落库（ai_usage_logs），前端不展示逐次用量；如需前端展示再扩展 done 载荷。
- **私有智能体预览**：AG-1 的「预览仅创建者可用」以编辑器「预览对话」按钮落地（任意状态可进对话页，后端放行 owner）。
- 后端遗留修复已闭环：oplog statusRecorder 透传 Flusher（存量缺陷）；>5 关联库 400 哨兵；协作者 PUT 走路径 userId；ListConversations 可见性防探测；ILIKE 通配符转义（ESCAPE '\'）；editor 可编辑知识库（KB-2 共建语义）。
