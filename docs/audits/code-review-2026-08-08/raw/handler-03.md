# handler 层复查（handler-03）— 2026-08-08

范围：/tmp/opencode/h2-ac 所列 21 个文件逐一完整逐行通读。
上一轮（2026-08-07）已修复项复查结论：`Grade` 先校验租户后评分、`JobAbilityResult.List/Get/CourseScores` 学生强制查本人、考试结果回读 500、`users.grade` 回写等均已到位，未发现回归。

## backend/internal/handler/exam_import_handler.go
- [P3][一致性] exam_import_handler.go:144 — `importExams` 中批次查询 `lookupBatchID(ctx, h.DB, ...)` 用的是连接池而非事务 `q`（importExamQuestions 用的是 tx），事务内读非事务数据，与覆盖导入"整体原子"的语义不一致；最佳实践：统一传 `q`。
- [P3][语义] exam_import_handler.go:205 — overwrite 命中时 `result.Created++`，覆盖更新计为"创建"，语义应为 Updated/另行计数。
- [P2][数据完整性] exam_import_handler.go:278 — 题目按 `content` 精确匹配 `LIMIT 1`，同租户存在多条同 content 的题时取任意一条，可能关联到答案/类型不同的题；最佳实践：对导入源做强约束（content 唯一或带类型筛选）。
- [P3][边界] exam_import_handler.go:100-106 — `examMap` 每个文件重置，跨文件同名试卷的 rename 映射失效（文件 B 中引用文件 A 已 rename 试卷的题目行会报"找不到试卷"）。

## backend/internal/handler/exam_result_handler.go
- [P3][租户边界] exam_result_handler.go:133 — Get 的租户校验 `result.TenantID != nil && claims.TenantID != nil && ...`：任一为 nil 即放行；遗留 null 租户的结果任何业务用户可读，无租户的平台管理员可读任意租户结果；最佳实践：nil 视为不匹配（404）。
- 确认无回归：Create 前校验 usage 租户（75-83）、Grade 前校验租户（153-160）、错误映射完整、500 统一 respondServerError；Get 路由挂 businessUser 组（不含学生），无用户级越权问题。

## backend/internal/handler/exam_usage_handler.go
- [P1][数据丢失] exam_usage_handler.go:100-112 — 更新路径部分更新无兜底：`UpdateExamUsage` 的 store UPDATE（store/exam_usages.go:106-113）对 `description/start_time/end_time/duration` 直接赋 `$2-$5` 未做 `COALESCE`（仅 target_type/target_ids 有 COALESCE 兜底）。请求体未携带这些字段（Go nil 指针）时会被置 NULL——只改 name 的 PUT 会清空描述、考试时间、时长；对 scheduled 考试等于悄悄打开/关闭答题窗口；最佳实践：store 层对指针字段 `COALESCE($n, 原列)` 兜底（与 target_ids 一致）。
- [P2][租户隔离缺口] exam_usage_handler.go:75-99 + store/exam_usages.go:85-99 — Create 未校验 `ExamID` 归属租户（service CreateExamUsage 直通 store），可创建指向他租户试卷的安排；学生拉卷时因 Exam Get 的租户校验（exam_handler.go:72）404，无内容泄露但产生跨租户脏数据；最佳实践：Create 时 `SELECT tenant_id FROM exams WHERE id=$1` 校验一致。
- [P3][吞错] exam_usage_handler.go:195,218 — Finish/Publish 后回读 `usage, _ = GetExamUsage(...)` 错误被忽略，失败时返回旧状态但 200。
- [P3][契约] exam_usage_handler.go:160 — `manualOnly` 将 `target_type` 为 NULL 的旧数据视为自动创建禁止编辑，属可接受的防御。

## backend/internal/handler/exam_retake_policy_test.go
无问题（重交策略/提交窗口/节点评分回写覆盖完整，断言有区分度）。

## backend/internal/handler/exam_usage_flow_test.go
无问题（班级可见性、403、评分回写、409 重交保护均覆盖）。

## backend/internal/handler/exam_usage_visibility_test.go
无问题（临时考试可见性回归覆盖充分）。

## backend/internal/handler/favorites_handler.go
- [P1][租户隔离缺失] favorites_handler.go:39,44,61,66 + store/favorites.go:39-93,123-135 — 收藏体系全链路无租户维度（表无 tenant_id 列、list 查询 JOIN 无 tenant 过滤）。任何登录用户（含学生，routes.go:238-240 挂在 jobViewer 组）可对任意目标类型+任意对象 ID 调 Toggle/Get/List：已知他租户对象 ID 即可在其收藏列表读到该对象元数据（跨租户信息泄露），并可全局污染他租户对象的 `favorite_counters` 计数；最佳实践：user_favorites/favorite_counters 增加 tenant_id 并在 Toggle/Get/Count/List 全部按租户过滤，List 的 JOIN 加 `AND 目标表.tenant_id = f.tenant_id`。
- [P3][吞错] favorites_handler.go:44,66 — `FavoriteCount` 错误被吞，失败静默返回 count=0；最佳实践：返回 500 或至少日志。

## backend/internal/handler/favorites_handler_test.go
无问题（回归场景真实走 HTTP，断言计数与列表内容；测试有实际价值）。

## backend/internal/handler/file_handler.go
- [P2][敏感泄露] file_handler.go:164-189 + router.go:122 — `Serve` 无任何鉴权且挂在 JWT 组之外，`/uploads/` 为全租户共享目录，任何拿到 URL 的人可读任意用户上传的文件（学生资料/试卷附件等）；UUID 文件名使其难以枚举，风险可控；最佳实践：如无强需求，为 Serve 增加登录校验或签名 URL；保持现状需明确接受该风险。
- [P2][性能/DoS] file_handler.go:233,266 — libreoffice 转换使用 `exec.Command` 无 context 超时、无并发限制，配合 100MB 上传（file_handler.go:19）可被反复触发重 CPU 转换拖垮进程；最佳实践：加超时（context.WithTimeout）与全局并发信号量。
- [P3][错误处理] file_handler.go:253-256 — PNG 未生成时 `respondServerError(w, r, err, ...)` 的 `err` 实为 nil（:238 ReadDir 的错误已丢弃），500 日志无意义；最佳实践：改为明确文案并记录转换失败。

## backend/internal/handler/file_handler_test.go
无问题（白名单/XSS 头回归有效）。

## backend/internal/handler/graduation_handler.go
- [P2][竞态] graduation_handler.go:231 — `AppliedCount >= Capacity` 为事务外预检，并发申请可超容量（service ApplyGraduationTopic 若未对课题行加锁重检即越界）；最佳实践：service 事务内 `SELECT ... FOR UPDATE` 后重检容量再插入。
- [P3][吞错] graduation_handler.go:252 — ApplyTopic 后回读 `topic, _ = GetGraduationTopic(...)` 错误被忽略，失败时响应零值对象。
- [P3][租户边界] graduation_handler.go:91,155,206,228 — 多处 `topic.TenantID != nil &&` 前置：TenantID 为 null 的遗留数据跳过归属校验（与 exam_result Get 同类，低危）。
- 说明：Archives/Evaluations 写接口无 handler 内角色校验，但路由整体挂在 businessUser 组（routes.go:183，教师/学校管理员/企业导师/平台管理员，不含学生），风险可控，不单列。

## backend/internal/handler/granular_course_export_handler.go
- [P3][死代码] granular_course_export_handler.go:40-43,104 — `fillCoursesData` 恒返回 nil，Export 的 500 分支不可达；最佳实践：让错误可向上传递或删除分支。
- [P3][吞错] granular_course_export_handler.go:114-116,139-141 — 查询失败静默返回 nil 名称列表（有日志，可接受）。

## backend/internal/handler/granular_course_import_handler.go
- [P2][事务/一致性] granular_course_import_handler.go:88-90 — 导入整体无事务（对比 exam_import_handler.go:89-108 有事务包裹），中途失败部分写入、无回滚；最佳实践：与试卷导入一致在 ImportExcel 外层包事务。
- [P2][副作用顺序] granular_course_import_handler.go:162-169 — `findOrCreateKnowledgePoints/Resources` 在覆盖权限校验（canOverwriteContent）之前执行，权限不足被跳过时知识点/资源已被创建（孤儿数据）；最佳实践：先做权限判定再创建知识/资源。
- [P2][吞错] granular_course_import_handler.go:218-237 — `replaceCourseBindings` 全部 `_, _ =` 忽略错误（DELETE/INSERT 失败静默），DB 中 resource_count 与真实绑定可能不一致；最佳实践：返回 error 由调用方计入 failed。
- [P3][竞态] granular_course_import_handler.go:239-246 — `GRA-年份-序号` 生成是 MAX+1 无锁，并发导入可能撞码（若 code 有唯一约束则报错可感知）。

## backend/internal/handler/hybrid_grading_writeback_test.go
无问题（混合课节点评分回写 exam_results 的回归测试，断言分数与状态）。

## backend/internal/handler/hybrid_module_handler.go
- [P2][租户完整性] hybrid_module_handler.go:61-63 — Upsert 未校验 `node_id` 归属租户（store Create 仅约束本行 tenant_id，hybrid_modules.go:77-87），可将模块写入他租户节点（孤儿行，不可见但脏数据）；最佳实践：Create/ReplaceByNode 前校验 `system_course_nodes.tenant_id = $tenant`。
- [P3][死代码] hybrid_module_handler.go:93-95 — `ListModules` 别名仅作路由引用，可接受。

## backend/internal/handler/import_common.go
- [P3][吞错] import_common.go:491-498,522-530 — findOrCreate 系列 INSERT 失败被忽略，失败时仍把未落库的 id 计入返回列表，后续绑定 INSERT 将 FK 失败并被上层静默吞掉；最佳实践：INSERT 返回 error 时按真实存在性再决策。
- [P3][性能] import_common.go:374 — `parseUploadedExcels` 单请求 200MB 表单 + 全量解析，配合无事务导入，大文件请求内存/DB 压力大（导入豁免区，可接受）。

## backend/internal/handler/import_common_test.go
无问题（资源类型映射与前端常量一致性回归，有实际价值）。

## backend/internal/handler/import_export_handler.go
- [P2][越权弱] import_export_handler.go:339-354 — 覆盖导入对他人对象仅走 updateSQL 改名/改码，无 `canOverwriteContent` 校验，任意业务用户可改名他人试卷/课程/场景/题库（与 exam/granular 导入的权限判定不一致）；最佳实践：覆盖前校验 creator/co-creator。
- [P2][事务] import_export_handler.go:291-401 — Import 无事务，中途失败部分写入（冻结豁免区，标注即可）。
- [P3][脆弱] import_export_handler.go:344 — 用 `strings.Count(meta.updateSQL, "$") == 3` 推断参数个数，新增实体易踩坑；最佳实践：在实体元数据中显式声明参数数。
- [P3][吞错] import_export_handler.go:147,154 — CSV 行扫描失败 `continue`、写入失败 `_ =`，错误不体现到响应（流式导出可接受）。

## backend/internal/handler/import_rename_test.go
无问题（rename 模式与覆盖权限回归覆盖到位）。

## backend/internal/handler/industry_handler.go
无问题（Permit=canManagePortal 写门禁、CreateTenantFn 校验请求租户、Update/Delete 经 crud 框架归属校验、DeleteChecks 子行业引用检查；List 无 handler 内鉴权但路由已限定业务角色）。

## backend/internal/handler/job_ability_result_handler.go
- [P2][并发边界] job_ability_result_handler.go:399-407 — 单机 `aggInFlight` 按 positionId 去重，多实例部署时失效（可重复触发重汇聚）；最佳实践：改为 DB 层状态机（aggregate log 加唯一约束/互斥状态）。
- [P3][参数] job_ability_result_handler.go:430 — `req.UserIDs` 未校验非空上限，超大列表触发长任务（30 分钟超时兜底，可接受）。
- 说明：List/Get/CourseScores 学生强制本人（229-231,290,359-361）已修复到位，无回归；Aggregate 无 handler 内角色校验但路由在 businessUser 组（不含学生），可接受。
