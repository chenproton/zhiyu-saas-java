# 代码审查报告：backend/internal/service（第 2 批）

审查方式：27 个文件逐一完整逐行通读；关键结论对照 store/handler 侧实现验证（GetByID nil 行为、tenant 前置校验、batch 白名单、handler 调用点）。
审查时间：2026-08-07
结论：P0 0 个；P1 1 个；P2 9 个；P3 若干。

---

## backend/internal/service/lesson_content.go
- [P1][并发竞态/数据不一致] lesson_content.go:390-418 + 514-548、551-617 — `GenerateCourseAssessments`（发布 hook）对考试安排的生成/更新是"先 FindNodeUsage 再 Create/Update"的非原子流程，且无任何锁或唯一约束兜底；同一课程被并发发布（或发布与编辑测评规则并发）时，两个事务都可能命中 FindNodeUsage 空结果并各自 CreateNodeUsage/CreateTempExam，产生重复考试安排、或后者覆盖前者的 usage 窗口，学生看到的考试安排与最终规则配置不一致；最佳实践：对 usage 表加 (exam_id/paper_id, node_id) 唯一约束 + ON CONFLICT 更新窗口，或将生成改为 upsert 单条 SQL（幂等），发布 hook 即可天然防重
- [P2][明显逻辑 bug] lesson_content.go:514-548、551-617、620-629 — 测评实体生成"只增不删"：规则配置删除某份试卷（paperIds 清空）、清空题目（questionBankQuestions/quizQuestions 为空）或移除 homework 子规则后重新发布，已创建的 exam_usage / 临时考试 / 节点作业不会回收，学生仍会看到已从配置中移除的考试与作业；`applyRuleConfig` 对 `len(questionIDs)==0` / `len(paperIDs)==0` 直接 return 不清理；最佳实践：发布时对"该节点当前 rules 不再包含"的 usages/homework 执行清理（对比期望集合后删除），或至少在重新发布时全量重建该节点的测评实体
- [P2][与 handler/store 契约不一致] lesson_content.go:186-188（GetCourse）、295-297（GetCourseDetail）— 两个课程读取接口不携带 tenantID，unscoped 直读；当前 handler 调用点（clone 后回查、`content_actions.transition` 先 `GetTenantID` 再 fetchCourse）均有租户前置校验所以暂未形成越权，但接口本身无防呆，后续新调用点遗漏校验即产生跨租户读取；同文件 `GetCourseDetailInTenant`（300-302）才是带租户版本，双接口并存易误用；最佳实践：统一为仅保留带 tenantID 的接口，unscoped 变体收敛到 contentActions 内部使用或明确注释调用前提
- [P3][边界条件] lesson_content.go:551-617（ensureNodeQuestionExam）— `rc` 中若残留旧 `usageId` 而 `examId` 为空（历史数据/外部编辑 JSON 遗留），新临时考试创建后不会为新考试建立 usage，只会对旧 usage 更新窗口，新考试成孤儿、旧考试继续被学生使用；正常流程二者成对写入，概率低；最佳实践：examID 重建时校验 usageId 仍指向该 exam，否则丢弃并重新创建
- [P3][并发] lesson_content.go:526-547 — 单节点多试卷场景下 `rc["usageId"]` 只保留最后一份试卷的 usage，多试卷共用同一字段，若后续逻辑按单 usage 解读配置易读错（当前写入路径无碍）；最佳实践：usageId 改为按 paperID 为 key 的 map 或数组
- [P3][死代码/冗余] lesson_content.go:433-435、459-463 — `n.EvalData["evalRuleConfig"] = ruleConfig` / `hybridRules[moduleKey] = part` 均为"把自己赋回自己"的恒等操作（EvalData 是共享 map 引用，内层改动已就地生效），`updated` 标志已足够驱动写回；此赋值无副作用，属冗余代码
- [P3][一致性] lesson_content.go:63-65 — `DeleteKnowledgePoint` 直接透传 store，与 Create/Update 的"事务内同步颗粒课引用"注释模式不一致（引用同步是否在 store 内完成未在 service 层体现，行为依赖 store 实现细节）；最佳实践：确认 store Delete 内清理颗粒课引用，并在 service 层注释说明

## backend/internal/service/log.go
- [P3][命名] log.go:22-28 — `ListLoginLogs`/`ListOperationLogs` 仅凭 `store.ListParams` 携带租户过滤（依赖 config 层），service 签名不体现租户约束，与其他文件多数方法显式传 tenantID 的风格不一致；当前 store 实现有过滤，无实际问题
- 其余无问题

## backend/internal/service/node_evaluation_result.go
- [P2][错误被吞/数据不一致] node_evaluation_result.go:33-50 — `Grade` 为三步走（GetByID → Grade → FindNodeExamResult → UpdateExamResultScore）且全部走全局连接、无事务包裹：Grade 成功后回写考试结果若失败仅 `slog.Warn` 后返回成功，节点测评结果与考试结果分数静默不一致；且 `FindNodeExamResult` 的 DB 错误（err != nil）与"未找到"被合并为 `return nil` 同样静默吞掉；最佳实践：Grade 与回写放入同一事务（回写失败随事务回滚），或回写失败降级为显式错误返回而非仅 Warn；Find 与 Update 错误分开处理
- [P3][契约] node_evaluation_result.go:42 — `result.NodeID/MethodKey/EvaluateeID` 使用依赖 store `GetByID` 对无记录返回 ErrNotFound（已核实 store/node_evaluation_results.go:135-136），nil 解引用不发生，但 service 未对 result 为 nil 做防御，契约依赖 store 实现；可忽略或加一行防御

## backend/internal/service/org.go
- [P3][并发/容忍范围] org.go:73-82 — `SubtreeIDs` 在事务外读取、`DeleteSubtree` 在事务内执行，两者之间并发新增成员/移动节点会导致"组织已删但新增绑定未解绑"的残留；属普通业务并发，按项目"普通业务允许竞态"原则可容忍，仅记录
- 其余无问题（Update 的防环校验与 ValidateOrgRefs 归属校验均正确）

## backend/internal/service/portal.go
- 无问题（空编排壳，方法分散在 resource_code.go / subscription.go / workspace_stats.go）

## backend/internal/service/position_clone.go
- 无问题（Clone 的租户校验、事务、ErrNotFound 透传均正确；`IsNotFound` 为公共辅助函数）

## backend/internal/service/position_config.go
- 无问题（薄转发；UpdateAbilityBinding/UpdateCertificate 等无租户参数系 handler 侧经 PositionTenantID 校验的设计模式，与项目其他模块一致）

## backend/internal/service/position.go
- [P2][错误被吞/数据丢失] position.go:82-124 — `SaveFull` 中 `PrepareAbilityPoint`/`PrepareCertificate`（第 99、112 行）失败时 `continue` 静默跳过：某个自定义能力点/证书因并发同名、DB 异常而准备失败时，用户提交的该绑定被静默丢弃（后续 SaveFull 事务内全量重写，缺失项即消失），且无任何日志或返回提示；同时 prepare 在事务外执行，SaveFull 事务回滚时已 prepare 的能力点/证书成为孤儿数据；最佳实践：prepare 失败时记录错误并返回失败（或至少计入日志），将 prepare 移入同一事务内执行
- [P3][命名/类型] position.go:77-79 — `IncrementView(ctx, targetID string, userID, tenantID any)` 用 `any` 表达 userID/tenantID，类型含义不明确、无编译期约束（可能 nil 或错误类型传参）；最佳实践：改用具体类型或指针类型
- [P3][边界] position.go:56-69 — `Update` 事务提交后经全局连接重新 `Get` 回读，若并发被删除则更新成功后返回 NotFound 错误；概率低，可容忍

## backend/internal/service/recommend.go
- 无问题（薄转发，全部带租户约束）

## backend/internal/service/resource_binding.go
- [P3][分层] resource_binding.go:28-40 — `afterBind`/`afterUnbind` 回调函数作为参数传入 store 由 store 层回调执行（store 内调用 handler 定义的逻辑），分层上 callback 属于 service 层职责，store 承载了编排副作用；当前无实际问题，仅记录契约味道；最佳实践：绑定/解绑后的同步由 service 在事务外显式调用
- [P3][事务] resource_binding.go:73-80 — `CourseSyncBind`/`CourseSyncUnbind` 使用全局连接、无事务，聚合字段同步失败时主绑定已生效而聚合字段陈旧；依赖调用方时机，普通业务可容忍
- 其余无问题

## backend/internal/service/resource_code.go
- 无问题（薄转发）

## backend/internal/service/resource.go
- [P3][契约] resource.go:44-46 — `Get(id)` 无租户参数 unscoped 直读（handler 侧校验），与 GetCourseDetail 同模式；当前调用点安全，仅记录

## backend/internal/service/scenario_config.go
- 无问题（薄转发，归属校验 helper 齐全）

## backend/internal/service/scenario.go
- [P3][分层] scenario.go:170-172 — `BatchGetByTable` 从 service 层直接返回 `pgx.Row`（DB 游标对象）：调用方必须及时 Scan 否则连接被占用/泄漏，且 service 层泄漏 pgx 类型（分层上 service 不应暴露 DB 连接对象）；最佳实践：由 store 提供 Scan 辅助函数（batches.go 已有 Scan*BatchRow），service 返回具体领域类型
- [P3][错误被吞] scenario.go:89-90、100-102 — `PopulateEvalData`/`PopulateAbilityPointNames` 无 error 返回，内部错误静默丢失（富化字段缺失），展示层数据可能不完整；按"非核心容忍"原则可接受，仅记录
- 其余无问题（CloneScenario 租户校验/事务、DeleteTask 事务、ReorderTasks 事务均正确）

## backend/internal/service/service.go
- 无问题（WithTx 委托、GenerateEntityCode 封装正确）

## backend/internal/service/subscription.go
- 无问题（薄转发）

## backend/internal/service/tag_service.go
- 无问题（薄转发）

## backend/internal/service/task_evaluation.go
- [P1][并发竞态/静默数据不一致] task_evaluation.go:42-56、58-90 — `SaveMethods` 的临时考试联动（`EnsureExamUsageForMethod`）在**事务外**、**advisory 锁获取之前**对全局连接执行；并发双保存时：败者事务虽被版本检查拒绝回滚，但其事务外的 ensure 已先于/晚于胜者将 exam_usage（考试安排窗口、activationMode 等）按败者配置写入 → 最终考试安排与胜者已提交的测评方法不一致，且无任何报错（联动失败仅 slog.Info 降级），学生看到的考试与教师保存的配置错位；advisory 锁只保护了 task_evaluation_methods 表写入，未保护 exam usage 联动；最佳实践：将 EnsureExamUsageForMethod 移入事务内（在持锁后执行），或联动改为幂等 upsert 并在失败时返回错误而非静默降级
- [P2][副作用残留] task_evaluation.go:58-90 — 版本冲突（`ErrMethodVersionConflict`）时事务整体回滚，但第 42-56 行事务外已创建的临时考试/usage 不会回滚，残留孤儿考试实体（下一次成功保存可复用，但中间态存在）；最佳实践：随上一条修复（联动入事务）一并解决
- [P3][错误被吞] task_evaluation.go:49-55 — `EnsureExamUsageForMethod` 失败仅 `slog.Info` 后继续，考试安排静默缺失；注释声明为有意降级设计，按"容忍小概率异常"原则可接受，仅记录
- 其余无问题（版本冲突检查逻辑正确：advisory 锁内检查 currentVersion > version）

## backend/internal/service/teaching_plan.go
- [P3][分层泄漏] teaching_plan.go:50-52 — `TeachingPlanStoreRef` 向外部暴露 *store.Store（contentActions pool 使用场景）；属既有设计（contentActions 是豁免冻结区），仅记录
- 其余无问题（GenerateTeachingPlan 事务正确）

## backend/internal/service/tenant_admin.go
- [P2][租户隔离缺失/契约不一致] tenant_admin.go:64-77 — `ResetPassword`/`SetPassword` 仅以 adminID 定位用户，**不携带 tenantID 也无任何租户校验**，与同文件 Create/Update/Delete（均带 tenantID）契约不一致；已核实当前两处 handler 调用点（tenant_handler.go:527-530、657-660）在调用前均先执行 tenantID 限定的 `AdminService.Get` 校验，因此暂未形成实际越权，但存在：① Get 与 SetPassword 之间 admin 被迁移/删除的 TOCTOU 窗口；② 未来新增调用点遗漏校验即构成跨租户改密（学校管理员可直接重置其他租户管理员密码）；最佳实践：service 签名增加 tenantID 并在 store ResetPassword 中加 `AND tenant_id = $n` 约束（与 Delete 一致）

## backend/internal/service/tenant.go
- 无问题（CreateWithDefaults/DeleteTenant 事务正确；IsConflict 辅助判断清晰）

## backend/internal/service/term.go
- [P3][边界] term.go:41-43 — `DeleteTerm` 无事务且不校验引用（学期可能被教学计划引用），被引用时依赖 DB 外键报错冒泡为 500，无业务化错误信息；概率低，handler 可补充预检
- 其余无问题

## backend/internal/service/training_program.go
- 无问题（PutTrainingProgramCourses/CloneTrainingProgram 事务正确；`TrainingProgramStoreRef` 同 teaching_plan 的既有设计）

## backend/internal/service/user_extension_field.go
- [P3][错误被吞] user_extension_field.go:36 — `FilterTenantRoleCodes` 的 error 被忽略（仅取返回值），DB 故障时角色过滤可能静默失效或返回空列表，影响扩展字段的适用角色约束；最佳实践：err 非 nil 时返回错误
- 其余无问题

## backend/internal/service/user.go
- [P3][错误被吞] user.go:29、161-165 — `AttachUserRoles` 无 error 返回，角色附加失败时用户列表/详情静默缺失角色字段（展示富化，可容忍）
- [P3][并发/容忍] user.go:147-158 — `BindRoles` 的 `ValidateRolesInTenant` 在事务外校验、事务内绑定，期间角色被删除则绑定已删角色；普通业务竞态，按项目原则容忍
- 其余无问题（Update 的租户-组织归属校验使用 existing.TenantID，防跨租户挂节点逻辑正确；BatchCreate 去重键正确）

## backend/internal/service/user_relation.go
- 无问题（双方同租户校验正确，透传设计清晰）

## backend/internal/service/workflow.go
- 无问题（薄转发）

## backend/internal/service/workspace_stats.go
- [P3][错误被吞] workspace_stats.go:12-114 — 全部统计接口不返回 error，DB 故障时静默返回零值（仪表盘显示 0），用户无法区分"无数据"与"查询失败"；属"非核心容忍"范围，仅记录
- 其余无问题（薄转发）

---

## 汇总

- 审查文件数：27
- 总问题数：P0=0，P1=1，P2=9，P3=14，合计 24
- P0/P1 摘要：
  - [P1] task_evaluation.go:42-90 — SaveMethods 临时考试联动在事务外、锁外执行，并发保存时败者的 exam usage 写入污染胜者结果，考试安排与已保存配置静默不一致
