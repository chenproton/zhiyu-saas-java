# handler-07 代码审查报告（2026-08-07）

范围：backend/internal/handler 下 20 个文件（scenario_import / scenario_task / scenario_weight / scene / schedule_import / scheduling / settings / staff_title / stats / student_honor / student_portrait / subscription / tag 相关）。

---

## backend/internal/handler/scenario_import_eval_weight_test.go
- [P3][测试] scenario_import_eval_weight_test.go:45 — 场景名使用随机 uuid 后缀，但任务名"权重任务一"固定；同一测试数据库重跑时旧任务不会被清理，若场景已存在则默认跳过导入，可能出现干扰。低风险，仅提示。

（其余逻辑：nil RedisClient 由 cache.InvalidatePrefix 的 nil 判断兜底，无 panic；权重 25 断言正确。）

无其他问题。

## backend/internal/handler/scenario_import_handler.go
- [P2][逻辑] scenario_import_handler.go:272 — `weight := 100.0 / float64(len(validMethods))`：当"测评方式"列存在但全部映射失败（如填了未知方式名）时 `len(validMethods)==0`，除零得到 +Inf 而非报错，随后 `INSERT ... weight=+Inf` 成功写入 Infinity，导致评分计算出现 NaN/Inf。最佳实践：`len(validMethods)==0` 时跳过写入或记录错误，而不是除零。
- [P2][事务/错误吞] scenario_import_handler.go:150-166 — 覆盖（overwrite）路径：UPDATE + 两条 DELETE（163-164 删除旧任务与旧测评方式）不在同一事务内，且两条 DELETE 的 `h.DB.Exec` 错误被完全忽略。若删除失败（如 FK 约束、DB 抖动），旧任务残留与新任务重复插入、旧测评方式残留，用户无感知。最佳实践：用事务包裹覆盖操作，检查 DELETE 错误并计入 result.Errors。
- [P3][死代码] scenario_import_handler.go:297-306 — `generateScenarioCode` 定义后从未被调用（导入使用 `generateEntityCode("CJ")`），删除。
- [P3][一致性] scenario_import_handler.go:73-75 — 缓存失效仅当 `aggregated.Created > 0`；纯覆盖（overwrite）且新文件无任务时 Created 为 0，场景列表缓存不失效，用户导入后仍可能看到旧数据。
- [P3][边界] scenario_import_handler.go:125 — 同名场景查询 `LIMIT 1` 无 ORDER BY，存在同名重复数据时命中行不确定。

## backend/internal/handler/scenario_import_resource_type_test.go
- [P3][测试] scenario_import_resource_type_test.go:45 — 场景名"设备检修场景"固定（任务名"检修任务一"也固定）：测试库被复用时场景已存在 → 默认跳过导入 → 断言资源不创建 → 用例失败；依赖每次全新数据库。最佳实践：名称加随机后缀（同文件 eval_weight 测试的做法）。

## backend/internal/handler/scenario_task_handler.go
- [P2][越权] scenario_task_handler.go:74, 95-102, 104-124 — Get 中 `task.TenantID != nil` 才做租户校验；Create 中 `scenarioTenantID != nil` 才校验并透传。一旦出现 TenantID 为 nil 的记录（旧数据/异常写入），该任务对任意租户可读可改，且新建任务可以无租户落库。最佳实践：TenantID 为 nil 一律视为越权（403），Create 强制要求场景属于当前租户。
- [P2][契约] scenario_task_handler.go:90 — 必填校验强制 `Code` 非空，而前端创建任务通常不感知内部编码规则；与导入流程自动生成 code 的机制不一致，存在前端契约差异风险（若前端不传 code 则必 400）。最佳实践：与服务端生成 code 的策略对齐（服务端兜底生成）。

## backend/internal/handler/scenario_weight_handler.go
- [P3][校验] scenario_weight_handler.go:53-56, 90-95 — 创建新权重时仅校验 ScenarioID 归属租户，未校验 TaskID 是否属于该场景/租户（更新路径校验了旧的权重记录，但创建路径无任务侧校验）；任务跨场景/跨租户绑定是否被拒取决于 service 层。最佳实践：handler 层校验任务归属或确认 service 层已有等价校验。

## backend/internal/handler/scene_handler_test.go
无问题。

## backend/internal/handler/scene_task_ability_names_test.go
无问题。

## backend/internal/handler/schedule_import_handler.go
- [P0][必错] schedule_import_handler.go:619-626 — 旧格式"排课导入"路径的 INSERT：目标列 20 个（id…version，**无 class_node_ids 列**），VALUES 却提供 21 个表达式（含 `ARRAY[$9::uuid]`），PostgreSQL 必报 `INSERT has more expressions than target columns`，每一行导入必然失败（HTTP 200 但 failed 计数全量递增），旧格式排课导入功能完全不可用。最佳实践：补齐 `class_node_ids` 列（与 importFromCourseList 路径一致）或删除 `ARRAY[$9::uuid]` 表达式。
- [P2][逻辑/数据丢失] schedule_import_handler.go:242-247 — 学期解析：取"第一门课程的任一条教学计划条目"的 term_id，未限定学期/计划，同名课程跨学期存在时可能清空并重建**错误学期**的整学期排课（263 行 DELETE 按 tenant+term 全删）。最佳实践：按文件名/参数显式指定学期，或按全部课程交叉验证学期一致性后再清空。
- [P2][逻辑] schedule_import_handler.go:281-287 — 课程列表内匹配教学计划条目仅按 `course_name + term`（LIMIT 1 无班级/类型条件）：同一课程多个班级条目时随机命中一条，schedule_entries.class_node_id 可能与该条目的班级不一致（导入后课表班级错位）。最佳实践：按 课程名+班级 匹配条目。
- [P2][边界] schedule_import_handler.go:193-194, 214-232 — importFromCourseList 路径不校验 起始周/结束周（`strconv.Atoi` 失败即为 0，weekPattern 非法值静默归为 all，weekPattern 非 all/odd/even 也直接入库），脏数据（0 周排课）直接落库；而 processRows 路径（parseScheduleRow）有完整校验。最佳实践：两路径校验对齐。
- [P3][错误吞] schedule_import_handler.go:360 — `_, _ = tx.Exec(UPDATE teaching_plan_entries SET status='scheduled')` 错误被忽略，事务仍提交，计划条目状态与实际排课不一致。
- [P3][一致性] schedule_import_handler.go:319 vs 484 — 教师匹配字段不一致：课程列表路径只查 `name OR username`，逐行路径查 `name OR username OR login_name`，同账号用 login_name 填写时课程列表路径必失败。

## backend/internal/handler/scheduling_handler.go
- [P2][错误吞] scheduling_handler.go:491-492, 574-575 — `entry, _ := h.fetchScheduleEntry(...)` 错误被忽略：创建/更新成功后若回读失败（极小概率），响应 201/200 但 body 为 null，前端拿不到数据。最佳实践：回读失败时记录错误并返回通用 500（respondServerError）。
- [P2][错误吞] scheduling_handler.go:739, 778, 795, 814, 833 — ExportSchedules 中 `ListScheduledExportMap / ListTeacherNames / ListVenueBriefs / ListClassNames / ListPeriodSlots` 的返回错误全部忽略，导出文件静默缺失教师/场地/班级名单等数据。最佳实践：错误时至少记日志或中断导出。
- [P3][风格] scheduling_handler.go:617, 661 — AutoSchedule / PublishSchedules 直接 `json.NewDecoder(r.Body)` 而非 decodeBody，缺少 10MB 请求体上限（低危）。

## backend/internal/handler/settings_handler.go
- [P3][鉴权] settings_handler.go:58-112 — UpdateTheme / UpdateTenantTheme / DeleteTenantTheme 方法体内无任何权限校验，完全依赖路由中间件；一旦路由配置遗漏，任意用户可改平台/租户主题。与本文件 GetTheme 的公开性形成对照，建议方法内显式校验平台管理员。

## backend/internal/handler/settings_handler_test.go
- [P3][测试] settings_handler_test.go:62-133 — TestSettings_TenantThemeOverride 依赖 TestSettings_ThemeAdminUpdate 先执行（注释明示"当前为 #1677ff，见上一个用例"），测试之间存在共享状态耦合；单独运行或用例乱序时断言 404/失败。最佳实践：用例内自建前置（先 PUT 再断言）。

## backend/internal/handler/staff_title_handler.go
- [P2][错误吞] staff_title_handler.go:190-192 — ToggleStatus 更新后二次 `GetByID` 错误被忽略：若记录被并发删除，返回零值 title（空 ID、空 TenantID）且 200，`CountUserRefs` 用空租户查询后 UserCount 为 0，前端展示空对象。最佳实践：二次读取失败时返回 404/500。
- [P3][错误吞] staff_title_handler.go:50 — `counts, _ := h.Store.BatchCountUsersByTitle(...)` 错误被忽略，列表 UserCount 静默全 0。最佳实践：失败时记日志。

## backend/internal/handler/staff_title_handler_test.go
- [P1][必失败] staff_title_handler_test.go:85-90 — 测试发送 `"status": "disabled"` 并断言 200，而 ToggleStatus 校验（staff_title_handler.go:180-183）仅接受 `active/inactive`，必返回 400 → 该用例运行必然 t.Fatalf 失败，CI 必红。最佳实践：改为 `"inactive"`（或确认 handler 是否应兼容 disabled 枚举后二选一）。

## backend/internal/handler/stats_handler.go
- [P3][占位] stats_handler.go:9-15 — MyStats 硬编码返回 balance/totalIncome/totalSpent 全 0，无鉴权、无数据来源；若前端已接入该接口则展示失真，若未接入则为死代码。最佳实践：确认前端依赖后实现或移除路由。

## backend/internal/handler/student_honor_handler.go
无问题（学生强制本人、业务用户租户内查询、写操作仅学生本人，职责与 service 层校验配合完整）。

## backend/internal/handler/student_honor_test.go
无问题。

## backend/internal/handler/student_portrait_handler.go
- [P2][越权] student_portrait_handler.go:232-251 — ListArchives 对学生角色无自限定（对比 143-145 行 List 画像接口强制 `params.Values["userId"] = claims.UserID`）：学生可列出本租户全部学生的档案材料（隐私数据）。最佳实践：与 List 对齐，学生仅返回本人档案。
- [P2][越权] student_portrait_handler.go:253-313 — CreateArchive / DeleteArchive 仅校验已登录+租户，无角色/本人校验：学生可任意指定 `userId` 创建/删除其他学生档案（业务侧无限制，DeleteArchive 无 user_id 条件）。最佳实践：业务角色可管理，学生仅限本人（UserID 强制 = claims.UserID）。
- [P3][一致性] student_portrait_handler.go:212-213 — 聚合使用 `context.Background()` + 30min 超时而非请求上下文，客户端断开后任务继续执行（占用资源）；可接受但应说明理由。
- [P3][校验] student_portrait_handler.go:214 — Generate 仅校验了 userId 属于当前租户，`careerPositionID` 未校验是否属于当前租户；若 service 层未做租户校验，可对其他租户岗位做聚合（数据污染）。最佳实践：确认 service 层有租户过滤。

## backend/internal/handler/subscription_handler.go
- [P2][错误吞] subscription_handler.go:115-126 — AdminUpdate：`GetSubscriptionByTenant` 返回**非 NotFound 错误**（如 DB 故障）时被当作"未订阅"落入 CreateSubscription 分支，掩盖真实故障，且若并发/数据重复可能触发唯一约束冲突 500。最佳实践：区分 `store.ErrNotFound` 与其它错误，其它错误走 respondServerError。
- [P3][鉴权] subscription_handler.go:72-136 — AdminGet / AdminUpdate 方法体内无权限校验（Update 有 canManagePlatform），依赖路由中间件；路由遗漏即越权。最佳实践：方法内显式校验平台管理员。

## backend/internal/handler/tag_filter_regression_test.go
无问题。

## backend/internal/handler/tag_handler.go
- [P3][语义] tag_handler.go:104-158 — Update / Delete 未区分"标签不存在"与系统错误，不存在的标签返回 500 而非 404，前端错误提示不准确。最佳实践：service 返回 not-found 时映射 404。

---

## 汇总

- 审查文件数：20
- 总问题数：26（P0: 1，P1: 1，P2: 11，P3: 13）

### P0
1. schedule_import_handler.go:619-626 — 旧格式排课导入 INSERT 列数(20)与值数(21)不匹配，必报 SQL 错误，旧格式导入功能整体不可用。

### P1
1. staff_title_handler_test.go:85-90 — 测试发送 status="disabled"（handler 仅接受 active/inactive），断言 200 实际 400，用例必失败。
