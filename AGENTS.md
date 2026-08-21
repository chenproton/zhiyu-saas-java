# 知与 SaaS 仓库开发契约（Java + Vue 单栈）

> 分支模型说明：本仓库**主线只有 `master`**，按「分支隔离 + 部署成功自动合并 master」协作（见第四节）。
>
> 本仓库为**单栈架构**：**Java 后端多模块 Maven 工程位于仓库根目录**（`pom.xml` + `mvnw` + `ruoyi-*/` + `scripts/`，基于 base-dev-framework6-java 框架，`org.dromara` 包名，Spring Boot 4 / Java 21，布局与上游框架技术方案对齐），共用 MySQL 8.0，前端为 **`plus-ui/` 单工程双构建**（RuoYi 框架，位于仓库根）：**admin 管理端**（`plus-ui/src` → `dist`）+ **portal 业务门户**（`plus-ui/src-portal` → `dist-portal`），一份 package.json / lockfile / node_modules，运行时仍是两个独立 SPA。Go 后端与 React 前端已于 2026-08 完成迁移并删除。
>
> 开发契约分两部分：第一部分为仓库级开发契约（spec-first / 部署 / 运维），第二部分为 Java 后端框架契约。按所改模块选择对应契约执行。

### 顶层目录结构

```
├── pom.xml / mvnw     # Java 后端 Maven 根工程（多模块，org.dromara）
├── ruoyi-admin/       # 后端唯一可执行入口
├── ruoyi-api/         # 跨模块 API 契约层
├── ruoyi-common/*     # 24 个公共能力模块
├── ruoyi-modules/*    # 业务模块：system / ai / workflow / job / gen / demo / zhiyu
├── ruoyi-extend/*     # 独立部署服务：monitor-admin / snailjob-server / snailai-server
├── scripts/           # 统一脚本目录：框架初始化 SQL（sql/）、Docker/Nginx 配置（docker/）、bin/ 启停脚本 + spec-check / ui-smoke / package-release 等工具
├── plus-ui/           # Vue 管理端 + 业务门户双应用工程（admin：src/ → dist；portal：src-portal/ → dist-portal）
├── db/migrations/     # 数据库迁移（up/down 配对 SQL，deploy.sh 纯 mysql 执行）
├── docs/              # 全量文档（spec、ADR、规范）
├── deploy/            # docker-compose / nginx / Dockerfile（Java+Vue 单栈编排）
└── AGENTS.md          # 本文件：全局开发契约（唯一根级描述文档）
```

---

# 知与 SaaS 开发契约

> 本仓库由 AI 完全主导开发：用户给需求，AI 按本契约走完「spec → 代码 → 校验 → 部署」全流程。**安全与架构合理是硬前提，任何功能都不得为了快速而牺牲这两条。**

## 零、三条铁律（任何改动前先读，违反即失败）

1. **禁止覆盖/还原他人代码**：不得对非当次任务的文件执行 `git checkout` / `git restore` / `git reset`。遇到与本次任务无关的编译/类型错误，报错停止并告知用户，禁止擅自修复他人未提交的修改。
2. **禁止破坏安全边界**：不新增越权路径（跨租户读数据）、不泄露密钥（api_key 不回传、不落日志）、不做 SQL 注入前端。
3. **禁止破坏架构分层**：遵守「三、硬性架构约束」的 controller/service/mapper 分层（Java 框架契约，无 DAO 层），禁止绕过约束抄近路。

## 一、开发流程（接任务后先判类型，再走对应闭环）

| 任务类型 | 判断标准 | 流程 |
|---|---|---|
| **新功能** | 增加能力 / 新模块 / 新接口 | 七节点闭环 |
| **修复 bug** | 现有行为与 spec/预期不符 | 修复流程 |
| **重构** | 行为不变，仅改结构/可读性 | 重构流程 |

三类流程的完整步骤（七节点闭环 / 修复 / 重构）见 [`docs/dev-processes.md`](docs/dev-processes.md)；任务开始时先加载 spec-first 执行手册 [`.dsh/skills/spec-workflow/SKILL.md`](.dsh/skills/spec-workflow/SKILL.md)，spec 细则见 [`docs/spec-standards.md`](docs/spec-standards.md)「Spec 工作流」。

## 二、开发原则（写代码时的心法）

- **规格先行（spec-first）**：功能开发先读 `docs/spec/` 对齐意图再写代码；新增/变更行为必须同步 spec。见 [`docs/spec-standards.md`](docs/spec-standards.md)。
- **简单优先**：不过度防御；小概率异常宁可容忍；核心业务加锁防重复，普通业务允许报错或重复插入；核心接口保流畅，非核心允许等待。
- **组件复用优先**：接到需求先判断能否复用现有组件/函数/模式，能复用直接使用；需抽公共组件先向用户提方案、经确认后实施。前端复用查 plus-ui `src-portal/components/` 与 `src-portal/views/*/_components/`（React 时代速查表 `docs/components.md`/`docs/forms-tables.md` 已标历史墓碑）；后端复用查 `ruoyi-modules/ruoyi-zhiyu/src/main/java/org/dromara/zhiyu/core/` 与 `.codex/skills/` 框架技能（`docs/backend-reuse.md` 已标历史墓碑）。
- **性能自检（温和，写代码时自问，不硬拦）**：涉及列表/批量/聚合的代码，写完自问——① 有没有循环内逐条 SQL（N+1）？应改 JOIN / `IN($N)` / 批量；② 列表/聚合查询有没有显式 LIMIT 或「数据量有界」的论证？③ 新增后台任务/goroutine 有没有超时 + panic 兜底 + 去重？④ 新增外部 HTTP 调用有没有设 timeout？「简单优先」指代码形状简单（一行 JOIN 与十行循环一样简单），不代表可以先写 N+1 再说。详见 [`docs/code-review-checklist.md`](docs/code-review-checklist.md)。

## 三、硬性架构约束（安全 + 架构合理的落地红线）

> 完整条款与理由见 [`docs/architecture-constraints.md`](docs/architecture-constraints.md)（拆自本节的细则，决策依据 ADR-0001 / ADR-0003）；以下为必须遵守的要点：

### 3.1 后端分层红线

- **controller**：无裸 SQL / DB 句柄（`JdbcTemplate` 等）/ MyBatis 注解 / 直接调 mapper。
- **service**：不拼接 SQL；业务逻辑在 Service 层组装，数据访问走 Mapper。
- **mapper**：不读 HTTP 请求 / Sa-Token / 租户上下文；SQL 统一带 `tenant_id` 条件。
- 新接口必须附带 controller/service/mapper 测试至少一种。

### 3.2 安全红线

- 租户隔离以 SQL 层 `tenant_id` 条件 + 归属校验（`SystemGuard` / service 层校验）为准，禁止跨租户读写。
- 关键写操作（考试题目增删改分、密码/状态写）SQL 层补租户条件作纵深防御。
- 新端点写前自检五问：① 有没有跨租户读/写他租户数据？② 密钥/密码是否可能回传或落日志？③ 有没有 SQL 注入面？④ 上传文件是否会执行？⑤ 有没有未鉴权/越权匿名访问路径？

## 四、交付与部署（工具性流程）

### 4.1 分支隔离工作流

1. `git fetch origin master && git worktree add -b feat/<agent>-<任务简述> /tmp/<agent> origin/master && cd /tmp/<agent>`
   > 分支必须基于 `origin/master`（先 fetch），**禁止基于本地 `master`**：本地 master 可能含他人未推送提交，直接 `worktree add … master` 会把他人工作误带进分支（多 Agent 并行时必现）。
2. `git add -A && git commit -m "feat: 任务描述" && git push -u origin <分支>`
3. `./deploy.sh --branch <分支名>`（可选 `--clean` / `--force` / `--skip-merge` / `--skip-gates`）
4. `cd / && git worktree remove /tmp/<agent>`

deploy.sh 自动：源码 hash 比对只构建变更部分（Java Maven + plus-ui（admin+portal 双构建））；分两段启动（先数据层→备份→迁移→框架表初始化→再业务容器）；健康门禁 + 业务冒烟（门户/管理端/API/Redis/DB/鉴权探针），任一失败回滚旧镜像且不合并 master；部署锁保证并发串行；**建库建表（db/migrations 纯 mysql 执行 + 种子数据由 java-backend SeedRunner 初始化）统一只经 deploy.sh**。完整执行顺序、密钥注入边界、备份恢复见 [`docs/spec/03-development-plan.md`](docs/spec/03-development-plan.md) §5 部署契约。**质量门禁默认开启**（Maven 编译 + plus-ui（admin+portal）构建 + spec-check），`--skip-gates` 仅应急跳过——CI（`.github/workflows/ci.yml`）触发条件是 push 到 master，而部署成功即直推 master，只靠 CI 等于事后报警。

### 4.2 提交前必跑（代码改动）

```bash
./mvnw compile -q            # Java 后端编译（JDK 21）
cd plus-ui && pnpm build:portal         # 业务门户（含 vue-tsc 类型检查，产物 dist-portal）
cd plus-ui && pnpm build:admin          # 管理端（产物 dist）
./scripts/spec-check.sh   # spec 校验共 14 项：阻断级（分层红线/LLM 直连/migration 配对/spec 五层制品/ADR 索引双向/安全红线/schema↔migrations 编号/表数/机器码/spec 随代码变更/新端点带测试）+ 提示级（路由↔契约覆盖/验收流程一致性/新端点租户校验提示/down 不可逆标注/XSS），详见 spec-standards.md §九
```

migration 需配对 `.down.sql` 并登记 `docs/spec/04-database-schema.md` §5；单次 commit 只含当次变更。

### 4.3 交付规则

- 代码修改后必须 `deploy.sh --branch` 部署验证（无需等确认，自动执行）；**全程实时看输出**，禁止只留尾部。
- 纯文档修改（`AGENTS.md`、`docs/`）无需 deploy，直接 commit。
- 做完在响应里报告：改了哪些文件、走了哪条流程、spec 是否同步、校验结果。

## 五、AI 协作者约定（协作纪律）

1. **只改当次任务相关文件**，不碰无关文件；忽略他人未提交修改，不得还原/覆盖（同铁律 #1）。
2. **前端样式修改不主动验证**：禁止无头浏览器视觉验证、DOM/布局测量、CDP 脚本、创建临时测试账号等；样式问题部署后由用户人工确认。
3. **不做端到端验证（默认）**：不跑 UI Smoke / `--route` 单页 / 浏览器自动化，除非用户主动要求；本地验证以编译 + 类型检查 + lint + 单测为准。
   > 例外（属自动化门禁，不是「主动做 E2E」）：`deploy.sh` 部署后自带业务冒烟探针（无浏览器、无账号，失败即回滚）。
4. **扫描/统计只覆盖自有代码**：排除 `offline/`、`node_modules/`、`dist/`、`*.tsbuildinfo`、`logs/`、`*/target/`。

## 六、规范索引（细则去哪找）

> 完整导航见 [`docs/README.md`](docs/README.md)。按需查，不要求通读。

| 我要 | 读 |
|---|---|
| 开发流程细节（新功能/修复/重构） | [`dev-processes.md`](docs/dev-processes.md) |
| 硬性架构约束全文（分层/安全红线） | [`architecture-constraints.md`](docs/architecture-constraints.md) |
| Codex 技能完整清单（48 个，含触发词） | [`codex-skills-index.md`](docs/codex-skills-index.md) |
| spec 分级/模板/DoD/闭环 | [`spec-standards.md`](docs/spec-standards.md) |
| spec-first 执行手册（AI 技能，任务开始时加载） | [`.dsh/skills/spec-workflow/SKILL.md`](.dsh/skills/spec-workflow/SKILL.md) |
| Java 后端框架规范/分层/禁止写法 | 本文件「第二部分」+ `.codex/skills/crud-development/SKILL.md` |
| 组件复用速查 | [`components.md`](docs/components.md) + [`forms-tables.md`](docs/forms-tables.md) |
| 安全非功能规范（密码/会话/密钥/限流/上传） | [`security-standards.md`](docs/security-standards.md) |
| 非功能规范（性能/可观测/国际化/测试） | [`non-functional-standards.md`](docs/non-functional-standards.md) |
| 架构决策为什么 | [`decisions/`](docs/decisions/README.md)（ADR） |
| 审 PR 语义检查 | [`code-review-checklist.md`](docs/code-review-checklist.md) |
| 写/审文档 | [`documentation-standards.md`](docs/documentation-standards.md) + [`prose-standards.md`](docs/prose-standards.md) |
| 找简化点 | [`simplification-notes.md`](docs/simplification-notes.md) |
| 快照版本机制 | [`resource-snapshot-versioning.md`](docs/resource-snapshot-versioning.md) |

## 七、运维速查（低频，用时查）

| 操作 | 命令 |
|------|------|
| 服务状态 | `docker compose -f deploy/docker-compose.yml ps`（仓库根无 compose 文件，必须带 -f） |
| 后端日志 | `docker compose -f deploy/docker-compose.yml logs java-backend --tail 100` 或 `docker logs zhiyu-java-backend --tail 100` |
| 健康检查 | `curl -sf http://127.0.0.1/health`（经生产入口，网关已显式代理到 java-backend）；容器内自检用 `docker exec zhiyu-java-backend curl -sf http://127.0.0.1:8080/health` |
| 连接数据库 | `mysql "$DATABASE_URL"` |
| 回滚部署 | `git checkout <上一个已上线 commit>` 后 `./deploy.sh`（重新构建；禁止手动登服务器改代码）。仓库当前**未打任何 tag**，故用 commit 而非 tag；部署成功后镜像只保留最新 1 个，无法「不重建直接切回上一版」 |
| 离线实施包 | `./scripts/package-release.sh v1.0.0`（产出 Java+Vue 单栈离线包，含前端 dist 与迁移 SQL） |
| 上传文件迁移 | `DATABASE_URL=… UPLOAD_DIR=… ./scripts/migrate_uploads.sh` |
| UI 全站巡检 | `node scripts/ui-smoke/ui-smoke.mjs`（默认不做，见「五.3」） |

环境变量（`DATABASE_URL`、`JWT_SECRET`、`DB_PASSWORD`、`REDIS_PASSWORD`、`SEED_ADMIN_PASSWORD`）在 `.env` 配置，禁止提交仓库。

---

# 第二部分：Java 后端框架契约（base-dev-framework6-java · Codex 入口）

## 语言设置

**必须使用中文**与用户对话。

## 项目定位

本项目 **base-dev-framework6-java** 是**公司统一研发基础框架**（`org.dromara` 包名、Spring Boot 4 / Java 21 / Jakarta EE 10）；前后端一体化单仓库布局（Java 多模块在仓库根 + `plus-ui` 单工程双构建 + 代码生成器内置模板产出前端骨架）见第一部分头部。

> 🔴 **本项目遵循框架约定**：包名 `org.dromara`，**三层架构无 DAO 层**（Controller→Service→Mapper，直接用 `BaseMapperPlus`），Entity 继承 `BaseEntity`，查询用 `QueryBuilder.lambda`，标准 REST 路径（`/list`、`/{id}`）。不要套用 `plus.ruoyi` / DAO 层 / `PlusLambdaQuery` / `/pageXxx` 等其它衍生版约定。

## 🔴 文件编码规范（必须遵守）

- 所有源码与配置文件统一 **UTF-8（无 BOM）、LF 换行**（遵循 `.editorconfig`）。Java 4 空格，JSON/YAML 2 空格。
- 绝对禁止 UTF-8 with BOM / GBK / GB2312 / ANSI 混用。
- `java: 非法字符: '﻿'` → 优先判定为 BOM：定位文件 → 移除文件头 BOM → 扫描同目录 `.java` → 重新编译验证。
- 中文注释/日志/文档必须可读，不允许乱码。

## Git Flow 分支与提交规范（上游规范，本仓库不生效）

> ⚠️ 本节为上游框架公司规范原文，现移至 [`docs/upstream-sync-notes.md`](docs/upstream-sync-notes.md)「附录：上游 Git Flow 规范原文」保留，供上游同步对照。**本仓库实际执行第一部分的「单 master + 分支隔离」模型**（无 main/dev/release 分支、不打版本 Tag、合并走 deploy.sh 自动直推 master），提交 message 用 `type(scope): subject` 格式、**不要求禅道 Issue ID**。分支/提交/MR 规范见 [`docs/Git Flow 开发协作简易指南.md`](docs/Git Flow 开发协作简易指南.md)。

## 🔴 经验沉淀（会话开始时）

会话开始（首次响应用户）前，若 `.claude/docs/experience/` 有内容：`ls -t .claude/docs/experience/*/*-exp-summary.md 2>/dev/null | head -1`，有输出则读取该最近摘要作为本次会话经验上下文（已沉淀的禁令/踩过的坑），读完即可不必复述。**例外**：用户首条是简单问候或与项目无关的纯通用问题，可跳过。Codex 端 `.codex/hooks/session-start.cjs` 会自动把最近的经验摘要注入 `additionalContext`，二者互为补充。

## 核心架构（必须牢记）

| 项目 | 框架规范 |
|------|-------------|
| 包名 | `org.dromara.*` |
| 分层 | **Controller → Service(接口+impl) → Mapper**（无 DAO 层） |
| Mapper | `extends BaseMapperPlus<Entity, Vo>`（复杂模块 + `MPJBaseMapper<Entity>`） |
| 查询构建 | Service 层 `QueryBuilder.lambda(Entity.class)` / `QueryBuilder.lambdaJoin("u", Entity.class)` |
| 条件辅助 | `eqIfText` / `likeIfText` / `eqIfPresent` / `inIfNotEmpty` / `betweenParams` |
| Entity 基类 | `BaseEntity`（`org.dromara.common.mybatis.core.domain`） |
| 对象转换 | `MapstructUtils.convert(bo, Entity.class)`（MapStruct-Plus） |
| BO/VO 注解 | BO `@AutoMapper(target=Entity, reverseConvertGenerate=false)`；VO `@AutoMapper(target=Entity)` |
| 主键策略 | 雪花 ID（`@TableId`） |
| 逻辑删除 | `@TableLogic`（`del_flag`）；乐观锁 `@Version` |
| 分页 | `PageQuery` + `PageResult`：`mapper.selectVoPage(pageQuery.build(), lqw)` → `PageResult.build(records, total)` |
| 响应包装 | `R<T>` / `R<Void>` / `PageResult<T>` |
| 权限标识 | `@SaCheckPermission("${module}:${business}:${action}")` |
| 业务异常 | `ServiceException` |
| 日志审计 | `@Log(title=..., businessType=BusinessType.X)`；防重 `@RepeatSubmit`；分组校验 `AddGroup/EditGroup/QueryGroup` |
| 当前时间 | `DateUtils`（extends Hutool `DateUtil`） |

### 标准 CRUD 模块结构

```
org.dromara.{module}/
├── controller/EntityController.java     extends BaseController, 返回 R<T>
├── service/IEntityService.java
├── service/impl/EntityServiceImpl.java   @RequiredArgsConstructor @Service
├── mapper/EntityMapper.java              extends BaseMapperPlus<Entity, EntityVo>
└── domain/
    ├── Entity.java                       extends BaseEntity
    ├── bo/EntityBo.java                  @AutoMapper(target=Entity, reverseConvertGenerate=false)
    └── vo/EntityVo.java                  @AutoMapper(target=Entity)
```

生成器默认方法集合：`queryById` / `queryPageList` / `queryList` / `insertByBo` / `updateByBo` / `deleteWithValidByIds`，再叠加唯一校验、数据权限、MPJ、缓存、Excel 导入导出、关联维护。

### 模块拓扑

```
ruoyi-admin          # 唯一可执行入口
ruoyi-api            # 跨模块 API 契约层（仅依赖 common-core；跨模块调用走它，不直接 import 实现）
ruoyi-common/*       # 24 个公共能力模块（core/web/mybatis/redis/satoken/security/log/doc/excel/oss/json/
                     #   encrypt/sensitive/translation/mail/sms/social + ai/mcp/elasticsearch/mqtt/push/job）
ruoyi-modules/*      # system / ai / workflow / job / gen / demo / zhiyu
ruoyi-extend/*       # monitor-admin / snailjob-server / snailai-server（独立部署 Server）
```

## 技术栈（关键版本）

| 维度 | 技术 | 版本 |
|------|------|------|
| 运行 | Java / Spring Boot / 容器 | 21 / 4.1.0 / Jetty |
| 持久 | MyBatis-Plus(boot4) / MPJ / dynamic-datasource | 3.5.17 / 1.5.9 / 4.5.0 |
| 认证 | Sa-Token(boot4) | 1.45.0 |
| 缓存 | Redisson / 序列化 Apache Fory | 4.6.1 / 1.3.0 |
| 任务 | SnailJob（含延迟队列、MapReduce） | 2.0.2 |
| 存储 | AWS SDK v2 S3（适配 MinIO/OSS/COS） | 2.48.1 |
| Excel | Apache Fesod（原 EasyExcel） | 2.0.2-incubating |
| 工作流 | Warm-Flow（另含 LiteFlow 编排） | 1.8.9 / 2.16.1.2 |
| AI | Snail AI（gRPC/OpenAPI）/ Spring AI + MCP | 1.1.1 / 2.0.0 |
| 搜索 | Easy-Es / ES Client | 3.0.2 / 7.17.28 |
| 其它 | mica-mqtt / SMS4J / JustAuth / SpringDoc / Hutool / MapStruct-Plus | 2.6.8 / 3.3.5 / 3.0.1 / 3.0.3 / 5.8.47 / 1.5.1 |

> 实证辟谣：无 `langchain4j`（AI 走 Snail AI + Spring AI/MCP）；无 `Fastjson2`（JSON 用 Jackson）；无 `Knife4j`（SpringDoc 原生）。

## 代码生成器（ruoyi-gen，6.x 重构）

- 模板引擎 **FreeMarker(.ftl)**（已由 Velocity 迁移），模板在 `ruoyi-modules/ruoyi-gen/src/main/resources/fm/`。
- **多前端栈**：`gen_table.frontend_type` → `fm/<type>/`：`vue`（Element Plus）/ `react`（Ant Design Pro）。新增前端栈只加 `fm/<type>/` 目录 + 4 个 FTL，不在 Java 里加硬编码分支。
- 上下文变量大幅扩充（needXxx 列开关、enableExport/Status/Unique/Sort、树字面量），写 `.ftl` 直接用已算好的值，别在模板里再扫列。

## 绝对禁止的写法（框架）

| 错误 | 正确 |
|------|------|
| 包名 `plus.ruoyi.*` / `com.ruoyi.*` | `org.dromara.*` |
| 引入 DAO 层 / `buildQueryWrapper()` | 无 DAO，Service 直接用 `BaseMapperPlus` + `QueryBuilder` |
| Entity `extends TenantEntity` | `extends BaseEntity` |
| `extends ServiceImpl<>` | 接口 + impl，不继承 |
| `PlusLambdaQuery` / `likeCast` | `QueryBuilder.lambda` + `likeIfText/eqIfText` |
| `BeanUtil.copyProperties()` | `MapstructUtils.convert()` |
| API `/pageXxxs`、`/getXxx/{id}` | 标准 `GET /list`、`GET /{id}`、`POST`、`PUT`、`DELETE /{ids}` |
| 逻辑删除 `is_deleted` | `del_flag`（`@TableLogic`） |
| Controller 暴露 Entity | 用 BO 入参、VO 出参 |
| 管理接口漏权限注解 | `@SaCheckPermission` + 写操作 `@Log` |
| 跨模块直接 import 另一业务模块实现 | 走 `ruoyi-api` 接口契约 |
| `> nul`（Windows 会建名为 nul 的文件） | 不重定向，或 `> /dev/null 2>&1` |

## 快速命令

| 命令 | 用途 |
|------|------|
| `/dev` | 开发新功能（全栈代码生成） |
| `/crud` | 快速 CRUD（FreeMarker + 双前端栈） |
| `/check` | 代码规范检查（框架约定） |
| `/progress` | 项目进度报告 |
| `/next` | 下一步建议 |
| `/start` | 项目快速启动 |

## 开发前检查清单（动手前过一遍）

- [ ] 已读目标模块最近似的现有代码（优先复用其写法）
- [ ] 已评估并列出本次命中的技能，且**已 Read 全部命中的 SKILL.md**
- [ ] 包名 `org.dromara`，三层无 DAO，Entity `extends BaseEntity`
- [ ] 查询用 `QueryBuilder.lambda` + IfText/IfPresent，分页 `selectVoPage` + `PageResult.build`，转换用 `MapstructUtils`
- [ ] BO/VO 用 `@AutoMapper`，转换用 `MapstructUtils`
- [ ] 写接口带权限 `@SaCheckPermission` + 日志 `@Log`，标准 REST 路径，BO 入参 / VO 出参
- [ ] 不违反「绝对禁止」表 / 未引入任何 `plus.ruoyi` / DAO / `PlusLambdaQuery` / `TenantEntity(默认)` / `is_deleted` 等衍生版写法
- [ ] UTF-8 无 BOM、LF 换行；中文可读

---

## Codex 技能系统

- **技能发现 / 加载**：Codex 启动时自动扫描 `.codex/skills/` 下所有 SKILL.md 的 YAML frontmatter（name + description + 触发场景 + 触发词）作为技能索引装入上下文，**无需手动列目录**——启动时已经"知道"有哪些技能、各自何时触发；但 frontmatter 只是索引，**技能正文必须按需用 Read 读取**。完整技能清单（48 个，含触发词）见 [`docs/codex-skills-index.md`](docs/codex-skills-index.md)。
- **强制评估流程**（UserPromptSubmit Hook 注入指令）：每次用户提问，先评估命中哪些技能（无匹配则写"无匹配技能"），再**逐个 Read 读完命中的 SKILL.md 全文**才开始执行命令/写代码，实现前在回复中列出已读取的技能名，让用户可核对。
- **Hooks 协同**（`.codex/hooks.json` 注册，配合 `.codex/config.toml` 的 `[features] hooks = true` 开关，仅在 `.codex/` 被标记 trusted 时生效）：`session-start.cjs`（SessionStart）注入最近经验摘要；`skill-forced-eval.cjs`（UserPromptSubmit）注入强制技能评估流程；`pre-tool-use.cjs`（PreToolUse）工具前安全检查（拦截危险命令、`> nul` 等）；`stop.cjs`（Stop）会话收尾清理。
- **与 `.claude/agents/` 互补**：`.claude/agents/` 的 6 个后端 subagent（backend-common-infrastructure / backend-crud / backend-engineering / backend-javadoc / backend-module-enhancement / backend-query-permission）是更细分的后端角色定义，与技能体系互补共存。
- **典型场景映射**：新增 CRUD 模块 → `crud-development` + `database-ops`；接入 Snail AI → `snail-ai-integration`（必要时叠加 `mcp-integration`）；排查"列表查询为空" → `bug-detective` + `performance-doctor` / `database-ops`。
- **禁止行为**：🔴 禁止跳过 Read 凭"印象/训练数据"写框架代码；🔴 禁止套用 `plus.ruoyi` / `com.ruoyi` 等衍生版约定（DAO 层 / `buildQueryWrapper()` / `PlusLambdaQuery` / `likeCast` / 默认 `TenantEntity` / `is_deleted` / `/pageXxxs`，本仓库一律为错）；🔴 禁止凭空编造技术栈（无 `langchain4j` / `Fastjson2` / `Knife4j`；JSON 走 Jackson 3（`tools.jackson.*`），AI 走 Snail AI + Spring AI/MCP，文档走 SpringDoc）。
- **核心原则**：**先评估、先 Read、再实现**——命中技能不读正文 = 没用技能。一切以 `org.dromara` 原版真实代码为准，凡与衍生版约定冲突，原版优先。
