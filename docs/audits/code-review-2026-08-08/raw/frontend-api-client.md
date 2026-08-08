# api-client 前端代码复查报告（2026-08-08）

复查范围：`packages/api-client/src` 下全部 31 个 .ts 文件逐一完整通读，重点复核 2026-08-07 审查修复是否引入回归、遗留问题、新问题；契约逐条对照 `backend/internal/router/routes*.go` 与 `backend/internal/handler/*.go`、`backend/internal/store/*.go` 核实。`pnpm typecheck` 通过。

汇总：P0 必崩 0 个；P1 严重 1 个；P2 重要 8 个；P3 一般 19 个（含上轮遗留 13 条、本轮新发现 6 条；上轮 4 条已核实修复或误报）。

---

## packages/api-client/src/api-helpers.ts

- [P1][安全] api-helpers.ts:122-125,136-140,250-261 — JWT 令牌仍持久化在 `localStorage`（`zhiyu-token`/`zhiyu-portal-token`），XSS 可直接窃取会话；上轮已报，本轮确认未改。最佳实践：改 httpOnly+Secure cookie 并由后端 Set-Cookie，或引入 refresh token 缩短有效期。
- [P2][超时] api-helpers.ts:177 — `fetch` 无 `AbortSignal` 超时；后端有 30s/10min 超时中间件，但客户端网络挂起时 UI 无限等待、页面卸载后请求仍在跑。上轮遗留。最佳实践：读接口挂 `AbortSignal.timeout()` 并透传外部 signal。
- [P2][错误处理] api-helpers.ts:178-179 — `hasBody` 用 `content-length !== '0'` 判断响应体；chunked 响应无 content-length 时非 JSON 成功响应会被 `res.json().catch` 兜底成 `{error:'请求失败'}` 作为业务数据返回。上轮遗留。最佳实践：按 Content-Type 判断或对空体接口显式处理。
- [P3][类型] api-helpers.ts:182 — `(data as any).error` 建议收窄为 `(data as ApiError)`。上轮遗留。
- [P3][依赖] api-helpers.ts:46 — 跨包相对路径 `../../shared-types/src/shared-models` 导入 User，与 types/*.ts 的 re-export 风格不一致。上轮遗留。
- [P3][重复] api-helpers.ts:223-246 — `authedFetch` 与 `requestWithPlatform`（:162-196）各自实现 401 清 token + 跳登录逻辑，行为分叉（authedFetch 无 globalErrorHandler、platform 解析重复）。本轮新发现。最佳实践：抽公共 401 处理。
- [P3][契约] api-helpers.ts:185 — saas 平台 401 跳转目标 `/login` 在 edu 应用中不存在（edu 仅有 `/portal/login` 与 `/superadmin`），superadmin 会话过期会被跳到 404 页而非重新登录。本轮新发现。最佳实践：跳转目标做成可配置。

## packages/api-client/src/api/auth.ts

- [P3][契约] auth.ts:16 — `me()` 用 `request('/auth/me')`，该路由仅注册在 SaaS 平台组（routes.go:248），portal 默认应用调用会携带 portal token 被 `RequirePlatform(saas)` 拒绝 → 401 误清 portal token。本轮核实：apps 中无任何调用方（edu 均用 `portalMe`/`saasLogin`），由上轮 P2 降为 P3 潜伏风险。最佳实践：删除或显式 `saasRequest`。
- [P3][重复] auth.ts:16-17 — `me()` 与 `saasMe()` 指向同一 handler（routes.go:248-249），语义重复。上轮遗留。

## packages/api-client/src/api/job.ts

- [P2][契约] job.ts:72-75 — `saveFull` 响应类型声明 `{ position: CareerPosition }`，后端直接返回岗位对象（position_handler.go:490 `respondJSON(w, http.StatusOK, pos)`），无 position 包装；当前唯一调用方（edu `job/positions/[id]/edit/page.tsx:214`）忽略返回值故无运行时影响，但类型误导后续调用方。上轮遗留。最佳实践：类型改为 `Promise<CareerPosition>`。
- [P3][契约] job.ts:17-19 — `publicPositionApi` 由 createCrudApi 生成全套 CRUD，后端仅为 `/job/public/positions` 注册 GET List/Get（routes.go:84-85）；TS `never` 仅阻断编译期，运行时方法面仍暴露（实测 apps 仅用 get/list）。上轮遗留。最佳实践：改只读工厂。
- [P3][参数] job.ts:87 — `abilityApi.list` 参数含 `category`，后端 ability List 仅支持 isPublic/tagIds/creatorId/search/limit/offset（store/abilities.go:117-123），category 静默无效。本轮新发现。
- [P3][契约] job.ts:27-31 — `positionApi.clone` body `{name?}` 与后端一致（position_clone_handler.go:19），无问题；保留。

## packages/api-client/src/api/scene.ts

- [P3][类型] scene.ts:86 — `saveMethods` 的 `methods: any[]` 未对齐后端 `TaskEvaluationMethodInput` 固定结构。上轮遗留。

## packages/api-client/src/api/lesson.ts

- [P3][重复] lesson.ts:58-70 与 :199-211 — `CourseHomeworkSubmission` 与 `NodeHomeworkSubmission` 字段完全一致，应合并。上轮遗留。
- [P3][类型] lesson.ts:112-129 — `courseNodeApi` 同时使用两套 SystemCourseNode：响应类型取 deprecated `lesson-source.ts`（`order`/`type`/`knowledgePoints`，与后端 SystemCourseNodeResponse 一致），create/update 请求类型取 canonical `lesson.ts`（`sortOrder`/`refType`/`knowledgePointIds`，与后端 CreateCourseNodeRequest 一致）——功能正确但同名异构易误用。本轮新发现。最佳实践：请求/响应统一注释说明或对齐到单一类型。

## packages/api-client/src/api/evaluation.ts

- [P2][契约] evaluation.ts:486-489 — `aggregateStatus` 的 `careerPositionId` 类型为可选，后端必填（job_ability_result_handler.go:438-442 缺失返回 400）；响应类型 `| null` 也不会出现——后端无记录返回 404 而非 null。上轮遗留。最佳实践：careerPositionId 必填、类型改 `Promise<JobAbilityAggregateStatus>`。
- [P3][契约] evaluation.ts:481-485 — `aggregate` 响应 `{logId: string; status: string}`，后端并发已存在时仅返回 `{status:"running"}` 无 logId（job_ability_result_handler.go:396-399）。上轮遗留。
- [P3][类型] evaluation.ts:147,160,164,173,176 — `Record<string, any>` 多处使用。上轮遗留。

## packages/api-client/src/api/library.ts

- 无问题（`/library/*` 全部路径与 routes_library.go 一一对应；SetBindings/QueryBindings body 与 tag_handler.go 一致；Stats 返回 `{items}` 与 resource_library_handler.go:112 一致）。

## packages/api-client/src/api/import-export.ts

- [P3][契约] import-export.ts:110-135 — `downloadTemplate`/`importExcel` 实体联合缺 `schedules`/`program-courses`/`affairs-config`（后端 routes_affairs.go:59-70 均已注册），导致调用方需 `as any` 强转（edu `program-course-import-dialog.tsx:32`、`affairs-config-import-dialog.tsx:23,30`）。本轮新发现。最佳实践：补全联合成员。
- [P3][契约] import-export.ts:114-116 — 联合含 `'system-courses'` 但后端无 `/templates/system-courses`（模板为 `/templates/courses`），调用即 404；本轮核实无调用方。上轮遗留。

## packages/api-client/src/api/portal.ts

- [P2][契约] portal.ts:120-124 — `portalUserExtensionFieldApi.list` 声明返回 `ListResponse<UserExtensionField>`，后端仅返回 `{items}` 无 `total`（user_extension_field_handler.go:17-18,41）；若调用方读 `.total` 恒 undefined。本轮新发现（当前唯一页面用 `fields.length` 故无运行时影响）。最佳实践：类型改 `{ items: UserExtensionField[] }`。
- [P3][重复] portal.ts:18-44 与 :46-101 — `userManagementApi`/`portalUserManagementApi` 几乎全量重复。上轮遗留。

## packages/api-client/src/api/system.ts

- [P2][契约] system.ts:71-78 — `approvalApi.review` 请求体含 `nextStepIdx`，后端 `ReviewApprovalRequest` 仅 action/remark（approval_handler.go:46-49），按步骤审批参数被静默丢弃、流转实际由后端 CurrentStepIdx 推进，前端"指定步骤"无效且无报错。上轮遗留。最佳实践：后端补齐 stepIdx 或前端移除。
- [P3][类型] system.ts:20 — `children?: any[]` 应为 `Organization[]`。上轮遗留。

## packages/api-client/src/api/affairs.ts

- [P2][错误处理] affairs.ts:250-253 — `scheduleApi.exportExcel` 未检查 `res.ok` 即 `downloadBlob(await res.blob())`，非 2xx 的 JSON 错误体会被下载成「排课导出.xlsx」垃圾文件；同文件 :153-160 teachingPlanApi.exportExcel 有 ok 检查，行为不一致。上轮遗留。最佳实践：复用 :155-158 模式。
- [P3][重复] affairs.ts:109-119 — `create` 是 `generate` 的重复实现（后端 Create 委托 Generate，teaching_plan_handler.go:63-66）。上轮遗留。
- [P3][文档] affairs.ts:108 — 注释「同一方案同一学期已存在时后端返回 409」与后端不符：仅当已有计划且有排课记录时 409（teaching_plan_handler.go:110-119）。上轮遗留。

## packages/api-client/src/api/alliance.ts

- [P3][契约] alliance.ts:35-39,145-149 — `togglePublic`/`toggleEnabled` 复用整表 PUT，依赖后端字段兜底（alliance_crud_handler.go:180+）避免清空其他字段，契约脆弱。上轮遗留。

## packages/api-client/src/api/favorites.ts

- 无问题（targetType 与 store/favorites.go:20-26 一致；List 响应 `{scene,course,question_bank,exam}` 与 favorites_handler.go:19-24 一致；上轮 AllFavoritesResponse 死代码已删）。

## packages/api-client/src/api/honors.ts

- [P2][契约] honors.ts:5-6 — `list` 的 `userId` 声明为可选，后端对业务用户必填、缺失返回 400（student_honor_handler.go:62-66）；学生由后端强制本人。教师端不传必 400。上轮遗留。最佳实践：拆学生（无参）/业务用户（必传 userId）两种签名。

## packages/api-client/src/api/auth.ts / job.ts / portal.ts 其余条目

- 核实无问题：portalLogin/selectTenant（routes.go:40-43）、portalMe（routes.go:68）、targetPositionApi（routes.go:377）、learnRoadApi（routes_job.go:60-64）、batchApi.updateStatus（batch_handler.go:267-288）等。

## packages/api-client/src/api-factory.ts

- 无问题（生成路由与 registerContentRoutes/registerBatchRoutes/registerContentWriteRoutes 对齐；invite/review body 与 content_actions.go:17-28 一致）。

## packages/api-client/src/api.ts

- 无问题（14 个模块导出齐全）。

## packages/api-client/src/index.ts

- 无问题。

## packages/api-client/src/api-helpers.test.ts

- 无问题（覆盖 buildQuery 与 401/全局错误处理器，与实现一致）。

## packages/api-client/src/types/*.ts（backend/alliance/affairs/evaluation/job/lesson/library/citation/portal/scene/index）

- 无问题（均为 shared-types re-export；lesson-source 命名导出 SystemCourseNode 与后端响应抽查一致）。

---

## 上轮问题复查结论（2026-08-08）

| 上轮条目 | 结论 |
|---|---|
| P1 batchCreate 返回类型（portal.ts:39-43,81-85） | ✅ 已修复（005c49cb，改为 `ListResponse<User>`，与 user_management_handler.go:503 一致） |
| P2 `updateName` 返回类型 | ✅ 已核实无问题——后端 UpdateMe 当前返回完整 User（user_management_handler.go:145-149），上轮结论已过时 |
| P3 favorites.ts 死代码（AllFavoritesResponse/未用 import） | ✅ 已修复（ecdeae2b/44bb07d9） |
| P3 import-export 10 个 export* 方法"死代码" | ❌ 上轮误报——本轮核实均有调用方（content-list-page.tsx:154-159、org-user/students:496、teachers:486、question-banks/[id]:363 等），保留 |
| P1 localStorage 令牌、P2 超时/hasBody/nextStepIdx/honors/aggregateStatus/exportExcel/saveFull 等 | ⏳ 未修复，见上文本条 |

---

## 复核确认无问题的关键契约点（防误报）

- 排课 409 冲突 `{error, conflicts}`（scheduling_handler.go:487）与 affairs.ts:214 `ScheduleConflictError` 匹配；
- `/affairs/schedules/export?termId=`、`/affairs/teaching-plans/{id}/export`、`/affairs/schedules/timetable`、`/affairs/schedules/auto-schedule`、`/affairs/period-slots/replace` 与后端参数/响应一致；
- 认证 5 接口与 auth.ts 匹配；Login/Me 响应字段（auth_handler.go:58-90）与 api-helpers.ts 类型一致；
- 课程作业/节点作业 submit/list/grade 与 course_handler.go 响应 `{id,status}`/`{items}` 一致；assessments `{exams,homeworks}` 一致；
- 混合模块 batch 与 hybrid_module_handler.go:98-147 一致；场景权重 upsert 与 scenario_weight_handler.go:16-23 一致；
- certifications 子路由（items/points/full/positions/tasks）与 routes_evaluation.go:52-73 一一对应；BulkUpdateScores 裸 map（exam_handler.go:366,376）与 evaluation.ts:79-83 一致；
- 题库 batchCreate `{bankId,items}`→`{count}`（question_handler.go:31-32,246）一致；微证书 issue `{templateId,userIds}`→`{count}`（micro_cert_handler.go:27-28,244）一致；
- 毕业设计/画像/落地页 grades 响应均一致；`/evaluation/job-ability/results/summary` 返回裸数组（job_ability_result_handler.go:313-328）与 evaluation.ts:480 一致；
- 导入响应 `{created,failed,skipped,permissionSkipped,entity,errors}`（import_common.go:107-122、position_import_handler.go:55-61）与 import-export.ts 类型一致；overwrite/rename 布尔串解析（import_common.go:127-132）一致；
- 用户批量操作（batch-graduate/batch-delete/batch-org-node/bindRoles/reset-password）body 与 user_management_handler.go:64-87 一致；
- 收藏/荣誉/社区/日志/扩展字段写接口 body 与各 handler 一致（扩展字段 List 缺 total 例外已列）。
