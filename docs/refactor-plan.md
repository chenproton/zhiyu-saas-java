# 代码质量收敛计划

> 基于 `2026-07-28` 全量代码审查（前后端 + 共享包），持续更新。

---

## 总体评分

| 维度 | 评分 | 状态 |
|------|------|------|
| 组件抽象 | 7.0/10 | 跨 app 重复已消除；Library 6 个 CRUD 页仍用内联按钮模式；Landing 列表/详情页重复 |
| 代码结构 | 7.0/10 | router/api-client 已拆分；核心 handler 已迁移 executeListQuery；DataProvider 743 行单体待拆分 |
| 可迭代性 | 7.0/10 | 核心架构稳定；24 个文件仍引用 deprecated 类型；超大文件（tasks 5620行、mock-data 3611行）阻塞迭代 |
| 可读性 | 7.5/10 | 死代码/占位已清理；library/landing 508 行纯行内 style 影响阅读；auth-context 含误导性空 shim |

---

## 后端

### 类型与领域

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| B1 | 认证状态码 401/403 混用 | 低 | 低 | `claims == nil` 全局返回 403；部分端点应返回 401。统一 `requireAuth`/`requireTenant` helper。 |
| B2 | Update 字段合并/Nullability 模式不一致 | 高 | 中 | `position_handler.go:326` 手动 nil coalescing 14 字段，`scenario_handler.go` 用 `NullableString`。建议 Repository 层统一。 |
| B3 | `respondJSON` 静默丢弃 Encode 错误 | 低 | 低 | `common.go:81` — `_ = json.NewEncoder(w).Encode(payload)`。加 `json.Marshal` 前置检查。 |

### 安全性

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| B4 | SQL scan 错误静默跳过 — ~60+ 处 | 中 | 中 | `template_handler.go` 的 `queryDicts`(7 处) + `queryLessonBatches` + import handler 系列。逐个 propagate 或至少 `slog.Error`。之前估算 44 处偏少。 |

### 重构

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| B5 | 后端缺少 Repository/Service 层 | 极高 | 高 | 95+ handler，分批试点。先选 1-2 个独立领域（job/scene）抽象 interface。 |
| B6 | 超大 handler 文件 | 中 | 中 | `template_handler.go`(1219)、`position_handler.go`(1149)、`resource_import_handler.go`(894)。 |
| B7 | tenant admin CRUD 双份实现 | 中 | 中 | `tenant_internal_admin_handler.go` vs `tenant_admin_handler.go`，提取共用 private method。 |
| B8 | 导入/导出缺少通用 pipeline | 高 | 高 | 8 个 import handler。`parseUploadedExcel` 已统一到 `import_common.go`。下一步抽象 row→DTO→validate→upsert→dedup。 |
| B9 | `lookupBatch`/`findOrCreateKnowledgePoints` 等在多个 import handler 间重复 | 中 | 中 | `findOrCreateKnowledgePoints` 在 4 个 handler 中重复，`findOrCreateResources` 在 3 个 handler 中重复。统一到 `import_common.go`。 |
| B10 | 45+ 处 `SELECT id FROM <table> WHERE tenant_id=$1 AND name=$2` 相同模式 | 低 | 中 | 出现在 8 个文件中（position_import、scenario_import、course_import 等）。加 `lookupIDByName()` 到 `import_common.go`，表名白名单。 |
| B11 | Template handler `setHdr`/`setA1` 闭包在 12 个方法中各重复一次 | 低 | 中 | `template_handler.go:151` 起每个 `generate*Template` 都定义相同的两个闭包（~200 行重复）。提取为 `templateSheetBuilder` struct。 |
| B12 | `queryDicts()` 每次查 7 张表但各模板仅用 2-5 个结果 | 低 | 低 | `template_handler.go:58` — 可选拆为按需懒加载单条查询，减少不必要 DB 往返。 |
| B13 | `contentActions` 仅覆盖 5 种实体（career_positions/courses/exams/question_banks/scenarios） | 中 | 低 | 其余 45+ handler 类型各自手写 List/Create/Update/Delete。与 B5 一起在 Repository 层重构。 |

### 运维与稳定性

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| B14 | migration 版本号冲突 | 低 | 低 | `006_*`/`064_*`/`067_*` 各有两个文件。需同步 `schema_migrations` 表。 |
| B15 | testhelper/setup.go 与 router 不同步 | 中 | 中 | 658 行测试 setup 独立维护。分离 handler 实例化与路由注册后可复用。 |
| B16 | `view_logs` 写入逻辑分散 | 低 | 低 | 已有 `recordView` helper，可扩展为独立 service。 |
| B17 | `config.go` .env 加载忽略错误 | 极低 | 极低 | 加 `slog.Warn` 在文件存在但不可读时提示。 |
| B18 | `oplog.go` 路径匹配用 `strings.Contains` | 极低 | 极低 | 改为 `strings.HasPrefix` + 精确匹配。 |
| B19 | `resource_handler.go` 全部 10 个方法为占位 stub | 低 | 低 | 连接实际 resource 数据表后实现，或从路由中暂时移除避免混淆。 |

---

## 前端

### 大型重构

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| F1 | `tasks/page.tsx` 5620 行超大文件 | 极高 | 高 | 分批：①提取 `useTaskList`/`useTaskEditor` hooks → ②任务卡片独立组件 → ③评测逻辑拆分。文件亦从 `@/lib/mock-data` import `Task`/`PositionAbility`/`GradeMapping` 类型，类型迁出后可解除依赖。 |
| F2 | 前端 `any` ~485 处 | 极高 | 高 | 渐进式。优先 API 返回值/共享组件泛型，其次表单/内部状态。每轮 50 处。 |
| F3 | 共享组件类型安全薄弱 | 高 | 中 | `ContentListPage`/`BatchGroupPage`/`ApprovalListPage` 引入泛型 `<T>`。 |
| F4 | `DataProvider` 领域混杂 (743行) | 中-高 | 中 | 按 graduation/cert/portrait/scene 拆分为独立 hooks。当前 30+ edu 类型和 10 个 parser 存在于通用 `@zhiyu/ui` 包中。 |
| F5 | `auth-context.tsx` 包含死代码 `login()` / `switchRole()` 空操作 | 低 | 低 | `login()` 始终返回 `false`；`switchRole()` 为 no-op。portal 页面依赖全局登录流程 —— 移除这些 shim 并清理 `AuthContextType` 接口。 |

### 共享抽象收敛

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| F6 | library 页面未用 `TableRowActions` | 低 | 低 | knowledge/questions/ability/certificates/resources/resources[type] 共 6 个 CRUD 页使用内联 `<Button variant="ghost"><Pencil/><Trash2/></Button>`。始终可见可能 UX 更好，先评估。 |
| F7 | Library CRUD 6 页含 ~500 行相同的 StatCard + 搜索栏 + Table + 编辑 Dialog 结构 | 中 | 中 | 提取 `LibraryCrudPage<T>` 组件，消除 6 页间的样板重复。 |
| F8 | `EmptyState` 未推广 | 中 | 中 | 80+ 处需替换。先试单页，确认模板后批量迁移。 |
| F9 | Landing detail 页面重复 | 中 | 中 | `scene/landing/[id]/page.tsx`(852行) 和 `lesson/landing/[id]/page.tsx`(522行) 共享相同的封面头、Tab 导航、面包屑、骨架屏、PlatformFooter 布局。提取 `LandingDetailShell`。 |
| F10 | Landing 列表页重复 | 中 | 中 | `lesson/landing/page.tsx`(418行) 和 `evaluation/landing/page.tsx`(281行) 共享相同的横幅、统计栏、筛选区、工具栏、卡片网格、分页、Footer 布局。提取 `LandingListShell`。 |
| F11 | Portal 系统页面未接入 `PortalCrudPage` | 中 | 中 | 7 个目标页面：industries + majors + teachers + students 已接入 ✓。accounts/roles/graduates/fields 仍手动实现表+搜索+分页+对话框。 |
| F12 | `ContentListPage` 导入逻辑 → `useImportFlow` | 低 | 中 | 大部分已迁移。~~F11（question-banks 导入）已通过 ContentListPage 解决~~ → resolved。 |
| F13 | `useEntityWithRelations` hook | 低 | 中 | hook 包装 `Promise.all([list, get])`，消除 ~5 个页面样板。 |
| F14 | CoverImage 上传 UI 重复 | 低 | 中 | `scene/scenarios/[id]/edit/page.tsx:319` 和 `job/positions/[id]/edit/page.tsx:319` 有相同 60 行封面图上传 UI。提取 `<CoverImageUpload>`。 |
| F15 | Resource 上传区 UI 重复 | 低 | 中 | `resources/page.tsx:244` 和 `resources/[type]/page.tsx:132` 有相同 100 行拖拽上传 UI。提取 `<ResourceUploadZone>`。 |
| F16 | Archive 页面 ConfirmDialog 模式重复 | 低 | 低 | `job/archive/page.tsx:235` 和 `scene/archive/page.tsx:230` 手动渲染单一/批量删除两个 `ConfirmDialog`。纳入 `ArchiveListPage` 内部。 |

### 代码清理

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| F17 | `content-status.ts` vs `status.ts` 标签分裂 | 低-中 | 低 | 两者职责不同（状态机 vs 展示 lookup），仅 ~2 处标签微小差异。 |
| F18 | 废弃类型系统迁移 | 高 | 中 | `job-source.ts`/`lesson-source.ts`/`scene-mock.ts` 已标记 `@deprecated`。24 个文件（含 core: tasks/page.tsx）仍从这些模块 import。迁移调用方后删除。 |
| F19 | `shared-types` 含运行时逻辑 | 低 | 低 | `uid()`/`clone()` 移入 `packages/ui/src/lib/`。 |
| F20 | `mock-data.ts` 在 production lib (3611行) | 中 | 中 | 移至 `test/fixtures/`。`method-config-dialog.tsx` 对 `GradeMapping` 的 import 已修复（→ `@/lib/types/lesson`），`tasks/page.tsx` 仍 import `Task`/`PositionAbility`/`GradeMapping`。 |
| F21 | `use-subscription-modules` 返回值不透明 | 低 | 低 | 返回 `Record<string, boolean> \| null` — 无 `loading`/`error` 暴露。`null` vs `{}` 含义不同但消费者无法区分。 |
| F22 | `library/landing` 纯行内样式 | 中 | 低 | 508 行 `style={{...}}` 无 Tailwind，可能是 intentional 视觉差异。 |
| F23 | 部分页面未接入共享抽象 | 中-高 | 低-中 | `library/exam-usage/recommend/superadmin` 各有独特 UI，逐个评估。 |
| F24 | `method-config-dialog.tsx` `evalSubTypeLabels`/`evalSubTypeColors` 内联定义 | 低 | 低 | 30 行内联配置，应移至共享常量或 `getStatusConfig()` 模式。 |
| F25 | `dom-utils.ts` 命令式 DOM 操作（`createTagElement` 用 `document.createElement`） | 低 | 低 | 反 React 模式，替代为 JSX 组件。 |
| F26 | `menu-permissions.ts` `buildMenuTree()` 缓存永不过期 | 低 | 低 | 模块级 `Set` 缓存 — 若订阅变化导致菜单项变更，缓存不刷新。需在模块被更新时失效。 |
| F27 | `menu-permissions.ts` `getPermissionModuleConfigForRole` 忽略参数 | 低 | 低 | 接收 `permissions: unknown` 但直接返回静态配置。若绑定权限，需要实现动态过滤。 |
| F28 | `navigation-config.ts` `PLATFORM_CARD_DESCRIPTIONS` 与 nav config 分离 | 低 | 低 | 新增模块需两处同步更新。考虑将描述字段 co-locate 到 nav config item 上。 |

---

## 共享包

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| S1 | API client 错误处理不一致 | 中 | 中 | `request()`/`authedFetch()` 双 pipeline 合并为单一 `apiFetch<T>()` + typed `ApiError`。 |
| S2 | 页面级组件未下沉到 packages | 高 | 中 | `ContentListPage`/`PortalCrudPage` 当前仅 edu 使用，marketplace 已删除。等有第二个 app 再做。 |
| S3 | edu 领域代码泄漏到 `@zhiyu/ui` | 中 | 中 | `useImportFlow`/`usePlatformLinks`/`data-provider` 迁出到 `apps/edu/lib/`。DataProvider 含 30+ edu 类型。 |
| S4 | `api-client/types/` 9 文件多为 `shared-types` 的 pass-through 导出 | 低 | 低 | 合并或删除重复类型定义，统一从一个包导入。 |
| S5 | `certification.ts` 含死代码 | 低 | 低 | 标记未使用的导出并从 barrel 中移除。 |

---

## Marketplace（存档参考）

> `apps/marketplace` 前端源码已移除，Marketplace 恢复时参考。

| # | 问题 | 难度 | 收益 |
|---|------|------|------|
| M1 | 无服务器分页 | 中 | 中 |
| M2 | 自定义 status badge | 低 | 低 |
| M3 | 表单手写 | 中 | 中 |
| M4 | 未复用 edu 组件 | 高 | 中 |

---

## 部署与运维

| # | 问题 | 难度 | 收益 | 评估与路径 |
|---|------|------|------|-----------|
| D1 | `deploy.sh` 依赖检查遗漏 | 极低 | 极低 | 补充 `curl`/`rsync` 等检查。 |
| D2 | 前端健康检查 URL 脆弱 | 低 | 低 | 增加 `/api/health` 端点。 |

---

## 架构目标

```
当前:
├── packages/
│   ├── shared-types/     ← 类型包（双份类型已标记 deprecated；含运行时 uid/clone）
│   ├── api-client/       ← 按 domain 拆分；request/authedFetch 双 pipeline；types/ 多余 pass-through
│   └── ui/               ← 通用 UI 组件 + platform-shell；DataProvider 混有 30+ edu 领域类型
├── apps/edu/
│   ├── shared/*          ← 页面级共享抽象（类型安全薄弱；Library 6 页未使用）
│   ├── platform-shell/   ← 已从 packages/ui 导入，本地仅组合层
│   ├── providers/        ← data-provider 共享核心在 packages/ui
│   ├── lib/converters/   ← 仅 job-converters，其他领域缺失
│   ├── lib/mock-data.ts  ← 3611 行，含生产代码依赖的类型定义
│   └── contexts/auth-context.tsx ← login/switchRole 为空操作 shim
├── apps/marketplace/     ← 前端源码已移除
└── backend/
    └── internal/
        ├── handler/      ← parseUploadedExcel/withTx 已统一；setHdr/setA1 闭包 12x 重复；contentActions 仅覆盖 5 种实体；resource_handler 10 方法全为 stub
        ├── domain/       ← ScenarioStatus 已别名化 ContentStatus
        └── router/       ← 已按领域拆分

目标:
├── packages/
│   ├── shared-types/     ← 纯类型包，清理重复类型和 mock-only 类型
│   ├── api-client/       ← 统一错误处理 pipeline + typed ApiError
│   └── ui/
│       ├── components/   ← 通用 UI 组件（无 edu 领域代码）
│       ├── platform-shell/
│       ├── hooks/        ← 通用 hooks
│       └── lib/          ← 通用工具（cn、generateId）
├── apps/edu/
│   ├── shared/*          ← 页面级组件，类型完整，Library 接入共享抽象
│   ├── lib/              ← edu 领域 hooks/utils（DataProvider 拆分、converters 补齐）
│   ├── test/             ← mock-data.ts 迁入测试目录
│   └── ...               ← edu 独有页面和组件
└── backend/
    └── internal/
        ├── store/        ← 按领域 repository/service 层
        ├── handler/      ← HTTP 编排、参数校验、响应封装
        └── router/       ← 按平台拆分
```

---

## 修复记录

### 2026-07-28（本次审查）

| 修复 | 文件 | 说明 |
|------|------|------|
| `method-config-dialog.tsx` | `app/scene/.../method-config-dialog.tsx:25` | `GradeMapping` import 从 `@/lib/mock-data` 改为 `@/lib/types/lesson`（shared-types），消除生产代码对 mock-data 的类型依赖 |
| `use-submitter-names.ts` | `hooks/use-submitter-names.ts` | 新增 `error` state 暴露 fetch 失败信息，catch 中设置 `setError` |
| `resource_handler.go` | `backend/internal/handler/resource_handler.go` | 添加 TODO 注释说明当前为占位实现，10 个方法待对接实际数据表 |
