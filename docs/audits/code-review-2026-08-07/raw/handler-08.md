# Code Review 2026-08-07 — handler 批次 08

审查范围：19 个文件（tag/task/teaching_plan/template/tenant/training_program/user/workflow 相关 handler 及测试）。
审查方式：逐行完整通读，仅只读，未做任何修改。
交叉核对：common.go 帮助函数（nil 安全确认）、task_evaluation.go / user.go / user_relation.go / resource_bindings.go / scenario_configs.go 等 service/store 层行为。

---

## backend/internal/handler/tag_handler_test.go
- [P3][死代码] tag_handler_test.go:41-42,162-164,225-227 — `defer env.DB.Exec(...)` 的返回错误全部忽略（defer 中无法处理），且依赖手工 SQL 清理；最佳实践：依赖 testhelper 的租户级清理机制或 t.Cleanup 统一处理，减少与生产 schema 的耦合。
- [P3][测试健壮性] tag_handler_test.go:108-112 — 仅断言 ResourceCount==1 于单个标签；若列表分页/其他标签混入不影响正确性，无实际问题。其余无问题。

## backend/internal/handler/task_auto_exam_naming_test.go
- [P3][测试健壮性] task_auto_exam_naming_test.go:57,93 — `json.Marshal(cfg)` / `json.Marshal(quizCfg)` 错误被忽略（此处不可能失败，可接受）。
- [P3][测试健壮性] task_auto_exam_naming_test.go:108,129-135 — `usageDate` 取 `NOW()`，若测试运行跨午夜边界，同天序号断言会误失败（理论性 flake）。其余无问题。

## backend/internal/handler/task_evaluation_handler.go
- [P3][脆弱比较] task_evaluation_handler.go:184 — `err == service.ErrMethodVersionConflict` 直接比较哨兵错误，当前 service 层确实原样返回（task_evaluation.go:66 未包装），但一旦改为 `fmt.Errorf("%w", ...)` 就会静默变 500；最佳实践：改为 `errors.Is(err, service.ErrMethodVersionConflict)`。
- 其余：ListMethods/SaveMethods 均有任务租户校验（:116-120）与 tenant 透传（:88,182），GetTemplate/UpdateTemplate/DeleteTemplate 均先查后校验 TenantID（:238,303,339），respondServerError 使用正确，无越权/隔离问题。

## backend/internal/handler/task_knowledge_ability_handler.go
- [P2][越权/租户隔离缺失] task_knowledge_ability_handler.go:44 — `BindKnowledge` 调用 `Service.BindKnowledge(tenantID, ...)`，但 store 层 `TaskKnowledgeAbilityStore.BindKnowledge`（store/scenario_configs.go:204-219）的 INSERT 只带 tenant_id 参数，**不校验 task 是否属于该租户**；租户 A 用户可向租户 B 的任务/知识点插入绑定行，产生跨租户脏数据。解绑路径（:59-66）反而有完整 task→scenario→tenant 校验，两路径不对称。
- [P2][越权/租户隔离缺失] task_knowledge_ability_handler.go:93 — 同上，`BindAbility`（store/scenario_configs.go:236-252）INSERT 无 task 归属校验，跨租户绑定行可被插入。
- 最佳实践（两条）：绑定前复用 `TaskScenarioID`+`ScenarioTenantID`+`verifyTenantOwnership` 链路（与本文件 :124-138 verifyTaskTenant 一致），或在 store 的 INSERT 中 `WHERE EXISTS (SELECT 1 FROM scenario_tasks WHERE id=$2 AND tenant_id=$1)` 类防护。

## backend/internal/handler/task_resource_handler.go
- [P2][越权/租户隔离缺失] task_resource_handler.go:165 — `BindResource` 直接调 `Service.Bind`，store 层 `ResourceBindingStore.Bind`（store/resource_bindings.go:132-147）仅 INSERT `(tenant_id, task_id, resource_id)`，**不校验 task 或 resource 是否属于调用者租户**（无 FK 级租户约束）；租户 A 用户可把租户 B 的任务/资源写成绑定行，产生跨租户脏数据。解绑路径（:180-197）有完整归属校验，绑定路径缺失。
- [P2][错误被吞] task_resource_handler.go:120-126 — `req.Size` 解析失败时（parseInt 返回 err）`fileSize` 静默保持 nil，创建成功但 size 丢失，前端显示异常；最佳实践：解析失败时返回 400 或至少记日志。
- [P3][错误被吞] task_resource_handler.go:45-50 — `toTaskResource` 中 KnowledgePointRaw JSON 反序列化失败静默置空（可接受，数据格式异常时宁可显示空）。
- 最佳实践：绑定前校验 task 归属（复用 UnbindResource 同款 task→scenario→tenant 链路）。

## backend/internal/handler/teaching_plan_export_handler.go
- [P3][死代码] teaching_plan_export_handler.go:82 — `widths` 数组 12 项而 `headers` 仅 11 项，第 12 个宽度（12.0）永远不会被使用；最佳实践：删掉多余元素或补齐列。
- [P3][命名/状态码风格] teaching_plan_export_handler.go:17-20 — claims==nil 返回 403 而非统一 401（与 teaching_plan_handler.go 同风格，但与其他 handler 的 401 不一致）。
- [P3][输入净化] teaching_plan_export_handler.go:38 — 文件名拼接 `plan.TermName` 未净化，若 TermName 含 `/` 或引号会破坏 Content-Disposition（低危，浏览器一般容忍）。
- 冻结区（export）不适用分层约束；其余无问题。

## backend/internal/handler/teaching_plan_export_handler_test.go
- [P3][测试覆盖] teaching_plan_export_handler_test.go:11-30 — 状态标签映射只测了 draft/published/planned/scheduled 4 个，pending/approved/rejected/archived 分支未覆盖（default 分支也未覆盖）；最佳实践：补齐全部分支用例。
- 其余无问题。

## backend/internal/handler/teaching_plan_generate_classes_test.go
- 无问题（数据准备/断言/清理齐全；失败路径下 env.Cleanup 兜底）。

## backend/internal/handler/teaching_plan_handler.go
- [P2][错误被吞] teaching_plan_handler.go:107 — `FindTeachingPlanExisting` 的 err 被忽略，DB 故障时当作"无已有计划"，随后可能重复生成或产生误导性 500；最佳实践：err 非 nil 时按 500 处理。
- [P2][错误被吞] teaching_plan_handler.go:119 — `FetchPositionScenarios` 的 err 被忽略（`scenarios, _ :=`），场景课位置→场景映射静默丢失，生成出的计划场景信息不完整且无任何提示。
- [P2][错误被吞] teaching_plan_handler.go:173 — `Get` 中 `ListTeachingPlanEntries` 错误被吞，条目查询失败时返回 200 + 空 entries，前端误判为无条目；最佳实践：与 :149-153 Generate 一致走 respondServerError。
- [P2][错误被吞] teaching_plan_handler.go:293 — `Confirm` 后 `plan, _ := GetTeachingPlan` 错误被吞，成功确认但回读失败时返回 200 + JSON `null`。
- [P2][错误被吞] teaching_plan_handler.go:318 — `PutCourses` 保存成功后回读 `coursesOut, _ :=` 错误被吞，返回 200 + 空 items，前端误判保存结果。
- [P2][错误被吞] teaching_plan_handler.go:393 — `Clone` 克隆成功后 `program, _ :=` 错误被吞，返回 201 + JSON `null`。
- [P3][校验缺口] teaching_plan_handler.go:238 — `StartWeek > EndWeek` 校验在指针字段逐个应用之后执行，逻辑正确；但未校验 WeekHours/TotalHours 为负数等边界（低优先级，符合"简单优先"）。
- 其余（List/Get/UpdateEntry/DeleteEntry/Delete/Update/actions 状态机）租户隔离、404/400/409 处理均正确；无 P0/P1。

## backend/internal/handler/teaching_plan_handler_test.go
- 无问题（纯结构形状断言测试，无副作用）。

## backend/internal/handler/template_handler.go
- [P2][性能/重复查询] template_handler.go:31 — `ServePositionTemplate` 先调用 `h.queryDicts(ctx, tenantID)` 丢弃全部返回值（仅"预热"），随后 `generatePositionTemplate`（:169）再完整查询一遍，等于每次请求重复 7 次租户全表扫描；最佳实践：删除 :31 的预热调用或改为复用结果。
- [P2][错误被吞/静默失败] template_handler.go:86-165 — `queryDicts` 中 7 个查询任一失败直接 `return` 部分/空数据，模板仍照常生成，参考表静默缺失，用户拿到缺内容的模板无法察觉；最佳实践：查询失败时记录日志并返回明确的空/错误提示。
- [P3][错误被吞] template_handler.go:601-614,789-798,844-853,905-914,1107-1116,1202-1211 — `queryLessonBatches`/各内联字典查询错误一律返回 nil/空，同上静默降级。
- [P3][死代码] template_handler.go:293-295,413-415,532-535 — `f.DeleteSheet("Sheet1")` 连续调用两次，第二次必然失败且错误被忽略；最佳实践：删掉重复行。
- [P3][错误被吞] template_handler.go:830 — `QueryRow` 查询题库名错误被忽略，bankName 为空时模板照常生成且说明文字缺失。
- [P3][潜在栈溢出] template_handler.go:1242-1256 — `queryOrgPaths` 递归构建路径无环检测，若 organizations.parent_id 数据成环（自引用无约束时理论可能）将无限递归导致 panic；按"简单优先"原则可容忍，但建议加访问标记。
- [P3][错误未检查] template_handler.go:91-162 及各字典循环 — `rows.Err()` 均未检查，迭代中出错时数据静默截断。
- 冻结区（template）豁免分层规范（持有 *pgxpool.Pool、直接 SQL 均属豁免）；无 P0/P1。

## backend/internal/handler/tenant_handler.go
- [P1][越权/未鉴权敏感操作] tenant_handler.go:253-676 — `/api/v1/admin/tenants*` 整组 Admin* 接口（AdminList/AdminCreate/AdminUpdate/AdminUpdateStatus/AdminDelete/AdminListAdmins/AdminCreateAdmin/AdminUpdateAdmin/AdminDeleteAdmin/AdminResetPassword）**完全无鉴权**：匿名请求即可创建/删除租户、停用租户、重置学校管理员密码、新建管理员。注释（:253-254）声明"内部隐藏控制台，不做鉴权"为产品决策，但从安全角度这是最高危暴露面；最佳实践：至少在网关/路由层加 IP 白名单或专用密钥中间件保护，或文档化该控制台必须离线部署。
- [P2][错误被吞] tenant_handler.go:209-210,240-241,353-354,378-379 — Update/UpdateStatus/AdminUpdate/AdminUpdateStatus 成功后回读 `tenant, _ :=` 错误被吞，回读失败返回 200 + JSON `null`。
- [P3][消息风格] tenant_handler.go:542,672 — 错误消息"保存password失败"中英混排；建议统一中文"保存密码失败"。
- 其余（List 租户隔离 :73-77、Get 非平台角色自租户校验 :94-100、Update 平台/门户双通道校验 :156-168）逻辑正确；无 P0。

## backend/internal/handler/tenant_handler_test.go
- [P3][测试耦合] tenant_handler_test.go:16-31 — `cleanupTenant` 手工按表 DELETE，与生产 schema 强耦合，表结构变化时易漏删产生脏数据；最佳实践：改用事务回滚或环境级清库。其余无问题（Admin* 用例用 DoNoAuth 调用，印证了无鉴权设计是测试认可的现状）。

## backend/internal/handler/training_program_handler.go
- [P2][错误被吞] training_program_handler.go:318 — `PutCourses` 保存后回读 `coursesOut, _ :=` 错误被吞，返回 200 + 空 items。
- [P2][错误被吞] training_program_handler.go:393 — `Clone` 后 `program, _ :=` 错误被吞，返回 201 + JSON `null`。
- [P3][错误被吞] training_program_handler.go:228 — `Publish` 中 body 解码失败静默视为未传（默认 published），若请求体损坏会"静默发布"；低危，可接受。
- [P3][错误被吞] training_program_handler.go:373 — `Clone` 中 body 解码错误被忽略（Name 缺失时用默认名，可接受）。
- 其余（Create/Update/Delete 租户隔离、外键 400 处理、PutCourses 岗位/体系课必选校验 :291）正确；无 P0/P1。

## backend/internal/handler/user_extension_field_handler.go
- [P3][消息风格] user_extension_field_handler.go:38 — 错误消息"确保default extension fields失败"中英混排，且与操作语义不符（列表失败却说"确保默认字段"）；最佳实践：改为"查询扩展字段失败"。
- 其余（List 经 tenantFilter 鉴租户、Update 经 canManageUsers+verifyTenantOwnership）正确；无问题。

## backend/internal/handler/user_management_handler.go
- [P2][敏感信息泄露面] user_management_handler.go:176-190 — `Get` 无角色限制（仅租户归属校验），同租户任何认证用户（含学生角色）可读取任意用户详情且**保留身份证号**（:187 注释声明"供编辑回显"）；配合 `List`（:156-174，同样无角色限制）可枚举全租户用户后逐个取身份证。虽为有意设计，但隔离面过大；最佳实践：详情接口限制为 portal 管理角色（canManageUsers）或对非管理角色裁剪 IDCard。
- [P2][错误被吞] user_management_handler.go:649 — `BindRoles` 成功后 `AttachRoles` 错误被吞，响应中 roles 可能缺失或过期；最佳实践：记日志或按错误处理。
- [P3][消息风格] user_management_handler.go:517,557,592 — 校验失败消息"无效用户ID: "+id 将用户输入原样回显，无实际危害但属于不必要的反射；可接受。
- [P3][冗余代码] user_management_handler.go:210 — 测试中 `_ = ctx` 占位（见测试文件 :210）。其余（UpdateMe/ChangeMyPassword 自校验、批量操作租户限定、密码哈希清理）正确；无 P0/P1。

## backend/internal/handler/user_management_handler_test.go
- [P3][冗余代码] user_management_handler_test.go:210 — `_ = ctx` 占位；最佳实践：删除该行与未使用变量。
- [P3][测试覆盖] user_management_handler_test.go — 未覆盖越权路径（非管理角色调用 Create/Update 应 403）与 List 敏感字段裁剪断言（IDCard==nil），与 P2 关注点直接相关；建议补充。
- 其余无问题。

## backend/internal/handler/user_relation_handler.go
- [P2][错误掩盖] user_relation_handler.go:92-95 — `Create` 对**所有**错误（含 DB 故障、重复关系冲突）统一响应 400"发起者或目标不在租户中"，错误被掩盖、误导前端且 500 被伪装成 400；最佳实践：`errors.Is(err, service.ErrRelationUsersNotInTenant)` 时 400，其余走 respondServerError。
- [P3][校验缺口] user_relation_handler.go:67-79 — `relationType` 取值未在 handler 校验（若 store 也无枚举约束，可写入任意类型）；建议在 service/store 层约束枚举。
- 其余（仅本人可发起 :76-79、Delete 租户隔离 :112）正确；无 P0/P1。

## backend/internal/handler/workflow_handler.go
- [P3][孤儿数据风险] workflow_handler.go:61-67 — `CreateTenantFn` 在 `claims.TenantID == nil` 时返回 `("", true)`，会创建 tenant_id 为空的工作流；而 List/Get/Update/Delete 均租户隔离，该工作流对租户用户不可见、也无法管理，形成孤儿数据。若为平台级流程设计，建议加注释并保证存在可见路径；否则应返回 false 拒绝。
- 其余（crudConfig 复用、CheckOwnership、状态白名单 :74-82、Create 默认 active）正确；无 P0/P1。

---

# 汇总

- 审查文件数：19（全部逐行通读）
- 总问题数：38（P0: 0，P1: 1，P2: 14，P3: 23）

P0 摘要：无。

P1 摘要：
1. tenant_handler.go:253-676 — /api/v1/admin/tenants* 整组接口完全无鉴权（注释声明为产品决策），匿名可创建/删除租户、重置管理员密码、停用租户。
