# 前端公共组件速查

> **组件复用规范**（本文件）：
> 1. **复用优先**：接到需求先判断能否复用现有组件/函数/模式（见下方速查表与 `forms-tables.md` 架构盘点）；能复用直接使用，不重复造轮子
> 2. **抽象公共组件需确认**：若现有组件无法满足、但该模式可能在系统中反复出现，先向用户提出抽象方案，经确认后再实施
> 3. **同场景一并改造**：实施抽象时，将系统中类似场景统一切换到新公共组件，最大化复用价值
> 4. 新增页面时先查阅下方速查表，复用 `apps/edu/components/shared/` 与 `packages/ui`（`@zhiyu/ui`）中的公共组件

> **表格/表单架构盘点与开发规范见 [`docs/forms-tables.md`](forms-tables.md)**（系统模块划分、表格壳组件选型、表单字段封装规范、复用评估结论）。

> **页面级共享壳**与**业务组件**位于 `apps/edu/components/shared/`。
> **通用 UI/交互组件**位于 `packages/ui/src/components/shared/`（通过 `@zhiyu/ui` 使用）。仅部分在 `apps/edu/components/shared/` 保留 re-export 薄封装（`ComboboxSelect`/`ConfirmDialog`/`ErrorState`/`HoverActionBar`/`ImportWizardDialog`/`ImportConfirmDialog`/`SearchInput`/`StatusBadge`/`TableRowActions`）；其余 `EmptyState`/`TableEmptyRow`/`FormDialogFooter`/`UnderlineTabs`/`MixedTagEditor`/`LoadingView` 无本地 re-export，消费方直接 `from '@zhiyu/ui'`。
> **通用 Hooks**（`@zhiyu/ui`）：`useToast`/`useAsync`/`useDebouncedValue`/`useClickOutside`/`useImportFlow`。
> **评测配置组件**位于 `apps/edu/components/shared/eval-method-config-module.tsx`（`EvalMethodConfigModule`）与 `apps/edu/components/evaluation-rules/`（`evaluation-rules-editor.tsx`、`bank-question-selector-panel.tsx`），仅课程编辑器使用；任务编辑器经 `components/evaluation-rules/` 内的测评面板组件复用共享组件。
> **任务步骤卡片**位于 `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/`。
> **评测专用组件**位于 `apps/edu/components/evaluation/`。
> **通用 Hooks** 位于 `@/hooks/`（`apps/edu/hooks/`）和 `packages/ui/src/hooks/`。
> **错误处理工具**：`apps/edu/lib/error-handling.ts`（`reportError`），关键路径异步失败统一改用它记录。

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
| `StatusBadge` | `packages/ui` re-export | 状态标签（统一颜色体系） | `status` |
| `ConfirmDialog` | `packages/ui` re-export | 删除/危险操作二次确认 | `open`, `onOpenChange`, `title`, `description`, `variant`, `onConfirm` |
| `TableRowActions` | `packages/ui` re-export | 表格行悬浮操作按钮，替代手写 `group-hover` | 包裹 `<Button>` 子元素 |
| `HoverActionBar` | `packages/ui` re-export | 非 Table 场景的 hover 操作栏 | 包裹子元素 |
| `ComboboxSelect` | `packages/ui` re-export | 可搜索下拉选择（单选/多选），内置搜索/清空/全选（`showSelectAll`）/已选徽章（`showSelectedBadges`）；旧 `MultiSelect`/`MultiSelectSearch` 已删除，统一用它 | `options`, `value`, `onChange`, `multiple`, `loading`, `renderOption`, `showSelectAll`, `showSelectedBadges` |
| `SearchInput` | `packages/ui` re-export | 统一搜索框（放大镜图标 + 输入框，内置 `type="search"`/`autoComplete="off"` 防浏览器自动填充），替换各页面手写的 Search 图标 + Input 样板 | `value`, `onChange`, `placeholder`, `onSearch?`, `searchButton?`, `icon?`, `wrapperClassName?`, `iconClassName?`, `inputClassName?` |
| `PasswordInput` | `packages/ui` re-export | 统一密码输入框（右侧小眼睛按钮，明文/掩码切换，`onMouseDown` 阻止失焦），**全局所有密码输入框必须使用**（登录/注册/重置密码/AI Key 等，13 文件 25 处已替换）；其他 input props 全部透传 | `className?`（作用于内部 input）, `defaultVisible?`, 及 `Input` 全部 props |
| `EmptyState` / `TableEmptyRow` | `packages/ui` re-export | 列表/详情空态（居中图标+文案，可带 action）与表格空行，替换手写 `text-center py-8` 样板 | `icon?`, `title?`, `description?`, `action?`, `className?`, `compact?`；`TableEmptyRow`: `colSpan`, `children`, `className` |
| `FormDialogFooter` | `packages/ui` re-export | 弹窗表单底部「取消 + 保存/确定」统一组件，内置 loading spinner | `onCancel`, `confirmText?`, `confirmDisabled?`, `loading?`, `variant?`, `extra?` |
| `UnderlineTabs` | `packages/ui` re-export | 下划线式 Tab 栏（border-b-2 激活态，可配 accent 色），与 shadcn Tabs 并存 | `items`, `activeKey`, `onSelect`, `accentClassName?`, `badge` |
| `Button`（`loading` prop） | `packages/ui` | Button 内置 `loading` prop（自动禁用 + spinner），不要再手写「Loader2 + 加载中」 | `loading?: boolean` |
| `MixedTagEditor` | `packages/ui` re-export | contentEditable 输入框，纯文本与知识点/能力点标签混排（评价维度名/量规指标） | `text`, `knowledgePointIds`, `abilityPointIds`, `onChange`, `compact` |
| `ImportWizardDialog` | `packages/ui` re-export | Excel 导入两步向导（下载模板→上传→导入），支持受控模式与 `useImportFlow` 组合 | `title`, `guideItems`, `onDownload`, `onImport`, `files?` 等 |
| `ImportConfirmDialog` | `packages/ui` re-export | 导入重复确认对话框 | `open`, `entityLabel`, `created/duplicates/failed`, `onConfirmOverwrite/onConfirmSkip` |
| `ResourcePreviewModal` | `resource-preview-modal.tsx` | 文件预览弹窗 | `resource`, `open`, `onOpenChange` |
| `ResetPasswordDialog` | `reset-password-dialog.tsx` | 重置密码对话框 | `open`, `userId`, `userName`, `onSuccess` |
| `CoverImageUpload` | `cover-image-upload.tsx` | 封面上传（预览/替换/删除） | `imageUrl`, `uploading`, `label`, `alt`, `onUpload`, `onRemove` |
| `GranularLessonSelectDialog` | `app/library/knowledge/_components/granular-lesson-select-dialog.tsx` | 课时多选对话框（搜索+勾选+批量确认） | `open`, `onOpenChange`, `granularCourses`, `selectedIds`, `onChange` |
| `KnowledgePointFormDialog` | `app/library/knowledge/_components/knowledge-point-form-dialog.tsx` | 知识点创建/编辑/克隆表单 | `open`, `onOpenChange`, `onSubmit`, `initialValues`, `title` |
| `LogTableShell<T>` | `log-table-shell.tsx` | 日志表格壳子（表格+分页+加载态） | `items`, `columns`, `total`, `page`, `totalPages` |
| `ScheduleGrid` | `schedule-grid.tsx` | 周课表网格（7 列星期 × 节次行），排课页与学生/教师工作台共用 | `entries`, `periodSlots?`, `week?`, `onEntryClick?`, `getEntryHref?` |
| `FormFieldRow` / `FormFieldGrid` | `form-field-row.tsx` | 表单字段行/网格布局（label + 必填星号 + 说明 + 控件），48 个文件复用的最高频表单组件 | `label`, `required`, `hint`, `children` |
| `ImageListUpload` | `image-list-upload.tsx` | 图片列表上传（多图、预览、删除、排序） | `files`, `onChange`, `uploading` |
| `StatusActionBar` | `status-action-bar.tsx` | 详情页状态操作栏（当前状态标签 + 可用操作按钮组） | `status`, `actions` |
| `PaginationBar` | `pagination-bar.tsx` | 表格分页条（总数 + 上一页/下一页 + 页码），供 `PortalCrudPage`/`LogTableShell` 等壳组件使用 | `page`, `totalPages`, `total`, `onPageChange` |
| `ErrorState` | `packages/ui` re-export | 列表/详情加载失败重试态 | `message`, `onRetry` |
| `LoadingView` | `packages/ui`（无 re-export，直接 `@zhiyu/ui`） | 居中加载占位（spinner + 文案），16 个文件使用 | `label` |
| `DateInput` | `shared/date-input.tsx` | 统一日期输入（13 个文件复用），替代手写日期控件 | `value`, `onChange`, `placeholder?` |
| `TagBadge` | `shared/tag-badge.tsx` | 标签徽章 | `tag` |
| `LearnPage` | `learn-page.tsx` | 三类资源学习落地页（岗位/课程/场景 landing 共用：内容浏览 + 进度 + 导航） | `resourceType`, `params`, `entries`, `onProgress` 等（以组件签名为准） |
| `ImageEditorDialog` | `image-editor-dialog.tsx` | 图片编辑弹窗（封面/图片列表上传共用） | `open`, `onOpenChange`, `imageUrl`, `onSave`（以组件签名为准） |
| `TagFilterBar` | `shared/tag-filter-bar.tsx` | 标签筛选栏（library 标签体系） | `tags`, `selected`, `onSelect` |
| `TagPicker` | `shared/tag-picker.tsx` | 标签选择器（单选/多选） | `value`, `onChange` |
| `CitationStatsPanel` | `shared/citation-stats-panel.tsx` | 引用统计面板（能力点/证书库被引用情况，5 个文件复用） | 目标实体参数 |
| `FavoriteButton` | `shared/favorite-button.tsx` | 收藏按钮（岗位/场景收藏，5 个文件复用） | `targetType`, `targetId` |
| `AiNotConfiguredDialog` | `ai-not-configured-dialog.tsx` | AI 未配置（412 `ai_not_configured`）引导弹窗（引导到 `/portal/apps/system/tenant` 配置页，配合 `useAiNotConfigured`），7 个文件复用 | `open`, `onOpenChange` |
| `EvalMethodCard` | `eval-method-card.tsx` | 测评方式卡片（学生端学习页展示各测评方式状态与入口），4 个文件复用 | `method`, `result`, `examHref`, `onAction` |
| `MobileTabDropdown` | `mobile-tab-dropdown.tsx` | 移动端（<md）Tab 折叠下拉选择器（替代窄屏横向滚动/折行的 tab 栏），4 个文件复用 | `items`, `value`, `onValueChange` |
| `CaptchaInput` | `captcha-input.tsx` | 登录验证码输入（加载/刷新/通过回调），3 个文件复用 | `onPass`, `onError`, `className` |
| `FileViewerPreview` | `file-viewer-preview.tsx` | file-viewer 浏览器原生预览渲染（覆盖 208 扩展名，`ResourcePreviewModal` 内使用；不支持格式回退 kkfileview），1 个文件复用 | `url`, `name` |

## 选择器组件

> 位于 `apps/edu/components/shared/`。

| 组件 | 文件 | 用途 | 关键 Props |
|------|------|------|-----------|
| `MajorSelect` | `major-select.tsx` | 专业下拉选择器，自动加载列表 | `tenantId?`, `value?`, `onChange`, `placeholder?`, `disabled?` |
| `BatchSelector` | `batch-selector.tsx` | 批次选择器（下拉选择 + 创建新批次） | `value`, `onChange` |
| `UserSelector` | `user-selector.tsx` | 选择用户（多选/单选、组织树筛选、排除学生） | `value`, `onChange`, `multiple`, `excludeStudent`, `tenantId` |
| `OrgNodePicker` | `org-node-picker.tsx` | 组织节点选择器（Popover） | `value`, `onChange` |
| `MultiOrgNodePicker` | `multi-org-node-picker.tsx` | 多组织节点选择器（多选树） | `value`, `onChange` |
| `BrandRelationSelect` | `brand-relation-select.tsx` | 品牌关联选择（企业/专家/成果等多类型关联） | `value`, `onChange` |
| `KnowledgeSelector` | `knowledge-selector.tsx` | 知识点选择器 | `value`, `onChange` |
| `EvalMethodSelector` | `eval-method-selector.tsx` | 测评方式选择器 | `value`, `onChange` |
| `ResourceSelector` | `resource-selector.tsx` | 资源选择器（7 个文件复用） | `value`, `onChange`, `multiple` |
| `CoBuildCollaboratorPicker` | `co-build-collaborator-picker.tsx` | 共建人选择器（企业端共建岗位/场景，按合作学校拉取候选），2 个文件复用 | `schoolTenantId`, `value`, `onChange`, `placeholder?`, `disabled?` |

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
| `PublicListShell` | `alliance/public-list-shell.tsx` | 联盟前台「查看全部」页外壳（顶部色块+Tabs 筛选+搜索+页脚，参照 exam-center） | `title`, `subtitle`, `icon`, `tabs{value,label,count}[]`, `activeTab`, `onTabChange`, `keyword`, `onKeywordChange`, `placeholder`, `loading`, `gridClassName`, `children` |
| `PublicCard` 系列 | `alliance/public-cards.tsx` | 联盟前台卡片：`EnterpriseCard` / `ProjectCard` / `AchievementCard` / `ExpertCard` / `BrandCard`（landing 与查看全部页共用） | 各对象类型，如 `enterprise: AllianceEnterprise` |
| `DetailPageHeader` | `shared/detail-page-header.tsx` | 详情页头部（返回按钮 + 标题/副标题 + 状态标签 + 编辑/操作区），`AllianceDetailShell` 内部已复用；非联盟域详情页新写页头一律用它 | `title`, `subtitle?`, `backHref?`, `backLabel?`, `statusBadge?`, `actions?`, `editHref?` |
| `FormPageShell` | `shared/form-page-shell.tsx` | 表单页骨架（返回 + 标题 + 主表单 2 列 + 右侧栏 1 列 + 底部操作区），alliance/partner 表单页已统一 | `title`, `description?`, `backHref?`, `children`, `sidebar?`, `footer?` |
| `PermissionGuard` | `shared/permission-guard.tsx` | 权限守卫（按权限码控制子元素渲染，4 个文件复用） | `permission`, `children` |
| `AllianceDetailShell` | `shared/alliance-detail-shell.tsx` | 联盟详情页壳（页头 + 状态徽章 + 操作区 + Tabs 内容区，泛型 `<T extends string>`），16 个文件复用 | `title`, `subtitle?`, `statusBadge?`, `backHref?`, `editHref?`, `actions?`, `tabs`, `defaultTab?`, `loading?`, `notFound?` |
| `LandingShell` | `shared/landing-shell.tsx` | Landing 页外壳（hero + 数据统计 + 筛选行 + 排序/搜索 + 内容区），5 个文件复用 | `hero`, `stats`, `filterRows`, `sortOptions`, `keyword`, `onSearch`, `children` |

## Hooks

### 数据获取 Hooks（`@/hooks/`）

| Hook | 用途 |
|------|------|
| `useImportFlow` | 导入流程（下载模板、预览、执行导入、重复处理），来自 `@zhiyu/ui` re-export |
| `useApprovals` | 审批记录（records、approve、reject、batchApprove、batchReject、getStepInfo） |
| `useSubmitterNames` | 提交人姓名批量缓存 |
| `useOrgTree` | 组织树数据（orgs、orgTree、orgMap、orgTypeMap、typeNameMap、loading、refetch） |
| `usePortalUsers` | Portal 用户列表（users、roles、roleMap、total、loading、refetch），支持 `roleCode` 筛选 |
| `streamAICenter`（`@/lib/api`，非 hook） | SSE 流式调用统一封装（chat/ask 共用：onMeta/onSources/onDelta/onDone/onError 回调 + AbortSignal 取消；开始前错误抛 ApiErrorWithCode，412 走 useAiNotConfigured） |
| `useSubscriptionModules` | 租户订阅模块开关，返回 `Record<string, boolean>` |
| `useLibraryCrud` | library 列表页统一数据加载（search+limit+loading+失败 toast+首载），见 `app/library/_components/use-library-crud.ts`；需要随页面 state 联动筛选时 `autoLoad: false` + 自行 `useEffect` 触发 `loadItems` |
| `usePagedList` | 分页列表统一数据加载（9 个文件复用：partner/co-build、portal/alliance 列表页） |
| `useSecondaryColleges` | 二级学院列表加载（8 个文件复用，alliance 表单域） |
| `useTagBindings` | 标签绑定读取（`shared/use-tag-bindings.ts`，library 标签体系） |
| `useTags` | 标签列表读取（`shared/use-tags.ts`，library 标签体系） |

### 通用 UI Hooks（`@zhiyu/ui`）

| Hook | 用途 |
|------|------|
| `useToast` | Toast 通知（`toast`, `dismiss`, `toasts`），配合 `<Toaster>` 使用 |
| `useAsync` | 异步请求统一状态（loading/error/data + 竞态序号 + 失败 toast）；**新页面数据加载一律用它**（或 `useLibraryCrud` 类业务 hook），存量手写样板不再刻意追平 |
| `useDebouncedValue` | 输入防抖（默认 300ms），替代手写 `setTimeout + clearTimeout` 样板 |
| `useClickOutside` | 点击容器外部关闭（mousedown + contains），替代手写事件监听样板 |

## DataProvider（评测数据上下文）

> 位于 `apps/edu/components/providers/data-provider.tsx`：用 `createContext()` + `useContext()` 提供题库、题目、试卷、审批等评测数据上下文。

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

## 评测配置组件（课程编辑器使用）

> 组件位于 `apps/edu/components/shared/eval-method-config-module.tsx`（`EvalMethodConfigModule`），
> 当前仅被课程编辑器（`lesson/admin/system/add`）使用；任务编辑器经 `components/evaluation-rules/` 复用 `MixedTagEditor`、`BankQuestionSelectorPanel` 等共享组件。
> 架构分两层：

### 第一层：`EvalMethodConfigModule` — 测评方式选择 + 4 步规则配置

| Props | 说明 |
|------|------|
| `value` | `CourseEvalData`（methods + methodConfigs） |
| `onChange` | 回调 |

**包含功能：**
- 测评方式选择网格（平台通用/行业专属 Tab 分类）
- 已选方法的多步配置卡片（测评对象/评价主体/测评资源/评价标准等）
- 各项配置委托 `CourseEvaluationRulesDialog` 完成
- 评价量规/评分规则双模式 + 等级映射（A/B/C/D）

### 第二层：测评方式面板（每种一个独立组件）

> 位于 `apps/edu/components/evaluation-rules/`

| 组件 | 文件 | 对应测评方式 |
|------|------|-----------|
| `BankQuestionSelectorPanel` | `bank-question-selector-panel.tsx` | 题库、随堂测 |
| `ResourceMaterialConfig` | 现场评审、成果评价、作业（配置逻辑已并入 `atomic-modules`，2026-08 删除原文件） |

**新增测评方式只需：** 创建新面板组件 + 在 `EvalMethodConfigModule` 的 `EVALUATION_METHOD_OPTIONS` 数组中加一行。

## 任务步骤卡片（任务编辑器专用）

> 位于 `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/`

| 组件 | 文件 | 功能 |
|------|------|------|
| `TaskInfoCard` | `task-info-card.tsx` | 任务名称/类型/学时/难度/背景 |
| `TaskDescriptionCard` | `task-description-card.tsx` | 富文本说明 + PDF 上传 |
| `TaskWeightCard` | `task-weight-card.tsx` | 任务间权重分配 |

## 评测专用组件

> 位于 `apps/edu/components/evaluation/`。

| 组件 | 文件 | 用途 |
|------|------|------|
| `EvaluationListTable` | `evaluation-list-table.tsx` | 评测列表渲染器 |
| `QuestionFormDialog` | `question-form-dialog.tsx` | 题目创建/编辑表单 |
| `QuestionPreview` | `question-preview.tsx` | 题目预览 |
| `BankFormDialog` | `bank-form-dialog.tsx` | 题库创建/编辑表单 |
| `ExamFormDialog` | `exam-form-dialog.tsx` | 试卷创建/编辑表单 |
| `ScoreConfigDialog` | `score-config-dialog.tsx` | 评分配置 |
| `RandomQuestionDialog` | `random-question-dialog.tsx` | 随机抽题 |
| `ManualQuestionDialog` | `manual-question-dialog.tsx` | 手动选题 |

## 移动端适配约定

> 共享组件已内置移动端兜底（Dialog 高度限制/内部滚动、Tabs 超宽横向滚动、Pagination 换行、Table 自带横向滚动），新页面按以下约定开发即可自然适配移动端。

1. **布局网格**：多列网格一律以 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` 起步（禁止写死 `grid-cols-4`），列数按内容重要度递减
2. **Bento/显式摆放**：`gridColumn/gridRow` 显式摆放只允许在 `lg+` 生效（参考 `/portal` 首页 `lg:col-start-*` 模式），移动端走流式排列
3. **数据表格**：一律使用 `<Table>`（自带 `overflow-x-auto` 横向滚动），禁止手写 table 或固定宽度列
4. **宽网格（课表类）**：`grid-cols-7/8/12` 等宽网格需外层容器 `overflow-x-auto` + 网格本身 `min-w-[760px]`，保证移动端横向滚动而非挤压（参考 `schedule-grid.tsx`）
5. **弹窗**：内容多的弹窗直接用 `<Dialog>` 默认尺寸（自带 `max-h-[calc(100dvh-2rem)]` 内部滚动）；全屏编辑器类用 `size="full"`
6. **Tabs**：Tab 过多时直接使用 `<TabsList>`（自带超宽横向滚动）
7. **分页**：`<Pagination>` 自带换行，无需额外处理
8. **断点**：样式一律用 Tailwind `max-md:` / `md:` 变体，不依赖 JS 断点判断
9. **触控目标**：移动端按钮/点击区域保持 ≥ 32px

## 注意事项

1. **状态标签**：不要定义本地 `STATUS_CONFIG`，使用 `getStatusConfig()`（`packages/shared-types/src/status.ts`）+ `<StatusBadge>`
2. **表格操作**：使用 `<TableRowActions>` 和 `<HoverActionBar>`，不要手写 `group-hover:opacity-100`
3. **删除确认**：使用 `<ConfirmDialog>`，禁止 `window.confirm()`
4. **导入流程**：使用 `useImportFlow` hook + `ImportWizardDialog`/`ImportConfirmDialog`，统一下载模板、预览、去重确认
5. **就近放置**：仅被一处使用的子组件放在消费者 `_components/` 下，不要放入 `shared/`
6. **新增测评方式**：在 `EVALUATION_METHOD_OPTIONS` 数组加一行 + 创建对应的面板组件即可
7. **错误处理**：关键路径异步失败用 `reportError(err, source)`（`lib/error-handling.ts`）记录，不再静默吞掉
8. **可搜索下拉**：一律 `ComboboxSelect`（内置 Command 搜索/多选/清空/全选/已选徽章）；旧 `MultiSelect`/`MultiSelectSearch` 已删除，不要手写 inline 搜索 + Select/Popover，也不要新造多选组件
9. **页面搜索框**：一律使用 `SearchInput`（`apps/edu/components/shared/search-input`），禁止手写「Search 图标 + Input」样板；特殊图标形态用 `iconClassName`/`icon` 覆盖
10. **空态与加载态**：空态一律 `<EmptyState>`/`<TableEmptyRow>`（`@zhiyu/ui`），加载态用 `<LoadingView>`，禁止手写 `text-center py-8` 样板；「加载中」占位不要误用空态组件
11. **弹窗底部按钮**：表单弹窗底部一律 `<FormDialogFooter>`，禁止手写「取消 + 保存」DialogFooter 样板；按钮 loading 用 Button 的 `loading` prop
12. **数据加载规范**：新页面一律 `useAsync`（或业务 hook），禁止手写 `const [loading, setLoading] = useState` + try/catch/finally 首载样板；存量 84 处手写样板按模块顺手迁移，不安排一次性重构
13. **域类型单一来源**：域类型以 `apps/edu/lib/types/*.ts` 为主源（与后端对齐）；`job-source.ts`/`lesson-source.ts` 为历史遗留双份定义，新代码禁止引用，引用处按模块逐个收敛后删除（专项治理，见 `docs/forms-tables.md` 复用评估结论）
14. **useToast 模块级单例**：`packages/ui/src/hooks/use-toast.ts` 采用 shadcn 标准模块级单例模式（`memoryState`/`listeners`/`count`），为刻意保留；若日后需要多实例独立 toast 状态再评估改 React Context
