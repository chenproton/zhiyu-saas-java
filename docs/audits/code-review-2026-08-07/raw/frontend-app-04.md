# 前端代码审查 frontend-app-04（portal / workspace / scene / superadmin 页面）

审查日期：2026-08-08
审查范围：apps/edu/app/portal/**、apps/edu/app/scene/**、apps/edu/app/superadmin/**（共 58 个文件）
方法：逐行完整通读 + 关键点 grep 后端契约核实（routes.go / handler / api-client）

---

## apps/edu/app/portal/apps/system/resource/majors/page.tsx
- [P2][契约] majors/page.tsx:26 — `majorApi.list({ tenantId, limit: 1000 })` 依赖 `tenantId`，若 portal auth 尚未就绪则返回空列表且 `authLoading` 变化后依赖触发重拉，逻辑正确；但后端 `/majors` 列表接口若存在 maxPageSize 上限（<1000）会静默截断，专业数超限时列表不全。最佳实践：核实后端分页上限，超出时改用分页或搜索。
- [P3][契约] majors/page.tsx:111 — 编辑时 code 输入框 `disabled={!!item.id}` 与后端约定一致（code 不可改），无问题。
- [P2][状态] majors/page.tsx:29 — `useAsync` 的 `onError: () => true` 吞掉错误仅显示空表，未暴露错误信息；结合 `error?.message ?? null` 传入页面，实际 onError 返回 true 时 error 可能被重置。最佳实践：onError 返回 false 或直接展示 error。

## apps/edu/app/portal/apps/system/resource/package/page.tsx
- [P3][逻辑] package/page.tsx:29-31 — `buildPackageModules` 仅列出订阅中显式为 true 的模块，未开通模块（key 缺失）不会展示为「未开通」，与页面渲染的「未开通」徽标逻辑不符。最佳实践：遍历 `platformModuleDefs` 全量键，缺失视为未开通。
- [P3][状态] package/page.tsx:68-69 — 每次加载成功都会把展开状态重置为第一个模块，用户已展开/折叠的模块被复位。最佳实践：仅首次加载时初始化。
- [P3][冗余] package/page.tsx:51 — `reloadTick` 通过 onRetry 触发重拉，与 `setSubscription(null)` 双保险，可接受。

## apps/edu/app/portal/apps/system/tenant/_components/school-admin-manager.tsx
- [P1][契约] school-admin-manager.tsx:121-128 — 创建管理员后读取 `created.plainPassword`，但后端 `POST /admins`（tenant_handler.go CreateSchoolAdmin）返回的 `TenantAdmin` JSON 字段是 `newPassword`（store/tenant_admins.go:19 `json:"newPassword,omitempty"`），`plainPassword` 恒为 undefined，toast 永远显示「初始密码：」空白。新建账号的初始密码对管理员至关重要，属于信息丢失。最佳实践：改为 `created.newPassword`，或将后端统一为 plainPassword。
- [P3][竞态] school-admin-manager.tsx:79-87 — unmount 时 fetchAdmins 内的 setState 不受 cancelled 保护（cancelled 只挡了触发本身），组件卸载后 setLoading 等调用无实际影响（React 18 不告警），可容忍。
- [P3][类型] school-admin-manager.tsx:29-40 — TenantAdmin/ListResponse 与 @zhiyu/api-client 中类型重复定义。最佳实践：复用共享类型。

## apps/edu/app/portal/apps/system/tenant/page.tsx
- [P2][数据丢失] tenant/page.tsx:163-164 — `loadTenantToForm` 中省份不在 `CHINA_REGION` 键集合（如实际值为「内蒙古」而键为「内蒙」）时静默回退到 `PROVINCES[0]`（北京），城市为空时回退「东城区」；保存后会把租户真实省份/城市改写为北京，且无任何提示。最佳实践：回退仅作展示占位，保存前校验「未修改」字段不应提交兜底值。
- [P2][数据丢失] tenant/page.tsx:249-250 — `handleWebsiteChange` 输入框值即被前缀化（用户输入 `example.com` 立即显示 `https://example.com`），编辑时若用户想保留原始输入会被改写，但保存逻辑一致，可接受；风险在于用户粘贴带路径的 URL 会得到 `https://https://...` 的校验失败体验。最佳实践：仅在提交时归一化。
- [P3][展示] tenant/page.tsx:319 — `v={`${tenant.province} ${tenant.city}`}`，当 city 为 '-' 时显示「北京 -」；`F` 组件仅对 `'- -'` 显示 '-'。最佳实践：拼接前过滤 '-'。
- [P3][死代码] tenant/page.tsx:86-93 — `(t as any).shortName` 等 8 个 any 断言字段，BackendTenant 类型未收录这些字段。最佳实践：扩展共享类型。
- [P3][类型] tenant/page.tsx:134 — `icon: any`。最佳实践：使用 LucideIcon。

## apps/edu/app/portal/layout.tsx
- [P2][权限] portal/layout.tsx:28-36 — 工作台守卫只放行 teacher/student/school_admin，但企业导师（enterprise_mentor）被重定向到 /portal；而 workspace/page.tsx:357-359 明确为 enterprise_mentor 保留了兜底视图并拉取 dashboard，两者矛盾：enterprise_mentor 永远无法访问工作台。最佳实践：守卫放行 enterprise_mentor 或删除 workspace 中的对应分支。
- [P3][体验] portal/layout.tsx:39-41 — 未认证时仍渲染 children（依赖 effect 重定向），首屏可能闪现受保护内容再跳登录页。属已知权衡（注释已说明），可接受。

## apps/edu/app/portal/login/page.tsx
- [P2][状态] login/page.tsx:52-58 — `doLogin` 先 `setToken` 再 `refresh()`/`portalMe()`；若 portalMe 失败（如 token 立即失效），catch 显示错误但本地已写入失效 token，用户停留在登录页但后续请求全部带坏 token。最佳实践：先验证成功再 setToken。
- [P2][错误处理] login/page.tsx:88-91 — `err.message` 直接展示，若后端返回非 Error（如网络层字符串）可能显示 undefined。最佳实践：`err instanceof Error ? err.message : ...`。
- [P3][安全] login/page.tsx:207-218 — 开发环境硬编码测试账号提示，仅 NODE_ENV !== 'production' 展示，可接受。

## apps/edu/app/portal/page.tsx
- [P3][死代码] portal/page.tsx:70-121,287-300 — `platforms` 的 12 个平台项中部分 id（opc/decision/research/mall/ai/ability）未在 `INTERNAL_ROUTES` 映射，渲染为「暂未开放」锁定卡片，属产品设计占位。BENTO_LAYOUT 每行 4 张卡、row 恒为 '1'，`ROW_START_CLASS` 的 '2' 分支为死代码。可接受，P3。
- [P3][重复] portal/page.tsx:123-275 — 手写 SVG icon 映射与 lucide-react 图标体系重复。最佳实践：换用 lucide-react。

## apps/edu/app/portal/workspace/page.tsx
- [P2][假数据] workspace/page.tsx:344-355 — enterprise 角色兜底视图使用硬编码假统计（合作项目 5、实习学生 23、在线用户 1256、总用户 8500），虽注释说明「兜底空值」，但 `config.stats` 是默认值而非 0，会展示虚假数字。最佳实践：兜底用 0/'-'。
- [P3][死代码] workspace/page.tsx:70-78 — `securityItems`/`weeklyData`/`monthlyTrend`/`resourceUsage`/`contacts` 全部置空，对应 5 个卡片（安全中心/本周活跃度/学习数据统计/资源使用占比/通讯录）渲染为空壳。最佳实践：隐藏空数据卡片或接入真实接口。
- [P3][性能] workspace/page.tsx:487-490 — `generateCalendarDays` 与 calendarEvents 每渲染重新计算，无 memo；数据为空，影响可忽略。

## apps/edu/app/portal/workspace/_components/dashboard-tab.tsx
- [P2][竞态] dashboard-tab.tsx:53-69 — 请求无 cancelled 保护，角色切换（activeRoleCode 变化）时旧请求可能晚到覆盖新数据。最佳实践：加 cancelled 标志或 AbortController。
- [P3][样式] dashboard-tab.tsx:95 — `typeIconMap[item.type]` 未命中时 Icon 为 undefined 会渲染崩溃，但 WorkspaceTodo.type 类型限定 course/scene/exam/report 且映射齐全，风险低。可容忍。

## apps/edu/app/portal/workspace/_components/learning-tab.tsx
- [P2][假数据] learning-tab.tsx:102-127 — 4 个 StatCard 中「学习时长 86h」「本月 +12h」「本周完成任务 12」「较上周 +3」「本学期共 5 门」「2 个待完成」为硬编码假数据，与上方真实 API 数据并列展示，学生看到虚假统计。最佳实践：接入真实接口或显示 '-/--'。
- [P3][契约] learning-tab.tsx:30 — `portalApi.workspaceDashboard({ role: 'student' })` 依赖后端在 student 角色下返回 courses/sceneTasks 字段，已核对 handler 存在（portal_handler.go WorkspaceDashboard），无问题。

## apps/edu/app/portal/workspace/_components/career-tab.tsx
- [P2][错误吞掉] career-tab.tsx:275-299 — 两个收藏列表请求失败时 `.catch(() => null)` 静默降级为空收藏，用户无法区分「没有收藏」与「加载失败」。最佳实践：至少展示错误提示。
- [P2][乐观更新顺序] career-tab.tsx:308-327 — 先 await 接口成功再 removeFavorite，失败回滚天然正确；但 jobs 路径调用 `positionApi.favorite(id)`（后端为 toggle 语义，已核实 position_handler.go ToggleFavorite），单次调用即取消收藏，正确。无问题。
- [P3][冗余] career-tab.tsx:43-49 — `emptyFavorites` 常驻内存对象，setFavorites(emptyFavorites) 直接引用共享对象，若某处原地修改会串数据；当前无原地修改路径。可容忍。

## apps/edu/app/portal/workspace/_components/assessment-tab.tsx
- [P3][契约] assessment-tab.tsx:32-37 — `typeIconMap` 仅覆盖 4 种 type，后端新增类型（如「线上考试」）时 `<Icon/>` undefined 崩溃；当前类型全集已覆盖，风险低。可容忍。
- [P3][交互] assessment-tab.tsx:276-287 — examId 缺失时 href='#'，点击无反馈。可容忍。

## apps/edu/app/portal/workspace/_components/community-tab.tsx
- [P2][错误吞掉] community-tab.tsx:162-166 — `submitPost` 失败仅 `reportError` 无用户提示，用户点击发布后无任何反馈（弹窗保持打开，无 toast）。最佳实践：失败时 toast 提示。
- [P2][竞态] community-tab.tsx:89-106 — `loadTopics` 无 cancelled/序号保护，快速切换 sort 时旧响应可能覆盖新排序的列表。最佳实践：记录请求序号，仅应用最新。
- [P3][假数据] community-tab.tsx:40-51 — 学习小组/导师为保留的 mock 数据（注释已说明），「加入」按钮无 onClick，点击无反应。产品已知，可容忍。

## apps/edu/app/portal/workspace/_components/profile-tab.tsx
- [P2][错误吞掉] profile-tab.tsx:142-146 — `handleSave` catch 为空注释「保存失败保持弹窗」，用户保存失败时无任何提示，仅弹窗不关闭。最佳实践：toast 展示错误。
- [P2][错误吞掉] profile-tab.tsx:154-158 — `handleDelete` 失败静默忽略，列表无变化且无提示。最佳实践：失败 toast。
- [P3][假数据] profile-tab.tsx:161-169 — notifications 开关全部 disabled 静态值，通知偏好不可编辑属占位。产品已知。

## apps/edu/app/portal/workspace/_components/account-info-form.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/change-password-form.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/my-schedule-tab.tsx
- [P2][脆弱判定] my-schedule-tab.tsx:28-35 — 用「错误消息包含 '学期' 或 '404' 字符串」判断「未配置学期」，依赖后端文案，后端改文案后失效导致整页报错。最佳实践：后端用明确错误码（如 ERR_NO_TERM）或 404 状态码判定。
- [P3][契约] my-schedule-tab.tsx:42 — 教师场景课跳 `/evaluation/scene-results`（固定列表页，未定位到具体场景），体验粗糙但功能可用。

## apps/edu/app/portal/workspace/_components/portrait-tab.tsx
- [P3][架构] portrait-tab.tsx:8 — 直接 iframe 引用静态页 `/student_portrait.html`，与后端无契约，属占位集成。产品已知。

## apps/edu/app/portal/workspace/_components/grading-iframe-dialog.tsx
- [P3][架构] grading-iframe-dialog.tsx:16,56 — iframe 固定加载 `${SCENE_PLATFORM_URL}/approvals/grading`，无会话/课程参数传递，且该组件在教师工作台中实际未被引用（teacher-dashboard 用 HybridGradingDialog），疑似死组件。最佳实践：确认引用关系，无引用则删除。

## apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx
- [P1][必现死锁] hybrid-grading-dialog.tsx:86-115 — 当 `courseId` 为 undefined（teacher-dashboard-tab.tsx:249-254 打开此弹窗时未传 courseId）时，`if (courseId)` 分支不执行，`loading` 永不为 false，弹窗右侧永远显示「加载测评数据中...」转圈，用户无法操作。最佳实践：courseId 缺失时在 effect 内也执行 `setLoading(false)`，或调用方必传 courseId。
- [P1][数据错配] hybrid-grading-dialog.tsx:227-237 — 左侧课程列表可点击切换任意 plan，但节点/结果数据仅在 `courseId` 首次提供时加载一次；点击其他课程只改 `selectedPlanId`（仅影响标题显示），右侧 student/results 仍是第一个课程的数据，静默展示错误数据。最佳实践：选中课程变化时按该 plan 的 courseId 重新拉取 nodes/results/userMap。
- [P3][类型] hybrid-grading-dialog.tsx:83,103,109 — `Map<string, any>` / `as any[]`。最佳实践：定义 User 类型。
- [P3][契约] hybrid-grading-dialog.tsx:103 — `userManagementApi.list({ limit: 1000 })` 可能截断（后端 maxPageSize），学生不在前 1000 时显示「未知/-」。

## apps/edu/app/portal/workspace/_components/prep-associate-dialog.tsx
- [P3][假数据] prep-associate-dialog.tsx:45 — `hybridCourseSessions[planId] || []` / `scenarioTasks[planId] || []` 均来自空 mock（workspace-teacher-types.ts:118-120 为空对象），弹窗永远显示「暂无可用节次/任务」，关联功能不可用。产品已知（注释标注），但「确认关联」按钮在 selectedIds.size>0 时可用而 items 恒空导致永远点不了，应视为待接入真实 API。
- [P3][状态] prep-associate-dialog.tsx:46 — selectedIds 初始化自 props.currentSubItemIds，props 变化（如切换任务）时 useState 不更新，只有关闭弹窗时重置。当前每次打开前会重置，可容忍。

## apps/edu/app/portal/workspace/_components/section-card.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/stat-card.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/workspace-schedule-grid.tsx
- [P2][逻辑错误] workspace-schedule-grid.tsx:561 — YearView 用 `e.dayOfWeek % 4 === m % 4` 伪随机把事件分配到某个月份，展示的是错误数据（且 MonthView 里 weekStart 跨月时 weekIndex 可能为 0 或越界）。最佳实践：按 event.date 归属月份，无 date 事件不进入年视图或全部展示。
- [P2][逻辑] workspace-schedule-grid.tsx:507 — MonthView 用 `e.dayOfWeek === (index % 7 || 7)` 匹配「每周重复事件」，带 date 的单次事件会在当月所有同星期格重复出现。最佳实践：单次事件按日期精确匹配。
- [P3][契约] workspace-schedule-grid.tsx:27 — `allPeriods`/`days` 复用 mock 常量（'早自习 1' 等 10 节），与真实教务节次（可能不同名）不符；ScheduleEvent.period 若来自后端则匹配不上显示为空。待接入真实接口。

## apps/edu/app/portal/workspace/_data/workspace-student-types.ts
- [P3][死代码] 全文件 — 大部分 interface/mock 常量（mockStudentInfo、GradeRecord、Portrait 系列等）在当前组件集已无引用或仅被引用方注释提及，属于遗留类型库。建议清理或待未来接入。

## apps/edu/app/portal/workspace/_data/workspace-teacher-types.ts
- [P3][死代码] 全文件 — `hybridCourseSessions`/`scenarioTasks` 为空对象导致备课关联弹窗无数据（见 prep-associate-dialog），mock* 系列多为空数组。建议接入真实 API 后删除。

## apps/edu/app/portal/workspace/_components/teacher-dashboard-tab.tsx
- [P2][假链接] teacher-dashboard-tab.tsx:303,309 — 备课/导学 URL 硬编码 `/lesson/admin/hybrid/add?id=hybrid-1` 与 `${SCENE_PLATFORM_URL}/student_teacher.html?task=task-1-1`，所有课程/场景跳转同一假 ID，用户进入错误页面。最佳实践：按 session/plan 真实数据构造。
- [P1][联动] teacher-dashboard-tab.tsx:126-132 + hybrid-grading-dialog.tsx:86-115 — 此处打开 HybridGradingDialog 未传 courseId，直接触发上述「loading 永真」死锁。最佳实践：从 classPlans 中按 event 解析 courseId 传入。
- [P3][死代码] teacher-dashboard-tab.tsx:102 — `const [, setPrepSessionLabels]` 值从不读取。最佳实践：删除或改普通函数。

## apps/edu/app/portal/workspace/_components/teacher-courses-tab.tsx
- [P2][假链接] teacher-courses-tab.tsx:815,823 — 同 teacher-dashboard-tab：prepUrl 硬编码 `id=hybrid-1` / `task=task-1-1`。最佳实践：接真实 ID。
- [P2][假数据] teacher-courses-tab.tsx:91-280 — TrackingView/AssessmentView/FinalView 全部渲染 mock 空数据（0 人、0%、空表），但交互按钮（课程期末总评、教学进展、测评进展）可达，教师看到全零统计。产品已知（mock 标注），建议接入真实接口或隐藏入口。
- [P3][契约] teacher-courses-tab.tsx:884,888 — `sessions.filter((s) => s.status === 'associated')` 判「已上」，需与后端 WorkspaceClassSession.status 取值一致（已核对该字段存在，取值约定待确认）。
- [P3][脆弱] teacher-courses-tab.tsx:681 — `queueMicrotask` 里 setState，属规避 React 更新顺序的 hack，无副作用，可容忍。

## apps/edu/app/portal/workspace/_components/teacher-portraits-tab.tsx
- [P2][运行时风险] teacher-portraits-tab.tsx:426,470 — `student.achievementRate.toFixed(1)` 与 `activeStudent?.achievementRate.toFixed(1)`：achievementRate 若后端缺失为 undefined 时直接 TypeError 崩溃（可选链只保护 activeStudent 本身）。最佳实践：`(student.achievementRate ?? 0).toFixed(1)`。
- [P3][契约] teacher-portraits-tab.tsx:94 — `jobAbilityResultApi.list({ limit: 200 })` 截断风险，学生超过 200 人时列表不全。最佳实践：分页加载。

## apps/edu/app/portal/workspace/_components/teacher-profile-tab.tsx
- [P3][契约] teacher-profile-tab.tsx:110 — `teacherSecurityItems`（workspace-teacher-types.ts:230-235）为空数组，账号安全 tab 下半部分空渲染。产品已知。

## apps/edu/app/portal/workspace/_components/school-admin-overview-tab.tsx
- 无问题（extraResourceEntries 硬编码入口链接为产品设计）。

## apps/edu/app/portal/workspace/_components/school-admin-resources-tab.tsx
- [P3][契约] school-admin-resources-tab.tsx:104-107 — `g[item.key as keyof typeof g] as number` 当某资源类型无增长数据时 value 为 undefined，折线图数据断点。可容忍。

## apps/edu/app/portal/workspace/_components/school-admin-approvals-tab.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/school-admin-personnel-tab.tsx
- 无问题。

## apps/edu/app/scene/page.tsx
- [P2][展示] scene/page.tsx:26,28 — mapScenario 将 `positionName`、`creatorName` 硬编码为 '- '，场景大厅列表永远不显示岗位与创建人（后端实际有 professionNames/creatorId）。最佳实践：解析后端字段。
- [P3][类型] scene/page.tsx:16 — `backend: any`。最佳实践：使用 Scenario 类型。

## apps/edu/app/scene/approvals/page.tsx
- [P2][数据截断] scene/approvals/page.tsx:43 — `scenarioApi.list({ limit: 1000 })` 全量拉场景用于名称映射，若后端 maxPageSize 截断，未命中场景的审批记录显示原始 targetId。最佳实践：分页或按需 fetch。
- [P3][类型] scene/approvals/page.tsx:106 — `mapRecord(a: any)`。最佳实践：使用审批记录类型。

## apps/edu/app/scene/archive/page.tsx
- [P2][一致性] scene/archive/page.tsx:62,89 — 「恢复」调用 `scenarioApi.saveDraft` 恢复为草稿，与后端存档语义一致；但批量恢复 `Promise.allSettled` 后统一 refresh，部分失败时 toast 汇总正确。无问题。
- [P3][类型] scene/archive/page.tsx:65,79,113 — `(err: any)`。最佳实践：Error 类型。

## apps/edu/app/scene/batches/page.tsx
- 无问题。

## apps/edu/app/scene/landing/layout.tsx
- [P3][架构] landing/layout.tsx:1 — 整棵 layout 为 client component 且未接入 PortalAuthGuard 的登录校验，未登录用户可直接访问场景落地页；结合 landing 页面为公开展示页，可接受。

## apps/edu/app/scene/landing/page.tsx
- 无问题（server component 包装 client JobHome，模式正确）。

## apps/edu/app/scene/layout.tsx
- 无问题。

## apps/edu/app/scene/workflows/page.tsx
- 无问题。

## apps/edu/app/scene/landing/[id]/page.tsx
- [P2][数据截断] landing/[id]/page.tsx:407-420 — `resourceLibraryApi.list({ limit: 200 })`、`knowledgeApi/abilityApi.list({ limit: 200 })` 均有后端上限截断风险（代码内 TODO 已自述），任务引用超出列表范围的资源/能力点显示缺失。最佳实践：按需拉取或分页。
- [P2][竞态] landing/[id]/page.tsx:380-393 — 场景加载无 cancelled 保护，快速切换场景 id 时旧响应覆盖新场景。最佳实践：加 cancelled 标志。
- [P3][体验] landing/[id]/page.tsx:821 — 创建人显示 `creatorId.slice(0, 8)`（UUID 前 8 位）而非姓名。最佳实践：解析用户姓名。

## apps/edu/app/scene/landing/[id]/learn/page.tsx
- [P2][数据截断] learn/page.tsx:156 — `resourceLibraryApi.list({ limit: 10000 })`：后端若存在 maxPageSize 上限，无论传多少都会被截断，资源缺失且无提示。最佳实践：确认后端上限，改分页。
- [P2][错误吞掉] learn/page.tsx:324-335 — `handleSubmitMethod` 无 try/catch，`evaluationResultApi.submit` 失败时产生 unhandled rejection，用户无任何失败提示，且提交状态可能停留在 submitting。最佳实践：捕获并 toast，成功后刷新 myResults。
- [P3][契约] learn/page.tsx:315-321 — getExamHref 对 paper/question_bank/quiz 拼接 usageId，与 evaluation 落地页契约一致（已核对 api-client）。无问题。

## apps/edu/app/scene/scenarios/[id]/edit/page.tsx
- [P2][数据覆盖] edit/page.tsx:77-115 — 加载 effect 依赖 `[scenarioId, t]`，语言切换（t 变化）会导致整页表单重新加载并覆盖用户未保存的编辑内容。最佳实践：仅依赖 scenarioId。
- [P3][死代码] edit/page.tsx:67 — `creatorName` 初始化为 t('当前用户') 后从不更新，创建人恒显示「当前用户」。最佳实践：从 user 上下文取真实姓名。
- [P3][体验] edit/page.tsx:107-109 — 加载失败仅 toast，页面停留在空表单。可容忍。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/hooks/use-task-datasets.ts
- [P2][失败不重试] use-task-datasets.ts:159-161 — `loadedDatasetsRef` 在请求发出前就标记 key 已加载，若该 key 请求失败（catch 仅 reportError），后续所有 `ensureDatasets([key])` 直接跳过，数据集永久为空直到整页刷新。最佳实践：失败时从 loaded 集合移除该 key。
- [P2][竞态] use-task-datasets.ts:182-191 — 多处 setState 在多个并发 job 中互不覆盖 key（每 key 独立 state），但 `knowledge` 内 setKnowledgePoints + setCustomKnowledgePointIds 与 useEffect（110-129 行）可能交错，最终以最后一次为准，幂等性尚可。风险低。
- [P3][类型] use-task-datasets.ts:58-69 — abilityPoints/users/scenarios 等大量 `unknown[]`。最佳实践：定义共享类型。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-description-card.tsx
- [P3][交互] task-description-card.tsx:42-80 — 富文本工具栏按钮（H1/加粗/链接/表格等）全部无 onClick，纯展示；编辑器实为纯文本 Textarea，但页面标题仍称「富文本编辑」，用户点击工具栏无任何反应。产品已知或待实现。
- [P2][兼容] task-description-card.tsx:180-184 — 通过检测 `<img`/`<video` 字符串提示「已插入多媒体内容」，与纯文本编辑器矛盾（用户无法插入），提示基本不会出现。可容忍。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card.tsx
- 无问题。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-weight-card.tsx
- 无问题（占位卡片，与全局权重配置按钮联动，设计如此）。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.tsx
- [P3][脆弱] tasks-logic.tsx:192,261,455 — 三处重复的 exam→homework 归一化逻辑。最佳实践：抽公共函数。
- [P3][类型] tasks-logic.tsx:185,248 — `Record<string, any>` / `(rs: any, i: number)`。最佳实践：定义 ReviewStep 类型。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.test.ts
- 无问题（测试覆盖良好）。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/repro.test.ts
- [P3][噪音] repro.test.ts:70-74,85-89 — 测试内含 console.log 调试输出，无断言价值。最佳实践：删除 console.log。
- 其余无问题。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx
- [P1][数据丢失] page.tsx:644-659,991 — `persistWeights` 跳过 `t.id.startsWith('task-')` 的临时任务（新建/克隆任务在 saveTasksToBackend 内才落库并换真实 id），而 `persistWeights()` 在 saveTasksToBackend 之后调用时闭包里的 `tasks` 仍是旧列表（临时 id），且 taskStates 新 key（真实 id）已迁移——新任务的权重永不上传，刷新后权重回到均分默认值。最佳实践：在保存循环内为新建任务同步 upsert 权重，或 persistWeights 改用迁移后的 newTasks/updatedTaskStates。
- [P1][数据丢失] page.tsx:566-576 — `handleAddTask` 把全部已有任务的 weight 重置为均分值，覆盖用户已配置/已锁定的权重。最佳实践：仅给新任务分配权重，保留既有值。
- [P2][数据丢失] page.tsx:186-339 — 主加载 effect 依赖 `user?.id`：登录态晚到（undefined→id）时整页数据（含任务状态）重新加载，覆盖用户早期编辑。最佳实践：user?.id 只影响 users 数据集，从 deps 剔除主加载。
- [P2][重排序失败] page.tsx:1183-1188 — 拖拽排序立即调用 `taskApi.reorder`，若列表中含未落库的临时任务（新建未保存），reorder 请求携带不存在的 task id，后端可能整体失败（仅 reportError，前端顺序已变，刷新后错乱）。最佳实践：排序仅在保存时提交，或临时任务先落库。
- [P2][除零] page.tsx:2326-2328 — `distributeGlobal` 当 unlocked 为空（全部锁定）时 `Math.floor(remaining / 0)` 得 NaN，权重全部变 NaN。最佳实践：unlocked.length === 0 时直接返回。
- [P2][脆弱契约] page.tsx:1582 — `saveMethodsWithRetry` 依赖错误消息精确等于「评价规则已被其他会话修改」判断 409 冲突，后端文案变更即失效。最佳实践：按 HTTP 409 状态码判断。
- [P2][未处理异常] page.tsx:1651-1660 — `handlePersistStandard` 无 try/catch，`saveMethodsWithRetry` 抛错为 unhandled rejection，评价标准落库失败用户无感知。最佳实践：捕获并 toast。
- [P3][不一致] page.tsx:1704-1712 — handleSave 中 updateTask({ evalPoints }) 只包含 randomDraw/review/paper/questionBank 四个方法，outcome/homework/quiz 的评价点未写入 Task.evalPoints 字段（实际以后端 methods 为准，该字段为冗余 mock 字段）。可容忍。
- [P3][冗余] page.tsx:967 — `{ ...ts, evalMethodVersion: ts.evalMethodVersion }` 为无意义自拷贝。可删除。
- [P3][类型] page.tsx:154,155 — `useState<any[]>`。最佳实践：定义类型。

## apps/edu/app/superadmin/layout.tsx
- 无问题。

## apps/edu/app/superadmin/page.tsx
- [P2][安全校验] superadmin/page.tsx:256-278,286-289 — 认证状态仅靠前端解析 JWT payload 的 roleCodes 判断（签名未验证），但所有数据请求走后端 saasRequest（后端鉴权兜底），越权风险可控；仅存在「token 伪造本地通过但请求全部 401」的假登录体验。可接受，P2 提示。
- [P2][未处理异常] superadmin/page.tsx:209-213 — `openTenantTheme` 中 `await fetchThemeColor(ten.id)` 无 try/catch，接口失败产生 unhandled rejection 且弹窗打开后颜色为默认值。最佳实践：捕获并 toast。
- [P3][健壮性] superadmin/page.tsx:286 — `atob(data.token.split('.')[1])` 未包 try/catch，后端返回非标准 JWT 时崩溃。最佳实践：try/catch 解析。
- [P3][类型] superadmin/page.tsx:83-94 — TenantAdmin 中 `newPassword` 仅在创建响应出现，接口复用字段。可接受。

---

## 汇总

审查文件数：58
问题总数：61（P1×5，P2×27，P3×29）

### P0
无（未发现必崩级问题；两处 P2 运行时风险见 teacher-portraits-tab.tsx:426/470 与 assessment-tab typeIconMap 未命中场景）

### P1 摘要
1. hybrid-grading-dialog.tsx:86-115 — 未传 courseId 时 loading 永为 true，弹窗无限转圈（teacher-dashboard 打开路径必现）。
2. hybrid-grading-dialog.tsx:227-237 — 左侧切换课程只改选中态，右侧数据仍是第一个课程的数据，静默错配。
3. tasks/page.tsx:644-659+991 — 新建/克隆任务的权重永不持久化（persistWeights 跳过临时 id 且闭包陈旧），刷新后权重丢失。
4. tasks/page.tsx:566-576 — handleAddTask 把全部既有任务权重重置为均分，覆盖已配置权重。
5. school-admin-manager.tsx:121-128 — 读取 `created.plainPassword` 与后端 `newPassword` 契约不符，初始密码 toast 恒为空。
