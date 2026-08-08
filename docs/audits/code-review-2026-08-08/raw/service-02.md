# Service 层复查 02（2026-08-08）

复查范围：`/tmp/opencode/s2-ab` 列出的 28 个 service 文件。逐一完整读取并交叉核对 store 层签名（事务穿透、锁、租户隔离、乐观锁）与 handler 调用点（越权）。上次已修复项（SaveMethods 锁/联动事务化、发布 hook、事务穿透、job_ability_aggregator 锁）复查确认无回归。

## backend/internal/service/lesson_content.go
- [P2][逻辑 bug] lesson_content.go:590-611 — `ensureNodeQuestionExam` 的 usage 复用分支（`FindNodeUsage` 命中）只更新窗口，不把 `rc["usageId"] = found` 写回；`usageID == ""` 的创建分支才写回。若历史数据中 eval_data 的 usageId 丢失（编辑测评规则丢配置场景正是注释想修复的路径），usage 已存在但 usageId 永远无法补回，persisted eval_data 持续缺 usageId → `FindNodeExamResult`（store/evaluation_results.go:177）按 usageId 关联失败 → 教师评分后考试结果分数回写永久失效。最佳实践：复用分支同样执行 `rc["usageId"] = found` 写回并标记 updated；`ensureNodePaperUsage`（526-548 行）同型问题一并处理。
- [P3][契约] lesson_content.go:155-159 — `CloneCourse` 对 `FetchSource` 的 `ErrNotFound` 未做映射（`PositionCloneService.Clone` 在 position_clone.go:27-31 有 `errors.Is(err, store.ErrNotFound)` 映射），两处行为不一致，handler 需自行区分错误。最佳实践：与 position clone 对齐。
- [P3][风格] lesson_content.go:123-127 — `DeleteQuiz` 用 `WithTx` 包单 store 调用（`DeleteQuiz` 本身接受 tx Queryer，仅两条语句），冗余；与同文件 `DeleteNode` 等直通调用不一致。
- [P3][边界] lesson_content.go:541-545 — 已有 usage 且带窗口配置时只调 `UpdateUsageWindow`；若 rc 解析出的 activationMode 为 nil 而窗口有值，窗口更新仍执行，行为可接受，但条件 `rc["activationMode"] != nil` 与窗口参数并列判断语义含糊，易误导后续维护。

## backend/internal/service/log.go
## 无问题
（薄转发，经 store.ExecuteListQuery + store 侧 ListConfig，SQL 不在此层）

## backend/internal/service/node_evaluation_result.go
- [P1][错误吞] node_evaluation_result.go:43-45 — `FindNodeExamResult` 返回的 error 与"查无考试结果"混为一体直接 `return nil` 吞掉，无任何日志。正常路径（未考试/非考试方式 → ErrNoRows）吞掉可接受，但真实 DB 错误（如 eval_data 中 `usageId` 非合法 uuid 触发 `::uuid` 强转失败）也被静默吞掉，教师评分成功但考试结果分数回写永久失败且无痕迹。最佳实践：store 层把 `pgx.ErrNoRows` 转成空串（或返回 found bool），service 对非 ErrNoRows 错误至少 `slog.Warn`。
- [P3][事务] node_evaluation_result.go:33-50 — `Grade` 三步（GetByID → Grade → 回写 exam_results）无统一事务；回写失败仅 Warn（可容忍设计），评分本身有 `status='pending'` 乐观守卫（store/node_evaluation_results.go:169），并发双评安全。属可接受容错，仅提示可考虑把回写并入同一事务。

## backend/internal/service/org.go
- [P3][并发竞态] org.go:56-67 — `Update` 的防环校验（`IsDescendant`）与写入分离执行、无事务无锁；并发两个管理员同时移动节点可产生环。组织树非核心业务（锁只给排课/提交/审批/汇聚类），概率低，暂可容忍；如要根治：校验+更新放入同一事务并 `SELECT ... FOR UPDATE`。
- [P3][并发竞态] org.go:73-82 — `Delete` 的 `SubtreeIDs` 在事务外读取，事务内删除；并发改父节点会导致子树快照过期（漏删/误删后代）。同上，非核心、小概率，容忍或加锁均可。
- [P3][契约] org.go:48-49 — `Update` 不携带 tenantID，租户归属校验完全依赖 handler 预查（org_handler.go:146 已 verifyTenantOwnership），签名上建议显式加 tenantID 防未来调用方漏检。

## backend/internal/service/portal.go
## 无问题
（空壳结构体，仅挂订阅/资源码方法）

## backend/internal/service/position_clone.go
## 无问题
（ErrNotFound 映射、租户校验、事务内 code 生成均正确）

## backend/internal/service/position_config.go
## 无问题
（薄转发；Update/Delete 系列无租户参数，handler 侧均先经 `PositionTenantID` 校验，见 position_ability_handler.go:113-118、position_responsibility_handler.go:62-67、position_certificate_handler.go:61-75）

## backend/internal/service/position.go
- [P2][数据丢失/错误吞] position.go:96-106、108-119 — `SaveFull` 中 `PrepareAbilityPoint`/`PrepareCertificate` 出错直接 `continue` 静默跳过，自定义能力点/证书绑定被悄悄丢弃，接口返回成功、用户无感知。小概率 DB 错误路径但后果是数据丢失且无日志。最佳实践：至少 `slog.Warn` 记录，或把错误返回由 handler 提示"部分绑定保存失败"。
- [P2][事务边界] position.go:99-119 — `Prepare*` 在事务外（pool 连接）执行，仅映射表在 `WithTx` 内写；若事务后续失败回滚，已创建的能力点/证书库条目成为孤儿数据（无关联岗位）。最佳实践：把 Prepare 移入事务内（或接受孤儿并补清理）。
- [P3][风格] position.go:77-79 — `IncrementView` 参数 `userID, tenantID any` 类型不安全，建议显式 `*string`。

## backend/internal/service/recommend.go
- [P3][风格] recommend.go:9-32 — 推荐位方法挂在 `PositionService` 上，与域不符（同 workspace_stats.go 问题）；纯转发无逻辑问题。

## backend/internal/service/resource_binding.go
- [P3][契约] resource_binding.go:73-79 — `CourseSyncBind`/`CourseSyncUnbind` 与 `Bind`/`Unbind` 是两次独立调用（无事务），由 handler 编排；中间失败时绑定表与课程聚合字段（resource_ids/resource_count）不一致。属 handler 编排责任，提示聚合字段刷新失败路径无补偿。

## backend/internal/service/resource_code.go
## 无问题
（平台管理员域，super admin 路由保护）

## backend/internal/service/resource.go
## 无问题
（薄转发；`Delete`/`Update` 无租户参数但资源 ID 全局唯一，handler 层校验）

## backend/internal/service/scenario_config.go
- [P3][契约] scenario_config.go:47-49、57-59 — `UnbindKnowledge`/`UnbindAbility` 仅按绑定行 id 删除、无租户参数，越权防护完全依赖 handler 先查 `TaskBindingTaskID` 归属。当前 handler 均校验，仅提示。

## backend/internal/service/scenario.go
- [P2][错误吞] scenario.go:89-91、100-104 — `PopulateEvalData`/`PopulateAbilityPointNames` 无返回值（store/scenario_tasks.go:137、182 内部 Query 出错直接 `return`），DB 错误时任务列表静默缺评估摘要/能力点名称。设计为容错，但错误路径无任何日志。最佳实践：store 返回 error 或内部 slog.Warn。
- [P2][契约] scenario.go:170-172 — `BatchGetByTable` 把惰性 `pgx.Row` 泄漏出 service 层，调用方必须自行 Scan；若异常路径不 Scan，连接延迟归还（handler/batch_handler.go:120-126 正常路径均会 Scan，风险仅在异常路径）。service 层暴露原始 DB 句柄违背分层契约。最佳实践：service 改为返回 `(any, error)` 或由 store 提供 Scan 闭包。
- [P3][性能] scenario.go:85-91 — 每页额外 2 条批量查询（Populate×2），非 N+1，可接受。
- [P3][并发] scenario.go:123-130 — `DeleteTask` 事务内 `CleanupTaskExamUsages` + `txStore.ScenarioTasks().Delete`（store/scenario_tasks.go:118 用 `s.q`，txStore 的 q 即 tx，确认无事务穿透）；无并发问题，正常。

## backend/internal/service/service.go
## 无问题
（WithTx 唯一事务入口委托，符合分层契约）

## backend/internal/service/subscription.go
## 无问题
（平台管理域）

## backend/internal/service/tag_service.go
## 无问题
（store 层已做事务 + 去重，见 store/tags.go:101-126）

## backend/internal/service/task_evaluation.go
- [P3][错误吞] task_evaluation.go:36-38 — `TaskName` 读取失败静默回退"未命名任务"，临时考试命名偏离（场景名-任务名预期）。小概率、仅影响名称，可容忍，建议留日志。
- [P3][边界] task_evaluation.go:39 — `newVersion := version + 1` 无上界/非负校验，客户端可传伪造大版本造成版本空洞（无覆盖风险，advisory 锁 + `currentVersion > version` 检查在锁内，复查确认乐观锁逻辑正确，无失效）。
- [P3][风格] task_evaluation.go:62 — `json.Marshal(updatedConfig)` 错误被忽略（JSONMap 序列化实际不会失败）。
- [复查确认] task_evaluation.go:41-92 — 锁内版本检查 + 事务内联动创建 usage（败者回滚时 usage 一并回滚），上次 P0/P1 修复项无回归；handler（task_evaluation_handler.go:116-120）先校验任务租户归属，无越权面。

## backend/internal/service/teaching_plan.go
- [P3][事务] teaching_plan.go:65-76 — `GenerateTeachingPlan` 的 `courses`/`posScenMap` 由调用方在事务外预取，生成期间源数据可能变化；属快照语义，可接受。
- [P3][分层] teaching_plan.go:50-52、training_program.go:70-72 — `TeachingPlanStoreRef`/`TrainingProgramStoreRef` 向 handler 暴露 store（contentActions pool 复用），既定模式，可接受。

## backend/internal/service/tenant_admin.go
- [P3][契约] tenant_admin.go:64-77 — `ResetPassword`/`SetPassword` 无 tenantID 参数，越权防护依赖 handler 预查（tenant_handler.go:506、527、657 均先 `AdminService.Get(tenant, admin)` 校验；`AdminResetPassword` 路由在 super admin 组 routes.go:273）。当前安全，仅提示签名建议加租户。

## backend/internal/service/tenant.go
## 无问题
（创建/删除走事务；`IsConflict` 辅助正确）

## backend/internal/service/term.go
- [P3][风格] term.go:20-43 — `CreateTerm`/`UpdateTerm` 单条 store 操作包 `WithTx` 冗余（store 方法本身接受 tx Queryer 单语句），`DeleteTerm` 又未包，不一致；无害。

## backend/internal/service/training_program.go
## 无问题
（PutCourses/CloneProgram 走事务，其余薄转发）

## backend/internal/service/user_extension_field.go
- [P2][数据丢失] user_extension_field.go:36 — `FilterTenantRoleCodes`（store/user_extension_fields.go:107-127）查询出错时返回空列表，`Update` 随即用空数组覆盖 `applicable_role_codes`，DB 故障时已有角色配置被静默清空。最佳实践：store 返回 ([]string, error)，出错时中止更新而非清空。

## backend/internal/service/user.go
- [P2][边界] user.go:53-75 — `BatchCreate` 去重仅限批内（`seen` map），与库中已存在用户重名/同登录名时 store `Create` 唯一约束报错 → 整批回滚，与注释"跳过缺字段与重复项"不符（库内重复不跳过）。最佳实践：捕获唯一约束错误（isUniqueViolation）跳过该条继续。
- [P3][并发竞态] user.go:148-158 — `BindRoles` 的 `ValidateRolesInTenant` 在事务外校验，角色在事务前被删时 FK 约束兜底报错，可容忍。
- [P3][并发竞态] user.go:133-144 — `BatchUpdateOrgNode` 的 `OrgNodeExists` 校验与批量更新分离（TOCTOU），节点并发被删时 UPDATE 影响 0 行静默，可容忍。

## backend/internal/service/user_relation.go
## 无问题
（创建前校验双方同租户；删除带租户参数）

## backend/internal/service/workflow.go
## 无问题
（薄转发）

## backend/internal/service/workspace_stats.go
- [P3][风格] workspace_stats.go:12-114 — 全部工作台/门户统计方法挂在 `PositionService` 下（与 recommend.go 同），域归属错位，建议独立 WorkspaceService 或归入 PortalService。
- [P3][错误吞] workspace_stats.go:12-114 — 统计方法只返回 int/结构体不返回 error，store 层吞错后返回零值（store/portal.go:69、259 等），面板统计可接受，仅提示。

## 复查确认（上次修复项，无回归）
- `SaveMethods`：advisory 锁（store/task_evaluation.go:203）+ 锁内版本检查 + 事务内联动 usage，均正确。
- 发布 hook：course_handler.go:398-400 在 `transitionWithHook` 事务内调 `GenerateCourseAssessments(txStore,...)`，内部全部走 txStore 查询器，无穿透。
- 事务穿透：`Store.WithTx` 经 `NewWithTx(tx)` 重建全部子 store（store/store.go:225-228），事务内调用 `txStore.X().Delete/Update`（如 scenario_tasks.go:118、node_quizzes.go:82、courses.go:133）均落同一 tx；tx 模式 beginner 为 nil，嵌套事务被阻断，无穿透。
- 作业提交/批改：upsert 幂等（store/course_homeworks.go:52、122），提交类并发安全。

---

## 统计

- 审查文件数：28
- 问题总数：22（P1=1，P2=6，P3=15）
- 无问题文件：log.go、portal.go、position_clone.go、position_config.go、resource_code.go、resource.go、service.go、subscription.go、tag_service.go、tenant.go、training_program.go、user_relation.go、workflow.go（13 个）

### P1 摘要
- node_evaluation_result.go:43-45：`Grade` 回写考试结果前 `FindNodeExamResult` 错误被静默吞掉（含真实 DB 错误，与正常"无考试结果"路径混同），教师评分成功但考试结果分数同步永久失败且无日志。修复：store 区分 ErrNoRows，service 对真实错误打日志。

### P2 摘要
- position.go:96-119：`SaveFull` Prepare 能力点/证书出错静默丢弃绑定（无日志）；且 Prepare 在事务外执行，事务失败留下孤儿数据。
- user_extension_field.go:36：角色编码过滤出错返回空 → Update 静默清空已有 applicable_role_codes。
- scenario.go:89-104：PopulateEvalData/PopulateAbilityPointNames 内部吞错无日志。
- scenario.go:170-172：`BatchGetByTable` 向 service/handler 层泄漏惰性 pgx.Row（异常路径连接延迟归还，分层契约破坏）。
- lesson_content.go:590-611：`ensureNodeQuestionExam` usage 复用分支不写回 `rc["usageId"]`，历史丢 usageId 数据无法修复，考试结果关联永久失效。
- user.go:53-75：`BatchCreate` 库内重复用户名导致整批回滚，与"跳过重复项"注释不符。

### P0
- 无
