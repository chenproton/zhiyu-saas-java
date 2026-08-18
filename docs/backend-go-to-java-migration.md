# zhiyu-saas 后端 Go → Java 迁移方案（基于 RuoYi-Vue-Plus 6.x 框架）

> 本文档记录 zhiyu-saas 后端从 Go（chi + pgx）迁移到 Java（base-dev-framework6-java，`org.dromara`）的方案与实时进度；Go 与 Java 双后端在本仓库并存，迁移进度见 §7。

- 状态：已基本完成（业务域 13/13、前端零改动对接；专项能力部分收尾中，见 §7）
- 日期：2026-08-17
- 范围：仅后端语言与框架迁移；数据库、前端保持不动
- 目标框架：`saas-framework6-java-vue`（org.dromara · Java 21 / Spring Boot 4.1.0 / MyBatis-Plus 3.5.17 / Sa-Token 1.45.0）

## 0. 决策背景与硬约束

本次迁移的目标是把 zhiyu-saas 后端从 Go（chi + pgx）替换为公司统一研发基础框架（RuoYi-Vue-Plus 6.x，Java），**业务行为等价迁移**。三条硬约束：

1. **数据库保留 PostgreSQL**：现有 172 张业务表、表结构、存量数据不动（演示系统以交互流程达标为准）。
2. **前端 React 代码不动**：Next.js 16 / React 19 页面、组件、路由全部保留；仅 `frontend/packages/api-client` 的请求封装层做最小适配（见 §4.6）。
3. **后端换 Java**：分层结构 Controller → Service → Mapper（框架约定，无 DAO 层），包名 `org.dromara.*`。

> 演示系统定位：不需要考虑真实数据流转，mock 数据与交互流程达到预期即可；但安全边界（跨租户、越权）与分层红线仍必须遵守。

## 1. 现状盘点（已核实数据）

### 1.1 后端现状（Go）

| 项 | 数值 |
|---|---|
| 语言/框架 | Go 1.25 · chi v5.3.1 · pgx v5.10.0 |
| 代码规模 | 495 个 .go 文件（非 vendor）· 约 11.8 万行 |
| 分层 | handler（113）/ service（88）/ store（105）/ domain（20）/ router（12）/ middleware（7）/ scheduler（1）/ ai（2） |
| 认证 | golang-jwt v5（Authorization Bearer + 多平台 cookie）+ 会话校验中间件（`RequireActiveUser`：用户/租户停用即时失效、改密后旧 token 失效） |
| 多租户 | 自研：`tenant_id` 列（27 个迁移文件涉及）+ middleware/tenant.go + store 层过滤 |
| 权限 | RBAC（rbac.go）+ 菜单授权（menu_grants.go）+ 操作日志（oplog.go） |
| 其它 | Redis（go-redis v9）、robfig/cron 定时任务、excelize 导入导出、Prometheus metrics、自研 SSE AI 流式（internal/ai） |

### 1.2 数据库现状（PostgreSQL）

| 项 | 数值 |
|---|---|
| 表数量 | 172 张（`public` schema，93 对 up/down migration） |
| 主键 | `uuid DEFAULT gen_random_uuid()`（全部表） |
| 审计字段 | `created_at`（26 文件）/ `updated_at`（23 文件）/ `created_by`（7 文件）；**无 `update_by` / `del_flag` / `version`** |
| 租户 | `tenant_id uuid`（41+ 张表，部分 NOT NULL REFERENCES tenants(id)） |
| 业务域 | 13 个：superadmin / library / job / affairs / evaluation / lesson / scene / partner / portal / ai 等 |

### 1.3 目标框架关键能力（已核实）

| 能力 | 框架实现 | 结论 |
|---|---|---|
| PostgreSQL 支持 | 官方脚本 `backend/java/script/sql/postgres/postgres_ry_{vue,workflow,job,ai}.sql`；`DataBaseType.POSTGRE_SQL` 方言；`PaginationInnerInterceptor` 自动识别库类型 | ✅ 可直接用 |
| PG 驱动 | `backend/java/ruoyi-admin/pom.xml` 中 `postgresql` 依赖**默认注释** | ⚠️ 需取消注释启用 |
| 主键策略 | 全局 `idType: ASSIGN_ID`（雪花），可配置 `ASSIGN_UUID` / `INPUT` | ✅ 可保留 UUID |
| 多租户 | `TenantLineInnerInterceptor` 仅注释提及，**未默认启用** | ⚠️ 需自研翻译现有租户逻辑 |
| 代码生成器 | FreeMarker 模板，`gen_table.frontend_type` 支持 `vue` / `react` 双前端栈（`fm/react/` 为 Ant Design Pro 风格） | ✅ 可用于生成后端 CRUD 骨架 |

## 2. 关键决策点

### 2.1 数据库引擎：保留 PostgreSQL ✅（已确认）

- 启用 `backend/java/ruoyi-admin/pom.xml` 中的 `org.postgresql:postgresql` 依赖（取消注释）。
- `application-dev.yml` 数据源改为 PG：`jdbc:postgresql://localhost:5432/<库名>`，驱动 `org.postgresql.Driver`。
- 框架系统表（sys_user / sys_role / sys_menu / sys_dict / sys_tenant / sys_login_info / sys_oper_log 等）通过 `backend/java/script/sql/postgres/postgres_ry_vue.sql` 导入**同一 PG 库**（业务表与框架系统表共存；也可独立 schema，推荐同库异前缀隔离）。
- 分页无需改代码：`PaginationInnerInterceptor` 自动识别 PostgreSQL 方言。

### 2.2 主键策略：保留 UUID ✅（推荐）

- 172 张表主键 `uuid gen_random_uuid()` 全部不动。
- Java 侧：全局 `idType` 从 `ASSIGN_ID` 改为 **`ASSIGN_UUID`**（MyBatis-Plus 内置，生成 32 位 hex，PG `uuid` 类型可接受无连字符形式）；或实体 `@TableId(type = IdType.INPUT)` 完全依赖 DB 默认值。
- 不建议改雪花 BIGINT：会触发全库主键/外键类型变更，违背「数据库不动」约束。

### 2.3 审计字段：存量表映射现有命名，不强制改列 ✅（推荐）

- 框架 `BaseEntity` 含 `create_by/create_time/update_by/update_time`（+ 可选 `del_flag`/`version`）。
- **存量 172 表**：不补列。Entity 通过 `@TableField` 把现有 `created_at/updated_at/created_by` 映射到审计语义（或自定义 `MetaObjectHandler` 填充现有列）；框架审计字段在实体上声明为「存在即用、缺失即忽略」。
- **新增表**：按框架规范建列（create_by/update_by/create_time/update_time）。
- **逻辑删除**：仅在确有软删需求的表补 `del_flag int`（框架 `@TableLogic`，删除值 1 / 未删 0）；其余表不做软删改造（现状无 `is_deleted` 体系，行为等价优先）。

### 2.4 认证体系：Sa-Token 替换 golang-jwt，语义逐条对齐 ✅（推荐）

- 用 Sa-Token（可启用 `sa-token-jwt` 插件保持 JWT 形态）替换自研 JWT。
- **必须逐条对齐的现有语义**（来自 middleware/auth.go）：
  - Bearer 头 + 多平台 cookie 双通道取 token；
  - 会话校验：用户/租户停用即时 401、改密后旧 token 失效（秒级截断比较）、DB 异常 fail-closed；
  - token 瘦身：仅放服务端消费的字段，不塞完整权限 map。
- 登录接口 URL、参数、返回结构对齐现有契约（`docs/spec/02-api-contract.md`），前端 api-client 无感知或仅微调。

### 2.5 多租户：翻译现有自研逻辑为 Java 拦截器 ✅（推荐）

- 框架 `TenantLineInnerInterceptor` 未默认启用，且现有租户语义复杂（租户停用校验、跨租户文件签名访问、联盟公共访问等），**不套框架租户插件**。
- 推荐：实现一个自定义 MyBatis-Plus `InnerInterceptor`（或查询基类统一带 `tenant_id` 条件），把 Go store 层的租户过滤逐条翻译，行为与现状完全一致。
- 租户上下文用 `ThreadLocal` + 请求拦截器（等价现有 middleware/tenant.go）。

### 2.6 权限 / 菜单 / 操作日志

- RBAC：现有权限点映射为 Sa-Token 权限标识，Controller 用 `@SaCheckPermission("xxx")`；数据行级权限用框架 `@DataPermission` 或现有自研逻辑翻译。
- 菜单：**保留现有菜单表与前端菜单渲染逻辑**（前端不动），后端提供菜单/权限查询接口的 Java 等价实现。
- 操作日志：现有 `oplog` 语义翻译为框架 `@Log` 注解 + 现有日志表（或 sys_oper_log 并存）。

### 2.7 代码生成器使用策略

- 将 172 张业务表导入 `ruoyi-gen`，生成 **Entity/BO/VO/Mapper/Service/Controller 骨架**（Java 侧），手工补业务逻辑。
- 前端不生成页面（React 不动）；若需新增页面，`frontend_type=react` 生成 Ant Design Pro 风格骨架，或改造 `fm/react/*.ftl` 模板对齐 zhiyu-saas 现有组件风格。
- 生成器无法覆盖的复杂逻辑（事务链、审批流、导入导出、SSE）手工编写。

### 2.8 横切能力翻译对照表

| 现有（Go） | 目标（Java 框架） |
|---|---|
| golang-jwt / 会话中间件 | Sa-Token（可选 JWT 插件） |
| go-redis | Redisson（`RedisUtils`/`CacheUtils`） |
| robfig/cron | `@Scheduled`（演示系统够用；复杂调度再上 SnailJob） |
| 自研 SSE AI 流式（internal/ai） | 优先翻译为 Spring MVC SSE（行为等价）；Snail AI/Spring AI/MCP 作为后续增强 |
| excelize | Apache Fesod（原 EasyExcel） |
| 本地文件上传（FileHandler + 跨租户签名） | 保留本地存储逻辑；框架 `ruoyi-common-oss`（S3/MinIO）作为可选升级 |
| Prometheus metrics | Spring Boot Actuator + Micrometer |
| 全局异常/响应 | 框架 `R<T>` + 全局异常处理器 + `ServiceException` |
| 多数据源/ES/MQTT/短信 | 框架 common 模块按需启用（本期默认不启用，保持最小迁移面） |

## 3. 阶段计划

> 每个阶段以「可运行 + 验收通过」为出口，不追求一次性全量切换。

### 阶段 0：环境与框架跑通（0.5~1 周）
- 拉取 `saas-framework6-java-vue` 工程，JDK 21 + Maven 3.9+ 本地可启动。
- 启用 PG 驱动，`application-dev.yml` 切 PG；导入 `postgres_ry_vue.sql` 框架系统表。
- 登录（Sa-Token）跑通，`R<T>` 响应、Swagger（SpringDoc）可访问。
- ✅ 验收：框架默认登录 + 系统管理页面接口在 PG 上正常。

### 阶段 1：数据层（1~2 周）
- 172 张业务表导入 `ruoyi-gen`，批量生成 Entity/BO/VO/Mapper/Service/Controller 骨架。
- 处理主键（ASSIGN_UUID）、审计字段映射（§2.3）、租户字段、分页（`PageQuery`/`PageResult`）。
- 建立 Java 侧 migration 习惯：新表变更走框架 SQL 脚本（沿用现有 up/down 配对思想）。
- ✅ 验收：抽样 10 张表 CRUD 接口可用，列表分页/详情/新增/修改/删除与 Go 版返回一致。

### 阶段 2：认证与横切（1~2 周）
- Sa-Token 登录/登出/会话校验（§2.4 语义逐条对齐）；多租户拦截器（§2.5）；RBAC 权限点映射；操作日志。
- 全局异常、响应包装、参数校验（分组校验）、接口文档对齐 `02-api-contract.md`。
- ✅ 验收：现有登录链路（含改密失效、租户停用、多平台 cookie）行为等价；跨租户越权用例通过（复用现有 `*_test.go` 的用例清单）。

### 阶段 3：业务域翻译（4~8 周，按域分批）
- 按 13 个业务域分批：library → job → affairs → evaluation → lesson → scene → partner → superadmin → portal/ai。
- 每域流程：生成骨架 → 翻译 service/store 逻辑（QueryBuilder 重写查询）→ 对照 `02-api-contract.md` 对齐接口 → 前端 api-client 冒烟验证。
- 审批流：现有 workflows 语义优先翻译为普通 Service 事务；Warm-Flow 作为可选增强。
- ✅ 验收：每域核心链路（列表/详情/写操作 + 权限 + 租户隔离）与 Go 版 API 契约一致。

### 阶段 4：专项能力（1~2 周）
- AI SSE 流式翻译（Spring SSE）；定时任务翻译；文件上传/预览/跨租户签名访问；Excel 导入导出。
- ✅ 验收：AI 对话、任务调度、文件预览三条链路可用。

### 阶段 5：前端适配与切换（0.5~1 周）
- `frontend/packages/api-client` 最小适配：base URL 指向 Java 服务；响应包装对齐 `R<T>`（code/msg/data）；401 拦截与 token 存取逻辑保持现有形态。
- 全量回归（复用 `docs/spec/06-acceptance-flows.md` 验收流程）；部署切换。
- ✅ 验收：React 前端零页面改动跑通全部演示流程。

## 4. 前端 api-client 最小适配点（唯一的前端改动面）

| 改动点 | 说明 |
|---|---|
| base URL | `/dev-api`（或 `/prod-api`）指向 Java 8080 |
| 响应包装 | 解析 `R<T>`：`code===200` 成功，`code!==200` 走错误分支（映射现有错误处理） |
| 认证头 | `Authorization: Bearer <token>` 格式不变（Sa-Token 兼容） |
| 401 处理 | 保持现有登出/跳登录逻辑 |
| 可选 | RSA 接口加密开关（框架 `api-decrypt`，前端 `jsencrypt` 已有依赖） |

## 5. 工作量估算

| 工作项 | 估算 | 说明 |
|---|---|---|
| 阶段 0 环境 | 0.5~1 周 | PG 驱动 + 系统表 + 登录跑通 |
| 阶段 1 数据层 | 1~2 周 | 生成器为主，抽样验收 |
| 阶段 2 认证横切 | 1~2 周 | 语义对齐是重点（行为等价） |
| 阶段 3 业务域（13 域） | 4~8 周 | 主力工作量，可 2~3 人并行按域拆分 |
| 阶段 4 专项 | 1~2 周 | AI/任务/文件/Excel |
| 阶段 5 适配切换 | 0.5~1 周 | api-client 适配 + 回归 |
| **合计** | **约 2~4 人月** | 演示系统可按交互链路裁剪（mock 优先） |

后端翻译参考：495 个 Go 文件（11.8 万行）→ Java 约 1.2~1.5 系数产出（含生成器骨架，实际手写逻辑约为 service/store 的查询与事务翻译）。

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 认证/会话语义偏差（改密失效、停用即时生效、fail-closed） | 安全边界 | 阶段 2 逐条对照 `middleware/auth.go` + 现有测试用例翻译，不凭印象重写 |
| 租户过滤遗漏导致跨租户读 | 安全红线 | 现有 `tenant_id` 表清单（41+ 张）逐表核对；自定义拦截器 + 越权用例回归 |
| PG 特有写法（`RETURNING`、`gen_random_uuid`、JSONB）在 MyBatis-Plus 下不适配 | 数据层返工 | 阶段 1 先抽样验证；`RETURNING` 用 Java 侧回填替代 |
| `R<T>` 响应结构变化导致前端 api-client 大面积改动 | 前端「不动」约束被破坏 | 响应包装层单点适配（§4），页面代码零改动 |
| 框架默认关闭的外置服务（SnailJob/SnailAI/Monitor）被误启用 | 部署复杂化 | 本期全部关闭，仅用框架核心（web/mybatis/redis/satoken/log） |
| 生成器产物与现有业务逻辑冲突（覆盖手写代码） | 进度损失 | 生成器只产出骨架目录，业务逻辑统一放 service 实现层，遵循框架分层 |

## 7. 迁移进度（实时更新）

> 分支：`feat/go-to-java-migration-zhiyu`。进度以 Java 仓库 commit 为准，2026-08-17 启动。

| 阶段 | 状态 | 说明 |
|---|---|---|
| 阶段 0 环境 | ✅ 完成 | PG 驱动启用、框架 20 张 sys_ 表导入 zhiyu-saas 库、Sa-Token admin 登录跑通、Redis 就绪 |
| 阶段 1 数据层 | ✅ 完成（骨架方式） | 未走生成器；按域直译 Go store SQL 为 Entity/Mapper（UUID 主键 ASSIGN_UUID，PG 数组/jsonb TypeHandler） |
| 阶段 2 认证横切 | ✅ 完成 | Sa-Token Bearer + ZhiyuAuthFilter（401 形状对齐）、多平台登录/选租户/Me、bcrypt 校验、租户上下文、裸 JSON 响应体系 |
| 阶段 3 业务域 | ✅ 完成（13/13 域） | auth(12)、portal+favorites(16)、library(20)、scene(41)、job(70)、evaluation(98)、affairs(63)、lesson(49)、partner(72)、alliance(71)、system(67)、superadmin(23)、ai(53) ≈ **635+ 端点**；全域冒烟通过 |
| 阶段 4 专项 | 🔄 部分完成 | AI SSE 已实现（SseEmitter 对齐 Go 事件协议）；文件上传/Excel 导入导出（import-export 18 端点）待补；定时任务未迁移 |
| 阶段 5 适配切换 | ✅ 完成 | 前端零改动对接 /api/v1；dev 跑通（/portal 等路由 200）；后端 8081 + 前端 3021 联通验证 |

**关键适配决策记录**（实施中确认，与方案 §2 的差异）：
- 响应包装：zhiyu 接口返回**裸 JSON**（不用框架 R<T>），错误 `{code,error,message?}` —— 前端 `request<T>` 直接 `res.json()`，框架包装不兼容（**有意偏离**）
- 分页：`{items,total}` + `limit/offset`（maxPageSize 200），不用框架 PageQuery/PageResult（**有意偏离**）
- 鉴权：`/api/v1/**` 从框架 SaInterceptor 排除，zhiyu 自有 Filter（Sa-Token Bearer token + 会话上下文 + 逐请求用户/租户状态校验 fail-closed，401 文本对齐 Go 中间件）（**有意偏离**：Go 的菜单 RBAC 由前端 menu-permissions 消费 me.roles.permissions 实现，后端菜单中间件未迁移，见差异表 P2）
- 数据访问：Mapper 用原生 selectList/selectById + 注解 SQL（翻译 Go store 手写 SQL；框架 selectVoXxx 依赖 MapStruct 同型 converter，Entity=Vo 场景不可用）（**有意偏离**）
- PG 适配：JDBC URL `stringtype=unspecified`（String↔uuid 自动推断）；接口加密 api-decrypt 关闭（前端明文契约）
- 租户：翻译 Go 显式过滤语义（查询统一带 tenant_id 条件），未启用框架租户插件（副本已裁剪）（**有意偏离**）

### 代码标准性审查结论（2026-08-18，592 文件）

- **框架字面硬红线全部通过**：包名 `org.dromara.zhiyu`、三层无 DAO、不 extends ServiceImpl、无 PlusLambdaQuery/likeCast/BeanUtil、无 /pageXxxs 非标路径、实体 camelCase。
- **与框架原生模块的系统性差异为「行为等价迁移」的有意设计**（上表已标注），已修复的真问题：401 响应体对齐 Go、停用即时失效（RequireActiveUser 语义）、ErrorBody 空 message 省略、token 日志脱敏、登录验证码防爆破、改密踢出会话。
- 遗留建议项（非阻断）：魔法角色码统一常量、DTO 迁出 Mapper 包、手写 SQL 逐步收敛 QueryBuilder —— 列为后续重构清单，不影响功能与安全。

## 8. 附录

- 现有 API 契约：`docs/spec/02-api-contract.md`（548 行，迁移期基准）
- 现有库表设计：`docs/spec/04-database-schema.md`（490 行）
- 验收流程：`docs/spec/06-acceptance-flows.md`
- 框架约定（分层/红线/禁止写法）：目标仓库根目录 `AGENTS.md` / `CLAUDE.md`
- 框架 PG 支持证据：`backend/java/script/sql/postgres/*.sql`、`DataBaseType.POSTGRE_SQL`、`PaginationInnerInterceptor` 自动识别
