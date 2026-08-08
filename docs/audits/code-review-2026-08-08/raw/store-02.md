# Store 层代码复查报告（2026-08-08，第 2 轮）

复查范围：`/tmp/opencode/st2-ab` 所列 32 个文件，逐行通读，表结构对照 `backend/migrations/*.sql` 核实。
已修项（exam_results SaveResult 守卫、场景/节点 Submit graded_at 守卫、micro_cert IssueCerts 租户校验、positions 回读走 tx、question_banks Delete 事务化）逐一回归确认无退化。
本报告只记录问题，未修改任何代码。

## backend/internal/store/position_certificates.go
- [P1][租户隔离] position_certificates.go:23-66 — `List(ctx, careerPositionID, limit, offset)` 的 SQL 完全没有 tenant 过滤（count 与分页查询均仅 `WHERE career_position_id = $1` 或 `1=1`）；调用链 service/position_config.go:78 → handler 直接透传查询参数，传入他租户 careerPositionID（或留空）即可跨租户读取岗位证书及证书库详情（name/url/description/image_url）；最佳实践：List 增加 tenantID 参数并在 `position_certificates` 与 `certificate_library` 两表上叠加 `tenant_id = $N` 条件。
- [P3][错误处理] position_certificates.go:148-164 — `findOrCreateLibrary` 先 SELECT 后 INSERT，并发创建同名证书库时唯一约束冲突会 500；最佳实践：`INSERT ... ON CONFLICT DO NOTHING RETURNING id`（未命中再 SELECT）。

## backend/internal/store/portal.go
- [P2][nil 解引用] portal.go:679 — `ListClassPlans` 直接 `q.Query(ctx, query, userID, *tenantID)` 解引用指针，而本文件其余方法均以 `tenantID != nil` 守卫；一旦调用方传入 nil 即 panic；最佳实践：与其他方法一致先判 nil（nil 时按无租户或返回空处理）。
- [P3][错误处理] portal.go:47/147/201/250/344/373/427/487/531/588/636/689/727/757/784/820/893 — 大量 `rows.Scan` 出错 `continue` 静默吞掉单行，列表静默缺行；最佳实践：记录日志（slog.Warn）再 continue，避免排查困难。
- [P3][错误处理] portal.go:56-66/69-82/85-105/259-277/280-292/295-302/305-317/698-705 — `_ = s.q.QueryRow(...).Scan(&count)` 忽略查询错误，失败时返回 0 让前端误以为无数据；最佳实践：至少 `slog.Warn` 记录。
- [P3][死代码] portal.go:62/77/96-98/230-236/569-574 — `ListAnnouncements`/`DraftCourseCount`/`UpcomingExamCount`/`ListExamEvents`/`ListStudentExams` 的 `tenantID == nil` 分支会输出全租户数据；若调用方确为平台管理员则属预期，但无注释说明该契约，建议在函数注释中声明"nil=全平台"。

## backend/internal/store/lesson_content.go
- [P2][数据丢失] lesson_content.go:158-174, 242-264 — `Update` 在 `GranularLessonIds` 缺省（PATCH 未带该字段）时置空，随后 `SyncCourseKnowledgePoints` 第二条 UPDATE 条件 `($3::uuid[] IS NULL OR id <> ALL($3::uuid[]))` 恒真，会把该知识点从**租户内所有课程**的 `courses.knowledge_point_ids` 中删除；而该列同时被课程编辑（courses.go:119）、课程克隆/导入等链路直接写，属通用引用列，非颗粒课专属；只改知识点名称即可能静默剥离课程-KP 关联；最佳实践：Update 仅当请求显式携带 granular_lesson_ids 才调用 SyncCourseKnowledgePoints（或改为全量对比差异后再同步）。
- [P2][事务穿透] lesson_content.go:177-183 — `Delete` 先 `DeleteResourceTags` 再删知识点，两条语句未包事务（用 s.q 而非 tx），删除标签成功后删行失败会残留孤儿标签；最佳实践：签名改为接收 tx，由 service 统一开启事务。
- [P2][数据一致性] lesson_content.go:177-183 — 删除知识点后未从 `courses.knowledge_point_ids` 反向清理，形成悬空引用（CitationStats/ListUncited 口径与存量数据不一致）；最佳实践：Delete 内执行 `UPDATE courses SET knowledge_point_ids = array_remove(...) WHERE tenant_id=$1 AND $2 = ANY(knowledge_point_ids)`。

## backend/internal/store/exam_questions.go
- [P2][N+1] exam_questions.go:63-85 — 每道题先 `SELECT id` 判存在再 UPDATE/INSERT（2 次往返/题），题目多时 N+1 放大；最佳实践：改 `INSERT ... ON CONFLICT (exam_id, question_id) DO UPDATE`（与 exams.go:124 的 AddQuestion 同款写法）单语句完成。
- [P3][错误处理] exam_questions.go:69 — `_ = q.QueryRow(...).Scan(&existingID)` 忽略查询错误，DB 异常时按"不存在"走 INSERT，可能触发唯一冲突；最佳实践：处理 err。

## backend/internal/store/favorites.go
- [P2][原子性/计数器漂移] favorites.go:68-92 — 取消收藏的 DELETE 与 `favorite_counters` 减一、添加收藏的 INSERT 与计数器加一均非事务，且计数器 UPDATE/INSERT 错误被 `_, _ =` 吞掉（favorites.go:74-77, 87-91）；失败后计数与真实收藏数长期漂移（列表/详情展示错数）；最佳实践：两个语句包在一个短事务内，计数器语句错误返回 err 而非忽略。

## backend/internal/store/exams.go
- [P2][事务穿透] exams.go:80-86 — `Delete` 先删 `exam_questions` 再删 `exams`，两条语句未包事务，第二条失败时题目已删而试卷残留（半删状态，与上轮修复的 question_banks Delete 同型）；最佳实践：Delete 接收 tx 或内部开启事务。

## backend/internal/store/micro_cert.go
- [P2][事务穿透] micro_cert.go:111-117 — `DeleteTemplate` 先删 `cert_issuance_records` 再删模板，未包事务，失败即半删（发放记录丢失、模板残留）；最佳实践：包事务。
- [P3][边界] micro_cert.go:119-159 — `IssueCerts` 租户校验回归通过（133-140 行 COUNT 比对正确）；但 userIDs 含重复 ID 时 `COUNT(*) != len(uuids)` 会误报"存在不属于当前租户的颁发对象"；最佳实践：去重后再校验。模板租户校验由 handler（micro_cert_handler.go:237-243）完成，store 层无兜底，属可接受的既成约定（P3）。

## backend/internal/store/exam_results.go
- [P3][错误处理] exam_results.go:264-275 — `FetchUserProfile` 两条独立查询，第一条错误被 `_ =` 忽略（用户名静默为空）；最佳实践：合并为一条 LEFT JOIN 查询并处理错误。
- [P3][类型转换] exam_results.go:189/202/218 — `(tem.resource_config->>'allowRetake')::boolean`：JSON 中存布尔 true 时 `->>` 输出 'true' 可转，但若前端写入 "1"/"yes" 等字符串会抛转换错误导致整个接口 500；最佳实践：用 `CASE WHEN ... THEN true ELSE false END` 兜底。
- [P3][死检查] exam_results.go:410-418 — `s.q.Query` 不会返回 `pgx.ErrNoRows`，`errors.Is(err, pgx.ErrNoRows)` 分支永不生效（死代码）；最佳实践：删除该分支。
- [P3][边界] exam_results.go:83-92 — `Grade` 无 `grading_status = 'pending'` 守卫（SaveResult 用 graded_at 守卫，此处教师可对已评分结果覆盖评分）；若重评是产品需求则忽略。
- [P3][性能] exam_results.go:145-164/148-168 — `tem.task_id = ANY(eu.target_ids)` 连接语义在目标多任务时会产生笛卡尔重复行（有 LIMIT 1/EXISTS 兜底，无错误）；最佳实践：改用 `= ANY` 配合显式去重（DISTINCT ON）防未来扩散。
- 回归确认：SaveResult 的 `WHERE exam_results.graded_at IS NULL` 守卫（285-287 行）在位且正确；SyncCourse/Node/SceneEvaluation 的 graded_at 保护 CASE（351-359/391-399/453-461 行）正确。

## backend/internal/store/evaluation_results.go
- [P3][批量无校验] evaluation_results.go:130-140 — `BatchGrade` 不检查 RowsAffected，status 非 pending 或 id 不存在时静默跳过（批量评分"部分成功"无感知）；最佳实践：汇总 rowsAffected 并返回命中数。
- [P3][模式] evaluation_methods.go:87-97（Toggle）/ evaluation_methods.go:184-194（AppealStore.Process） — 两处 UPDATE 无 tenant 过滤，但前置 `Get` + handler 归属校验（TenantID 方法）属既有约定；若后续新增直接调用点需加 TenantID 校验。
- 回归确认：Submit 的 `WHERE scene_evaluation_results.graded_at IS NULL` 守卫（99 行）在位且正确；Grade（116-127）status 守卫正确。

## backend/internal/store/node_evaluation_results.go
- 回归确认：Submit 的 graded_at 守卫（107 行）与 Grade 的 tenant+status 双守卫（169 行）均正确，无回归。

## backend/internal/store/graduations.go
- [P3][错误处理] graduations.go:282 — 总数 COUNT 查询错误被 `_ =` 忽略，返回 0 总数与真实不符；最佳实践：处理 err。
- [P3][错误处理] graduations.go:103-140 — `ApplyTopic` 以 `err.Error() == "topic full"` 字符串比对识别满员（134 行），fmt.Errorf 无哨兵错误；最佳实践：定义 `ErrTopicFull` 哨兵配合 errors.Is。

## backend/internal/store/exam_usages.go
- [P3][错误处理] exam_usages.go:202 — `ListExamCenter` 扫描失败 `continue` 静默丢行；最佳实践：slog.Warn 后 continue。
- [P3][错误处理] exam_usages.go:84 — `SyncScheduledExamUsageStatus` 吞掉 UPDATE 错误（`_, _ =`），定时启停失败时考试状态不流转、前端无感知；最佳实践：至少记录日志。
- [P3][性能] exam_usages.go:134-147 — `NextAutoUsageName` 依赖 COUNT 生成序号，并发同租户同类型创建时名称可能重复（仅影响显示名）；最佳实践：可接受，无需处理（简单优先）。

## backend/internal/store/landing.go
- [P3][边界] landing.go:34-53 — `ListExams` 未过滤 `eu.status`/`eu.target_type`：已发布试卷下存在 draft 状态的考试安排也会出现在落地页；且 `eu.start_time` 为 NULL 时仍返回。若产品意图是"仅展示已开放考试"，建议补 `eu.status = 'published'`。
- [P3][错误处理] landing.go:63 — 扫描失败 `continue` 静默丢行。

## backend/internal/store/job_ability_results.go
- [P3][SQL 拼接] job_ability_results.go:166 — `LIMIT `+Itoa(limit)+` OFFSET `+Itoa(offset)` 手拼数值；limit/offset 来自 handler 入参，负值/超大会产生 SQL 错误（无注入风险，Itoa 仅数字）；最佳实践：沿用 query.go 的钳制逻辑或参数化。

## backend/internal/store/logs.go
- [P3][死代码] logs.go:97 — `var _ = context.Background` 为导入保留的占位，函数已不再使用 context；最佳实践：删除该行与 context 导入。

## backend/internal/store/position_bindings.go
- [P3][模式] position_bindings.go:56-77 / 199-217 — `Update`/`Delete`（能力绑定与职责）的 SQL 无 tenant 过滤，依赖前置 `fetchBinding/fetchResp` + handler 归属校验的既成约定；若 handler 复用错漏会直接跨租户修改，建议在注释中声明契约。

## backend/internal/store/position_clone.go
- [P3][错误处理] position_clone.go:113/149/189/236/272 — 各 clone 循环内 `rows.Scan` 失败 `continue` 静默跳过，克隆结果残缺但事务照常提交；最佳实践：扫描错误直接 return（事务回滚），保证克隆完整性。

## backend/internal/store/organizations.go
- [P3][边界] organizations.go:75-99 — `MemberCounts` 在 tenantID 为空时统计全库用户（无 WHERE）；与 portal 的 nil=全平台约定一致，但此处无注释；最佳实践：补注释或强制要求非空。

## backend/internal/store/industries.go / majors.go / org_types.go / learn_roads.go / on_site_question_library.go
- [P3][模式] 各文件 DictStore DeleteSQL 均为 `DELETE ... WHERE id = $1` 无租户过滤；依赖通用 handler 框架的 get-then-owner-check（major_handler.go:86-92 已确认），属既成约定；注意：`UpdateSQL` 同型。若未来新增绕过框架的调用点需补租户校验。

## backend/internal/store/evaluation_methods.go
- 无问题（AppealStore.Process/Toggle 的 Get 前置守卫与 TenantID 方法齐全）。

## backend/internal/store/entity_code_test.go
- 无问题（测试与 SanitizeIdentifier/GenerateEntityCode 契约一致）。

## backend/internal/store/evaluation_results_ownonly_test.go
- 无问题（ownOnly 范围过滤回归测试覆盖完整，与 ListConfig 实现一致）。

## backend/internal/store/exam_usage_config.go
- 无问题（纯函数，无 SQL）。

## backend/internal/store/hybrid_modules.go
- 无问题（ReplaceByNode 事务内 DELETE+INSERT、Get/Update/Delete 均租户限定）。

## backend/internal/store/node_quizzes.go
- 无问题（全部读写租户限定，DeleteQuiz 事务内两表清理）。

## backend/internal/store/honors.go
- 无问题（读写均租户+用户限定）。

## backend/internal/store/platform_settings_store.go
- 无问题。

---

### 汇总
- 审查文件数：32
- 问题总数：31（P1: 1，P2: 7，P3: 23）
- P0 级（SQL 引用不存在列/表）：0（已对照 migrations 逐一核实，INSERT/UPDATE/SELECT 列名与约束均存在，unique 冲突目标与 100/111/113/114/129 号迁移一致）
- P1 摘要：position_certificates.go List 无租户过滤，跨租户读取岗位证书及证书库数据（1 处）
- P2 摘要：lesson_content.go 知识点更新会从所有课程剥离引用（潜在批量数据丢失）；lesson_content.go/exams.go/micro_cert.go 三处多语句删除未包事务；portal.go ListClassPlans nil 解引用；favorites.go 计数器非原子且吞错；exam_questions.go 同步题目 N+1
- 上轮 P0/P1 修复项全部回归通过，无退化
