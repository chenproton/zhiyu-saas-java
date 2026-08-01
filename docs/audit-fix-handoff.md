# 审计修复交接文档

> 撰写时间：2026-08-01
> 最后更新：2026-08-02（P1/P2/P4 全部完成，仅剩部署验证）
> 分支：`fix/eval-rules-runtime-error`
> 工作目录：`/tmp/fix-eval-runtime`
> 目标：修复审计报告中除「大文件拆分」外的所有 P0–P4 问题

本文档用于交接给下一个 Agent。除「部署验证」与「手工冒烟」外，P0–P4 已全部完成。

---

## 一、当前整体结论

- **前端**：`pnpm lint` 0 error 0 warning，`pnpm typecheck` 通过。
- **后端**：`go vet ./...` 通过，`go build ./...` 通过，`gofmt -l .` 为空。
- **后端测试**：`go test ./...` **已全绿**。`.env` 中 `sslmode=require` 与本地容器不符会报 TLS 错误，用 `TEST_DATABASE_URL`/`DATABASE_URL` 覆盖为 `?sslmode=disable` 即可运行；期间发现并修复 6 处此前从未暴露的真实 SQL bug（见提交 `82e75dbf`）。
- **单测**：`pnpm test` 全绿（api-client 3 / ui 5 / edu 4 / shared-types 2）。
- **部署**：尚未执行 `./deploy.sh --branch fix/eval-rules-runtime-error` 验证，需要下一个 Agent 在环境就绪后补跑。
- **大文件拆分**：明确不在本次修复范围内（见 `docs/components.md` 对 `EvaluationRulesEditor` 的约定）。

---

## 二、已完成修复（可直接继承）

### P0 — 阻塞稳定性/数据一致性

| # | 修复内容 | 关键提交 | 涉及文件 |
|---|---------|---------|---------|
| 1 | 消除 7 处 `react-hooks/set-state-in-effect` lint error | `5a1852cb` | `apps/edu/app/evaluation/job-ability/config/[id]/_components/position-weight-config.tsx`<br>`apps/edu/app/evaluation/job-ability/page.tsx`<br>`apps/edu/app/evaluation/job-ability/results/page.tsx`<br>`apps/edu/app/lesson/admin/system/add/page.tsx`<br>`apps/edu/app/library/my-resources/page.tsx`<br>`apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx` |
| 2 | 关键路径静默失败改为 `reportError`/`toast` | `55f49199` | 审批列表 4 个页面、工作台 dashboard、16 个联盟公开页面 |
| 3 | 后端 service 裸 SQL 清零 | `5540e6d8` | `service/certification_model.go`（已删除）<br>`service/job_ability_aggregator.go`（移除 `*pgxpool.Pool`）<br>新增/扩展 `store/certifications.go`、`store/job_ability_results.go`、`store/student_portraits.go`、`store/users.go`<br>`handler/certification_model_handler.go` 等 |
| 4 | 核心多步骤写操作事务化 | `644c3bb3` | `service/evaluation.go`：试卷题目增删改、考试结果提交<br>`service/user.go`：`UserService.Update` |
| 5 | 内容动作 SQL 下沉到 `store.ContentActionStore`（P0 已完成并继承） | `6638c735` | `backend/internal/store/content_actions.go` |
| 6 | 课程创建/更新加入事务、500 错误记录原始 error（P0 已完成并继承） | `0620bbfe`、`5c6a99e0` | `service/lesson_content.go`、`handler/common.go` |

### P1 — 结构收敛

| # | 修复内容 | 关键提交 | 涉及文件 |
|---|---------|---------|---------|
| 7 | Handler 层移除 `*pgxpool.Pool` 依赖 | `d181c445` | 删除死字段：`course_handler.go`、`resource_handler.go`、`stats_handler.go`<br>列表查询 handler 改走 `Service.Queryer()`：major/industry/role/org_type/staff_title/certificate_library/learn_road/log/micro_cert/node_evaluation_result/on_site_question_library<br>批量/批次 handler 改接收 Service：batch/affairs_batch/course_batch/evaluation_batch/job_batch/scene_batch<br>`auth_handler.go` 改接收 `*service.AuthService`<br>新增 11 个 service 文件提供 `Queryer()` |
| 8 | 统一状态徽标为 `StatusBadge` | `0a2cf83c` | 14 个页面/组件，补充 `packages/shared-types/src/status.ts` |

### 此前已合并到本分支的修复（继承资产）

- 消除任务编辑器的模块级可变状态 (`354f8207`)
- 修复 `useEffect` 不稳定依赖与 lint 禁用 (`2a54e56d`、`c4a2456a`)
- 抽取 `MixedTagEditor`、method-config-dialog 复用 (`0182cd28`、`6b41d4a9`)
- `ComboboxSelect` 扩展多选与清空能力，替换 3 处 inline 搜索下拉 (`a6936828`、`9da6693e`)
- `ImportWizardDialog` 统一导入弹窗 (`399a03b4`、`b3eabb54`)
- `StatusBadge` 第一次统一 (`eb9cfb10`)
- 修复评价规则编辑器无限重渲染、空 reviewSteps 默认步骤、弹窗滚动等 (`d56737c7`、`44e7d802`、`28200f9c`)
- 统一场景任务与课程节点的评测规则/知识点/资源选择器 (`8d3ce9a3`)
- P3 store 白名单+构建器单元测试 (`36653ceb`)

---

## 三、当前 lint 剩余 warning（已全部清零）

> 运行命令：`cd /tmp/fix-eval-runtime/apps/edu && pnpm lint` → 0 problems

原 13 条 warning 处理结果：

| 原清单项 | 处理 |
|---------|------|
| 6 处 alliance 详情页 `no-img-element` | 改 `next/image`（`unoptimized` 模式，`fill` + 容器或显式尺寸） |
| org-structure `mapToOrgNode` 缺失依赖 | `mapToOrgNode` 提为模块级纯函数 |
| batch-group-page 多余 `workflowApi` 依赖 | 移除（模块级静态导入） |
| content-list-page 多余 `listParamsKey` 依赖 | 参数变化改由 `prevListParamsKey` effect bump `reloadKey` 触发 |
| user-selector 缺失 `value` 依赖 | 补入（effect 幂等，重复运行无副作用） |
| error-handling 两条失效 disable | 删除注释 |

---

## 四、未修复问题清单（全部完成）

> 本节原 P1/P2/P4 各条目均已处理完毕，记录处理结果供验收。

### P1 — 已完成

#### 1. 共享组件下沉到 `packages.ui` ✅（`42d5fb4b`）

- `ComboboxSelect`/`MixedTagEditor`/`ImportWizardDialog`/`ImportConfirmDialog` 已迁移至 `packages/ui/src/components/shared/`
- `apps/edu/components/shared/` 保留 re-export 薄封装，调用方零改动
- 新增 `packages/ui/src/lib/dom-utils.ts`（`createTagElement`）
- `ImportConfirmDialog` 改用本地结构类型 `{ rowNum?; key?; name? }[]`（与 `ImportPreviewItem` 结构兼容，调用处无需转换）
- `packages/ui` 已添加 `eslint.config.mjs` 与 `lint` script，并清理存量 lint error（`use-toast` 的 `actionTypes`、`use-import-flow` 的 `any`/未用参数、`platform-shell/utils` 未用 import）

#### 2. 隔离模块级可变状态 ✅（`f021a1be`）

| 文件 | 处理 |
|------|------|
| `packages/ui/src/hooks/use-toast.ts` | 保留 shadcn 标准单例模式，已在 `docs/components.md` 说明（刻意保留，不评估 Context 化） |
| `resource-preview-modal.tsx` | `globalZIndexCounter` → DOM 派生 `nextZIndex()`（`data-resource-preview` 标记 + `max+1`，弹窗关闭即自然回落） |
| `menu-permissions.ts` | 懒加载可变缓存 → 模块加载时不可变 `ReadonlySet` 常量（菜单树为静态配置，无需失效策略） |
| `shared-defs.ts` | 新增 `clearAllCaches()`，任务编辑页（`tasks/page.tsx`）卸载时调用清理 |

#### 3. 非豁免 Handler 的 `ListQueryConfig` SQL 片段下沉到 Store ✅（`1a8ad8ba`）

- 新增 store 方法：`ExamStore.ListConfig()`、`PositionStore.AdminListConfig()/PublicListConfig()/FavoritesListConfig()`、`QuestionBankStore.ListConfig()`、`ScenarioStore.ListConfig()`、`SchedulingStore.ListSchedulesConfig()/ListVenuesConfig()/ListPeriodSlotsConfig()`、`TeachingPlanStore.ListConfig()`、`TrainingProgramStore.ListConfig()`、`UserStore.ListConfig()`
- 排课列表扫描器/过滤器/列常量一并迁入 `store/scheduling.go`
- `handler/common.go` 的 `withTx`（死代码）已删除、`lookupIDByName` 迁移至 `import_common.go` 豁免区，`common.go` 不再依赖 `*pgxpool.Pool`

### P2 — 已完成

#### 4. 格式化债务 ✅（`5178d2dd` 前端、`9f9c8b83` 后端）

- 根目录新增 `prettier` devDependency 与 `format`/`format:check` scripts，全量格式化 460+ 前端文件
- `gofmt -w .` 全量格式化 71 个 Go 文件，`gofmt -l .` 已为空

#### 5. 测试与 lint 覆盖 ✅（`6b6af7e4`）

- `apps/edu` 新增 Vitest 骨架（`vitest.config.ts`）+ `format-utils` 单测（4 用例）
- `packages/api-client` 补 `buildQuery` 单测（3 用例）、`packages/shared-types` 补 `getStatusConfig` 单测（2 用例）
- root `pnpm test` = `pnpm -r test`（4 个 workspace 全跑）；root `pnpm lint` = `pnpm -r lint`

#### 6. 修复剩余 eslint warnings ✅

见第三节，13 条全部清零。

### P4 — 已完成

#### 7. `deploy.sh` 质量门禁与风险操作修正 ✅（`7f6f1578`）

- 后端构建前：`gofmt -l .` 检查（未通过直接 die）、`go vet ./...`；`pg_isready "$DATABASE_URL"` 可用时跑 `go test ./...`，不可用仅 warn 跳过
- 前端构建前：`pnpm typecheck`、`pnpm lint`
- nginx 配置覆盖前自动备份 `$NGINX_DST.bak.$(date +%Y%m%d%H%M%S)`
- `docker builder prune --all --force` 需 `--force` 显式参数（`--clean` 单独使用时仅全量重建并 warn）
- `curl | bash`（Docker/NodeSource）回退安装前 warn 未校验 checksum

#### 8. 文档同步 ✅（本文档 + `AGENTS.md` + `docs/refactor-layering.md` + `docs/components.md`）

- `AGENTS.md`：补充 `ContentActionStore`/`respondServerError` 复用范例、提交前检查命令与 deploy.sh 门禁说明
- `docs/refactor-layering.md`：更新现状基线（handler 121 / store 65 / 豁免 22）、P3 状态（common.go 瘦身、SQL 下沉完成、大文件拆分明确不做）
- `docs/components.md`：修正 `EvalMethodConfigModule` 描述（仅课程编辑器使用）、补充下沉组件与 `error-handling` 说明、useToast 单例说明

---

## 五、关键约束（必须遵守）

1. **禁止大文件拆分**：`docs/components.md` 已明确 `EvaluationRulesEditor`（2409 行）、`tasks/page.tsx`（2815 行）等保持不拆分。评估文档中已记录该约定。
2. **import/export/template 豁免冻结区**：22 个 handler 文件（`*_import_handler.go`、`*_export_handler.go`、`template_handler.go`、`import_common.go`、`import_export_handler.go`）保持现状，不迁移 SQL。
3. **后端分层红线**：新增 handler 禁止出现 `SELECT/INSERT/UPDATE/DELETE` 字符串和裸 `db.Query/Exec`；service 禁止拼接 SQL；store 禁止读取 HTTP/Claims。
4. **不要还原/覆盖他人代码**：AGENTS.md 首要约束。合并冲突时先 rebase，不要 `git checkout/restore/reset` 他人修改。
5. **未经确认不得执行 `./deploy.sh`**：AGENTS.md 明确要求部署前需确认。

---

## 六、剩余工作（下一个 Agent）

1. **部署验证**（需用户确认后执行）：`./deploy.sh --branch fix/eval-rules-runtime-error`
2. **冒烟验证**：接口冒烟（岗位/试卷/题库/场景/排课/用户列表分页与过滤），重点确认下沉后的 `ListConfig()` 行为与原来一致
3. **后端 go test**：本地 PostgreSQL 就绪后补跑 `go test ./...`
4. **视觉回归**：alliance 详情页图片、ResourcePreviewModal 层级、ComboboxSelect/MixedTagEditor 样式由用户人工确认

---

## 七、常用验证命令

```bash
# 前端 lint / typecheck / 测试
cd /tmp/fix-eval-runtime && pnpm lint && pnpm typecheck && pnpm test

# 后端 vet / build / test / 格式化
cd /tmp/fix-eval-runtime/backend && go vet ./... && go build ./... && gofmt -l .

# 格式化检查
cd /tmp/fix-eval-runtime && pnpm format:check

# 部署（需用户确认）
cd /tmp/fix-eval-runtime && ./deploy.sh --branch fix/eval-rules-runtime-error
```

---

## 八、附：当前分支状态

```bash
cd /tmp/fix-eval-runtime
git status --short   # 工作区干净
git log --oneline -12
```

工作区当前无未提交修改。所有已完成修复均已 push 到 `origin/fix/eval-rules-runtime-error`。
