# 前端 components 复查报告（2026-08-08 / comp-01）

> 复查范围：2026-08-07 已全量审查的 components 层 41 个文件（逐行通读）。
> 审查原则：简单优先；样式问题不做视觉验证；容忍边缘交互瑕疵。
> 等级：P0 必崩 / P1 逻辑 bug、数据丢失、状态管理错误、错误被吞 / P2 useEffect 依赖、内存泄漏、竞态、性能、i18n 残留、契约不符 / P3 死代码、风格。

## 已修项回归结论

- `shared-defs.ts` 收敛为「纯类型 + 从 @zhiyu/shared-types 转发常量」后，三个消费点（typeColorMap / questionTypeLabels / difficultyLabels）均已适配，`QUESTION_TYPE_BADGE_CLASSES`、`QUESTION_TYPE_LABELS_SHORT`、`DIFFICULTY_LABELS` 在 shared-types 中确认存在 → 无回归。
- `bank-question-selector-panel` 模块级缓存已收敛为组件内 state（questionCache），卸载即销毁；题库切换竞态用 `loadSeqRef` 序号丢弃过期响应 → 无回归。
- `exam-form-dialog` duration 修复（`exam?.duration ?? 60`）正确保留非 60 分钟试卷 → 无回归。
- `evaluation-rules-editor` papers / rdq 数据缓存已从模块级改为组件挂载时拉取（注释明确）→ 无回归。
- 各 dialog 表单重置使用 `queueMicrotask`、批量加载使用 cancelled 守卫 → 无回归。

---

## apps/edu/components/evaluation/question-form-dialog.tsx

- [P1][数据] question-form-dialog.tsx:92,151,160,219 — 弹窗中没有任何分值输入控件：`score` state 只在重置 effect 中被 `setScore(question.score ?? 0)` / `setScore(0)` 赋值，`buildFormData` 原样提交 `score`，而后端 `QuestionStore.Create`（store/questions.go:112）无默认值、原样落库 → **新建题目分值恒为 0**，题库侧无其他入口可改；最佳实践：在右侧「题目设置」卡片中补一个分值 Input，或至少在新题时提交 `undefined` 让后端兜底。
- [P3][依赖] question-form-dialog.tsx:135-166 — 表单重置 effect 依赖 `[question, open, defaultType]`，若父级传入的 question 对象引用在编辑中变化（如异步刷新），会清空用户已输入内容；最佳实践：仅在 `open` 从 false→true 时重置（把 open 作为唯一触发器）。

## apps/edu/components/evaluation/random-question-dialog.tsx

- [P3][死代码] random-question-dialog.tsx:72 — `const [, setLoadingQuestions] = useState(false)` 解构丢弃状态值，`setLoadingQuestions(true/false)` 只触发无意义重渲染，加载态从未被消费；最佳实践：删除该 state 或真正用于加载 UI。

## apps/edu/components/evaluation/manual-question-dialog.tsx

- [P3][状态] manual-question-dialog.tsx:63-70 — `selectedBankId` 关闭弹窗时不重置（仅切换时清空选中题），若上次选的题库被删除/下架，再次打开不会自动选中首库且显示空态；最佳实践：`handleClose` 中一并 `setSelectedBankId('')`。

## apps/edu/components/evaluation/bank-form-dialog.tsx

- [P3][错误被吞] bank-form-dialog.tsx:59-60 — 批次列表加载失败被 `// ignore` 完全静默吞掉，下拉只剩「不设置批次」，用户无感知；最佳实践：至少 `reportError` 记录一次（可对照 exam-form-dialog.tsx:60 已用 `reportError`）。

## apps/edu/components/evaluation/exam-form-dialog.tsx

- 无问题（duration 回归项已修复验证，batch 加载有 reportError + cancelled 守卫）。

## apps/edu/components/evaluation/evaluation-list-table.tsx

- 无问题。

## apps/edu/components/evaluation/exam-center-card.tsx

- 无问题。

## apps/edu/components/evaluation/question-preview.tsx

- 无问题。

## apps/edu/components/evaluation/score-config-dialog.tsx

- 无问题（typeScores 初始化 effect 的 [open, types] 依赖稳定；`scores[q.questionId]` 与 ExamQuestion.questionId 契约一致）。

## apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx

- [P1][数据丢失] evaluation-rules-editor.tsx:389-390,2011-2040 — 「答题方式(qbDrawMode)/正确率(qbPassRate)」仅为组件本地 state，从不写入 `config.methodResourceConfigs['question_bank']`（同区域 timeLimit/allowRetake 等均走 `updateResourceConfig` 持久化），关闭弹窗/保存后配置即丢失，后端永远收不到该配置，**自由刷题模式与正确率阈值从未生效**；最佳实践：改为 `getResourceConfig('question_bank', {...})` / `updateResourceConfig('question_bank', { drawMode, passRate })` 读写。
- [P2][输入丢失] evaluation-rules-editor.tsx:507-511 — `handleCreateRdq` 失败路径（catch 分支 reportError + toast）后仍继续执行 `setRdqActionOpen(false)` 关闭弹窗，用户已填写的题目内容丢失；最佳实践：catch 内 `return` 保持弹窗打开。
- [P3][死代码] evaluation-rules-editor.tsx:4390-4400 — `showAddQuestion` 弹窗无任何 `setShowAddQuestion(true)` 调用点，永不可打开。
- [P3][死代码] evaluation-rules-editor.tsx:185 — `methodInstanceCounts` 恒为 `{}` 且从未 set，`getMethodInstances` 的多实例分支恒为 1 个实例。
- [P3][风格] evaluation-rules-editor.tsx:357-378 — `setReviewStepsAndSync` 在 `setState` updater 函数内部调用 `store.setReviewSteps`（副作用进 updater，React StrictMode 下 updater 可能被双调用）；最佳实践：先在 updater 外算出 next 再分别 setState + dispatch。

## apps/edu/components/evaluation-rules/bank-question-selector-panel.tsx

- [P3][内存/竞态] bank-question-selector-panel.tsx:97-122 — 选中题目预加载 effect 无卸载取消标记（卸载后 `.then` 仍会 setState），且依赖 `[selectedIds, preloadedQuestions, questionCache]` 在每次缓存写入后空转重跑一次；最佳实践：加 `let cancelled` 守卫并依赖收敛后提前 return（现有逻辑已收敛，属轻度冗余）。
- [P3][逻辑] bank-question-selector-panel.tsx:161-170 — 「共建」tab 口径为 `collaboratorIds.length > 0`，会把「自己创建且带共建人」的题库也纳入，非严格「他人共建」；最佳实践：叠加 `ownerType !== 'mine'` 过滤。
- [P3][样式] bank-question-selector-panel.tsx:333-336,502-504 — 未知题型时 `typeColorMap[q.type ?? ''] || ''` 拼出空 class，Badge 无背景色；最佳实践：给 `||` 一个兜底 class。

## apps/edu/components/evaluation-rules/exam-activation-config.tsx

- 无问题。

## apps/edu/components/evaluation-rules/constants.tsx

- [P3][风格] constants.tsx:1-45 — 纯常量文件（无 JSX）却用 `.tsx` 扩展名；最佳实践：改名 `constants.ts`（与 types.ts/utils.ts 一致）。

## apps/edu/components/evaluation-rules/index.ts

- 无问题。

## apps/edu/components/evaluation-rules/shared-defs.ts

- 无问题（收敛回归验证通过）。

## apps/edu/components/evaluation-rules/types.ts

- 无问题。

## apps/edu/components/evaluation-rules/utils.ts

- 无问题。

## apps/edu/components/alliance/public-cards.tsx

- 无问题。

## apps/edu/components/alliance/public-list-shell.tsx

- 无问题。

## apps/edu/components/auth-provider.tsx

- 无问题（公共页 setState({loading:false}) 整对象替换会清空 me，行为正确；t 为 useCallback 绑定 locale，无重拉循环）。

## apps/edu/components/chunk-error-handler.tsx

- 无问题。

## apps/edu/components/global-api-error-handler.tsx

- 无问题。

## apps/edu/components/job/position-builder/ai-assisted-2/step3-result-table.tsx

- [P3][死代码] step3-result-table.tsx:51 — `const [aiNotice] = useState<string | null>(null)` 从未被 set，仅渲染一个永远为 null 的横幅。

## apps/edu/components/job/position-builder/step-ability-modeling.tsx

- [P2][竞态] step-ability-modeling.tsx:135-152 — 「关联岗位」过滤的 bindings 拉取无序号/取消守卫：快速切换岗位时，先发请求的旧响应可能后到并覆盖新响应，过滤结果与当前岗位不一致；最佳实践：引入 seq ref（同文件其他逻辑已有该模式，参照 evaluation-rules-editor.tsx:258 的 rubricKpSearchSeqRef）。
- [P3][死代码] step-ability-modeling.tsx:79 — `aiNotice` 从未赋值。
- [P3][交互] step-ability-modeling.tsx:451-454 — 编辑职责名时按 Escape 调用 `handleSaveEditResp()`（保存而非取消），与直觉相反；最佳实践：Escape 应清空 editing 状态。
- [P3][清理] step-ability-modeling.tsx:105-114 — 挂载拉取能力点/岗位列表无取消标记，卸载后 setState。

## apps/edu/components/job/position-builder/step-basic-info.tsx

- [P3][内存] step-basic-info.tsx:807 — `URL.createObjectURL(file)` 创建的 object URL 永不 revoke；最佳实践：在替换/卸载时 `URL.revokeObjectURL`。

## apps/edu/components/job/positions/position-list.tsx

- 无问题。

## apps/edu/components/job/student/ability-point-card.tsx

- 无问题。

## apps/edu/components/job/student/ability-tree.tsx

- [P2][崩溃风险] ability-tree.tsx:42 — `abilityDomains.find((d) => d.bindingIds.includes(b.id))` 未防御 `bindingIds` 缺失：后端 `domain.AbilityDomain.BindingIDs` 为 `[]string`（job.go:113，JSON 可输出 null），同份数据的知识图谱组件在 knowledge-graph.tsx:87-88 用了 `(d.bindingIds || [])` 防御而此处没有，一旦接口返回 null 该 tab 直接抛 TypeError 崩溃；最佳实践：改为 `(d.bindingIds || []).includes(b.id)`。

## apps/edu/components/job/student/cert-cards.tsx

- 无问题。

## apps/edu/components/job/student/competency-standards.tsx

- 无问题。

## apps/edu/components/job/student/duty-table.tsx

- 无问题。

## apps/edu/components/job/student/job-card.tsx

- 无问题。

## apps/edu/components/job/student/job-home.tsx

- [P3][死值] job-home.tsx:528 — 场景分支 stats 中 `majorCount: totalTasks`（语义错误，且 sceneStats 根本不消费 majorCount），仅岗位分支使用该字段；最佳实践：场景分支删除或改为真实专业数。

## apps/edu/components/job/student/knowledge-graph.tsx

- [P2][逻辑] knowledge-graph.tsx:126-133 — 自定义能力点（岗位编辑器中新建、无 `abilityPointId` 的 binding）会得到 `unitId = undefined`，以 undefined 为 id 建图节点并生成 `domain -> undefined` 边，图谱渲染可能异常；最佳实践：`unitId` 为空的 binding 跳过或用 binding.id 兜底（如 `b.abilityPointId || b.id`）。

## apps/edu/components/job/student/learning-path.tsx

- [P3][性能] learning-path.tsx:52-55,107-117 — `defaultSteps` 每次渲染重建新数组，导致 `steps` useMemo 缓存每次失效重算；最佳实践：用 `useMemo(() => Object.entries(...).map(...), [t])` 包一层。

## apps/edu/components/job/student/overview-tab.tsx

- 无问题。

## apps/edu/components/job/student/position-header.tsx

- 无问题。

## apps/edu/components/job/student/ranking-list.tsx

- 无问题。

## apps/edu/components/job/student/scene-list.tsx

- 无问题。

## apps/edu/components/job/student/stats-box.tsx

- 无问题。

---

## 统计

- 审查文件数：41
- 问题总数：21（P1 × 2、P2 × 4、P3 × 15）
- P0：0

### P1 摘要
1. `evaluation-rules-editor.tsx:389-390,2011-2040` — 题库测评的「答题方式（全部作答/自由刷题）/正确率阈值」仅存于本地 state，从不写入 `config.methodResourceConfigs['question_bank']`，关闭弹窗即丢失、后端从未收到该配置 → 功能未生效（数据丢失）。
2. `question-form-dialog.tsx:92,219` — 题目编辑弹窗无分值输入控件，`score` 恒为 0 或沿用旧值提交，后端无默认值原样落库 → 新建题目分值恒 0。

### P2 摘要
1. `step-ability-modeling.tsx:135-152` — 关联岗位过滤请求无竞态守卫，快速切换岗位旧响应可覆盖新响应。
2. `ability-tree.tsx:42` — `d.bindingIds.includes()` 未防御 null（同数据源知识图谱已防御），数据缺失时组件崩溃。
3. `knowledge-graph.tsx:126-133` — 自定义能力点（无 abilityPointId）生成 undefined 节点/边。
4. `evaluation-rules-editor.tsx:507-511` — 现场问答题保存失败仍关闭弹窗，已填内容丢失。
