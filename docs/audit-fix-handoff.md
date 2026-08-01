# 审计修复交接文档

> 撰写时间：2026-08-01
> 分支：`fix/eval-rules-runtime-error`
> 工作目录：`/tmp/fix-eval-runtime`
> 目标：修复审计报告中除「大文件拆分」外的所有 P0–P4 问题

本文档用于交接给下一个 Agent。已修复部分请直接继承并继续验证；未修复部分请按优先级逐项清零。

---

## 一、当前整体结论

- **前端**：`pnpm lint` 0 error（剩余 13 条 warning），`pnpm typecheck` 通过。
- **后端**：`go vet ./...` 通过，`go build ./...` 通过。
- **后端测试**：`go test ./...` 因本地 PostgreSQL TLS 连接问题仍无法运行，属于环境阻断，不是代码错误。
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

## 三、当前 lint 剩余 warning（13 条，建议优先清理）

运行命令：`cd /tmp/fix-eval-runtime/apps/edu && pnpm lint`

| 文件 | 行号 | 规则 | 说明 |
|------|------|------|------|
| `app/portal/alliance/achievements/[id]/page.tsx` | 55 | `@next/next/no-img-element` | 使用 `<img>`，建议改为 `<Image />` 或禁用规则 |
| `app/portal/alliance/brands/major/[id]/page.tsx` | 49 | `@next/next/no-img-element` | 同上 |
| `app/portal/alliance/enterprises/[id]/page.tsx` | 52, 90 | `@next/next/no-img-element` | 同上 |
| `app/portal/alliance/experts/[id]/page.tsx` | 42, 118 | `@next/next/no-img-element` | 同上 |
| `app/portal/alliance/projects/[id]/page.tsx` | 51 | `@next/next/no-img-element` | 同上 |
| `app/portal/apps/system/org-user/org-structure/page.tsx` | 270 | `react-hooks/exhaustive-deps` | `useCallback` 缺少 `mapToOrgNode` |
| `components/shared/batch-group-page.tsx` | 131 | `react-hooks/exhaustive-deps` | 不必要依赖 `workflowApi` |
| `components/shared/content-list-page.tsx` | 369 | `react-hooks/exhaustive-deps` | 不必要依赖 `listParamsKey` |
| `components/shared/user-selector.tsx` | 220 | `react-hooks/exhaustive-deps` | `useEffect` 缺少 `value` |
| `lib/error-handling.ts` | 28, 31 | `unused-eslint-disable` | 两条 `// eslint-disable-next-line no-console` 当前无对应报错，可删除 |

> 这些 warning 不影响合并，但会破坏「lint 0 warning」目标。建议作为 P1/P2 收尾时统一清理。

---

## 四、未修复问题清单（按优先级）

### P1 — 仍需完成

#### 1. 共享组件下沉到 `packages/ui`

- **目标**：把 `ComboboxSelect`、`MixedTagEditor`、`ImportWizardDialog`、`ImportConfirmDialog` 从 `apps/edu/components/shared/` 迁移到 `packages/ui/src/components/shared/`，`apps/edu/components/shared/` 保留 re-export 薄封装。
- **阻塞**：本次尝试启动子 Agent 时遇到配额错误，未执行。迁移时需要注意：
  - `MixedTagEditor` 依赖 `apps/edu/lib/dom-utils.ts` 中的 `createTagElement`，需先复制到 `packages/ui/src/lib/dom-utils.ts`。
  - `ImportConfirmDialog` 依赖 `apps/edu/lib/api` 的 `ImportPreviewItem` 类型，需把组件内类型改为本地 `{ name?: string; key?: string }[]`，在调用处做类型转换。
  - 为 `packages/ui` 添加 `eslint.config.mjs` 与 `package.json` 的 `lint` script。
- **参考文件**：
  - 源：`apps/edu/components/shared/combobox-select.tsx`
  - 源：`apps/edu/components/shared/mixed-tag-editor.tsx`
  - 源：`apps/edu/components/shared/import-wizard-dialog.tsx`
  - 源：`apps/edu/components/shared/import-confirm-dialog.tsx`
  - 目标目录：`packages/ui/src/components/shared/`
  - 目标工具：`packages/ui/src/lib/dom-utils.ts`（新建）
  - 导出入口：`packages/ui/src/index.ts`

#### 2. 隔离模块级可变状态

| 文件 | 问题 | 建议方案 |
|------|------|---------|
| `packages/ui/src/hooks/use-toast.ts` | `let count`、`let memoryState`、`const listeners` 全局单例 | 这是 shadcn 标准模式，但仍是模块级可变状态。可评估改用 React Context；如保留，应在文档中说明。 |
| `apps/edu/components/shared/resource-preview-modal.tsx` | `let globalZIndexCounter = 100` | 改用 `useRef` 或 CSS `isolation: isolate`/`z-index` 层叠；若必须用全局计数，加版本/清理逻辑。 |
| `apps/edu/lib/menu-permissions.ts` | `let knownMenuPaths: Set<string> \| undefined` 懒加载缓存 | 加失效策略或挂载时重新加载，避免菜单权限变更后仍用旧缓存。 |
| `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/shared-defs.ts` | `_allQuestions`、`_questionCache`、`_loadedExams` 模块级缓存 | 改用 React Context / 查询缓存，或至少加卸载清理，避免跨组件污染。 |

#### 3. 非豁免 Handler 的 `ListQueryConfig` SQL 片段下沉到 Store

以下 handler 仍在自己的文件中定义 `Table` / `SelectColumns` / `ExtraFilter` SQL 片段，需要把 SQL 配置沉淀到对应 store：

- `backend/internal/handler/exam_handler.go:51`
- `backend/internal/handler/position_handler.go:49-50,127-128,563-564`
- `backend/internal/handler/question_bank_handler.go:49-50`
- `backend/internal/handler/scenario_handler.go:104`（列表 SQL）
- `backend/internal/handler/scheduling_handler.go:364`
- `backend/internal/handler/teaching_plan_handler.go:55`
- `backend/internal/handler/training_program_handler.go:60`
- `backend/internal/handler/user_management_handler.go:106-112`（`ExtraFilter` 中手写 EXISTS / 递归 CTE）

**做法**：在对应 `store/*.go` 中提供预定义 `ListQueryConfig[T]` 或专用方法（如 `ExamStore.ListConfig()`、`UserStore.ListFilter(...)`），handler 只传过滤参数。

> `handler/common.go` 中的 `withTx` / `lookupIDByName` 仅被 import/export 豁免文件使用，可整体迁移到 `import_common.go`，让 `common.go` 不再依赖 `*pgxpool.Pool`。

---

### P2 — 质量基线与格式化

#### 4. 格式化债务

- **Prettier**：当前 `npx prettier --check` 约 512 个前端文件未格式化。需要在根目录增加 Prettier workspace 依赖与 `format`/`format:check` scripts，然后格式化全部前端文件。**建议单独提交**，避免与逻辑变更混在一起。
- **gofmt**：当前 `gofmt -l .` 约 87 个 Go 文件未格式化。运行 `gofmt -w .` 后单独提交。

#### 5. 测试与 lint 覆盖

- `apps/edu` 没有 test script，需要引入 Vitest 骨架并至少覆盖 1–2 个核心 hooks。
- `packages/api-client`、`packages/shared-types` 有 `test` script 但无测试文件，建议补充基础测试或移除空 script。
- 统一 root `pnpm test`：应跑全部 workspace 测试，而非只跑 `packages/ui`。
- `packages/ui` 需要 lint 配置（与 P1 组件下沉一并完成）。

#### 6. 修复剩余 eslint warnings

见第三节 13 条 warning 清单。

---

### P4 — 工具链与文档

#### 7. `deploy.sh` 质量门禁与风险操作修正

- **质量门禁**：当前 `deploy.sh` 完全没有以下门禁，需在构建阶段插入：
  - 后端构建前：`gofmt -l .` 检查、`go vet ./...`。
  - 前端构建前：`pnpm typecheck`、`pnpm lint`。
  - `go test ./...` 因本地 DB 不一定就绪，建议加 DB 可用性检测：不可用则 warn 跳过，不要硬失败。
- **风险操作修正**：
  - Nginx 配置覆盖前加 `.bak.$(date)` 备份（行 ~847）。
  - `--clean` / `docker builder prune --all --force` 等破坏性操作增加二次确认或 `--force` 显式参数。
  - `curl ... | bash`（Docker/NodeSource 安装）增加 checksum 校验或至少记录 warn。

#### 8. 文档同步

- `AGENTS.md`：
  - 补充 `ContentActionStore` 作为 store 层复用范例。
  - 补充 `respondServerError` 作为新增 handler 的 500 错误处理约定。
  - 更新「提交前检查」为实际可运行的命令（`pnpm typecheck`、`pnpm lint`、`go vet ./...` 等）。
- `docs/refactor-layering.md`：
  - 更新现状基线（handler 数量、store 数量、 exemption 列表）。
  - 补充 `ContentActionStore` 下沉、事务与 500 错误处理、P2 完成范围。
  - 调整 P3 待办，删除已完成的 handler SQL 下沉项。
- `docs/components.md`：
  - 修正 `EvalMethodConfigModule` 文档描述（实际只被课程编辑器使用）。
  - 补充 `ImportWizardDialog`、`ComboboxSelect`、`MixedTagEditor`、`error-handling` 的使用说明。
  - 待 P1 组件下沉完成后，更新组件位置说明。

---

## 五、关键约束（必须遵守）

1. **禁止大文件拆分**：`docs/components.md` 已明确 `EvaluationRulesEditor`（2409 行）、`tasks/page.tsx`（2815 行）等保持不拆分。评估文档中已记录该约定。
2. **import/export/template 豁免冻结区**：22 个 handler 文件（`*_import_handler.go`、`*_export_handler.go`、`template_handler.go`、`import_common.go`、`import_export_handler.go`）保持现状，不迁移 SQL。
3. **后端分层红线**：新增 handler 禁止出现 `SELECT/INSERT/UPDATE/DELETE` 字符串和裸 `db.Query/Exec`；service 禁止拼接 SQL；store 禁止读取 HTTP/Claims。
4. **不要还原/覆盖他人代码**：AGENTS.md 首要约束。合并冲突时先 rebase，不要 `git checkout/restore/reset` 他人修改。
5. **未经确认不得执行 `./deploy.sh`**：AGENTS.md 明确要求部署前需确认。

---

## 六、推荐下一步执行顺序

1. **完成 P1 共享组件下沉到 `packages.ui`**（含 lint 配置）。
2. **P1 隔离模块级可变状态**（优先 `shared-defs.ts` 和 `resource-preview-modal.tsx`）。
3. **P2 格式化债务**（Prettier + gofmt，单独提交）。
4. **P2 非豁免 Handler SQL 片段下沉**（可分批按领域处理）。
5. **P4 `deploy.sh` 质量门禁与风险操作修正**。
6. **P4 文档同步**（AGENTS.md、refactor-layering.md、components.md）。
7. **全量验证**：`pnpm typecheck`、`pnpm lint`、`go vet ./...`、`go test ./...`（DB 就绪时）、`./deploy.sh --branch fix/eval-rules-runtime-error`。

---

## 七、常用验证命令

```bash
# 前端 lint / typecheck
cd /tmp/fix-eval-runtime/apps/edu && pnpm lint
cd /tmp/fix-eval-runtime && pnpm typecheck

# 后端 vet / build / test
cd /tmp/fix-eval-runtime/backend && go vet ./...
cd /tmp/fix-eval-runtime/backend && go build ./...
cd /tmp/fix-eval-runtime/backend && go test ./...

# 格式化检查
cd /tmp/fix-eval-runtime && npx prettier --check . 2>/dev/null | head
cd /tmp/fix-eval-runtime/backend && gofmt -l .

# 部署（需用户确认）
cd /tmp/fix-eval-runtime && ./deploy.sh --branch fix/eval-rules-runtime-error
```

---

## 八、附：当前分支状态

```bash
cd /tmp/fix-eval-runtime
git status --short   # 工作区干净
git log --oneline -5 # 最近 5 条提交见上文
```

工作区当前无未提交修改。所有已完成修复均已 push 到 `origin/fix/eval-rules-runtime-error`。
