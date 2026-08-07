# Code Review — handler-06（question/random_draw/recommend/resource/role/scenario handler 组）

审查日期：2026-08-07。文件清单来自 /tmp/opencode/handler-ac-ab，共 20 个文件全部完整逐行通读。
交叉验证：common.go、crud.go、content_actions.go、router/routes.go、middleware/rbac.go、store/questions.go、store/question_banks.go、store/scenario_configs.go、store/scenario_tasks.go、service/scenario_config.go。
结论：无 P0（运行时必错/panic/nil 解引用）问题；1 个 P1；P2 若干；P3 若干。
注：question_bank_export/import、question_export/import、resource_export/import、scenario_export 均属 AGENTS.md 豁免冻结区（import/export handler），其直接持有 *pgxpool.Pool 与拼 SQL 不按分层规范扣分，仅审查安全/逻辑/质量问题。

## backend/internal/handler/question_bank_export_handler.go
- [P1][数据丢失] question_bank_export_handler.go:39-42 — `fillBanksData` 恒返回 nil（函数内所有错误都被 slog.Warn+continue 吞掉），调用处 `if err != nil { 500 }` 是死分支，导出数据缺失时用户收到"成功"文件；最佳实践：函数改为返回失败行数或由调用方在 fill 后校验实际导出行数并提示。
- [P3][越权] question_bank_export_handler.go:71 — `SELECT name FROM evaluation_batches WHERE id=$1` 无 tenant 过滤。batchID 来源于租户限定的题库行（line 62 已限定），实际风险低；最佳实践：统一加 `AND tenant_id=$2`。
- [P3][错误处理] question_bank_export_handler.go:64-67 — 单行查询失败静默跳过，导出文件行数与请求 ids 不一致且无汇总提示；最佳实践：汇总失败数并在响应中提示。

## backend/internal/handler/question_bank_handler.go
- [P1][数据丢失] question_bank_handler.go:186 — Update 中 `KnowledgePointIDs: req.KnowledgePointIds` 是唯一未做 nil→existing 默认化的字段（name/description/coverImage/collaboratorIDs/collaboratorDeptIDs/batchID 均按 line 155-176 的模式回退），而 store 的 Update（store/question_banks.go:134-136）会先 `DELETE FROM question_bank_knowledge_points` 再按入参重建；前端请求省略 `knowledgePointIds` 字段即清空题库全部知识点绑定；最佳实践：`if req.KnowledgePointIds == nil { req.KnowledgePointIds = existing.KnowledgePointIDs }`。
- [P2][逻辑] question_bank_handler.go:280-290 — `isDraftPool` 查询出错时（line 283-285）静默返回 false，Submit/Publish 继续执行状态流转，错误被吞导致约束检查失效；且 `Service.IsDraftPool`（line 282）按 id 无租户限定查询（可探测他租户题库是否草稿池，随后 transition 有 checkTenantAccess 兜底）；最佳实践：出错时响应 500 并终止。
- [P3][重复] question_bank_handler.go:35 — `tenantClaims := middleware.CurrentUser(r)` 与 line 29 重复调用，直接复用 claims 即可。
- [P3][边界] question_bank_handler.go:41-43 — EnsureDraftPool 失败仅记日志继续列表；容忍可接受，但建议记录更多上下文。
- [P3][契约] question_bank_handler.go:158-161 — `Description == nil || *req.Description == ""` 时回退 existing，空串无法清空描述，与 Create 侧 `emptyStrToNil`（空串→NULL）语义不一致；最佳实践：仅 nil 回退，空串走 emptyStrToNil 清空。
- [P3][校验] question_bank_handler.go:106-116,178-187 — KnowledgePointIds 未校验 id 属于本租户/存在（绑定表仅写 tenant_id=当前租户，kp id 可任意），可能关联到不存在的知识点；最佳实践：创建/更新前批量校验。

## backend/internal/handler/question_bank_import_handler.go
- [P3][逻辑] question_bank_import_handler.go:137 — `collaborator_ids` 为 NULL 时 pgx 扫描 []string 会报错，`found` 被误判为 false，导致 preview 计数不准、execute 走 INSERT 撞唯一约束计为 Failed 而非 Skipped；最佳实践：COALESCE(collaborator_ids,'[]') 或扫描为 nullable 类型。
- [P3][并发] question_bank_import_handler.go:190,248 — `generateEntityCode("TK"/"TM")` 无库内唯一性重试，撞 code 唯一约束时整行失败；概率低可容忍，最佳实践：失败后重试一次。
- [P3][逻辑] question_bank_import_handler.go:162-164 — overwrite UPDATE 无 tenant 条件，但 existingID 来自 line 137 租户过滤查询，可接受；建议保留 WHERE id=$4 AND tenant_id 以防万一。
- 无 P0/P1。

## backend/internal/handler/question_export_handler.go
- [P3][性能] question_export_handler.go:121-137 — 每题每知识点一次 QueryRow（N+1），大题库导出慢；最佳实践：按批 `WHERE id = ANY($1)` 一次查询后组 map。
- [P3][错误处理] question_export_handler.go:91,96 — json.Unmarshal 错误被忽略，options/answer 解析失败时静默导出空值；最佳实践：失败计入错误行统计。
- [P3][死代码] question_export_handler.go:55-58 — fillQuestionsData 恒返回 nil，500 分支不可达。
- 无 P0/P1（导出查询全部带 tenant/bank 过滤，line 82）。

## backend/internal/handler/question_handler.go
- [P2][越权] question_handler.go:110-123,161-172,244 — Create/BatchCreate/Update 均未校验 BankID 属于当前租户（store/questions.go:44-47 直接 INSERT bank_id；Update 时 bank_id 非空即改库），可把题目挂到他租户题库或把题目移库；最佳实践：创建/更新前调用 GetQuestionBankInTenant 校验 req.BankID。
- [P2][数据丢失] question_handler.go:161-177 — Update 为全量替换语义（store/questions.go:59-70 所有列无条件覆盖），options/answer/knowledgePoints/source 省略即被清空，且与 question_bank Update 的"省略保留"风格不一致，依赖前端全量提交；最佳实践：与前端确认契约，或改为非空回退。
- [P3][校验] question_handler.go:224-242 — BatchCreate 未逐条校验 Content/Type 非空、Type 合法性，空项会静默插入；最佳实践：逐条校验并统计失败。
- [P3][校验] question_handler.go:92-95 — 未校验 Type 枚举值、单选/多选必须有 options；最佳实践：按题型校验。
- [P3][错误处理] question_handler.go:76-79 — marshalJSON 忽略 json.Marshal 错误（Options 等为纯字符串数组，实际不会失败）。
- 无 P0。

## backend/internal/handler/question_import_handler.go
- [P3][逻辑] question_import_handler.go:287 — 无法识别的题型默认映射为 "single"，静默错误归类；最佳实践：返回错误计入 Failed。
- [P3][逻辑] question_import_handler.go:219-222 — overwrite 更新不写 source 列（保留旧值），与新建行默认 "Excel导入" 不一致；最佳实践：确认是否应更新 source。
- [P3][错误处理] question_import_handler.go:172-173 — json.Marshal 错误被忽略。
- 无 P0/P1（查询与更新均租户+题库限定）。

## backend/internal/handler/random_draw_question_handler.go
- [P3][契约] random_draw_question_handler.go:65-70 — ValidateUpdate 强制 Name 非空，前端仅改 description/answer/majorId 时需回传 name；与 question_bank 的"省略保留"不一致；最佳实践：与前端确认提交策略。
- 无 P0/P1（crud 骨架 + 服务层租户限定 GetByIDFn/UpdateFn/DeleteFn，注释明确）。

## backend/internal/handler/recommend_handler.go
- [P3][契约] recommend_handler.go:63-68 — ValidateUpdate 强制 careerPositionId/positionType 非空，部分更新受限。
- 无 P0/P1/P2（实体无 TenantID 字段，隔离靠 GetByIDFn 租户限定查询，注释说明充分）。

## backend/internal/handler/resource_code_handler.go
- [P3][一致性] resource_code_handler.go:26-39 — List 无显式登录检查（其余 handler 均先查 CurrentUser）；当前受全局 `auth` 中间件 + systemAdmin 路由组保护，无实际漏洞，但风格不一致。
- [P3][注释] resource_code_handler.go:53-54 — 注释"PermitGet: nil，读仅需登录"与实现不符：crud.go:105-108 中 PermitGet 为 nil 时回退到 `Permit`（canManagePortal），实际 GET 也要求门户管理权限；注释误导后续维护者。
- 无 P0/P1。

## backend/internal/handler/resource_export_handler.go
- [P3][越权] resource_export_handler.go:139,149 — org_types / 上级组织名称查询无 tenant 过滤；id 均来自 line 97-110 租户过滤的组织行，实际风险低；最佳实践：统一补 tenant 条件。
- [P3][越权] resource_export_handler.go:309 — staff_titles 查询无 tenant 过滤（title_ids 来自租户过滤的用户行，风险低）。
- [P3][性能] resource_export_handler.go:137-156,302-315 — 每行查询组织类型/父级名称、每用户每 title 一次查询（N+1）；最佳实践：批量 IN 查询。
- 无 P0/P1（学生/教师导出不含密码，line 249-250 注释明确）。

## backend/internal/handler/resource_import_handler.go
- [P2][错误被吞] resource_import_handler.go:283 — 行业父级关联第二遍 `_, _ = h.DB.Exec(UPDATE ... parent_id)` 错误完全吞掉，父级链接静默失败且无任何统计反馈；最佳实践：失败计入 result.Errors/Failed。
- [P2][错误被吞] resource_import_handler.go:720-726 — 教师 title_ids 补写 UPDATE 错误被忽略（`_, _`），失败仍计 TeacherCreated++，教师导入成功但职位丢失且用户不知情；最佳实践：并入 createUser 事务内或失败时计 Failed。
- [P3][逻辑] resource_import_handler.go:803 — 分隔符列表 `{"-","/","\\","->","_"}` 中 "->" 排在 "-" 之后，"A->B" 会先被 "-" 拆成 "A",">B"，"->" 分支永不可达；最佳实践：长分隔符优先匹配或删除 "->"。
- [P3][错误被吞] resource_import_handler.go:788 — `UPDATE roles SET user_count = user_count + 1` 错误忽略；统计列偏差可容忍。
- [P3][健壮性] resource_import_handler.go:82-89 — `permit` 在 `claims == nil` 判断之前计算；canManagePortal/canManageAlliance 对 nil 均安全（rbac.go:75-77,120-123），当前不崩但顺序易错；最佳实践：先判 claims 再算 permit。
- [P3][一致性] resource_import_handler.go:653-664 — 教师组织节点解析失败时 preview 记错误、execute 也记错误但行照常创建（无 org_node_id），结果错误提示与创建成功并存；最佳实践：统一为失败计 Failed 或明确降级策略。
- 无 P0/P1（覆盖/重命名/新建均带 tenant 条件，密码强度校验 preview 与 execute 一致）。

## backend/internal/handler/resource_library_handler.go
- [P3][一致性] resource_library_handler.go:43-98,101-152,173-205 — PreviewImport/List/Stats/CitationStats/UncitedList/Create 无显式登录检查（依赖全局 auth 中间件 + 路由组 jobViewer/systemAdmin）；受保护但与其他 handler 风格不一致。
- [P3][越权] resource_library_handler.go:160-169,214-221,275-283 — Get/Update/Delete 先按 id 无租户查询再 verifyTenantOwnership，属项目既有模式（crud.go GetOwnership 同构），可接受。
- [P3][校验] resource_library_handler.go:173-205 — Create 未校验 URL 协议/长度；前端职责，可容忍。
- 无 P0/P1（Create 的 claims.UserID 由 requireTenant 先行保证 non-nil，line 189-198 安全）。

## backend/internal/handler/resource_library_handler_test.go
- 无问题（三个测试均有断言且覆盖分页/统计/重名校验边界；cleanup 用 t.Cleanup 正确）。

## backend/internal/handler/role_handler.go
- [P3][一致性] role_handler.go:29-42 — List 无显式登录检查（依赖全局 auth + systemAdmin 路由组，routes.go:516）；风格不一致。
- 无 P0/P1/P2（Create/Update/Delete 经 crud 骨架 CheckOwnership 租户校验；Assign 对 role 与 user 双重 verifyTenantOwnership，line 125,143；canManagePortal 对 nil claims 安全）。

## backend/internal/handler/role_handler_test.go
- [P3][死代码] role_handler_test.go:172 — `_ = ctx` 无用占位。
- 无问题（其余测试断言完整，含删除后 404 验证与 assign 同租户用户场景）。

## backend/internal/handler/scenario_clone_handler.go
- [P3][健壮性] scenario_clone_handler.go:44 — 以 `err.Error() != "EOF"` 判断空请求体，字符串比较脆弱（应 errors.Is(err, io.EOF)）。
- [P3][死字段] scenario_clone_handler.go:18-21 — CloneScenarioRequest.Code 字段定义但 Clone() 未使用（service 自行生成 code）。
- [P3][过度防御] scenario_clone_handler.go:24-29 — 顶层 panic recovery + debug.Stack 全栈落日志；属掩盖 bug 的兜底，按"简单优先"应移除。
- 无 P0/P1（租户隔离由 service.ErrScenarioNotInTenant 保证，line 55-58）。

## backend/internal/handler/scenario_export_handler.go
- [P2][越权] scenario_export_handler.go:108 — 任务配置 sheet 的场景名称 `SELECT name FROM scenarios WHERE id=$1` 无 tenant 过滤；传他租户 scenarioId 时，对方场景名会被写入导出 Excel（轻微信息泄露，任务行查询 line 116 有 tenant 过滤故无数据行）；最佳实践：补 `AND tenant_id=$2`。
- [P3][越权] scenario_export_handler.go:181,196,211 — knowledge_points/ability_points/resource_library 名称查询无 tenant 过滤（id 来自租户过滤的任务行，风险低）。
- [P3][性能] scenario_export_handler.go:159-217 — 每任务每知识点/能力点/资源一次 QueryRow（N+1）。
- [P3][资源] scenario_export_handler.go:122-153 — taskRows 循环内 continue 后行 153 Close 仍会执行（无 defer 但显式关闭），rows.Err() 未检查；可接受。
- 无 P0/P1。

## backend/internal/handler/scenario_grade_handler.go
- [P2][越权] scenario_grade_handler.go:94-103 — req.TaskID 未校验属于目标场景/本租户（store/scenario_configs.go:114-141 upsert 直接写入 task_id，无任务归属校验），可把等级映射挂到他租户任务 id 或本场景外的任务 id，后续评估逻辑读到错配的 task_id；最佳实践：upsert 前用 TaskScenarioID 校验 task 归属。
- [P3][一致性] scenario_grade_handler.go:28-31,48-51 — 未授权返回 401，全站其他 handler 为 403"权限不足"。
- 无 P0/P1（场景与既有映射的租户校验完整，line 70-92）。

## backend/internal/handler/scenario_handler.go
- [P2][越权] scenario_handler.go:130 vs 136 — Get 在租户归属校验之前执行 recordViewAsync，未授权/他租户请求也会先给目标场景的 view_count 加 1（对他人数据的写影响，虽仅计数）；最佳实践：ownership 校验通过后再记录视图。
- [P3][重复] scenario_handler.go:121 — 与 line 115 重复调用 CurrentUser。
- [P3][边界] scenario_handler.go:232-235 — `difficulty == 0` 回退 existing，无法显式把难度设为 0。
- 无 P0/P1（Update/Delete 均先 Get + verifyTenantOwnership，cache 失效按 existing.TenantID 正确执行）。

## backend/internal/handler/scenario_import_eval_method_test.go
- 无问题（纯函数表驱动测试，覆盖中文/英文/空白/未知/空串边界，断言完整）。
