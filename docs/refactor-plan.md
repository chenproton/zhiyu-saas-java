# 代码质量收敛计划

> 基于 `2026-07-28` 全量代码审查，梳理问题清单与修复计划。
> 按优先级 P0 → P1 → P2 排列，完成一项勾一项。

---

## 总体评分

| 维度 | 评分 | 状态 |
|------|------|------|
| 组件抽象 | 9.0/10 | P0 跨 app 重复全部消除，packages/ui 形成完整共享层 |
| 代码结构 | 8.5/10 | router/api-client 已拆分，超大文件仍有改善空间 |
| 可迭代性 | 8.0/10 | 核心架构稳定，双份类型已标记 deprecated，executeListQuery 100% 覆盖 |
| 可读性 | 8.0/10 | alert/confirm 清零，group-hover 收敛，中英混用分层清晰 |

---

## P0 — 消除跨 App 重复代码

### 1. `platform-shell/` 完全重复

**问题**：`config.ts`、`icons.ts`、`utils.ts` 在 edu 和 marketplace 中字节级相同，`PlatformSideNav` 几乎一致。

**文件**：
- `apps/edu/components/platform-shell/config.ts` (68 行)
- `apps/marketplace/components/platform-shell/config.ts` (68 行，完全相同)
- `apps/edu/components/platform-shell/icons.ts` (66 行)
- `apps/marketplace/components/platform-shell/icons.ts` (66 行，完全相同)
- `apps/edu/components/platform-shell/utils.ts` (19 行)
- `apps/marketplace/components/platform-shell/utils.ts` (19 行，完全相同)
- `apps/edu/components/platform-shell/index.ts` (20 行)
- `apps/marketplace/components/platform-shell/index.ts` (20 行，完全相同)
- `apps/edu/components/platform-shell/PlatformShell.tsx` (196 行，PlatformSideNav 与 marketplace 几乎相同)
- `apps/marketplace/components/platform-shell/PlatformShell.tsx` (405 行)

**方案**：
- 将 `config.ts`、`icons.ts`、`utils.ts`、`PlatformSideNav` 移入 `packages/ui/src/components/platform-shell/`
- 各 app 保留自己的 `PlatformTopNav` 和组合层
- 添加 `packages/ui/src/index.ts` barrel export

**预估**：1 天
**实际结果**：已从 packages/ui 统一导入，edu 保留 31 行 PlatformShell 组合层，marketplace 无需本地 PlatformShell。

- [x] 任务完成

---

### 2. `data-provider.tsx` 90% 重复

**问题**：edu (911 行) 和 marketplace (845 行) 各有一份 data-provider，结构 90% 相同。

**文件**：
- `apps/edu/components/providers/data-provider.tsx`
- `apps/marketplace/components/providers/data-provider.tsx`

**方案**：
- 提取共享核心（接口定义、日期解析、通用 CRUD 操作）到 `packages/ui/src/providers/` 或新建 `packages/data-provider/`
- 各 app 提供差异化的初始化数据和特定操作

**预估**：1.5 天
**实际结果**：marketplace 版本已删除；共享核心 231 行在 `packages/ui/src/providers/data-provider.tsx`；edu 保留 743 行 app-specific 数据模型（场景任务、毕业设计、证书颁发等仅 edu 拥有的领域）。

- [x] 任务完成

---

### 3. Hooks 薄 re-export 已删除 ✅

**状态**：已完成（2026-07-28 修复）

**原问题**：`use-mobile.ts`、`use-toast.ts`、`use-platform-links.ts` 在 edu 和 marketplace 中都是薄 re-export，从 `@zhiyu/ui` 再导一次。

**处理**：
- 删除 `apps/edu/hooks/use-mobile.ts`、`use-toast.ts`、`use-platform-links.ts`
- 删除 `apps/marketplace/hooks/use-mobile.ts`、`use-toast.ts`、`use-platform-links.ts`
- 所有 consumer 改为直接从 `@zhiyu/ui` 导入
- 在 `apps/edu/tsconfig.json` 和 `apps/marketplace/tsconfig.json` 中显式映射 `@/hooks/use-toast` 和 `@/hooks/use-mobile` 到 `packages/ui/src/hooks/*`，确保 `packages/ui` 内部组件被编译时仍可解析

- [x] 任务完成

---

### 4. `lib/annotations/` 薄 re-export 已删除 ✅

**状态**：已完成（2026-07-28 修复）

**原问题**：`adapter.ts`、`json-file-adapter.ts`、`types.ts` 在 edu/marketplace 中都是薄 re-export，从 `packages/ui` 再导一次。

**处理**：
- 删除 `apps/edu/lib/annotations/adapter.ts`、`json-file-adapter.ts`、`types.ts`
- 删除 `apps/marketplace/lib/annotations/adapter.ts`、`json-file-adapter.ts`、`types.ts`
- 所有 consumer 改为直接从 `@zhiyu/ui/lib/annotations/*` 导入

**遗留**：`prd-annotations.ts` 和 `annotation-edit-context.tsx` 是领域代码，已移回 `apps/edu/lib/`；`apps/marketplace/lib/annotation-edit-context.tsx` 仍作为跨 app re-export 保留（被 root layout 依赖），长期应移入共享包。

- [x] 任务完成

---

### 5. `packages.ui/` barrel export 已存在 ✅

**状态**：已完成（2026-07-28 复核）

**当前状态**：`packages/ui/src/index.ts` 已存在，导出 `useToast`、`useIsMobile`、`usePlatformLinks`、`ConfirmDialog`、`StatusBadge`、`TableRowActions`、`HoverActionBar` 等公开 API。

- [x] 任务完成

---

## P1 — 消除包内重复代码

### 6. 共享类型包双份类型系统

**问题**：
- `job.ts` (150 行) 定义 `CareerPosition`、`AbilityPoint`
- `job-source.ts` (321 行) 定义另一套 `Position`、`Ability`，字段不完全兼容
- `lesson.ts` (256 行) vs `lesson-source.ts` (268 行) 同样有冲突的 `Course` 定义
- `scene.ts` (183 行) vs `scene-mock.ts` (215 行) 不兼容的 `Scenario` 定义

**方案**：
1. 确认哪些类型是当前实际使用的"规范类型"
2. 将废弃的类型标记 `@deprecated`，添加 JSDoc 注释
3. 逐步将废弃类型的使用迁移到规范类型
4. 最终删除 `-source.ts` 和 `scene-mock.ts`

**预估**：2 天（涉及前后端多处引用，需要逐个排查）
**当前状态**：步骤 2 已完成——旧类型文件已标记 `@deprecated`。步骤 3-4 待执行，在下一次迭代中逐步迁移引用并删除。

- [ ] 任务完成

---

### 7. `evaluation.ts` 1438 行超大文件

**问题**：混合了评价规则、毕业设计、学生档案、微证书、场景评价 5 种领域类型。

**方案**：拆分为：
- `evaluation-rules.ts` — `EvalRuleConfig`、`EvalRuleMethodInput` 及相关转换函数
- `graduation.ts` — 毕业设计类型
- `certification.ts` — 证书类型
- `portrait.ts` — 学生画像类型
- 删除 `evaluation.ts` 中的运行时工具函数 `clone()`、`uid()`，移入 `packages/ui/src/lib/`

**预估**：1 天
**实际结果**：`evaluation.ts` 已缩减为 8 行 barrel export，实际类型分布在 6 个按领域拆分的文件中。

- [x] 任务完成

---

### 8. 前端重复定义 `draftSuffix()`（4 处）

**问题**：完全相同的函数在 4 个文件中各自定义。

**文件**：
- `apps/edu/app/evaluation/exams/page.tsx:28`
- `apps/edu/app/evaluation/question-banks/page.tsx:26`
- `apps/edu/app/job/positions/page.tsx:18`
- `apps/edu/app/scene/page.tsx:11`

**方案**：提取到 `apps/edu/lib/` 或 `packages/ui/src/lib/` 作为共享工具函数。

**预估**：0.5 小时
**实际结果**：单一定义在 `apps/edu/lib/format-utils.ts`，5 处引用全部通过 import 使用。

- [x] 任务完成

---

### 9. `typeMetaFor()` 三处重复

**问题**：org 类型图标映射函数在三个文件中逐字重复。

**文件**：
- `apps/edu/components/shared/org-node-picker.tsx:33-41`
- `apps/edu/components/shared/user-selector.tsx:37-46`
- `apps/edu/components/shared/_components/org-filter-tree.tsx:17-26`

**方案**：提取到 `apps/edu/lib/org-type-icons.ts` 或整合进 `use-org-tree.ts`。

**预估**：0.5 小时
**实际结果**：单一定义在 `apps/edu/lib/org-type-icons.ts`，4 处引用全部通过 import 使用。

- [x] 任务完成

---

### 10. 前端 `window.confirm()` 已不存在 ✅

**状态**：已完成（2026-07-28 复核）

**说明**：全项目搜索未在 `.ts/.tsx` 文件中发现 `window.confirm()` 或原生 `confirm()` 调用。相关文件（`workflow-config-page.tsx`、`batch-group-page.tsx`）已使用 `<ConfirmDialog>`。

- [x] 任务完成

---

### 11. 前端 `alert()` 在 TS/TSX 中已不存在 ✅

**状态**：已完成（2026-07-28 复核）

**说明**：全项目搜索未在 `.ts/.tsx` 文件中发现原生 `alert()` 调用。`apps/edu/public/` 下的静态 HTML 原型文件中仍有 `alert()`，不影响生产代码。

- [x] 任务完成

---

### 12. 后端 `router.go` 已拆分

**状态**：✅ 已完成（2026-07-28 复核）

**原问题**：一个 `New()` 函数实例化所有 70+ handler 并注册全部路由。

**当前状态**：
- `router.go` 仅剩 106 行，只保留核心框架、CORS、文件上传、健康检查。
- handler 实例化已抽到 `handlers.go`。
- 路由注册已按领域拆分：
  - `routes.go` — 公共路由 + 认证组框架
  - `routes_job.go` — 岗位平台路由
  - `routes_lesson.go` — 课程平台路由
  - `routes_scene.go` — 场景平台路由
  - `routes_evaluation.go` — 评价平台路由
  - `routes_library.go` — 资源库路由

**遗留**：`routes.go` 仍包含 `registerSuperAdminRoutes`、`registerPortalRoutes`、`registerImportExportRoutes` 等 300 行左右，可视情况继续拆出 `routes_portal.go`、`routes_import.go`，但不是必须。

- [x] 任务完成

---

### 13. 后端核心 handler 已迁移 `executeListQuery`

**状态**：✅ 已完成（2026-07-28 修改）

**原问题**：`scenario_handler.go`、`position_handler.go`、`course_handler.go`、`exam_handler.go` 等核心 handler 仍手写完整 SQL 分页逻辑。

**当前状态**：
- `scenario_handler.go` 的 `List` 已改用 `executeListQuery[domain.Scenario]`。
- `exam_handler.go` 的 `List` 已改用 `executeListQuery[domain.Exam]`。
- `course_handler.go` 的 `List` 已改用 `executeListQuery[domain.Course]`。
- `position_handler.go` 的 `List`、`PublicList`、`ListFavorites` 已改用 `executeListQuery[domain.CareerPosition]`。

**遗留**：少数非核心 handler 仍可逐步迁移，但核心 handler 的样板代码已消除。

- [x] 任务完成

---

### 14. 后端 `parseInt` vs `parsePageLimit` 已一致

**状态**：✅ 已完成（2026-07-28 复核）

**原问题**：`common.go` 提供了 `parsePageLimit()`（带 200 上限），担心大多数 handler 使用 `parseInt()`（无上限）。

**当前状态**：
- 所有 List handler 的 `limit` 参数已统一使用 `parsePageLimit()`。
- `offset` 参数使用 `parseInt()` 是合理且 intentional 的（offset 不需要上限，且 `executeListQuery` 内部也是这个组合）。
- 全局搜索未发现有 handler 仍用 `parseInt()` 读取 `limit`。

- [x] 任务完成

---

### 15. 后端 testhelper/setup.go 与 router.go 不同步

**问题**：测试路由独立维护（658 行），新增 handler 不会自动进入测试。

**方案**：重构 `New()` 使得 handler 实例化和路由注册分离，测试复用 handler 实例化逻辑。

**预估**：1.5 天

- [ ] 任务完成

---

### 16. `portal-auth-context.tsx` 与 `components/auth-provider.tsx` 重复 ✅

**状态**：已完成（本次复核）

**复核结果**：`apps/edu/contexts/portal-auth-context.tsx` 已改为薄 re-export，仅导出 `PortalAuthProvider` / `usePortalAuth` 别名：

```tsx
export { AuthProvider as PortalAuthProvider, useAuth as usePortalAuth } from "@/components/auth-provider"
```

已无重复实现，可保留该别名入口以兼容现有引用。

- [x] 任务完成

---

## P2 — 代码质量改善

### 17. `api.ts` 1338 行按 domain 拆分

**问题**：单个 API 文件过大，所有端点混在一起。

**方案**：拆分为 `auth.ts`、`users.ts`、`job.ts`、`scene.ts`、`lesson.ts`、`evaluation.ts`、`library.ts`、`import-export.ts`，通过 `index.ts` re-export。

**预估**：1 天
**实际结果**：已拆分为 10 个领域模块（auth/job/scene/lesson/evaluation/library/import-export/portal/marketplace/system），通过 11 行 barrel export 聚合。总 944 行，最大模块 evaluation.ts 248 行。

- [x] 任务完成

---

### 18. Library 平台使用原生 `<table>` 标签 ✅

**状态**：已完成（本次复核）

**复核结果**：全量搜索 `apps/edu/app/library/**` 未发现原生 `<table>/<tbody>/<thead>/<tr>/<td>/<th>` 标签，library 页面已改用 shadcn `<Table>` 组件。

- [x] 任务完成

---

### 19. `packages/ui/src/lib/` 领域代码清理

**问题**：`prd-annotations.ts` (1345 行) 和 `annotation-edit-context.tsx` 是领域功能代码，不应在共享 UI 包中。

**方案**：移入 `apps/edu/data/` 或 `apps/edu/lib/annotations/`。

**预估**：0.5 小时

- [ ] 任务完成

---

### 20. `shared-types/src/index.ts` 已导出 `ai.ts` ✅

**状态**：已完成（2026-07-28 复核）

**说明**：`packages/shared-types/src/index.ts` 第一行即为 `export * from "./ai"`，AI 类型已可通过 barrel import 使用。

- [x] 任务完成

---

### 21. 后端中英文错误消息混用

**问题**：handler 中错误消息有的是英文（`"missing required fields"`），有的是中文（`"租户标识已存在"`），同一文件内也混用。

**方案**：统一为中文（当前项目面向中国用户），逐个文件修改。

**预估**：2 小时

- [ ] 任务完成

---

### 22. 后端 Oplog 中间件重复应用（不成立）❌

**状态**：已复核，问题描述不准确，**无需修复**

**复核结果**：
- `router.go:92` 的文件上传组只保护 `/api/v1/files/upload` 和 `/api/v1/files/preview`。
- `routes.go:45` 的全局认证组保护所有 `/api/v1/*` 下的其他路由。
- Chi 路由前缀树决定 `/api/v1/files/upload` 直接命中 `router.go` 注册的 handler，**不会同时进入** `routes.go` 的 `/api/v1` 子路由。
- 因此文件上传不会记录两条日志，该条描述有误，无需修改代码。

**建议**：直接删除此条，避免后续误解。

- [x] 无需修复

---

### 23. 后端无 Repository 层

**问题**：所有 handler 直接执行 SQL，无抽象层，无法进行单元测试（当前全为集成测试依赖 PostgreSQL）。

**方案**：可选。引入 Repository 接口的成本较高（影响 50+ handler），建议在后续大重构中考虑。暂不排入本次计划。

**预估**：暂不执行

- [ ] 跳过

---

### 24. Marketplace 遗留 dead re-export 文件

**问题**：`apps/marketplace/lib/prd-annotations.ts` 是通过 `../../edu/lib/` 跨 app 引用的 re-export 文件，且无任何导入方。

**处理**：已删除 `apps/marketplace/lib/prd-annotations.ts`。`apps/marketplace/lib/annotation-edit-context.tsx` 仍被 root layout 使用，保留为跨 app re-export；长期应移入共享包。

- [x] 任务完成

---

### 25. 手写 `group-hover:opacity` 替换为 `HoverActionBar`

**问题**：12 处手写 `group-hover:opacity-*` 模式，其中 3 处是标准的 hover 操作按钮，应用 `HoverActionBar` 替代。其余 9 处为图片浮层、装饰渐变、模态框 chrome 等非操作按钮场景，不需要替换。

**文件**（已修复 3 处）：
- `apps/edu/app/evaluation/scene-results/[id]/page.tsx` — 附件列表的预览/下载按钮 → `HoverActionBar`
- `apps/edu/components/job/position-builder/step-ability-modeling.tsx` — 职责项的编辑/删除按钮 → `HoverActionBar`
- `apps/edu/components/evaluation/question-form-dialog.tsx` — 选项的排序/删除按钮 → `HoverActionBar`

- [x] 任务完成

---

### 26. `tasks/page.tsx` 5,646 行超大文件

**问题**：任务编辑器页面（`apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx`）将所有任务编辑逻辑塞入一个文件，是全项目最大的单文件，修改风险极高。

**方案**：
1. 将任务列表渲染提取为独立组件
2. 将各类任务配置（信息卡片、知识点、权重等）移至 `_components/` 已有的子组件
3. 将数据处理逻辑提取为自定义 hooks

**预估**：2 天（涉及重构大量内部状态逻辑，需谨慎执行）

- [ ] 任务完成

---

## 新增问题清单（本次审查发现，待后续排期）

以下问题在本次全量复核中确认存在，但改动面较大或需要跨模块协调，建议后续单独排期，不混入当前迭代。

### A. 后端稳定性

| # | 问题 | 位置 | 建议方案 | 预估 |
|---|------|------|---------|------|
| A1 | migration 版本号冲突 | `backend/migrations/006_*`、`064_*`、`067_*` 各有两个文件 | 重命名冲突文件，确保版本号唯一；需同步更新 `schema_migrations` | 0.5 小时 |
| A2 | `AuthHandler` goroutine 未优雅关闭 | `backend/cmd/server/main.go` | `router.New` 返回可关闭对象，main 中 `defer r.Shutdown()` | 0.5 小时 |
| A3 | `view_logs` 写入逻辑分散 | `position/scenario/resource handler` | 已抽象 `recordView` helper；后续可扩展为独立 service | 0.5 天 |
| A4 | Update 字段合并/Nullability 模式不一致 | `position/scenario/course handler` | 统一使用 patch helper 或 `NullableString` | 1 天 |
| A5 | 导入/导出/模板缺少通用 pipeline | `*_import_handler.go`、`template_handler.go` | 抽象 Excel/CSV 行 → DTO → 校验 → upsert → 重复处理 | 2-3 天 |
| A6 | 英文错误消息大量残留 | 全 handler 约 2000+ 处 | 统一翻译为中文 | 2 小时 |
| A7 | `parseUploadedExcel` 重复实现 | `position/scenario/course/granular_course_import_handler.go` | 提取到 `import_common.go` | 0.5 小时 |
| A8 | 事务 begin/rollback/commit 样板重复 | 多数 Create/Update handler | 提取 `withTx(ctx, db, fn)` helper | 0.5 天 |
| A9 | tenant admin CRUD 双份实现 | `tenant_admin_handler.go` vs `tenant_internal_admin_handler.go` | 提取共用方法到 `TenantHandler` | 0.5 天 |
| A10 | 认证状态码不一致 | `node_resource_handler.go:46`、`scenario_grade_handler.go:36` 返回 401，其余多返回 403 | 统一状态码 | 0.5 小时 |
| A11 | SQL scan 错误静默跳过 | `scenario_grade_handler.go:116`、`tenant_admin_handler.go:68` | 统一返回 500 或记录日志 | 0.5 小时 |

### B. 前端 edu

| # | 问题 | 位置 | 建议方案 | 预估 |
|---|------|------|---------|------|
| B1 | 超大文件 | `app/scene/scenarios/[id]/edit/tasks/page.tsx` (5646 行) 等 | 按功能拆分为多个子组件 | 2-3 天 |
| B2 | library / exam-usage / recommend / superadmin 未接入共享抽象 | `app/library/*`、`app/evaluation/exam-usage`、`app/job/recommend`、`app/superadmin` | 评估接入 `PortalCrudPage` / `ContentListPage` 或新增轻量抽象 | 2-3 天 |
| B3 | 状态抽象分裂 | `content-status.ts` vs `status.ts` | 统一标签、职责分离 | 0.5 天 |
| B4 | 共享组件自身未完全遵守规范 | `approval-list-page.tsx`、`archive-list-page.tsx`、`portal-crud-page.tsx` | 已改用 `TableRowActions` / `ConfirmDialog` | 已完成 |
| B5 | Landing detail 页面高度重复 | `app/scene/landing/[id]/page.tsx`、`app/lesson/landing/[id]/page.tsx` | 提取 `LandingDetailShell` 共享组件 | 0.5 天 |
| B6 | Empty state 硬编码重复 | 约 80 处散落各页面 | 统一使用 `EmptyState` / `EmptyPlaceholder` | 0.5 天 |
| B7 | `generateId` 重复实现 | `lib/evaluation-rule-store.ts`、`lib/stores/data-context.tsx`、`app/scene/page.tsx` 等 | 提取到 `lib/utils.ts` 的 `generateId(prefix)` | 0.5 小时 |
| B8 | 手动 status badge 未收敛 | `app/lesson/landing/[id]/page.tsx`、`app/library/ability/page.tsx` 等 | 统一使用 `StatusBadge` + `getStatusConfig()` | 0.5 天 |

### C. 前端 marketplace（已删除，仅作存档）

> `apps/marketplace` 前端源码已于 commit `25d0586` 彻底移除，当前工作树无相关代码。以下问题来自历史版本，若后续恢复 marketplace 可参考。

| # | 问题 | 位置 | 建议方案 | 预估 |
|---|------|------|---------|------|
| C1 | 完全没有服务器分页 | 几乎所有列表页使用 `limit: 1000/10000` | 接入 `ListResponse<T>` + 分页组件 | 2-3 天 |
| C2 | 自定义 status badge 重复 | `admin/institutions`、`admin/tenants`、`admin/withdrawals`、`wallet` 等 | 统一使用 `getStatusConfig()` + `StatusBadge` | 0.5 天 |
| C3 | 表单全部手搓 | `my-resources/new`、`institution/apply`、`admin/banners` 等 | 引入 `react-hook-form + zod` | 2-3 天 |
| C4 | 未复用 edu 页面级组件 | 所有列表/CRUD 页面从零实现 | 将 `ContentListPage`/`PortalCrudPage` 等下沉到 packages 后接入 | 3-5 天 |

### D. 共享包

| # | 问题 | 位置 | 建议方案 | 预估 |
|---|------|------|---------|------|
| D1 | API client 缺少高级能力 | `packages/api-client/src/api-helpers.ts` | 增加 typed `ApiError`、interceptor、retry、`useListQuery` | 2-3 天 |
| D2 | 页面级组件未下沉 | `apps/edu/components/shared/*` | 迁移到 `packages/ui` 或新建 `@zhiyu/page-kit` | 3-5 天 |

---

## 本次审查修复记录（2026-07-28 后续）

### 已直接修复的简单问题

| # | 问题 | 文件 | 改动 |
|---|---|---|---|
| F1 | `useState(new Date())` 非惰性初始化可能导致 hydration 不匹配 | `apps/edu/app/portal/workspace/_components/schedule-grid.tsx`, `teacher-dashboard-tab.tsx` | 改为 `useState(() => new Date())` |
| F2 | `packages/ui` barrel export 不完整 | `packages/ui/src/index.ts` | 补充 `PlatformSideNav` 及类型、`annotations` 公开 API |
| F3 | `PlatformShell` 深路径导入 `cn` | `apps/edu/components/platform-shell/PlatformShell.tsx` | 改为从 `@zhiyu/ui` 导入 |
| F4 | `packages/api-client` 根索引未导出类型/工厂 | `packages/api-client/src/index.ts` | 补充 `api-helpers`、`api-factory`、`types` 导出 |
| B1 | `coalesceStringSlice` 定义在业务 handler 中 | `backend/internal/handler/position_handler.go` → `common.go` | 迁移到通用位置 |
| B2 | Import helper 函数多处重复定义 | `backend/internal/handler/import_common.go` | 统一 `col`、`splitTrim`、`parseNullableInt`、`parseNullableFloat`、`nullableStr`、`parseIntDefault` |
| B3 | `generateSecurePassword` 定义在业务 handler 中 | `backend/internal/handler/tenant_handler.go` → `common.go` | 迁移到通用位置 |
| B4 | 后端错误消息中英混用/英文 | `backend/internal/handler/content_actions.go` | 翻译 `invalid status transition` / `current status` |
| B5 | `template_handler.go` 中 dead code | `backend/internal/handler/template_handler.go` | 删除未使用的 `setRows`、多余的 blank assignment |
| B6 | `tenant_admin_handler.go` 中 dead assignment | `backend/internal/handler/tenant_admin_handler.go` | 删除未使用的 `existing` 变量 |

验证结果：
- `apps/edu`: `pnpm lint` ✅ 0 errors / 0 warnings；`pnpm typecheck` ✅ 通过
- `backend`: `go vet ./...` ✅；`go test ./...` ✅ 通过

---

## 执行顺序建议

```
已完成:
  ✅ P0 全部 (platform-shell, data-provider, hooks, annotations, barrel export)
  ✅ P1 大部分 (evaluation 拆分, draftSuffix, typeMetaFor, window.confirm, alert,
              router 拆分, executeListQuery, parsePageLimit, portal-auth-context)
  ✅ P2 大部分 (api.ts 拆分, ai.ts 导出, Oplog 确认, Library 原生 table)
  ✅ #24 marketplace dead re-export 清理
  ✅ #25 手写 group-hover 替换为 HoverActionBar

剩余待执行:
  1 → #21 后端错误消息统一中文（P2, 2h，剩余大量中英混用）
  2 → #15 testhelper 与 router 同步（P1, 1.5d）
  3 → #19 packages/ui 领域代码清理（P2, 0.5h）
  4 → #26 tasks/page.tsx 拆分（P2, 2d，高优先级但成本高）
  5 → #6 双份类型系统清理（P1, 2d，涉及引用面广，低优先级）

不执行:
  ⏭️ #23 Repository 层（成本过高，暂缓）
```

## 架构目标

```
当前:
├── packages/
│   ├── shared-types/     ← 类型包（双份类型已标记 deprecated，ai.ts 已导出）
│   ├── api-client/       ← API 客户端（已按 domain 拆分为 10 个模块）
│   └── ui/               ← UI 组件（已有 barrel export，含少量待清理的领域代码）
├── apps/
│   ├── edu/
│   │   ├── shared/*      ← 页面级共享抽象，部分可继续下沉到 packages/ui/
│   │   ├── platform-shell/  ← 已从 packages/ui 统一导入，本地仅保留组合层
│   │   ├── providers/    ← data-provider 共享核心已下沉 packages/ui
│   │   ├── hooks/        ← use-mobile/use-toast 薄 re-export 已删除
│   │   └── lib/          ← annotations 薄 re-export 已删除
│   └── marketplace/
│       └── 死代码已清理，仅保留 marketplace 独有组件和页面
└── backend/
    └── internal/
        ├── handler/      ← 分页样板已收敛，日志已统一为 slog，view_log 已抽象
        └── router/       ← 已按领域拆分，支持 graceful shutdown

目标:
├── packages/
│   ├── shared-types/     ← 清理重复类型，拆分超大文件
│   ├── api-client/       ← 按 domain 拆分
│   └── ui/
│       ├── components/
│       │   ├── status-badge.tsx
│       │   ├── confirm-dialog.tsx
│       │   ├── table-row-actions.tsx
│       │   ├── hover-action-bar.tsx
│       │   ├── empty-state.tsx
│       │   └── loading-view.tsx
│       ├── platform-shell/
│       │   ├── config.ts, icons.ts, utils.ts, index.ts
│       │   └── PlatformSideNav.tsx
│       ├── hooks/
│       │   ├── use-mobile.ts
│       │   ├── use-toast.ts
│       │   └── use-platform-links.ts
│       ├── data-provider.tsx (共享核心)
│       └── lib/
│           └── utils.ts (cn 等)
├── apps/
│   ├── edu/              ← 只保留 edu 独有的组件和页面
│   └── marketplace/      ← 只保留 marketplace 独有的组件和页面
└── backend/
    └── internal/
        ├── handler/      ← 泛型 List 查询，统一错误消息中文
        └── router/       ← 按平台拆分
```
