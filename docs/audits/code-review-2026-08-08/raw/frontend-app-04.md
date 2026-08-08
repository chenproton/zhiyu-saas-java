# 前端 app 层复查（第 4 轮）：portal/workspace/scene/superadmin

- 审查日期：2026-08-08（复查，基于 2026-08-07 全量审查后的修复基线）
- 文件清单：/tmp/opencode/a2-ad（54 个文件，全部逐行阅读）
- 已确认修复项（未再发现问题）：hybrid-grading-dialog courseId 传递（teacher-courses-tab:1165-1171、teacher-dashboard-tab:248-254 均已传 courseId）、teacher-dashboard 传参、workspace-schedule-grid 单次事件周过滤（isEventInWeek）、tenant 省份/城市兜底（PROVINCES.includes 判断，未知省份置空不提交）。

## apps/edu/app/portal/apps/system/resource/majors/page.tsx
- 无问题。

## apps/edu/app/portal/apps/system/resource/package/page.tsx
- [P3][i18n] package/page.tsx:97-105 — 非 active 状态（如 expired/pending）时直接渲染 `subscription?.status` 原始英文值，未走 t() 翻译；最佳实践：按状态映射中文文案。
- [P3][UX] package/page.tsx:66-70 — 每次重新拉取套餐数据都会把 expandedModules 重置为第一个模块，用户折叠状态丢失；最佳实践：仅初始化一次或保留展开状态。

## apps/edu/app/portal/apps/system/tenant/_components/school-admin-manager.tsx
- 无问题。

## apps/edu/app/portal/apps/system/tenant/page.tsx
- [P3][风格] tenant/page.tsx:86-93 — mapBackendTenant 用 `(t as any).shortName` 等 8 处绕过类型，未收录进 BackendTenant 接口；最佳实践：扩充类型定义。
- [P3][契约] tenant/page.tsx:221,236 — 联系电话输入框 onChange 同时写 phone 与 contactPhone（503-507），保存时两个字段互为兜底双写，语义冗余；最佳实践：保留单一字段来源。

## apps/edu/app/portal/layout.tsx
- 无问题（守卫在 useEffect 中重定向，loading 期渲染 children 属有注释的刻意设计）。

## apps/edu/app/portal/login/page.tsx
- 无问题（多租户选择、doLogin 后按角色跳转均正确；测试账号仅 dev 展示）。

## apps/edu/app/portal/page.tsx
- [P3][死代码] page.tsx:278-300,377 — BENTO_LAYOUT 全部为 'small' 变体，CardVariant 的 big/tall/wide 及 GradientTile 中 isBig 分支从未命中；最佳实践：收敛为单一布局。
- [P3][死代码] page.tsx:9-13 — features 数组的 `active: true` 字段无任何消费方。

## apps/edu/app/portal/workspace/_components/account-info-form.tsx
- 无问题（页面级 isLoading 门控保证 user 先于组件挂载，name 初始化安全）。

## apps/edu/app/portal/workspace/_components/assessment-tab.tsx
- 无问题（WorkspaceExam.type 为封闭联合类型，与 typeIconMap 键一一对应，无崩溃风险；两个 effect 均有 cancelled 保护）。

## apps/edu/app/portal/workspace/_components/career-tab.tsx
- [P3][契约] career-tab.tsx:96 — CourseCoverCard 无条件渲染「已发布」徽标，未依据 course.status 判断；最佳实践：按状态渲染。
- [P3][i18n] career-tab.tsx:167 — `v${bank.version}` 版本号硬拼接未走 t()。

## apps/edu/app/portal/workspace/_components/change-password-form.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/community-tab.tsx
- [P3][数据] community-tab.tsx:229 — StatCard 趋势文案硬编码「3 个可加入」，而 studyGroups 共 4 组；最佳实践：由数据派生。
- [P3][竞态] community-tab.tsx:120-139 — openDetail 无请求序号/取消保护，快速「返回列表→再点另一话题」时旧响应可能覆盖新话题详情；最佳实践：复用 loadSeqRef 模式。

## apps/edu/app/portal/workspace/_components/dashboard-tab.tsx
- [P2][契约] dashboard-tab.tsx:101 — `const Icon = typeIconMap[item.type]` 无兜底；WorkspaceTodo.type 为开放 string（shared-types portal.ts），后端出现未收录类型（如 task/assignment）时 `<Icon>` 为 undefined，React 直接抛「Element type is invalid」整页崩溃；最佳实践：`typeIconMap[item.type] || 默认图标`。

## apps/edu/app/portal/workspace/_components/grading-iframe-dialog.tsx
- [P3][UX] grading-iframe-dialog.tsx:59 — loading 依赖 iframe onLoad；若目标被 X-Frame-Options/登录态拦截，加载圈永久旋转；最佳实践：加超时兜底。

## apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx
- [P3][死代码] hybrid-grading-dialog.tsx:100 — Promise.all 外层 .catch 永远不会触发（内层各请求已 catch），纯死代码。
- [P3][UX] hybrid-grading-dialog.tsx:318-334 — 无 courseId 打开时右侧直接显示「该课程暂无学生测评提交记录」空态，实际需先点左侧课程才加载数据，文案误导；最佳实践：未选课程时提示「请选择课程」。

## apps/edu/app/portal/workspace/_components/learning-tab.tsx
- [P3][数据] learning-tab.tsx:102-127 — 学习时长 86h / 本周完成任务 12 / 较上周 +3 等硬编码 mock 指标与上方真实课程数混排，用户易误解为真实数据。
- [P3][错误被吞] learning-tab.tsx:33-36 — catch 静默置空数组，无任何用户提示。

## apps/edu/app/portal/workspace/_components/my-schedule-tab.tsx
- [P3][健壮性] my-schedule-tab.tsx:30 — 用 `err.message.includes('学期')||includes('404')` 字符串匹配判断空态，后端文案变动即失效；最佳实践：依赖错误码。

## apps/edu/app/portal/workspace/_components/portrait-tab.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/prep-associate-dialog.tsx
- [P3][UX] prep-associate-dialog.tsx:64-70 — 全不勾选点「确认关联」无任何反馈（按钮未禁用、无提示）；最佳实践：空选时禁用确认按钮。

## apps/edu/app/portal/workspace/_components/profile-tab.tsx
- [P3][展示] profile-tab.tsx:187 — `user.phone.slice(0,3)+'****'+slice(-4)`，手机号长度不足 7 位时掩码重叠；最佳实践：按长度分段。
- [P3][死代码] profile-tab.tsx:391 — status 判 'strong' 分支从未出现（securityItems 只有 bound/unbound）。
- [P3][错误被吞] profile-tab.tsx:125-129 — 荣誉证书上传失败静默，无 toast。

## apps/edu/app/portal/workspace/_components/section-card.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/stat-card.tsx
- 无问题（含键盘可达性处理）。

## apps/edu/app/portal/workspace/_components/school-admin-approvals-tab.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/school-admin-overview-tab.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/school-admin-personnel-tab.tsx
- 无问题（五个快捷入口路由均已确认存在）。

## apps/edu/app/portal/workspace/_components/school-admin-resources-tab.tsx
- 无问题。

## apps/edu/app/portal/workspace/_components/teacher-courses-tab.tsx
- [P3][契约] teacher-courses-tab.tsx:883-890 — 「已上/未上」仅统计 status 为 associated/pending 两种，其余状态（如取消/调课）不计入总数显示；最佳实践：按剩余比例计算或展示全部。
- [P3][死数据] teacher-courses-tab.tsx:814,822 — 备课跳转 URL 硬编码 `id=hybrid-1` / `task=task-1-1`，为演示值；最佳实践：接入真实链接。

## apps/edu/app/portal/workspace/_components/teacher-dashboard-tab.tsx
- [P2][契约] teacher-dashboard-tab.tsx:150 — `const Icon = typeIconMap[item.type]` 无兜底（同 dashboard-tab.tsx:101，WorkspaceTodo.type 开放 string）；最佳实践：`|| 默认图标`。
- [P3][风格] teacher-dashboard-tab.tsx:710-717 — `if (c.type === 'hybrid')` 内联块缩进错乱（onGradeRequest 分支），不影响逻辑但可读性差。
- [P3][硬编码] teacher-dashboard-tab.tsx:462 — 年份下拉硬编码 [2025,2026,2027]，currentDate 年份不在列表时 Select 显示空白；最佳实践：动态生成。

## apps/edu/app/portal/workspace/_components/teacher-portraits-tab.tsx
- [P3][契约] teacher-portraits-tab.tsx:426,470 — `student.achievementRate.toFixed(1)` 直接调用（类型为必填 number，风险低）；其中 470 行的 `activeStudent?.achievementRate.toFixed(1) ?? '-'` 中 ?? 在 toFixed 之后，字段缺失时会先抛错；最佳实践：`(x?.achievementRate ?? 0).toFixed(1)`。

## apps/edu/app/portal/workspace/_components/teacher-profile-tab.tsx
- [P3][契约] teacher-profile-tab.tsx:110 — 安全项图标按 `[Lock, Smartphone, Mail, Phone][index]` 下标映射，teacherSecurityItems 为空数组时无渲染，一旦填充数量变化会错位/undefined；最佳实践：图标随数据项携带。

## apps/edu/app/portal/workspace/_components/workspace-schedule-grid.tsx
- [P3][逻辑] workspace-schedule-grid.tsx:571 — 年视图用 `e.dayOfWeek % 4 === m % 4` 伪随机把事件塞进各月，事件可能显示在无关月份；最佳实践：按 date 映射或明确标注为装饰。
- [P3][死代码] workspace-schedule-grid.tsx:109-115 — 单次事件 `date` 字段在共享类型 WorkspaceScheduleEvent 中不存在（shared-types/portal.ts），isEventInWeek 的 date 分支为前瞻性死代码；最佳实践：在共享类型中补字段或删除分支。
- [P3][UX] workspace-schedule-grid.tsx:362-370 — 「查看测评结果」按钮永久 disabled。

## apps/edu/app/portal/workspace/_data/workspace-student-types.ts
- 无问题。

## apps/edu/app/portal/workspace/_data/workspace-teacher-types.ts
- 无问题（mock 已清空为默认值，符合注释声明）。

## apps/edu/app/portal/workspace/page.tsx
- [P3][死代码] workspace/page.tsx:343-354 — roleConfigs 中 teacher/admin/enterprise 三项仅 enterprise 被使用（469 行），且 welcomeText 硬编码「张老师」/「管理员」；最佳实践：删除未用配置、用真实用户姓名。
- [P3][死代码] workspace/page.tsx:70-78 — securityItems/weeklyData/monthlyTrend/resourceUsage/contacts 全部空数组，连带 734-905 行的大段卡片渲染为纯死 UI；最佳实践：整段移除或接入接口。
- [P3][URL] workspace/page.tsx:114 — urlTab 非法时 activeTab 回退 dashboard，但 URL 参数未修正，刷新后仍显示非法参数。

## apps/edu/app/scene/approvals/page.tsx
- 无问题。

## apps/edu/app/scene/archive/page.tsx
- [P3][一致性] archive/page.tsx:110 — 批量删除用 Promise.all（单个失败整体报错且部分已删），批量恢复却用 allSettled；最佳实践：统一为 allSettled + 部分失败提示。

## apps/edu/app/scene/batches/page.tsx
- 无问题。

## apps/edu/app/scene/landing/layout.tsx
- 无问题。

## apps/edu/app/scene/landing/page.tsx
- 无问题。

## apps/edu/app/scene/landing/[id]/page.tsx
- [P3][竞态] landing/[id]/page.tsx:395-456 — 任务/资源/知识点等关联数据 effect 无取消或序号保护，快速切换场景 id 时旧响应可能覆盖新场景数据；最佳实践：加 cancelled 标志。
- [P3][契约] landing/[id]/page.tsx:821 — `scenario.creatorId.slice(0, 8)` 假设 creatorId 恒存在；最佳实践：`(scenario.creatorId || '').slice(0,8)`。

## apps/edu/app/scene/landing/[id]/learn/page.tsx
- [P3][安全边界] learn/page.tsx:209-218 — 未登录访问时 `evaluateeId: user?.id` 为 undefined，能否拉取他人结果完全依赖后端按 token 过滤；最佳实践：未登录时跳过该请求。

## apps/edu/app/scene/layout.tsx
- 无问题。

## apps/edu/app/scene/page.tsx
- 无问题。

## apps/edu/app/scene/workflows/page.tsx
- 无问题。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/hooks/use-task-datasets.ts
- [P2][错误恢复] use-task-datasets.ts:157-159 — loadDatasets 在任务执行前就把 key 写入 loadedDatasetsRef；数据集（knowledge/ability/resources 等）加载失败后同一会话内不再重试，必须整页刷新才能恢复，且页面继续用空数据保存任务；最佳实践：任务失败时从 ref 中回退标记。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/repro.test.ts
- [P3][风格] repro.test.ts:70-74,85-89 — 测试中残留 console.log 调试输出。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-description-card.tsx
- [P3][死代码] task-description-card.tsx:42-80 — 富文本工具栏 20+ 按钮无 onClick 纯装饰（当前仅纯文本模式）；最佳实践：接入编辑器或移除工具栏。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card.tsx
- [P3][逻辑] task-info-card.tsx:82 — 学时输入清空后 `+''` 得 0，直接回写 0 学时；最佳实践：空值保持 undefined。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.test.ts
- 无问题。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.tsx
- 无问题（exam→homework 归一化、权重均分、往返转换均有测试覆盖）。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-weight-card.tsx
- 无问题。

## apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx
- [P1][数据丢失] tasks/page.tsx:184-337 — 首屏加载 effect 依赖 [scenarioId, user?.id, ensureDatasets, toast, t]；ensureDatasets 依赖 loadDatasets（依赖 locale），因此切换语言/重新解析用户时整个 effect 重跑：从服务端重建 taskStates，用户所有未保存的编辑（描述、知识点/能力点/资源勾选、权重、评价规则）全部丢失；最佳实践：effect 只依赖 scenarioId，数据集加载与 user/locale 解耦（如用 ref 记忆）。
- [P1][逻辑] tasks/page.tsx:625-637 — handleDeleteTask 对克隆/引用生成但尚未保存的临时 id（`task-...`，见 589 行）直接调 `taskApi.delete`，必然 404 → 弹「删除失败」且列表不更新（删除逻辑在 await 之后），用户无法移除未保存的克隆任务；最佳实践：临时 id 任务直接本地移除，落库任务才调接口。
- [P2][数据残留] tasks/page.tsx:903-906 — replaceIds 仅过滤 `kp-custom-`/`ab-custom-` 前缀；自定义资源持久化失败（failedResourceIds）时其临时 id 仍残留在任务 resourceIds 中随保存写入后端，形成悬空引用，且 894-899 行 toast 声称「将从任务中移除」与实际不符；最佳实践：资源失败 id 同样过滤并从状态剔除。
- [P2][数据覆盖] tasks/page.tsx:309-320 — scenarioWeightApi.list 失败时（catch 仅 reportError），所有任务权重回退均分且 locked=false；随后保存/完成配置时 persistWeights 会用均分值覆盖后端已存的真实权重；最佳实践：权重接口失败时保留原样并提示，不覆盖。
- [P3][死代码] tasks/page.tsx:178-181 — 空 cleanup 的 useEffect 无意义。
- [P3][契约] tasks/page.tsx:1160-1186 — 拖拽排序把未落库临时 id 一并传给 taskApi.reorder，后端必然报错（被 catch 吞掉）；最佳实践：过滤临时 id。
- [P3][展示] tasks/page.tsx:1465 — 克隆对话框「关联岗位」列显示的是当前场景的岗位名，而非来源场景的岗位，所有行同一值，误导；最佳实践：显示 t.scenario 关联岗位或移除该列。

## apps/edu/app/scene/scenarios/[id]/edit/page.tsx
- [P3][展示] edit/page.tsx:64 — creatorName 恒为「当前用户」占位，未使用 useAuth 真实姓名；最佳实践：取 user.name。

## apps/edu/app/superadmin/layout.tsx
- 无问题。

## apps/edu/app/superadmin/page.tsx
- [P3][健壮性] superadmin/page.tsx:209-213 — openTenantTheme 内 `await fetchThemeColor(ten.id)` 无 try/catch，失败产生未处理 Promise 拒绝；最佳实践：catch 后置默认色。
- [P3][安全] superadmin/page.tsx:256-278 — 客户端 atob 解析 JWT 判定 platform_admin 角色，仅作 UI 门槛（后端仍鉴权）可接受，但签名未验证，建议注释说明或走 /admin/me 校验。
