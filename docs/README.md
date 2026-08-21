# 文档索引（AI 协作者导航入口）

> 本目录是知与 SaaS 的**制度性框架**：spec、规范、决策记录都集中在这里（**Java + Vue 单栈**）。AI 协作者接到任何任务，先按「任务类型」查下表定位要读哪份规范。
>
> **第一入口永远是根目录的 [`AGENTS.md`](../AGENTS.md)**（Java + Vue 单栈契约 + 全流程）；本目录是契约引用的细则。

## 按任务类型定位

| 我要做什么 | 先读 |
|---|---|
| 任何开发任务的**第一步** | [`../AGENTS.md`](../AGENTS.md)（契约 + spec-first 硬约束） |
| **判任务类型 / 走开发流程** | [`dev-processes.md`](dev-processes.md)（新功能七节点闭环 / 修复 / 重构，AGENTS.md §一 细则） |
| **分层 / 安全红线全文** | [`architecture-constraints.md`](architecture-constraints.md)（AGENTS.md §三 细则，依据 ADR-0001/0003） |
| **Codex 技能完整清单** | [`codex-skills-index.md`](codex-skills-index.md)（48 个，含触发词；正文按需 Read） |
| **新增/变更功能** | [`spec-standards.md`](spec-standards.md)（spec 分级/模板/DoD + 7 节点闭环）→ 对应 [`spec/`](spec/) |
| **写/改后端代码** | 根 `AGENTS.md` 第二部分（Java 框架契约：controller/service/mapper 分层与复用）+ [`初始化与部署指南.md`](初始化与部署指南.md) |
| **Java 后端初始化/部署/多租户** | [`初始化与部署指南.md`](初始化与部署指南.md)（Java 框架环境/启动/构建/Docker）+ [`多租户功能扩展规范.md`](多租户功能扩展规范.md)（Java 多租户扩展）+ [`Git Flow 开发协作简易指南.md`](Git Flow 开发协作简易指南.md)（Java 分支/提交/MR） |
| **写/改前端页面组件** | Vue 门户/管理端（`plus-ui`：`src-portal` 门户、`src` 管理端）：[`spec/vue-business-portal.md`](spec/vue-business-portal.md) + 根 `AGENTS.md` 第二部分（Element Plus / RuoYi 组件体系） |
| **安全非功能（密码/会话/密钥/限流/上传）** | [`security-standards.md`](security-standards.md) |
| **性能/可观测/国际化/测试** | [`non-functional-standards.md`](non-functional-standards.md) |
| **跑 / 扩展自动化测试（UI 冒烟 + 单测）** | [`testing-guide.md`](testing-guide.md)（全量页面访问冒烟 + CRUD 巡检 + 后端/前端单测门禁） |
| **写/审任何文档** | [`documentation-standards.md`](documentation-standards.md)（分层 + 砍废话）+ [`prose-standards.md`](prose-standards.md)（文字品控） |
| **做架构取舍/技术选型** | [`decisions/README.md`](decisions/README.md)（ADR：先看有没有既有决策） |
| **审 PR / 审改动** | [`code-review-checklist.md`](code-review-checklist.md)（语义检查） |
| **找可简化处 / 重构** | [`simplification-notes.md`](simplification-notes.md)（简化审计 + Agent Note） |
| **理解快照版本机制** | [`resource-snapshot-versioning.md`](resource-snapshot-versioning.md) |
| **从上游框架同步代码/配置** | [`upstream-sync-notes.md`](upstream-sync-notes.md)（有意偏离上游、防误还原清单） |

## 文档分类（教程 vs 参考）

见 [`documentation-standards.md`](documentation-standards.md) 的判定标准。当前现状：

### 参考型（按需查，不要求顺序读）

- **规范/红线**：`security-standards.md`、`spec-standards.md`、`documentation-standards.md`、`prose-standards.md`、`code-review-checklist.md`、`simplification-notes.md`、`refactor-layering.md`（Go 时代分层方案，已由 AGENTS.md 第二部分覆盖，历史参考）
- **速查/盘点**：`resource-snapshot-versioning.md`、`upstream-sync-notes.md`（上游同步防误还原清单）
- **规格（spec）**：`spec/` 全部（单一事实源，按需查）
- **决策（ADR）**：`decisions/` 全部（为什么这么做）

### 教程型（按顺序做完一件事）

- [`初始化与部署指南.md`](初始化与部署指南.md)：Java 框架从零初始化 → 数据库 → 本地启动 → 生产构建 → Docker 部署（按顺序走）
- [`testing-guide.md`](testing-guide.md)：UI 冒烟测试怎么用（全量页面访问冒烟 + CRUD 巡检）+ 后端/前端单测快速门禁

## 目录结构速览

```
docs/
├── spec/                        # 功能规格（单一事实源）
│   ├── 01-prd.md ~ 05-prototype-interaction.md   # 全平台五层（06 验收流程已废弃删除）
│   ├── partner-enterprise-platform.md            # 子平台示例
│   └── vue-business-portal.md                    # Vue 业务门户（Java 配套）
├── decisions/                   # ADR 决策记录（为什么这么做）
│   ├── README.md                # 索引 + 何时写
│   └── 0000-template.md         # 模板
├── spec-standards.md            # spec 规范（分级/模板/DoD/7 节点闭环）
├── dev-processes.md            # 开发流程细则（新功能七节点/修复/重构，AGENTS.md §一）
├── architecture-constraints.md # 分层/安全红线全文（AGENTS.md §三）
├── codex-skills-index.md       # Codex 技能完整清单（48 个，含触发词）
├── documentation-standards.md   # 文档分层 + 砍废话
├── prose-standards.md           # 全仓文字品控
├── code-review-checklist.md     # 审 PR 语义检查
├── simplification-notes.md      # 简化审计 + Agent Note
├── refactor-layering.md         # Go 时代分层方案（历史参考，已由 AGENTS.md 第二部分覆盖）
├── backend-reuse.md             # Go 时代后端复用速查（历史参考，已由 AGENTS.md 第二部分覆盖）
├── security-standards.md        # 安全非功能规范（密码/会话/密钥/限流/上传）
├── resource-snapshot-versioning.md  # 快照版本机制
├── upstream-sync-notes.md           # 上游框架同步备忘（防误还原清单）
├── testing-guide.md                # 自动化测试使用指南（UI 冒烟 + 单测门禁）
├── 系统功能清单.md               # 全平台能力盘点（人类/AI 对照用）
├── 初始化与部署指南.md              # Java 框架初始化/启动/构建/Docker（教程型）
├── 多租户功能扩展规范.md            # Java 多租户扩展规范
└── Git Flow 开发协作简易指南.md     # Java 分支/提交/MR 规范

db/migrations/                   # 数据库迁移（up/down 配对 SQL，deploy.sh 纯 psql 执行）
```

## scripts/ 工具与框架资产清单

> `script/`（单数，上游框架目录）已并入本目录统一管理；框架初始化 SQL / Docker/Nginx 配置 / bin 启停脚本见下。

| 脚本/目录 | 用途 |
|---|---|
| `deploy.sh`（仓库根目录） | **唯一部署入口**（Java+Vue 单栈）：门禁默认开启 + 分段启动 + 健康门禁 + 业务冒烟 + 失败回滚 + 自动合并（契约见 `spec/03-development-plan.md` §5） |
| `scripts/spec-check.sh` | spec 校验共 14 项：阻断级（分层红线/LLM 直连/migration 配对/spec 五层制品/ADR 索引双向/安全红线/schema↔migrations 编号/表数机械校验/机器码词汇表/spec 随代码变更/新端点带测试）+ 提示级（路由↔契约覆盖/验收流程一致性/新端点租户校验提示/down 不可逆标注/XSS） |
| `scripts/package-release.sh` | 离线实施包打包 |
| `scripts/migrate_uploads.sh` | 上传文件迁移 |
| `scripts/ui-smoke/` | 全站点击巡检（UI smoke test） |
| `scripts/sql/` | 框架初始化 SQL（`ry_vue/ry_job/ry_workflow/ry_ai.sql`，方言在 `mysql/`、`oracle/`、`sqlserver/` 子目录） |
| `scripts/docker/` | 框架 Docker Compose / Nginx / Redis 配置（`docker-compose.yml`、`nginx/conf/nginx.conf`、`redis/conf/redis.conf`、`database.yml`） |
| `scripts/bin/` | 框架启停脚本 `ry.sh` / `ry.bat` |
| `scripts/leave/` | 工作流请假流程 JSON 模板 |
