# 前端公共组件速查

> **页面级共享壳**与**业务组件**位于 `apps/edu/components/shared/`，长期视情况下沉到 `packages/ui` 或独立包。
> **通用基础 UI 组件**（4 个）位于 `packages/ui/src/components/shared/`（通过 `@zhiyu/ui` 使用）。
> **评测配置组件**位于 `apps/edu/app/lesson/admin/_components/eval/`，同时被课程和任务编辑器复用。
> **任务步骤卡片**位于 `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/`。
> **评测专用组件**位于 `apps/edu/components/evaluation/`。
> **通用 Hooks** 位于 `@/hooks/`（`apps/edu/hooks/`）和 `packages/ui/src/hooks/`。

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

> 位于 `apps/edu/components/shared/`。

| 组件 | 文件 | 适用场景 | 关键 Props |
|------|------|---------|-----------|
| `StatusBadge` | `status-badge.tsx` | 状态标签（统一颜色体系） | `status` |
| `ConfirmDialog` | `confirm-dialog.tsx` | 删除/危险操作二次确认 | `open`, `onOpenChange`, `title`, `description`, `variant`, `onConfirm` |
| `TableRowActions` | `table-row-actions.tsx` | 表格行悬浮操作按钮，替代手写 `group-hover` | 包裹 `<Button>` 子元素 |
| `HoverActionBar` | `hover-action-bar.tsx` | 非 Table 场景的 hover 操作栏 | 包裹子元素 |
| `ResourcePreviewModal` | `resource-preview-modal.tsx` | 文件预览弹窗 | `resource`, `open`, `onOpenChange` |
| `ImportConfirmDialog` | `import-confirm-dialog.tsx` | 导入重复确认对话框 | `open`, `entityLabel`, `created/duplicates/failed`, `onConfirmOverwrite/onConfirmSkip` |
| `ResetPasswordDialog` | `reset-password-dialog.tsx` | 重置密码对话框 | `open`, `userId`, `userName`, `onSuccess` |
| `CoverImageUpload` | `cover-image-upload.tsx` | 封面上传（预览/替换/删除） | `imageUrl`, `uploading`, `label`, `alt`, `onUpload`, `onRemove` |
| `GranularLessonSelectDialog` | `granular-lesson-select-dialog.tsx` | 课时多选对话框（搜索+勾选+批量确认） | `open`, `onOpenChange`, `granularCourses`, `selectedIds`, `onChange` |
| `KnowledgePointFormDialog` | `knowledge-point-form-dialog.tsx` | 知识点创建/编辑/克隆表单 | `open`, `onOpenChange`, `onSubmit`, `initialValues`, `title` |
| `LogTableShell<T>` | `log-table-shell.tsx` | 日志表格壳子（表格+分页+加载态） | `items`, `columns`, `total`, `page`, `totalPages` |

## 选择器组件

> 位于 `apps/edu/components/shared/`。

| 组件 | 文件 | 用途 | 关键 Props |
|------|------|------|-----------|
| `MajorSelect` | `major-select.tsx` | 专业下拉选择器，自动加载列表 | `tenantId?`, `value?`, `onChange`, `placeholder?`, `disabled?` |
| `BatchSelector` | `batch-selector.tsx` | 批次选择器（下拉选择 + 创建新批次） | `value`, `onChange` |
| `UserSelector` | `user-selector.tsx` | 选择用户（多选/单选、组织树筛选、排除学生） | `value`, `onChange`, `multiple`, `excludeStudent`, `tenantId` |
| `OrgNodePicker` | `org-node-picker.tsx` | 组织节点选择器（Popover） | `value`, `onChange` |

## 布局组件

> 位于 `apps/edu/components/shared/` 及 `apps/edu/components/platform-shell/`。

| 组件 | 位置 | 用途 | 关键 Props |
|------|------|------|-----------|
| `PlatformShell` | `platform-shell/PlatformShell.tsx` | 平台整体布局（侧边栏 + 顶栏 + 内容区） | 包裹页面内容，`config: PlatformNavigationConfig` |
| `PlatformLayout` | `shared/platform-layout.tsx` | 认证守卫版 PlatformShell（未登录跳转登录页，无权限展示拒绝页） | `navigationConfig`, `landingPath`, `children` |
| `EditorShell` | `shared/editor-shell.tsx` | 内容编辑器框架（全屏/内嵌、步骤导航、保存/提交） | `mode`, `step`, `onSaveDraft`, `onSubmit` 等回调 |
| `PageHeaderCard` | `shared/page-header-card.tsx` | 页头统计卡片（标题 + 统计数字 + 操作按钮） | `title`, `stats`, `actions` |
| `LandingFilterRow` | `shared/landing-filter-row.tsx` | Landing 页筛选行（标签云+展开收起） | `label`, `items`, `selected`, `onSelect`, `accentColor` |
| `LandingPagination` | `shared/landing-pagination.tsx` | Landing 页分页器（省略号+图标按钮） | `currentPage`, `totalPages`, `onPageChange`, `accentColor` |

## Hooks

### 数据获取 Hooks（`@/hooks/`）

| Hook | 用途 |
|------|------|
| `useImportFlow` | 导入流程（下载模板、预览、执行导入、重复处理），来自 `@zhiyu/ui` re-export |
| `useApprovals` | 审批记录（records、approve、reject、batchApprove、batchReject、getStepInfo） |
| `useSubmitterNames` | 提交人姓名批量缓存 |
| `useOrgTree` | 组织树数据（orgs、orgTree、orgMap、orgTypeMap、typeNameMap、loading、refetch） |
| `usePortalUsers` | Portal 用户列表（users、roles、roleMap、total、loading、refetch），支持 `roleCode` 筛选 |
| `useSubscriptionModules` | 租户订阅模块开关，返回 `Record<string, boolean>` |

### 通用 UI Hooks（`@zhiyu/ui`）

| Hook | 用途 |
|------|------|
| `useToast` | Toast 通知（`toast`, `dismiss`, `toasts`），配合 `<Toaster>` 使用 |
| `useIsMobile` | 响应式断点，viewport < 768px 时返回 `true` |
| `usePlatformLinks` | 平台链接配置（`data`, `loading`, `getUrl`, `isEnabled`, `refresh`） |
| `useAppModules` | 应用模块配置（`data`, `loading`, `getModules`, `refresh`） |

## DataProvider（评测数据上下文）

> 工厂模式：`createDataContext()` → Context，`createUseData(ctx)` → Hook，`@zhiyu/ui` 导出。

| 数据域 | 方法 |
|--------|------|
| 题库 | `listQuestionBanks`, `getQuestionBank`, `createQuestionBank`, `updateQuestionBank`, `deleteQuestionBank` |
| 题目 | `listQuestions`, `getQuestion`, `createQuestion`, `updateQuestion`, `deleteQuestion` |
| 试卷 | `listExams`, `getExam`, `createExam`, `updateExam`, `deleteExam` |
| 场景任务 | `listSceneTasks`, `getSceneTask` |
| 评测结果 | `listEvaluationResults`, `createEvaluationResult`, `updateEvaluationResult`, `deleteEvaluationResult` |
| 岗位能力 | `listJobAbilities`, `createJobAbilityResult`, `getJobAbilityResult`, `deleteJobAbilityResult` |
| 审批 | `mapApprovalRecord()` + `APPROVAL_TYPE_MAP` 类型映射 |
| 毕业设计 | `listGraduationProjects`, `createGraduationProject`, `updateGraduationProject`, `deleteGraduationProject` |
| 学生档案 | `listStudentArchives`, `getStudentArchive`, `createStudentArchive`, `updateStudentArchive`, `deleteStudentArchive` |
| 学生画像 | `getStudentPortrait`, `updateStudentPortrait` |
| 证书发放 | `listCertRecords`, `createCertRecord`, `updateCertRecord`, `updateCertStatus`, `deleteCertRecord` |
| 学分转换 | `listCreditRules`, `createCreditRule`, `updateCreditRule`, `deleteCreditRule` |

## 评测配置组件（课程/任务复用）

> 组件位于 `apps/edu/app/lesson/admin/_components/eval/course-eval-config.tsx`，同时被课程编辑器和任务编辑器使用。架构分两层：

### 第一层：`CourseEvalConfig` — 测评方式选择 + 4 步规则配置

| Props | 说明 |
|------|------|
| `value` | `CourseEvalData`（methods + methodConfigs） |
| `onChange` | 回调 |

**包含功能：**
- 测评方式选择网格（平台通用/行业专属 Tab 分类）
- 已选方法的 4 步卡片（①测评对象 → ②评价主体 → ③测评资源 → ④评价标准）
- 4 个独立 Dialog 配置各项
- 评价量规/评分规则双模式 + 等级映射（A/B/C/D）

### 第二层：测评方式面板（每种一个独立组件）

> 位于 `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/`

| 组件 | 文件 | 对应测评方式 |
|------|------|-----------|
| `BankQuestionSelectorPanel` | `bank-question-selector-panel.tsx` | 题库、随堂测 |
| `PaperConfigPanel` | `paper-config-panel.tsx` | 试卷 |
| `RandomDrawResourcePanel` | `random-draw-resource-panel.tsx` | 现场问答 |
| `ResourceMaterialConfig` | `resource-material-config.tsx` | 现场评审、成果评价、作业 |
| `MethodConfigDialog` | `method-config-dialog.tsx` | 所有方式的评价标准配置 |

**新增测评方式只需：** 创建新面板组件 + 在 `CourseEvalConfig` 的 `EVALUATION_METHOD_OPTIONS` 数组中加一行。

## 任务步骤卡片（任务编辑器专用）

> 位于 `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/`

| 组件 | 文件 | 功能 |
|------|------|------|
| `TaskInfoCard` | `task-info-card.tsx` | 任务名称/类型/学时/难度/背景 |
| `TaskDescriptionCard` | `task-description-card.tsx` | 富文本说明 + PDF 上传 |
| `TaskKnowledgeCard` | `task-knowledge-card.tsx` | 知识点搜索/选择/克隆 |
| `TaskWeightCard` | `task-weight-card.tsx` | 任务间权重分配 |

## 评测专用组件

> 位于 `apps/edu/components/evaluation/`。

| 组件 | 文件 | 用途 |
|------|------|------|
| `EvaluationListTable` | `evaluation-list-table.tsx` | 评测列表渲染器 |
| `EvaluationStatusActions` | `evaluation-status-actions.tsx` | 评测资源状态操作按钮行 |
| `QuestionFormDialog` | `question-form-dialog.tsx` | 题目创建/编辑表单 |
| `QuestionPreview` | `question-preview.tsx` | 题目预览 |
| `BankFormDialog` | `bank-form-dialog.tsx` | 题库创建/编辑表单 |
| `ExamFormDialog` | `exam-form-dialog.tsx` | 试卷创建/编辑表单 |
| `ScoreConfigDialog` | `score-config-dialog.tsx` | 评分配置 |
| `RandomQuestionDialog` | `random-question-dialog.tsx` | 随机抽题 |
| `ManualQuestionDialog` | `manual-question-dialog.tsx` | 手动选题 |

## 注意事项

1. **状态标签**：不要定义本地 `STATUS_CONFIG`，使用 `getStatusConfig()`（`packages/shared-types/src/status.ts`）+ `<StatusBadge>`
2. **表格操作**：使用 `<TableRowActions>` 和 `<HoverActionBar>`，不要手写 `group-hover:opacity-100`
3. **删除确认**：使用 `<ConfirmDialog>`，禁止 `window.confirm()`
4. **导入流程**：使用 `useImportFlow` hook，统一下载模板、预览、去重确认
5. **就近放置**：仅被一处使用的子组件放在消费者 `_components/` 下，不要放入 `shared/`
6. **新增测评方式**：在 `EVALUATION_METHOD_OPTIONS` 数组加一行 + 创建对应的面板组件即可
