# handler 层复查（2026-08-08）— 批次 06

复查方式：逐一 read 完整文件 + 交叉核对 common.go/crud.go/content_actions.go/import_common.go 公共校验链路、service/store 层 bank 校验。

## backend/internal/handler/question_bank_export_handler.go

- [P3][租户隔离] question_bank_export_handler.go:73 — `SELECT name FROM evaluation_batches WHERE id=$1` 无 `tenant_id` 过滤且 Scan 错误被忽略（batchName 恒为空串不感知）；batch_id 来自租户内 bank 行，正常情况下不越权，但 batch_id 可被本租户用户经 Update 写为任意 UUID，届时可读取他租户批次名。最佳实践：查询补 `AND tenant_id=$1`，Scan 错误记日志。

## backend/internal/handler/question_bank_handler.go

- [P3][风格] question_bank_handler.go:29,35 — `claims` 已取一次，第 35 行又调 `middleware.CurrentUser(r)` 取 `tenantClaims` 冗余；最佳实践：直接复用 `claims` 调 `tenantFilter(claims)`。
- [P2][错误处理] question_bank_handler.go:284-295 — `isDraftPool` 在 `IsDraftPool` 返回错误时 fail-open（`return false` 放行），DB 瞬时错误时草稿池的 Submit/Publish 守卫失效，可对草稿池发起状态流转；最佳实践：错误时按安全侧处理（respondServerError 或直接返回 true 阻止）。
- [P2][部分更新] question_bank_handler.go:158-164 — `Description`/`CoverImage` 无法显式清空：空串/nil 均回退为原值（与 scenario_handler 的 NullableString 可置空设计不一致）；最佳实践：用 `NullableString` 方案区分"未提供"与"置空"。

## backend/internal/handler/question_bank_import_handler.go

- 无问题（豁免区）：全链路 tenant_id 过滤（:117、:137、:180、:195），overwrite 前 `canOverwriteContent` 权限校验（:158），UPDATE 目标来自租户限定查询（:163）。

## backend/internal/handler/question_export_handler.go

- [P3][错误处理] question_export_handler.go:93,98 — `json.Unmarshal` 错误被忽略，options/answers 解析失败时静默输出空值（导出场景，影响有限）；最佳实践：失败时记日志并回退原字符串。

## backend/internal/handler/question_handler.go

- [P1][租户隔离] question_handler.go:110-123（Create）、:161-172（Update）、:229-244（BatchCreate）— 请求体中的 `bankId` 未校验归属当前租户即透传；store `QuestionStore.Create/BatchCreate/Update`（store/questions.go:42-52、:95-110、:72-76）直接用客户端 bank_id 落库且无任何租户限定，`question_banks` FK 只保证存在性不保证租户。后果：租户 A 用户可把题目写入/移动到租户 B 的题库（题目 tenant_id 仍为 A，出现孤儿数据，污染他租户题库引用，B 侧列表不显示但 bank 引用被污染）。最佳实践：handler 创建/更新前复用 `GetQuestionBankInTenant` 校验 bank 归属（参照 question_bank_handler.go:72），或 store 层在 INSERT/UPDATE 前校验 bank 存在且 tenant 匹配。

## backend/internal/handler/question_import_handler.go

- 无问题（豁免区）：bank 校验带 tenant（:40、:84），重复判断/rename/overwrite 全链 tenant 限定（:193、:237、:252），knowledge point 创建复用租户限定 helper（:218、:246）。

## backend/internal/handler/random_draw_question_handler.go

- [P3][契约] random_draw_question_handler.go:52 — `UniqueViolationMsg: "现场问答题名称已存在"` 与实体命名"随机抽题"不一致（疑似复制 on-site 配置），重名 409 文案误导；最佳实践：改为"随机抽题名称已存在"。

## backend/internal/handler/recommend_handler.go

- 无问题：租户隔离经 `TenantFn=requireTenant` + 租户限定 `GetByIDFn` 实现（:89-95），List 经 `listParamsFromRequest(r,true)`（:33）。

## backend/internal/handler/resource_code_handler.go

- [P3][认证一致性] resource_code_handler.go:26 — `List` 无 `CurrentUser` 判空（依赖 `listParamsFromRequest` 的 tenantFilter 兜底 403，未登录请求仍会被 403 拦截，仅风格不一致）；最佳实践：与其他 List 一致显式判空 claims。

## backend/internal/handler/resource_export_handler.go

- 无问题（豁免区）：导出限 `canManagePortal`（:39），组织/学生/教师查询均 tenant 限定（:100、:111、:207），org 路径与职称查询带 tenant（:288、:309）。

## backend/internal/handler/resource_import_handler.go

- [P3][错误吞静默] resource_import_handler.go:792-797 — `createUser` 中 `user_roles` 插入与 `roles.user_count` 自增错误被 `_, _ = h.DB.Exec` 静默吞掉；roleID 已由调用方预检非空（:515、:624），故仅 DB 异常场景，但失败后用户已创建而无角色、计数失真且无任何日志；最佳实践：至少记日志，或返回 error 由调用方按行失败处理。

## backend/internal/handler/resource_library_handler.go

- 无问题：Get/Update/Delete 回读后 `verifyTenantOwnership`（:167、:220、:281），List/Stats/CitationStats/UncitedList/PreviewImport/Create 均 requireTenant 限定（:44、:67、:102、:116、:130、:174）；Update 部分更新兜底完整（:229-258）。

## backend/internal/handler/resource_library_handler_test.go

- 无问题：分页/统计/PreviewImport 三用例覆盖真实断言，租户隔离场景（他租户不可见）未覆盖但属测试增强项，非缺陷。

## backend/internal/handler/role_handler.go

- 无问题：CRUD 走 `crudCreate/crudGet/crudUpdate/crudDelete` + `CheckOwnership/GetOwnership`（:53-54），Assign 双重 `verifyTenantOwnership`（:125、:143）。

## backend/internal/handler/role_handler_test.go

- [P3][风格] role_handler_test.go:172 — `_ = ctx` 无效赋值（ctx 已在上方各语句使用，此行为死代码）；最佳实践：删除该行。

## backend/internal/handler/scenario_clone_handler.go

- 无问题：panic 恢复（:24-29）、租户校验（:38）、`ErrScenarioNotInTenant` → 403（:55）。

## backend/internal/handler/scenario_export_handler.go

- [P2][租户隔离] scenario_export_handler.go:106-110 — Sheet2「任务配置」按请求 `scenarioIDs` 直接 `SELECT name FROM scenarios WHERE id=$1` 无 `tenant_id` 过滤（同文件 Sheet1 已带租户过滤 :61，此处遗漏）；Sheet1 会跳过非本租户行，但 Sheet2 仍会把任意租户的场景名写入导出文件（需知道对方 UUID）；最佳实践：与 Sheet1 一致补 `AND tenant_id=$2`。

## backend/internal/handler/scenario_grade_handler.go

- 无问题：Upsert 对场景与既有映射双重租户校验（:70-92），List 走 `listParamsFromRequest(r,true)`（:34）。

## backend/internal/handler/scenario_handler.go

- [P3][副作用] scenario_handler.go:121-138 — `recordViewAsync` 在租户归属校验（:136）之前触发：他租户用户携带已知 UUID 请求 Get 会先给场景 +1 view_count 再收到 403，可被用于污染他人视图计数；最佳实践：校验通过后再记录视图。
- [P3][部分更新] scenario_handler.go:232-235 — `difficulty == 0` 判定回退导致无法显式置 0（与同文件 NullableString 字段处理方式不一致）；最佳实践：difficulty 也改为 Nullable 语义或引入 `*int`。

## backend/internal/handler/scenario_import_eval_method_test.go

- 无问题：映射用例含空白/未知/空值边界，断言有效。
