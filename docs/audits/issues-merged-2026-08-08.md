# 知与 SaaS 问题清单合并版（2026-08-07 + 2026-08-08 两轮全量审查）

> 合并说明：以 2026-08-08 复查（最新逐行通读）为当前基线；标注每条的来源与状态。
> 两轮统计：07 轮 P0×4/P1×82/P2×458/P3×911；08 轮 P0×2/P1×33/P2×328/P3×607。
> 08 轮确认：上轮修复**绝大部分无回归**；本轮 P0/P1 中 6 条为修复引入回归、25 条为上轮遗漏/遗留、2 条误报排除、2 条降级。

## 一、当前未解决 P0（2 条，均回查确认）

> 详见 problems.md（08-08）第一节。均为修复引入回归：ability_domain_handler.go 漏配 TenantFn（能力域 CRUD 404）；question_banks.go 绑定 INSERT 引用不存在 tenant_id 列（题库必 500）。

## 二、当前未解决 P1（33 条）

> 详见 problems.md（08-08）第二节，分类：修复回归 6 / 越权租户 8 / 数据丢失兜底 8 / 错误吞 4 / 功能契约 7。其中 3 条为两轮共同遗留（localStorage JWT、QuestionBank.Description 升级、position_certificates store 纵深）。

## 三、当前未解决 P2 合并清单

> 两轮合并去重：本轮 328 条 + 上轮遗留本轮未复现 341 条。标注：[08] 本轮状态；[07遗留] 上轮报出、本轮未复现报告（可能已修或批次覆盖差异，需按上轮清单核实）。


### 3.1 本轮 P2（328 条，key 去重 322）

- 其中 **107 条为两轮共同遗留**（07 已报、08 仍存在，顽固问题）

- [两轮遗留][frontend-app-03.md] [i18n] 第 464 行：`<LandingEmpty title={`暂无${t(cat.title)}`} />` — 模板串拼接中文"暂无"，整串未作翻译 key，切语言后仍是中文；最佳实践：`t('暂无{t}', { t: t(cat.title) })`（上轮已报，未修）。
- [两轮遗留][frontend-app-03.md] [分页缺失] 第 61-65 行：`usePortalUsers` 仅解构 `users/loading/error/refetch`，未取 `total/page/pageSize/setPage`，PortalCrudPage 也未传 `pagination` → 毕业学生超过默认 20 条时**只能看第一页、无法翻页**（对比 accounts 页第 168 行正确传了 pagination）（上轮已报，**未修**，回归确认）。
- [两轮遗留][frontend-app-02.md] [字段丢失] 行 691-692 — `buildCoursePayload` 使用 `existing?.semester`/`existing?.className`，`courseForm.semester` 的用户修改永不生效（表单无该输入项，属死字段，上轮已标记未修）。建议删除或打通 UI。
- [两轮遗留][frontend-app-02.md] [崩溃风险] 行 649 — `course.creatorId.slice(0, 8)`：creatorId 为 null/undefined（老数据）时 TypeError 整页崩溃（上轮已标记未修）。最佳实践：`(course.creatorId || '').slice(0, 8)`。
- [两轮遗留][frontend-app-03.md] [截断] 第 72-87 行 `list({limit:200})` 三路截断：协议/项目/成果超 200 条时详情页各 Tab 过滤基于截断列表，已关联项缺失（上轮已报，未修）。
- [两轮遗留][frontend-app-02.md] [截断] 行 123 — `courseApi.list({ status:'published', limit:1000 })` 客户端全量拉取，课程超上限时列表/筛选/统计不完整（上轮已标记未修）。容忍（含 P3：CourseCard index prop 未使用）。
- [两轮遗留][frontend-app-02.md] [截断] 行 232 — `resourceLibraryApi.list({ limit: 500 })` 客户端全量拉取被后端上限截断，统计卡片、类型/院系/专业筛选、列表均不完整且无提示（上轮已标记未修）。
- [两轮遗留][frontend-app-02.md] [截断] 行 47 — `limit: 9999` 超后端 maxPageSize 被截断为 200，`totalPages = ceil(total/9999) = 1` 无分页，只展示前 200 条无提示（上轮已标记未修）。最佳实践：limit 传 200 并用服务端分页（其余 library 页已改造）。
- [两轮遗留][frontend-app-03.md] [数据覆盖] 第 155-156 行：租户省份/城市不在 CHINA_REGION 或为空时，编辑表单默认回填 `北京 / 东城区`，用户不修改直接保存会把原地区覆盖为"北京/东城区"（数据污染）；最佳实践：默认留空，未选择不提交（上轮已报，未修）。
- [两轮遗留][frontend-app-02.md] [竞态] 行 132-153 — 三个并行拉取无取消守卫，切换课程 id 时旧数据可覆盖（上轮已标记未修）。
- [两轮遗留][frontend-app-02.md] [运算符优先级] 行 141-144 — 上轮问题未修：`draft?.estimatedHours || node.estimatedHours ? parseFloat(...) : undefined` 实为 `(a || b) ? c : d`：用户清空 estimatedHours（draft=''）而 node 原值存在时回退用旧值，**无法清空该字段**；parseFloat 无 NaN 兜底。最佳实践：显式 `const v = draft?.estimatedHours; const eh = v !== undefined && v !== '' ? parseFloat(v) : node.estimatedHours`。
- [两轮遗留][frontend-app-02.md] [部分成功误导] 行 124-150 — 与 ability 页相同（create/update 成功后 saveTags 失败误报"保存失败"，重试重复创建；上轮已标记未修）。
- [两轮遗留][frontend-app-02.md] [部分成功误导] 行 186-213 — 上轮问题未修：实体保存成功、`tagApi.setBindings` 失败 → toast"保存失败"且弹窗不关闭，重试会重复创建（新建路径无幂等）；行 162-175 上传成功但 create 失败的 CDN 孤儿文件无清理。最佳实践：标签失败单独提示；上传完成即视为"已提交"语义或幂等重试。
- [两轮遗留][frontend-app-02.md] [重复加载覆盖] 行 190-323 — 上轮问题未修：加载 effect 依赖 `abilityPool`（行 323），能力池拉取完成触发 effect 重跑，编辑模式重新拉取课程/节点/模块并整体覆盖 `nodeDataMap`/`moduleAssignments`/`selectedNodeId`（会重置用户已选节点），新建模式则重置 nodes（若用户在该窗口内已添加节点会丢失）；`setAbilityPoints` 在第二次运行才拿得到池内名称（首次显示裸 UUID 名称）。最佳实践：去掉 abilityPool 依赖，改为首次加载后单独 setAbilityPoints。
- [两轮遗留][frontend-app-02.md] [陈旧闭包] 行 310-329 — 上轮问题未修：`AttachmentListEditor.handleFileChange` 上传完成回填时读取闭包 `items` 做 `findIndex`，若上传期间该附件被删除则 idx=-1 静默丢弃（文件已上传 CDN 成孤儿）；若被追加条目不受影响。最佳实践：上传开始记录 itemId，回填前校验仍存在，失败提示。
- [两轮遗留][store-01.md] [索引] abilities.go:128-204 — CitationStats/ListUncited 的 4 个引用绑定表相关子查询
- [两轮遗留][frontend-api-client.md] [错误处理] affairs.ts:250-253 — `scheduleApi.exportExcel` 未检查 `res.ok` 即 `downloadBlob(await res.blob())`，非 2xx 的 JSON 错误体会被下载成「排课导出.xlsx」垃圾文件；同文件 :153-160 teachingPlanApi.exportExcel 有 ok 检查，行为不一致。上轮遗留。最佳实践：复用 :155-158 模式。
- [两轮遗留][handler-01.md] [事务缺失] affairs_config_import_handler.go:53-166 — 三 Sheet 导入不在同一事务，中途失败留部分数据；最佳实践：整次导入包 BeginTx 整体回滚。
- [两轮遗留][handler-01.md] [静默失败] affairs_config_import_handler.go:74-79、106-111、152-157 — 三个 Sheet 的重复检查 `QueryRow(...).Scan` 与 INSERT `Exec` 错误全部忽略，DB 故障或类型不合法（如日期格式错误）时导入返回 200 且计数虚高、部分行静默丢失；最佳实践：Scan/Exec 出错时记录日志并 500（或计入 skipped 并在响应带 error 字段）。
- [两轮遗留][handler-01.md] [错误处理] alliance_crud_handler.go:49 — `alliancePublicGet` 将 store 所有错误（含 DB 故障）统一响应 404（上轮已标，未修）；最佳实践：区分 ErrNotFound 返回 404，其余走 respondServerError。
- [两轮遗留][store-01.md] [错误处理] alliance_store.go:78-86 — queryList 吞掉扫描错误（`items, _ := scan(rows)`，
- [两轮遗留][store-01.md] [租户纵深] alliance_store.go:105-118 — ListEnterpriseAgreements 仅按
- [两轮遗留][store-01.md] [租户纵深] alliance_store.go:120-126 — ListMilestones 仅按 `project_id` 过滤，
- [两轮遗留][frontend-api-client.md] [错误处理] api-helpers.ts:178-179 — `hasBody` 用 `content-length !== '0'` 判断响应体；chunked 响应无 content-length 时非 JSON 成功响应会被 `res.json().catch` 兜底成 `{error:'请求失败'}` 作为业务数据返回。上轮遗留。最佳实践：按 Content-Type 判断或对空体接口显式处理。
- [两轮遗留][frontend-comp-02.md] [防重复] approval-dialogs.tsx:142-153 — `confirmApprove/confirmReject` 无 pending 状态，双击可重复提交（同 approval-list-page:231 一并修复）；最佳实践：按钮增加 loading 并 disable
- [两轮遗留][backend-middleware-router.md] [JWT 校验]（遗留）auth.go:53-57 — 中间件只校验"能解析 + 签名有效"，不强制 `claims.UserID != ""`。登录多租户流程签发的 `preAuthClaims`（auth_handler.go:159-169，含 `platform` 字段、无 `userId`）与正式令牌同密钥同 HS256，可被本中间件解析为 `Claims{Platform:"portal", UserID:""}` 并放行进入仅挂 `RequirePlatform` 的端点（`/auth/portal/me`、`/subscriptions`、`/stats/me` 等）：`PortalMe` 以空 UserID 查库、`SubscriptionHandler` 因 tenant 过滤拒绝，无数据泄露但属于令牌类型混淆缺口，且空 UserID 请求会打到 DB 查询（500 面）。最佳实践：解析成功后 `if claims.UserID == "" { 401 }`，天然排除 preAuthToken 及任何签名正确但结构不全的令牌。
- [两轮遗留][frontend-shared-types.md] [契约] backend.ts:22 — `Tenant.adminIds: string[]` 仍标必填，后端 `domain/unified.go:112` `json:"adminIds,omitempty"` 可空（上轮未修）；最佳实践：改 `adminIds?: string[]`。
- [两轮遗留][frontend-shared-types.md] [契约] backend.ts:47 — `OrgType.isDefault?` 仍标可选，后端 `domain/unified.go:124` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][handler-01.md] [租户边界] batch_handler.go:169-172 — claims.TenantID 为空时 tenantID=nil，TenantScoped 表（如课程批次）落库 NULL tenant_id 产生无主记录（上轮已标，未修）；最佳实践：TenantScoped=true 时无租户直接 403。
- [两轮遗留][frontend-shared-types.md] [类型] certificate-issuance.ts:15-16 — `MicroCertTemplate.createdAt/updatedAt: Date` 仍标 Date（上轮仅修了 CertIssuanceRecord 的 34-35 行，此处遗漏）；JSON 反序列化为 ISO 字符串；最佳实践：改 string。
- [两轮遗留][frontend-shared-types.md] [契约] certificate-issuance.ts:19 — `IssueStatus` 仍含 `'revoked'`，后端仍无撤销端点/写入路径（grep handler/store 无 revoke 操作，仅 'issued' 写入）；revokedAt/revokeReason 列虽在 schema 但状态永不出现（上轮未修）；最佳实践：删除或注明"预留"。
- [两轮遗留][store-01.md] [租户纵深] content_actions.go:94-176 — Transition/Review/Invite 均无 tenantID 参数
- [两轮遗留][handler-02.md] [错误误报] content_actions.go:134-138 — `transitionWithHook` 状态流转已提交成功后回读失败返回 404"不存在"，客户端误判失败并重试，第二次流转会得到 400 invalid transition，产生误导；最佳实践：写成功后回读失败返回 500 并提示"已生效，请刷新"。
- [两轮遗留][store-01.md] [错误处理] course_homeworks.go:177-188 — scanHomeworkSubmissions 扫描失败
- [两轮遗留][handler-02.md] [错误误报 404] course_node_handler.go:127-131（Get）、210-213（Update 前置）、274-277（Delete 前置）、159-162（Create 课程校验）— 任意错误返回 404"不存在"；最佳实践：`errors.Is(err, store.ErrNotFound)` 分流。
- [两轮遗留][handler-02.md] [错误吞静默失败] course_resource_handler.go:172-176 — `UnbindResource` 中 `BindTargetID` 错误一律返回 200"成功"（意图为幂等，但无法区分"绑定不存在"与 DB 故障）：DB 异常时客户端误以为已解绑，绑定实际仍在；最佳实践：用 `errors.Is(err, store.ErrNotFound)` 区分，DB 错误返回 500。
- [两轮遗留][store-01.md] [数据残留] courses.go:133-161 — Delete 未清理课程级 exam_usages（target_type=
- [两轮遗留][handler-02.md] [错误误报 404] crud.go:121-125（crudGet）、155-159（crudUpdate 前置）、214-218（crudDelete 前置）— `GetByIDFn` 任意错误返回 404；最佳实践：ErrNotFound 分流，其余 500。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:104,138,182 — `QuestionBank.code?/Question.code?/Exam.code?` 仍标可选，后端 `domain/evaluation.go:10,45,78` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:118 — `QuestionBank.isDraftPool?` 仍标可选，后端 `:24` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:143,159,173 — `Question.answer: string | string[]` 仍含 string 分支，后端 `Answer JSONSlice json:"answer"`（:50,69）恒为数组（上轮未修）；最佳实践：统一 `answer: string[]`。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:188 — `Exam.questions: ExamQuestion[]` 仍标必填，后端 `:85` `json:"questions,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:200 — `Exam.isTemp?` 仍标可选，后端 `:98` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:236 — `ExamUsage.status` 仍含 `'pending'|'scheduled'`，后端仅 draft/published/in_progress/finished（`store/exam_usages.go:69-77,181`）（上轮未修）；最佳实践：收缩为四值。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:237 — `ExamUsage.activationMode?` 仍标可选，后端 `domain/evaluation.go:114` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-exam.ts:256 — `ExamResult.gradingStatus?` 仍标可选，后端 `:135` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-scene.ts:16 — `EvaluationMethod.relatedTaskIds: string[]` 仍为必填死字段，后端 `domain/evaluation.go:171-179` 无此字段（上轮未修）；最佳实践：删除或确认另有关联接口再补来源注释。
- [两轮遗留][frontend-shared-types.md] [契约] evaluation-scene.ts:37-38 — `SceneEvaluationResult.evaluatorId?/evaluatorType?` 仍标可选，后端 `:189-190` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][backend-domain.md] [NULL 直扫·未修复] evaluation.go:22 + store/question_banks.go:248,282,303 — `QuestionBank.Version string` 直扫可空列 `question_banks.version`（001_baseline:848 无 NOT NULL），与 Description 同源同修。
- [两轮遗留][frontend-api-client.md] [契约] evaluation.ts:486-489 — `aggregateStatus` 的 `careerPositionId` 类型为可选，后端必填（job_ability_result_handler.go:438-442 缺失返回 400）；响应类型 `| null` 也不会出现——后端无记录返回 404 而非 null。上轮遗留。最佳实践：careerPositionId 必填、类型改 `Promise<JobAbilityAggregateStatus>`。
- [两轮遗留][handler-02.md] [错误误报 404] exam_handler.go:67-71（Get）、153-157（Update）、230-234（Delete）— 任意错误返回 404"考试不存在"；最佳实践：ErrNotFound 分流。
- [两轮遗留][handler-02.md] [错误吞静默失败] exam_handler.go:292（AddQuestion）、317（RemoveQuestion）、362（UpdateQuestionScore）、402（BulkUpdateScores）— 写操作成功后回读错误被 `exam, _` 吞掉，200 返回变更前旧实体；最佳实践：回读失败 respondServerError。
- [两轮遗留][store-02.md] [N+1] exam_questions.go:63-85 — 每道题先 `SELECT id` 判存在再 UPDATE/INSERT（2 次往返/题），题目多时 N+1 放大；最佳实践：改 `INSERT ... ON CONFLICT (exam_id, question_id) DO UPDATE`（与 exams.go:124 的 AddQuestion 同款写法）单语句完成。
- [两轮遗留][store-02.md] [事务穿透] exams.go:80-86 — `Delete` 先删 `exam_questions` 再删 `exams`，两条语句未包事务，第二条失败时题目已删而试卷残留（半删状态，与上轮修复的 question_banks Delete 同型）；最佳实践：Delete 接收 tx 或内部开启事务。
- [两轮遗留][handler-03.md] [副作用顺序] granular_course_import_handler.go:162-169 — `findOrCreateKnowledgePoints/Resources` 在覆盖权限校验（canOverwriteContent）之前执行，权限不足被跳过时知识点/资源已被创建（孤儿数据）；最佳实践：先做权限判定再创建知识/资源。
- [两轮遗留][frontend-api-client.md] [契约] honors.ts:5-6 — `list` 的 `userId` 声明为可选，后端对业务用户必填、缺失返回 400（student_honor_handler.go:62-66）；学生由后端强制本人。教师端不传必 400。上轮遗留。最佳实践：拆学生（无参）/业务用户（必传 userId）两种签名。
- [两轮遗留][handler-03.md] [租户完整性] hybrid_module_handler.go:61-63 — Upsert 未校验 `node_id` 归属租户（store Create 仅约束本行 tenant_id，hybrid_modules.go:77-87），可将模块写入他租户节点（孤儿行，不可见但脏数据）；最佳实践：Create/ReplaceByNode 前校验 `system_course_nodes.tenant_id = $tenant`。
- [两轮遗留][frontend-shared-types.md] [契约] job.ts:3 — `CareerPosition.code?` 仍标可选，后端 `domain/job.go:27` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] job.ts:23-25 — `favoriteCount?/viewCount?/abilityCount?` 仍标可选，后端 `:45-47` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-api-client.md] [契约] job.ts:72-75 — `saveFull` 响应类型声明 `{ position: CareerPosition }`，后端直接返回岗位对象（position_handler.go:490 `respondJSON(w, http.StatusOK, pos)`），无 position 包装；当前唯一调用方（edu `job/positions/[id]/edit/page.tsx:214`）忽略返回值故无运行时影响，但类型误导后续调用方。上轮遗留。最佳实践：类型改为 `Promise<CareerPosition>`。
- [两轮遗留][service-01.md] [数据丢失] job_ability_aggregator.go:373（联动 store/users.go:474-496）— profiles 以 users 表行回填，若候选学生已删号（scene_evaluation_results 的 evaluatee_id 仍存在），ListProfiles 无该 key，零值 struct 传入 UpsertResult 会把已存的 class_name/major_name 覆写为空串（旧数据被抹白）；最佳实践：profile 缺失的学生跳过 Upsert（或仅更新得分列不动身份列）。
- [两轮遗留][backend-domain.md] [枚举/DB 默认值错位·未修复] lesson.go:107 + 001_baseline:601 — `LessonBatch.Status LessonBatchStatus`（=ContentStatus，open/closed）但 `lesson_batches.status` DB 默认值为 `'active'`；batch_configs.go:96 CreateWithStatus 保证 handler 路径显式写状态，绕过 handler 的插入（种子/脚本）会得到 'active' 与 open/closed 两态冲突；最佳实践：新增迁移把默认值改为 'open'。
- [两轮遗留][frontend-shared-types.md] [契约] lesson.ts:3 — `Course.code?` 仍标可选，后端 `domain/lesson.go:9` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] lesson.ts:30 — `coCreatorIds: string[]` 仍标必填，后端 `:35` `json:"coCreatorIds,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [两轮遗留][frontend-shared-types.md] [契约] lesson.ts:37 — `Course.viewCount?` 仍标可选，后端 `:41` 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][backend-domain.md] [枚举错位·未修复] models.go:85 + status.go:24 — `InstitutionStatus = ContentStatus`，但 DB `institution_status` 枚举只有 pending/approved/disabled（001_baseline:4-8）；ContentStatus 的 draft/rejected/published/open/closed 等值写入该列会被 DB 拒绝，且 'disabled' 无对应常量。本轮核实：Go 代码层无 INSERT/UPDATE institutions 路径（仅 auth.go:129 读取），风险为潜在类型隐患；最佳实践：独立定义 InstitutionStatus 枚举（含 StatusDisabled="disabled"）。
- [两轮遗留][frontend-ui.md] [DOM/ID 冲突] packages/ui/src/components/ui/multi-select-search.tsx:121 — 硬编码 `id="multi-select-all"`；实际已有同页双实例（apps/edu/components/evaluation/random-question-dialog.tsx:485,551 同一弹窗渲染两个），重复 id 导致 htmlFor 关联错乱（点第二个"全选"文本勾选第一个复选框）。最佳实践：`const uid = useId()`，`id={`${uid}-all`}`。
- [两轮遗留][backend-middleware-router.md] [oplog 缓冲]（遗留）oplog_buffer.go:63-69 — `flushLoop` 的 `defer recover()` 记录 panic 后让 goroutine 永久退出（done 关闭、循环终止），此后所有操作日志入队即丢弃且 `Shutdown()` 立即返回，整个审计管线不可自愈。最佳实践：recover 后不 return，继续外层 for 循环（或重启 goroutine）。
- [两轮遗留][backend-middleware-router.md] [oplog 缓冲]（遗留）oplog_buffer.go:121-125 — 批量 `br.Exec()` 错误处理不符合 pgx 语义：单行失败后后续 `Exec()` 复读同一错误，剩余行实际消费与否由服务端决定但本地一律记失败，且每行一条 warn 造成错误风暴。最佳实践：首个错误即 break，统一记一条"N 行成功/第 K 行失败"。
- [两轮遗留][handler-05.md] [回读错误] org_handler.go:177 — `updated, _ := h.Service.Get(...)` 回读错误被忽略：Update 成功但回读失败时返回 200 + null 响应，与 2026-08-07"回读错误改 500"的修复目标不一致；最佳实践：回读失败时 respondServerError。
- [两轮遗留][frontend-shared-types.md] [契约] portrait.ts:10-26 — `StudentAbilityArchive` 仍与后端 `domain/evaluation.go:303-317` 不符（studentName/studentId/className 后端不返回，obtainDate: Date 后端 `*string omitempty` 可空）（上轮未修，apps 无消费者）；最佳实践：标注演示来源，接后端时按 domain 重写。
- [两轮遗留][frontend-shared-types.md] [契约] portrait.ts:44-75 — `StudentAbilityPortrait` 仍与后端 `:279-300` 不符（studentName/studentId/className/majorName/positionName/updatedAt 等 15+ 字段后端不返回）（上轮未修）；最佳实践：同上。
- [两轮遗留][handler-05.md] [回读错误] position_handler.go:488 — SaveFull 成功后 `pos, _ := h.Service.Get(...)` 回读错误被忽略，可能返回 200 + null；最佳实践：回读失败 respondServerError。
- [两轮遗留][handler-05.md] [数据质量] program_course_import_handler.go:182-200 — 岗位名/课程名均未命中现有记录时仍 append 并插入 Name=""、position_id/course_id 均为空的行（空壳课程行），preview 的 Created 也计入这些无效行；最佳实践：解析失败（无法解析岗位或课程）的行计入 errors 并跳过，不落空行。
- [两轮遗留][store-03.md] [安全] query.go:372-390 — ExecuteListQuery 对 Table/SelectColumns/OrderBy/TenantColumn/SearchColumns 做白名单校验，但 CountTable（query.go:420-424）不在白名单内（当前仅硬编码配置、无动态来源，安全但缺纵深）。最佳实践：将 CountTable 纳入 allowedListQueryTables 白名单校验，防未来动态化。
- [两轮遗留][frontend-comp-03.md] [状态管理] question-grading-card.tsx:150 — localScore 仅以 useState(score.toString()) 初始化，父组件 score 变化（如切换考生/重新加载）不会回写，编辑框可能显示过期分数；最佳实践：localScore 派生自 props 时用 useEffect 同步或 key 重建
- [两轮遗留][frontend-comp-03.md] [数据丢失] resource-selector.tsx:342-379/576-578 — loadResources 失败（apiAvailable=false）时上传走本地 id（res-<ts>）路径，该资源不进入 mergedPool，选中后右侧"已选资源"与顶部徽章均不可见、无法取消选择，保存时向后端提交本地假 id 产生悬挂引用；最佳实践：本地资源也塞入 mergedPool，或失败时禁用上传
- [两轮遗留][store-03.md] [事务] resource_bindings.go:108-128 — CreateResource 无事务：资源 INSERT 成功后绑定 INSERT 失败即留孤儿资源；且绑定 INSERT 与 afterBind 错误被 `_ =`/`_` 静默丢弃（courses.resource_ids 同步失败不可见）。最佳实践：三动作包进事务并透传错误；afterBind 失败至少 slog 记录。
- [两轮遗留][backend-middleware-router.md] [未鉴权接口]（遗留）router.go:122 — `GET /uploads/{filename}` 完全公开（无 JWT、无租户隔离）：上传目录全局共享，获得 URL 即可读任意上传文件（作业附件、证件照、含个人信息的导入 Excel）。缓解：文件名 UUID v4 不可枚举、扩展名白名单 + `..` 拒绝 + 前缀校验（file_handler.go:164-189）防穿越与 XSS。最佳实践：至少要求 JWT；更进一步按租户子目录存储。
- [两轮遗留][backend-middleware-router.md] [路由注册]（遗留）routes.go:60-256 — 9+ 组同 method+path 双注册全部依赖 chi"后注册静默胜出"（已核实 chi tree.go `setEndpoint` 直接覆盖 handler 不报错），且全部为"后注册组 = 更宽门禁 + 同一 handler"的有意降权；任何分组顺序调整都会**静默**改变门禁。最佳实践：顶部集中注释表 + 新路由优先单次注册到最宽组。
- [两轮遗留][store-03.md] [租户] scenario_configs.go:29-31、117-121 — ScenarioWeightStore.Upsert / ScenarioGradeStore.Upsert 的 UPDATE 分支仅 `WHERE id=$N` 无租户；已核实 scenario_weight_handler.go:66-88 在 upsert 前同时校验 scenario 与新/旧配置归属，补偿成立。最佳实践：UPDATE 分支加 tenant_id 条件。
- [两轮遗留][handler-07.md] [边界] scenario_import_handler.go:272 — `weight := 100.0 / float64(len(validMethods))`：当列出的测评方式全部无法映射（如错别字）时 validMethods 为空 → Go 浮点除法得 +Inf，Postgres float8 可存储 Infinity，权重静默写入 +Inf 导致后续均分/综合分计算破坏。最佳实践：`len(validMethods) == 0` 时跳过写入（或记 Failed）。
- [两轮遗留][store-03.md] [租户] scenarios.go:95-112、115-152 — Update/Delete 仅 WHERE id 无租户；已核实 scenario_handler.go:215/300 先 Get+verifyTenantOwnership 补偿。最佳实践：Update/Delete 增加 tenantID 参数（fetchScenario 已返回 TenantID 可先比对）。
- [两轮遗留][backend-domain.md] [NULL 扫描风险·未修复] scene.go:16 + store/scenarios.go:205,220 — `Scenario.Difficulty int` 直扫可空列（001_baseline:1010 `difficulty smallint` 无 NOT NULL，CHECK(1-5) 放行 NULL）；存量 NULL 行导致列表/详情扫描报错；Create 路径 handler 直传 int 为 0 时触发 CHECK 拒绝→500；最佳实践：domain 改 `*int` 或 store COALESCE + handler 校验 1-5。
- [两轮遗留][frontend-shared-types.md] [契约] scene.ts:4 — `Scenario.code?` 仍标可选，后端 `domain/scene.go:8` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] scene.ts:14,25 — `viewCount?/taskCount?` 仍标可选，后端 `:27-28` 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] scene.ts:20 — `coBuilderIds: string[]` 仍标必填，后端 `:20` `json:"coBuilderIds,omitempty"` 可空（上轮未修）；最佳实践：改可选。
- [两轮遗留][frontend-shared-types.md] [契约] scene.ts:118 — `RubricTemplate.isDeleted?` 仍标可选，后端 `:64` 无 omitempty 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][frontend-shared-types.md] [契约] scene.ts:214 — `SceneBatch.scenarioCount?` 仍标可选，后端 `:179` 必返（上轮未修）；最佳实践：改必填。
- [两轮遗留][backend-infra.md] [并发/多实例] scheduler/scheduler.go:21-35 — 多副本部署时每实例每天 02:00 各自执行 `AggregateAllPublished`，重复计算并写入重复汇聚日志（CreateLog 每 target 一条）。最佳实践：用 `pg_try_advisory_lock` 做跨实例单飞，抢锁失败者直接跳过本次。
- [两轮遗留][store-03.md] [租户] scheduling.go:302-308 — CreateSchedule 内 `UPDATE teaching_plan_entries SET status='scheduled' WHERE id=$1` 无租户/计划归属校验，plan_entry_id 由请求携带时依赖调用方先校验；同理 DeleteScheduleWithRestore:337-343。最佳实践：经 teaching_plans 联表加 `p.tenant_id` 条件（参照 teaching_plans.go:391-397 的 UPDATE...FROM 写法）。
- [两轮遗留][frontend-shared-types.md] [契约] shared-models.ts:16 — `User.email: string` 仍标必填，后端 `domain/models.go:58` `*string json:"email,omitempty"` 可空（上轮未修）；最佳实践：改 `email?: string`。
- [两轮遗留][frontend-shared-types.md] [类型] shared-models.ts:35 — `Collaborator.addedAt: Date` 仍标 Date（上轮未修）；最佳实践：改 string。
- [两轮遗留][handler-07.md] [静默] staff_title_handler.go:190-192 — ToggleStatus 更新后回读 `title, _ = h.Store.GetByID(...)`、`count, _ := h.Store.CountUserRefs(...)` 错误全部忽略：回读失败时 200 响应携带零值/旧数据（与上轮"回读错误改 500"修复不一致）。最佳实践：回读失败统一 `respondServerError`。
- [两轮遗留][handler-07.md] [校验缺失] student_portrait_handler.go:253-290 — CreateArchive 未像 Generate（200-209 行）那样校验 `userId` 属于当前租户/存在性，业务用户可为本租户创建指向他租户用户的档案行（本租户内数据污染、列表渲染异常）；最佳实践：复用 Generate 的用户归属校验。
- [两轮遗留][frontend-api-client.md] [契约] system.ts:71-78 — `approvalApi.review` 请求体含 `nextStepIdx`，后端 `ReviewApprovalRequest` 仅 action/remark（approval_handler.go:46-49），按步骤审批参数被静默丢弃、流转实际由后端 CurrentStepIdx 推进，前端"指定步骤"无效且无报错。上轮遗留。最佳实践：后端补齐 stepIdx 或前端移除。
- [两轮遗留][handler-08.md] [租户隔离] task_knowledge_ability_handler.go:44、93 — `BindKnowledge`/`BindAbility` 未像 Unbind 路径一样校验 task 的租户归属；store 层仅按调用方 tenant_id 插入绑定行（store/scenario_configs.go:204-219），可对他人租户任务/知识点/能力点建立跨租户绑定行（需猜测 UUID，泄漏面有限但产生脏数据）；最佳实践：Bind 前复用 `verifyTaskTenant` 链路校验。
- [两轮遗留][handler-08.md] [租户隔离] task_resource_handler.go:165-169 — `BindResource` 未校验 task 归属（Unbind 路径做了 task→scenario→tenant 链路校验），store `ResourceBindingStore.Bind`（store/resource_bindings.go:132-147）仅按调用方 tenant_id 插入且不校验 bindID/resource 归属，可对他人任务/资源建立跨租户绑定行；最佳实践：Bind 前校验 `TaskScenarioID`+`ScenarioTenantID`。
- [两轮遗留][handler-08.md] [静默失败] teaching_plan_handler.go:173 — `Get` 中 `entries, _ :=` 忽略回读错误：计划存在但条目查询失败时返回 200 + 空条目，前端误判无条目；最佳实践：走 `respondServerError`。
- [两轮遗留][handler-08.md] [静默失败] teaching_plan_handler.go:293 — `Confirm` 后 `plan, _ :=` 回读失败返回 200 + null；最佳实践：`respondServerError`。
- [两轮遗留][store-03.md] [错误处理/事务] teaching_plans.go:403-410 — UpdatePlanEntry 的 teaching_plan_entry_classes 删除与插入错误被 `_ =`/`_` 忽略且不在事务内，中途失败留下旧班级关联或空关联，且与主体 UPDATE 非原子。最佳实践：纳入事务并透传错误。
- [两轮遗留][store-03.md] [租户] tenant_admins.go:128-138 — ResetPassword 仅 WHERE id 无租户；若未来放开非平台管理员调用即越权改密。最佳实践：增加 tenantID 参数。
- [两轮遗留][handler-08.md] [静默失败] tenant_handler.go:209、240、353、378、625 — `Update`/`UpdateStatus`/`AdminUpdate`/`AdminUpdateStatus`/`UpdateSchoolAdmin` 回读一律 `tenant, _ :=`，回读失败返回 200 + null；最佳实践：`respondServerError`（UpdateSchoolAdmin 的 Admin 版本已正确 500，本组应统一）。
- [两轮遗留][handler-08.md] [静默失败] training_program_handler.go:393 — `Clone` 成功后 `program, _ :=` 回读失败返回 201 + null；最佳实践：`respondServerError`。
- [两轮遗留][frontend-ui.md] [竞态] packages/ui/src/hooks/use-async.ts:51-70 — refresh 无请求序号守卫：deps 快速变化（筛选联动）时，先发出的慢请求可能后返回并覆盖新数据，与仓库近期「8 处前端竞态请求序号守卫」的标准不一致。最佳实践：useRef 请求序号 `seqRef.current++`，await 后 `if (seq !== seqRef.current) return`。
- [两轮遗留][handler-08.md] [错误吞静默] user_relation_handler.go:92-95 — `Create` 任何错误一律 400"发起者或目标不在租户中"：DB 故障/唯一冲突等真实错误被误标为客户错误，前端无法区分；最佳实践：区分 `pgx.ErrNoRows`/业务错误走 400，其余 `respondServerError`。
- [两轮遗留][store-03.md] [事务] users.go:187-203 — BatchDelete 两条 DELETE 无事务，第二条失败时 user_roles 已删、users 残留（用户仍在但角色消失）；Delete（167-174）角色计数递减错误被忽略且与主删分离。最佳实践：包进 withTxStore。

- 其余为本轮新增/回归发现，明细见 problems.md（08-08）第三章与 raw/。

### 3.2 上轮遗留、本轮未复现报告的 P2（307 条，待确认）

> 这些条目 08 轮未再报告——大部分属上轮已修复（git 记录佐证），部分可能为批次覆盖差异。列出供核对：

- [07遗留待确认][frontend-ui.md] [逻辑缺陷] PlatformSideNav.tsx:95-103 — 展开状态 effect 每次都执行 `[...defaultExpanded, ...activeParents, ...prev]` 并 setExpandedItems：① 只要某父项处于 active 路径，手动折叠后下一次路由变化会被强制重新展开，用户折叠意图被覆盖；② 集合只增不减（prev 永远并入），长期导航后展开项单调膨胀；最佳实践：折叠/展开交由用户显式控制，effect 仅在初始化/配置变化时设置默认展开，不再把 prev 并入；或将 active 父项展开与用户折叠状态分开管理。
- [07遗留待确认][frontend-lib.md] [i18n] 全站共 47 处正则命中中，去重后**确认缺失 3 个 key**，其中本次审查范围内 1 个：
- [07遗留待确认][frontend-lib.md] [i18n] 硬编码中文残留（不经 t() 直接渲染或作为常量）：hybrid-eval.ts 模块标签、navigation-config/menu-permissions 全部导航标签、resource-type-constants 报错文案、use-org-tree/use-submitter-names 错误兜底、org-type-icons 类型名 —— 详见各文件条目。
- [07遗留待确认][frontend-app-03.md] [i18n] 第 171-177 行阶段下拉直接渲染原始枚举值 `{v}`（archived/terminated 等显示英文），未走 `t()` 翻译，与第 163-167 行 `allianceLabel` 显示不一致。
- [07遗留待确认][frontend-app-02.md] [一致性] 行 95-112 — `handleMove` 用 `Promise.all` 并发更新全部推荐顺序；若中途某个 update 失败，其余已成功更新，列表出现**部分排序生效**且无回滚（随后 refresh 拉回服务端状态，视觉上"排序失败"但服务端已部分变更）。最佳实践：串行逐个更新或失败时反向补偿。
- [07遗留待确认][frontend-app-02.md] [内存/生命周期] 行 48-55 — 课程/批次字典加载无取消守卫，组件卸载后可能 setState。轻微。
- [07遗留待确认][backend-migrations.md] [回滚不对称] 102_program_course_position.down.sql:1-2 — down 仅重建 scenario_id 列，up 中 DELETE 清空的数据无法恢复，且 down 无任何"数据不可恢复"提示；回滚后表结构对称但数据永久丢失。最佳实践：up 中 DELETE 前做备份表（如 INSERT INTO ..._backup SELECT ...）或在 down 提供还原脚本。
- [07遗留待确认][backend-migrations.md] [外键缺失] 091_certification_weights.up.sql:9 — tenant_id 无 REFERENCES tenants 外键（后续 115/116 的租户级联清理也未覆盖此表），租户删除时产生孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [07遗留待确认][backend-migrations.md] [外键缺失] 101_alliance_brand.up.sql:4,23,58,75,96,112,137,167,185,201,214,236 — 12 张联盟表（alliance_school_info/enterprises/enterprise_agreements/projects/milestones/achievements/experts/agreements/permissions/dictionaries/brands/brand_topics）tenant_id 均 NOT NULL 但无 REFERENCES tenants 外键，115/116 也未补：租户删除不级联清理，产生孤儿数据（联盟模块数据量随合作企业/项目增长后不可忽略）。最佳实践：统一加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [07遗留待确认][backend-migrations.md] [外键缺失] 123_eval_standard_copy.up.sql:11 — task_eval_score_rules.tenant_id 无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [07遗留待确认][backend-migrations.md] [外键缺失] 124_certification_point_levels.up.sql:4-6 — tenant_id/career_position_id/ability_point_id 均无外键（引用 tenants/career_positions/ability_points），租户删除产生孤儿数据。最佳实践：tenant_id 加 `REFERENCES tenants(id) ON DELETE CASCADE`，其余两列加逻辑外键。
- [07遗留待确认][backend-migrations.md] [外键缺失] 127_community.up.sql:4 — community_topics.tenant_id 无 REFERENCES tenants 外键（115/116 之后新增，未被覆盖），租户删除不级联，帖子孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [07遗留待确认][backend-migrations.md] [外键缺失] 129_student_honors.up.sql:4 — tenant_id 无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联，荣誉记录孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [07遗留待确认][backend-migrations.md] [外键缺失] 136_tenant_settings.up.sql:3 — tenant_id 无 REFERENCES tenants 外键，租户删除残留配置孤儿行（settings 无 created_by 亦无 FK 其他列）。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [07遗留待确认][backend-migrations.md] [外键缺失] 137_resource_tags.up.sql:4,13 — tags.tenant_id 与 resource_tag_relations.tenant_id 均无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联。最佳实践：两表 tenant_id 均加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [07遗留待确认][backend-migrations.md] [多租户隔离] 092_affairs.up.sql:70-89 — teaching_plan_entries 无 tenant_id 列（同批次 092 的 terms/training_programs/teaching_plans/venues/period_slots/schedule_entries 均有），仅经 plan_id→teaching_plans 间接归属租户，查询/过滤需多表 JOIN，跨租户数据隔离依赖应用层。最佳实践：补 tenant_id 列并加索引。
- [07遗留待确认][backend-migrations.md] [多租户隔离] 101_teaching_plan_entry_classes.up.sql:2-6 — 关联表无 tenant_id 列（同号 101 的另一迁移 alliance_brand 全部带 tenant_id，092 教务表也带），且 PK 仅 (entry_id, class_node_id)；虽然 entry_id 经 teaching_plan_entries 间接归属租户，但跨租户组织节点 id 若碰撞会造成跨租户班级串入。最佳实践：加 tenant_id 列并纳入 PK/复合索引。
- [07遗留待确认][frontend-app-03.md] [契约] 第 40 行 `?isFeatured=true` 参数被后端忽略（见 landing 条），"品牌展示"实际是最近 6 条。
- [07遗留待确认][frontend-app-03.md] [契约] 第 83 行 `allianceAchievementApi.create(item)` 中 `enterpriseIds/projectIds/secondaryColleges` 随 item 提交，后端支持；但第 48-57 行初始 item 未含 `relatedPositions` 等字段，创建后这些字段为空，与编辑页字段集不一致（编辑页可维护关联，新建后需二次编辑）— 功能缺口。
- [07遗留待确认][frontend-app-02.md] [引用节点资源绑定] 行 678-696 — quote 节点（refType=original）在 `buildNodeSavePayload` 中不携带 resourceIds，但**本地资源上传循环对所有真实节点执行**：引用模式下选中的颗粒课资源（handleGrainConfirm 行 552-554 已 setSelectedResourceIds）若命中 `res-`/本地池资源，会被 `nodeResourceApi.create+bind` 绑到引用节点上，与"引用不可编辑"语义冲突。最佳实践：引用节点跳过资源持久化。
- [07遗留待确认][frontend-app-03.md] [性能] 同 login 页第 34-39 行：搜索无防抖 + limit 10000 全量拉取。
- [07遗留待确认][frontend-app-03.md] [性能] 第 34-39 行：搜索时 `limit: 10000` 全量拉取，且 `loadLogs` 随 `searchTerm` 每次击键变化 → useEffect 重新执行，**无防抖**，快速输入触发多次万级记录请求；最佳实践：输入防抖（300ms）。
- [07遗留待确认][frontend-app-03.md] [性能] 第 40-48 行：对每个项目**串行** `await allianceProjectApi.listMilestones(p.id)`（N+1 请求链），项目数多时列表加载极慢；最佳实践：改为 `Promise.all` 并发，或后端一次性返回里程碑统计。
- [07遗留待确认][frontend-app-02.md] [截断] 行 141 — `courseResourceApi.list({ courseId, limit: 10000 })` 超过后端 maxPageSize（200）被截断，资源中心数据不完整且无提示。最佳实践：分页拉取或多页合并。
- [07遗留待确认][frontend-app-03.md] [数据丢失] 第 55-79 行：加载失败（网络瞬时错误）时 `item` 保持初始空值且 `loading=false`，页面渲染空表单而非错误/不存在提示（对比 achievements/[id]/edit 有 `if (!item)` 空态分支，本页缺失）；用户误以为是新建表单，填写保存后 PUT 全列覆盖（协议无 ValidateUpdateExisting 兜底）→ 原记录内容被替换。最佳实践：加载失败后区分错误/空态，`item` 为空时禁用保存。
- [07遗留待确认][frontend-app-02.md] [数据完整性] 行 275-283 — 新建课程（editId 为 null）时自定义知识点 `knowledgeApi.create({ sourceId: editId })` 写入 sourceId=null；保存后 `router.replace` 带新课程 id，再次加载时 `k.sourceId === editId` 匹配不到这些知识点 → 不再被识别为"课程自定义"，后续编辑改名/描述**静默不再同步**（仅保留绑定关系）。最佳实践：创建课程拿到真实 id 后补一次 `knowledgeApi.update` 回填 sourceId。
- [07遗留待确认][backend-migrations.md] [数据正确性] 094_course_assessments.up.sql:12-19 — 回填 UPDATE 仅按 `c.code = se.course_code` 匹配 courses，未加 tenant 维度过滤；courses.code 仅租户内唯一（uq_courses_tenant_code），跨租户同 code 时可能把其他租户课程的 course_id 错误写入本租户排课。最佳实践：加 `AND c.tenant_id = se.tenant_id`。
- [07遗留待确认][backend-migrations.md] [数据破坏] 102_program_course_position.up.sql:2 — `DELETE FROM training_program_courses` 无条件清空业务数据，down 不恢复（见 102 down 记录）；若线上已有人培方案课程数据，该迁移直接丢数据。最佳实践：数据清理类操作应从部署流程分离执行并人工确认，或至少将 DELETE 限制为目标 schema 并记录执行前备份。
- [07遗留待确认][frontend-app-03.md] [权限语义] 第 307-310 行：`perms.menus` 缺失（学校管理员/平台管理员等"不限菜单"角色）时回显为全选；一旦在权限弹窗点保存，`savePermissions`（第 346-355 行）会把全量 `menus` 写入，将"不限制"变成显式白名单 — 后续新增页面/菜单不会自动可见，权限语义发生不可逆变化。最佳实践：menus 缺失时提示"当前角色不限制菜单"并禁止一键保存，或保存时剔除全选集合。
- [07遗留待确认][frontend-app-03.md] [状态不同步] 第 66-82 行 `handleCreate` 成功后仅 `setSearchText('')`：若搜索框本就为空，`setSearchText('')` 状态不变 → `useAsync` deps（第 63 行 `[searchText]`）不触发 → **新建的关系不会出现在列表中**，需手动刷新；最佳实践：创建成功后显式 `refresh()`。
- [07遗留待确认][frontend-app-02.md] [状态陈旧] 行 97-111 — `customKnowledgePointIds` 在 effect 内先 `setCustomKnowledgePointIds(new Set())` 再逐条 functional update，随后**同步**读取 `customKnowledgePointIds.has(k.id)`（行 108）用的是本次渲染的陈旧空集合快照，导致池中所有课程自定义知识点 `linked` 恒为 true，自定义标识在复选框中不生效。最佳实践：在 effect 内先构建完整 Set 局部变量，一次 setState。
- [07遗留待确认][frontend-app-02.md] [竞态] 行 132-156 — 节点/混合模块加载 effect 依赖 `[id, course, targetNodeId]`，无 cancelled 守卫，切换 id 时旧响应可覆盖。最佳实践：加取消标志。
- [07遗留待确认][frontend-app-02.md] [竞态] 行 181-192 — 字典加载 Promise 无 cancelled 守卫，卸载后 setState（React 18 无警告但属隐患）；且该结果未被任何地方使用（同上）。
- [07遗留待确认][frontend-app-02.md] [竞态] 行 182-191 — `nodeEvaluationResultApi.list` 无取消/序号守卫，快速切换节点时旧响应可能覆盖新节点结果。最佳实践：引入 cancelled 标志或 AbortController。
- [07遗留待确认][frontend-app-02.md] [竞态] 行 524-590 — `handleGrainConfirm` 异步拉取颗粒课详情后 setKnowledgePoints/setSelectedResourceIds 无守卫，期间切换节点会把颗粒课数据写入错误节点。最佳实践：回填前校验 selectedNodeId 未变化。
- [07遗留待确认][frontend-app-02.md] [竞态] 行 610-613 — `handleEdit` 中 `loadPositionScenes` 与 `learnRoadApi.list` 并行，若用户快速连续点击两个岗位（按钮仅由 `editLoading` 禁用，点击第二行时第一行的 loading 尚未 setState 生效），先发起的请求可能后返回覆盖后发起的场景数据。最佳实践：保存请求序号或用 `editLoading` 同步阻塞 + 校验 `editingPosition.id` 是否仍为当前。
- [07遗留待确认][backend-migrations.md] [编号重复] 101_teaching_plan_entry_classes.up.sql:1 — 与 101_alliance_brand 同号（runner 按文件名排序可正确执行，两个 101 无依赖；风险同上 097）。
- [07遗留待确认][backend-migrations.md] [编号重复] 129_user_favorites.up.sql:1 — 与 129_student_honors 同号（runner 按文件名排序可正确执行，无依赖；风险同上 097）。
- [07遗留待确认][frontend-app-02.md] [跨类型] 行 143 — `setHours(String(c.onlineHours ?? c.offlineHours ?? ''))`，混合课程线上/线下小时语义混用，仅用于展示，轻微。
- [07遗留待确认][frontend-app-02.md] [跨节点状态残留] 行 273/280、322/341 — `submittedMethodKeys`/`hybridSubmittedKeys` 以 methodKey 为键、**切换节点不重置**；若节点 B 与节点 A 配置了相同 methodKey，切到 B 后卡片直接显示"已提交/pending"（`overriddenResult` 行 708-714 短路），用户误以为已提交。最佳实践：提交键带上 nodeId，或在 activeNodeId 变化时清空。
- [07遗留待确认][backend-migrations.md] [迁移健壮性] 111_graduation_archive_unique.up.sql:1-2 — ADD UNIQUE 约束前未清理存量重复（对照 112/114 均先 DELETE 去重再建约束）；若线上 graduation_project_archives 已存在 (topic_id, user_id) 重复记录，本迁移直接失败阻断部署。最佳实践：建约束前按 114 模式先 DELETE 保留最早一条。
- [07遗留待确认][backend-migrations.md] [迁移健壮性] 113_exam_questions_unique.up.sql:1-2 — 同 111：ADD UNIQUE (exam_id, question_id) 前无存量重复清理，线上重复则迁移失败。最佳实践：先 DELETE 去重再 ADD CONSTRAINT。
- [07遗留待确认][frontend-app-02.md] [部分失败] 行 354-381 — 新课程 `courseApi.create` 成功后 `persistNewResources` 失败会走 catch，此时课程已创建但 URL 未替换（router.replace 未执行），用户重试保存会**再创建一门重复课程**。最佳实践：create 成功后先 replace URL 再持久化资源。
- [07遗留待确认][frontend-app-02.md] [部分成功误导] 行 115-139 — 实体 create/update 成功后才 `saveTags`，标签保存失败会整体 catch 并 toast"保存失败"，但实体实际已保存——用户重试会**重复创建**。最佳实践：标签失败单独 toast 且不阻止关闭弹窗。
- [07遗留待确认][frontend-app-02.md] [重复加载覆盖] 行 167-233 — 编辑加载 effect 依赖 `abilityPool`（行 233），abilityPool 首次填充后 effect 重跑，重复拉取并重置 courseName/nodes/selectedNodeId 等全部状态，存在覆盖用户编辑窗口。修复同 hybrid（去依赖或一次加载）。
- [07遗留待确认][frontend-app-02.md] [静默丢失] 行 632-647 — 自定义知识点 `knowledgeApi.create` 失败仅 reportError 继续，后续 `resolveKnowledgePointIds` 把 `kp-custom-*` 过滤掉 → 该知识点从保存中**静默消失**，用户只看到一条控制台错误。最佳实践：失败即中止保存并 toast。
- [07遗留待确认][store-01.md] [性能] abilities.go:151-204 — `ListUncited` 的 COUNT 与 LIST 两条 SQL 均含 4 个 NOT EXISTS 相关子查询（同上无 ability_point_id 索引），全表扫描；最佳实践：同上一并加索引。
- [07遗留待确认][frontend-app-01.md] [数据丢失] affairs-config-import-dialog.tsx:30 — `importExcel('affairs-config' as any, files[0])` 只导入第一个文件；导入向导允许选择多文件时其余文件被静默忽略。最佳实践：限制单选，或在多文件时逐个导入/提示。
- [07遗留待确认][frontend-app-03.md] [契约] 第 107、121、142 行 `(project as any).agreementIds` — shared-types `AllianceProject`（alliance.ts:67-85）**未声明 agreementIds 字段**，全靠 `as any`；后端实际返回/写入 agreement_ids（alliance_project_store.go:103），运行时 OK，但类型契约缺失。
- [07遗留待确认][frontend-app-03.md] [契约] 第 116-118 行与第 73-91 行：`relatedPositions/relatedScenes/relatedCourses` 运行时为 `[{id,name}]` 对象数组，但 shared-types `AllianceAchievement.relatedPositions?: string[]`（alliance.ts:116）类型声明错误；若历史数据为字符串数组（导入/旧数据），`ref.name`/`removeItem` 的 `x.id` 过滤将失效。建议修正 shared-types 类型为 `RelatedRef[]`。
- [07遗留待确认][frontend-app-03.md] [契约] 第 89-91 行：`(item as any).enterpriseIds / projectIds / secondaryColleges` — 依赖后端返回这些字段；已核实后端 `ScanAchievementRows`（alliance_achievement_store.go:26-43）返回 enterprise_ids/project_ids/secondary_colleges，运行时 OK，但类型层面 shared-types 的 `AllianceAchievement` 缺 `secondaryColleges` 之外的字段声明，全靠 `as any` 绕过。
- [07遗留待确认][frontend-app-03.md] [契约] 第 259 行 `/alliance/public/achievements?sort=latest`：后端 `ListPublicAchievements`（alliance_achievement_store.go:148）固定 `ORDER BY created_at DESC LIMIT 100`，忽略 sort 参数（默认即最新，无实际影响，但参数是无效契约）。
- [07遗留待确认][handler-01.md] [错误被吞] alliance_handler.go:66 — `updated, _ := h.Store.GetSchoolInfo(...)` 忽略错误，回读失败时响应 200 body 为 null；最佳实践：错误走 respondServerError。
- [07遗留待确认][handler-01.md] [错误被吞] alliance_handler.go:151、187 — `item, _ := h.Store.GetEnterpriseAgreementByID(...)` 忽略错误，失败时 201/200 返回 null；最佳实践：错误走 respondServerError。
- [07遗留待确认][handler-01.md] [错误处理] alliance_handler.go:436-441 — `GetPermission` 将 store 所有错误（含 DB 故障）响应 404；最佳实践：区分 pgx.ErrNoRows 与内部错误。
- [07遗留待确认][frontend-app-03.md] [逻辑] 第 53-56 行 `p.accountName.toLowerCase()` — 若后端返回 accountName 为 null（空账号名）会抛 TypeError 导致整行渲染崩溃；后端 create 校验 accountName 非空（alliance_handler.go:460），风险低，但建议 `(p.accountName || '')` 防御。
- [07遗留待确认][handler-01.md] [数据丢失] alliance_handler.go:613-628 — `UpdateDictionaryItem` 未携带 name 时会把字典项名称更新为空串（store/alliance_dictionary_store.go:49-54 全列覆盖）；最佳实践：请求未携带字段时回退 GetDictionaryByID 的现有值。
- [07遗留待确认][frontend-app-03.md] [契约] 第 40 行（alliance/page.tsx）`/alliance/public/brands?isFeatured=true`：后端 `ListPublicBrands`（alliance_handler.go:722）仅读取 `brandType` 参数，`isFeatured` 被静默忽略；"推荐品牌"实际展示的是最近 12 条且前端再按 `isFeatured || isPublic` 过滤（第 304 行），语义与"推荐"不符。
- [07遗留待确认][frontend-api-client.md] [契约] api-helpers.ts:136-140 + auth.ts:16 — `getToken`/`request` 的平台解析依赖 `NEXT_PUBLIC_DEFAULT_PLATFORM` 与 `window.location.pathname`；`/auth/me` 路由仅在 SaaS 平台组注册（routes.go:248），若在默认 portal 平台的应用中调用 `authApi.me()`（见 auth.ts:16），会携带 portal token 请求被 `RequirePlatform(saas)` 拒绝 → 401 → 清除 portal token 并跳登录页，造成会话被误清。最佳实践：`me()` 显式使用 `saasRequest`（与 `saasMe` 一致），或后端对 `/auth/me` 放宽平台校验。
- [07遗留待确认][frontend-api-client.md] [超时] api-helpers.ts:162-196 — `requestWithPlatform` 的 `fetch` 未设置任何超时/`AbortSignal`；后端虽有 30s（导入导出 10min）超时中间件，但客户端在网络挂起时 UI 会无限等待，且无用户取消机制（页面跳转/关闭后请求仍在跑）。最佳实践：为 fetch 挂 `AbortSignal.timeout()`（读接口 30s、导入导出按场景放宽）并透传外部 AbortSignal。
- [07遗留待确认][handler-01.md] [越权] appeal_handler.go:101-138 — `Process` 仅校验登录与租户归属，无任何角色/权限校验：本租户任意登录用户（含学生）可审批（approved/rejected）他人申诉；最佳实践：增加教师/管理员角色校验（如 canManageAlliance 类似的角色检查）。
- [07遗留待确认][handler-01.md] [并发竞态] approval_handler.go:160-196 — "all" 审批模式下并发审批：两条请求都读到 pending 记录、各自 append 历史后整段写回 History（UpdateApprovalHistory 全量覆盖），后写覆盖先写，可能丢失已通过的审批记录或重复推进；最佳实践：历史追加改为 SQL `history = history || $1::jsonb` 原子追加，或对 status/step 加条件更新（WHERE status='pending'）。
- [07遗留待确认][handler-01.md] [错误被吞] approval_handler.go:175、196、221 — `record, _ = h.Service.GetApproval(...)` 忽略错误，回读失败时 200 返回 null；最佳实践：回读失败走 respondServerError。
- [07遗留待确认][store-01.md] [越权] approvals.go:75-84 与 187-204 — `Get`/`fetchApproval` 按 id 查询无 tenant 过滤（approval_records 是租户表，TenantScoped=true）；handler 若未先校验租户归属即可读他租户审批记录；最佳实践：Get 加 tenantID 参数并过滤。
- [07遗留待确认][store-01.md] [越权] approvals.go:127-136 / 139-148 / 151-160 — `UpdateHistory`/`RejectRecord`/`AdvanceRecord` 均只按 `id` 过滤（CAS 仅防并发，不防越权），任一调用路径漏校验即跨租户操作审批；最佳实践：统一增加 tenantID 参数。
- [07遗留待确认][frontend-comp-02.md] [状态管理] archive-list-page.tsx:91,103-120,215-248 — 搜索/侧栏筛选变化时不清空 selectedIds：批量操作可作用于不在当前列表中的条目（筛选后残留选择）；且批量操作异常抛出时（无 try/catch）选择同样被清空，用户丢失选择。最佳实践：onSearchChange/onSidebarSelect 时联动清空选择；批量操作失败时保留选择并提示。
- [07遗留待确认][frontend-comp-01.md] [性能/状态] auth-provider.tsx:67-99 — `fetchMe` 依赖 `pathname`，每次路由变化都重新调用；且当进入公共页面时执行 `setState({ loading: false })`（无 `me` 字段），会**清空已登录用户状态**，用户从私有页切到公共页再返回时经历状态丢失 + 重新拉取的闪烁；最佳实践：公共页面仅跳过拉取、保留旧 state（`setState(prev => ({ ...prev, loading: false }))`），并把拉取条件改为「token/首次加载」而非 pathname。
- [07遗留待确认][frontend-shared-types.md] [契约] backend.ts:83 — `Role.status: string` 必填，后端 `domain/unified.go:217` 无 omitempty 必返，一致（无问题）；`StaffTitle.status`（83）同理一致。
- [07遗留待确认][frontend-comp-01.md] [并发竞态] bank-question-selector-panel.tsx:118-137 — `handleSelectBank` 连续切换题库时旧 `loadQuestions` 请求未取消，先发后至的响应会覆盖新题库列表（显示错误的题目集合）；最佳实践：用请求序号/AbortController 丢弃过期响应。
- [07遗留待确认][frontend-comp-01.md] [后端契约/数据不完整] bank-question-selector-panel.tsx:121 — `questionApi.list({ bankId, limit: 1000 })` 被钳制为 200，题库题目超过 200 时列表截断，剩余题目无法被选中；最佳实践：分页加载或按类型/搜索分批聚合。
- [07遗留待确认][handler-01.md] [数据被覆盖] batch_handler.go:227-233 — `UpdateWithStatus` 配置下，请求未携带 status 时强制重置为 `StatusOpen`：仅改名称/编码的局部更新会把已关闭（closed）的批次静默重开；最佳实践：status 为空时保持原值（不写 status 列），只有显式传入才更新。
- [07遗留待确认][store-01.md] [越权] batches.go:204-220（UpdateFields）/223-229（Delete）/232-238（UpdateStatus）— 均无 tenant 过滤，仅靠调用方先 `TenantOf()` 校验（147-154 提供了该校验入口，说明设计如此）；一旦任一 handler 漏调 TenantOf 即跨租户写；最佳实践：把这些方法统一改为要求传入 tenantID 并 `AND tenant_id=$n`（或提供带租户的变体），把校验内聚进 store。
- [07遗留待确认][frontend-app-04.md] [错误吞掉] career-tab.tsx:275-299 — 两个收藏列表请求失败时 `.catch(() => null)` 静默降级为空收藏，用户无法区分「没有收藏」与「加载失败」。最佳实践：至少展示错误提示。
- [07遗留待确认][frontend-app-04.md] [乐观更新顺序] career-tab.tsx:308-327 — 先 await 接口成功再 removeFavorite，失败回滚天然正确；但 jobs 路径调用 `positionApi.favorite(id)`（后端为 toggle 语义，已核实 position_handler.go ToggleFavorite），单次调用即取消收藏，正确。无问题。
- [07遗留待确认][handler-01.md] [契约不一致] cert_grade_handler.go:95-123 — 某年级无组件/无榜单数据时 `CompData`/`Leaderboard` 保持 nil，JSON 序列化为 `null` 而非 `[]`，与前端"数组"契约不符（前端需判空）；最佳实践：初始化 `CompData: []CompGroupDTO{}`、`Leaderboard: []LeaderboardEntryDTO{}`。
- [07遗留待确认][handler-01.md] [错误被吞] certification_handler.go:470 — `rule, _ := h.Service.GetCertificationRule(...)` 忽略错误，保存成功但回读失败时 200 返回 null；最佳实践：回读失败走 respondServerError。
- [07遗留待确认][frontend-comp-02.md] [错误被吞] citation-stats-panel.tsx:62-69 — fetchStats 失败静默 setStats(null)，页面显示 '-' 无任何错误提示；建议至少 console/reportError 留痕。
- [07遗留待确认][frontend-app-04.md] [竞态] community-tab.tsx:89-106 — `loadTopics` 无 cancelled/序号保护，快速切换 sort 时旧响应可能覆盖新排序的列表。最佳实践：记录请求序号，仅应用最新。
- [07遗留待确认][frontend-app-04.md] [错误吞掉] community-tab.tsx:162-166 — `submitPost` 失败仅 `reportError` 无用户提示，用户点击发布后无任何反馈（弹窗保持打开，无 toast）。最佳实践：失败时 toast 提示。
- [07遗留待确认][frontend-comp-02.md] [UX] content-list-page.tsx:399 — 每次 loadData 都 `setExpandedBatches(全部展开)`，用户折叠状态在每次操作后的 refresh 中丢失。
- [07遗留待确认][frontend-comp-02.md] [并发竞态] content-list-page.tsx:460-464 — loadData 无取消/序号保护，reloadKey 连续 bump（连续操作触发 refresh）时多个请求并发，先发的慢响应可能覆盖后发的新数据，列表回退到旧状态。
- [07遗留待确认][frontend-comp-02.md] [部分失败不一致] content-list-page.tsx:600-612,969-983,990-1009 — 提交审批均为"先 submit 再 approvalApi.create"两步：第二步失败时实体已进入 pending 但无审批记录，仅 toast 错误；用户重试又会触发 submit → pending→pending 后端 400。最佳实践：create 失败时提示"已提交但审批未创建，请勿重复提交"或后端合并为单接口。
- [07遗留待确认][frontend-comp-02.md] [逻辑 bug] content-list-page.tsx:792-810 — CSV 导出 `importExportApi.export(exportEntityName)` 不带选中 ids，导出全部数据；而按钮文案/禁用态为"选中项导出"（Excel 路径 exportXxxExcel(selectedIds) 是正确的），行为与语义不符。
- [07遗留待确认][frontend-comp-02.md] [提交/保存] course-evaluation-rules-dialog.tsx:119-135 — 对话框「保存」仅校验权重并关闭，真实持久化依赖父级 onChange 链路，保存失败无提示、错误不透传；若父级未保存，用户看到的是"已保存"的假象。
- [07遗留待确认][store-01.md] [越权] course_clone.go:82-116 — `CloneCourse` 不校验源课程 `oldCourseID` 的租户归属（tenantID 参数仅用于新行），若调用方漏校验，可将他租户课程结构克隆进本租户（跨租户数据复制）；`FetchSource`(52-77)/`FetchCourse`(527-558) 亦无租户过滤；最佳实践：CloneCourse/FetchSource 增加源课程租户校验（如旧课程 tenant 不匹配直接报错）。
- [07遗留待确认][handler-02.md] [性能] course_export_handler.go:171-189 — lookupCourseAbilityPointNames 对每个能力点 ID 单独执行一条 QueryRow（N+1）；叠加 fillCoursesData 每课程 2 条额外查询（majors/lesson_batches:72-78）+ 每节点 3 条查询（148-150），大规模导出（数百课程/节点）时产生数百至数千次往返。最佳实践：能力点名称批量 `WHERE id = ANY($1::uuid[])` 一次查询。
- [07遗留待确认][handler-02.md] [错误处理] course_handler.go:465-469 — SubmitHomework：`exists, err := ...; if err != nil || !exists` 将 DB 内部错误与"不存在"同等对待，DB 故障静默返回 404"作业不存在"。最佳实践：err != nil 时走 respondServerError。
- [07遗留待确认][handler-02.md] [契约] course_handler.go:498-520,616-637 — ListHomeworkSubmissions/ListNodeHomeworkSubmissions 响应仅含 items 无 total 且 items 为 map[string]any 手拼，缺少 total 字段与 ListResponse 通用结构不一致。最佳实践：与前端确认契约后统一为 ListResponse。
- [07遗留待确认][handler-02.md] [错误处理] course_handler.go:583-587 — SubmitNodeHomework 同上（err != nil || !exists → 404）。最佳实践：区分 DB 错误与不存在。
- [07遗留待确认][handler-02.md] [数据丢失] course_import_handler.go:186-204 — overwrite 模式下对已存在课程 UPDATE 后立即 clearCourseNodes 删除全部节点/测评（201-202行），若后续同名课程节点导入因 Excel 错误中断，原课程节点数据已不可恢复（非事务）。最佳实践：overwrite 导入整体放入事务，失败回滚。
- [07遗留待确认][handler-02.md] [性能] course_node_handler.go:315-454 — enrichCourseNodes 每次 List/Get 对知识/资源/测验/作业/继承源做 5 组批量查询，正确避免 N+1，但 List 场景无分页（ListConfig NoPagination），全量节点逐批富化，数据量大时响应延迟。最佳实践：评估前端列表是否需要全量节点，必要时分页。属于可接受权衡，仅提示。
- [07遗留待确认][store-01.md] [数据一致性] course_nodes.go:180-183 — `Delete` 只删 `system_course_nodes` 一行，不清理 `node_knowledge_point_bindings`/`node_resource_bindings`/`node_quizzes`(+questions)/`node_homeworks`(+submissions)/`hybrid_node_modules`/`node_evaluation_results` 等子表（这些表无 ON DELETE CASCADE），删节点后产生孤儿数据；最佳实践：事务内级联清理。
- [07遗留待确认][handler-02.md] [契约] course_resource_handler.go:97-124 — Create 响应手拼 domain.NodeResource 且仅含部分字段（无 total 等），与 ListResources 的 ListResponse 结构不一致。最佳实践：统一响应结构。
- [07遗留待确认][frontend-app-01.md] [数据丢失] courses-tab.tsx:121-128 — 加载时按 positionId 将多行合并为一行且只保留 `v[0]`（丢弃其余行的学分/学时配置）。后端 `training_program_courses` 是按行存储、不按岗位场景展开（backend/internal/store/training_programs.go:145 PutCourses 逐行插入），一旦同一 positionId 存在多条不同配置的记录（如用户重复添加同一岗位），重载合并后编辑保存将静默丢失其余行配置。最佳实践：加载时保持原始行（同岗位多行均展示），仅在展示统计层按岗位聚合；或后端保存时按岗位展开成多行与前端口径一致。
- [07遗留待确认][handler-02.md] [错误处理] crud.go:187 — crudUpdate 回读错误同样丢弃（`item, _ :=`），返回 200 + 零值对象。最佳实践：同上。
- [07遗留待确认][frontend-app-04.md] [竞态] dashboard-tab.tsx:53-69 — 请求无 cancelled 保护，角色切换（activeRoleCode 变化）时旧请求可能晚到覆盖新数据。最佳实践：加 cancelled 标志或 AbortController。
- [07遗留待确认][frontend-comp-02.md] [静默 no-op] data-provider.tsx:257-270 — approve/reject 时查不到 pending 审批记录则静默跳过（仅刷新列表），用户点「通过」无任何反馈。建议无记录时 toast 提示。
- [07遗留待确认][backend-infra.md] [配置副作用] db.go:26-28 — `statement_timeout=15000` 全局默认应用在**所有**连接上：调度器 30 分钟汇聚任务（scheduler.go:26）、迁移 DDL、复杂报表的单条语句只要超过 15 秒即被取消；且该参数无法在调用方按需放开（除非改 URL 或单独 SET）。最佳实践：默认不设或仅对短事务连接设置；长任务/迁移连接显式 `SET statement_timeout = 0`。
- [07遗留待确认][frontend-comp-02.md] [后端契约] eval-method-card.tsx:326-329 — 提交载荷 `maxScore: 100` 硬编码；后端按 max_score 计分/展示（packages/api-client lesson.ts:249-251），若测评配置最大分 ≠ 100（如 50 分制），成绩与展示错位。最佳实践：从 method.resourceConfig/规则配置取 maxScore，缺省再回退 100。
- [07遗留待确认][frontend-lib.md] [逻辑] evaluation-rule-store.ts:345-347 — 导出配置时把所有 `homework` 反向映射为 `exam`，但 `'exam'` 不在 `EvalRuleMethodKey` 类型联合内（shared-types:5-11），且仅映射了 `evaluationMethods` 数组，`methodWeights`/`methodEvalObjects`/`methodResourceConfigs` 等兄弟字段仍保留 `homework` 键 → 导出配置内部键不一致；若父组件传入真实的 `homework` 方法（合法 key），导出后会被改写为 `exam`。当前调用方（course-evaluation-rules-dialog）通过二次归一化掩盖了此问题，但任何新消费方直接读 `onChange` 结果都会踩坑；最佳实践：导出时按"输入即输出"原样透传方法键，仅对来源为 `exam` 的做还原。
- [07遗留待确认][frontend-comp-01.md] [状态不持久化] evaluation-rules-editor.tsx:394-396,2014-2043 — `qbDrawMode`（答题方式：全部作答/自由刷题）与 `qbPassRate`（正确率）是纯本地 state，从未写入 `methodResourceConfigs`，关闭弹窗/刷新即丢失，且对保存结果无任何影响（自由刷题开关形同虚设）；最佳实践：随 `updateResourceConfig('question_bank', {...})` 持久化。
- [07遗留待确认][frontend-comp-01.md] [后端契约/数据不完整] evaluation-rules-editor.tsx:441 — `randomDrawQuestionApi.list({ limit: 9999 })` 被钳制为 200：现场问答题超过 200 条时，「新增现场问答题」面板/详情/选择全部缺失；最佳实践：分页或后端提供全量模式。
- [07遗留待确认][frontend-comp-01.md] [后端契约/数据不完整] evaluation-rules-editor.tsx:539 — `examApi.list({ limit: 1000 })` 被钳制为 200：试卷超过 200 份时「选择已有试卷」列表截断且无提示；最佳实践：分页加载 + 搜索。
- [07遗留待确认][frontend-shared-types.md] [契约] evaluation-scene.ts:75,87-91 — `userId?/positionCompetency?/positionCompetencyV2?/abilityCognitionScore?` 标可选，后端 handler 全部无 omitempty 必返（:39,54-58）；最佳实践：改必填。
- [07遗留待确认][frontend-shared-types.md] [契约] evaluation-scene.ts:77 — `JobAbilityResult.studentId` 必填，后端 `StudentNo *string json:"studentId,omitempty"`（:41）可空；最佳实践：改可选。
- [07遗留待确认][backend-domain.md] [NULL 扫描风险] evaluation.go:91 — `Exam.Version string` 直接扫描 DB 列 `exams.version`（001_baseline:427 定义，**无 NOT NULL**）；同一查询中 description 已用 `*string` + 判空处理（store/exams.go:208-212），version 却没有——任何 NULL version 行将导致 fetchExam/ScanExamRows 扫描报错（列表/详情 500）；最佳实践：domain 改 `*string` 或 SQL `COALESCE(e.version, '')`。
- [07遗留待确认][service-01.md] [租户隔离契约缺失] evaluation_cert.go:92-94, 117-119, 157-185 — `ListCertificationItems(ruleID)`、`ListCertificationPoints(itemID)`、`GetCertificationFull(ruleID)`（及其内部 `ListFullItems`/`ListFullPoints`/`ListTasksByPointIDs`）均无租户限定参数，与同文件其他接口（`GetCertificationRuleByTenant`/`UpdateCertificationItem(tenantID)` 等）的租户限定风格不一致。若 handler 未先校验 ruleID/itemID 归属（`GetCertificationRuleByTenant` 可作校验途径），存在跨租户读取窗口。最佳实践：这些读取改为带 tenantID 的 Scoped 版本，或在 handler 先做归属校验。
- [07遗留待确认][service-01.md] [错误吞导致静默失败] evaluation_exam.go:21-26 — `ListExams` 中 `BatchFetchExamQuestions` 失败仅以 `qErr == nil` 静默忽略，试卷列表返回空 `Questions`，前端无任何提示；题目批量拉取失败属数据完整性展示问题。最佳实践：失败时返回错误（或至少 slog.Error 并在响应中体现差异）。
- [07遗留待确认][service-01.md] [错误吞导致静默缺失] evaluation_exam.go:95-98 — `ListExamCenter` 中 `UserClassNodeID` 错误被吞，`classNodeID` 取空串，学生端按班级过滤的考试（`Participatable`/`ClassMatch`）会静默全部消失，学生无法看到/参加本班考试且无报错。最佳实践：返回 error 或在失败时明确降级行为。
- [07遗留待确认][store-02.md] [越权防御缺失] evaluation_methods.go:86-96 — `Toggle` 仅按 id 更新 `enabled`，无 tenant 过滤（依赖 handler 先调 `TenantID` 校验）。属全库既有模式（store 提供 `TenantID()` 供 handler 前置校验），非新问题，但 `Toggle` 内部先 `Get` 后 `UPDATE` 两段式也不具原子性。最佳实践：`UPDATE ... WHERE id = $2 AND tenant_id = $3`。
- [07遗留待确认][store-02.md] [越权防御缺失] evaluation_methods.go:183-193 — `AppealStore.Process` 按 id 直接改 status，无租户过滤（依赖 handler 前置校验）。同 `Toggle`。
- [07遗留待确认][handler-02.md] [契约] evaluation_result_handler.go:66-70 — List 中学生强制 ownOnly 覆盖其余过滤参数（忽略 page/类型等），前端学生端若传其他参数静默失效。最佳实践：与前端确认契约（当前实现有注释说明，属设计取舍，仅提示）。
- [07遗留待确认][handler-02.md] [错误处理] evaluation_result_handler.go:214 — Grade 评分成功后回读 `res, _ = h.Service.GetEvaluationResult(...)` 错误丢弃：DB 故障时返回 200 + "null" 响应体（此前 Get 已返回过完整实体，回读失败会清空响应）。最佳实践：回读失败 respondServerError。
- [07遗留待确认][handler-02.md] [性能] evaluation_result_handler.go:230-246 — BatchGrade 对每个 item 串行 GetEvaluationResult + 租户校验（N+1 到数据库），大批量评分时延迟累积。最佳实践：批量查询或保留（评分批次通常小），仅提示。
- [07遗留待确认][store-02.md] [越权防御缺失] evaluation_results.go:110-122 — `Grade` 仅按 `id + status='pending'` 更新，无 tenant 过滤（依赖 handler）。
- [07遗留待确认][store-02.md] [错误处理] evaluation_results.go:125-135 — `BatchGrade` 不检查 `RowsAffected`：任一 id 不存在或已评分时静默跳过，与单条 `Grade` 返回 `ErrNotFound` 的行为不一致，批量评分可能"看起来成功"实则漏评。最佳实践：逐条检查 RowsAffected 并汇总失败。
- [07遗留待确认][store-02.md] [输入校验] evaluation_results.go:140-159 — `FindLatestExamResult` 将 `tem.resource_config->>'paperId'/'examId'` 直接 `::uuid` 强转，若历史配置值非合法 UUID（项目中 learn_roads.go:82-91 注释已承认存在 "SHA1 伪 UUID" 脏数据）则整条查询报错 500。最佳实践：cast 前 `NULLIF` + 正则/长度过滤，或使用宽松比较。
- [07遗留待确认][handler-02.md] [边界] exam_handler.go:206 vs 129 — Update 传入的 BatchID 未像 Create（emptyStrToNil:129）做空串归一化：客户端传 `"batchId": ""` 时 batch_id 写入空串到 uuid 列触发 22P02 → 500；且由于 178-180 行 nil 才回退 existing，空串既不能清空 batchId 也不报 400。最佳实践：Update 同样 emptyStrToNil，或校验后 400。
- [07遗留待确认][handler-03.md] [数据一致性] exam_import_handler.go:160-176 — 覆盖模式的 DELETE 与后续 importExamQuestions 写入分属两条独立连接流程（非事务）。若中途失败，试卷处于"题目被清空但新题目未写完"的中间态；最佳实践：overwrite 的更新+清题+写题包在一个事务内。
- [07遗留待确认][handler-03.md] [数据一致性] exam_import_handler.go:176 — 覆盖模式 `DELETE FROM exam_questions WHERE exam_id=$1` 错误被 `_, _ =` 完全吞掉。若删除失败（锁/连接抖动），旧题目残留、新题目以 sort_order 从 1 重新插入，出现重复题目/排序错乱，且无任何日志与错误提示；最佳实践：检查错误并记日志（或计入 result.Errors 让用户感知），同时建议删除与新写入放同一事务。
- [07遗留待确认][handler-03.md] [逻辑] exam_import_handler.go:240 — 题目分值 `parseFloatDefault(col(row,2), 0)`，非数字/空值静默记 0 分，导致试卷总分会失真且用户无感知；最佳实践：非空但非法分值应计入 Errors 提示。
- [07遗留待确认][store-02.md] [无事务] exam_questions.go:13-93 — 整体 prune+update+recalc 无事务包裹（函数接收 q 而非 tx），中途失败留下部分同步状态。最佳实践：调用方在 tx 内调用（当前调用方需确认）。
- [07遗留待确认][store-02.md] [边界] exam_questions.go:15 — `DELETE ... WHERE exam_id = $1 AND NOT (question_id = ANY($2))`：questionIDs 为空数组时 `NOT (x = ANY('{}'))` 恒真，删除该试卷全部题目。若调用方空列表语义为"无变更"则误删全部；当前语义依赖调用方（全量同步），建议显式注释或空列表短路返回。
- [07遗留待确认][handler-03.md] [契约] exam_result_handler.go:118-137 — Get 无"结果归属学生"校验：同租户内任意学生可凭 id 读取其他学生的考试结果详情（Create/List 均按本人/班级限制，此处不一致）；最佳实践：学生角色强制 `result.UserID == claims.UserID`。
- [07遗留待确认][store-02.md] [边界] exam_results.go:37-40 — `ListConfig.ExtraFilter` 无条件追加 `er.exam_usage_id = $n`（`usageId` 为空串时过滤 `= ''` 返回空列表而非报错/全量），与其它 store 的"空值不过滤"约定不一致。
- [07遗留待确认][handler-03.md] [逻辑] exam_usage_handler.go:159 — manualOnly 仅当 `usage.TargetType != nil` 才校验手动类型：TargetType 为 NULL 的考试安排（异常数据/旧数据）可被任意编辑删除，绕过"自动创建不可改"约束；最佳实践：nil 视同非手动类型拒绝。
- [07遗留待确认][store-02.md] [读路径写库] exam_usages.go:56-57 — `Get` 每次调用先执行 `SyncScheduledExamUsageStatus(ctx, s.q, "", now)`：tenantID 为空 → UPDATE 覆盖**全租户**的 scheduled 考试安排（行锁 + updated_at 写放大），一个读请求触发全局写。`List`（:30）同样。最佳实践：仅 List/Get 携带租户时同步，或将状态流转改为定时任务。
- [07遗留待确认][store-02.md] [一致性] exam_usages.go:168-214 — `ListExamCenter` 以 `JOIN users u ON u.id = eu.creator_id` 过滤租户，creator_id 为 NULL（历史/自动生成的安排）时行被静默丢弃；同文件 `ListConfig` 直接用 `tenant_id` 列（:39-40），两套口径不一致。
- [07遗留待确认][store-02.md] [越权防御缺失] exams.go:65-86/100-177 — `Update`/`Delete`/`AddQuestion`/`RemoveQuestion`/`UpdateQuestionScore`/`BulkUpdateScores`/`RecalcExamTotal` 全部仅按 id 操作、无 tenant 过滤（依赖 handler 前置 `TenantID()` 校验）。全库既有约定，列为风险点而非新缺陷。
- [07遗留待确认][store-02.md] [并发一致] favorites.go:59-93 — `ToggleFavorite` 为 check-then-act 两段式：并发双击/双端切换时，两个请求都可能通过 EXISTS 检查后各自执行 INSERT（后者被 ON CONFLICT DO NOTHING 吃掉）却**仍然执行 cnt+1**，或 DELETE 与 INSERT 交错导致 favorite_counters 漂移、返回状态与实际相反。最佳实践：单条 `INSERT ... ON CONFLICT DO NOTHING` + 依据 RowsAffected 决定增减，或对 counter 的增减也用 RowsAffected 判定。
- [07遗留待确认][handler-03.md] [安全] file_handler.go:91-133,141-166 — allowedServeExts 白名单包含 `.js`/`.bat`/`.cmd`/`.sh` 等可执行文本类型，而 CSP sandbox 仅作用于 xssRiskyExts（html/htm/svg/xml/xbrl）。同源 `/uploads/*.js` 以 text/javascript 直出（无 Content-Disposition: attachment），若应用内存在任何可控 `<script src="/uploads/..">` 注入点即成存储型 XSS 载体；最佳实践：对非白名单可执行类型统一附加 `Content-Disposition: attachment` 或对代码类扩展也加 sandbox+CSP。
- [07遗留待确认][handler-03.md] [逻辑] file_handler.go:225 — `sort.Slice(images, func(i, j int) bool { return i < j })` 是空操作排序（恒真比较索引），多页 PPT 转 png 后图片顺序与页码无关，翻页预览顺序错误；最佳实践：按 `e.Name()` 解析页码排序（如 slide1.png → 1）。
- [07遗留待确认][frontend-comp-01.md] [重复提示] global-api-error-handler.tsx:10-28 — api-helpers.ts:189-191 对**所有**非 401 错误回调全局处理器（无论调用方是否自行 catch），而本组件对所有 4xx/5xx 一律弹 toast：与组件内本地 toast 的 catch 分支（如 exam-form-dialog 上传失败、evaluation-rules-editor 保存失败等均先本地 toast）叠加形成**双 toast**；最佳实践：全局处理器仅处理「未被消费的」错误（如 request 层增加 consumed 标记），或全局只做 console/上报不弹 toast。
- [07遗留待确认][frontend-shared-types.md] [契约] graduation.ts:18-21 — `startDate/endDate: Date` 且必填，后端 `*string json:"startDate,omitempty"`（:332-333）可空字符串；`createdAt: Date`（21）同文件多处 Date 类型为 ISO 字符串。
- [07遗留待确认][frontend-shared-types.md] [契约] graduation.ts:34-40 — `GraduationProjectArchive` 的 `topicName/studentName/advisorName/enterpriseMentorName?/positionName` 后端均不返回（后端仅 id/topicId/userId/phase/docStatus/docCount/hasRectification/lastUpdated，:339-348）。
- [07遗留待确认][frontend-shared-types.md] [契约] graduation.ts:50-54 — `GraduationProjectEvaluation.topicName/studentName/studentId/comprehensiveGrade: EvaluationGrade` 必填，后端不返回或 `ComprehensiveGrade *string omitempty`（:358）可空。
- [07遗留待确认][frontend-shared-types.md] [契约] graduation.ts:64-65 — `GraduationQueryResult.className/majorName` 必填，后端 `*string omitempty`（:368-369）可空。
- [07遗留待确认][handler-03.md] [边界] graduation_handler.go:103-104,146-147 — `time.Parse(time.RFC3339, req.StartDate)` 错误被忽略：非法日期静默变为 0001-01-01T00:00:00Z 落库，后续查询/排序出现"零日期"记录；最佳实践：解析失败返回 400，并校验 startDate < endDate。
- [07遗留待确认][handler-03.md] [并发] graduation_handler.go:203-211 — ApplyTopic 先在 handler 层 `AppliedCount >= Capacity` 预检，随后 service 才落库，两次并发申请可同时通过预检导致超容量；属于"核心业务加锁防重复"范畴；最佳实践：容量校验+自增放同一事务（store 层条件 UPDATE 原子判断）。
- [07遗留待确认][store-02.md] [边界] graduations.go:101-140 — `ApplyTopic` 用 `applied_count < capacity` 判满：capacity 默认 0（CreateTopic :63 写入 0）时任何申请都"已满"。若 0 代表"不限名额"则申请永远失败；若 0 代表"不可选"则应与前端校验一致。另：满员回滚依赖 `fmt.Errorf("topic full")` 字符串比较（:134），应改用哨兵错误。
- [07遗留待确认][frontend-comp-02.md] [错误被吞] hybrid-modules-view.tsx:251-257 — `evalRuleConfigToMethods(ruleConfig)` 异常被 try/catch 吞掉 → methods=[] → 整个评价模块卡片静默消失，无任何提示；规则数据损坏时学生端完全无感知。最佳实践：catch 后至少渲染「评价规则异常」占位。
- [07遗留待确认][frontend-comp-03.md] [数据丢失] image-list-upload.tsx:74-83 — `handleFiles` 直接 `queueRef.current = list.filter(...)` 覆盖队列：若用户在前一批文件仍在上传/正在编辑（editTarget 打开）时再次选择文件，前一批剩余文件被静默丢弃，且 `editTarget` 被新文件覆盖（正在编辑的图片在 `finishEdit` 时以新 target 回调，编辑结果写错对象）。最佳实践：追加队列 `[...queueRef.current, ...files]`，或在 `uploading || !!editTarget` 时拒绝选择。
- [07遗留待确认][frontend-ui.md] [错误处理缺失] import-wizard-dialog.tsx:99-106 — `handleDownload` 的 try 块无 catch：`onDownload()` 抛错时只有 finally 复位 loading，错误变成 unhandled promise rejection，用户无任何反馈；最佳实践：catch 后用 toast 提示下载失败。
- [07遗留待确认][frontend-ui.md] [错误处理缺失] import-wizard-dialog.tsx:108-117 — `handleImport` 同样无 catch：`onImport()` 抛错时导入状态复位但用户无反馈（调用方 useImportFlow 内部的 executeImport 有 catch，但受控模式传入的 onImport 可能直接抛错）；最佳实践：catch 并 toast。
- [07遗留待确认][frontend-ui.md] [无障碍] import-wizard-dialog.tsx:176-192 — 上传区是一个 div+cursor-pointer+onClick，无 `role="button"`/`tabIndex`/键盘事件，键盘用户无法触发文件选择；最佳实践：改为 `<label>`+隐藏 input 或补 `role="button" tabIndex={0} onKeyDown`。
- [07遗留待确认][frontend-ui.md] [事件处理缺陷] import-wizard-dialog.tsx:184-191 — file input 选择后未重置 `e.target.value`：用户先添加文件再移除，再次选择同一文件时 `onChange` 不会触发（input value 未变），表现为"点了没反应"；最佳实践：onChange 末尾加 `e.target.value = ''`。
- [07遗留待确认][handler-03.md] [安全] import_export_handler.go:139-154 — CSV 导出未做公式注入防护：单元格以 `=`、`+`、`-`、`@` 开头时，Excel/WPS 打开后作为公式执行（CSV injection）；数据源是用户可控的名称；最佳实践：导出前对这类前缀加 `'` 前缀或制表符转义。
- [07遗留待确认][handler-03.md] [越权] import_export_handler.go:341-355 — 通用实体覆盖导入（overwrite=true）**无创建者权限校验**（对比 exam/granular 导入的 canOverwriteContent）：任意用户可覆盖更新租户内他人创建的题库/试卷/课程/岗位/场景（仅按 name/code 匹配）；最佳实践：查重时一并取 creator 并按 canOverwriteContent 校验，无权限计入 PermissionSkipped。
- [07遗留待确认][store-02.md] [越权防御缺失] industries.go:19-20 — 嵌入 DictStore 的 `GetByIDSQL`/`UpdateSQL`/`DeleteSQL` 均无 tenant_id 过滤，`DictStore.GetByID/Update/Delete`（dict_store.go:56-85）不带租户参数。当前 handler 层用 crud 框架 `CheckOwnership`（industry_handler.go:53,95）兜底，但 store 层自身不隔离，任何绕过 handler 的调用方可跨租户读写；learn_roads.go:60-80 已对该问题给出带租户参数的正确改法，此处未跟进。最佳实践：参照 learn_roads，重写 GetByID/Update/Delete 为 `... WHERE id=$1 AND tenant_id=$2`。
- [07遗留待确认][frontend-comp-01.md] [后端契约/数据不完整] job-home.tsx:169,202,209,236 — `scenarioApi.list`/`publicPositionApi.list`/`taskApi.list` 均传 limit:1000 被钳制为 200：岗位/场景超过 200 时首页总数、筛选、排行榜与详情页数据全部截断且无提示；最佳实践：服务端分页 + 搜索参数，或接受截断并展示「仅展示前 200」。
- [07遗留待确认][handler-03.md] [错误处理] job_ability_result_handler.go:280,454 — `err == pgx.ErrNoRows` 相等比较而非 errors.Is，service 包装错误时误走 500 而非 404。
- [07遗留待确认][store-02.md] [性能] job_ability_results.go:129-185 — `ListJobAbilityResults` 每行执行 `departmentNameSQL`（LATERAL 递归组织链 + org_types 关联），全量扫描 job_ability_results 后排序分页；`summary`（:223-248）对 certification_rules LEFT JOIN 无 `r.position_id` 索引保障。对照 migrations/118_workspace_indexes 未见 job_ability_results 相关索引。数据量增长后为大表全扫描。
- [07遗留待确认][handler-04.md] [字段清空] job_banner_handler.go:18-24,83-91 — 请求体 `IsEnabled bool` 非指针（LinkURL 用 `*string` 可区分"未传"），crudUpdate 全量覆盖时前端未传 `isEnabled` 会隐式清零为 false，导致更新任意字段（如仅改标题）后轮播图被禁用。最佳实践：`IsEnabled *bool`，UpdateFn 中 nil 时回填现有值（参照 learn_road_handler.go 的部分更新回填模式）。
- [07遗留待确认][handler-04.md] [测试必红] job_handler_test.go:1054-1070 — TestLearnRoad_CRUD 的 Create 请求 `"positionIds": ["pos-1"]` 非合法 UUID，store 层 `normalizePositionIDs`（store/learn_roads.go:82-91）会丢弃非法 ID 后落库 `position_ids=[]`，随后断言 `len(r.PositionIDs) != 1`（1068 行）必然失败（Update 的 `["pos-1","pos-2"]` 同样被过滤）。最佳实践：测试数据改用 `uuid.NewString()`，或断言空列表。
- [07遗留待确认][frontend-comp-02.md] [性能] knowledge-graph-d3-view.tsx:181-195,213-472 — ResizeObserver 每次尺寸变化都会触发全量重建（simulation 重启、节点位置/缩放丢失、fitTimer 重新执行）；窗口缩放/字体调整时图谱跳动明显。最佳实践：尺寸变化仅调整 svg viewBox，不重建 simulation；或将重建节流（requestAnimationFrame 合并）。
- [07遗留待确认][frontend-comp-02.md] [残留渲染] knowledge-graph-d3-view.tsx:213-214 — `filteredNodes.length === 0` 直接 return 不清空 g 元素；节点数据由有变无时旧图残留（外壳层 emptyView 只在 nodes 初始为 0 时兜底）。最佳实践：空数据时 `g.selectAll('*').remove()`。
- [07遗留待确认][frontend-comp-02.md] [性能] knowledge-graph-view.tsx:145-149 — filteredNodes/filteredEdges 每次渲染重建（未 memo），ReactFlow 每帧收到新引用触发全量 reconcile；connectedIds 已 memo，此处建议一并 useMemo。
- [07遗留待确认][frontend-comp-03.md] [并发竞态] knowledge-selector.tsx:204-230,243-264 — `handleSceneChange`/`handlePositionChange` 无序号/取消保护：快速连续切换场景或岗位时，先发出的请求后返回会覆盖后发请求的 `filterKpIds`（fetch 覆盖，筛选结果错乱）；搜索（158-177）有 `searchSeqRef` 保护而筛选没有。最佳实践：与搜索一致加 seqRef 比对或 AbortController。
- [07遗留待确认][frontend-comp-03.md] [错误吞掉] knowledge-selector.tsx:355 — `handleSaveKp` 的 `onAddCustom?.(...)` 同步调用不 await：新建知识点名称与 pool 之外后端已有 KP 冲突时（findNameCollision 只查 pool/searchResults/selected，309-315 未覆盖懒加载的 allKps）后端返回 409，onAddCustom 的 rejection 无人捕获 → 未处理 Promise rejection、界面无提示。最佳实践：`await onAddCustom(...)` 并 catch 展示错误；或把冲突校验扩到 allKps。
- [07遗留待确认][frontend-app-04.md] [权限] portal/layout.tsx:28-36 — 工作台守卫只放行 teacher/student/school_admin，但企业导师（enterprise_mentor）被重定向到 /portal；而 workspace/page.tsx:357-359 明确为 enterprise_mentor 保留了兜底视图并拉取 dashboard，两者矛盾：enterprise_mentor 永远无法访问工作台。最佳实践：守卫放行 enterprise_mentor 或删除 workspace 中的对应分支。
- [07遗留待确认][frontend-shared-types.md] [契约] lesson.ts:125 — `NodeResource.url: string` 必填，后端 `domain/lesson.go:134` `*string omitempty` 可空；`uploadedAt?: string`（128）标可选，后端 `:138` 必返；最佳实践：url 改可选、uploadedAt 改必填。
- [07遗留待确认][handler-04.md] [契约/顺序] lesson_behavior_handler.go:176-178,257-259,309-315,317-333 — SignInDaily/AttendanceRateData/StudentDetails 均由 map（dailyMap/rateMap/studentMap）遍历拼装，Go map 迭代顺序随机：无日期排序、无学生排序，前端趋势图/表格每次刷新顺序不定（与展示契约不一致）。最佳实践：按日期/名字排序后输出。
- [07遗留待确认][store-02.md] [性能] lesson_content.go:30-49 — `CitationStats` 对 courses/node_knowledge_point_bindings/question_bank_knowledge_points/questions 四个表做相关子查询计数，knowledge_points 全表扫描 ×4 表无索引保障（对照 118_workspace_indexes 无 knowledge_points 相关索引）。
- [07遗留待确认][store-02.md] [类型脆弱] lesson_content.go:139-155/158-174 — `Create`/`Update` 将 `domain.JSONSlice`（[]interface{}）直接作为参数写入 `granular_lesson_ids uuid[]` 列（baseline:578），依赖 pgx 反射把 []any 包装成数组按 uuid 元素编码：元素为非法 UUID 字符串时编码报错 500，且语义依赖 pgx 内部机制。课程侧同场景的正确写法是 `[]string` + `$23::uuid[]` 显式转换（courses.go:107/119-123）。最佳实践：参数改 `[]string` 并用 `$N::uuid[]`。
- [07遗留待确认][service-02.md] [与 handler/store 契约不一致] lesson_content.go:186-188（GetCourse）、295-297（GetCourseDetail）— 两个课程读取接口不携带 tenantID，unscoped 直读；当前 handler 调用点（clone 后回查、`content_actions.transition` 先 `GetTenantID` 再 fetchCourse）均有租户前置校验所以暂未形成越权，但接口本身无防呆，后续新调用点遗漏校验即产生跨租户读取；同文件 `GetCourseDetailInTenant`（300-302）才是带租户版本，双接口并存易误用；最佳实践：统一为仅保留带 tenantID 的接口，unscoped 变体收敛到 contentActions 内部使用或明确注释调用前提
- [07遗留待确认][service-02.md] [明显逻辑 bug] lesson_content.go:514-548、551-617、620-629 — 测评实体生成"只增不删"：规则配置删除某份试卷（paperIds 清空）、清空题目（questionBankQuestions/quizQuestions 为空）或移除 homework 子规则后重新发布，已创建的 exam_usage / 临时考试 / 节点作业不会回收，学生仍会看到已从配置中移除的考试与作业；`applyRuleConfig` 对 `len(questionIDs)==0` / `len(paperIDs)==0` 直接 return 不清理；最佳实践：发布时对"该节点当前 rules 不再包含"的 usages/homework 执行清理（对比期望集合后删除），或至少在重新发布时全量重建该节点的测评实体
- [07遗留待确认][backend-infra.md] [配置继承] cmd/migrate/main.go:24-36 — migrate 通过 db.New 建立连接池后 Acquire，连接继承了 db.go:26-28 的 `statement_timeout=15000`；任何单条迁移 DDL 超过 15 秒即失败（大表建索引、数据回填类迁移在数据量上来后必然踩中），导致部署中断。最佳实践：Acquire 后先执行 `SET statement_timeout = 0`（迁移进程单飞，无需超时）。
- [07遗留待确认][backend-infra.md] [启动顺序/优雅退出] cmd/server/main.go:56 + scheduler.go:40-43 — defer 逆序整体正确（sched→router→oplog→redis→db），但 sched.Stop() 会无限等待运行中任务（任务自身 ctx 上限 30 分钟），docker stop 默认 10 秒超时后 SIGKILL 强杀，正在执行的汇聚任务被中断、聚合表可能留下部分写入。最佳实践：Stop 增加带超时的等待（如等待最多 2 分钟），或任务端保证幂等可重跑。
- [07遗留待确认][backend-infra.md] [配置矛盾] cmd/server/main.go:62 — `WriteTimeout: 120 * time.Second` 与 routes.go:19-31 中 import/export/templates 的 10 分钟超时豁免直接矛盾：大文件导出/导入写响应阶段超过 120 秒会被服务器强制断连，客户端拿到截断文件（无错误响应），豁免形同虚设（另部署 nginx 反代 proxy_read_timeout 默认 60s 进一步收窄）。最佳实践：统一三层超时口径，导出类接口 WriteTimeout 放宽或改用流式分块写入。
- [07遗留待确认][backend-infra.md] [迁移执行逻辑] cmd/migrate/main.go:211-213 — `isMultiStatement` 以 `strings.Count(sql, ";\n") > 1` 判定，行为依赖尾随换行：两语句文件以 `;\n` 结尾 → 走 execMultiSQL（非事务）路径；以 `;` 结尾（无尾随换行）→ 走单语句事务路径。同一内容因换行差异执行方式不同，且文件中的 `-- 注释;` 行（注释以分号结尾）会被误计为多语句。最佳实践：按 `;` 结尾的语句分割并去掉纯注释/空块后再判定，或改用文件内显式指令标记。
- [07遗留待确认][backend-infra.md] [幂等缺失] cmd/migrate/main.go:215-241 — execMultiSQL 逐条非事务执行：中间语句失败时，之前的语句已生效但 schema_migrations 未记录版本，重跑会重放已成功的语句（如 `CREATE TABLE`/`INSERT` 报 already exists），需要手工回滚清理；另外按 `;\n` 分割不感知字符串字面量/PL/pgSQL 函数体内的 `;\n`，会被错误截断（该情况会报错暴露而非静默）。最佳实践：失败时对已执行语句回滚（依赖配套 .down.sql）或先备份整段 SQL 供人工处置；分割需识别函数体。
- [07遗留待确认][frontend-comp-03.md] [与后端契约] major-select.tsx:42-46 — `limit: 1000` 被后端 `ParsePageLimit` 钳制到 MaxPageSize=200（backend/internal/handler/common.go:126 `MaxPageSize = 200`），专业数 >200 时列表静默截断且无分页/提示。最佳实践：参照 knowledge-selector 的 `fetchAllPages` 分页拉全量，或显式注明 200 上限。
- [07遗留待确认][store-02.md] [越权防御缺失] majors.go:19-20 — 同 industries：DictStore 的 GetByID/Update/Delete 无租户过滤，靠 handler crud `CheckOwnership`（major_handler.go:52）兜底；learn_roads 已给出正确改法未跟进。
- [07遗留待确认][frontend-lib.md] [i18n] menu-permissions.ts:42-69,181-257 — `buildMenuTree` 与 `permissionModuleConfig` 的平台名/落地页/动作标签全部硬编码中文，这些标签直接渲染在角色权限配置界面；EN 模式下不经过 `t()` 仍显示中文；最佳实践：label 处接入 `t()` 或引入集中式 key。
- [07遗留待确认][store-02.md] [越权防御缺失] micro_cert.go:77-116 — `GetTemplate`/`UpdateTemplate`/`DeleteTemplate` 均无租户过滤（依赖 handler 前置 `TemplateTenantID` 校验，既有约定；`DeleteTemplate` 连带的 `DELETE FROM cert_issuance_records WHERE template_id=$1` 也无租户条件）。
- [07遗留待确认][handler-04.md] [错误吞掉] micro_cert_handler.go:136,182 — CreateTemplate/UpdateTemplate 回读 `template, _ := h.Store.GetTemplate(...)` 忽略错误，插入/更新成功后回读失败仍返回 201/200 空结构体（静默失败）。最佳实践：错误时 respondServerError 并记录日志。
- [07遗留待确认][handler-04.md] [字段清空] micro_cert_handler.go:162-180 — UpdateTemplate 的 `CertTypeID string` 非指针，请求未传 certTypeId 时 `normalizeCertTypeID("")=""` 直接覆盖既有 cert_type_id 为空（同文件 coverImage 用 `*string` 可区分未传，语义不一致）；前端若部分更新模板即清空证书类型。最佳实践：CertTypeID 改 `*string`，nil 时回填现有值。
- [07遗留待确认][handler-04.md] [数据丢失] micro_cert_handler.go:186-213 + store/micro_cert.go:110-116 — DeleteTemplate 连带 `DELETE FROM cert_issuance_records WHERE template_id = $1` 永久删除全部证书发放记录（历史凭证），handler 无任何提示/确认。最佳实践：删除模板时提示将级联删除发放记录，或软删除/保留记录。
- [07遗留待确认][backend-infra.md] [边界条件] middleware.go:118-119 — 限流语义为 `current > limit` 才拒绝（limit+1 触发），且 X-RateLimit-Reset 用 `time.Now().Add(window)` 而非实际过期时刻，与 Redis TTL 过期点不一致；429 响应无 Retry-After 头。功能可用，仅语义偏差，建议补充 Retry-After。
- [07遗留待确认][frontend-ui.md] [无障碍] multi-select.tsx:108-143 — 下拉面板是自建 div 实现：无 Escape 关闭、无焦点管理（打开后焦点不进入搜索框管理之外）、选项为 div+onClick 无键盘导航；最佳实践：迁移到 Radix Popover/Select 或补 Escape 监听与方向键导航。
- [07遗留待确认][frontend-app-04.md] [脆弱判定] my-schedule-tab.tsx:28-35 — 用「错误消息包含 '学期' 或 '404' 字符串」判断「未配置学期」，依赖后端文案，后端改文案后失效导致整页报错。最佳实践：后端用明确错误码（如 ERR_NO_TERM）或 404 状态码判定。
- [07遗留待确认][handler-04.md] [错误吞掉] node_evaluation_result_handler.go:42-46 — Get 对 Service.GetByID 的任何错误（含 DB 故障）统一 404"评价结果不存在"，真实故障被伪装成资源不存在，排障困难。最佳实践：`errors.Is(err, store.ErrNotFound)` 才返回 404，其余 respondServerError。
- [07遗留待确认][handler-04.md] [契约] node_evaluation_result_handler.go:104-107 — Grade 对 ErrNotFound 返回 409 Conflict"已评分或不存在"，将"已评分"(409) 与"不存在"(404) 合并且状态码语义不当，前端无法区分重试路径。最佳实践：ErrNotFound 区分 NotFound/已评分两种响应。
- [07遗留待确认][store-02.md] [越权防御缺失] node_evaluation_results.go:49-87 — `Get` 无租户过滤（租户隔离版本是 `GetByID`，:118），若 handler 误用 Get 则跨租户读取；建议 Get 也带 tenant 参数。
- [07遗留待确认][handler-04.md] [越权边界] node_resource_handler.go:82-131,133-158 — Create/BindResource 未校验 `nodeID` 对应节点是否存在及归属租户，store.CreateResource/Bind（store/resource_bindings.go:108-147）直接 INSERT 绑定行（node_id 无校验）：可对任意/不存在节点创建孤儿绑定行、可向其他租户节点绑定本租户资源（列表侧 store.List 以 rl.tenant_id 过滤资源本身，泄露受限，但 Unbind 的节点租户校验形同虚设）。最佳实践：创建/绑定时校验节点存在且属于当前租户（参照 UnbindResource 的 NodeCourseID+CourseTenantID 链路）。
- [07遗留待确认][store-02.md] [越权防御缺失] on_site_question_library.go:17-18 — 同 industries：DictStore GetByID/Update/Delete 无租户过滤（handler 层 CheckOwnership:true 兜底，on_site_question_library_handler.go:70,152），learn_roads 正确改法未跟进。
- [07遗留待确认][handler-04.md] [功能受限] on_site_question_library_handler.go:102-145 — Update 部分更新语义下无法清空字段：`Answer`/`QuestionText` 传 null 保持旧值；`KnowledgePointIDs`/`Tags` 因 coalesceStringSlice（common.go:31-36）+ `len(kps)==0` 回填逻辑，显式传 `[]` 也会回填旧值，前端"清空知识点/标签"操作静默失效。最佳实践：用 `*[]string` 区分未传与显式空数组。
- [07遗留待确认][backend-middleware-router.md] [日志记录] oplog.go:109-112 — `claims.TenantID == nil` 时直接 return：SaaS 运营端（平台管理员）的全部操作（租户创建/停用、管理员重置密码、订阅修改等 `/admin/*` 高危动作）**完全不记录操作日志**，无审计轨迹。最佳实践：对平台管理员用固定占位（如 tenant_id = 'platform'）或至少单独记一条平台操作日志。
- [07遗留待确认][store-02.md] [越权防御缺失] org_types.go:18-20 — 同 industries：DictStore CRUD 无租户过滤（handler org_type_handler.go:51,97 兜底）。
- [07遗留待确认][store-02.md] [越权防御缺失] organizations.go:102-142 — `Get`/`Create`/`Update` 无租户过滤（依赖 handler 前置校验，既有约定；Create 后 fetchOrg 按全局 id 读回）。
- [07遗留待确认][frontend-app-04.md] [契约] majors/page.tsx:26 — `majorApi.list({ tenantId, limit: 1000 })` 依赖 `tenantId`，若 portal auth 尚未就绪则返回空列表且 `authLoading` 变化后依赖触发重拉，逻辑正确；但后端 `/majors` 列表接口若存在 maxPageSize 上限（<1000）会静默截断，专业数超限时列表不全。最佳实践：核实后端分页上限，超出时改用分页或搜索。
- [07遗留待确认][frontend-app-04.md] [状态] majors/page.tsx:29 — `useAsync` 的 `onError: () => true` 吞掉错误仅显示空表，未暴露错误信息；结合 `error?.message ?? null` 传入页面，实际 onError 返回 true 时 error 可能被重置。最佳实践：onError 返回 false 或直接展示 error。
- [07遗留待确认][frontend-app-01.md] [性能] exam-center/page.tsx:32-41 — 为拿封面 `examApi.list({status:'published', limit:1000})`，后端列表会填充每份试卷全量题目（见 evaluation_exam.go ListExams），浪费严重；失败时 `catch(() => {})` 完全静默。最佳实践：后端提供轻量 cover 映射接口。
- [07遗留待确认][frontend-app-01.md] [loading 缺失] scheduling/page.tsx:39、62 — `const [, setLoadingPlan] = useState(false)` 把加载状态丢弃：切换教学计划后 planDetail 加载期间页面渲染 `step==='grid' && selectedPlan && planDetail` 为假，直接空白，无任何加载提示。最佳实践：保留 loadingPlan 并渲染加载占位。
- [07遗留待确认][frontend-app-04.md] [数据截断] scene/approvals/page.tsx:43 — `scenarioApi.list({ limit: 1000 })` 全量拉场景用于名称映射，若后端 maxPageSize 截断，未命中场景的审批记录显示原始 targetId。最佳实践：分页或按需 fetch。
- [07遗留待确认][frontend-app-01.md] [权限判断不可靠] exam-center/page.tsx:44 — `isStudent` 由 `items[0]?.studentView` 推断，列表为空时默认按学生视图渲染「我可参加」页签；基于数据而非真实角色/权限。最佳实践：由 auth 上下文或后端接口提供角色标识。
- [07遗留待确认][frontend-app-04.md] [状态] login/page.tsx:52-58 — `doLogin` 先 `setToken` 再 `refresh()`/`portalMe()`；若 portalMe 失败（如 token 立即失效），catch 显示错误但本地已写入失效 token，用户停留在登录页但后续请求全部带坏 token。最佳实践：先验证成功再 setToken。
- [07遗留待确认][frontend-app-01.md] [请求风暴] daily-exams/page.tsx:53-67 — 对每个考试安排并发发一个 results 请求（`Promise.all`，limit 500 个 usage 时产生 500 个并发请求）。最佳实践：后端聚合统计接口或分页 + 按需加载。
- [07遗留待确认][frontend-app-01.md] [部分失败全清空] job/landing/[id]/learn/page.tsx:57-68 — 场景列表成功后任一场景的 `taskApi.list` 失败会触发整链 Promise.all reject，catch 里把已成功加载的 `scenarios` 也清空（详情页 job/landing/[id]/page.tsx:119-128 已做逐任务容错，此页未同步）。最佳实践：逐任务 try/catch 保留已加载数据。
- [07遗留待确认][frontend-app-04.md] [一致性] scene/archive/page.tsx:62,89 — 「恢复」调用 `scenarioApi.saveDraft` 恢复为草稿，与后端存档语义一致；但批量恢复 `Promise.allSettled` 后统一 refresh，部分失败时 toast 汇总正确。无问题。

- ... 其余 107 条见 code-review-2026-08-07/problems.md 第三章。

## 四、P3 一般

- 本轮：594 条（见 problems.md 08-08）

- 上轮：911 条（大部分随修复/重构清理，剩余见 code-review-2026-08-07/problems.md 第四章）

## 五、上轮已修复对照（2026-08-08 前提交）

| 提交 | 内容 |
|------|------|
| 6854c8ff | P0×4：users.grade、排课导入列数、migrate DO 块 |
| aea1be44 | P1 越权/租户隔离 18 条 |
| f4c255e1+8fbbb081 | P1 数据丢失 23 条（含重交守卫、拓扑排序、任务权重） |
| 1c2510cd | P1 并发/鉴权（排课锁、审批、XFF、脱敏） |
| 005c49cb | P1 契约 15 条 + migration 108/128 |
| 1351c3ae | P2 性能（索引 139、statement_timeout、分页合并） |
| 541cfe6d~44bb07d9 | A1-A3、B1-B2（测试/无障碍/错误吞/i18n/截断/死代码） |
| 1f0d9f98 | 性价比批次（索引/审批原子追加/导出 N+1/列表减负/防抖/竞态×8） |
| d78ae6f8 | 安全批次 19 处 |
| fa29a8aa | 死代码清理（-340 行） |
| 74dcb641 | shared-defs 缓存收敛 + 导入事务化 |
| c8397240 | 租户外键 140 + 竞态 2 处 |

## 六、两轮差异总结

| 维度 | 07 轮 | 08 轮 | 变化 |
|------|-------|-------|------|
| P0 | 4 | 2 | 上轮 4 条全修复；本轮 2 条为修复回归 |
| P1 | 82 | 33 | 上轮 73 条确认修复；本轮剩余含 6 条回归 + 25 条遗漏/遗留 |
| P2 | 458 | 328 | 修复约 130 条 + 本轮新增 215 条（含回归相关） |
| P3 | 911 | 607 | 清理约 304 条 |
| 关键发现 | 越权/数据丢失为主 | **修复回归为主**（2 P0 + 6 P1），提示修复后需回归验证 |
