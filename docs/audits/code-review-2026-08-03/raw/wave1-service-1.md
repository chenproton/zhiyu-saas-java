# service 批次1 审查（26文件，2719行）

## P1
```
backend/internal/service/affairs.go:183-305 | P1 | 并发/锁 | AutoSchedule 在事务外读取 pending/existing 做内存冲突校验，插入事务（293-300）未调用 LockScheduleTerm，且 schedule_entries 无唯一约束（store/scheduling.go:227 直接 INSERT）；两次自动排课或自动+手动并发时会双双通过校验插入互相冲突/重复的排课 | 插入事务内先 LockScheduleTerm(tenant,term) 再插入，或改为对每个候选在事务内走 CheckScheduleConflictsTx
backend/internal/service/job_ability_aggregator.go:26-43,124-131 | P1 | 并发/锁 | lockPosition/unlockPosition 的"用完即删"破坏互斥性：B 正在等待旧 mutex 时 unlockPosition 删除 map 项，C 拿到新 mutex 立即进入，与 B 并发汇聚同一岗位，破坏防重 | 改用引用计数（无等待者时才删），或永不删除，或改分片锁
```

## P2
```
backend/internal/service/affairs.go:236-282 | P2 | 性能 | 每个待排条目对 7×节次×场地 穷举，每次候选重建 checkSet（make+双 append 整份 existing+creates），最坏复杂度 O(条目×7×P×V×(E+C))，大批量学期开销明显 | 预建 (day,period,venue/teacher/class) 占用索引，判定从 O(n) 降到 O(1)
backend/internal/service/evaluation_exam.go:15-28 | P2 | 错误处理 | ListExams 中 BatchFetchExamQuestions 出错被静默忽略（if qErr==nil），试卷题目为空且无日志，前端无法区分"无题"与"查询失败" | 记录日志或返回 error
backend/internal/service/evaluation_exam.go:32-53,69-90 | P2 | 安全/越权 | UpdateExam/DeleteExam/GetExam/GetExamUsage/UpdateExamUsage/DeleteExamUsage/SetExamUsageStatus 均无 tenantID 参数，仅按 id 操作；同文件题库/题目均有租户限定版本，风格不一致，若 handler 未前置校验可跨租户读写 | 统一增加 tenantID 参数并 store 层按租户过滤
backend/internal/service/evaluation_appeal.go:15-17,25-27 | P2 | 安全/越权 | GetAppeal/ProcessAppeal 无 tenantID，仅按 id 查询/更新申诉状态，跨租户可通过猜测 id 查看/处理他人申诉（service 签名层面无隔离） | 增加 tenantID 参数并在 store 层过滤
backend/internal/service/evaluation_result.go:109-115,137-141,144-155 | P2 | 数据一致性 | GradeEvaluationResult/BatchGradeEvaluationResults 评分写入与 syncExamResultScore 分数同步不在同一事务，同步失败仅 slog.Warn，产生"评分已提交但 exam_results.score 未更新"的半成功状态 | 把分数同步并入评分事务，或同步失败返回错误/纳入补偿
backend/internal/service/job_ability_aggregator.go:217-362 | P2 | 性能/一致性 | 每个学生单独开一个事务 upsert（N 学生=N 事务）；RefreshRanks（365）在循环外单独执行，若失败则学生结果已写入、排名未刷新，返回 error 但数据半更新 | 合并为批量/分批写入；RefreshRanks 纳入同一事务或失败补偿
```

## P3
```
backend/internal/service/affairs.go:398-400 | P3 | 命名/分层 | Store() 方法将底层 *store.Store 直接暴露给 handler，且注释写错方法名（QueryerForStore） | 修正注释，暴露给 contentActions 改为专用窄接口方法
backend/internal/service/auth.go:28-70 | P3 | 错误处理 | UpdateLastLogin/RecordLoginLog/GetTenantByID/ListUserRoles/ListUserRoleCodes 等吞错返回 void/nil，DB 失败无日志；GetTenantByID 出错时返回 nil 会被 handler 误判为 404 而非 500 | 返回 error 或在方法内记录日志
backend/internal/service/batch.go:10-42 与 evaluation_common.go:10-42 | P3 | 重复代码 | 两文件 7 个泛型批次方法（BatchList/BatchTenantOf/BatchCreate/BatchUpdate/BatchDelete/BatchUpdateStatus/BatchGetByTable）完全重复，分别挂在 PositionService/EvaluationService 上 | 抽取公共 helper 或收敛到单一 service
backend/internal/service/batch.go:40-42 / evaluation_common.go:40-42 | P3 | 分层 | BatchGetByTable 返回未 scan 的 pgx.Row，调用方（handler）需直接 scan 数据库行，暴露存储细节 | 封装为强类型返回值
backend/internal/service/job_ability_aggregator.go:315 | P3 | 逻辑 | profile := profiles[studentID] 未校验 key 存在，用户缺失/列表不全时取零值，upsert 空班级/专业名 | 先查 map 再兜底跳过
backend/internal/service/lesson_content.go:377-441 | P3 | 分层 | GenerateCourseAssessments 以 *store.Store 为入参（把存储句柄传进 service 方法），破坏"service 只经 store 访问"封装 | 改为接收 Queryer，或下沉到 store 内部
backend/internal/service/affairs.go:413-415,163-175 | P3 | 错误处理 | TimetableVersion/FallbackClassID/ResolveCourseIDByCode/PlanEntryCourseID 无 error 返回，查询失败被吞，handler 无法区分空结果与 DB 错误 | 返回 (T,error)
backend/internal/service/log.go:22-29 | P3 | 分层 | 直接调用 store.ExecuteListQuery 组装 SQL 查询，绕过具名 store 方法 | 收敛为 store 具名方法
```

## 无问题文件
ability.go、affairs_plan.go、approval.go、approval_service.go、banner.go、evaluation_ability_result.go、evaluation_cert.go、evaluation_certgrade.go、evaluation.go、evaluation_graduation.go、evaluation_method.go、evaluation_portrait.go、evaluation_question.go、hybrid_module.go、landing.go、lesson_behavior.go

## 补充说明（非问题）
approval 的并发防重已在 store 层用 CAS（WHERE status='pending' AND current_step_idx=oldStepIdx）实现；SubmitExamResult 的重复提交经 store 层 ON CONFLICT (exam_usage_id,user_id) 幂等覆盖。

总行数 2719
