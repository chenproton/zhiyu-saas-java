# 前端 app 批次4 审查（56文件，18883行）

## P1
```
apps/edu/app/portal/apps/system/resource/package/page.tsx:112-116 | P1 | 逻辑bug | onRetry 只 setLoading(true)/setError(null)/setSubscription(null)，不重新发起请求（fetch 在 useEffect 且依赖不含触发源），错误态点击重试后永久 loading | 请求封装为可重复调用回调
apps/edu/app/portal/workspace/_components/teacher-courses-tab.tsx:720-728 + 791-800 | P1 | 数据一致性 | 课程类型标签"混合课程/实践场景"按数组 index%2 交替生成，与后端数据无关，3 门混合课也会被标成"实践场景" | 依据 plan.courseId/scenarioId 判断 isHybrid
apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:302 + 813-831 | P1 | 数据一致性 | 任务权重既未写入后端（payload 不含 weight），页面加载时又统一重算 Math.floor(100/count)，用户配置的权重（含锁定）刷新后全部丢失 | 后端增加权重字段持久化
apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:322 | P1 | 稳定性 | 主加载 effect 依赖 user?.id/toast：auth 未就绪先跑一次，user 就绪后再跑第二次，第二次 setTaskStates 覆盖用户已做的编辑 | 拆分 effect 或用 ref 防重复初始化
apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:1611-1624 | P1 | 数据一致性 | evaluationRules 保存时用旧 state 快照调用 taskStateToMethodsInput（reviewSteps 尚未生效），本次评审步骤修改在首次即时保存中丢失 | 用合并后的 state 再计算 methodsInput
```

## P2（摘要）
```
apps/edu/app/portal/apps/system/tenant/page.tsx:269-271 | P2 | 错误处理 | PortalCrudPage 的 error 写死 error={null}，fetchTenant 失败后 setError 但页面永不展示，onRetry 无法触发 | 传入真实 error 状态
apps/edu/app/portal/workspace/_components/dashboard-tab.tsx:92 / assessment-tab.tsx:164 / teacher-dashboard-tab.tsx:145 | P2 | 稳定性 | const Icon = typeIconMap[item.type] 无兜底，未枚举 type 时 <Icon/> 报错整页崩溃 | 提供默认图标兜底
apps/edu/app/scene/landing/[id]/learn/page.tsx:267-276 | P2 | 异步竞态 | myResults 按 activeTaskId 请求无 cancelled/序号防护，快速切换任务旧响应覆盖新结果 | AbortController 或请求序号
apps/edu/app/scene/landing/[id]/learn/page.tsx:1040-1065 | P2 | 错误处理 | EvalMethodSubmitDialog handleSubmit catch 完全吞错（/* ignore */），提交失败用户无提示；1022-1034 文件上传同样静默失败 | 失败 toast 并保留表单
apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:1559-1577 | P2 | 逻辑bug | toTaskEvalPoint 中 maxScore: ep.weight || gmMax：weight>0 时满分被写成权重值 | maxScore 应取配置满分
apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:832 | P2 | 逻辑bug | 用 t.id.startsWith('task-') 判定克隆临时任务，后端真实任务 id 以 task- 开头会被误判重复 create | 用独立前缀+已创建集合
apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:1643 | P2 | 错误处理 | ensureTempExam 创建失败 catch 静默，保存"成功"但试卷未创建 | 失败 toast 提示
apps/edu/app/scene/landing/[id]/learn/page.tsx:217-232 + 1049 | P2 | 数据一致性 | 全量拉取资源 limit:10000；提交时 maxScore:100 硬编码 | 按需分页；从 method/config 取 maxScore
apps/edu/app/scene/landing/[id]/page.tsx:386 / learn/page.tsx:189 | P2 | 错误处理 | scenario fetch catch 一律 setScenario(null) 显示"场景不存在"，网络错误与真不存在混淆 | 区分 error 与 not-found
apps/edu/app/superadmin/page.tsx:233-246 | P2 | 性能 | 租户列表全量加载无分页 | 增加分页
apps/edu/app/scene/landing/[id]/page.tsx:397 | P2 | 性能/数据缺失 | 任务/知识点/能力点 limit:200 会被后端上限截断 | 服务端分页或按需拉取
apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx:111-119 + 79-96 | P2 | 功能未完成 | buildCourseGroups 中 students 恒为 []、pending/gradedCount 恒 0，右侧学生列表永远为空；查看/评分按钮无 onClick；dialog 关闭时也请求 | 接入真实学生数据接口
apps/edu/app/portal/workspace/page.tsx:334-341 | P2 | 性能 | teacher/school_admin 多个 tab 各自重复调用 workspaceDashboard | 提升请求到页面级共享
apps/edu/app/portal/workspace/_components/workspace-schedule-grid.tsx:503 + 556 | P2 | 逻辑bug | MonthView 仅按 dayOfWeek 匹配；YearView 用 dayOfWeek % 4 === m % 4 伪随机分配月份 | MonthView 按 date 归属；YearView 按真实月份聚合
```

## P3（摘要）
```
apps/edu/app/portal/apps/system/resource/majors/page.tsx:30,154 | P3 | 性能/校验 | limit:1000 全量拉取；名称空校验静默 return 无提示 | 分页/加 toast
apps/edu/app/portal/apps/system/resource/package/page.tsx:25 | P3 | 类型安全 | Record<string, any> | 强类型
apps/edu/app/portal/apps/system/tenant/page.tsx:85-92,133,560,161-162 | P3 | 类型/逻辑 | 8 处 as any；icon:any；无省份静默默认北京/东城区 | 补类型/空态
apps/edu/app/portal/login/page.tsx:78,102,261 | P3 | 类型/安全 | catch(err:any)；租户选择列表展示 tenantId | Error 类型/隐藏
apps/edu/app/portal/apps/system/tenant/_components/school-admin-manager.tsx:120 | P3 | 安全 | toast 明文展示初始密码 | 仅弹窗展示
apps/edu/app/portal/workspace/_components/assessment-tab.tsx:56-57,195 | P3 | 错误处理/死代码 | catch 吞错置空数组；多个按钮无 onClick | 增加错误态/接跳转
apps/edu/app/portal/workspace/_components/career-tab.tsx / community-tab.tsx / profile-tab.tsx / teacher-profile-tab.tsx | P3 | 死代码 | 全量 mock/静态数据渲染，无真实 API | 接后端
apps/edu/app/portal/workspace/_components/dashboard-tab.tsx:50-66 | P3 | 稳定性 | effect 无 cancelled 防护、无 loading 态 | 加取消标记
apps/edu/app/portal/workspace/_components/grading-iframe-dialog.tsx:53-58 | P3 | 稳定性/安全 | iframe onLoad 不触发 loading 永久；无 sandbox | 加 onError 兜底与 sandbox
apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx:78 | P3 | 类型 | s.courseId === plan.id 依赖字段约定 | 核对后端字段
apps/edu/app/portal/workspace/_components/learning-tab.tsx:26 / assessment-tab.tsx:54 | P3 | 逻辑 | 硬编码 role:'student' | 由 props 传入
apps/edu/app/portal/workspace/_components/learning-tab.tsx:90-105 | P3 | 死代码 | StatCard 数值写死（86h/12/5门）| 从后端取
apps/edu/app/portal/workspace/_components/my-schedule-tab.tsx:33 | P3 | 类型安全 | catch(err:any) | Error
apps/edu/app/portal/workspace/_components/portrait-tab.tsx:4-9 | P3 | 安全 | iframe 携带 userId，需确认静态页鉴权（IDOR 风险点）| 核实鉴权
apps/edu/app/portal/workspace/_components/prep-associate-dialog.tsx:39 | P3 | 数据一致性 | 数据源为 mock | 接 API
apps/edu/app/portal/workspace/_components/profile-tab.tsx:219 | P3 | 死代码 | item.status === 'strong' 永不成立 | 删除分支
apps/edu/app/portal/workspace/_components/teacher-profile-tab.tsx:106 | P3 | 逻辑 | 图标按数组下标取，与数据语义可能错配 | 结构体带 icon
apps/edu/app/portal/workspace/_components/school-admin-*-tab.tsx | P3 | 错误处理/loading | 均无 loading 态、catch 吞错无提示 | 加 loading/error
apps/edu/app/portal/workspace/_components/school-admin-resources-tab.tsx:103 | P3 | 类型安全 | g[item.key as keyof typeof g] as number | 判空兜底
apps/edu/app/portal/workspace/_components/teacher-courses-tab.tsx:637,807,815 | P3 | 死代码/安全 | setPrepSessionLabels 只写不读；prepUrl 硬编码同一地址 | 按真实数据拼 URL
apps/edu/app/portal/workspace/_components/teacher-dashboard-tab.tsx:96,106,331,337,413-425 | P3 | 类型/逻辑 | schedule as 强转；openActionDialog 用 title+className 匹配 plan，失败 students=0 | 用 id 关联
apps/edu/app/portal/workspace/_components/workspace-schedule-grid.tsx:358-366 | P3 | 死代码 | "查看测评结果"按钮 disabled 且无后续 | 接跳转或移除
apps/edu/app/portal/workspace/_components/workspace-schedule-grid.tsx / teacher-dashboard-tab.tsx | P3 | 重复代码 | allPeriods/days/getWeekStart 多处重复定义 | 抽公共 util
apps/edu/app/portal/workspace/page.tsx:403,86-92,460-463,706-727 | P3 | 死代码 | 欢迎语写死"张老师"；securityItems/weeklyData/monthlyTrend/resourceUsage/contacts 恒空数组 | 接数据或移除
apps/edu/app/scene/approvals/page.tsx:28,102-103 | P3 | 类型安全 | history?: any[] | 强类型
apps/edu/app/scene/archive/page.tsx:127 | P3 | 一致性 | 批量删除用 Promise.all，失败无部分失败提示（与 handleBatchRestore 的 allSettled 不一致）| 统一 allSettled
apps/edu/app/scene/page.tsx:9-11,50 | P3 | 逻辑/类型 | generateCode 用 Math.random 生成编码有重码风险；scenarioApi as any | 后端生成/对齐接口
apps/edu/app/scene/landing/[id]/page.tsx:410,413-415,530-532,813 | P3 | 类型/安全 | as any；coverImage 拼 CSS url() 未编码可注入；creatorId.slice(0,8) 未判空 | 修正
apps/edu/app/scene/landing/[id]/learn/page.tsx:223,1044 | P3 | 类型安全 | (r:any)；payload:any | 强类型
apps/edu/app/scene/scenarios/[id]/edit/page.tsx:54,65,144 | P3 | 死代码/类型 | setUsers 只写不读；creatorName 写死"当前用户"；update as any | 修正
apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/hooks/use-task-datasets.ts:57-68,295 | P3 | 类型/性能 | unknown[] 反复强转；taskApi.list({limit:1000}) 无 scenarioId 全量拉 | 泛型/过滤
apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.tsx:181-182 | P3 | 类型安全 | Record<string,any>、any[] | 强类型
apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-description-card.tsx:148-163 | P3 | 死代码 | 富文本工具栏按钮无 onClick，与 Textarea 纯文本不符 | 接入或移除
apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card.tsx:78-81 | P3 | 逻辑 | 学时输入清空后 +''=0，无法保留空态 | 判空处理
apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:145,151-153,499,1048-1065,1369,1486,2269-2270,2396 | P3 | 死代码/逻辑 | setDataLoaded 等只写不读；TK-${Date.now().slice(-6)} 易冲突；拖拽乐观更新失败无回滚；tasks.find()!；selectedAbilityForDetail 无 setter；WeightConfigDialog 阻止关闭 | 修正
apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/repro.test.ts:61-65,78-82 | P3 | 代码质量 | 测试残留 console.log | 移除
```

## 无问题文件（12个）
scene/landing/layout、scene/landing/page、scene/layout、scene/batches、scene/workflows、superadmin/layout、workspace-student-types、workspace-teacher-types、change-password-form、stat-card、task-weight-card、tasks-logic.test

总行数 18883
