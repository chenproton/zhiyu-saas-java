# service 层复查报告（2026-08-08）

范围：backend/internal/service 下 27 个文件逐一完整通读 + 关键 store 守卫回归核对。
已核对上轮修复项：自动排课锁内校验（affairs.go:219-228）✓、SaveResult/ResultTeacherGraded graded_at 守卫（store/exam_results.go:171-180, 284-291）✓、SyncScene/Course/Node 三方 graded_at 守卫（store/exam_results.go:349-463）✓、测评方式联动移入锁内+SaveMethods 事务化（service/task_evaluation.go:41-88，不在本轮清单但已核对）✓、审批 AdvanceRecord/RejectRecord CAS（store/approvals.go:145-166）✓、UpdateExamQuestionScore 事务化+ErrNotFound（evaluation_question.go:74-85）✓。

## backend/internal/service/ability.go
无问题

## backend/internal/service/affairs.go
- [P3][边界] affairs.go:231-242 — 自动排课中条目指定 VenueType 但租户无该类型场地时（filtered 为空），静默回退到全量场地列表，可能把实践课排进理论场地；最佳实践：回退前记录日志或将该条目计入 failed（「未找到匹配类型场地」），仅当场地类型为空时才全量。
- [P3][性能] affairs.go:254-298 — 三层循环（day×period×venue）内每次迭代都重建 checkSet 并整体 append existing+creates（O(日×节×场地×已有排课)）；排课规模有界可接受，但可将已放行 brief 增量维护，仅在 creates 变化后追加，减少重复拷贝。

## backend/internal/service/affairs_plan.go
无问题

## backend/internal/service/approval.go
无问题（AdvanceRecord/RejectRecord 均带 status+step CAS，事务内同步实体状态，上轮已修且回归通过）

## backend/internal/service/approval_service.go
无问题

## backend/internal/service/auth.go
- [P3][错误吞] auth.go:28-30,33-35 — UpdateLastLogin/RecordLoginLog 吞错误无日志，登录主链路失败时静默；最佳实践：slog.Warn 记录，避免排障无痕（属容忍项，可不改）。

## backend/internal/service/banner.go
无问题

## backend/internal/service/batch.go
- [P3][死代码/重复] batch.go:9-42 与 evaluation_common.go:9-42 — BatchList/BatchTenantOf/BatchCreate/BatchUpdate/BatchDelete/BatchUpdateStatus/BatchGetByTable 两份完全重复实现挂在不同 service 上；最佳实践：收敛为单一公共 service 方法（如 Service 基类或独立 BatchService），两处统一委托。

## backend/internal/service/community.go
- [P3][契约] community.go:60-62 — GetTopic 阅读计数（RecordView）失败时直接让整个详情读取报错，读路径被非核心副作用拖垮；最佳实践：计数失败仅记日志，仍返回帖子内容。

## backend/internal/service/evaluation_ability_result.go
无问题

## backend/internal/service/evaluation_appeal.go
无问题（Process 无幂等守卫属可容忍：重复处理为覆盖，非核心）

## backend/internal/service/evaluation_cert.go
- [P3][契约] evaluation_cert.go:188-192 — PutCertificationFull 直接透传规则级 level_mapping 落库，不做 validateLevelMapping 校验，与 PutCertificationPointLevels（evaluation_cert.go:213-224）校验口径不一致；最佳实践：入库前对 rule.level_mapping 复用 validateLevelMapping 校验（恶意/脏数据会被汇聚器容错降级，属低危）。

## backend/internal/service/evaluation_certgrade.go
无问题（ListCertGrades 空 gradeIDs 已短路，无 N+1）

## backend/internal/service/evaluation_common.go
- [P3][死代码/重复] 同 batch.go 重复问题。

## backend/internal/service/evaluation_exam.go
无问题

## backend/internal/service/evaluation.go
无问题

## backend/internal/service/evaluation_graduation.go
无问题

## backend/internal/service/evaluation_method.go
无问题

## backend/internal/service/evaluation_portrait.go
无问题

## backend/internal/service/evaluation_question.go
无问题（Add/Remove/UpdateScore 均事务内重算总分，UpdateExamQuestionScore 命中校验到位）

## backend/internal/service/evaluation_result.go
- [P2][并发竞态] evaluation_result.go:255-261 — GradeEvaluationResult 在事务外先后执行 Grade 与 syncExamResultScore；两者之间学生可重交（exam_results.graded_at 尚未写入）：SaveResult 覆盖新作答（含客观分），随后教师分覆盖 score，最终「教师分数+学生新答案」不一致；最佳实践：将 Grade 与 UpdateExamResultScore 包进同一事务（或先写 graded_at 再评分）。
- [P2][并发竞态] evaluation_result.go:264-287 — BatchGradeEvaluationResults 批内 BatchGrade 无行数命中校验（store/evaluation_results.go:130-140 忽略 RowsAffected），对已评分结果静默成功，随后无条件 syncExamResultScore 用新分覆盖考试结果分，造成场景分与考试分分叉；与单条 Grade（store/evaluation_results.go:123-125 返回 ErrNotFound）行为不一致；最佳实践：BatchGrade 返回命中数，未命中条目跳过同步并统计/报错。
- [P2][数据一致性] evaluation_result.go:290-301 — syncExamResultScore 仅更新 score/is_pass/graded_at，不更新 grading_status；学生含主观题交卷后 grading_status='pending'，教师经场景评分后考试结果仍显示「待评分」但已有分且 graded_at 非空，考试中心展示自相矛盾；最佳实践：同步时一并置 grading_status='evaluated'（与 GradeExamResult 口径一致）。
- [P2][逻辑 bug] evaluation_result.go:140（联动 store/exam_results.go:455-461）— SyncSceneEvaluation 的 graded_at CASE 第二分支「EXCLUDED.status='evaluated' → NOW()」：学生先经 SubmitEvaluationResult 直交产生 pending 场景结果，随后参加该方式的全客观题考试交卷，同步将该场景结果自动置 evaluated+graded_at=NOW()（无教师评分）；后果：UsageGradedByUser 判定为教师已评 → 后续重交一律 ErrAlreadyGraded，且教师 Grade（守 status='pending'）返回 ErrNotFound 无法再评；最佳实践：仅当 EXCLUDED 由「人工评分路径」产生时写 graded_at，自动判分路径只写 status 不写 graded_at（与 INSERT 路径行为一致）。
- [P3][边界] evaluation_result.go:23-26 — SubmitExamResult 不校验 usage.Status：draft 安排走到 UsageExamInfo（store/exam_results.go:132 WHERE status<>'draft'）返回裸 pgx.ErrNoRows，handler 表现为 500 而非 400/404；最佳实践：Get 后显式判 draft 返回 ErrNotFound。
- [P3][错误吞] evaluation_result.go:29,34 — 窗口校验 time.Parse(RFC3339) 失败时静默跳过（解析不了就当无限制）；虽 store 读出侧统一 Format(RFC3339) 保证可解析，仍建议解析失败返回明确错误而非放行。

## backend/internal/service/favorites.go
无问题

## backend/internal/service/hybrid_module.go
无问题（ReplaceByNode 事务内 DELETE+INSERT）

## backend/internal/service/job_ability_aggregator.go
- [P2][数据丢失] job_ability_aggregator.go:373（联动 store/users.go:474-496）— profiles 以 users 表行回填，若候选学生已删号（scene_evaluation_results 的 evaluatee_id 仍存在），ListProfiles 无该 key，零值 struct 传入 UpsertResult 会把已存的 class_name/major_name 覆写为空串（旧数据被抹白）；最佳实践：profile 缺失的学生跳过 Upsert（或仅更新得分列不动身份列）。
- [P3][并发竞态] job_ability_aggregator.go:71-77 — AggregatePosition 先 CreateLog（running）后加岗位锁执行；同岗位并发两次汇聚会产生两条 running 日志，败者日志收尾正常但存在「同岗位双日志」噪音；岗位锁为进程内锁，多副本部署时锁不互斥（当前单实例可接受）；最佳实践：文档注明单实例前提，或日志与锁同一原子入口。
- [P3][死代码] job_ability_aggregator.go:234-311 — pointDetail 中 CompetencyV2 指针仅用于写明细，读取端回退口径已对齐；无问题，仅备注。岗位总评 grade 置空、胜任度（新）可超 100%（测试断言 145/195/295）均为既定设计。

## backend/internal/service/job_ability_levels_test.go
无问题（覆盖五档校验、等级距离法、旧公式回归，与实现一致）

## backend/internal/service/landing.go
无问题

## backend/internal/service/lesson_behavior.go
无问题
