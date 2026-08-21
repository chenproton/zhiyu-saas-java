# 知与 SaaS 仓库开发契约（Java + Vue 单栈）

> 分支模型说明：本仓库**主线只有 `master`**，按「分支隔离 + 部署成功自动合并 master」协作（见第四节）。
>
> 本仓库为**单栈架构**：**Java 后端多模块 Maven 工程位于仓库根目录**（`pom.xml` + `mvnw` + `ruoyi-*/` + `script/`，基于 base-dev-framework6-java 框架，`org.dromara` 包名，Spring Boot 4 / Java 21，布局与上游框架技术方案对齐），共用 MySQL 8.0，前端为 **`plus-ui/` 单工程双构建**（RuoYi 框架，位于仓库根）：**admin 管理端**（`plus-ui/src` → `dist`）+ **portal 业务门户**（`plus-ui/src-portal` → `dist-portal`），一份 package.json / lockfile / node_modules，运行时仍是两个独立 SPA。Go 后端与 React 前端已于 2026-08 完成迁移并删除。
> 开发契约分两部分：第一部分为仓库级开发契约（spec-first / 部署 / 运维），第二部分为 Java 后端框架契约。按所改模块选择对应契约执行。

### 顶层目录结构

```
├── pom.xml / mvnw     # Java 后端 Maven 根工程（多模块，org.dromara）
├── ruoyi-admin/       # 后端唯一可执行入口
├── ruoyi-api/         # 跨模块 API 契约层
├── ruoyi-common/*     # 24 个公共能力模块
├── ruoyi-modules/*    # 业务模块：system / ai / workflow / job / gen / demo / zhiyu
├── ruoyi-extend/*     # 独立部署服务：monitor-admin / snailjob-server / snailai-server
├── script/            # 框架初始化 SQL、Docker Compose、Nginx 配置
├── plus-ui/           # Vue 管理端 + 业务门户双应用工程（admin：src/ → dist；portal：src-portal/ → dist-portal）
├── db/migrations/     # 数据库迁移（up/down 配对 SQL，deploy.sh 纯 mysql 执行）
├── docs/              # 全量文档（spec、ADR、规范）
├── deploy/            # docker-compose / nginx / Dockerfile（Java+Vue 单栈编排）
├── scripts/           # spec-check / ui-smoke / package-release 等工具
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

> 判断任务类型 → 走对应流程。流程细节依据见 [`docs/spec-standards.md`](docs/spec-standards.md)「Spec 工作流」。

| 任务类型 | 判断标准 | 流程 |
|---|---|---|
| **新功能** | 增加能力 / 新模块 / 新接口 | 七节点闭环（见下） |
| **修复 bug** | 现有行为与 spec/预期不符 | 修复流程（见下） |
| **重构** | 行为不变，仅改结构/可读性 | 重构流程（见下） |

### （一）新功能：七节点闭环

1. **对齐意图**：读本契约 + 相关 `docs/*.md` + `docs/decisions/`（ADR），确认红线与既有决策。**不写代码**。
2. **明确需求**：把需求澄清为「做什么/为什么」，聚焦 **WHAT/WHY，不碰 HOW**（不写技术栈/表结构/代码组织）。不清楚就问用户。
3. **制定方案**：需求 → 数据模型 / API 契约 / 测试场景。**每个技术选择记录理由并回链需求**。选型需拍板时问用户。
4. **拆解任务**：生成可执行任务清单，标依赖与可并行项（`[P]`）。
5. **实现**：写代码 + 测试 + migration，**同时回写 spec**（spec-first 硬约束）。走「四、分支隔离工作流」。
6. **校验**：`./scripts/spec-check.sh`（硬约束）+ 语义自查（spec 说的有没有实现、代码做的有没有写进 spec）。
7. **收敛**：对照 spec 评估，把「没做完/偏航/新增件」记回任务或 spec，形成下轮输入。

### （二）修复 bug 流程

1. **定位意图**：先读 spec 与 ADR，确认「正确行为」（bug = 实现偏离了 spec/合理预期）。
2. **补测试**：先写/改能复现 bug 的测试（红）。
3. **修复**：改代码让测试通过（绿）。**若修复改变行为 → 同步 spec**；纯修复不改 spec，但 commit 说明。
4. **校验**：`spec-check.sh` + 本地门禁 + `deploy.sh --branch` 部署。

### （三）重构流程

1. **确认行为不变**：重构必须等价变换；若改可观察行为 → 走「新功能/修复」，不是重构。
2. **评估收益**：按 [`docs/simplification-notes.md`](docs/simplification-notes.md) 给证据（调用点），区分「真简化」vs「有意为之」（查 ADR）。
3. **执行**：改结构，**不同步 spec**（行为没变）。
4. **校验**：`spec-check.sh` + 全量门禁确认无回归 + 部署。

## 二、开发原则（写代码时的心法）

- **规格先行（spec-first）**：功能开发先读 `docs/spec/` 对齐意图再写代码；新增/变更行为必须同步 spec。见 [`docs/spec-standards.md`](docs/spec-standards.md)。
- **简单优先**：不过度防御；小概率异常宁可容忍；核心业务加锁防重复，普通业务允许报错或重复插入；核心接口保流畅，非核心允许等待。
- **组件复用优先**：接到需求先判断能否复用现有组件/函数/模式，能复用直接使用；需抽公共组件先向用户提方案、经确认后实施。前端复用查 plus-ui `src-portal/components/` 与 `src-portal/views/*/_components/`（React 时代速查表 `docs/components.md`/`docs/forms-tables.md` 已标历史墓碑）；后端复用查 `ruoyi-modules/ruoyi-zhiyu/src/main/java/org/dromara/zhiyu/core/` 与 `.codex/skills/` 框架技能（`docs/backend-reuse.md` 已标历史墓碑）。
- **性能自检（温和，写代码时自问，不硬拦）**：涉及列表/批量/聚合的代码，写完自问——① 有没有循环内逐条 SQL（N+1）？应改 JOIN / `IN($N)` / 批量；② 列表/聚合查询有没有显式 LIMIT 或「数据量有界」的论证？③ 新增后台任务/goroutine 有没有超时 + panic 兜底 + 去重？④ 新增外部 HTTP 调用有没有设 timeout？「简单优先」指代码形状简单（一行 JOIN 与十行循环一样简单），不代表可以先写 N+1 再说。详见 [`docs/code-review-checklist.md`](docs/code-review-checklist.md)。

## 三、硬性架构约束（安全 + 架构合理的落地红线）

> 详细规范与理由见对应文档；这里只列「必须遵守」的硬条款，其余放文档。

### 3.1 后端分层红线（Java 框架契约，理由见 ADR-0001）

- **controller**：禁止出现裸 SQL（`SELECT/INSERT/UPDATE/DELETE`）、禁止持有 `JdbcTemplate`/`DataSource`/`SqlSessionFactory` 等 DB 句柄、禁止 MyBatis 注解（`@Select` 等）、禁止直接调 mapper。
- **service**：禁止拼接 SQL；业务逻辑统一在 Service 层组装，数据访问走 Mapper。
- **mapper**：禁止读取 HTTP 请求（`HttpServletRequest`）、Sa-Token（`StpUtil`）、租户上下文（`TenantContext`）；SQL 统一带 `tenant_id` 条件做租户过滤。
- 新接口必须附带 controller/service/mapper 测试至少一种。

### 3.2 安全红线（越权 / 租户隔离，理由见 ADR-0003）

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

1. **只改当次任务相关文件**，不碰无关文件；忽略他人未提交修改，不得还原/覆盖。
2. **前端样式修改不主动验证**：禁止无头浏览器视觉验证、DOM/布局测量、CDP 脚本、创建临时测试账号等；样式问题部署后由用户人工确认。
3. **不做端到端验证（默认）**：不跑 UI Smoke / `--route` 单页 / 浏览器自动化，除非用户主动要求；本地验证以编译 + 类型检查 + lint + 单测为准。
   > 例外（属自动化门禁，不是「主动做 E2E」）：`deploy.sh` 部署后自带业务冒烟探针（无浏览器、无账号，失败即回滚）。
4. **扫描/统计只覆盖自有代码**：排除 `offline/`、`node_modules/`、`dist/`、`*.tsbuildinfo`、`logs/`、`*/target/`。

## 六、规范索引（细则去哪找）

> 完整导航见 [`docs/README.md`](docs/README.md)。按需查，不要求通读。

| 我要 | 读 |
|---|---|
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

# 第二部分：Java 后端框架契约（base-dev-framework6-java）

# AGENTS.md - base-dev-framework6-java · Codex 入口

## 语言设置
**必须使用中文**与用户对话。

## 项目定位

本项目 **base-dev-framework6-java** 是**公司统一研发基础框架**（`org.dromara` 包名、Spring Boot 4 / Java 21 / Jakarta EE 10），**前后端一体化单仓库**：本仓库中 Java 后端多模块 Maven 工程位于仓库根，配套前端为 `plus-ui` 单工程双构建——Vue 管理端（`plus-ui/src`，RuoYi 框架）与 Vue 业务门户（`plus-ui/src-portal`，Element Plus + Pinia），代码生成器内置模板产出前端骨架。

> 🔴 **本项目遵循框架约定**：包名 `org.dromara`，**三层架构无 DAO 层**（Controller→Service→Mapper，直接用 `BaseMapperPlus`），Entity 继承 `BaseEntity`，查询用 `QueryBuilder.lambda`，标准 REST 路径（`/list`、`/{id}`）。不要套用 `plus.ruoyi` / DAO 层 / `PlusLambdaQuery` / `/pageXxx` 等其它衍生版约定。

## 🔴 文件编码规范（必须遵守）

- 所有源码与配置文件统一 **UTF-8（无 BOM）、LF 换行**（遵循 `.editorconfig`）。Java 4 空格，JSON/YAML 2 空格。
- 绝对禁止 UTF-8 with BOM / GBK / GB2312 / ANSI 混用。
- `java: 非法字符: '﻿'` → 优先判定为 BOM：定位文件 → 移除文件头 BOM → 扫描同目录 `.java` → 重新编译验证。
- 中文注释/日志/文档必须可读，不允许乱码。

## 🔴 Git Flow 分支与提交规范（必须遵守）

> ⚠️ **边界说明（本仓库 vs 上游）**：本节为上游框架公司规范原文，保留用于上游同步对照。**本仓库实际执行第一部分的「单 master + 分支隔离」模型**（无 main/dev/release 分支、不打版本 Tag、合并走 deploy.sh 自动直推 master），提交 message 用 `type(scope): subject` 格式、**不要求禅道 Issue ID**。本节下方的 main/dev/release/hotfix 红线与禅道 ID 要求对本仓库不生效。

> 提交代码、创建/合并分支、发版前**必须**先阅读 `docs/Git Flow 开发协作简易指南.md`，并**强制**按以下约定执行。

### 分支模型与硬性红线

| 分支 | 命名 | 来源 | 合并去向 | 说明 |
|------|------|------|---------|------|
| main | `main` | - | - | 生产基线，**只接受** `release/*` 与 `hotfix/*` 的合并，合并后**必须打唯一版本 Tag**（如 `v1.2.0`） |
| dev | `dev` | main | release | 开发主线，接受 `feat/*`、`hotfix/*`、`release/*` 的合并 |
| release | `release/<版本>` | dev | main & dev | 预发/冻结分支，验证通过后合并 main 与 dev，**立即删除** |
| feature | `feat/<禅道ID_描述_代号>` | dev | dev | 个人功能分支，开发完合并回 dev **后删除** |
| hotfix | `hotfix/<版本_代号>` | main | main & dev & release | 线上紧急修复，**必须反向同步回 dev**（存在活跃 release 时也同步） |
| customer | `cust/<name>` | **main 的稳定 Tag** | - | 客户定制分支，通用功能经"重构/配置化"后回流 dev |

1. 🔴 **严禁** `dev` 或其他功能开发分支直接合并入 `main`；`main` 只接受 `release` 与 `hotfix` 的合并。
2. 🔴 发布链路严格 `dev` → `release/<版本>` → `main`；**合并到 main 后必须打唯一版本 Tag** 作为不可变代码基线。
3. 🔴 `hotfix` **必须**反向同步回 `dev`（闭环）；存在活跃 `release` 分支时必须同步到该 `release`。
4. 🔴 `cust/<name>` 必须基于 `main` 的**稳定 Tag** 拉出；客户定制通用功能需"重构/配置化"后才能合并回 `dev` 主线。

### 提交信息格式（强制）

每次提交**必须**写 Commit message（否则不允许提交），格式：`type(scope): subject`，**主体需关联禅道 Issue ID**：

```text
<type>(<scope>): <subject> [Bug-<IssueID>]
```

示例：`fix(api): 增加课程章节分级接口 [Bug 1111]`

`type` 取值：`feat`（新功能）/ `fix`（修补 Bug）/ `docs`（文档）/ `style`（格式）/ `refactor`（重构）/ `chore`（构建/工具）/ `test`（测试）。

### MR 合并准则（强制）

1. 提交 MR 前**必须**本地编译 + 基础自测通过。
2. MR 必须经过**至少 1 位**同事 Code Review 才能合并；**main 与 release 分支**的 MR 须技术负责人或项目维护者最终批准。
3. MR 标题遵循 `type: subject [禅道指令 ID]` 格式，描述需说明功能点、影响范围、测试结果。
4. `feat` / `hotfix` 分支 MR 合并完成后**必须勾选删除源分支**。

## 🔴 Skills 强制评估（Codex 版 · 必须遵守）

> Codex 启动时已**自动从 `.codex/skills/` 加载所有 SKILL.md 的 frontmatter**（name + description + 触发词），故无需手动扫描技能目录。每次用户提问时，UserPromptSubmit Hook（`.codex/hooks/skill-forced-eval.cjs`）会注入"强制技能评估流程"指令。必须严格遵循：

1. **评估**：根据已加载的技能 frontmatter，列出与本次任务匹配的技能及理由（无匹配则写"无匹配技能"）。
2. **加载**：对每个匹配技能，先用 **Read** 逐个读取 `.codex/skills/<技能名>/SKILL.md` 全文，**读完之后**才开始执行命令 / 写代码。
3. **实现**：按技能文档中的 框架规范实现。

**Skills 位置**：`.codex/skills/<技能名>/SKILL.md`。

> 本仓库内置 **`.claude/agents/`**（6 个后端 subagent）与 **`.codex/skills/`**（分场景技能体系）。二者**互补共存**：agents 是后端专项子代理，技能是场景化编码规范。

## 🔴 经验沉淀目录加载（会话开始时）

会话开始（首次响应用户）前，若 `.claude/docs/experience/` 有内容，执行：
```bash
ls -t .claude/docs/experience/*/*-exp-summary.md 2>/dev/null | head -1
```
有输出 → 读取该最近摘要作为本次会话经验上下文（已沉淀的禁令/踩过的坑）。读完即可，不必复述。
**例外**：用户首条是简单问候或与项目无关的纯通用问题，可跳过。

> Codex 端 `.codex/hooks/session-start.cjs` 在 SessionStart 事件中会自动把最近的经验摘要注入到 `additionalContext`，二者互为补充。

---

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

### 模块拓扑（均位于 `` 下）

```
ruoyi-admin          # 唯一可执行入口
ruoyi-api            # 跨模块 API 契约层（仅依赖 common-core；跨模块调用走它，不直接 import 实现）
ruoyi-common/*       # 24 个公共能力模块（core/web/mybatis/redis/satoken/security/log/doc/excel/oss/json/
                     #   encrypt/sensitive/translation/mail/sms/social + ai/mcp/elasticsearch/mqtt/push/job）
ruoyi-modules/*      # system / ai / workflow / job / gen / demo
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

## 开发前检查清单

- [ ] 已读目标模块最近似的现有代码（优先复用其写法）
- [ ] 包名 `org.dromara`，三层无 DAO，Entity `extends BaseEntity`
- [ ] 查询用 `QueryBuilder.lambda` + IfText/IfPresent 条件，分页 `selectVoPage`+`PageResult.build`
- [ ] BO/VO 用 `@AutoMapper`，转换用 `MapstructUtils`
- [ ] 写接口带权限 `@SaCheckPermission` + 日志 `@Log`，标准 REST 路径
- [ ] 不违反"绝对禁止"表；UTF-8 无 BOM

---

## Codex 技能系统

### 工作原理

本仓库为 Codex CLI 配置了完整的技能系统，与 Claude Code 端体验对称：

- **技能发现 / 加载**：Codex 启动时自动扫描 `.codex/skills/` 下所有子目录，读取每个 `SKILL.md` 的 YAML frontmatter（`name` + `description` + 触发场景 + 触发词），将其作为"技能索引"装入上下文。因此**无需手动列目录**——你启动时已经"知道"有哪些技能、各自何时触发。但 frontmatter 只是索引，**技能正文必须按需用 Read 读取**。
- **Hooks 协同**（由 `.codex/hooks.json` 注册，配合 `.codex/config.toml` 的 `[features] hooks = true` 开关，仅在 `.codex/` 被标记 trusted 时生效）：
  - `session-start.cjs`（SessionStart）：会话开始时自动把最近的经验摘要（`.claude/docs/experience/*/*-exp-summary.md`）注入 `additionalContext`，让你带着历史踩坑记录开场。
  - `skill-forced-eval.cjs`（UserPromptSubmit）：每次用户提问时注入约 500 字的"强制技能评估流程"指令（评估 → Read 技能 → 实现），因 Codex 已自动加载 frontmatter，hook 只需注入流程而非完整技能列表。
  - `pre-tool-use.cjs`（PreToolUse）：在 Bash / Edit / Write / apply_patch 等工具执行前做安全检查（如拦截危险命令、`> nul` 等）。
  - `stop.cjs`（Stop）：会话结束时做清理与收尾提示。

### 技能清单与触发条件（共 48 个）

> 42 个镜像技能（与 `.claude/skills/` 内容一致）+ 6 个命令技能（`dev` / `crud` / `check` / `progress` / `next` / `start`）。按字母排序：

| 技能名 | 触发词 / 用途 |
|--------|--------------|
| `add-skill` | 添加技能、创建技能、新技能、写技能、技能文档、修改技能、更新技能、技能同步——为框架增加/修改/重命名/删除技能并同步双系统 |
| `api-development` | API设计、接口规范、RESTful、URL设计、接口路径、R\<T\>、统一响应、接口命名、端点设计、前后端联动、export导出——接口设计规范（完整模块开发用 crud-development） |
| `architecture-design` | 架构设计、模块划分、分层、解耦、依赖管理、ruoyi-api、契约层、模块拓扑、重构、领域划分、系统设计——模块拓扑/契约层/三层架构/何时新建模块 |
| `backend-annotations` | 注解、@Translation、翻译、ID转名称、字典转标签、@RateLimiter、@RepeatSubmit、@Sensitive、@DataPermission、@Log、@EncryptField、@Lock4j、@DS、@SaCheckPermission、@AutoMapper、分组校验——后端高级注解总索引（重点 @Translation 序列化映射） |
| `brainstorm` | 头脑风暴、方案、怎么设计、有什么办法、创意、讨论、探索、想法、建议、怎么做、如何实现——方案探索与创意思维 |
| `bug-detective` | Bug、报错、不工作、调试、排查、为什么、出问题、失败、不生效、无效、定位问题——排查已发生的问题、定位 Bug（设计异常机制用 error-handler） |
| `check` | /check、代码检查、规范检查、code review、检查代码——命令技能：框架全栈代码规范检查 |
| `code-patterns` | 规范、禁止、命名、Git提交、代码风格、不能用、不允许、约定、红线、禁令、对照表、写法错了——全栈编码禁令与规范速查（错误 vs 正确对照） |
| `collaborating-with-codex` | Codex、协作、多模型、原型、Diff、算法分析、代码审查、codex协同、codex-plugin-cc、codex插件、review-gate——与 OpenAI Codex CLI 协同开发 |
| `collaborating-with-gemini` | Gemini、协作、多模型、前端原型、UI设计、CSS、样式、gemini协同——与 Google Gemini CLI 协同（前端/UI 原型为主） |
| `crud` | /crud、快速CRUD、代码生成、基于表生成、增删改查——命令技能：基于已有表快速生成 CRUD |
| `crud-development` | CRUD、增删改查、新建模块、业务模块、Entity、BO、VO、Mapper、Service、Controller、selectVoPage、PageQuery、QueryBuilder、MapstructUtils、BaseMapperPlus、xxxApi.ts、代码生成器——CRUD 业务模块全栈开发（后端四件套 + 前端数据通道） |
| `data-desensitize` | 脱敏、数据脱敏、@Sensitive、SensitiveStrategy、敏感数据、PII、掩码、手机号脱敏、身份证脱敏、银行卡脱敏、DesensitizedUtils——序列化期 PII 掩码（DB 仍明文） |
| `data-permission` | 数据权限、@DataPermission、@DataColumn、DataScope、行级权限、数据隔离、部门权限、本人权限、自定义权限、权限过滤、PlusDataPermissionHandler、忽略数据权限——行级数据权限（认证授权用 security-guard） |
| `database-ops` | 数据库、MySQL、SQL、表、字段、索引、字典、建表、DDL、del_flag、雪花ID、dynamic-datasource、多数据源、selectVoPage、QueryBuilder、@DS、sys_dict、sys_menu——数据库操作/建表规范/字典菜单/SQL 日志 |
| `deployment-guide` | 部署、上线、发布、生产环境、Docker、Compose、打包、JAR、Jetty、Nginx、反向代理、密钥、profile、application-prod、外置server、monitor-admin、snailjob、snailai-server——部署与上线（JDK21+SB4+Jetty/Docker/三外置 server） |
| `dev` | /dev、开发新功能、全栈开发、新功能、开发模块、写功能——命令技能：开发新功能（全栈代码生成） |
| `dev-startup` | 本地启动、首次启动、跑起来、装环境、装依赖、配置环境、启动后端、JDK21、Maven、mvnw、MySQL、Redis、端口占用、健康检查、actuator、SpringDoc——本地从零搭建后端环境、首次启动、排查启动失败 |
| `elasticsearch-search` | Elasticsearch、ES、Easy-Es、全文检索、搜索引擎、EsMapper、@IndexName、@IndexField、索引、全文搜索——基于 Easy-Es 的 ORM 风格全文检索 |
| `env-config` | 环境配置、profile、application.yml、application-dev.yml、application-prod.yml、多环境、环境变量、SPRING_PROFILES_ACTIVE、占位符、@profiles.active@、${ENV:default}、密钥外置——多环境配置组织/切换/敏感配置脱密（后端） |
| `error-handler` | 异常处理、ServiceException、try-catch、全局异常、GlobalExceptionHandler、错误码、日志规范、@Slf4j、错误提示、校验异常、R响应——设计异常处理机制（排查 Bug 用 bug-detective） |
| `exp-sediment` | 沉淀经验、经验沉淀、总结会话、记下来、记录经验、/exp、exp review、反哺框架、经验审计、避免再踩坑、以前怎么处理、之前的方案、历史经验、查记录、上次怎么解决——经验沉淀（写入）与消费（读取），与 session-start.cjs 配对成闭环 |
| `file-oss-management` | 文件上传、OSS、对象存储、云存储、MinIO、阿里云OSS、腾讯云COS、七牛、S3、AWS、预签名、presigned、SysOss、OssClient、OssFactory——文件上传下载（AWS SDK v2 S3 统一适配） |
| `git-workflow` | git、提交、commit、分支、合并、push、pull、冲突、回滚、版本、历史——Git 版本控制操作 |
| `html-to-code` | HTML转代码、设计稿转换、原型转代码、HTML转Vue、HTML转React、设计稿转页面、区块转换、组件转换、Element Plus、Ant Design Pro——HTML/原型转 6.x 前端代码（Vue 或 React） |
| `i18n-development` | 国际化、多语言、i18n、翻译、MessageUtils、语言切换、content-language、messages.properties、locale、MessageSource、LocaleResolver、zh_CN、en_US——国际化开发（以后端 MessageUtils 为主） |
| `iot-mqtt` | MQTT、物联网、IoT、设备通信、设备消息、mica-mqtt、publish、subscribe、QoS、Topic、EMQX、Mosquitto、共享订阅、设备上线、遗嘱消息——基于 mica-mqtt 的 IoT 通信开发 |
| `json-serialization` | JSON、序列化、反序列化、JsonUtils、Jackson、日期格式、精度、BigDecimal、Long、大数字、类型转换、TypeReference、JSON校验、JsonValueEnhancer、BigNumberSerializer——JSON 处理（Jackson 3，包名 tools.jackson.*） |
| `log-audit` | 操作日志、登录日志、审计、@Log、sys_oper_log、sys_login_info、BusinessType、LogAspect、OperLogEvent、excludeParamNames、isSaveRequestData、日志脱敏——操作/登录日志与审计追踪 |
| `mcp-integration` | MCP、Model Context Protocol、@McpTool、@McpResource、McpClientTemplate、MCP工具、MCP资源、mcp-server、mcp-client、AI工具、agent工具——基于 Spring AI 2.0.0 的 MCP Server/Client 集成 |
| `multi-tenant` | 多租户、租户隔离、tenant_id、TenantHelper、租户切换、ignore、动态租户、sys_tenant、租户套餐、TenantLineInnerInterceptor、SaaS、租户上下文——多租户 SaaS 数据隔离（租户插件 + tenant_id 自动过滤） |
| `next` | /next、下一步、接下来、接下来做什么——命令技能：下一步建议 |
| `performance-doctor` | 性能优化、慢查询、SQL优化、索引、EXPLAIN、N+1、分页优化、缓存、SqlLogInterceptor、SQL日志、响应慢、深分页、HikariCP——性能诊断与优化（"能跑但慢"，逻辑 Bug 用 bug-detective） |
| `progress` | /progress、进度、进度报告、项目进度——命令技能：项目进度报告 |
| `project-navigator` | 项目结构、文件在哪、目录、模块、代码位置、找、定位、在哪里、参考代码、模块职责、ruoyi-common、ruoyi-modules、ruoyi-api、ruoyi-extend、ruoyi-gen、放哪、新建模块——项目结构导航与代码定位 |
| `realtime-push` | 实时推送、消息推送、SSE、WebSocket、PushHelper、服务端推送、广播、在线消息、EventSource、双传输、message.transport、集群广播、通知推送——统一实时推送（SSE/WebSocket 双传输，业务零改动切换） |
| `redis-cache` | Redis、缓存、Cache、@Cacheable、@CacheEvict、RedisUtils、CacheUtils、分布式锁、RLock、Lock4j、限流、@RateLimiter、发布订阅、缓存穿透/雪崩/击穿、缓存key、Redisson、Fory——Redis 缓存/分布式锁/限流/发布订阅 |
| `scheduled-jobs` | 定时任务、SnailJob、延迟队列、@Scheduled、任务调度、重试机制、工作流编排、分布式任务、@JobExecutor、订单超时、周期任务、分片任务、MapReduce、DAG、QueueUtils——定时任务与分布式调度（SnailJob 2.0.0） |
| `security-guard` | 安全、Sa-Token、@SaCheckPermission、@SaCheckLogin、@SaCheckRole、登录认证、Token、LoginHelper、StpUtil、加密、@EncryptField、@ApiEncrypt、限流、@RateLimiter、防重复、@RepeatSubmit、XSS、权限标识——安全开发规范（认证授权/加解密/接口安全） |
| `snail-ai-integration` | AI、Snail AI、SnailAI、大模型、AI对话、Agent、聊天、ai-integration、snail-ai、OpenAPI、AI集成、智能助手——集成/接入/扩展 Snail AI（com.aizuda 0.0.5）大模型能力 |
| `start` | /start、启动、跑起来、本地启动、启动项目——命令技能：项目快速启动 |
| `task-tracker` | 创建任务、跟踪任务、记录进度、任务跟踪、继续任务、恢复任务、查看任务、归档任务、任务列表、方案讨论、技术调研、记录问题——跨会话开发任务进度跟踪（Markdown 持久化） |
| `tech-decision` | 选型、用什么、对比、哪个好、优缺点、选择、技术方案、库、框架、工具、模块——技术选型与方案对比（含选 ruoyi-common 模块） |
| `test-development` | 测试、单元测试、集成测试、@Test、JUnit5、Mockito、Mock、断言、AssertJ、@SpringBootTest、@Mock、@InjectMocks、MockMvc、测试覆盖率、参数化测试、@WebMvcTest、@Tag——测试开发（无统一测试基类） |
| `ui-pc` | 前端、前端页面、Element Plus、el-table、el-form、el-dialog、Ant Design Pro、ProTable、ModalForm、代码生成器前端、Vue页面、React页面、useDict、列表页、表单页、后台页面——后台管理端前端页面（Vue/React 双栈，按生成器模板风格） |
| `utils-toolkit` | 工具类、日期、时间、DateUtils、字符串、StringUtils、集合、StreamUtils、对象转换、MapstructUtils、树结构、TreeBuildUtils、校验、ValidatorUtils、SpringUtils、RedisUtils、Hutool——后端工具类速查，选对工具避免重复造轮子 |
| `workflow-warmflow` | 工作流、流程、审批、Warm-Flow、WorkflowService、流程引擎、发起流程、办理任务、待办、已办、流程图、审批流、ProcessEvent、workflow——Warm-Flow 国产工作流引擎集成（业务只依赖 ruoyi-api 契约） |
| `writing-plans` | 写计划、制定计划、实施计划、拆解任务、任务拆解、计划层、把方案落地、详细步骤、可执行计划、计划文档、开发计划、实施方案——把方案/需求拆成可直接执行的细颗粒任务台账 |

### 强制执行规则

1. **先 Read 再实现**：评估命中某个技能后，**必须先用 Read 读完 `.codex/skills/<技能名>/SKILL.md` 全文**，再开始写代码 / 执行命令。frontmatter 只是索引，正文才含框架真实约定、源码路径、坑点与禁令。**禁止跳过 Read 凭印象直接动手**。
2. **多技能组合全部读**：一个任务命中多个技能时（例如"新增模块 + 数据权限 + 缓存"），把所有命中的 SKILL.md **逐个读完**再统一实现，不要只读一个就开干。
3. **标注已用技能**：实现前在回复中**明确列出本次评估命中并已读取的技能名**（如"已读取 crud-development + database-ops"），让用户可核对技能是否被正确应用。

### 示例（典型场景）

- **新增 system 模块 CRUD（如"部门通知"表）** → 命中 `crud-development`（后端四件套 + 前端数据通道）+ `database-ops`（建表规范 / DDL / del_flag / 雪花 ID）。先 Read 两个 SKILL.md，再按 `org.dromara.*`、三层无 DAO、`QueryBuilder.lambda` + `selectVoPage`、`@AutoMapper` + `MapstructUtils` 实现。
- **接入 Snail AI 智能对话 / Agent** → 命中 `snail-ai-integration`（必要时叠加 `mcp-integration`）。Read 后按 `snail-ai` 配置（gRPC 地址 / app-id / token）、返回结构 Result vs R、enabled 开关与 5001 认证排查实现，不凭记忆编 langchain4j（本仓库无）。
- **排查"列表查询返回为空"** → 命中 `bug-detective`（定位原因）+ `performance-doctor` / `database-ops`（开 `SqlLogInterceptor` 抓真实 SQL）。Read 后按技能流程排查数据权限过滤、租户过滤、`del_flag`、查询条件 IfText 是否命中，而非盲目改代码。

### 与 .claude/agents/ 后端 subagent 互补

- `.claude/agents/` 6 个后端 subagent（`backend-common-infrastructure` / `backend-crud` / `backend-engineering` / `backend-javadoc` / `backend-module-enhancement` / `backend-query-permission`），是更细分的后端角色定义，与技能体系互补。

### 禁止行为

- 🔴 **禁止跳过 Read 直接写代码**：未读对应 SKILL.md 就凭"印象/训练数据"写框架代码——会写出过时或错误的约定。
- 🔴 **禁止套用 `plus.ruoyi` / `com.ruoyi` 等衍生版约定**：本项目遵循框架约定，**不得引入** `plus.ruoyi` 包名、DAO 层 / `buildQueryWrapper()`、`PlusLambdaQuery` / `likeCast`、默认 `TenantEntity`、`is_deleted` 逻辑删除字段、`/pageXxxs` 非标准路径——这些是其它衍生版（ruoyi-plus-uniapp）写法，在本仓库一律为错。
- 🔴 **禁止凭空编造技术栈**：无 `langchain4j` / `Fastjson2` / `Knife4j`；JSON 走 Jackson 3（`tools.jackson.*`），AI 走 Snail AI + Spring AI/MCP，文档走 SpringDoc。

### 自检清单（动手前过一遍）

- [ ] 已评估并列出本次命中的技能，且**已 Read 全部命中的 SKILL.md**
- [ ] 包名 `org.dromara`，三层无 DAO，Entity `extends BaseEntity`
- [ ] 查询用 `QueryBuilder.lambda` + IfText/IfPresent，分页 `selectVoPage` + `PageResult.build`，转换用 `MapstructUtils`
- [ ] 写接口带 `@SaCheckPermission` + `@Log`，标准 REST 路径，BO 入参 / VO 出参
- [ ] 未引入任何 `plus.ruoyi` / DAO / `PlusLambdaQuery` / `TenantEntity(默认)` / `is_deleted` 等衍生版写法
- [ ] UTF-8 无 BOM、LF 换行；中文可读

### 核心原则

**先评估、先 Read、再实现**——Codex 自动加载的只是技能索引，真正的 6.x 约定藏在各 SKILL.md 正文与真实源码里。命中技能不读正文 = 没用技能。一切以 `org.dromara` 原版真实代码为准，凡与衍生版约定冲突，原版优先。
