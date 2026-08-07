# Service 层代码审查报告（service-01）

审查范围：`backend/internal/service/` 下 27 个文件（逐行完整通读）。
审查日期：2026-08-07。原则：简单优先、锁只给核心业务、只报高危越权、错误吞仅在核心路径上报。

---

## backend/internal/service/ability.go
- 无问题（全部为对 store 的透传，租户参数完整）。

## backend/internal/service/affairs.go
- [P1][并发竞态-排课核心] affairs.go:223-299（校验）与 affairs.go:304-315（插入） — `AutoSchedule` 的**内存冲突校验发生在 advisory 锁事务之外**：先加载 `existing`（213 行）并在内存中完成全部排布，之后才在 `WithTx` 内取 `LockScheduleTerm` 并逐条插入，插入阶段不再复检冲突。`schedule_entries` 表无唯一/排他约束（migrations/092_affairs.up.sql:115-137 仅普通索引），冲突全靠应用层检查。两个并发 `AutoSchedule`（或自动排课与手动 `CreateScheduleChecked` 交错）会基于同一 `existing` 快照各自判定"无冲突"，随后串行插入，产生教师/班级/场地重叠的冲突排课。注释（305 行）声称锁"防冲突校验与插入间的竞态"，但校验实际未在锁内。最佳实践：将"锁内重读 existing + 内存校验 + 插入"整体放进同一事务（锁内重新加载 `ListTermScheduleBriefs` 再计算），或在锁内对每个待插参数调用一次 `CheckScheduleConflictsTx`。
- [P3][过时注释] affairs.go:412-413 — `Store()` 方法的注释写的是"QueryerForStore 返回 Store（contentActions 用）"，与实际函数名 `Store` 不符，且该方法是多余暴露（Service 内已有 `Store()`，嵌入字段）。最佳实践：删除该方法或更正注释。
- [P3][错误吞] affairs.go:174-176, 179-181, 184-186 — `FallbackClassID`/`ResolveCourseIDByCode`/`PlanEntryCourseID` 三个辅助查询吞掉错误仅返回 nil，调用方无法区分"查无数据"与"DB 故障"（属于容错设计权衡，非核心路径，仅提示）。

## backend/internal/service/affairs_plan.go
- 无问题（仅服务构造函数，业务在 handler 直连 store）。

## backend/internal/service/approval.go
- [P3][契约脆弱] approval.go:25-55 — `ReviewApproval` 同时接收 `action` 与 `newStatus` 两个语义重叠的参数，reject 分支以 `action` 判断、落库用 `newStatus`；若调用方传错（action=approved 而 newStatus=rejected）会走 AdvanceRecord 而非 RejectRecord，行为与预期不符且无校验。最佳实践：只保留一个状态参数，删除 `action`，或服务内自行推导。注：并发评审由 store `AdvanceRecord` 的 `WHERE status='pending' AND current_step_idx=$6` CAS（store/approvals.go:152-155）保证，正确。
- [P3][错误吞] approval.go:64-65 — `PendingApprovalCount` 吞错误返回 0，首页待办数为 0 与失败无法区分（门户读接口，低风险）。

## backend/internal/service/approval_service.go
- 无问题（仅服务构造函数）。

## backend/internal/service/auth.go
- [P3][错误吞] auth.go:48-50, 53-55, 58-60, 63-65, 68-70 — `GetTenantByID`/`GetOrganizationByID`/`GetMajorByID`/`ListUserRoles`/`ListUserRoleCodes` 吞掉错误返回零值/nil；`auth_handler.go` 的 `fetchTenantByID` 等直接赋给响应（Me 接口租户/角色静默缺失），`ListUserRoleCodes` 空角色可能影响权限判定。登录路径上的 `UpdateLastLogin`(28-30)/`RecordLoginLog`(33-35) 吞错是合理容错（登录日志不应拖垮登录）；但角色/租户读取建议返回 error 或至少打日志。最佳实践：角色查询改为返回 error 让调用方决策，其余容错路径补 slog 日志。

## backend/internal/service/banner.go
- 无问题（透传，租户参数完整）。

## backend/internal/service/batch.go
- [P3][分层穿透] batch.go:40-42 — `BatchGetByTable` 直接把 store 的 `pgx.Row` 返回给 handler，handler 需要自行 `Scan`，破坏 service 层封装契约（handler 与 SQL 结果结构耦合）。最佳实践：service 内完成 Scan 返回领域对象。
- [P3][错误吞] batch.go:45-47, 50-52, 55-57 — `BatchCourseProgress`/`BatchCourseStudentCounts`/`BatchSceneTaskStatus` 吞错误返回空 map，前端进度/人数静默显示为 0（门户列表辅助数据，低风险）。

## backend/internal/service/community.go
- [P3][读操作被写连坐] community.go:60-62 — `GetTopic` 详情读取时 `RecordView`（写浏览记录）失败会使整个帖子详情读取返回 500；按"小概率异常宁可容忍"原则，建议浏览计数失败时忽略（slog）而仍返回详情。注：事务内 `CreateReply`+`IncrementTopicReplyCount` 均用 `tx.Q()`（83-93 行），正确。

## backend/internal/service/evaluation_ability_result.go
- 无问题（全部透传，租户参数完整）。

## backend/internal/service/evaluation_appeal.go
- 无问题（透传）。注：`GetAppeal`(15-17)/`ProcessAppeal`(25-27) 未限定租户，依赖 handler 前置校验。

## backend/internal/service/evaluation_cert.go
- [P2][租户隔离契约缺失] evaluation_cert.go:92-94, 117-119, 157-185 — `ListCertificationItems(ruleID)`、`ListCertificationPoints(itemID)`、`GetCertificationFull(ruleID)`（及其内部 `ListFullItems`/`ListFullPoints`/`ListTasksByPointIDs`）均无租户限定参数，与同文件其他接口（`GetCertificationRuleByTenant`/`UpdateCertificationItem(tenantID)` 等）的租户限定风格不一致。若 handler 未先校验 ruleID/itemID 归属（`GetCertificationRuleByTenant` 可作校验途径），存在跨租户读取窗口。最佳实践：这些读取改为带 tenantID 的 Scoped 版本，或在 handler 先做归属校验。
- [P3][静默回退] evaluation_cert.go:21-54 — `validateLevelMapping` 校验严格（5 档、连续、首档 min≥1、末档 max=100），正确；无问题。

## backend/internal/service/evaluation_certgrade.go
- [P3][租户契约依赖 handler] evaluation_certgrade.go:9-30 — `ListCertGrades(positionID)` 下钻 `ListCompRequirements`/`ListLeaderboard` 均未限定租户，依赖 handler 先用 `PositionTenantID`(33-35) 校验（属既有模式，仅提示）。

## backend/internal/service/evaluation_common.go
- [P3][重复代码] evaluation_common.go:10-42 — `BatchList`/`BatchTenantOf`/`BatchCreate`/`BatchUpdate`/`BatchDelete`/`BatchUpdateStatus`/`BatchGetByTable` 与 batch.go:10-42 逐行重复（除接收者类型外完全一致）。最佳实践：提取公共函数或让 EvaluationService 组合 PositionService，按组件复用原则消除重复。
- [P3][分层穿透] evaluation_common.go:40-42 — 同 batch.go，直接返回 `pgx.Row` 穿透到 handler。

## backend/internal/service/evaluation_exam.go
- [P2][错误吞导致静默失败] evaluation_exam.go:21-26 — `ListExams` 中 `BatchFetchExamQuestions` 失败仅以 `qErr == nil` 静默忽略，试卷列表返回空 `Questions`，前端无任何提示；题目批量拉取失败属数据完整性展示问题。最佳实践：失败时返回错误（或至少 slog.Error 并在响应中体现差异）。
- [P2][错误吞导致静默缺失] evaluation_exam.go:95-98 — `ListExamCenter` 中 `UserClassNodeID` 错误被吞，`classNodeID` 取空串，学生端按班级过滤的考试（`Participatable`/`ClassMatch`）会静默全部消失，学生无法看到/参加本班考试且无报错。最佳实践：返回 error 或在失败时明确降级行为。
- [P3][时间格式容错] evaluation_result.go:28-37（SubmitExamResult 窗口校验） — `StartTime`/`EndTime` 解析失败时跳过校验（fail-open），若入库格式与 RFC3339 不一致，考试开始前/结束后仍可提交；DB 内为 TIMESTAMPTZ 序列化结果，实际低风险，仅提示。

## backend/internal/service/evaluation.go
- 无问题（透传）。

## backend/internal/service/evaluation_graduation.go
- [P3][多余事务] evaluation_graduation.go:30-34 — `DeleteGraduationTopic` 事务内仅一条 DELETE，无需 WithTx（保持风格统一亦可，低优先级）。

## backend/internal/service/evaluation_method.go
- 无问题（透传）。

## backend/internal/service/evaluation_portrait.go
- 无问题（透传）。

## backend/internal/service/evaluation_question.go
- 无问题。注：`AddExamQuestion`/`RemoveQuestion`/`UpdateQuestionScore`/`RecalcExamTotal` 虽未显式传 tx（54-85 行），但 `WithTx` 生成的 `txStore` 内所有子 store 均以 tx 作为 Queryer（store/store.go:205-221 `NewWithTx` 全量重建），事务内语句确实落在同一事务中，无事务穿透。
- [P3][评分粒度] evaluation_question.go:74-85 — `UpdateExamQuestionScore` 未限定租户（examID 直接更新），依赖 handler 前置校验。

## backend/internal/service/evaluation_result.go
- [P1][并发竞态-提交核心] evaluation_result.go:39-67（检查）与 evaluation_result.go:124-152（写库） — `SubmitExamResult` 的"已评分/教师已评分/已提交"重交保护检查全部在事务外基于全局连接执行，事务内 `SaveResult` 的 `ON CONFLICT (exam_usage_id, user_id) DO UPDATE` 无条件覆盖已有行（store/exam_results.go:281-287，无 `graded_at IS NULL` 之类守卫）。竞态窗口：教师评分与学生在"允许重交"或窗口判断期间的再次提交并发时，学生重交可覆盖教师已评分数与 grading_status；双重复交也可同时通过"已提交"检查。最佳实践：将检查移入事务并加行锁（`SELECT ... FOR UPDATE`）或在 SaveResult upsert 的 WHERE 加 `graded_at IS NULL` 守卫（教师评分后拒绝覆盖），使检查-写入原子化。
- [P3][失败仅告警] evaluation_result.go:290-301 — `syncExamResultScore`（GradeEvaluationResult/BatchGradeEvaluationResults 调用）失败仅 `slog.Warn`，场景评价已落库但对应考试结果分数不同步，属已知容错设计，有日志非静默，仅提示。

## backend/internal/service/favorites.go
- 无问题（透传，按 userID 限定）。

## backend/internal/service/hybrid_module.go
- 无问题（`ReplaceHybridModules` 事务内 DELETE+INSERT 使用 `txStore.Q()`，正确）。

## backend/internal/service/job_ability_aggregator.go
- [P2][数据被零值覆盖] job_ability_aggregator.go:373-386 — `profile := profiles[studentID]` 对未命中的 studentID 得到零值结构体，随后 `UpsertResult` 会用空 `ClassName`/`MajorName`/`MajorID` 覆盖该学生已存在的岗位能力结果行（`UpsertResult` 为全量 upsert）。触发条件：候选学生（`ListCandidateStudents` 产出）与 `ListProfiles` 结果不一致（如并发删号、筛选口径差异）。最佳实践：profile 未命中时跳过该学生或保留旧值。
- [P3][静默回退] job_ability_aggregator.go:157-164 — 能力点自定义分档 JSON 转换（Marshal/Unmarshal）失败静默忽略，`levels` 为空则静默回退系统五档，无日志；建议失败时记录日志。
- 注：同岗位并发汇聚由进程内互斥（132-134 行）+ 常驻锁 map 保证，设计正确；单实例部署下有效。

## backend/internal/service/job_ability_levels_test.go
- 无问题（校验/档位/胜任度公式测试完整，与实现一致）。

## backend/internal/service/landing.go
- 无问题（透传）。

## backend/internal/service/lesson_behavior.go
- 无问题（透传，租户限定）。
