# 上游框架同步备忘（防误还原清单）

> 参考型备忘。本仓库由上游框架 `base-dev-framework6-java`（本地对照副本 `/tmp/ref-framework`）改造而来。下列差异是**有意的本仓库改动**，日后从上游同步代码/配置时**不得按上游原样还原**。每条注明「差异内容」与「同步上游时的处置」。

## 1. plus-ui `build` 脚本语义不同

- **差异**：上游 `package.json` 中 `"build": "vite build --mode production"`（仅管理端）；本仓库改为 `"build": "pnpm build:admin && pnpm build:portal"`（管理端 + 门户双端构建），另保留 `"build:prod": "vite build --mode production"` 对应上游原语义（仅管理端）。CI、`deploy.sh` 与 AGENTS.md「提交前必跑」均依赖 `pnpm build` 覆盖双端。
- **同步处置**：上游若调整 scripts 段，只合并依赖/工具类变更，**不要**把本仓库的 `build` / `build:admin` / `build:portal` / `dev:portal` 等双端脚本覆盖回上游形态。

## 2. `monitor/logininfo` 页面 import 大小写已修复（上游 bug）

- **差异**：上游 `plus-ui/src/views/monitor/logininfo/index.vue` 从 `@/api/monitor/logininfo`（小写 i）import，而实际目录是 `api/monitor/loginInfo`（大写 I）——在大小写敏感文件系统（Linux 构建机）上会构建失败。本仓库已修正为 `@/api/monitor/loginInfo`（index.vue:157-158）。
- **同步处置**：这是上游 bug 的本地方修复。同步上游该文件时保留大写 `loginInfo` import；若上游日后修复则自然收敛，无需动作。

## 3. `plus-ui/gen/` 目录已删除，勿恢复

- **差异**：上游 `plus-ui/gen/`（代码生成器产物的本地预览目录）在本仓库已删除，生成器相关能力由后端 `ruoyi-gen` 模块承担，前端不再保留该目录。
- **同步处置**：从上游拷贝 plus-ui 文件时排除 `gen/`；若上游同步工具/脚本试图带回该目录，跳过。

## 维护约定

- 新增「有意偏离上游且易被误还原」的差异时，追加到本文件；差异消除（上游收敛或本仓库回改）时删除对应条目。
- 安全姿态类偏差（captcha/api-decrypt/security.excludes/sa-token 时长）不在此列，见 [ADR-0010 追加登记](decisions/0010-go-migration-authorized-deviations.md)。

---

## 附录：上游 Git Flow 规范原文（本仓库不生效，保留供同步对照）

> 原位于根 `AGENTS.md` 第二部分「Git Flow 分支与提交规范」，为上游框架公司规范原文，此处仅为**上游同步对照**保留。**本仓库不执行该模型**：实际执行「单 master + 分支隔离」模型（无 main/dev/release 分支、不打版本 Tag、合并走 deploy.sh 自动直推 master），提交 message 用 `type(scope): subject` 格式、不要求禅道 Issue ID。同步上游时不得把本仓库的 Git 流程覆盖回上游形态。

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
