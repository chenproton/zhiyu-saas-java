# `apps/edu/components/` 组件说明

本目录按职责分层存放 edu 前端可复用组件。

## 目录结构

```
components/
├── auth-provider.tsx           # 全局认证/租户/权限上下文
├── chunk-error-handler.tsx     # Chunk 加载失败自动刷新与错误边界
├── global-api-error-handler.tsx# 全局 API 错误 toast 处理
├── theme-provider.tsx          # next-themes 主题 Provider 封装
├── evaluation/                 # 评测业务组件（题库/试卷/题目/分值配置）
├── evaluation-rules/           # 评测规则统一编辑器
├── job/                        # 岗位与学生端业务组件
├── knowledge-graph/            # 知识图谱可视化组件套件
├── platform-shell/             # 管理后台侧边导航布局壳
├── portal/                     # Portal 侧通用 UI（顶部导航、footer、AI 助手）
├── providers/                  # 数据层 Provider（DataProvider 等）
├── scene/                      # 场景业务组件
└── shared/                     # 跨模块复用的通用组件与页面模板
```

## 抽象原则

1. **跨模块复用**才放入 `shared/`；仅一个业务模块使用但逻辑较重的组件，允许放在 `components/<domain>/` 下。
2. **页面级模板**（`ContentListPage`、`PortalCrudPage`、`BatchGroupPage` 等）统一收敛到 `shared/`，避免各业务页重复实现搜索、批量、导入导出、审批、归档等逻辑。
3. **thin wrapper**（`StatusBadge`、`ConfirmDialog`、`TableRowActions` 等）保留在 `shared/`，便于后续统一替换 UI 库或扩展行为。

## 重要维护约定

### `evaluation-rules/EvaluationRulesEditor` 不拆分

`apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx` 当前约 5000 行，内部包含：

- 评审流程设置（review steps）
- 评价方式顺序/权重配置
- 评价对象、评价主体、评价标准配置
- 量规（rubric）与评分规则编辑器
- 题库、试卷、随机抽题、现场问答资源绑定
- 现场问答（random draw question）API 交互

虽然文件行数较大，但它是一个**高度内聚的领域编辑器**：所有子领域都围绕同一份 `EvalRuleConfig` 状态工作，拆分会引入大量 props drilling 和跨组件状态同步，反而降低可维护性。因此：

> **除非出现性能问题或需要被第三个独立场景复用，否则不主动拆分 `EvaluationRulesEditor`。**
> 后续可通过提取局部纯展示子函数、减少局部 state 重复、整理 types/constants 来改善可读性，但保持其作为单一领域编辑器的完整性。

## 复用情况速查

### `shared/` 中仅 1 处外部使用的组件

以下组件目前只在一个业务文件中被使用，抽象价值有限，后续重构时可评估是否收回业务页或合并到更近的业务目录：

- `RandomQuestionDialog` → `app/evaluation/exams/[id]/page.tsx`
- `ManualQuestionDialog` → `app/evaluation/exams/[id]/page.tsx`
- `Footer` → `app/portal/page.tsx`
- `YiKnowAssistant` → `app/portal/layout.tsx`

#### 复用评估补充

- **`ComboboxSelect`** 已从单用扩展为通用可搜索下拉（支持单选/多选/disabled/renderOption），当前被 4 个文件使用，原先 3 处独立的 `Command + Popover` 实现均已迁移到该组件，不再需要评估收回。

- **`RandomQuestionDialog` / `ManualQuestionDialog`**：属于试卷组卷领域的复杂弹窗，逻辑较重，即使只有 1 处使用也建议保留为独立组件，避免 `app/evaluation/exams/[id]/page.tsx` 过度膨胀。

- **`Footer` / `YiKnowAssistant`**：Portal 域专用组件，虽然仅 1 处使用，但职责清晰，放在 `components/portal/` 下是合理的域内抽象。

### `shared/` 中复用率高的核心组件

- `ContentListPage` / `PortalCrudPage` / `BatchGroupPage` / `ArchiveListPage` / `ApprovalListPage` / `WorkflowConfigPage` / `EditorShell`：跨 3+ 业务模块复用。
- `KnowledgeSelector` / `ResourceSelector` / `UserSelector` / `OrgNodePicker` / `BatchSelector` / `MajorSelect`：跨课程、场景、岗位、Portal 等多个模块复用。

## 新增组件请先确认

在新增 `shared/` 组件前，请先确认：

1. 至少 2 个业务页面需要它，或它是一个**页面级模板**；
2. 它不会引入对某个业务 domain 的强依赖；
3. 如果它只会在 1 个地方使用，优先放在对应业务目录下。
