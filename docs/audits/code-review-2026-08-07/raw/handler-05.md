# handler 审查批次 5（2026-08-07）

审查文件：21 个（org / org_type / period_slot / point_levels / portal / portrait / position 系列 / program_course_import）
审查方式：逐行通读 + 对 store/service/crud 框架/router 角色组做交叉验证（只读）。
说明：position_export / position_import / program_course_import 属 AGENTS.md 豁免冻结区（不适用分层规范），但安全与逻辑问题照常记录。

---

## backend/internal/handler/org_handler.go
- [P2][错误处理] org_handler.go:177 — `updated, _ := h.Service.Get(...)` 更新成功后回读错误被忽略，Get 失败时向响应写出 null 而非实体；最佳实践：回读失败时记录原始错误并按 500 处理（`respondServerError`）。
- [P3][逻辑] org_handler.go:218-223 — buildOrgTree 中 ParentID 非空但不在 nodeMap（父节点被删/非本租户数据）的组织既非根节点也不挂载任何父节点，被静默丢弃；最佳实践：可将此类节点降级为根节点或记录日志，避免数据在树中凭空消失。
- [P3][重复代码] org_handler.go:165-168 — `ErrOrgSelfParent || ErrOrgDescendantParent` 与下一分支 `ErrOrgTypeInvalid` 分别走 400 属同一处理，可合并为单个 400 分支（无功能影响）。

## backend/internal/handler/org_handler_test.go
- 无问题。

## backend/internal/handler/org_type_handler.go
- [P3][逻辑] org_type_handler.go:62-65 — PrepareCreate 对非法 category 静默归一为 internal（容忍 hacker 行为，与项目约定一致，仅记录）；如期望前端错误提示可改为 400。

## backend/internal/handler/period_slot_replace_test.go
- 无问题。

## backend/internal/handler/point_levels_handler_test.go
- 无问题。

## backend/internal/handler/portal_handler.go
- [P2][错误被吞] portal_handler.go:107,149,173,195,244,258,282,304,327,354,381 — 全部列表/统计服务调用均以 `rows, _ :=` / `_, _ :=` 吞掉错误；DB 故障或查询失败时工作台接口静默返回 200 + 空数据，前端无从区分"无数据"与"后端故障"；最佳实践：至少记录 slog.Error（工作台非核心接口可不阻断返回，但需留日志）。
- [P3][性能] portal_handler.go:55-56 与 83-85 — 非 admin 分支先同步调用 listAnnouncements/listTodos/listSchedule 各一次，随后 goroutine 中又各调用一次，重复查询；最佳实践：admin 分支用 5 个 goroutine、其余分支用 4 个 goroutine 的写法下，行 55-56 的同步预取可直接删除（直接由 goroutine 填充）。
- [P3][死代码] portal_handler.go:76 — schoolAdmin 分支先经行 56 计算 Schedule，随后又置空 `dash.Schedule = []domain.WorkspaceScheduleEvent{}`，前面的计算为无用功；最佳实践：admin 分支初始字段直接给空切片。

## backend/internal/handler/portal_handlers_test.go
- 无问题。

## backend/internal/handler/portal_learning_test.go
- [P3][测试] portal_learning_test.go:59-74,156 — 测试插入的 courses 未带 tenant_id（`INSERT INTO courses (id, code, name, type, category, status, creator_id)`），而清理语句 `DELETE FROM courses WHERE tenant_id = $1`（行 156）按 tenant_id 过滤，无法删除这些行；若测试库非每次全新则残留脏数据；最佳实践：插入时显式带 tenant_id 或清理按 id 删除。

## backend/internal/handler/portal_workspace_test.go
- 无问题。

## backend/internal/handler/portrait_dashboard_test.go
- 无问题。

## backend/internal/handler/position_ability_handler.go
- [P1][越权] position_ability_handler.go:68-83 — CreateBinding 仅 `requireTenant(w, r)`，未校验请求中 CareerPositionID/ResponsibilityID/AbilityPointID 的租户归属；store `PositionAbilityStore.Create`（store/position_bindings.go:40-53）直接以 claims 租户插入任意引用 id，可把能力绑定写入他人租户岗位名下（同时 UpdateBinding 103-108、DeleteBinding 161-166 均经 PositionTenantID 校验，创建路径明显漏校验）；最佳实践：创建前调用 `h.Service.PositionTenantID(ctx, req.CareerPositionID)` 并用 `verifyTenantOwnership` 校验（对齐 Update/Delete 与 position_responsibility_handler.go:61-71 的 CreateTenantFn 模式）。

## backend/internal/handler/position_certificate_handler.go
- [P1][越权] position_certificate_handler.go:41-46 — List 直接 `h.Service.ListCertificates(ctx, careerPositionId, limit, offset)`，整条链路（service/position_config.go:77-79 → store/position_certificates.go:23-66）只有 careerPositionId 过滤、无任何租户条件，handler 也未传租户；且该路由挂在 jobViewer 角色组（router/routes.go:229，含学生），任意登录用户可枚举任意租户岗位的证书（名称/URL/描述/证书库信息）；最佳实践：List 前先经 PositionTenantID 校验 careerPositionId 归属，或 store.List 增加 tenant_id 过滤参数。
- [P1][越权] position_certificate_handler.go:79-86 — CreateTenantFn 直接采用 claims.TenantID，不校验请求体 CareerPositionID 的租户归属（对比 position_responsibility_handler.go:61-71 创建前校验岗位归属）；store Create（store/position_certificates.go:81-94）以调用方租户插入任意 career_position_id，可把证书挂到他人租户岗位下；且 claims.TenantID 为 nil 时返回空租户落库；最佳实践：创建前 `PositionTenantID(ctx, t.CareerPositionID)` + `verifyTenantOwnership`，不满足返回 403。
- [P1][越权] position_certificate_handler.go:109-122 — UpdateFn 的 checkCertTenant 只校验"原证书"所属岗位的租户（store/position_certificates.go:111-114 会更新 career_position_id），请求体可把证书改绑到他人租户岗位，新 CareerPositionID 无租户校验 → 跨租户移动数据；最佳实践：对请求中的新 CareerPositionID 同样执行 PositionTenantID + verifyTenantOwnership（对齐 position_ability_handler.go:120-129 的改绑校验）。

## backend/internal/handler/position_clone_handler.go
- [P3][风格] position_clone_handler.go:43 — `err.Error() != "EOF"` 用错误字符串比较判断空请求体，脆弱（本地化/包装错误即失效）；最佳实践：`!errors.Is(err, io.EOF)`。

## backend/internal/handler/position_delete_cleanup_test.go
- 无问题。

## backend/internal/handler/position_export_handler.go（冻结区）
- [P2][性能] position_export_handler.go:55-204 — 每个岗位 4-6 条串行 SQL（基础行 60-64、行业 72、专业 78、证书 94、批次 111、绑定 165），导出 N 个岗位即 N+ 次往返；冻结区豁免分层规范，仅提示：可批量 IN 查询优化。
- [P2][逻辑] position_export_handler.go:165-172 — 绑定查询对 ability_points 用内连接，ability_point_id 为空的绑定（save-full 创建的公共能力绑定）整行被静默跳过（仅日志 Warn），导出缺行无任何提示；最佳实践：改 LEFT JOIN 并容忍空能力名。
- [P3][逻辑] position_export_handler.go:158-163 — 岗位已被删除/非本租户时 positionName 为空串仍写一行空数据到"工作职责与能力点"表，用户无从知晓；最佳实践：跳过并计数。

## backend/internal/handler/position_handler.go
- [P2][缓存] position_handler.go:181-281 — Update 更新岗位后未失效公开列表缓存（对比 Delete:302、SaveFull:489、ToggleFavorite:529、contentActions invalidate 均清理），已发布岗位被编辑后前台公开列表在缓存 TTL 内展示旧数据；最佳实践：Update 成功后调用 `h.clearPublicPositionsCache(r)`。
- [P2][错误处理] position_handler.go:488 — SaveFull 回读 `pos, _ := h.Service.Get(...)` 错误被忽略，回读失败响应 null；最佳实践：与 org_handler.go:177 同，回读失败走 respondServerError。
- [P3][契约] position_handler.go:208-254 — Update 合并逻辑对 shortName/salaryMin/salaryMax/description/careerPath/coverImage 等字段"空值回退现有值"，一旦设置无法通过接口清空；如前端需要"清空简介/薪资"等操作会失败；最佳实践：确认前端无清空诉求后保持现状或改用指针字段区分。
- [P3][错误处理] position_handler.go:51-61 — 匿名请求（claims==nil 走 PublicListConfig，TenantScoped=true）且未带 tenantId 时，listParamsFromRequest(r, false) 放行但 ExecuteListQuery 返回 ErrMissingTenant → respondServerError 500；最佳实践：该分支对缺租户返回 403（对齐 PublicList 行为）。

## backend/internal/handler/position_import_handler.go（冻结区）
- [P3][错误处理] position_import_handler.go:147-150 — overwrite 模式删除原有关联（majors/certs/responsibilities/bindings）时 4 处 Exec 错误全部忽略，删除失败会残留孤儿关联（后续 ON CONFLICT DO NOTHING 无法清理）；最佳实践：删除失败时计入 Failed/Errors。

## backend/internal/handler/position_responsibility_handler.go
- 无问题（CreateTenantFn 61-71 创建前校验岗位租户；GetByIDFn 103-114 间接租户校验覆盖 Get/Update/Delete；store Update 不可改 career_position_id，无改绑越权面）。

## backend/internal/handler/position_stats_test.go
- 无问题。

## backend/internal/handler/position_tenant_isolation_test.go
- 无问题。

## backend/internal/handler/program_course_import_handler.go（冻结区）
- [P2][逻辑] program_course_import_handler.go:182-200 — 岗位名未匹配（QueryRow 失败）且课程名也未匹配时，该行仍被 append 进 courses（c.Name 为空串、PositionID/CourseID 均为 nil），导入时以空名称写入 training_program_courses，静默产生脏数据且用户无感知；最佳实践：位置/课程都未匹配的行记入 errors 并跳过。
- [P3][逻辑] program_course_import_handler.go:104 — `semester` 硬编码为 1，模板/表头无学期列；若存在多学期方案课程导入诉求会错；最佳实践：确认需求后由表头列提供。
