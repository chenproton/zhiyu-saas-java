# base-dev-framework6-java AI 智能开发助手 — 使用指南

> 适用对象：在本项目（base-dev-framework6-java）上做开发的工程师。
> 本指南告诉你「装了什么、怎么用、典型场景怎么跑」。

---

## 这是什么

这是**base-dev-framework6-java** 定制的一套**双系统 AI 开发辅助体系**——同一套规范同时供 **Claude Code**（读 `.claude/`）与 **Codex**（读 `.codex/` + `AGENTS.md`）使用。

它包含：

- **43 个技能**（`.claude/skills/`，Codex 端镜像在 `.codex/skills/`）：把 框架的每一类开发场景（CRUD、安全、缓存、工作流、AI、ES、MQTT……）沉淀成可被 AI 自动激活的 SKILL.md。
- **6 个快捷命令**（`.claude/commands/`）：`/dev` `/crud` `/check` `/progress` `/next` `/start`。
- **Hooks（强制技能评估 + 经验闭环）**：每次提问由 `UserPromptSubmit` Hook 注入「强制技能评估」流程；会话沉淀写入 `.claude/docs/experience/`，下次自动加载。
- **内置资产**：本仓库内置 `.claude/agents/`（6 个后端 subagent：crud / query-permission / module-enhancement / common-infrastructure / engineering / javadoc）。agents 是后端专项子代理，与本套技能体系互补。

> 🔴 **一句话定位铁律**：本项目 base-dev-framework6-java 遵循框架约定。包名 `org.dromara.*`、**三层架构无 DAO 层**、Entity 继承 `BaseEntity`、查询用 `QueryBuilder.lambda`、标准 REST 路径。**不要**套用 `plus.ruoyi` / DAO 层 / `PlusLambdaQuery` / `/pageXxx` / `A*` 组件等其它衍生版写法（详见 FAQ）。

---

## 快速开始

### 1. 环境准备

| 组件 | 版本 | 说明 |
|------|------|------|
| JDK | **Java 21** | Spring Boot 4 / Jakarta EE 10 强制要求，低版本起不来 |
| Maven | 3.8+ | 或用仓库自带 `mvnw` |
| MySQL | 8.x | 建库导入 `backend/java/script/sql` 下的初始化脚本 |
| Redis | 5+ | 缓存 / 会话 / 限流依赖，必须先起 |

> 详细装环境、首次启动、排查启动失败：在 Claude Code 里说「帮我把项目跑起来」会激活 **dev-startup** 技能，或直接用 **/start** 命令。

### 2. 启动 AI 助手

- **用 Claude Code**：在本仓库根目录打开 Claude Code，它会自动读取 `.claude/`（技能 + 命令 + Hooks）。
- **用 Codex**：在本仓库根目录打开 Codex，它读取 `.codex/` + 根目录 `AGENTS.md`（= CLAUDE.md 内容 + 技能清单）。

两端规范完全一致，体验对称。

### 3. 第一个任务示例（完整演示）

你输入：

```
帮我在 system 模块加一个公告管理 CRUD，需要分页、按标题查询、导出 Excel
```

发生了什么：

1. **Hook 强制技能评估** — `UserPromptSubmit` Hook 注入技能评估提示，AI 先列出匹配的技能（如 `crud-development`、`database-ops`、`log-audit`）及理由。
2. **激活技能** — AI 调用 `Skill(crud-development)`、`Skill(database-ops)` 读取分场景规范。
3. **按 框架约定出代码** — 生成：
   - 包名 `org.dromara.system.*`；
   - 三层 `Controller → IService + ServiceImpl → Mapper(extends BaseMapperPlus<Notice, NoticeVo>)`，**无 DAO 层**；
   - `Notice extends BaseEntity`，`NoticeBo`/`NoticeVo` 用 `@AutoMapper`；
   - 查询在 Service 层用 `QueryBuilder.lambda(...).likeIfText(...)`，分页 `selectVoPage` + `PageResult.build`；
   - 标准 REST 路径 `GET /list`、`GET /export`、`GET /{id}`、`POST`、`PUT`、`DELETE /{ids}`；
   - 写接口带 `@SaCheckPermission("system:notice:xxx")` + `@Log(...)`。

---

## 技能一览（43 个）

> 按工厂 4 层复用模型分组。每个技能在对话中**由触发词自动激活**，你也可以直接说「用 xxx 技能」。

### L1 方法论 / 通用（11 个）

| 技能名 | 用途 | 示例指令 |
|--------|------|---------|
| `brainstorm` | 头脑风暴、方案探索、架构讨论 | 「这个功能有哪些实现方式」 |
| `task-tracker` | 跨会话开发任务进度跟踪（Markdown 台账，中断可恢复） | 「创建一个任务跟踪这次重构」 |
| `writing-plans` | 把已定方案拆成带文件路径/验证命令的可执行计划 | 「把这个需求拆成实施计划」 |
| `git-workflow` | Git 提交 / 分支 / 合并 / 回滚 / 解决冲突 | 「帮我提交并写规范的 commit」 |
| `tech-decision` | 技术选型、方案对比、选 ruoyi-common 模块 | 「缓存用 Redis 还是本地」 |
| `bug-detective` | 排查已发生的报错、定位 Bug 根因 | 「这个接口报 500 为什么」 |
| `code-patterns` | 6.x 全栈编码禁令与规范速查（错误 vs 正确对照） | 「这样写符合 框架约定吗」 |
| `collaborating-with-codex` | 委托 Codex 做算法 / 复杂后端逻辑 / 代码审查 | 「让 codex 审查这段算法」 |
| `collaborating-with-gemini` | 委托 Gemini 做前端原型 / UI / CSS | 「让 gemini 设计这个页面」 |
| `add-skill` | 为框架增加 / 修改 / 删除技能并同步双系统 | 「给框架加一个 xxx 技能」 |
| `exp-sediment` | 经验沉淀 / 查历史踩坑（对应 `/exp`） | 「把这次的坑记下来」 |

### L2 后端规范（15 个）

| 技能名 | 用途 | 示例指令 |
|--------|------|---------|
| `crud-development` | CRUD 业务模块全栈开发（后端四件套 + 前端 api.ts/types.ts） | 「新建一个优惠券模块」 |
| `api-development` | REST 接口设计、URL/方法、R\<T\> 统一响应、前后端命名联动 | 「这个接口路径怎么设计」 |
| `database-ops` | 建表 / 改表 / DDL、MyBatis-Plus 查询、字典菜单、多数据源、SQL 日志 | 「设计一张设备台账表」 |
| `project-navigator` | 项目结构导航、定位「某类东西放哪个模块」 | 「OssClient 在哪个模块」 |
| `error-handler` | 设计异常处理机制：ServiceException、全局异常、错误码、日志规范 | 「设计这个模块的错误码」 |
| `performance-doctor` | 性能诊断：SQL 日志、慢查询、N+1、深分页、连接池 | 「这个列表接口很慢」 |
| `json-serialization` | JSON 序列化 / 反序列化、大数字精度、日期、JsonUtils（Jackson 3） | 「Long 传到前端精度丢失」 |
| `test-development` | 单元 / 集成 / Controller 测试（JUnit5 + Mockito + AssertJ） | 「给这个 Service 写单测」 |
| `dev-startup` | 本地从零搭后端环境、首次启动、排查启动失败 | 「项目跑不起来怎么办」 |
| `env-config` | 多环境 profile（application-dev/prod.yml）、环境变量、密钥外置 | 「生产环境配置在哪改」 |
| `deployment-guide` | 打包可执行 JAR、Docker/Compose、Nginx、三个外置 server 部署 | 「怎么用 docker 部署」 |
| `log-audit` | 操作日志 / 登录日志 / 审计：`@Log`、BusinessType、参数脱敏 | 「给这个接口加操作日志」 |
| `i18n-development` | 后端国际化：MessageUtils、messages.properties、LocaleResolver | 「接口提示语要支持英文」 |
| `utils-toolkit` | 后端工具类速查：DateUtils / StreamUtils / MapstructUtils / TreeBuildUtils | 「日期格式化用哪个工具」 |
| `backend-annotations` | 后端高级注解总索引，重点 `@Translation`（ID→名称、字典→标签） | 「把 userId 转成用户名显示」 |

### L3 深度定制（10 个）

| 技能名 | 用途 | 示例指令 |
|--------|------|---------|
| `architecture-design` | 系统架构、模块划分、ruoyi-api 契约层、跨模块解耦 | 「新模块放哪、怎么不耦合」 |
| `security-guard` | Sa-Token 认证授权、字段/接口加解密、限流、防重、XSS/SQL 注入防护 | 「这个接口要登录+权限」 |
| `redis-cache` | Redis 缓存、Spring Cache 注解、Redisson/Lock4j 分布式锁、限流 | 「给这个查询加缓存」 |
| `scheduled-jobs` | SnailJob 分布式调度、`@Scheduled`、Redisson 延时队列选型 | 「下单 30 分钟未支付自动取消」 |
| `realtime-push` | 统一实时推送 PushHelper（SSE/WebSocket 双传输、集群广播） | 「给用户推一条实时通知」 |
| `file-oss-management` | 文件上传下载、对象存储（S3 协议统一适配 MinIO/OSS/COS） | 「实现文件上传到 MinIO」 |
| `data-permission` | 行级数据权限 `@DataPermission`+`@DataColumn`、6 种数据范围 | 「列表只让看本部门数据」 |
| `data-desensitize` | 序列化期 PII 脱敏 `@Sensitive`（手机号/身份证/银行卡掩码） | 「手机号返回前端要打码」 |
| `ui-pc` | 后台管理端前端页面，代码生成器双栈（Vue+Element Plus / React+Ant Design Pro） | 「照生成器风格写列表页」 |
| `html-to-code` | HTML 设计稿 / 原型转 6.x 前端代码（Element Plus 或 Ant Design Pro） | 「把这张设计稿转成 Vue 页面」 |

### L4 框架专属（7 个）

| 技能名 | 用途 | 示例指令 |
|--------|------|---------|
| `snail-ai-integration` | 集成 Snail AI（com.aizuda）大模型对话 / Agent / OpenAPI | 「接入 AI 智能对话」 |
| `mcp-integration` | MCP 集成：`@McpTool`/`@McpResource` 暴露工具 + Client 消费外部 MCP | 「把这个查询暴露成 MCP 工具」 |
| `elasticsearch-search` | Easy-Es 全文检索（EsMapper、`@IndexName`/`@IndexField`、高亮分页） | 「给商品加 ES 全文检索」 |
| `iot-mqtt` | mica-mqtt 物联网通信（订阅/发布、QoS、设备上下线） | 「接入 MQTT 接收设备消息」 |
| `multi-tenant` | 多租户 SaaS 数据隔离（TenantLineInnerInterceptor + tenant_id） | 「让数据按租户隔离」 |
| `workflow-warmflow` | Warm-Flow 工作流：发起 / 办理 / 驳回 / 待办已办 / 事件联动 | 「给请假单加审批流」 |


---

## 快捷命令

| 命令 | 用途 | 示例 |
|------|------|------|
| `/dev` | 开发新功能（全栈，先激活相关技能再动手） | `/dev 开发一个公告管理模块，分页+导出+按标题查询` |
| `/crud` | 基于已有表快速生成标准 CRUD（FreeMarker 双前端栈） | `/crud 表 sys_notice，模块 system，前端 vue` |
| `/check` | 框架代码规范检查（先激活 code-patterns） | `/check`（检查当前改动） |
| `/progress` | 项目进度报告（扫描任务台账 + git） | `/progress` |
| `/next` | 基于当前状态给「下一步该做什么」建议 | `/next` |
| `/start` | 本地把后端跑起来（环境要求 + 启动引导） | `/start` |

---

## 典型使用场景

### 场景 1：新建一个 CRUD 业务模块

- **输入**：`/dev 在 demo 模块开发一个客户档案管理，分页、按客户名/手机号查询、导出 Excel`
- **流程**：Hook 强制评估 → 激活 `crud-development` + `database-ops`（+ 需导出时 `log-audit`）→ 按生成器 FreeMarker 模板出后端四件套 + 前端 api.ts/types.ts。
- **产出**：`org.dromara.demo.customer` 下整套 Controller/Service/ServiceImpl/Mapper/domain（Entity/BO/VO），标准 REST，权限 + 日志注解齐全。

### 场景 2：改复杂模块（system）

- **输入**：`改一下 system 模块的用户列表，加一个「按部门过滤」并且只能看本部门数据`
- **流程**：激活 `crud-development`（改查询）+ `data-permission`（行级隔离）→ 在 Mapper/Service 上加 `@DataPermission` + `@DataColumn`，对齐 MPJ 联表别名。
- **产出**：用户列表自动按 dataScope 过滤，普通用户只见本部门数据，超管全量。

### 场景 3：集成 Snail AI 智能对话

- **输入**：`接入 Snail AI，做一个 Agent 聊天助手`
- **流程**：激活 `snail-ai-integration` → 配置 `snail-ai`（Server gRPC 地址 / app-id / token）、确认返回结构用 Result 还是 R、把当前登录用户注册为 OpenAPI 用户（externalId=userId）。
- **产出**：本项目作为 Snail AI 客户端网关，提供 agent-chat 接口；必要时独立部署 `ruoyi-snailai-server`。

### 场景 4：用 MCP 暴露业务能力给 AI

- **输入**：`把订单统计查询暴露成 MCP 工具给外部 Agent 调用`
- **流程**：激活 `mcp-integration` → 用 `@McpTool` 注解（铁律：工具方法必须委托业务 Service，不在工具里写业务）→ STREAMABLE 协议端点 `/mcp`。
- **产出**：外部 MCP Client 可发现并调用该工具；同模块也能作为 Client 消费外部 MCP Server。

### 场景 5：ES 全文检索

- **输入**：`给商品表加 Elasticsearch 全文检索，支持名称/描述 match 高亮分页`
- **流程**：激活 `elasticsearch-search` → 定义 ES 索引实体（`@IndexName`/`@IndexField`）、编写 `EsMapper`、配 `easy-es.enable`、MySQL 与 ES 双写。
- **产出**：类 MyBatis-Plus 风格的 ORM 检索，无需手写裸 DSL；带高亮、分页。

### 场景 6：实时推送

- **输入**：`审批通过后给申请人推一条实时通知`
- **流程**：激活 `realtime-push` → 调 `PushHelper` 单发（业务零感知传输方式，由 `message.transport` 决定 SSE/WebSocket）；前端连 `/resource/message`。
- **产出**：单实例或集群（Redis topic 广播）下都能把消息送达指定在线用户。

### 场景 7：数据脱敏

- **输入**：`用户列表返回的手机号、身份证要打码，管理员能看明文`
- **流程**：激活 `data-desensitize` → VO 字段加 `@Sensitive(strategy=...)`（序列化期掩码，DB 仍明文）→ 配权限感知按角色放行明文。
- **产出**：普通用户看 `138****5678`，管理员看完整值；不改库、不加解密。

### 场景 8：排查 Bug + 性能/SQL 日志

- **输入**：`这个分页接口越翻到后面越慢，而且偶尔报空指针`
- **流程**：空指针走 `bug-detective`（定位根因）；「慢」走 `performance-doctor` → 开 `mybatis-plus.sql-log.enabled` 抓真实 SQL + 耗时，分析深分页 / N+1 / 索引缺失（EXPLAIN）。
- **产出**：定位到具体 SQL 与瓶颈，给出改批量 / 联表 / 加索引 / 游标分页的方案。

### 场景 9：部署上线

- **输入**：`用 docker-compose 把后端 + MySQL + Redis + Nginx 一键起来`
- **流程**：激活 `deployment-guide`（+ `env-config` 处理 profile/密钥）→ Maven 打可执行 JAR（Jetty）→ docker-compose 编排 → Nginx 反代 `/prod-api`、`/admin`、`/snail-job`、`/snail-ai` → 生产密钥换安全值、切 `SPRING_PROFILES_ACTIVE=prod`。
- **产出**：可部署的编排文件 + 反代配置；按需独立部署 monitor-admin / snailjob-server / snailai-server。

---

## 经验闭环

本体系内置「经验沉淀闭环」，让 AI 越用越懂你的项目：

```
会话进行中  ──/exp 或「沉淀经验」──►  exp-sediment 技能
                                          │ 写入
                                          ▼
                       .claude/docs/experience/{date}/{xxx}-exp-summary.md
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 ▼ Codex 端                                          ▼ Claude 端
   .codex/hooks/session-start.cjs                     CLAUDE.md「经验沉淀目录加载」段
   会话开始自动注入最近摘要到上下文                    会话开始时 ls 最近 *-exp-summary.md 读取
```

- **沉淀**：会话末尾说「沉淀经验 / 把这个坑记下来」或用 `/exp` → `exp-sediment` 把隐性知识写成经验摘要（新增禁令、踩过的坑、可复用模式）。
- **消费（Codex）**：下次会话 `session-start` Hook 自动把最近摘要注入上下文。
- **消费（Claude）**：CLAUDE.md 指引在会话开始时 `ls -t .claude/docs/experience/*/*-exp-summary.md | head -1` 读取最近摘要。
- **查历史**：说「以前怎么处理 / 之前踩过 / 查一下记录」也会触发 `exp-sediment` 的读取分支。

> 目录初始为空（仅 `.gitkeep` 占位），随使用逐步积累。

---

## 常见问题 FAQ

**Q1：为什么反复强调「不是 plus.ruoyi、不是 DAO 层」？**
A：本项目遵循框架约定，与某些定制衍生版（如 ruoyi-plus-uniapp）约定不同。原版铁律：包名 `org.dromara.*`、**三层架构无 DAO 层**（Controller→Service→Mapper，直接用 `BaseMapperPlus`）、Entity `extends BaseEntity`、查询用 `QueryBuilder.lambda` + `likeIfText/eqIfText`、对象转换用 `MapstructUtils`、标准 REST 路径、逻辑删除字段 `del_flag`。**禁止**出现 `plus.ruoyi`/`com.ruoyi`、`buildQueryWrapper()`/`IXxxDao`、`PlusLambdaQuery`、`TenantEntity`(默认)、`/pageXxx`、`A*` 组件等衍生版写法。

**Q2：Java 版本有什么要求？**
A：**必须 Java 21**。本版本基于 Spring Boot 4.1.0 / Jakarta EE 10 / Jetty 容器，低于 21 直接起不来。Maven 用 3.8+ 或仓库自带 `mvnw`。

**Q3：前端代码在哪？为什么仓库里没有完整前端工程？**
A：本项目是**前后端一体化仓库**：根目录为后端多模块 Maven 工程，前端 plus-ui（Vue3 + Element Plus）在**仓库内 frontend/plus-ui/ 目录**。代码生成器（ruoyi-gen）内置 FreeMarker 模板产出前端骨架：`gen_table.frontend_type` 选 `vue`（Element Plus）或 `react`（Ant Design Pro），模板在 `backend/java/ruoyi-modules/ruoyi-gen/src/main/resources/fm/<type>/`。写前端就用 `ui-pc` / `html-to-code` 技能。

**Q4：多租户现在是开还是关？**
A：**本副本当前未启用多租户**（`TenantLineInnerInterceptor` 插件未进拦截器链 = 不会自动过滤）。`multi-tenant` 技能描述的是原版多租户的完整机制（插件 + `tenant_id` 列自动过滤 + `TenantHelper` 动态切换）；要启用需按技能指引开启插件。需要做行级隔离但不想上多租户，用 `data-permission`（部门/本人级）。

**Q5：JSON 用什么？是 Fastjson 吗？**
A：**用 Jackson**，且本版本是 **Jackson 3**（包名 `tools.jackson.*`，不是 `com.fasterxml.jackson.*`）。**无 Fastjson2**。唯一入口是 `JsonUtils`（`org.dromara.common.json.utils.JsonUtils`），禁止手动 `new ObjectMapper`。Long/BigInteger 超出 JS 安全整数自动转 String，BigDecimal 始终转 String。另：AI 走 Snail AI + Spring AI/MCP（**无 langchain4j**），接口文档走 SpringDoc 原生（**无 Knife4j**）。

**Q6：Claude 和 Codex 两套有什么区别？怎么选？**
A：**规范内容完全一致**，区别只在入口与加载方式：
- **Claude Code**：读 `.claude/`（`skills/` + `commands/` + `hooks/` + `settings.json`），命令是独立的 `commands/*.md`，Hook 用 JS 评估。
- **Codex**：读 `.codex/`（`skills/` + `hooks/` + `config.toml` + `hooks.json`）+ 根目录 `AGENTS.md`（= CLAUDE.md + 技能清单表）；命令在 Codex 端转为 `skills/` 里的技能，启动时自动加载所有 SKILL.md frontmatter。
- **怎么选**：用哪个 CLI 就用哪套，体验对称，无需取舍。

**Q7：本套技能和 `.claude/agents/` 后端 subagent 冲突吗？**
A：**不冲突，互补共存**。本套技能是**分场景细化**（CRUD、安全、ES、工作流……）；`.claude/agents/` 的 6 个后端 subagent（crud / query-permission / module-enhancement / common-infrastructure / engineering / javadoc）是**后端专项子代理**。二者层次不同，按需各取。

**Q8：怎么给这套体系加 / 改技能？**
A：用 `add-skill` 技能（说「给框架加一个 xxx 技能」）。它会指导你写 SKILL.md（YAML 头部 + 触发词）并**同步到双系统**（`.claude/skills/` 和 `.codex/skills/` 保持镜像）。

---

## 进阶用法

### 技能组合

复杂任务常需多技能协同，AI 会自动组合，你也可以显式点名：

- **完整开发一个带审批的业务**：`crud-development`（建模块）+ `workflow-warmflow`（审批流）+ `data-permission`（数据隔离）+ `log-audit`（操作日志）。
- **一个高并发查询接口**：`api-development`（接口设计）+ `redis-cache`（缓存）+ `performance-doctor`（SQL/索引调优）+ `security-guard`（限流防重）。
- **从设计稿到上线**：`html-to-code`（稿转码）→ `ui-pc`（页面规范）→ `crud-development`（后端）→ `test-development`（测试）→ `deployment-guide`（部署）。
- **方案到执行的链路**：`brainstorm`（出方案）→ `writing-plans`（拆计划）→ `/dev` 或 `/crud`（执行）→ `exp-sediment`（沉淀）。

### 用 add-skill 扩展

项目长出新场景（如对接某个特定第三方）时，用 `add-skill` 把「这次怎么做对的」固化成一个新技能，下次自动复用。新增技能记得同步双系统。

### 善用经验闭环

养成会话末 `/exp` 的习惯。每沉淀一条「踩过的坑 / 新禁令」，AI 下次就少犯一次错——这是这套体系「越用越懂你项目」的核心机制。

---

> 本指南随技能体系演进更新。技能数（43）/ 命令数（6）以 `.claude/skills/` 与 `.claude/commands/` 实际目录为准。
