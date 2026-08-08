# handler 层复查 07（2026-08-08）— scenario_* / schedule_* / settings / staff_title / stats / student_* / subscription / tag

范围：`/tmp/opencode/h2-ag` 所列 20 个文件，逐一完整逐行通读；关键路径交叉核验了
`router/routes.go`、`router/routes_evaluation.go`、`handler/crud.go`、`handler/common.go`、
`cache/middleware.go`、`store/scheduling.go`、`store/scenario_configs.go`、`store/scenario_tasks.go`、
`store/tags.go`、`service/affairs.go`、`service/tag_service.go`。

已确认修复项回归（无问题）：admin 路由（`routes.go:263-282`）统一挂 `platformAdmin` +
`OperationLog`（oplog 无双写）；`crudUpdate/crudDelete` 归属校验先于 UpdateFn/DeleteFn 且
AfterLoad 失败已改 500；`cache.InvalidatePrefix` 对 nil client 安全（测试可直接构造 handler）；
测评方式权重等分写入已落地。

---

## backend/internal/handler/scenario_import_eval_weight_test.go
- [P3][测试] scenario_import_eval_weight_test.go:29 — 仅导入前 DELETE，导入成功后场景/任务/测评方式无 defer 清理（依赖 testhelper 环境隔离）；最佳实践：追加 defer 清理场景与 task_evaluation_methods。

## backend/internal/handler/scenario_import_handler.go
- [P2][数据一致性] scenario_import_handler.go:163-164 — overwrite 模式下清空旧任务/测评方式的两个 `h.DB.Exec` 错误被完全忽略且未纳入事务；删除失败时旧任务与按新文件重建的任务并存、测评方式残留（导入接口无事务包裹，部分失败容忍，但此处错误吞掉后场景状态与文件内容不一致）。最佳实践：UPDATE+DELETE+INSERT 包进一个事务，DELETE 错误计入 result.Failed/Errors。
- [P2][边界] scenario_import_handler.go:272 — `weight := 100.0 / float64(len(validMethods))`：当列出的测评方式全部无法映射（如错别字）时 validMethods 为空 → Go 浮点除法得 +Inf，Postgres float8 可存储 Infinity，权重静默写入 +Inf 导致后续均分/综合分计算破坏。最佳实践：`len(validMethods) == 0` 时跳过写入（或记 Failed）。
- [P3][死代码] scenario_import_handler.go:297-306 — `generateScenarioCode` 全仓无调用（实际使用 `generateEntityCode("CJ")`）；最佳实践：删除或改由它生成 SC-YYYY-NNNN 序号并替换。

## backend/internal/handler/scenario_import_resource_type_test.go
- 无问题（种子资源计数断言、后缀推断映射、同名不重复创建均有效）。

## backend/internal/handler/scenario_task_handler.go
- [P2][契约] scenario_task_handler.go:157-165 — Update 为全量替换语义：请求缺 `scenarioId`（前端局部保存常见）时 `ScenarioTenantID("")` 查询失败 → 404「场景不存在」；即便传了，store `ScenarioTaskStore.Update`（store/scenario_tasks.go）全列覆盖。部分更新丢字段/直接 404，属隐式契约。最佳实践：与前端确认契约（必填校验返回 400，或 store 对空字段 COALESCE 保留）。
- [P3][边界] scenario_task_handler.go:123 — 全局场景（tenant_id 为 NULL）下 Create 传 `TenantID: scenarioTenantID`（nil）→ 任务 tenant_id 为 NULL，List 为 TenantScoped 时对任何租户都不可见（僵尸数据）。最佳实践：全局场景创建任务时显式归属平台或拒绝。

## backend/internal/handler/scenario_weight_handler.go
- [P2][校验缺失] scenario_weight_handler.go:90-95 — `req.TaskID` 未校验归属及与 `req.ScenarioID` 一致性：可用本租户场景 + 他租户/任意 taskId 创建权重行（行存自己租户、外键悬空），Upsert（store/scenario_configs.go）无 task 存在性检查。最佳实践：按 task 所在场景校验 `task.scenario_id == req.ScenarioID` 且租户一致。
- [P3][契约] scenario_weight_handler.go:53-56 — weight 无范围校验（负值/超 100 直接入库）；最佳实践：限制 0-100。

## backend/internal/handler/scene_handler_test.go
- 无问题（CRUD/状态机/校验/克隆/部分更新清空字段等覆盖充分）。

## backend/internal/handler/scene_task_ability_names_test.go
- 无问题。

## backend/internal/handler/schedule_import_handler.go
- [P2][数据丢失] schedule_import_handler.go:263-276 — 课程列表路径无视 `overwrite` 参数始终 `DELETE` 该学期全部排课（含已发布 published）后重建为 draft；且 242-252 学期仅由**第一行**课程推断，文件混学期/首行课程错误时会把 DELETE 作用到错误学期（误删整学期已发布排课）。模板说明虽注明"清空重排"，但 overwrite=false 时也应跳过或提示。最佳实践：逐行校验 term 归属；对含已发布排课的学期要求显式 overwrite。
- [P3][静默] schedule_import_handler.go:360 — 计划条目状态同步 `_, _ = tx.Exec(...)` 错误忽略，失败时出现"有条目已排但教学计划仍 planned"的不一致；最佳实践：检查错误并入 result.Errors。

## backend/internal/handler/scheduling_handler.go
- [P1][越权/租户隔离缺失] scheduling_handler.go:416-424、448-451 — CreateSchedule/UpdateSchedule 接受任意 `planEntryId`，`FallbackClassID`/`PlanEntryCourseID`（store/scheduling.go:491-518）查询**均无 tenant 条件**，handler 也未校验该 plan entry 属于当前租户/当前 term。危害链：① 排课列表 join（store/scheduling.go:806 无租户条件）会把外租户组织节点名渲染进本租户列表（他租户班级名泄露）；② `DeleteScheduleWithRestore`（store/scheduling.go:505-512）按 plan_entry_id **无租户条件** `UPDATE teaching_plan_entries SET status='planned'`——攻击者先创建引用外租户 plan entry 的排课，再删除该排课即可改写他租户计划条目状态（跨租户写/数据损坏）。最佳实践：handler 用 tenantID+termID 校验 planEntryId 归属（service 内校验），或 store 查询补 tenant 条件。
- [P2][静默] scheduling_handler.go:748-751、790-793、811-813、833-835、855-857 — ExportSchedules 各辅助查询（已排映射/教师/场地/班级/节次）失败仅 `slog.Warn` 后继续，导出文件静默缺数据仍返回 200；最佳实践：参考表失败可警告，主表（课程列表）失败应 500。
- [P3][契约] scheduling_handler.go:903-906 — Timetable `status` 查询参数未校验取值，任意字符串直接入 SQL（无注入，但语义不明）；最佳实践：限制 published/draft 白名单。

## backend/internal/handler/settings_handler.go
- 无问题（admin 路由已由 router 的 platformAdmin + OperationLog 保护，routes.go:278-282；GetTheme 公开含租户回退逻辑正确）。

## backend/internal/handler/settings_handler_test.go
- 无问题。

## backend/internal/handler/staff_title_handler.go
- [P2][静默] staff_title_handler.go:190-192 — ToggleStatus 更新后回读 `title, _ = h.Store.GetByID(...)`、`count, _ := h.Store.CountUserRefs(...)` 错误全部忽略：回读失败时 200 响应携带零值/旧数据（与上轮"回读错误改 500"修复不一致）。最佳实践：回读失败统一 `respondServerError`。
- [P2][静默] staff_title_handler.go:147（经 handler/crud.go:100）— crudCreate 创建后回读错误被 `item, _ :=` 忽略，失败时返回 201 + 零值实体；crudUpdate/crudGet 已改为 500，Create 路径未同步。最佳实践：创建回读失败返回 500。
- [P3][静默] staff_title_handler.go:50 — `counts, _ := h.Store.BatchCountUsersByTitle(...)` 错误忽略，UserCount 静默为 0。
- [P3][静默] staff_title_handler.go:124 — AfterLoad 中 `CountUserRefs` 错误忽略；最佳实践：透传 err 由 crud 层统一 500。

## backend/internal/handler/staff_title_handler_test.go
- 无问题（覆盖创建/列表/详情/更新保留状态/切换/删除）。

## backend/internal/handler/stats_handler.go
- [P3][占位] stats_handler.go:9-14 — MyStats 硬编码全 0 桩，前端按真实余额展示会被误导；最佳实践：未接入计费前返回明确占位标记或 501。

## backend/internal/handler/student_honor_handler.go
- 无问题（学生强制本人，业务用户 tenant 内只读；service 层 UserID+TenantID 双重约束）。

## backend/internal/handler/student_honor_test.go
- 无问题。

## backend/internal/handler/student_portrait_handler.go
- [P2][校验缺失] student_portrait_handler.go:253-290 — CreateArchive 未像 Generate（200-209 行）那样校验 `userId` 属于当前租户/存在性，业务用户可为本租户创建指向他租户用户的档案行（本租户内数据污染、列表渲染异常）；最佳实践：复用 Generate 的用户归属校验。
- 说明：ListArchives/CreateArchive/DeleteArchive 路由在 businessUser 组（routes_evaluation.go:88-90，不含学生），学生不可达，无越权问题；List/Get/StudentDashboard 虽对学生开放，但 handler 内均强制本人（143-145、170-173、66-68），校验到位。

## backend/internal/handler/subscription_handler.go
- [P3][并发] subscription_handler.go:115-126 — AdminUpdate 先 GetSubscriptionByTenant 再 Create，非原子，并发/重试可产生重复订阅行；最佳实践：单条 upsert SQL 或唯一约束（低危，仅平台管理员可达）。

## backend/internal/handler/tag_filter_regression_test.go
- 无问题（回归场景 1/2 断言有效，与 AddTagFilter 全限定列修复一致）。

## backend/internal/handler/tag_handler.go
- [P3][校验缺失] tag_handler.go:162-184 — SetResourceTags 不校验资源存在/属于租户、tagIds 属于租户（store/tags.go:101-129 仅按调用方 tenant 写本租户关系行），可产生悬挂绑定关系（本租户内数据污染，无跨租户读写）；最佳实践：store 内校验资源与标签租户归属。

---

## 汇总

- 审查文件数：20
- 问题总数：21（P1 × 1，P2 × 8，P3 × 12）

### P1（1）
- scheduling_handler.go:416-451 — `planEntryId` 跨租户引用无归属校验：外租户计划条目可被引用（排课列表 join 渲染外租户班级名），且 `DeleteScheduleWithRestore` 无租户条件按 plan_entry_id 改写外租户计划条目状态（跨租户写）。

### P2（8）
- scenario_import_handler.go:163-164 — overwrite 清空旧任务 DELETE 错误吞掉、无事务。
- scenario_import_handler.go:272 — 等分权重 `100.0/0 = +Inf` 写入库。
- scenario_task_handler.go:157-165 — Update 全量替换契约，缺 scenarioId → 404/丢字段。
- scenario_weight_handler.go:90-95 — taskId 未校验归属/与 scenarioId 一致性。
- schedule_import_handler.go:242-276 — 课程列表路径无视 overwrite 无条件清空整学期（含已发布）+ 学期仅按首行推断，可能误删。
- scheduling_handler.go:748-857 — 导出辅助查询失败仅 Warn，静默缺数据仍 200。
- staff_title_handler.go:190-192 — ToggleStatus 回读错误吞掉，200 响应零值实体。
- staff_title_handler.go:147（crud.go:100）+ student_portrait_handler.go:253-290 — 创建路径回读错误忽略 / CreateArchive 缺用户租户校验。

### 上轮修复回归结论
- tenant_handler admin 路由 oplog：经 routes.go:263-282 核验仅挂一次 `OperationLog`，无双写。
- 回读错误改 500：crudGet/crudUpdate 已到位；**crudCreate（staff_title 走此路径）与 ToggleStatus 仍吞错误**（见上）。
- 测评权重等分、资源类型推断、staff_title 测试、admin 审计、租户归属校验骨架：均已落地且测试覆盖，无回归。
