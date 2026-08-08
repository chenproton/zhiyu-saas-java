# Handler 层复查报告（2026-08-08）

复查范围：19 个文件（h2-ah 列表），逐一完整通读。重点：已修项回归（越权/租户隔离、部分更新兜底、回读错误 500、认证）、上轮遗漏、新问题。

结论：未发现 P0；P1 无新高危（认证/租户隔离主线已闭环，剩余为绑定类写路径的租户校验缺失，评级 P2）；P2 共 14 条（集中在"回读错误吞静默"与"部分更新丢字段"两类）；P3 若干。

---

## backend/internal/handler/tag_handler_test.go

- [P3][测试] tag_handler_test.go:41-42 — `defer env.DB.Exec(...)` 忽略错误，若清理失败会污染后续测试；测试环境可容忍，最佳实践：用 `t.Cleanup` + 断言错误。
- 无其他问题（断言完整、覆盖 CRUD/级联/OR 筛选，测试有效）。

## backend/internal/handler/task_auto_exam_naming_test.go

- [P3][测试] task_auto_exam_naming_test.go:111 — `s1 != "1" || s2 != "2"` 的序号断言强依赖"当天第几个测评"，若测试在同一租户/同天与其它测试并行运行可能不稳定；当前测试串行执行可接受。
- 无其他问题。

## backend/internal/handler/task_evaluation_handler.go

- [P3][契约] task_evaluation_handler.go:222-243 — `GetTemplate` 先取数后校验租户（404 优先于 403），与 `UpdateTemplate`/`DeleteTemplate` 一致，可接受；但 `GetTemplate` 返回的模板含 `tenant_id` 字段，跨端透传无风险。
- 无 P0/P1/P2（ListMethods/SaveMethods 均先校验任务租户，SaveMethods 乐观锁冲突 409，模板 CRUD 租户归属校验完整）。

## backend/internal/handler/task_knowledge_ability_handler.go

- [P2][静默失败] task_knowledge_ability_handler.go:59-63、109-112 — `UnbindKnowledge`/`UnbindAbility` 中 `TaskBindingTaskID` 出错一律返回 200 成功。仅 `pgx.ErrNoRows`（绑定不存在）应视为幂等成功，DB 故障/任务表异常等真实错误被吞，前端显示成功实际未删除；最佳实践：区分 `errors.Is(err, pgx.ErrNoRows)` 走幂等成功，其余走 `respondServerError`。
- [P2][租户隔离] task_knowledge_ability_handler.go:44、93 — `BindKnowledge`/`BindAbility` 未像 Unbind 路径一样校验 task 的租户归属；store 层仅按调用方 tenant_id 插入绑定行（store/scenario_configs.go:204-219），可对他人租户任务/知识点/能力点建立跨租户绑定行（需猜测 UUID，泄漏面有限但产生脏数据）；最佳实践：Bind 前复用 `verifyTaskTenant` 链路校验。
- [P3][边界] task_knowledge_ability_handler.go:135 — `scenarioTenantID != nil` 才校验归属：`ScenarioTenantID` 返回 `(nil, nil)`（场景无租户或行缺失）时跳过校验直接放行；正常数据租户非空，属防御性缺口，建议 nil 视为校验失败。

## backend/internal/handler/task_resource_handler.go

- [P2][租户隔离] task_resource_handler.go:165-169 — `BindResource` 未校验 task 归属（Unbind 路径做了 task→scenario→tenant 链路校验），store `ResourceBindingStore.Bind`（store/resource_bindings.go:132-147）仅按调用方 tenant_id 插入且不校验 bindID/resource 归属，可对他人任务/资源建立跨租户绑定行；最佳实践：Bind 前校验 `TaskScenarioID`+`ScenarioTenantID`。
- [P2][静默失败] task_resource_handler.go:180-184 — `UnbindResource` 中 `BindTargetID` 出错一律 200 成功（同 task_knowledge_ability_handler 模式），DB 错误被吞；最佳实践：仅 `pgx.ErrNoRows` 幂等成功，其余 500。
- [P3][边界] task_resource_handler.go:120-126 — `Create` 中 `Size` 解析失败静默忽略（`parseInt` err==nil 才用），容忍策略可接受；`ListResources` 的 limit 由 `store.ParsePageLimit` 钳制到 200，无越界风险。

## backend/internal/handler/teaching_plan_export_handler.go

- [P3][边界] teaching_plan_export_handler.go:38 — 文件名直接拼接 `plan.TermName` 未做净化（含 `/` 等字符时 Content-Disposition 畸变），影响极小；最佳实践：对文件名做 `excelize`/`url.PathEscape` 或白名单清洗。
- 租户隔离正确（GetTeachingPlan/ListTeachingPlanEntries 均带 tenantID，失败 404/500 区分清晰）。

## backend/internal/handler/teaching_plan_export_handler_test.go

- 无问题（标签映射 + Excel 结构断言有效）。

## backend/internal/handler/teaching_plan_generate_classes_test.go

- 无问题（覆盖自动带班级、排除其它专业班级、清理完整）。

## backend/internal/handler/teaching_plan_handler.go

- [P2][静默失败] teaching_plan_handler.go:173 — `Get` 中 `entries, _ :=` 忽略回读错误：计划存在但条目查询失败时返回 200 + 空条目，前端误判无条目；最佳实践：走 `respondServerError`。
- [P2][静默失败] teaching_plan_handler.go:108 — `Generate` 中 `scheduledCount, _ :=` 忽略错误：计数查询失败视为 0，已排课计划可能被"重新生成"删除重建（GeneratePlan 事务内先 DELETE 旧计划，store/teaching_plans.go:169-175）；虽有 FK 兜底（被引用时 500 回滚），但错误被静默化；最佳实践：错误走 500。
- [P2][静默失败] teaching_plan_handler.go:293 — `Confirm` 后 `plan, _ :=` 回读失败返回 200 + null；最佳实践：`respondServerError`。
- [P3][事务/边界] teaching_plan_handler.go:107-113 — 409 检查与 GeneratePlan 之间非原子（检查-重建竞态）：检查通过后、事务删除前若发生排课，DELETE 被 schedule_entries 外键拒绝 → 500，不丢数据，可接受。
- [P3][事务] teaching_plan_handler.go:243 + store/teaching_plans.go:403-410 — `classNodeIDs` 替换块（DELETE+批量 INSERT）不在事务内且忽略全部错误（`_, _ =`），部分失败时班级绑定数据不一致但返回 200；建议至少回读校验或吞错前记日志。

## backend/internal/handler/teaching_plan_handler_test.go

- 无问题（扁平响应形状断言有效，防前端 undefined 回归）。

## backend/internal/handler/template_handler.go（import/export 冻结区，豁免分层约束）

- [P3][性能] template_handler.go:31 — `ServePositionTemplate` 先 `h.queryDicts(ctx, tenantID)` 预取一次，随后 `generatePositionTemplate` 内部再查一次，同一请求重复 7 条查询；最佳实践：删除预取调用。
- [P3][死代码] template_handler.go:295、415、535 — 三处 `f.DeleteSheet("Sheet1")` 连续调用两次，第二次必失败被忽略；最佳实践：删除重复行。
- [P3][静默失败] template_handler.go:86-165 — `queryDicts` 任一查询失败静默返回空字典，模板仍照常下载（参考 Sheet 空白）；作为参考表可容忍，建议失败时记录日志。
- [P3][契约] template_handler.go:829-830 — `ServeQuestionTemplate` 未校验题库存在/归属（QueryRow 错误被 `_ =` 吞掉），bankID 不存在或跨租户时仍返回模板（"目标题库"为空）；最佳实践：bank 不存在返回 404。
- [P3][HTTP] template_handler.go:51-61 — `writeExcel` 在 `f.Write` 失败时调用 `respondError` 写 500，此时可能已写 200 头，产生 superfluous WriteHeader 噪音；建议先写完整再定状态码或失败时仅写日志。
- 其余（组织路径递归、参考字典 Sheet 结构）无问题。

## backend/internal/handler/tenant_handler.go

- [P2][静默失败] tenant_handler.go:209、240、353、378、625 — `Update`/`UpdateStatus`/`AdminUpdate`/`AdminUpdateStatus`/`UpdateSchoolAdmin` 回读一律 `tenant, _ :=`，回读失败返回 200 + null；最佳实践：`respondServerError`（UpdateSchoolAdmin 的 Admin 版本已正确 500，本组应统一）。
- [P3][文档] tenant_handler.go:253-254 — 注释"内部隐藏控制台，不做鉴权"已过时：路由实际由 `RequirePlatform(UserPlatformSaas)` + `platformAdmin` 中间件保护（router/routes.go:244-257），注释易误导后续维护者误删鉴权；最佳实践：更新注释说明鉴权在路由中间件。
- [P3][风格] tenant_handler.go:542、672 — "保存password失败"中英混排；最佳实践：统一中文文案。
- [P3][契约] tenant_handler.go:179-182 — `Update` 要求 body 必带非空 `name`，纯部分更新（只改 phone 等）会被 400 拒绝；与 AdminUpdate 行为一致，属既有契约，可接受。
- 越权检查正确：Get/Create/Update/UpdateStatus 的平台管理员或租户归属校验完整，`Admin*` 系列由路由中间件兜底，未发现越权。

## backend/internal/handler/tenant_handler_test.go

- 无问题（覆盖创建/重复/隔离列表/状态/订阅/管理员 CRUD/密码强度/登录验证，测试有效）。

## backend/internal/handler/training_program_handler.go

- [P2][静默失败] training_program_handler.go:393 — `Clone` 成功后 `program, _ :=` 回读失败返回 201 + null；最佳实践：`respondServerError`。
- [P3][容错] training_program_handler.go:228、373 — `Publish`/`Clone` 直接用 `json.NewDecoder` 且忽略错误（容忍坏 body），可接受但建议统一 `decodeBody`。
- [P3][校验] training_program_handler.go:290-313 — `PutCourses` 未校验 `c.Name` 非空（仅校验 position/course 关联），空名课程可入库；最佳实践：必填校验。
- [P3][静默失败] training_program_handler.go:106-110 — `GenerateEntityCode` 失败时 code 保持 nil 直接创建，若 DB 层 code 非空约束将 500（有约束兜底）；可接受。
- 部分更新兜底实现完整（Update 各字段 nil 回落 existing，training_program_handler.go:143-169），符合上轮修复目标。

## backend/internal/handler/user_extension_field_handler.go

- 无问题（List 租户过滤、Update 先 `canManageUsers` + `verifyTenantOwnership` 再写，写入用 existing.TenantID 防租户漂移）。

## backend/internal/handler/user_management_handler.go

- [P2][数据丢失] user_management_handler.go:301-317 + store/users.go:132-141 — `Update` 是"读后全列覆盖"：store 对 email/phone/avatar_url/student_no/work_id/id_card/org_node_id/major_id/title_ids 等列直接写请求值，body 未携带的字段（nil）会被置 NULL。handler 仅保证 username/name 必填，部分更新（如只改名）会清空其余字段；当前前端若全量表单提交则无感，但契约脆弱且测试（TestUser_Update 只发 username+name）未覆盖字段保持；最佳实践：按 `*string` nil 语义做 COALESCE 部分更新（参照 teaching_plan UpdateEntry 模式）。
- [P2][认证设计] user_management_handler.go:129-154 — `ChangeMyPassword` 不校验旧密码（注释声明设计如此）：持有会话即可改密，被盗会话可直接接管账号；作为自助改密接口建议至少校验旧密码或走验证码，风险由产品决策兜底，仅记录提醒。
- [P3][契约] user_management_handler.go:168-173 — `List` 裁剪 IDCard/Oauth 但 phone/email 完整下发；`Get` 对非管理角色脱敏 IDCard，行为一致，无 PII 泄露问题。
- 其余（Create/BatchCreate 逐条 `verifyRequestTenant`，批量操作一律以 claims 租户为作用域并校验 UUID 格式，BindRoles 租户内角色校验）无问题。

## backend/internal/handler/user_management_handler_test.go

- [P3][死代码] user_management_handler_test.go:210 — `_ = ctx` 冗余（ctx 在 205 行后未再使用）；最佳实践：删除该变量。
- 无其他问题（CRUD/批量/状态测试有效，但注意 TestUser_Update 未断言未携带字段被保持——见 user_management_handler.go 的 P2）。

## backend/internal/handler/user_relation_handler.go

- [P2][错误吞静默] user_relation_handler.go:92-95 — `Create` 任何错误一律 400"发起者或目标不在租户中"：DB 故障/唯一冲突等真实错误被误标为客户错误，前端无法区分；最佳实践：区分 `pgx.ErrNoRows`/业务错误走 400，其余 `respondServerError`。
- [P3][授权] user_relation_handler.go:99-121 — `Delete` 仅按租户+ID 删除，不校验删除者为发起方：同租户用户可删除他人建立的关系（如学生删除教师-学生关系）；业务若需限制应加发起人校验，当前按"租户内透明"容忍。
- [P3][校验] user_relation_handler.go:67-79 — `RelationType` 未做枚举校验，任意字符串可入库（服务层是否校验待确认）；最佳实践：handler 或 store 白名单校验。

## backend/internal/handler/workflow_handler.go

- [P2][数据丢失] workflow_handler.go:101-115 — `UpdateFn` 中 `steps`/`majorIds` 为 nil 时置空切片后整体覆盖：部分更新（只改 name/status）会清空已有步骤与适用专业，仅 status 有兜底（ValidateUpdateExisting）；最佳实践：nil 时沿用 existing 值（与 status 兜底一致）或走 read-modify-write。
- [P2][静默失败] crud.go:100、187（workflow 经 crudCreate/crudUpdate 复用）— 创建/更新后回读 `item, _ :=` 忽略错误：回读失败返回 201/200 + 零值对象；最佳实践：回读失败 `respondServerError`。
- [P3][租户] workflow_handler.go:61-67 — `CreateTenantFn` 在 claims.TenantID 为 nil 时返回 `("", true)` 继续创建：无租户调用者可生成 tenant_id 为空的孤儿工作流（租户列表不可见，不构成跨租户泄露）；最佳实践：与其它 CRUD 一致返回 `("", false)` 阻止。
- 其余（CheckOwnership/Get 租户过滤、状态枚举校验）正确。

---

## 上轮已修项回归结论

- 认证前置：本批全部 handler 入口均先校验 `CurrentUser`，无裸访问。
- 越权/租户隔离：单条资源路径（Get/Update/Delete/模板 CRUD/教学计划/用户管理）租户归属校验完整；**遗留缺口**集中在"绑定类写路径"（BindResource/BindKnowledge/BindAbility 未校验目标任务租户）与两处"查绑定行失败静默 200"（Unbind*），均为 P2。
- 部分更新兜底：training_program Update、teaching_plan UpdateEntry 已达标；user_management Update（P2）与 workflow UpdateFn（P2）仍是全列覆盖/置空模式，需跟进。
- 回读错误改 500：大部分已统一 `respondServerError`；残留 `_, _ :=` 静默点共 7 处（teaching_plan 173/108/293、tenant 209/240/353/378/625、training_program 393、crud 100/187），详见上文。
- Admin* 控制台：鉴权实现在路由中间件（RequirePlatform+platformAdmin），非代码缺口，仅注释过时（P3）。

## 汇总

- 审查文件数：19（含 7 个测试文件）
- 问题总数：32（P0: 0，P1: 0，P2: 14，P3: 18）
- P2 摘要：绑定路径租户校验缺失 ×3（task_knowledge_ability 44/93、task_resource 165）；解绑类静默 200 ×3（task_knowledge_ability 59/109、task_resource 180）；回读错误吞静默 ×8（teaching_plan 108/173/293、tenant 209/240/353/378/625、training_program 393、crud 100/187）；部分更新丢字段 ×2（user_management Update、workflow UpdateFn）；其余 ×1（user_relation Create 错误误标 400、ChangeMyPassword 无旧密码校验）。
