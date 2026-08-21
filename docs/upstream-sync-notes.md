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
