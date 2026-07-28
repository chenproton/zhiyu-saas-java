# 代码质量收敛计划

> 基于 `2026-07-28` 全量代码审查，梳理问题清单与修复计划。
> 按优先级 P0 → P1 → P2 排列，完成一项勾一项。

---

## 总体评分

| 维度 | 评分 | 状态 |
|------|------|------|
| 组件抽象 | 7.5/10 | 大部分已抽象，但 packages/ui 和 apps 间有显著重复 |
| 代码结构 | 8/10 | 分层清晰，但后端 router 和前端超大文件有改善空间 |
| 可迭代性 | 7/10 | 核心架构稳定，但双份类型系统是历史包袱 |
| 可读性 | 7.5/10 | 命名规范一致，超大文件 + 中英混用降低流畅度 |

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

- [ ] 任务完成

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

- [ ] 任务完成

---

### 3. Hooks 完全重复（3 个）

**问题**：`use-mobile.ts`、`use-toast.ts`、`use-platform-links.ts` 在 edu 和 marketplace 中各有一份完整副本。

**文件**：
- `apps/edu/hooks/use-mobile.ts` ↔ `apps/marketplace/hooks/use-mobile.ts`
- `apps/edu/hooks/use-toast.ts` ↔ `apps/marketplace/hooks/use-toast.ts`
- `apps/edu/hooks/use-platform-links.ts` ↔ `apps/marketplace/hooks/use-platform-links.ts`

**方案**：移入 `packages/ui/src/hooks/`，各 app 从 `@zhiyu/ui` 导入。

**预估**：0.5 天

- [ ] 任务完成

---

### 4. `lib/annotations/` 完全重复

**问题**：annotation 相关文件（`adapter.ts`、`json-file-adapter.ts`、`types.ts`、`prd-annotations.ts`、`annotation-edit-context.tsx`）在 edu/marketplace 和 packages/ui 中都有。

**文件**：
- `apps/edu/lib/annotations/adapter.ts` ↔ `apps/marketplace/lib/annotations/adapter.ts` ↔ `packages/ui/src/lib/annotations/adapter.ts`
- `apps/edu/lib/annotations/json-file-adapter.ts` ↔ `apps/marketplace/lib/annotations/json-file-adapter.ts` ↔ `packages/ui/src/lib/annotations/json-file-adapter.ts`
- `apps/edu/lib/annotations/types.ts` ↔ `apps/marketplace/lib/annotations/types.ts` ↔ `packages/ui/src/lib/annotations/types.ts`
- `apps/edu/lib/prd-annotations.ts` ↔ `apps/marketplace/lib/prd-annotations.ts` ↔ `packages/ui/src/lib/prd-annotations.ts`

**方案**：删除 edu 和 marketplace 中的副本，统一从 `packages/ui/src/lib/` 导入。

**预估**：0.5 天

- [ ] 任务完成

---

### 5. `packages/ui/` 缺少 barrel export

**问题**：`packages/ui/src/` 没有 `index.ts`，消费者无法统一导入。

**方案**：创建 `packages/ui/src/index.ts`，导出所有公开组件、hooks、工具函数。

**预估**：0.5 小时

- [ ] 任务完成

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
2. 将废弃的类型标记 `@deprecated`，添加 JSON 注释
3. 逐步将废弃类型的使用迁移到规范类型
4. 最终删除 `-source.ts` 和 `scene-mock.ts`

**预估**：2 天（涉及前后端多处引用，需要逐个排查）

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

- [ ] 任务完成

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

- [ ] 任务完成

---

### 9. `typeMetaFor()` 三处重复

**问题**：org 类型图标映射函数在三个文件中逐字重复。

**文件**：
- `apps/edu/components/shared/org-node-picker.tsx:33-41`
- `apps/edu/components/shared/user-selector.tsx:37-46`
- `apps/edu/components/shared/_components/org-filter-tree.tsx:17-26`

**方案**：提取到 `apps/edu/lib/org-type-icons.ts` 或整合进 `use-org-tree.ts`。

**预估**：0.5 小时

- [ ] 任务完成

---

### 10. 前端 `window.confirm()` 残留（2 处）

**问题**：AGENTS.md 规定用 `<ConfirmDialog>`，但仍有 2 处使用原生 `confirm()`。

**文件**：
- `apps/edu/components/shared/workflow-config-page.tsx:102` — `if (!confirm("确定删除该审批流程吗？")) return`
- `apps/edu/components/shared/batch-group-page.tsx:208` — `if (!confirm("确定删除该批次吗？")) return`

**方案**：替换为 `<ConfirmDialog>` + 状态管理。

**预估**：1 小时

- [ ] 任务完成

---

### 11. 前端 `alert()` 调用（10+ 处）

**问题**：应使用 `toast()` (sonner)，但多处使用浏览器原生 `alert()`。

**文件**：
- `apps/edu/app/evaluation/question-banks/[id]/page.tsx` (4 处: lines 173, 181, 200, 219)
- `apps/edu/app/evaluation/exams/page.tsx` (2 处: lines 68, 75)
- `apps/edu/app/evaluation/landing/exams/[id]/page.tsx` (line 153)
- `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx` (2 处: lines 2689, 4505)
- `apps/edu/app/lesson/admin/_components/assessment/course-evaluation-rules-dialog.tsx` (line 1953)
- `apps/edu/app/library/knowledge/page.tsx` (line 136) — 此处是 `confirm()`

**方案**：逐文件替换为 `toast()` (import from `@/hooks/use-toast`)。

**预估**：1.5 小时

- [ ] 任务完成

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

### 16. `portal-auth-context.tsx` 与 `components/auth-provider.tsx` 重复

**问题**：两者实现几乎相同的 portal 认证逻辑。

**文件**：
- `apps/edu/contexts/portal-auth-context.tsx`
- `apps/edu/components/auth-provider.tsx`

**方案**：删除 `portal-auth-context.tsx`，统一使用 `auth-provider.tsx`，调整引用。

**预估**：1 小时

- [ ] 任务完成

---

## P2 — 代码质量改善

### 17. `api.ts` 1338 行按 domain 拆分

**问题**：单个 API 文件过大，所有端点混在一起。

**方案**：拆分为 `auth.ts`、`users.ts`、`job.ts`、`scene.ts`、`lesson.ts`、`evaluation.ts`、`library.ts`、`import-export.ts`，通过 `index.ts` re-export。

**预估**：1 天

- [ ] 任务完成

---

### 18. Library 平台使用原生 `<table>` 标签

**问题**：4 个 Library CRUD 页面使用原始 HTML `<table>` 而非 shadcn `<Table>` 组件。

**文件**：
- `apps/edu/app/library/knowledge/page.tsx`
- `apps/edu/app/library/ability/page.tsx`
- `apps/edu/app/library/questions/page.tsx`
- `apps/edu/app/library/resources/page.tsx`

**方案**：替换为 `<Table>` / `<TableHeader>` / `<TableBody>` / `<TableRow>` / `<TableHead>` / `<TableCell>`。

**预估**：1 小时

- [ ] 任务完成

---

### 19. `packages/ui/src/lib/` 领域代码清理

**问题**：`prd-annotations.ts` (1345 行) 和 `annotation-edit-context.tsx` 是领域功能代码，不应在共享 UI 包中。

**方案**：移入 `apps/edu/data/` 或 `apps/edu/lib/annotations/`。

**预估**：0.5 小时

- [ ] 任务完成

---

### 20. `shared-types/src/index.ts` 未导出 `ai.ts`

**问题**：AI 类型无法通过 barrel import 使用。

**方案**：在 `index.ts` 添加 `export * from "./ai"`。

**预估**：5 分钟

- [ ] 任务完成

---

### 21. 后端中英文错误消息混用

**问题**：handler 中错误消息有的是英文（`"missing required fields"`），有的是中文（`"租户标识已存在"`），同一文件内也混用。

**方案**：统一为中文（当前项目面向中国用户），逐个文件修改。

**预估**：2 小时

- [ ] 任务完成

---

### 22. 后端 Oplog 中间件重复应用

**问题**：`router.go` 全局认证组和文件上传组都添加了 `OperationLog` 中间件，导致文件上传请求记录两条日志。

**方案**：从文件上传组移除重复的 `OperationLog`，仅依赖全局中间件。

**预估**：5 分钟

- [ ] 任务完成

---

### 23. 后端无 Repository 层

**问题**：所有 handler 直接执行 SQL，无抽象层，无法进行单元测试（当前全为集成测试依赖 PostgreSQL）。

**方案**：可选。引入 Repository 接口的成本较高（影响 50+ handler），建议在后续大重构中考虑。暂不排入本次计划。

**预估**：暂不执行

- [ ] 跳过

---

## 执行顺序建议

```
Week 1: P0 全部 (消除跨 app 重复)
  1  → packages/ui barrel export
  2  → platform-shell 移动到 packages/ui
  3  → 3 个 hooks 移到 packages/ui
  4  → annotations 去重
  5  → data-provider 提取共享核心

Week 2: P1 前半
  6  → 双份类型系统清理
  7  → evaluation.ts 拆分
  8  → draftSuffix 去重
  9  → typeMetaFor 去重
  10 → window.confirm 修复
  11 → alert 修复

Week 3: P1 后半 + P2 前半
  12 → router.go 拆分
  13 → List handler 泛型抽取
  14 → parseInt → parsePageLimit
  15 → api.ts 拆分
  16 → testhelper 同步
  17 → portal-auth-context 去重

Week 4: P2 收尾
  18 → Library 原生 table 替换
  19 → packages/ui 领域代码清理
  20 → ai.ts 导出
  21 → 错误消息统一
  22 → Oplog 去重
```

## 架构目标

```
当前:
├── packages/
│   ├── shared-types/     ← 类型包（有双份类型、无 ai.ts 导出）
│   ├── api-client/       ← API 客户端（1338 行单体文件）
│   └── ui/               ← UI 组件（缺 barrel export，含领域代码）
├── apps/
│   ├── edu/
│   │   ├── shared/*      ← 很好，但部分应移入 packages/ui/
│   │   ├── platform-shell/  ← 与 marketplace 完全重复
│   │   ├── providers/    ← data-provider 90% 重复
│   │   ├── hooks/        ← use-mobile/use-toast 重复
│   │   └── lib/          ← annotations 重复
│   └── marketplace/
│       └── (同上重复)
└── backend/
    └── internal/
        ├── handler/      ← 分页样板重复 20+，中英混用
        └── router/       ← 730 行单体文件

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
