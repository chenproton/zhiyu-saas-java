# 前端 app 层复查（frontend-app-01）— 2026-08-08

审查范围：`/tmp/opencode/a2-aa` 列表 65 个文件（apps/edu/app）。本轮为 2026-08-07 全量修复后的复查：已修项回归、上轮遗漏、新问题。

统计：审查 65 文件，问题 32 条（P0=0，P1=2，P2=14，P3=16）。

---

## apps/edu/app/affairs/approvals/page.tsx
- [P3][性能] 61-82 — 加载 4 个列表（各 limit 1000）仅用于展示名称，无分页兜底；量级小时可接受，保留关注。
- 无其他问题（getStepInfoFn 的对象身份判断与 allRecords 展开保持一致，可用）。

## apps/edu/app/affairs/batches/page.tsx
无问题。

## apps/edu/app/affairs/config/page.tsx
无问题。

## apps/edu/app/affairs/layout.tsx
无问题。

## apps/edu/app/affairs/majors/page.tsx
无问题（转发页）。

## apps/edu/app/affairs/org-structure/page.tsx
无问题（转发页）。

## apps/edu/app/affairs/positions/page.tsx
无问题（转发页）。

## apps/edu/app/affairs/programs/[id]/_components/courses-tab.tsx
- [P2][竞态] 82-146 — loadCourses 无 cancelled/序号守卫；programId 变化（同路由客户端导航）时旧响应可能覆盖新方案课程列表。最佳实践：沿用 `let cancelled` 或 seq ref 模式（同仓库 job/landing 已有先例）。
- [P3][风格] 429 — `<SelectTrigger>` 缩进错乱（相对 428-431 结构），不影响运行。
- [P3][逻辑] 92 — linkType 判定 positionId 优先于 courseId；后端数据同时存在两字段时按岗位处理，与保存路径一致但语义含糊。

## apps/edu/app/affairs/programs/[id]/_components/program-course-import-dialog.tsx
- [P2][错误被吞] 86-88 — preview 接口异常时静默降级为直接导入（跳过重复校验），若 preview 失败源于网络/服务错误将产生重复课程且无提示。最佳实践：预览失败应报错并中止，仅将「无重复」作为跳过预览的合法分支。

## apps/edu/app/affairs/programs/[id]/page.tsx
- [P2][数据丢失] 52-79, 83-113 — loadProgram 失败（toast 后）仍渲染空表单，且保存按钮可用：用户误输入名称后点击保存会对已存在方案执行全量 update，可能覆盖真实字段。最佳实践：加载失败时禁用保存或回退只读。

## apps/edu/app/affairs/programs/page.tsx
- [P3][风格] 80 — 表头全选 checkbox 无 indeterminate 半选态（部分选中时外观误导）。
- [P3][死代码] 44 — createRedirectUrl 携带 `?new=true`，但详情页仅按 `id === 'new'` 判断，query 从不读取。

## apps/edu/app/affairs/relations/page.tsx
无问题（转发页）。

## apps/edu/app/affairs/scheduling/_components/affairs-config-import-dialog.tsx
- [P3][契约] 30, 23 — `'affairs-config' as any` 绕过类型检查，实体名与后端 import 路由强耦合无编译期保护。

## apps/edu/app/affairs/scheduling/_components/schedule-edit-dialog.tsx
无问题（render 期间调整 state 的 React 官方模式，提交载荷完整含 classNodeIds）。

## apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx
- [P1][数据丢失] 164-180 — 移动排课（movingEntry 分支）的 update 载荷只带 `classNodeId` 不带 `classNodeIds`；后端 UpdateSchedule 对空 classNodeIds 回退为 `[classNodeId]`（scheduling_handler.go:527-531），多班级条目被移动后其余班级丢失。最佳实践：载荷补 `classNodeIds: movingEntry.classNodeIds || (movingEntry.classNodeId ? [movingEntry.classNodeId] : [])`（对照 schedule-edit-dialog.tsx:77-78 的正确写法）。
- [P3][死代码] 53 — `const [savingQuick] = useState(false)` 恒为 false，161 行的快速点击守卫永不生效。
- [P3][性能] 88-89 — TODO 已自述：limit 200 前端场地筛选不完整，属已知项。

## apps/edu/app/affairs/scheduling/_components/schedule-import-bar.tsx
无问题。

## apps/edu/app/affairs/scheduling/_components/timetable-view-tab.tsx
无问题。

## apps/edu/app/affairs/scheduling/_components/venue-period-config-tab.tsx
无问题（参数化节次生成、反推设置逻辑自洽；脏标记与校验完整）。

## apps/edu/app/affairs/scheduling/page.tsx
- [P2][状态] 45-46 — `setPlanId((prev) => prev || targetId)`：URL planIdParam 在页面挂载后变化（如从另一计划详情点「前往排课」）时被忽略，仍显示旧计划。最佳实践：prev 为空时用 targetId 即可满足首选，但要监听 planIdParam 变化强制同步。
- [P3][死代码] 39 — `const [, setLoadingPlan] = useState(false)` 解构丢弃的值从不参与渲染。
- [P3][契约] 173-187 — 为 TimetableViewTab 伪造 term 对象（weeksCount: 0、startDate/endDate 空串），依赖 `|| 16` 兜底，字段演进时易碎。

## apps/edu/app/affairs/students/page.tsx
无问题（转发页）。

## apps/edu/app/affairs/teachers/page.tsx
无问题（转发页）。

## apps/edu/app/affairs/teaching-plans/_components/generate-plan-dialog.tsx
无问题（上次修复的 adjust-state-during-render 模式正确）。

## apps/edu/app/affairs/teaching-plans/[id]/page.tsx
- [P2][一致性] 182-188 — `teachingPlanApi.submit` 成功后 `approvalApi.create` 失败：计划已变 pending 但无审批流，toast 提示提交失败，用户重试会重复 submit（后端幂等性未知）。最佳实践：先 create 审批记录再 submit，或提交失败时引导到审批列表核对。
- [P3][逻辑] 245 — 仅 draft/rejected 可编辑，pending/approved 不可编辑（状态机约束，符合预期）。
- 已修项回归：handleSaveAll 失败重试保留编辑态（148-162）正确。

## apps/edu/app/affairs/teaching-plans/[id]/_components/entry-type-badge.tsx
无问题。

## apps/edu/app/affairs/teaching-plans/page.tsx
- [P3][契约] 74-77 — groupStatusFilterOptions 的「未排课」未含 archived 状态；归档计划在分组视图消失（若归档计划仍归组可见性设计如此则忽略）。
- 已修项回归：164 行 batchMap.get(batchId) 返回 string（ContentListPage 543 行构建 id→name），显示正确。

## apps/edu/app/affairs/workflows/page.tsx
无问题。

## apps/edu/app/changelog/page.tsx
无问题。

## apps/edu/app/dashboard/layout.tsx
无问题。

## apps/edu/app/error.tsx
无问题。

## apps/edu/app/evaluation/approvals/page.tsx
- [P3][逻辑] 157-162 — exam 分支未设置 version（恒为 '-'）；若后端试卷无版本字段可接受。
- 无其他问题。

## apps/edu/app/evaluation/batches/page.tsx
无问题。

## apps/edu/app/evaluation/exams/[id]/page.tsx
- [P2][状态] 78-90 — triedReload ref 使同路由内切换试卷 id（客户端导航复用组件）时不再触发加载，新 id 不在 store 时误显示「试卷不存在」。最佳实践：effect 中按 examId 重置 triedReload 或改为 key 驱动。
- [P3][UI] 525-528 — 「批量导入题目」永久 disabled（开发中占位）。
- [P3][交互] 114-140 — commitScore 对 0/负值静默返回（输入保留但无任何反馈）。
- 已修项回归：分值分布算法（276-315）合计恒为 100，正确。

## apps/edu/app/evaluation/exams/page.tsx
无问题。

## apps/edu/app/evaluation/exam-usage/page.tsx
- [P2][时区/契约] 173-179, 204-205 — `<input type="datetime-local">` 的本地无时区串（如 `2026-08-08T10:00`）直传后端：Postgres timestamptz 按服务器会话 TZ 解释，服务器为 UTC 时用户选的 10:00 实际 18:00（UTC+8）才开启；同时后端 evaluation_result.go:29 `time.Parse(RFC3339,...)` 对该格式解析失败导致开始时间守卫静默失效（仅靠 SyncScheduledExamUsageStatus 懒更新兜底）。toDatetimeLocal 注释「UTC」与提交行为自相矛盾。最佳实践：提交前按本地时区补偏移转 RFC3339，展示用同一时区还原。
- [P3][风格] 100-121 — loadUsages 与挂载 useEffect 内联加载重复两套逻辑。
- 已修项回归：编辑不携带 targetType/targetIds（208-211）、创建固定 class（216）正确，后端 COALESCE 保留原值验证通过。

## apps/edu/app/evaluation/exam-usage/results/page.tsx
- [P3][逻辑] 79 — `majorId: r.majorName || '-'` 字段命名与取值错位（majorMap.get 拿到的是名称字符串必 miss，靠 `|| result.majorId` 兜底显示，useMajorMap 实际失效）。
- [P3][UI] 354-357 — 「查看详情」按钮无 onClick，点击无响应。
- [P3][边界] 324 — totalScore 为 0 时进度条宽度 NaN%。

## apps/edu/app/evaluation/job-ability/config/[id]/page.tsx
无问题。

## apps/edu/app/evaluation/job-ability/config/[id]/_components/level-config-dialog.tsx
无问题（档位连续性、递增校验、恢复默认均正确）。

## apps/edu/app/evaluation/job-ability/config/[id]/_components/position-weight-config.tsx
无问题（加载 cancelled 守卫、保存校验、两级权重合计校验完整）。

## apps/edu/app/evaluation/job-ability/config/[id]/_components/weight-config-dialog.tsx
无问题（锁定项分配、100% 校验正确）。

## apps/edu/app/evaluation/job-ability/page.tsx
- [P3][性能] 57-67 — 每条规则串行 N+1 拉取岗位模型统计能力点数；岗位数多时首屏慢（可接受量级但值得注意）。

## apps/edu/app/evaluation/job-ability/results/page.tsx
- [P2][状态] 47 — `useState(positionIdParam || '')` 仅初始化一次；挂载后 URL positionId 变化不再生效（与 scheduling/page 同类问题）。
- 已修项回归：汇聚轮询 generation 守卫（168-241）、timer 清理（63-67）正确。

## apps/edu/app/evaluation/landing/banks/[id]/page.tsx
- [P3][性能] 121 — 单次 limit 10000 拉全量题目，题库大时首屏慢（无分页）。

## apps/edu/app/evaluation/landing/exam-center/page.tsx
无问题。

## apps/edu/app/evaluation/landing/exams/[id]/page.tsx
- [P2][错误处理] 199-204 — 倒计时归零自动交卷：提交失败时 submittedRef 已置位，不再自动重试且倒计时停留 0（手动提交按钮仍可用兜底，但「自动交卷」承诺失效）。
- [P3][契约] 870 vs 实现 — 须知宣称「系统将自动保存答题进度」，实际答案仅存内存，刷新即全部丢失。
- [P3][边界] 186 — examDuration 为 0 时按不限时处理，但概览页显示「0 分钟」。
- 已修项回归：判断题单选按钮（481-506）、canStart 状态判定（238-242）正确。

## apps/edu/app/evaluation/landing/exams/page.tsx
无问题。

## apps/edu/app/evaluation/landing/layout.tsx
无问题。

## apps/edu/app/evaluation/landing/page.tsx
- [P3][风格] 137-138 — `as any` 绕过 status 过滤类型，契约无编译期保护。

## apps/edu/app/evaluation/layout.tsx
无问题。

## apps/edu/app/evaluation/lesson-results/daily-exams/[resultId]/page.tsx
- [P3][状态] 46-49, 144-147 — saveFailed 成功后不重置：首次保存失败提示后再次保存成功，红字「保存失败，请重试」仍残留。
- 已修项回归：allScored（123-127）、gradedIds 区分评 0 分（129-132）正确。

## apps/edu/app/evaluation/lesson-results/daily-exams/page.tsx
- [P2][性能] 53-67 — 对每个考试安排（最多 500 个）并发发起结果列表请求（N+1）；量大时打满后端且首屏慢。最佳实践：后端提供按 usage 聚合统计接口，或前端只对可见项懒加载。
- [P3][边界] 208 — 待评分记录 score 为 null 时渲染 `null/100`。

## apps/edu/app/evaluation/lesson-results/[id]/page.tsx
无问题。

## apps/edu/app/evaluation/lesson-results/page.tsx
- [P2][竞态] 106-116 — selectedCourseId 快速切换时无 cancelled 守卫，旧课程的结果/节点响应可能覆盖新课程数据。

## apps/edu/app/evaluation/question-banks/[id]/page.tsx
- [P2][错误被吞] 292-299, 332-357 — createQuestion/updateQuestion/deleteQuestion 及批量复制/删除全部 fire-and-forget：无 await、无 catch、无失败提示；单条失败静默丢失且批量操作无条件清空选择集。最佳实践：Promise.allSettled + 结果 toast（参照 job/archive/page.tsx:104-117 模式）。
- [P3][UI] 132-135 — 创建人筛选直接展示用户 ID（注释自认，待接入姓名接口）。

## apps/edu/app/evaluation/question-banks/page.tsx
无问题。

## apps/edu/app/evaluation/scene-results/[id]/page.tsx
- [P3][状态] 872 — DrawnQuestionCard 的 key 含 `oralAnswers[q.id]`：失焦提交后整卡重挂载（功能可用，但属 hacky 模式，后续维护易踩坑）。
- [P3][UX] 716-727 — review 模式要求至少勾选一个评审步骤才能保存，但按钮仅置灰无提示文案，教师可能困惑。
- 已修项回归：客观题自动分以提交答案为唯一依据（669-684）、score clamp（763-766）正确。

## apps/edu/app/evaluation/scene-results/page.tsx
- [P2][状态] 291-437 — TaskMethodTabs 定义在 GradingPageContent 渲染函数内部：每次父组件重渲染（切换折叠、选择场景、搜索）产生新组件类型，activeMethod 状态被重置回第一个方法 tab。

## apps/edu/app/evaluation/workflows/page.tsx
无问题。

## apps/edu/app/global-error.tsx
无问题。

## apps/edu/app/job/approvals/page.tsx
无问题。

## apps/edu/app/job/archive/page.tsx
- [P3][错误处理] 126 — 批量删除用 Promise.all：任一失败整批进 catch，且此前已删除的部分无提示（建议 allSettled 汇总，参照同文件 104-117 的批量恢复）。

## apps/edu/app/job/batches/page.tsx
无问题。

## apps/edu/app/job/landing/[id]/learn/page.tsx
无问题（cancelled 守卫正确）。

## apps/edu/app/job/landing/[id]/page.tsx
- [P1][竞态/卡死] 91-169 — 两个 effect 共享 loadSeqRef：页面已加载后切换到另一岗位 id（知识图谱关联岗位等客户端导航）时，effect2（110-112 行先于 effect1 的异步完成）立即抢占序号，effect1 的 finally（104 行 `seq === loadSeqRef.current` 不成立）跳过 setLoading(false)，而 effect2 从不复位 loading → 页面永久停留在骨架屏。最佳实践：effect1 用独立 seq 或 cancelled 守卫（learn 页 30-47 的写法即正确范本），effect2 不复用同一序号。

## apps/edu/app/job/landing/layout.tsx
无问题。

## apps/edu/app/job/landing/page.tsx
无问题（转发页）。
