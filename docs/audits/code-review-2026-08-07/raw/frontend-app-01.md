# 代码审查报告：apps/edu/app 批次 01（affairs / evaluation / dashboard / changelog / error / global-error / job 前半）

- 审查时间：2026-08-08
- 审查范围：apps/edu/app/ 下 affairs（教务）、evaluation（评价考核）、dashboard、changelog、error、global-error 及 job 目录前半部分页面，共 66 个文件
- 审查方式：逐文件完整逐行通读（read 工具），涉及后端契约处已 grep backend 源码核实
- 严重级定义：P0 必崩 / P1 明显逻辑 bug、数据丢失、状态串数据、静默失败 / P2 竞态、性能、状态管理、loading 缺失 / P3 一般

---

## apps/edu/app/affairs/approvals/page.tsx
- [P3][类型] affairs/approvals/page.tsx:33 — `history?: any[]` 使用 any 类型；批量审查结果未读该字段。最佳实践：定义 `ApprovalHistory` 类型。
- [P3][性能] affairs/approvals/page.tsx:62-66 — 首屏 4 个 `limit: 1000` 全量请求（方案/计划/批次/教务批次），数据量大时拉取慢。最佳实践：改用分页或仅拉取审批涉及 targetId 的对象。

## apps/edu/app/affairs/batches/page.tsx
无问题（薄封装页，逻辑在共享组件 BatchGroupPage）。

## apps/edu/app/affairs/config/page.tsx
无问题（refreshKey 刷新模式正确）。

## apps/edu/app/affairs/layout.tsx
无问题。

## apps/edu/app/affairs/majors/page.tsx
无问题（re-export）。

## apps/edu/app/affairs/org-structure/page.tsx
无问题（re-export）。

## apps/edu/app/affairs/positions/page.tsx
无问题（re-export）。

## apps/edu/app/affairs/programs/[id]/_components/courses-tab.tsx
- [P2][数据丢失] courses-tab.tsx:121-128 — 加载时按 positionId 将多行合并为一行且只保留 `v[0]`（丢弃其余行的学分/学时配置）。后端 `training_program_courses` 是按行存储、不按岗位场景展开（backend/internal/store/training_programs.go:145 PutCourses 逐行插入），一旦同一 positionId 存在多条不同配置的记录（如用户重复添加同一岗位），重载合并后编辑保存将静默丢失其余行配置。最佳实践：加载时保持原始行（同岗位多行均展示），仅在展示统计层按岗位聚合；或后端保存时按岗位展开成多行与前端口径一致。
- [P3][健壮性] courses-tab.tsx:124 — 分组行 key 用 `pos-${pid}-${Date.now()}`，同一毫秒内多个岗位组会产生重复 key 导致 React 渲染告警/错位。最佳实践：用 `pos-${pid}` 或全局自增 id。
- [P3][一致性] courses-tab.tsx:267-286 — 岗位行"共 n 项"按已发布场景数展开计数（courseCount/totalCredits），而实际落库只有 1 行，前后端口径不一致，用户在「已保存」状态下看到的数量与实际存储不符。最佳实践：保存后按后端实际行数回显。
- [P3][性能] courses-tab.tsx:96-108 — 初载对每个岗位串行请求场景列表（N 个请求）。最佳实践：Promise.all 并发 + 失败隔离。

## apps/edu/app/affairs/programs/[id]/_components/program-course-import-dialog.tsx
- [P2][静默降级] program-course-import-dialog.tsx:62-89 — `handleImport` 中预览请求抛异常时 `catch { return await doImport(files, false) }`：预览失败（网络/服务异常）静默回退为直接导入，重复数据将不做确认直接写入。最佳实践：catch 分支应提示「预览失败」并中止，而非绕过去重直接导入。
- [P2][错误处理] program-course-import-dialog.tsx:44 — `res.json()` 未做 try/catch，后端返回非 JSON（网关 502/500 HTML）时抛异常向上传播，导入结果提示丢失。最佳实践：`const data = await res.json().catch(() => ({}))`。
- [P3][i18n] program-course-import-dialog.tsx:33 — 下载文件名硬编码中文（作为展示文件名可接受，但建议走 t()）。

## apps/edu/app/affairs/programs/[id]/page.tsx
- [P3][类型] programs/[id]/page.tsx:36 — `coursesRef = useRef<any>`。最佳实践：为 ProgramCoursesTab 的 imperative handle 定义接口类型。
- [P3][UX] programs/[id]/page.tsx:98 — 新建成功后 `router.replace` 不保留表单痕迹；若后续接口在跳转后失败无法回退，可接受。

## apps/edu/app/affairs/programs/page.tsx
- [P3][类型] programs/page.tsx:12、57 — `mapProgram(backend: any)`、`renderList(props: any)` 全 any。最佳实践：补类型定义。

## apps/edu/app/affairs/relations/page.tsx
无问题（re-export）。

## apps/edu/app/affairs/scheduling/_components/affairs-config-import-dialog.tsx
- [P2][数据丢失] affairs-config-import-dialog.tsx:30 — `importExcel('affairs-config' as any, files[0])` 只导入第一个文件；导入向导允许选择多文件时其余文件被静默忽略。最佳实践：限制单选，或在多文件时逐个导入/提示。
- [P3][类型] affairs-config-import-dialog.tsx:23、30 — `'affairs-config' as any` 强转。最佳实践：给 importExportApi 的模板名补字面量类型。

## apps/edu/app/affairs/scheduling/_components/schedule-edit-dialog.tsx
- [P3][模式] schedule-edit-dialog.tsx:56-64 — render 期间 setState（adjust-state-during-render）模式可用，但每次 open 切换都会触发一次额外渲染；逻辑正确，仅提示可改用派生 state。
- [P3][校验] schedule-edit-dialog.tsx:197 — 保存仅校验班级非空，教师/场地可为空（"仅可修改班级、教师、场地"文案暗示必填），与 grid 弹窗的必填约束不一致。

## apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx
- [P3][守卫失效] schedule-grid-tab.tsx:53 — `const [savingQuick] = useState(false)` 未解构 setter，值恒为 false；`handleCellClick` 顶部 `if (savingQuick) return` 防重守卫永远不生效（快速双击可并发创建两条排课）。最佳实践：补 setter 或删除守卫；核心排课建议加提交中禁用。
- [P2][已承认] schedule-grid-tab.tsx:88-89 — TODO 注释已承认：排课列表 limit:200 前端过滤场地，超 200 条时筛选结果不完整。建议尽快改服务端筛选（保留记录不重复）。
- [P3][loading] schedule-grid-tab.tsx:121-124 — `reloadAll` 无加载指示，排课/移动后网格无刷新反馈。

## apps/edu/app/affairs/scheduling/_components/schedule-import-bar.tsx
- [P2][错误被吞] schedule-import-bar.tsx:52-60 — `handleDownloadTemplate` 在 `!res.ok` 时直接 throw，而 onClick 直接绑定该函数无 try/catch：下载模板失败产生 unhandled promise rejection，用户无任何提示。最佳实践：包一层 catch 弹 toast。

## apps/edu/app/affairs/scheduling/_components/timetable-view-tab.tsx
- [P3][兜底] timetable-view-tab.tsx:207 — `term.weeksCount || 16` 兜底，正常。
- [P3][体验] timetable-view-tab.tsx:185-197 — 教师下拉未加载时 placeholder 提示「加载中」，可选。

## apps/edu/app/affairs/scheduling/_components/venue-period-config-tab.tsx
- [P3][数据] venue-period-config-tab.tsx:645-648 — 节次名称模板（`早自习 ${i}` 等）硬编码中文生成数据值，落库后按名称被排课/导入引用，切换英文环境时名称不变（可接受，仅提示）。
- [P3][key] venue-period-config-tab.tsx:858 — 预览行 `key={row.name}`，若 deriveSettings 反推出的名称重复（异常数据），React key 冲突；保存前已校验重复，影响有限。

## apps/edu/app/affairs/scheduling/page.tsx
- [P2][loading 缺失] scheduling/page.tsx:39、62 — `const [, setLoadingPlan] = useState(false)` 把加载状态丢弃：切换教学计划后 planDetail 加载期间页面渲染 `step==='grid' && selectedPlan && planDetail` 为假，直接空白，无任何加载提示。最佳实践：保留 loadingPlan 并渲染加载占位。
- [P2][伪造数据] scheduling/page.tsx:173-187 — 用 `as any` 伪造 term 对象传给 TimetableViewTab（startDate/endDate 为空串、weeksCount:0）；若 selectedPlan.termId 为空，timetable 请求携带 `termId=''` 发起无效请求；且 weeksCount 为 0 时依赖 `|| 16` 兜底。最佳实践：从后端按 termId 真实加载学期数据。
- [P3][类型] scheduling/page.tsx:184 — `as any`。

## apps/edu/app/affairs/students/page.tsx
无问题（re-export）。

## apps/edu/app/affairs/teachers/page.tsx
无问题（re-export）。

## apps/edu/app/affairs/teaching-plans/_components/generate-plan-dialog.tsx
- [P3][模式] generate-plan-dialog.tsx:42-49 — render 期 setState 重置表单（React 官方允许的模式），逻辑正确。

## apps/edu/app/affairs/teaching-plans/[id]/_components/entry-type-badge.tsx
无问题。

## apps/edu/app/affairs/teaching-plans/[id]/page.tsx
- [P1][状态/数据一致性] teaching-plans/[id]/page.tsx:121-135 + 144-151 — 教师变更在编辑状态下通过 `updateTeacherId` 即时落库，但 `handleSaveAll` 的 payload（144-151）不含 teacherId：(1) 若即时保存失败，toast 提示「请通过保存修改重新提交」，而保存修改根本不提交 teacherId，用户按提示操作也无法保存——错误指引且无有效重试路径；(2) 用户改完教师后点「取消编辑」，已落库的教师变更不会回滚，取消语义被破坏（数据与界面状态不一致）。最佳实践：把 teacherId 纳入编辑态 editMap 由「保存修改」统一提交（saveAll 全量覆盖），取消时丢弃。
- [P1][静默失败] teaching-plans/[id]/page.tsx:137-162 — `handleSaveAll` 逐条 try/catch 且 catch 为 `/* skip failed */`：失败条目静默跳过，随后清空 editMap 并 toast「保存完成：n/m 项」——用户不知道哪几条失败，且编辑态已清空无法重试（数据可能已部分丢失）。最佳实践：收集失败条目，toast 明确列出失败条目并保留其 editMap 状态供重试。
- [P2][状态不一致] teaching-plans/[id]/page.tsx:175-181 — `teachingPlanApi.submit` 成功后 `approvalApi.create` 失败：教学计划已提交但审批记录缺失，且无补偿逻辑（仅报错）。最佳实践：先创建审批记录再 submit，或失败时提示可重试且 submit 具备幂等。

## apps/edu/app/affairs/teaching-plans/page.tsx
- [P3][类型] teaching-plans/page.tsx:18、85 — `mapPlan(backend: any)`、`renderList(props: any)` 全 any。

## apps/edu/app/affairs/workflows/page.tsx
无问题（薄封装页）。

## apps/edu/app/changelog/page.tsx
无问题（纯服务端渲染 markdown 子集）。

## apps/edu/app/dashboard/layout.tsx
无问题。

## apps/edu/app/error.tsx
无问题。

## apps/edu/app/evaluation/approvals/page.tsx
- [P3][一致性] evaluation/approvals/page.tsx:12 — 直接 `import { toast } from '@zhiyu/ui'`，而 affairs/approvals 同类型页面用 `useToast()` hook；若 toast 是全局单例则功能正常，但风格不一致。最佳实践：统一 useToast()。
- [P3][性能] evaluation/approvals/page.tsx:62-64 — `limit: 1000` 全量拉题库/试卷/批次。

## apps/edu/app/evaluation/batches/page.tsx
无问题。

## apps/edu/app/evaluation/exams/[id]/page.tsx
- [P1][静默失败/数据丢失] exams/[id]/page.tsx:108-125 — `commitScore` 用 `updateExamQuestionScore(...).finally(...)` 无 catch：后端失败时（4xx/5xx/网络）产生 unhandled promise rejection，且 finally 中照样把 `editScores` 对应条目删除——用户输入的分值静默丢失，无任何错误提示。最佳实践：`.then(onSuccess).catch(err => { toast; 保留 editScores 供重试 })`。
- [P2][重试不可行] exams/[id]/page.tsx:77、80-84 — `triedReload` ref 一次性标记：首次加载失败（网络/后端异常）后不再重试，页面停在「试卷不存在」引导用户返回，误杀可恢复场景。最佳实践：区分「确实不存在(404)」与「加载失败(其他)」，后者允许重试。
- [P2][静默失败] exams/[id]/page.tsx:186-190 — `handleCreateQuestion` 在 `draftPoolBank` 缺失时静默 return（无提示）；且 `createQuestion` 成功但 `addQuestionToExam` 失败时会留下草稿库孤儿题目。最佳实践：无草稿库时提示；addQuestion 失败时提示并允许手动恢复。
- [P2][逻辑缺陷] exams/[id]/page.tsx:235-246 — `handleEvenDistribution` 当题目数 >100 时 `base = Math.floor(100/n) = 0`，前 100 题各 1 分、其余题 0 分，总分虽为 100 但大量题目得 0 分。最佳实践：题目数超过 100 时提示无法均匀分配。
- [P3][权限] exams/[id]/page.tsx:172-173 — `canEdit` 含 `'published'/'archived'`：已发布/归档试卷仍可编辑题目与分值（后端如允许则发布语义弱化）。最佳实践：已发布仅可查看，变更走新版本。

## apps/edu/app/evaluation/exams/page.tsx
- [P2][性能] exams/page.tsx:100、135 — `mapExamItem` 依赖 `backend.questions` 计数，而后端 ListExams 对列表内每份试卷批量填充全量题目（backend/internal/service/evaluation_exam.go:21 BatchFetchExamQuestions），配合 list limit 大时一次返回数千题目对象。最佳实践：后端列表接口增加 question_count 聚合字段，前端不再依赖 questions 数组。
- [P3][契约] exams/page.tsx:41 — `creatorId: backend.creatorId ?? undefined`：已核实后端列表返回 creator_id（store/exams.go:299 examListSelectColumns），契约一致，无需处理。

## apps/edu/app/evaluation/exam-usage/page.tsx
- [P1][数据破坏] exam-usage/page.tsx:200-209 — 创建与编辑共用 payload 且无条件发送 `targetType: 'class' as const` + `targetIds: formClassIds`；后端 Update 直接覆盖 TargetType/TargetIDs（backend/internal/handler/exam_usage_handler.go:100-111 UpdateFn），且 manualOnly 允许 class/major/department/public 四种类型编辑（handler:167-170）。因此编辑一条 targetType 为 major/department/public 的手动考试安排后，目标类型被改写为 class、目标对象被替换为班级——原配置被破坏且不可恢复。最佳实践：编辑模式不发送 targetType/targetIds（后端保留原值），或编辑时按原类型回填并发送原值。
- [P2][错误被吞] exam-usage/page.tsx:223-227、230-248、255-265 — 创建/发布/停止/删除失败仅 `reportError`，无用户可见提示（部分错误被吞）。最佳实践：失败统一 toast。
- [P3][重复代码] exam-usage/page.tsx:100-121 — `loadUsages` 与 useEffect 内联 load 重复两份相同逻辑。最佳实践：effect 直接复用 loadUsages（或 useCallback）。

## apps/edu/app/evaluation/exam-usage/results/page.tsx
- [P2][字段语义错位] exam-usage/results/page.tsx:79 — `majorId: r.majorName || '-'`：把专业名称塞进 majorId 字段，309 行 `majorMap.get(result.majorId) || result.majorId` 靠 map 未命中兜底才侥幸显示正确；一旦 majorMap 恰好存在同名字段则展示错误映射。最佳实践：接口补真实 majorId 字段，或前端直接使用 majorName。
- [P2][错误误导] exam-usage/results/page.tsx:66-68、126-138 — usage 与 results 任一请求失败都被 catch 成 null/空：网络故障时页面显示「考试记录不存在」误导用户；results 失败时静默显示空表。最佳实践：区分网络错误与 404，失败时提示并保留可重试入口。
- [P3][语义] exam-usage/results/page.tsx:85 — `rank: idx + 1` 只是数组下标，未按分数排序，标为「排名」有误导。最佳实践：按分数降序后编号或改名为序号。
- [P3][边界] exam-usage/results/page.tsx:324 — `totalScore` 为 0 时进度条宽度计算 `(score/0)*100%` 为 NaN。最佳实践：`totalScore > 0` 条件渲染。
- [P3][死按钮] exam-usage/results/page.tsx:354-358 — 「查看详情」按钮无 onClick 无跳转。最佳实践：接明细路由或移除。

## apps/edu/app/evaluation/job-ability/config/[id]/_components/level-config-dialog.tsx
- [P3][i18n] level-config-dialog.tsx:106、109 — 校验错误文案硬编码中文（作为 i18n key 使用，zh 环境正常）。

## apps/edu/app/evaluation/job-ability/config/[id]/_components/position-weight-config.tsx
- [P3][性能] position-weight-config.tsx:66 — 加载期 Promise.all 两个请求，正常。
- [P3][重复校验] position-weight-config.tsx:118-142 — 权重校验逻辑清晰，无问题。

## apps/edu/app/evaluation/job-ability/config/[id]/_components/weight-config-dialog.tsx
- [P3][文案] weight-config-dialog.tsx:127 — `'✓'` 与 `t('（必须为 100%）')` 拼接，英文环境会混排，可接受。

## apps/edu/app/evaluation/job-ability/config/[id]/page.tsx
无问题（async server component 传参给 client 组件，模式正确）。

## apps/edu/app/evaluation/job-ability/page.tsx
- [P3][性能] job-ability/page.tsx:58-67 — 对每条规则并发请求一个 getPositionModel（N 个网络请求），规则多时首屏慢。最佳实践：后端提供批量计数接口。

## apps/edu/app/evaluation/job-ability/results/page.tsx
- [P3][展示] job-ability/results/page.tsx:292 — `(item.avgRate ?? 0).toFixed(1)`：数据缺失时显示 0.0% 误导。最佳实践：null 时显示 '-'。
- [P3][边界] job-ability/results/page.tsx:384 — 达成率 `(achieved/total*100).toFixed(0)` 无上限钳制（异常数据可超 100%）。
- 轮询竞态（pollGeneration 代际校验 + 定时器清理）实现正确，无问题。

## apps/edu/app/evaluation/landing/banks/[id]/page.tsx
- [P2][性能] banks/[id]/page.tsx:121 — `questionApi.list({ bankId: id, limit: 10000 } as any)`：全量拉取并一次性渲染全部题目（无分页/虚拟化），大题库（上千题）首屏卡顿。最佳实践：服务端分页/加载更多。
- [P3][边界] banks/[id]/page.tsx:125 — knowledgeApi `limit: 1000`，知识点超过 1000 时列表显示原始 id。最佳实践：仅对命中题目所需的知识点做查询。
- [P3][类型] banks/[id]/page.tsx:47 — `React.ComponentType<any>`。

## apps/edu/app/evaluation/landing/exam-center/page.tsx
- [P2][权限判断不可靠] exam-center/page.tsx:44 — `isStudent` 由 `items[0]?.studentView` 推断，列表为空时默认按学生视图渲染「我可参加」页签；基于数据而非真实角色/权限。最佳实践：由 auth 上下文或后端接口提供角色标识。
- [P2][性能] exam-center/page.tsx:32-41 — 为拿封面 `examApi.list({status:'published', limit:1000})`，后端列表会填充每份试卷全量题目（见 evaluation_exam.go ListExams），浪费严重；失败时 `catch(() => {})` 完全静默。最佳实践：后端提供轻量 cover 映射接口。

## apps/edu/app/evaluation/landing/exams/[id]/page.tsx
- [P1][逻辑 bug] exams/[id]/page.tsx:484-491 — 判断题（judge）被渲染为自由文本 Textarea，而评分按标准答案精确匹配（答案格式 'true'/'false'）：学生几乎不可能通过自由输入命中答案，判断题形同虚设。最佳实践：判断题渲染为「正确/错误」单选，提交 'true'/'false'。
- [P2][死状态] exams/[id]/page.tsx:84 — `const [, setUsages]` 只写不读（effect 里 setUsages 从未被使用）。最佳实践：删除该状态。
- [P3][文案失真] exams/[id]/page.tsx:846 — 须知文案「考试期间系统将自动保存答题进度」与实际（无自动保存，无防刷新恢复）不符。最佳实践：删除或实现草稿保存。
- [P3][交互] exams/[id]/page.tsx:495-505 — 提交无确认弹窗，误点「提交试卷」即交卷无法撤销。最佳实践：提交前弹确认。

## apps/edu/app/evaluation/landing/exams/page.tsx
无问题（redirect 服务端组件）。

## apps/edu/app/evaluation/landing/layout.tsx
无问题。

## apps/edu/app/evaluation/landing/page.tsx
- [P2][错误被吞] landing/page.tsx:150-151 — 首页 4 个 `limit: 1000` 请求整体 try/catch 后 `// ignore` 完全静默：加载失败时页面呈现空态，用户无任何错误提示。最佳实践：失败时 toast/重试入口。
- [P3][性能] landing/page.tsx:137-140 — 题库/试卷各 limit:1000 全量拉取（且试卷列表带全量题目，同 exam-center 问题）。最佳实践：接口瘦身。
- [P3][死参数] landing/page.tsx:25、72、514、541 — BankCard/ExamCard 的 `index` prop 传入未使用。
- [P3][注入面] landing/page.tsx:36-39、82-88 — `coverImage` 直接拼接进 `backgroundImage: url('...')`，含引号字符的 URL 可破坏样式上下文（管理端可控数据，低危）。最佳实践：先校验/转义。

## apps/edu/app/evaluation/layout.tsx
无问题。

## apps/edu/app/evaluation/lesson-results/daily-exams/page.tsx
- [P2][请求风暴] daily-exams/page.tsx:53-67 — 对每个考试安排并发发一个 results 请求（`Promise.all`，limit 500 个 usage 时产生 500 个并发请求）。最佳实践：后端聚合统计接口或分页 + 按需加载。
- [P2][串数据] daily-exams/page.tsx:77-83 — 切换左侧考试安排时未清空 `results` 也无 loading 指示：新数据返回前短暂展示上一个考试的学生记录。最佳实践：请求前清空或按 selectedUsageId 过滤渲染。
- [P3][错误被吞] daily-exams/page.tsx:69-71、82 — 加载失败静默（`/* ignore */`、`setResults([])`）。最佳实践：失败提示。

## apps/edu/app/evaluation/lesson-results/daily-exams/[resultId]/page.tsx
- [P3][只读语义] daily-exams/[resultId]/page.tsx:61、348 — 已评分记录 `setSaved(true)` 后整体禁用，无法复核修改（可能是有意设计，提示确认）。
- [P3][细节] daily-exams/[resultId]/page.tsx:31-34 — getInitials 取前 2 字符，正常。

## apps/edu/app/evaluation/lesson-results/[id]/page.tsx
- [P3][i18n] lesson-results/[id]/page.tsx:186、326 — `toLocaleString('zh-CN')` 硬编码区域格式。最佳实践：随 locale 切换。
- [P3][边界] lesson-results/[id]/page.tsx:200 — pending 状态显示 `result.totalScore ?? 0` 作为「客观题自动得分」，若 totalScore 为 null 显示 0 分（无得分来源提示），可接受。

## apps/edu/app/evaluation/lesson-results/page.tsx
- [P3][性能] lesson-results/page.tsx:81-83 — courseApi/userManagementApi `limit: 1000` 全量拉取。最佳实践：按需分页。
- 其余逻辑（分组/展开/评分入口）无问题。

## apps/edu/app/evaluation/question-banks/[id]/page.tsx
- [P2][数据丢失] question-banks/[id]/page.tsx:199-240 — `executeImport` 只取 `importFiles[0]`：向导允许多选文件（importFiles 数组），其余文件被静默忽略。最佳实践：限制单选或逐个导入。
- [P2][失败误报成功] question-banks/[id]/page.tsx:257 — `executeImport('skip').then(() => true)`：executeImport 内部 catch 后不 rethrow，这里无条件返回 true，导入失败时向导仍按「成功」关闭（虽有错误 toast）。最佳实践：executeImport 返回 boolean 失败标志。
- [P3][批量静默] question-banks/[id]/page.tsx:329-335、337-354、379-383 — 批量删除/复制/移动循环调用 store 方法，无结果统计，失败静默。最佳实践：Promise.allSettled + 统计提示。
- [P3][i18n] question-banks/[id]/page.tsx:341、389 — 复制题目内容追加 `' (复制)'` 硬编码中文后缀。

## apps/edu/app/evaluation/scene-results/[id]/page.tsx
- [P2][按钮无效] scene-results/[id]/page.tsx:1266-1273 — 「全部展开/收起」仅切换 `allExpanded` 布尔值，该值未传给 QuestionGradingCard（卡片内部自持展开状态），点击除文案变化外无实际效果。最佳实践：将展开状态受控提升或删除该按钮。
- [P3][重挂载] scene-results/[id]/page.tsx:873 — `key={`${q.id}-${oralAnswers[q.id] || ''}`}`：口头回答失焦提交后卡片重挂载，输入焦点丢失、滚动位置跳动。最佳实践：key 只用 q.id。
- [P3][随机性] scene-results/[id]/page.tsx:850 — `sort(() => Math.random() - 0.5)` 洗牌非均匀，现场抽题随机性偏差可接受。

## apps/edu/app/evaluation/scene-results/page.tsx
- [P2][状态重置] scene-results/page.tsx:293 — `TaskMethodTabs` 定义在 `GradingPageContent` 组件内部：每次父组件渲染（展开/收起任务、切换场景、搜索）都会创建新组件类型，其内部 `activeMethod` 状态全部重置回第一个方法。最佳实践：把 TaskMethodTabs 提升为顶层组件。
- [P3][死代码] scene-results/page.tsx:91 — `const [, setPositionMap]` 只写不读（实际逻辑用局部 pMap，行 106-108）。最佳实践：删除该状态。
- [P3][性能] scene-results/page.tsx:103 — `taskApi.list({ limit: 10000 })` 全量拉取。最佳实践：仅拉取涉及场景的 task 或服务端过滤。

## apps/edu/app/evaluation/workflows/page.tsx
无问题（薄封装页）。

## apps/edu/app/global-error.tsx
无问题（自渲染 html/body 模式正确，locale 读取容错完整）。

## apps/edu/app/job/approvals/page.tsx
- [P3][类型] job/approvals/page.tsx:29 — `history?: any[]`。
- 审批/映射逻辑复用 useApprovals，无问题。

## apps/edu/app/job/archive/page.tsx
- [P2][批量删除部分失败] job/archive/page.tsx:126 — `Promise.all(batchDeleteTarget.map(...))`：任一删除失败整体抛错，已删除部分不统计、不刷新（对比 104-117 行批量恢复用 allSettled + 失败统计，风格不一致）。最佳实践：改用 Promise.allSettled 并展示成功/失败数量。

## apps/edu/app/job/batches/page.tsx
无问题。

## apps/edu/app/job/landing/[id]/learn/page.tsx
- [P2][部分失败全清空] job/landing/[id]/learn/page.tsx:57-68 — 场景列表成功后任一场景的 `taskApi.list` 失败会触发整链 Promise.all reject，catch 里把已成功加载的 `scenarios` 也清空（详情页 job/landing/[id]/page.tsx:119-128 已做逐任务容错，此页未同步）。最佳实践：逐任务 try/catch 保留已加载数据。

## apps/edu/app/job/landing/[id]/page.tsx
- [P2][权限/数据不一致] job/landing/[id]/page.tsx:137-156 + 202-212 — 职责/证书/能力/图谱 5 个请求捆绑在 `Promise.all` 且仅登录后执行：任一失败则 5 类数据全不设置；同时「岗位职责」（203-209）与「涉及证书」（211-212）页签未做登录判断（ability/competency/graph 有 LoginPrompt），未登录用户进入这两个页签看到空白而非登录提示。最佳实践：请求间失败隔离 + duties/certs 页签同样加未登录提示。
- [P3][性能] job/landing/[id]/page.tsx:142 — `abilityApi.list({ limit: 1000 })` 全量能力点。

## apps/edu/app/job/landing/layout.tsx
无问题。

## apps/edu/app/job/landing/page.tsx
无问题（薄封装页）。
