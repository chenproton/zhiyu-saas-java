# 前端组件审查报告 frontend-comp-01（2026-08-07）

审查范围：apps/edu/components 下 alliance、auth-provider、chunk-error-handler、evaluation、evaluation-rules、job（position-builder/positions/student）目录，共 39 个文件。
后端契约核实：`backend/internal/store/query.go:478` `maxPageSize = 200`，`ExecuteListQuery`（query.go:439-440）将 limit 钳制到 200；`exams.go:70` UPDATE 直接覆盖 duration；`question_handler.go` 列表接口支持 bankId 过滤且返回完整 content/options/answer。

汇总：P0 = 0，P1 = 1，P2 = 10，P3 = 27。

---

## apps/edu/components/alliance/public-cards.tsx
- [P3][代码质量] public-cards.tsx:58,125,185 — 使用原生 `<img src>`（3 处）而非 next/image，触发 `@next/next/no-img-element` 类 lint 问题且无懒加载；最佳实践：改用 `next/image` 或统一图片组件。
- [P3][i18n] public-cards.tsx:159 — `t(' 至 {date}', ...)` 的 key 以空格开头且硬编码中文模板，属约定式中文 key 的变体，极易在英文词典中遗漏；最佳实践：key 改为无首空格形式并补 en.json 词条。

## apps/edu/components/alliance/public-list-shell.tsx
无问题（受控组件、i18n 一致、默认参数合理）。

## apps/edu/components/auth-provider.tsx
- [P2][性能/状态] auth-provider.tsx:67-99 — `fetchMe` 依赖 `pathname`，每次路由变化都重新调用；且当进入公共页面时执行 `setState({ loading: false })`（无 `me` 字段），会**清空已登录用户状态**，用户从私有页切到公共页再返回时经历状态丢失 + 重新拉取的闪烁；最佳实践：公共页面仅跳过拉取、保留旧 state（`setState(prev => ({ ...prev, loading: false }))`），并把拉取条件改为「token/首次加载」而非 pathname。
- [P3][代码质量] auth-provider.tsx:155-156 — `hasPermission` 中 `typeof perms !== 'object'` 检查是死代码（perms 由 useMemo 保证为对象且第 155 行已拦截空对象）；最佳实践：删除该分支。

## apps/edu/components/chunk-error-handler.tsx
- [P3][健壮性] chunk-error-handler.tsx:15-17,45 — 以 `reason?.name === 'ChunkLoadError'` 或消息含 `'Loading chunk'` 判定，生产/开发构建（webpack 5）与不同网络栈下消息格式可能不一致，漏判时用户只会看到空白页；最佳实践：同时匹配 `'ChunkLoadError'`、`'failed to fetch dynamically imported module'`、`'Loading CSS chunk'` 等变体并保留边界兜底刷新。

## apps/edu/components/evaluation/bank-form-dialog.tsx
- [P3][错误处理] bank-form-dialog.tsx:59-60 — 批次列表加载失败 `catch (_err) { // ignore }` 完全静默（且全局错误处理器会同时弹 toast，行为不一致）；最佳实践：至少 `reportError(err, '加载题库批次')` 保留排查线索。

## apps/edu/components/evaluation/evaluation-list-table.tsx
无问题（选择逻辑、草稿池禁用、batchMap 容错均正确）。

## apps/edu/components/evaluation/exam-center-card.tsx
- [P3][i18n] exam-center-card.tsx:35-39 — `STATUS_META` 未命中时 `label: item.status` 直接透传英文状态原文给 `t()`，zh 下无对应词条会显示原始英文键；最佳实践：为未知状态提供统一中文兜底文案。

## apps/edu/components/evaluation/exam-form-dialog.tsx
- [P1][数据丢失] exam-form-dialog.tsx:89-101 — `handleSubmit` 无条件提交 `duration: 60`（UI 中无时长输入项）。后端 `exams.go:70` 的 UPDATE 会**直接覆盖** duration：编辑任何 duration≠60 的试卷（如 90/120 分钟）保存后静默重置为 60 分钟；新建试卷则永远只能创建 60 分钟的试卷；最佳实践：编辑时沿用 `exam.duration`（仅新建时给默认值 60），并在弹窗中提供时长输入字段。
- [P3][竞态] exam-form-dialog.tsx:71-87 — 表单重置用无 cancelled 的 async IIFE，与 bank-form-dialog 的 `queueMicrotask` 写法不一致；快速连续打开（不同 exam）时存在旧值覆盖新值的理论竞态；最佳实践：统一为 queueMicrotask 或同步 setState。

## apps/edu/components/evaluation/manual-question-dialog.tsx
- [P3][后端契约] manual-question-dialog.tsx:88-89 — `knowledgeApi.list({ limit: 10000 })` 被后端 maxPageSize=200 钳制（query.go:439-440），知识点搜索池实际只有前 200 条；与 question-form-dialog（limit 1000）不一致；最佳实践：统一使用带 search 的后端搜索接口或分段分页拉取。

## apps/edu/components/evaluation/question-form-dialog.tsx
- [P2][错误被吞] question-form-dialog.tsx:111-112 — 知识点列表加载失败 `catch (_err) {}` 完全静默，用户打开「关联知识点」下拉只见「加载中…」→ 无数据，无法区分失败与确实无知识点；最佳实践：至少 `reportError` 或 toast 提示。
- [P3][校验缺失] question-form-dialog.tsx:201-228 — 单选/多选未选答案、填空未填答案均可提交（`options[NaN]` 求值为 `''`），保存出「无答案题目」；最佳实践：提交前校验 answer 非空并 toast 提示。

## apps/edu/components/evaluation/question-preview.tsx
- [P3][健壮性] question-preview.tsx:32,36 — `(question.answer as string[]).join(', ')` 直接断言数组：fill 类型若后端返回字符串形态（单空）会抛 `TypeError: join is not a function`；当前表单侧固定存数组故低概率；最佳实践：`Array.isArray` 分支容错。

## apps/edu/components/evaluation/random-question-dialog.tsx
- [P2][后端契约/数据不完整] random-question-dialog.tsx:78 — `questionApi.list({ limit: 10000 })` 被后端钳制为 200 条（query.go:439-440），**随机抽题池实际只有全量题目的前 200 题**，超出部分永远抽不到且无任何提示；最佳实践：按 bankId 分批拉取（如逐题库 limit=200 聚合）或后端支持 noPagination 全量。
- [P3][代码质量] random-question-dialog.tsx:70 — `const [, setLoadingQuestions] = useState(false)` 状态值从不读取（loading 状态未渲染也未参与逻辑）；最佳实践：删除或实际使用。
- [P3][类型] random-question-dialog.tsx:83 — `(q.createdAt as unknown as string)` 双重强转掩盖类型不一致；最佳实践：修正 api 层类型。

## apps/edu/components/evaluation/score-config-dialog.tsx
- [P3][命名] score-config-dialog.tsx:50-52 — `types.forEach((t) => ...)` 变量 `t` 遮蔽 i18n 翻译函数 `t`，可读性差；最佳实践：改为 `typeKey`。

## apps/edu/components/evaluation-rules/bank-question-selector-panel.tsx
- [P2][后端契约/数据不完整] bank-question-selector-panel.tsx:121 — `questionApi.list({ bankId, limit: 1000 })` 被钳制为 200，题库题目超过 200 时列表截断，剩余题目无法被选中；最佳实践：分页加载或按类型/搜索分批聚合。
- [P2][并发竞态] bank-question-selector-panel.tsx:118-137 — `handleSelectBank` 连续切换题库时旧 `loadQuestions` 请求未取消，先发后至的响应会覆盖新题库列表（显示错误的题目集合）；最佳实践：用请求序号/AbortController 丢弃过期响应。
- [P3][类型] bank-question-selector-panel.tsx:63-73,78 — `banks/bankQuestions/preloadedQuestions` 及多处 `(res as unknown as ...)` 全部 `any` 逃逸；最佳实践：定义 QuestionBank/Question 类型。
- [P3][内存/重复请求] bank-question-selector-panel.tsx:97-116 — 预加载失败的 questionId 不会进入 `preloadedQuestions`，`selectedIds`/`preloadedQuestions` 每次变化都会对失败 id 重新发起 `questionApi.get`；最佳实践：失败 id 也记账或做去重节流。
- [P3][清理无效] bank-question-selector-panel.tsx:87-95 — mount effect 的 `cancelled` 标志无效（`loadBanks` 内没有取消检查，卸载后仍会 setState）；最佳实践：删除标志或让 loadBanks 接受取消信号。

## apps/edu/components/evaluation-rules/constants.tsx
无问题（纯数据源，注释明确单一数据源策略）。

## apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx
- [P2][后端契约/数据不完整] evaluation-rules-editor.tsx:441 — `randomDrawQuestionApi.list({ limit: 9999 })` 被钳制为 200：现场问答题超过 200 条时，「新增现场问答题」面板/详情/选择全部缺失；最佳实践：分页或后端提供全量模式。
- [P2][后端契约/数据不完整] evaluation-rules-editor.tsx:539 — `examApi.list({ limit: 1000 })` 被钳制为 200：试卷超过 200 份时「选择已有试卷」列表截断且无提示；最佳实践：分页加载 + 搜索。
- [P2][状态不持久化] evaluation-rules-editor.tsx:394-396,2014-2043 — `qbDrawMode`（答题方式：全部作答/自由刷题）与 `qbPassRate`（正确率）是纯本地 state，从未写入 `methodResourceConfigs`，关闭弹窗/刷新即丢失，且对保存结果无任何影响（自由刷题开关形同虚设）；最佳实践：随 `updateResourceConfig('question_bank', {...})` 持久化。
- [P3][死代码] evaluation-rules-editor.tsx:188 — `methodInstanceCounts` 初始化 `{}` 后永无 setter，`getMethodInstances`/多实例展示逻辑恒为单实例分支；最佳实践：删除或实现实例数量管理。
- [P3][死代码] evaluation-rules-editor.tsx:212,4393-4405 — `paperDetailOpen` 的 state 值未使用；`questionDetailOpen` 弹窗内容恒为 `{null}`（死弹窗）；最佳实践：删除对应 state 与弹窗。
- [P3][类型] evaluation-rules-editor.tsx:877-878,2452-2458,2517-2525 等 — 大量 `(config as any)[field]`、`as any` 逃逸与 `Record<string, any>`（426/427/453 等行）；最佳实践：为 EvalRuleConfig 补齐索引签名类型。

## apps/edu/components/evaluation-rules/exam-activation-config.tsx
无问题（受控组件、模式切换与时间输入逻辑正确）。

## apps/edu/components/evaluation-rules/index.ts
无问题。

## apps/edu/components/evaluation-rules/shared-defs.ts
- [P2][状态管理/多实例串数据] shared-defs.ts:21-23,50-61 — `_loadedExams/_questionCache/_allQuestions` 为模块级可变全局缓存：`loadPapers`（evaluation-rules-editor.tsx:535-536）在缓存非空时**跳过重新拉取**，而 `clearAllCaches` 仅场景任务编辑页（app/scene/scenarios/[id]/edit/tasks/page.tsx:181）调用——课程编辑器/其他任务页面打开时复用旧缓存：同 SPA 会话内新建/修改的试卷不显示、切换租户（登出重登）后仍显示上一个租户的试卷列表（跨租户数据泄露）；最佳实践：缓存收敛到 React Context/单页级状态，按 tenantId 隔离，或在每次编辑器挂载时以 loading 态重新拉取。
- [P3][类型] shared-defs.ts:1-18 — `CachedQuestion` 带 `[key: string]: unknown` 索引签名，配合调用方 any 数组完全失去类型约束；最佳实践：收敛为具体类型。

## apps/edu/components/evaluation-rules/types.ts
无问题。

## apps/edu/components/evaluation-rules/utils.ts
无问题（uid 带随机后缀防重复，clone 深拷贝，使用处符合预期）。

## apps/edu/components/global-api-error-handler.tsx
- [P2][重复提示] global-api-error-handler.tsx:10-28 — api-helpers.ts:189-191 对**所有**非 401 错误回调全局处理器（无论调用方是否自行 catch），而本组件对所有 4xx/5xx 一律弹 toast：与组件内本地 toast 的 catch 分支（如 exam-form-dialog 上传失败、evaluation-rules-editor 保存失败等均先本地 toast）叠加形成**双 toast**；最佳实践：全局处理器仅处理「未被消费的」错误（如 request 层增加 consumed 标记），或全局只做 console/上报不弹 toast。

## apps/edu/components/job/position-builder/ai-assisted-2/step3-result-table.tsx
- [P3][死代码] step3-result-table.tsx:51,74-79 — `aiNotice` state 恒为 null 且无 setter，提示区块永不渲染；最佳实践：删除。

## apps/edu/components/job/position-builder/step-ability-modeling.tsx
- [P3][死代码] step-ability-modeling.tsx:79,533-538 — `aiNotice` 恒为 null，提示区块死代码；最佳实践：删除。
- [P3][交互瑕疵] step-ability-modeling.tsx:451-454 — 职责名编辑框按 Escape 也触发 `handleSaveEditResp`（保存而非取消），与常规预期相反；最佳实践：Escape 分支应只退出编辑不保存。
- [P3][后端契约] step-ability-modeling.tsx:107 — `abilityApi.list({ limit: 1000, isPublic: true })` 被钳制为 200（后端已有注释 scenario_tasks.go:136 承认该限制），能力点库搜索池仅 200 条；最佳实践：改用后端 search 参数按需查询。
- [P3][内存泄漏] step-ability-modeling.tsx:105-114 — 两个 mount 拉取无 cancelled/清理；卸载后完成仍 setState（React 18 无警告但浪费）；最佳实践：加 cancelled 标志。

## apps/edu/components/job/position-builder/step-basic-info.tsx
- [P3][内存泄漏] step-basic-info.tsx:807 — 证书图片预览 `URL.createObjectURL` 创建后从不 revoke；最佳实践：组件卸载/替换时 revoke。
- [P3][后端契约] step-basic-info.tsx:89-90,124 — `industryApi.list({ limit: 1000 })` / `majorApi.list({ limit: 1000 })` / `certificateLibraryApi.list({ limit: 1000 })` 均被钳制为 200，行业/专业/证书库超 200 时下拉选项缺失；最佳实践：接入后端 search 或分页。
- [P3][占位实现] step-basic-info.tsx:166-171 — `handleAIGenerate` 是 stub（提示未接入 + 300ms 假延迟）；若短期不接 AI 建议隐藏入口，避免伪交互。

## apps/edu/components/job/positions/position-list.tsx
无问题（hooks 顺序、空列表提前返回均在 hooks 之后，map 容错正确）。

## apps/edu/components/job/student/ability-point-card.tsx
- [P3][健壮性] ability-point-card.tsx:43 — `binding.requiredLevel` 缺失时 `t(undefined)` 返回 undefined 渲染为空（不崩）；最佳实践：`LEVEL_LABELS[binding.requiredLevel] || t('了解')` 兜底。

## apps/edu/components/job/student/ability-tree.tsx
无问题（abilityDomains.bindingIds 由转换层兜底为空数组，键盘可达性已处理）。

## apps/edu/components/job/student/cert-cards.tsx
无问题（图片灯箱、展开态、URL 容错均正确）。

## apps/edu/components/job/student/competency-standards.tsx
无问题（scroll 同步、目标等级兜底 idx=2 均合理）。

## apps/edu/components/job/student/duty-table.tsx
- [P3][展示逻辑] duty-table.tsx:65 — 「岗位职责」计数用 `responsibilities.length || requirements.length`：当职责为 0 条但任职要求非空时，会误把「任职要求」数量显示为「岗位职责」计数；最佳实践：职责计数单独使用 `responsibilities.length`（空态已有 120 行提示）。
- 其余（分组、分页、弹窗重置 page=0、索引恢复）均正确。

## apps/edu/components/job/student/job-card.tsx
无问题。

## apps/edu/components/job/student/job-home.tsx
- [P2][后端契约/数据不完整] job-home.tsx:169,202,209,236 — `scenarioApi.list`/`publicPositionApi.list`/`taskApi.list` 均传 limit:1000 被钳制为 200：岗位/场景超过 200 时首页总数、筛选、排行榜与详情页数据全部截断且无提示；最佳实践：服务端分页 + 搜索参数，或接受截断并展示「仅展示前 200」。
- [P3][性能] job-home.tsx:173-179 — scene 模式下对每个场景串行发一个 `taskApi.list`（N 场景 N 请求），场景量大时首屏慢；最佳实践：后端提供按场景批量统计接口。
- [P3][交互] job-home.tsx:39-44 — PositionSideLists 每 4 秒强制轮播 tab，用户正在浏览/点击列表时也会被切换；最佳实践：用户悬停/操作时暂停轮播。

## apps/edu/components/job/student/knowledge-graph.tsx
无问题（数据装配纯函数、cancelled 清理正确、fallback 领域不污染输入）。

## apps/edu/components/job/student/learning-path.tsx
- [P3][死代码] learning-path.tsx:107-117 — 当 `orderedScenarios` 为空时组件在 154-161 行已提前返回，`defaultSteps` 兜底分支永不执行；最佳实践：删除或调整提前返回逻辑。

## apps/edu/components/job/student/overview-tab.tsx
无问题。

## apps/edu/components/job/student/position-header.tsx
无问题（收藏 loading 防重入、登录拦截、请求 cancelled 均正确）。

## apps/edu/components/job/student/ranking-list.tsx
无问题（useSyncExternalStore 用法正确，页码钳制逻辑合理）。

## apps/edu/components/job/student/scene-list.tsx
- [P3][交互瑕疵] scene-list.tsx:116-121 — 「去学习」按钮位于可点击 header 内且 onClick 无 `stopPropagation`，点击导航的同时会触发展开/收起切换；最佳实践：按钮事件加 stopPropagation。

## apps/edu/components/job/student/stats-box.tsx
无问题。
