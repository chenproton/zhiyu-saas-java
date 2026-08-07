# api-client 前端代码审查报告（2026-08-07）

审查范围：`packages/api-client/src` 下全部 31 个 .ts 文件，逐行通读，并对照 `backend/internal/router/*.go` 与 `backend/internal/handler/*.go` 核实契约。

汇总：P0 必错 0 个；P1 严重 2 个；P2 重要 11 个；P3 一般 15 个。

---

## packages/api-client/src/api-helpers.ts

- [P1][敏感信息] api-helpers.ts:122-139,250-261 — JWT 登录令牌持久化在 `localStorage`（`zhiyu-token` / `zhiyu-portal-token`），任何 XSS 均可直接读取并窃取会话（含预授权令牌 preAuthToken 同链路）。最佳实践：改 httpOnly+Secure cookie 存储（需后端 `Set-Cookie` 配合），或至少缩短 token 有效期并支持 refresh token。
- [P2][超时] api-helpers.ts:162-196 — `requestWithPlatform` 的 `fetch` 未设置任何超时/`AbortSignal`；后端虽有 30s（导入导出 10min）超时中间件，但客户端在网络挂起时 UI 会无限等待，且无用户取消机制（页面跳转/关闭后请求仍在跑）。最佳实践：为 fetch 挂 `AbortSignal.timeout()`（读接口 30s、导入导出按场景放宽）并透传外部 AbortSignal。
- [P2][错误处理] api-helpers.ts:178-179 — `hasBody` 以 `content-length !== '0'` 判断响应体；对 chunked（无 content-length）且 200 的成功响应，若返回非 JSON（如 text/csv），`res.json()` 失败后兜底为 `{error:'请求失败'}` 并作为业务数据返回，掩盖真实响应格式错误。最佳实践：按 `Content-Type` 判断解析，或对已知返回空体的接口显式处理。
- [P2][契约] api-helpers.ts:136-140 + auth.ts:16 — `getToken`/`request` 的平台解析依赖 `NEXT_PUBLIC_DEFAULT_PLATFORM` 与 `window.location.pathname`；`/auth/me` 路由仅在 SaaS 平台组注册（routes.go:248），若在默认 portal 平台的应用中调用 `authApi.me()`（见 auth.ts:16），会携带 portal token 请求被 `RequirePlatform(saas)` 拒绝 → 401 → 清除 portal token 并跳登录页，造成会话被误清。最佳实践：`me()` 显式使用 `saasRequest`（与 `saasMe` 一致），或后端对 `/auth/me` 放宽平台校验。
- [P3][类型] api-helpers.ts:182 — 错误信息提取使用 `(data as any).error`，建议用 `(data as ApiError)` 收窄。
- [P3][依赖] api-helpers.ts:46 — 跨包相对路径导入 `../../shared-types/src/shared-models`，应使用包别名 `@zhiyu/shared-types`（与 types/*.ts 的 re-export 风格不一致，包结构变动即断）。

## packages/api-client/src/api/auth.ts

- [P2][契约] auth.ts:16-17 — `me()` 与 `saasMe()` 指向完全相同的后端 handler（`/auth/me` 与 `/auth/saas/me` 均注册为 `h.authHandler.SaasMe`，routes.go:248-249），两个方法语义重复且平台歧义（见 api-helpers.ts P2）。最佳实践：只保留 `saasMe()`，`me()` 内部委托或删除。
- [P3][重复] auth.ts:18 — `portalMe()` 与 `me()` 平台选择逻辑重复（request 内部已处理），可统一入口。

## packages/api-client/src/api/affairs.ts

- [P2][错误处理] affairs.ts:250-253 — `scheduleApi.exportExcel` 未检查 `res.ok` 即 `downloadBlob(await res.blob())`：非 2xx 时后端返回 JSON 错误体，会被当作「排课导出.xlsx」下载成垃圾文件；同文件 :153-160 的 `teachingPlanApi.exportExcel` 有 `res.ok` 检查，此处行为不一致。最佳实践：先判 `res.ok`，失败时解析 `data.error` 抛错（复用 :155-158 模式）。
- [P3][重复] affairs.ts:109-119 — `create` 是 `generate` 的完全重复实现（仅注释不同），建议 `create: generate` 直接别名。
- [P3][文档] affairs.ts:108 — 注释「同一方案同一学期已存在时后端返回 409」与后端不符：teaching_plan_handler.go:110-119 仅在已有计划「且有排课记录」时返回 409，无排课记录时重新生成。注释误导调用方。

## packages/api-client/src/api/alliance.ts

- [P3][契约] alliance.ts:35-39,145-149 — `togglePublic`/`toggleEnabled` 复用整表 PUT（`/alliance/enterprises/{id}`、`/alliance/permissions/{id}`），依赖后端 `ValidateUpdateExisting` 字段兜底（alliance_crud_handler.go:180+）才不至于清空其他字段；契约脆弱，若后端兜底移除将整行数据被清。最佳实践：后端提供专用 toggle 接口或保持兜底注释明确。

## packages/api-client/src/api/evaluation.ts

- [P2][契约] evaluation.ts:486-489 — `aggregateStatus` 的 `careerPositionId` 类型为可选，但后端 `AggregateStatus` 必填（job_ability_result_handler.go:389-393 缺失返回 400）；响应类型 `JobAbilityAggregateStatus | null` 也不会出现 —— 后端无记录时返回 404 错误（:402-405）而非 null。调用方按 null 处理会漏判，且空参调用必 400。最佳实践：`careerPositionId` 改为必填，类型改为 `Promise<JobAbilityAggregateStatus>`（404 交由全局错误处理）。
- [P3][契约] evaluation.ts:481-485 — `aggregate` 响应类型 `{ logId: string; status: string }`，但后端并发已存在时返回 `{ status: "running" }` 无 `logId`（job_ability_result_handler.go:396-399），`logId` 应为可选。
- [P3][类型] evaluation.ts:147,160,164,173,176 — `Record<string, any>` 多处使用（objectiveAnswers/subjectiveContent/evalPointScores），建议至少泛化为 `Record<string, unknown>` 并补充具体字段。

## packages/api-client/src/api/favorites.ts

- [P3][死代码] favorites.ts:23-25 — `AllFavoritesResponse` 声明 `career_position: CareerPosition[]`，但后端 `FavoriteListResponse`（favorites_handler.go:19-24）不含该字段（岗位收藏单独走 `/job/positions/favorites`），且该类型无任何使用方。最佳实践：删除，或注明仅作聚合视图用途。

## packages/api-client/src/api/import-export.ts

- [P3][契约] import-export.ts:114-116 — `downloadTemplate` 实体联合类型含 `'system-courses'`，但后端模板路由为 `/templates/courses`（routes.go:345，`ServeSystemCourseTemplate`），不存在 `/templates/system-courses`；`importExcel('system-courses')` 同理（后端仅 `/import/courses/excel` 等）。一旦调用必 404。最佳实践：删除该联合成员或映射到 `courses`。
- [P3][死代码] import-export.ts:139-198 — `exportScenariosExcel`/`exportPositionsExcel`/`exportCoursesExcel`/`exportGranularCoursesExcel`/`exportQuestionBanksExcel`/`exportQuestionsExcel`/`exportExamsExcel`/`exportOrganizationsExcel`/`exportStudentsExcel`/`exportTeachersExcel` 等 10 个方法在 apps 中无任何调用（内容列表页走 `exportExcel` 的 xlsx 兜底），属未使用导出面。

## packages/api-client/src/api/job.ts

- [P2][契约] job.ts:72 — `saveFull` 响应类型声明为 `{ position: CareerPosition }`，但后端直接返回岗位对象本身（position_handler.go:490 `respondJSON(w, http.StatusOK, pos)`），不存在 `position` 包装字段；调用方按 `res.position` 取值会得到 undefined。最佳实践：类型改为 `Promise<CareerPosition>` 并修正调用方。
- [P2][契约] job.ts:17-19 — `publicPositionApi` 使用 `createCrudApi` 生成 list/get/create/update/delete 全套，但后端仅为 `/job/public/positions` 注册 GET List 与 GET {id}（routes.go:84-85），其余四个方法调用必 404。TS 的 `TCreate=never` 仅阻止编译期调用，运行时接口面仍暴露。最佳实践：改为只读 API 工厂（list/get 两个方法）。
- [P3][参数] job.ts:233 — `targetPositionApi.list` 无参，后端 `/job/landing/target-positions`（routes.go:377）匹配，无问题；保留。

## packages/api-client/src/api/lesson.ts

- [P3][重复] lesson.ts:58-70 与 :199-211 — `CourseHomeworkSubmission` 与 `NodeHomeworkSubmission` 字段完全一致，应合并为单一类型（后端对应 handler 均返回 `{items}` 同构结构）。

## packages/api-client/src/api/library.ts

无问题（`/library/*` 全部路径与 routes_library.go 一一对应，含 import/preview 与 resource-tags 子路由）。

## packages/api-client/src/api/portal.ts

- [P1][契约] portal.ts:39-43 与 :81-85 — `userManagementApi.batchCreate` / `portalUserManagementApi.batchCreate` 返回类型声明为 `{ count: number }`，但后端 `BatchCreate` 返回 `ListResponse` 结构 `{ items, total }`（user_management_handler.go:492 `respondJSON(w, http.StatusCreated, ListResponse[domain.User]{Items: created, Total: len(created)})`）。调用方读 `.count` 恒为 undefined，批量创建成功数显示为 0/NaN。最佳实践：类型改为 `ListResponse<User>`（或后端改返回 `{count}`，二选一并对齐调用方）。
- [P2][契约] portal.ts:198 — `updateName` 返回类型声明为 `User`，后端 `UpdateMe` 返回 `{ id }`（user_management_handler.go:153）；类型与实际不符，调用方若读 user 字段将 undefined。最佳实践：改为 `{ id: string }`。
- [P3][重复] portal.ts:18-44 与 :46-101 — `userManagementApi`（saas request）与 `portalUserManagementApi`（portalRequest）除请求平台与个别方法外几乎全量重复，可抽取公共定义 + 平台参数。

## packages/api-client/src/api/system.ts

- [P2][契约] system.ts:71-78 — `approvalApi.review` 请求体含 `nextStepIdx`，但后端 `ReviewApprovalRequest` 仅有 `action`/`remark`（approval_handler.go:47-50），`nextStepIdx` 被静默丢弃 —— 按步骤审批（stepIdx）功能实际无效且无报错。最佳实践：后端补齐 `nextStepIdx` 字段并实现分步流转，或前端移除该参数。
- [P3][类型] system.ts:20 — `children?: any[]` 应替换为 `Organization[]`（children 均为同构组织节点）。

## packages/api-client/src/api/scene.ts

- [P3][类型] scene.ts:86 — `saveMethods` 的 `methods: any[]` 应为 `TaskEvaluationMethod[]` 或明确定义输入类型（后端 `TaskEvaluationMethodInput` 结构固定）。

## packages/api-client/src/api/honors.ts

- [P2][契约] honors.ts:5 — `list` 的 `userId` 声明为可选，但后端 `List` 对业务用户必填 `userId`，缺失返回 400「缺少用户ID」（student_honor_handler.go:63-66）；学生角色由后端强制本人。调用方（教师端）不传 userId 必然 400。最佳实践：类型拆分为「学生（无参）/业务用户（必传 userId）」或后端对当前用户兜底查询。

## packages/api-client/src/api-factory.ts

无问题（生成的路由与 `registerContentRoutes`/`registerBatchRoutes`/`registerContentWriteRoutes` 全部对齐，含 save-draft/invite）。

## packages/api-client/src/api.ts

无问题（14 个模块导出齐全，与文件列表一致）。

## packages/api-client/src/index.ts

无问题。

## packages/api-client/src/api-helpers.test.ts

无问题（测试覆盖 buildQuery 与 401/全局错误处理器行为，与实现一致）。

## packages/api-client/src/types/affairs.ts

无问题（re-export shared-types，后端 domain 字段经抽查对齐：TeachingPlan/PeriodSlot/ScheduleEntry 等）。

## packages/api-client/src/types/alliance.ts

无问题（re-export）。

## packages/api-client/src/types/backend.ts

无问题（re-export）。

## packages/api-client/src/types/citation.ts

无问题（re-export shared-types/src/library，含 CitationStats/UncitedItem，与 citation_stats.go 响应对齐）。

## packages/api-client/src/types/evaluation.ts

无问题（多模块 re-export）。

## packages/api-client/src/types/index.ts

无问题。

## packages/api-client/src/types/job.ts

无问题（re-export）。

## packages/api-client/src/types/lesson-source.ts

无问题（named re-export SystemCourseNode，与后端 SystemCourseNodeResponse 字段抽查一致）。

## packages/api-client/src/types/lesson.ts

无问题（re-export）。

## packages/api-client/src/types/library.ts

无问题（re-export）。

## packages/api-client/src/types/portal.ts

无问题（re-export，WorkspaceDashboard/CommunityTopic 与后端 domain 抽查对齐）。

## packages/api-client/src/types/scene.ts

无问题（re-export）。

---

## 复核说明

以下为抽查核实后确认「无问题」的关键契约点（防误报）：
- `/evaluation/*` 全量路由（routes_evaluation.go）与 evaluation.ts 一一对应，含 certifications 的 items/points/full/positions 子路由与 landing/graduation/portraits/certificates 子模块；
- 排课 409 冲突响应 `{error, conflicts}`（scheduling_handler.go:487）与 affairs.ts:214 的 `ScheduleConflictError` 处理匹配；
- 认证 5 接口（routes.go:38-45）与 auth.ts 匹配，Login/Me 响应字段（auth_handler.go:58-90）与 api-helpers.ts 类型一致；
- 收藏响应 `{scene, course, question_bank, exam}`（favorites_handler.go:19-24）与 favorites.ts 类型一致；
- 导入导出实体路由（routes.go:301-372 + routes_affairs.go:59-70）与 import-export.ts 的 import/importExcel/preview/template 路径一致（system-courses 例外已列）；
- `getCertGrades` 返回 `{grades: {...}}`（cert_grade_handler.go:73）与 evaluation.ts:396 一致；
- 通用 CRUD 响应（crud.go / batch_configs.go）与 api-factory 类型一致。
