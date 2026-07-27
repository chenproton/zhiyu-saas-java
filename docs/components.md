# 前端公共组件速查

> 所有组件均位于 `apps/edu/components/shared/`。新增页面时优先复用，避免重复造轮子。

## 页面级组件

| 组件 | 适用场景 |
|------|---------|
| `ContentListPage<T>` | 内容资源管理列表页（岗位/场景/课程/题库/试卷，含 Tab 筛选、批量操作、导入导出），注入 `itemApi`/`batchApi`/`approvalApi` + `renderList` |
| `EditorShell` | 内容编辑器框架（全屏/内嵌、步骤导航、保存/提交），设置 `mode`/`step`/`onSaveDraft`/`onSubmit` 等回调 |
| `BatchGroupPage` | 批次分组管理页，注入 `api: BatchGroupApi` + `subtitle` |
| `WorkflowConfigPage` | 审批流配置页，仅需 `subtitle` 文案 |
| `ApprovalListPage<T>` | 审批中心列表页（待审批/已审批 Tab、单选/批量通过驳回），注入审批数据 + `columns` + `detailHref` |
| `ArchiveListPage<T>` | 归档管理页（左侧分类筛选+表格+恢复/删除），注入 `columns`/`detailHref`/`onRestore`/`onDelete` |
| `PortalCrudPage<T>` | Portal 系统管理 CRUD 表格页（行业/专业），注入 `fetchItems`/`columns`/`renderForm`/`onSave`/`onDelete` |
| `PortalSidebarCrudPage<T>` | Portal 组织树筛选 CRUD 表格页（教师/学生），注入上述内容 + `importFlow` + `orgFilterTree` |
| `EvaluationListTable` | 评测列表渲染器（题库/试卷的 `renderList`），`<EvaluationListTable ... type="bank"\|"exam" />` |

## 通用页面模式速查

| 页面类型 | 复用方案 | 示例路径 |
|---------|---------|---------|
| 带审批的内容资源管理 | `ContentListPage` + 模块专用 `renderList` | `job/positions`, `scene`, `evaluation/question-banks`, `evaluation/exams`, `lesson/admin/courses` |
| 批次管理 | `BatchGroupPage` | `job/batches`, `scene/batches`, `evaluation/batches`, `lesson/admin/batches` |
| 审批流配置 | `WorkflowConfigPage` | `job/workflows`, `scene/workflows`, `evaluation/workflows`, `lesson/admin/workflows` |
| 审批中心 | `ApprovalListPage` | `job/approvals`, `scene/approvals`, `evaluation/approvals`, `lesson/admin/approvals` |
| 内容编辑器 | `EditorShell` | `job/positions/[id]/edit`, `scene/scenarios/[id]/edit`, `lesson/admin/*/add`（7 个页面） |
| Portal CRUD | `PortalCrudPage` / `PortalSidebarCrudPage` | `portal/apps/system/resource/industries`, `teachers`, `students` |
| 归档管理 | `ArchiveListPage` | `job/archive`, `scene/archive`, `lesson/admin/archive` |
| 日志查看 | `LogTableShell<T>` | `portal/apps/system/logs/login`, `operation` |

## 表单/交互组件

| 组件 | 适用场景 | 关键 Props |
|------|---------|-----------|
| `StatusBadge` | 状态标签（统一颜色体系） | `status` |
| `ConfirmDialog` | 删除/危险操作二次确认 | `open`, `onOpenChange`, `title`, `description`, `variant`, `onConfirm` |
| `TableRowActions` | 表格行悬浮操作按钮，替代手写 `group-hover` | 包裹 `<Button>` 子元素 |
| `HoverActionBar` | 非 Table 场景的 hover 操作栏 | 包裹子元素 |
| `UserSelector` | 选择用户（多选/单选、组织树筛选、排除学生） | `value`, `onChange`, `multiple`, `excludeStudent`, `tenantId` |
| `OrgNodePicker` | 组织节点选择器（Popover） | `value`, `onChange` |
| `PageHeaderCard` | 页头统计卡片（标题 + 统计数字 + 操作按钮） | `title`, `stats`, `actions` |
| `BatchSelector` | 批次选择器（下拉选择 + 创建新批次） | `value`, `onChange` |
| `ResourcePreviewModal` | 文件预览弹窗（kkFileView iframe） | `resource`, `open`, `onOpenChange` |
| `ImportConfirmDialog` | 导入重复确认对话框 | `open`, `entityLabel`, `created/duplicates/failed`, `onConfirmOverwrite/onConfirmSkip` |
| `ResetPasswordDialog` | 重置密码对话框 | `open`, `userId`, `userName`, `onSuccess` |
| `PlatformShell` | 平台整体布局（侧边栏 + 顶栏 + 内容区） | 包裹页面内容 |

## Hooks

| Hook | 来源 | 用途 |
|------|------|------|
| `useImportFlow` | `@/hooks/use-import-flow` | 导入流程（下载模板、预览、执行导入、重复处理） |
| `useApprovals` | `@/hooks/use-approvals` | 审批记录（records、approve、reject、batchApprove、batchReject、getStepInfo） |
| `useSubmitterNames` | `@/hooks/use-submitter-names` | 提交人姓名批量缓存 |

## 评测专用组件

| 组件 | 位置 | 用途 |
|------|------|------|
| `EvaluationListTable` | `evaluation/evaluation-list-table.tsx` | 评测列表渲染器 |
| `EvaluationStatusActions` | `evaluation/evaluation-status-actions.tsx` | 评测资源状态操作按钮行 |
| `QuestionFormDialog` | `evaluation/question-form-dialog.tsx` | 题目创建/编辑表单 |
| `QuestionPreview` | `evaluation/question-preview.tsx` | 题目预览 |
| `BankFormDialog` | `evaluation/bank-form-dialog.tsx` | 题库创建/编辑表单 |
| `ExamFormDialog` | `evaluation/exam-form-dialog.tsx` | 试卷创建/编辑表单 |
| `ScoreConfigDialog` | `evaluation/score-config-dialog.tsx` | 评分配置 |
| `RandomQuestionDialog` | `evaluation/random-question-dialog.tsx` | 随机抽题 |
| `ManualQuestionDialog` | `evaluation/manual-question-dialog.tsx` | 手动选题 |

## 注意事项

1. **状态标签**：不要定义本地 `STATUS_CONFIG`，使用 `getStatusConfig()`（`packages/shared-types/src/status.ts`）+ `<StatusBadge>`
2. **表格操作**：使用 `<TableRowActions>` 和 `<HoverActionBar>`，不要手写 `group-hover:opacity-100`
3. **删除确认**：使用 `<ConfirmDialog>`，禁止 `window.confirm()`
4. **导入流程**：使用 `useImportFlow` hook，统一下载模板、预览、去重确认
5. **就近放置**：仅被一处使用的子组件放在消费者 `_components/` 下，不要放入 `shared/`
