# Store 层审查报告 store-02（2026-08-07）

审查范围：backend/internal/store 目录 32 个文件，逐行通读。
表结构依据：backend/migrations/001_baseline.up.sql 及增量 migration（已逐一核对列与唯一约束）。
审查原则：简单优先、安全只排高危、容忍 hacker 行为、锁只给核心业务。

---

## backend/internal/store/entity_code_test.go
无问题（纯测试：编码格式与允许表白名单校验，与表结构无关）。

## backend/internal/store/evaluation_methods.go
- [P1][越权] evaluation_methods.go:23 — `ListCategories` 的 `SELECT id, name, sort_order FROM evaluation_method_categories ORDER BY sort_order` 无 tenant 过滤；`evaluation_method_categories` 表含 `tenant_id` 列（baseline:347-353），且 handler/service 链路（handler/evaluation_method_handler.go:20 → service/evaluation_method.go:25）全程不传租户。任意登录用户可见全部租户的评价分类。最佳实践：方法签名加 tenantID 参数（与其他 store 一致），SQL 增加 `WHERE tenant_id = $1`；同时 `ORDER BY sort_order` 前加租户内排序，避免跨租户数据串联。
- [P2][越权防御缺失] evaluation_methods.go:86-96 — `Toggle` 仅按 id 更新 `enabled`，无 tenant 过滤（依赖 handler 先调 `TenantID` 校验）。属全库既有模式（store 提供 `TenantID()` 供 handler 前置校验），非新问题，但 `Toggle` 内部先 `Get` 后 `UPDATE` 两段式也不具原子性。最佳实践：`UPDATE ... WHERE id = $2 AND tenant_id = $3`。
- [P2][越权防御缺失] evaluation_methods.go:183-193 — `AppealStore.Process` 按 id 直接改 status，无租户过滤（依赖 handler 前置校验）。同 `Toggle`。
- [P3][一致性] evaluation_methods.go:62-66/161-166 — `TenantID()` 查询在行不存在时返回 `pgx.ErrNoRows`，与 `Get` 的 `ErrNotFound` 映射不一致（handler 需自行判断）。

## backend/internal/store/evaluation_results.go
- [P1][数据丢失] evaluation_results.go:81-107 — `Submit` 的 ON CONFLICT 无条件将已有记录重置为 `status='pending'`、`graded_at=NULL`。考试路径有重交保护（exam_results.go:148-180 的 `UsageGradedByUser`/`ResultTeacherGraded`，service/evaluation_result.go:39-64），而场景评价提交（handler/evaluation_result_handler.go:103-160 → service.SubmitEvaluationResult 直通 store）**无任何已评分守卫**：教师已评分的场景结果可被学生再次提交一键清空评分标记。最佳实践：`DO UPDATE` 前校验，或 SQL 增加 `WHERE ... AND graded_at IS NULL` 条件（或 service 层提交前检查 `graded_at`）。
- [P2][越权防御缺失] evaluation_results.go:110-122 — `Grade` 仅按 `id + status='pending'` 更新，无 tenant 过滤（依赖 handler）。
- [P2][错误处理] evaluation_results.go:125-135 — `BatchGrade` 不检查 `RowsAffected`：任一 id 不存在或已评分时静默跳过，与单条 `Grade` 返回 `ErrNotFound` 的行为不一致，批量评分可能"看起来成功"实则漏评。最佳实践：逐条检查 RowsAffected 并汇总失败。
- [P2][输入校验] evaluation_results.go:140-159 — `FindLatestExamResult` 将 `tem.resource_config->>'paperId'/'examId'` 直接 `::uuid` 强转，若历史配置值非合法 UUID（项目中 learn_roads.go:82-91 注释已承认存在 "SHA1 伪 UUID" 脏数据）则整条查询报错 500。最佳实践：cast 前 `NULLIF` + 正则/长度过滤，或使用宽松比较。
- [P2][事务穿透] evaluation_results.go:110-122 — `Grade`/`Submit` 使用 s.q 全局连接；`BatchGrade`/`BatchGetGradeTargets` 接收 tx 参数，设计正确。但注意 `Submit`（全局连接）若被 service 在 tx 内调用会读不到未提交行——当前调用链（service/evaluation_result.go:251）未包 tx，无实害，仅提示。
- [P3][一致性] evaluation_results.go:163-166 — `UpdateExamResultScore` 无租户过滤（依赖 handler 按 id 前置校验）。

## backend/internal/store/evaluation_results_ownonly_test.go
无问题（纯单测：验证 ownOnly 叠加 taskId/sceneId 条件装配，逻辑与实现一致）。

## backend/internal/store/exam_questions.go
- [P2][N+1] exam_questions.go:63-85 — 每题循环内先 `SELECT id` 再 `UPDATE/INSERT`（最多 3 次往返/题），试卷几百题时放大为千级查询。最佳实践：一次 `SELECT ... WHERE exam_id=$1` 取现有映射，内存 diff 后批量写。
- [P2][边界] exam_questions.go:15 — `DELETE ... WHERE exam_id = $1 AND NOT (question_id = ANY($2))`：questionIDs 为空数组时 `NOT (x = ANY('{}'))` 恒真，删除该试卷全部题目。若调用方空列表语义为"无变更"则误删全部；当前语义依赖调用方（全量同步），建议显式注释或空列表短路返回。
- [P3][错误处理] exam_questions.go:69 — `_ = q.QueryRow(...)` 忽略查询错误（仅靠返回值空判断），连接错误时被吞。
- [P2][无事务] exam_questions.go:13-93 — 整体 prune+update+recalc 无事务包裹（函数接收 q 而非 tx），中途失败留下部分同步状态。最佳实践：调用方在 tx 内调用（当前调用方需确认）。

## backend/internal/store/exam_results.go
- [P0][必 500] exam_results.go:268 — `FetchUserProfile` 第二句 `SELECT ... COALESCE(u.grade, '') AS grade ... FROM users u`：**users 表不存在 grade 列**（已全量核对 001_baseline.up.sql:1289 及 104/105/115/125/126/132/137/138 等全部增量 migration，无任何 ALTER users 增加 grade）。该函数在每次考试交卷时被调用（service/evaluation_result.go:113），执行即报 `column u.grade does not exist` → 交卷接口必 500，考试无法提交。最佳实践：删除 `u.grade` 引用（grade 只存在于 exam_results/job_ability_results 表），或若确有年级需求先补 migration `ALTER TABLE users ADD COLUMN grade ...` 再引用。
- [P2][边界] exam_results.go:37-40 — `ListConfig.ExtraFilter` 无条件追加 `er.exam_usage_id = $n`（`usageId` 为空串时过滤 `= ''` 返回空列表而非报错/全量），与其它 store 的"空值不过滤"约定不一致。
- [P2][越权防御缺失] exam_results.go:83-92 — `Grade` 无租户过滤（依赖 handler）。
- [P3][一致性] exam_results.go:44-68 — `Get` 直接返回 `pgx.ErrNoRows`，未映射为 `ErrNotFound`（与 exams.go:31-40 等 store 不一致，handler 需特殊处理）。
- [P3][错误处理] exam_results.go:266/267-273 — `FetchUserProfile` 两处 `_ =` 吞掉查询错误，失败时静默返回空 profile（叠加 P0 掩盖真实错误，修复 P0 后建议此处返回错误）。
- [P3][一致性] exam_results.go:277-305 — `SaveResult` 的 DO UPDATE 不刷新 student_name/class_name/major_id/grade，重交后姓名班级变化不更新。
- [P3][死代码] exam_results.go:413 — `SyncSceneEvaluation` 对 `Query` 结果做 `errors.Is(err, pgx.ErrNoRows)` 判断（Query 永不返回 ErrNoRows），死分支。
- [P3][一致性] exam_results.go:284-285 — upsert 未更新 `updated_at`（表有该列）。

## backend/internal/store/exams.go
- [P2][越权防御缺失] exams.go:65-86/100-177 — `Update`/`Delete`/`AddQuestion`/`RemoveQuestion`/`UpdateQuestionScore`/`BulkUpdateScores`/`RecalcExamTotal` 全部仅按 id 操作、无 tenant 过滤（依赖 handler 前置 `TenantID()` 校验）。全库既有约定，列为风险点而非新缺陷。
- [P2][无事务] exams.go:80-86 — `Delete` 先删 exam_questions 再删 exams，两步无事务，中间失败残留孤儿题目。
- [P3][错误处理] exams.go:257-264 — `fetchExamQuestions` 中 `json.Unmarshal` 选项/答案失败仅 `slog.Warn`/`_ =`，坏数据静默置空。
- [P3][一致性] exams.go:152-168 — `BulkUpdateScores` 对 `score <= 0` 静默跳过（调用方传 0 想清零时无效）。

## backend/internal/store/exam_usage_config.go
无问题（纯解析函数：activationMode 窗口与时长提取，无 SQL）。

## backend/internal/store/exam_usages.go
- [P2][读路径写库] exam_usages.go:56-57 — `Get` 每次调用先执行 `SyncScheduledExamUsageStatus(ctx, s.q, "", now)`：tenantID 为空 → UPDATE 覆盖**全租户**的 scheduled 考试安排（行锁 + updated_at 写放大），一个读请求触发全局写。`List`（:30）同样。最佳实践：仅 List/Get 携带租户时同步，或将状态流转改为定时任务。
- [P2][一致性] exam_usages.go:168-214 — `ListExamCenter` 以 `JOIN users u ON u.id = eu.creator_id` 过滤租户，creator_id 为 NULL（历史/自动生成的安排）时行被静默丢弃；同文件 `ListConfig` 直接用 `tenant_id` 列（:39-40），两套口径不一致。
- [P3][错误处理] exam_usages.go:201 — `ListExamCenter` scan 失败 `continue` 静默丢行。
- [P3][边界] exam_usages.go:168-184 — `LIMIT 100` 无分页无 offset，考试多时截断。

## backend/internal/store/favorites.go
- [P2][并发一致] favorites.go:59-93 — `ToggleFavorite` 为 check-then-act 两段式：并发双击/双端切换时，两个请求都可能通过 EXISTS 检查后各自执行 INSERT（后者被 ON CONFLICT DO NOTHING 吃掉）却**仍然执行 cnt+1**，或 DELETE 与 INSERT 交错导致 favorite_counters 漂移、返回状态与实际相反。最佳实践：单条 `INSERT ... ON CONFLICT DO NOTHING` + 依据 RowsAffected 决定增减，或对 counter 的增减也用 RowsAffected 判定。
- [P3][错误处理] favorites.go:74-77/87-91 — counter 更新错误被 `_ =` 忽略（计数漂移无感知）。

## backend/internal/store/graduations.go
- [P2][边界] graduations.go:101-140 — `ApplyTopic` 用 `applied_count < capacity` 判满：capacity 默认 0（CreateTopic :63 写入 0）时任何申请都"已满"。若 0 代表"不限名额"则申请永远失败；若 0 代表"不可选"则应与前端校验一致。另：满员回滚依赖 `fmt.Errorf("topic full")` 字符串比较（:134），应改用哨兵错误。
- [P3][错误处理] graduations.go:282 — `QueryGraduationResults` 的 COUNT 查询错误被 `_ =` 忽略，total 恒 0 时前端分页错乱。
- [P3][越权防御缺失] graduations.go:73-85/232-244 — `UpdateTopic`/`CreateEvaluation`/`UpdateTopic` 无租户过滤（依赖 handler 前置校验，既有约定）。
- [P3][一致性] graduations.go:332-338 — `fetchTopic` 中 `source` 字段以 `*string` 读取但表列 `source` NOT NULL，多余一层指针（无实害）。

## backend/internal/store/honors.go
无问题（List/Get/Update/Delete 均带 tenant_id + user_id 过滤，create 由 handler 传参）。

## backend/internal/store/hybrid_modules.go
无问题（Replace/Get/Create/Update/Delete 均带 tenant 参数过滤）。

## backend/internal/store/industries.go
- [P2][越权防御缺失] industries.go:19-20 — 嵌入 DictStore 的 `GetByIDSQL`/`UpdateSQL`/`DeleteSQL` 均无 tenant_id 过滤，`DictStore.GetByID/Update/Delete`（dict_store.go:56-85）不带租户参数。当前 handler 层用 crud 框架 `CheckOwnership`（industry_handler.go:53,95）兜底，但 store 层自身不隔离，任何绕过 handler 的调用方可跨租户读写；learn_roads.go:60-80 已对该问题给出带租户参数的正确改法，此处未跟进。最佳实践：参照 learn_roads，重写 GetByID/Update/Delete 为 `... WHERE id=$1 AND tenant_id=$2`。
- [P3][跨租户计数] industries.go:63-66 — `CountChildren` 无租户过滤，删除前引用检查会把其它租户的子行业计入，误阻或漏阻删除。

## backend/internal/store/job_ability_results.go
- [P2][性能] job_ability_results.go:129-185 — `ListJobAbilityResults` 每行执行 `departmentNameSQL`（LATERAL 递归组织链 + org_types 关联），全量扫描 job_ability_results 后排序分页；`summary`（:223-248）对 certification_rules LEFT JOIN 无 `r.position_id` 索引保障。对照 migrations/118_workspace_indexes 未见 job_ability_results 相关索引。数据量增长后为大表全扫描。
- [P3][边界] job_ability_results.go:434-453 — `RefreshRanks` 以 `PARTITION BY class_name/major_id` 排名，class_name 为 NULL 的学生全部归入同一 NULL 分区，排名失真（低危，容忍）。
- [P3][一致性] job_ability_results.go:405-431 — `UpsertResult` 的 ON CONFLICT 会更新 `tenant_id = EXCLUDED.tenant_id`，理论上可将结果"搬"到其它租户（当前仅聚合任务按租户驱动调用，无实害）。

## backend/internal/store/landing.go
- [P2][过滤缺失] landing.go:34-53 — `ListExams` JOIN exam_usages 未过滤 `eu.status`/`eu.target_type`/`eu.tenant_id`：草稿（draft）安排的考试、任务/节点自动生成的临时考试也会出现在公开落地页，且同一试卷多个安排时行重复。最佳实践：`eu.status IN ('published','finished') AND eu.target_type IN ('class','major','department','public')`。
- [P3][错误处理] landing.go:63 — scan 失败 `continue` 静默丢行。

## backend/internal/store/learn_roads.go
无问题（GetByID/Update/Delete 均已带 tenant_id 过滤；normalizePositionIDs 显式丢弃非法 UUID，与脏数据防御一致）。

## backend/internal/store/lesson_behaviors.go
无问题（upsert 唯一约束 (course_id, student_user_id, record_date) 与 baseline:1469 一致；查询带租户）。

## backend/internal/store/lesson_content.go
- [P2][类型脆弱] lesson_content.go:139-155/158-174 — `Create`/`Update` 将 `domain.JSONSlice`（[]interface{}）直接作为参数写入 `granular_lesson_ids uuid[]` 列（baseline:578），依赖 pgx 反射把 []any 包装成数组按 uuid 元素编码：元素为非法 UUID 字符串时编码报错 500，且语义依赖 pgx 内部机制。课程侧同场景的正确写法是 `[]string` + `$23::uuid[]` 显式转换（courses.go:107/119-123）。最佳实践：参数改 `[]string` 并用 `$N::uuid[]`。
- [P2][性能] lesson_content.go:30-49 — `CitationStats` 对 courses/node_knowledge_point_bindings/question_bank_knowledge_points/questions 四个表做相关子查询计数，knowledge_points 全表扫描 ×4 表无索引保障（对照 118_workspace_indexes 无 knowledge_points 相关索引）。
- [P3][错误处理] lesson_content.go:69 — `_ = q.QueryRow(...)` 吞错误。
- [P3][一致性] lesson_content.go:246-263 — `SyncCourseKnowledgePoints` 的 `$3::uuid[] IS NULL OR id <> ALL($3::uuid[])` 对空数组正确清引用，行为正确（仅提示写法冗余）。

## backend/internal/store/logs.go
- [P3][死代码] logs.go:97 — `var _ = context.Background` 仅为了保导入的注释式写法，无任何用处。

## backend/internal/store/majors.go
- [P2][越权防御缺失] majors.go:19-20 — 同 industries：DictStore 的 GetByID/Update/Delete 无租户过滤，靠 handler crud `CheckOwnership`（major_handler.go:52）兜底；learn_roads 已给出正确改法未跟进。
- [P3][跨租户计数] majors.go:57-60 — `CountUserRefs` 无租户过滤（删除引用检查跨租户计数）。

## backend/internal/store/micro_cert.go
- [P2][越权防御缺失] micro_cert.go:77-116 — `GetTemplate`/`UpdateTemplate`/`DeleteTemplate` 均无租户过滤（依赖 handler 前置 `TemplateTenantID` 校验，既有约定；`DeleteTemplate` 连带的 `DELETE FROM cert_issuance_records WHERE template_id=$1` 也无租户条件）。
- [P3][无事务] micro_cert.go:110-116 — `DeleteTemplate` 先删发放记录再删模板，两步无事务，失败残留孤儿发放记录。
- [P3][一致性] micro_cert.go:118-139 — `IssueCerts` 逐条 INSERT（N 次往返），批次大时慢（容忍）。

## backend/internal/store/node_evaluation_results.go
- [P1][数据丢失] node_evaluation_results.go:90-115 — `Submit` ON CONFLICT 无条件重置 `status='pending'`、`graded_at=NULL`，与场景评价同病：节点测评已由教师评分后可被重交清空评分标记（handler/node_evaluation_result_handler.go:150 提交路径无守卫）。
- [P2][越权防御缺失] node_evaluation_results.go:49-87 — `Get` 无租户过滤（租户隔离版本是 `GetByID`，:118），若 handler 误用 Get 则跨租户读取；建议 Get 也带 tenant 参数。
- [P3][风格] node_evaluation_results.go:74-86/143-155 — `if totalScore != nil { r.TotalScore = totalScore }` 等冗余判断（直接赋值即可，重复 4 处）。

## backend/internal/store/node_quizzes.go
- [P3][事务穿透] node_quizzes.go:82-91 — `DeleteQuiz` 存在性检查用 s.q 全局连接而非 tx：若在事务内先创建后删除同一测验，检查将看不到未提交行而报 NotFound。当前调用方按既有事务用法，低危。
- [P3][边界] node_quizzes.go:94-118 — `ListQuestions` 默认 500 条无 maxPageSize 钳制（query.go 有 maxPageSize=200 约定，此处绕过），大测验列表放大响应。

## backend/internal/store/on_site_question_library.go
- [P2][越权防御缺失] on_site_question_library.go:17-18 — 同 industries：DictStore GetByID/Update/Delete 无租户过滤（handler 层 CheckOwnership:true 兜底，on_site_question_library_handler.go:70,152），learn_roads 正确改法未跟进。

## backend/internal/store/organizations.go
- [P2][越权防御缺失] organizations.go:102-142 — `Get`/`Create`/`Update` 无租户过滤（依赖 handler 前置校验，既有约定；Create 后 fetchOrg 按全局 id 读回）。
- [P2][纵深防御不一致] organizations.go:75-99 — `MemberCounts` 在 tenantID 为空时统计**全租户**用户数（:76-81），而 `Tree`（:52-64）有 `WHERE 1=0` 兜底，两处防御不一致。建议同样拒绝空租户。
- [P3][重复条件] organizations.go:35-48 — `ListConfig.ExtraFilter` 又从 `Values["tenantId"]` 注入一次 `tenant_id = $n`，与 `TenantScoped` 自动注入的条件重复（同值，无害但冗余）。

## backend/internal/store/org_types.go
- [P2][越权防御缺失] org_types.go:18-20 — 同 industries：DictStore CRUD 无租户过滤（handler org_type_handler.go:51,97 兜底）。
- [P3][跨租户计数] org_types.go:58-61 — `CountOrgRefs` 无租户过滤。

## backend/internal/store/platform_settings_store.go
无问题（平台/租户两级键值读写，均按主键/key 精确操作）。

## backend/internal/store/portal.go
- [P2][读路径写库] portal.go:223/558 — `ListExamEvents`/`ListStudentExams` 每个请求先执行 `SyncScheduledExamUsageStatus`（全租户或单租户 UPDATE），读接口触发写事务 + 行锁。低并发可容忍，列为风险点。
- [P2][数据丢失口径] portal.go:227-240/563-577/87-105 — `ListExamEvents`/`ListStudentExams`/`UpcomingExamCount` 均 `JOIN users u ON u.id = eu.creator_id` 并以 `u.tenant_id` 过滤租户：creator_id 为 NULL 的考试安排（历史数据/系统自动创建未挂创建人）被静默排除，学生端看不到本应可见的考试。最佳实践：改用 `eu.tenant_id` 直接过滤（ListExamCenter 已是此口径）。
- [P3][错误处理] portal.go:48/147/201/251/343/374/427/487/532/638/690 — 多处 scan 失败 `continue` 静默丢行（仅聚合/展示场景，低危）。
- [P3][死分支] portal.go:787-793 — `BatchSceneTaskStatus` 中 `status == ""` 分支不可达（列 NOT NULL）。
- [P3][边界] portal.go:88-91 — `UpcomingExamCount` 未排除 `end_time < now` 的已结束考试（"待参加考试数"可能含已结束项）。

## backend/internal/store/position_bindings.go
- [P2][越权防御缺失] position_bindings.go:56-77/199-217 — `PositionAbilityStore.Update/Delete`、`PositionResponsibilityStore.Update/Delete` 均无租户过滤（依赖 handler 前置校验，既有约定）。
- [P3][一致性] position_bindings.go:40-53 — `Create` 后 `fetchBinding` 无租户（按全局 id 读回，正确）。

## backend/internal/store/position_certificates.go
- [P2][错误处理] position_certificates.go:148-164 — `findOrCreateLibrary`：SELECT 只要 `err != nil`（包括连接中断等真实错误）就视为"不存在"继续 INSERT，掩盖底层故障；且无并发保护（无 name 唯一约束），并发 find-or-create 产生重复证书库条目。
- [P2][越权防御缺失] position_certificates.go:96-125 — `Update`/`Delete` 无租户过滤（依赖 handler 前置校验）。
- [P3][一致性] position_certificates.go:23-66 — `List` 无租户过滤（依赖 handler 传入 careerPositionId 且前置校验）。

## backend/internal/store/position_clone.go
- [P3][错误处理] position_clone.go:111-116/147-152/188-193/236-240/271-276 — 各 clone 子步骤 scan 失败一律 `continue` 静默跳过，克隆结果可能静默缺专业/职责/绑定/证书而不报错（事务内整体成功）。低危（数据完整性依赖源表质量）。
- [P3][越权防御缺失] position_clone.go:41-59 — `FetchSource` 无租户过滤（依赖 handler 前置校验）。
- [P3][性能] position_clone.go:102-289 — clone 全程逐行 INSERT（职责/绑定/证书均 N 次往返），事务内可接受，量级小时容忍。

---

## 汇总统计

- 审查文件数：32
- 问题总数：51（P0×1，P1×3，P2×22，P3×25）

### P0
1. exam_results.go:268 — `u.grade` 列不存在，考试交卷必 500。

### P1
2. evaluation_methods.go:23 — ListCategories 无租户过滤，跨租户分类泄漏。
3. evaluation_results.go:81-107 — Submit 无已评分守卫，重交清空教师评分（场景路径）。
4. node_evaluation_results.go:90-115 — 同上（节点路径）。
