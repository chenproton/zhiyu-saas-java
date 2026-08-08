# Handler 层代码复查报告（2026-08-08 复查轮）

审查范围：`/tmp/opencode/h2-ae` 列表 21 个文件，逐一完整逐行通读。
复查基准：2026-08-07 已修复 P0/P1（越权/租户隔离、部分更新兜底、回读错误改 500 等）。
冻结豁免：import/export/template 相关 handler（position_export/position_import/program_course_import）SQL 直连保持现状，仅记录其内问题不要求分层改造。

---

## backend/internal/handler/org_handler.go

- [P2][回读错误] org_handler.go:177 — `updated, _ := h.Service.Get(...)` 回读错误被忽略：Update 成功但回读失败时返回 200 + null 响应，与 2026-08-07"回读错误改 500"的修复目标不一致；最佳实践：回读失败时 respondServerError。
- [P3][风格] org_handler.go:225-231 — buildOrgTree 仅对根节点 SortOrder 排序，子节点顺序依赖 store 查询返回顺序；最佳实践：对每个节点 children 也按 SortOrder 排序，保证树形结构展示稳定。

## backend/internal/handler/org_handler_test.go

- [P3][死代码] org_handler_test.go:296 — `_ = ctx` 无效占位（TestOrg_Delete 中 ctx 仅此一处使用）；最佳实践：直接删除该变量。

## backend/internal/handler/org_type_handler.go

- [P3][契约] org_type_handler.go:62-65 — PrepareCreate 对非法 category 静默归一为 internal，而 ValidateUpdate 对非法 category 返回 400，创建/更新行为不一致；最佳实践：创建时对非法分类同样返回 400，避免用户拼写错误被静默吞掉。
- [P2][回读错误] org_type_handler.go:100 — 经 crudCreate/crudUpdate 骨架（crud.go:100/187）回读错误被 `item, _ :=` 忽略，失败时返回 200 + 零值实体（`{}`）；2026-08-07"回读错误改 500"未覆盖 crud 框架；最佳实践：骨架层检查 GetByIDFn 错误并 respondServerError。

## backend/internal/handler/period_slot_replace_test.go

无问题

## backend/internal/handler/point_levels_handler_test.go

无问题

## backend/internal/handler/portal_handler.go

- [P2][错误吞静默失败] portal_handler.go:205 — `examEvents, _ := h.Service.ListExamEvents(...)` 错误被忽略且无日志，考试事件静默缺失（同文件其他查询均 slog.Error）；最佳实践：记录错误日志。
- [P3][性能] portal_handler.go:56,84 — 非管理员分支 listAnnouncements 被计算两次（line 56 顺序执行 + line 84 goroutine 内重算，后者覆盖前者），每次工作台请求多一次冗余 DB 查询；最佳实践：仅保留一处计算。
- [P3][风格] portal_handler.go:51,124 — 角色判断混用字符串字面量 `"school"` 与 `domain.RoleTeacher/RoleSchoolAdmin` 常量；最佳实践：统一为常量或注释说明 "school" 为门户用户 role 取值。

## backend/internal/handler/portal_handlers_test.go

无问题

## backend/internal/handler/portal_learning_test.go

无问题

## backend/internal/handler/portal_workspace_test.go

无问题

## backend/internal/handler/portrait_dashboard_test.go

无问题

## backend/internal/handler/position_ability_handler.go

- [P2][租户隔离/数据完整性] position_ability_handler.go:74-81,130-139 — CreateBinding/UpdateBinding 校验了岗位租户，但 ResponsibilityID 完全未校验（不校验该职责是否属于本租户/本岗位；AbilityPointID 因 is_public 共享能力点可放行）。绑定写入后可引用他租户职责 id，本租户岗位模型/导出会渲染出他租户职责内容（跨租户引用，轻微信息泄露）；对比 position_certificate_handler.go:136-143 同时校验证书岗位与目标岗位租户，此处为遗漏；最佳实践：校验 responsibility 属于同一 position（tenant 一致），或由 store 层 JOIN 校验归属。
- [P3][校验] position_ability_handler.go:65-67 — Source 非空默认 "custom"，无枚举校验，可写入任意字符串；最佳实践：限定枚举（custom/standard）。

## backend/internal/handler/position_certificate_handler.go

- [P2][错误掩盖] position_certificate_handler.go:61-74 — checkCertTenant/GetByIDFn 将任意错误（含 DB 故障）一并返回，经 crudGet/crudUpdate/crudDelete 骨架（crud.go:122-124/155-158）统一映射为 404"证书不存在"；DB 故障被掩盖为"资源不存在"，排障困难；最佳实践：仅对 store.ErrNotFound 返回 404，其他错误上抛走 respondServerError。

## backend/internal/handler/position_clone_handler.go

- [P3][规范] position_clone_handler.go:43 — 直接 json.Decoder 而非 decodeBody，绕过 10MB 请求体限制与统一"无效请求体"文案，且用 `err.Error() != "EOF"` 字符串比较判断空 body（脆弱）；最佳实践：改用 decodeBody（空 body 语义如需保留可先 Peek）。
- [P3][校验] position_clone_handler.go:18-20 — ClonePositionRequest.Name 未校验非空，空名克隆由 service 决定行为；最佳实践：与 Create 对齐校验 Name 必填。

## backend/internal/handler/position_delete_cleanup_test.go

无问题

## backend/internal/handler/position_export_handler.go（冻结区）

- [P3][边界] position_export_handler.go:82-91,98-107 — majRows/certRows/bindRows 迭代后未检查 rows.Err()；跨租户/不存在的岗位 id 静默跳过不提示，导出文件行数与请求数可能不一致且用户无感知；最佳实践：迭代后检查 rows.Err()，跳过行计入日志。

## backend/internal/handler/position_handler.go

- [P2][回读错误] position_handler.go:488 — SaveFull 成功后 `pos, _ := h.Service.Get(...)` 回读错误被忽略，可能返回 200 + null；最佳实践：回读失败 respondServerError。
- [P3][错误忽略] position_handler.go:515,536 — FavoriteCount 错误被忽略，失败时返回 favoriteCount=0 误导前端；最佳实践：记录日志（或合并进 respondServerError 路径）。
- [P3][死代码] position_handler.go:42-51 — claims==nil（匿名）分支被路由 businessUser 门禁挡住不可达；若可达会因 PublicListConfig TenantScoped + params tenantScoped=false 触发 ErrMissingTenant 返回 500 而非 403；最佳实践：删除 publicOnly 分支或对匿名场景返回 403。

## backend/internal/handler/position_import_handler.go（冻结区）

- [P2][静默失败/无事务] position_import_handler.go:147-150,196-210 — 覆盖模式清理（4 条 DELETE）与后续 majors/certs 重建、新建模式的 batch/majors/certs 关联写入大量 `h.DB.Exec` 错误被忽略且整体无事务；中途任一写入失败（如唯一约束、连接断开）会留下"岗位行已更新但关联数据缺失/残留"的不一致状态；最佳实践：至少对关联写入检查错误并计入 result.Errors，覆盖流程建议包事务。
- [P3][查重边界] position_import_handler.go:108 — 按 tenant+name 查重未限定 status，归档（archived）岗位占用同名会阻止重新导入；最佳实践：排除 archived 或提示冲突原因。

## backend/internal/handler/position_responsibility_handler.go

- [P1][明显 bug/错误吞静默失败] position_responsibility_handler.go:91-99 — UpdateFn 透传 t.CareerPositionID 到 store，但 store 层 UPDATE（store/position_bindings.go:203-206）只写 name/description/sort_order，**不写 career_position_id**：handler 校验并转发、接口声称支持的"职责移动到另一岗位"被静默忽略（无错误、无效果、无日志），handler 与 store 契约不一致；且一旦未来 store 补写该列，handler 侧对"新岗位"无租户校验（GetByIDFn 只校验了旧岗位租户），将直接形成跨租户写。最佳实践：二选一——(a) store 层写入 career_position_id 并在 UpdateFn 校验目标岗位租户（参照 position_certificate_handler.go:140-143）；(b) 若不支持移动，从请求/校验中移除该字段并文档说明。
- [P2][错误掩盖] position_responsibility_handler.go:103-113 — GetByIDFn 将 PositionTenantID 的任意错误（含 DB 故障）映射为 store.ErrNotFound，经 crudGet（crud.go:122-124）统一 404；最佳实践：区分 ErrNotFound 与其他错误。

## backend/internal/handler/position_stats_test.go

无问题

## backend/internal/handler/position_tenant_isolation_test.go

无问题

## backend/internal/handler/program_course_import_handler.go（冻结区）

- [P2][静默失败] program_course_import_handler.go:174-175 — `strconv.ParseFloat/strconv.Atoi` 错误被忽略，非法学分/学时以 0 静默落库；最佳实践：解析失败行计入 errors 并跳过。
- [P2][数据质量] program_course_import_handler.go:182-200 — 岗位名/课程名均未命中现有记录时仍 append 并插入 Name=""、position_id/course_id 均为空的行（空壳课程行），preview 的 Created 也计入这些无效行；最佳实践：解析失败（无法解析岗位或课程）的行计入 errors 并跳过，不落空行。
