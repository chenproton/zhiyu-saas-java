# 内容对象状态机审计

## 核心决策

所有内容型对象（岗位、场景、课程、题库、试卷）统一使用同一套状态与流转规则：

- 状态集合：`draft` / `pending` / `approved` / `rejected` / `published` / `archived`
- 后端统一状态机：`backend/internal/handler/content_actions.go`
- 后端统一路由：`backend/internal/router/router.go` 通过 `registerContentRoutes` 注册标准 action 端点
- 共享类型：`packages/shared-types/src/evaluation.ts` 中的 `Status`、`STATUS_TRANSITIONS`、`canPerformAction`
- API 工厂：`packages/api-client/src/api-factory.ts` 中的 `createContentApi`

## 状态流转矩阵

| 当前状态 \ 目标状态 | draft | pending | approved | rejected | published | archived |
|---|---|---|---|---|---|---|
| draft | - | ✓ | - | - | - | ✓ |
| rejected | - | ✓ | - | - | - | ✓ |
| pending | ✓ | - | ✓ | ✓ | - | - |
| approved | ✓ | - | - | - | ✓ | ✓ |
| published | ✓ | - | - | - | - | ✓ |
| archived | ✓ | - | - | - | - | - |

说明：
- `save-draft` 对应的目标状态是 `draft`。
- 审批通过后（`approved`）可发布（`published`）。
- 已发布对象可以取消发布，回到 `draft`（复用 `save-draft` 语义）。
- `archived` 可通过 `save-draft` 恢复为 `draft`，恢复后可在原编辑页继续编辑或重新提交审批。

## 关键行为

1. **编辑后保存草稿回退到 draft**
   - 当对象处于 `approved` 或 `published` 时，前端点击“保存草稿”后：
     1. 先保存业务数据（update / save-full / 任务保存等）。
     2. 调用 `POST /{entity}/{id}/save-draft`。
     3. 本地状态同步为 `draft`。
   - 适用页面：
     - 岗位编辑：`/job/positions/[id]/edit`
     - 场景编辑：`/scene/scenarios/[id]/edit`
     - 场景任务链：`/scene/scenarios/[id]/edit/tasks`
     - 体系课编辑：`/lesson/admin/system/add?id=...`
     - 颗粒课编辑：`/lesson/admin/granular/add?id=...`
     - 混合课程编辑：`/lesson/admin/hybrid/add?id=...`
     - 试卷详情：`/evaluation/exams/[id]`
     - 题库详情：`/evaluation/question-banks/[id]`

2. **编辑、删除与归档权限**
   - 可编辑：`draft` / `rejected` / `approved` / `published` / `archived`
   - 可删除：`draft` / `rejected` / `archived`
   - 可归档：`draft` / `rejected` / `approved` / `published`（`pending` 与 `archived` 不可归档）

3. **审批与发布入口**
   - 提交审批：`POST /{entity}/{id}/submit`（`draft`/`rejected` → `pending`）
   - 审批通过/驳回：审批中心调用 `POST /approvals/{id}/review`，对应对象状态同步更新。
   - 发布：`POST /{entity}/{id}/publish`（`approved` → `published`）
   - 归档：`POST /{entity}/{id}/archive`

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 后端状态机统一 | PASS | `content_actions.go` 中 `allowedStatusTransitions` 统一控制五个对象 |
| SaveDraft 端点 | PASS | 五个 handler 均实现 `SaveDraft` 并注册 `/{id}/save-draft` 路由 |
| 共享类型一致 | PASS | `STATUS_TRANSITIONS` 与后端矩阵一致，`save_draft.from` 包含 `approved`/`published`/`archived` |
| API 客户端覆盖 | PASS | `createContentApi` 暴露 `saveDraft(id)` 与 `archive(id)` |
| 前端保存草稿回退 | PASS | 所有内容编辑页均实现 approved/published/archived → draft 回退 |
| 归档与恢复入口 | PASS | 课程、场景、岗位列表均提供行级/批量归档按钮，并在归档库提供恢复入口 |
| 本地验证 | PASS | `go vet ./...`、`go test ./...`、`go build ./cmd/server/main.go`、`pnpm -r typecheck`、`pnpm -r lint`、`pnpm build:edu`、`pnpm build:marketplace` 通过 |

## 风险与约束

- 状态回退只变更对象本身状态，不生成新版本或快照；若未来需要版本历史，需额外设计。
- 场景任务链的保存草稿/完成配置会批量更新任务后再回退场景状态，任务本身无独立审批状态。
- 题库题目编辑后当前不会自动回退题库状态，需要点击“保存题库”手动回退。
