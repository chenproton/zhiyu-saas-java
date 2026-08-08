# handler-01 代码审查报告（复查 · 2026-08-08，22 文件完整逐行通读）

审查时间：2026-08-08
审查范围：`backend/internal/handler/` 下 22 个文件（ability 至 certification_model）
审查方式：完整逐行阅读 + 交叉核对 crud.go / common.go / store / service；能力域 CRUD 用真实测试库（zhiyu_test）复跑验证

## 已修项回归核验（本次复查重点）

- 联盟部分更新兜底：UpdateEnterpriseAgreement（alliance_handler.go:191-212）、UpdateMilestone（:348-363）、UpdatePermission（:545-563）、UpdateDictionaryItem name（:673-676）、projectCRUD ValidateUpdateExisting（alliance_crud_handler.go:287-326）、enterpriseCRUD（:180-251）均已就位，且新增 TestAllianceProject_PartialUpdatePreservesFields 覆盖。✔（但见下方 P2：bool/int 字段仍漏网）
- 题库 KnowledgePointIds 回退：question_bank_handler.go:177-180 `if knowledgePointIDs == nil { knowledgePointIDs = existing.KnowledgePointIDs }` 已修（该文件不在本轮列表，仅作回归抽查确认）。✔
- 错误吞改 500：GetSchoolInfo（alliance_handler.go:66-70）、GetEnterpriseAgreementByID 回读（:155-159、:218-222）、approval 回读（approval_handler.go:175-179、:200-204、:229-233）、PutFullRule 回读（certification_handler.go:479-483）均已改 respondServerError。✔
- appeal Create 跨租户校验：appeal_handler.go:94-98 已补目标用户租户校验。✔
- certification UpdateRule 改绑岗位租户校验：certification_handler.go:213-221 已补（但 PutFullRule 遗漏，见 P1-2）。⚠
- 审批并发：UpdateHistory 已改 SQL 原子追加（store/approvals.go:129-143），AdvanceRecord 带 current_step_idx CAS（:157-167），上轮 P2 修复到位。✔
- 能力域租户隔离：commit aea1be44 给 store 加租户过滤，但**漏配 TenantFn** → 引入 P0（见下）。

## backend/internal/handler/ability_code_test.go
- [P3][测试健壮性] ability_code_test.go:53 — `pos, _ := testhelper.Unmarshal[domain.CareerPosition](w)` 忽略解构错误，unmarshal 失败时 pos.ID 为空串，后续 PUT 打到 `/save-full/` 404，失败信息不直观（上轮已标，未修）；最佳实践：解构失败直接 t.Fatalf（与 L34-37 一致）。

## backend/internal/handler/ability_domain_handler.go
- [P0][功能失效] ability_domain_handler.go:46-109 — crud 配置**未设置 `TenantFn`**（对照 ability_handler.go:99、affairs_term_handler.go:97 均设 `TenantFn: requireTenant`）。crud.go:113-120/148-154/207-213 在 TenantFn 为 nil 时 tenantID=""，GetByIDFn 走 store 的 `WHERE id=$1 AND tenant_id=$2`（store/ability_domains.go:87）恒不命中 → **Get/Update/Delete 一律 404**。commit aea1be44（08-07 P1 修复）把 GetByIDFn/UpdateFn/DeleteFn 改为租户限定却漏配 TenantFn，且集成测试因 TEST_DATABASE_URL 未配置被跳过未暴露；已在真实测试库复跑 TestAbilityDomain_CRUD 确认：Create/List 200，Update/Delete 404「能力域不存在」。最佳实践：crud 配置补 `TenantFn: requireTenant`，并补一条不依赖 DB 环境的 handler 单测或确保 CI 配置测试库运行集成测试。

## backend/internal/handler/ability_handler.go
- [P3][错误处理] ability_handler.go:143-146 — UncitedList 中 `parsePageLimit` 出错后静默回退 limit=20 且无日志（上轮已标，未修）；最佳实践：出错记录 slog 或返回 400。

## backend/internal/handler/affairs_config_import_handler.go
（import 冻结区，直连 DB 豁免；以下为业务正确性，均为上轮已标未修项）
- [P2][静默失败] affairs_config_import_handler.go:74-79、106-111、152-157 — 三个 Sheet 的重复检查 `QueryRow(...).Scan` 与 INSERT `Exec` 错误全部忽略，DB 故障或类型不合法（如日期格式错误）时导入返回 200 且计数虚高、部分行静默丢失；最佳实践：Scan/Exec 出错时记录日志并 500（或计入 skipped 并在响应带 error 字段）。
- [P2][事务缺失] affairs_config_import_handler.go:53-166 — 三 Sheet 导入不在同一事务，中途失败留部分数据；最佳实践：整次导入包 BeginTx 整体回滚。
- [P3][命名] affairs_config_import_handler.go:112 — 局部变量 `cap` 遮蔽内建函数；最佳实践：改名 `capacityVal`。
- [P3][死代码] affairs_config_import_handler.go:215-217 — 末尾 NewSheet("Sheet1") 后立即删除为空操作；最佳实践：删除。

## backend/internal/handler/affairs_config_import_test.go
无问题。

## backend/internal/handler/affairs_term_handler.go
无问题。租户隔离靠 GetByIDFn 租户限定查询 + DeleteChecks 引用检查，实现正确。

## backend/internal/handler/alliance_crud_handler.go
- [P1][数据丢失] alliance_crud_handler.go:342-375（achievementCRUD）、379-412（expertCRUD）、416-449（agreementCRUD）、453-485（brandCRUD）— 四个实体**完全没有 ValidateUpdateExisting 部分更新兜底**，请求体直接进 store 全列覆盖 UPDATE（store/alliance_achievement_store.go:89-108、alliance_expert_store.go:95-111、alliance_agreement_store.go:72-82、alliance_brand_store.go:80-95），未携带字段全部写零值：字符串清空、RawMessage 变 `[]`、is_public/is_featured 变 false、关联 ID 清 NULL——与上轮已修的"合作项目/协议/里程碑部分更新清空"完全同类，属修复遗漏（前端列表页"前台展示"开关若只带 isPublic 部分更新，会清空整行内容）；最佳实践：按 enterprise/project 的 ValidateUpdateExisting 模式补回退（注意区分"未携带"与"显式空数组/空串"的语义）。
- [P2][数据丢失] alliance_crud_handler.go:180-251、287-326 — enterprise/project 的部分更新兜底**漏掉 bool 字段 `IsPublic`**（请求体缺省 false 会覆盖已有 true）：仅改名称/阶段的局部 PUT 会静默取消前台公开，企业/项目从门户消失；最佳实践：将 IsPublic 改为 *bool 或维护显式 PATCH 语义，缺省时回退现有值。
- [P2][错误处理] alliance_crud_handler.go:49 — `alliancePublicGet` 将 store 所有错误（含 DB 故障）统一响应 404（上轮已标，未修）；最佳实践：区分 ErrNotFound 返回 404，其余走 respondServerError。

## backend/internal/handler/alliance_handler.go
- [P2][数据丢失] alliance_handler.go:344-363 — UpdateMilestone 兜底漏掉 `IsCompleted`（bool）与 `SortOrder`（int）：仅改名称/日期的局部更新会把已勾选完成的里程碑重置为未完成、排序清零；最佳实践：IsCompleted/SortOrder 改指针或请求侧显式区分，缺省回退 existing。
- [P2][数据丢失] alliance_handler.go:541-563 — UpdatePermission 兜底漏掉 `IsEnabled`（bool）：部分更新（如改账号名/资源权限）会静默把合作账号置为停用；最佳实践：IsEnabled 改 *bool 缺省回退。
- [P2][数据丢失] alliance_handler.go:666-685 — UpdateDictionaryItem 已修 name 回退，但 `SortOrder`（int）缺省写 0，部分更新重排序字典项；最佳实践：SortOrder 缺省回退现有值。
- [P2][错误处理] alliance_handler.go:488-493 — GetPermission 将 store 所有错误（含 DB 故障）响应 404（上轮已标，未修）；最佳实践：区分 pgx.ErrNoRows 与内部错误。
- [P3][性能] alliance_handler.go:114、288 — ListEnterpriseAgreements/ListMilestones 无分页，全量返回（上轮已标，未修）；最佳实践：沿用 executeListQuery 骨架加 limit/offset。
- [P3][敏感数据] alliance_handler.go:729-745（GetPublicSchoolInfo）与 store/alliance_enterprise_store.go:334-356（ListPublicEnterprises/GetPublicEnterpriseByID）— 匿名公开接口返回完整联系信息（联系人/电话/邮箱/统一社会信用代码/证照图片）；若门户有意公开则忽略，否则应做字段裁剪 DTO。

## backend/internal/handler/alliance_handler_test.go
无问题。TestAllianceProject_PartialUpdatePreservesFields 覆盖了 project 部分更新回归；建议同类补充 enterprise/achievement/expert/agreement/brand 用例（对应上方 P1/P2 缺口）。

## backend/internal/handler/alliance_import_test.go
- [P3][测试健壮性] alliance_import_test.go:84、108-109、144-145、172-173 — 多处 `json.Unmarshal(ids, &list)` 忽略错误，解析失败时后续断言在空 list 上继续（上轮已标，未修）；最佳实践：unmarshal 失败 t.Fatalf。

## backend/internal/handler/appeal_handler.go
- [P3][越权·缓解确认] appeal_handler.go:107-145 — Process 仍无角色校验，但经核 routes.go:178-183，appeals 路由挂在 businessUser 组（教师/学校管理员/企业导师/平台管理员），学生不可达；企业导师可审批他人申诉是否可接受需产品确认，若需严格化可在 handler 加 canManageAlliance 类校验。
- 上轮 P1（Create 不校验被申诉用户租户）已修：appeal_handler.go:94-98 先按 userID 查用户并校验 tenant_id。✔

## backend/internal/handler/approval_handler.go
- [P3][并发竞态] approval_handler.go:259-310 — "all" 审批模式下两名审核人几乎同时批准：均读到旧 History、均判定未完成，各自经原子追加 UpdateHistory 后仍停在当前步骤（两次追加都成功、步骤不推进），后续无人再批则流程卡死；概率低，且数据不丢失（历史完整）；最佳实践：可在 UpdateHistory 返回后重读再判，或接受该边界（简单优先）。

## backend/internal/handler/auth_handler.go
（以下均为上轮已标未修项，风险未变）
- [P3][安全细节] auth_handler.go:126-135 — 停用用户/租户跳过 bcrypt 而有效用户执行比较，响应耗时差可作用户名枚举侧信道；最佳实践：停用分支也执行一次 dummy bcrypt。
- [P3][冗余逻辑] auth_handler.go:205-214 — nonce 超 2 分钟删除重放的分支实际不可达（preAuth token TTL 仅 1 分钟）；最佳实践：删除该分支或统一时间口径。
- [P3][健壮性] auth_handler.go:157 — `rand.Read(jtiBytes)` 错误忽略；最佳实践：处理或注释。
- [P3][边界] auth_handler.go:271-274 — User-Agent 按字节 `[:256]` 截断可能切断多字节 UTF-8；最佳实践：按 rune 截断。

## backend/internal/handler/auth_handler_test.go
无问题。

## backend/internal/handler/batch_configs.go
无问题。

## backend/internal/handler/batch_handler.go
- [P2][数据丢失] batch_handler.go:207-245 — BatchUpdate 无部分更新兜底：store/batches.go:208-209 恒写 `code/org_node_id/major_id/workflow_id`，请求未携带的 *string 字段以 NULL 覆盖已有值（如仅改批次名称即清空批次编码与组织/专业/工作流关联）；最佳实践：与联盟同类，Update 前先读回、nil 字段回退现有值。
- [P2][租户边界] batch_handler.go:169-172 — claims.TenantID 为空时 tenantID=nil，TenantScoped 表（如课程批次）落库 NULL tenant_id 产生无主记录（上轮已标，未修）；最佳实践：TenantScoped=true 时无租户直接 403。
- [P3][文案] batch_handler.go:102 — `"查询"+EntityName+"es失败"` 中文名后拼英文复数；最佳实践：去掉 "es"。

## backend/internal/handler/brand_import_test.go
无问题。

## backend/internal/handler/cert_grade_handler.go
- [P2][契约不一致] cert_grade_handler.go:87-123 — 无组件/无榜单数据时 `CompData`/`Leaderboard` 为 nil，JSON 输出 `null` 而非 `[]`（上轮已标，未修）；最佳实践：组装前初始化空切片。

## backend/internal/handler/certificate_library_handler.go
- [P3][一致性] certificate_library_handler.go:25-37 — List 缺少与其他 List 一致的显式 claims 检查（靠 listParamsFromRequest 缺租户 403 兜底，功能无误，上轮已标，未修）；最佳实践：入口补 `middleware.CurrentUser(r)==nil → 403`。
- 部分更新兜底（UpdateFn :69-98）实现正确。✔

## backend/internal/handler/certificate_library_handler_test.go
无问题。

## backend/internal/handler/certification_handler.go
- [P1][越权/跨租户引用] certification_handler.go:406-485 — `PutFullRule` 仅校验规则自身租户归属（:417）与 `req.CareerPositionID` 非空（:426-429），**未校验新 careerPositionID 的租户归属**，而 store/certifications.go:570-575 会 `UPDATE certification_rules SET career_position_id=$1`——与 UpdateRule 上轮已修的 P1 完全同类，此处遗漏（同一接口族的全量保存路径同样可把本租户规则改绑到他租户岗位，形成跨租户关联）；最佳实践：与 UpdateRule :213-221 一致，PutFullRule 内补 `PositionTenantID` + `verifyTenantOwnership`。
- [P3][冗余] certification_handler.go:440-443 — `tasks = append(tasks, CertificationTaskRequest(t))` 同类型转换（上轮已标，未修）；最佳实践：直接 append。
- [P3][可读性] certification_handler.go:322-325 — 非 UUID 能力点 ID 用 `uuid.NewSHA1` 派生兼容逻辑无注释（上轮已标，未修）；最佳实践：注释口径来源。
- [P3][错误处理] certification_handler.go:150-153 — FindRuleByPosition 出错（非不存在）时继续执行创建，可能掩盖 DB 错误（上轮已标，未修）；最佳实践：非"不存在"错误走 respondServerError。
- [P3][数据覆盖] certification_handler.go:487-516 — UpdateItem 中 `SortOrder` int 缺省写 0，部分更新重置排序；最佳实践：SortOrder 缺省回退现有值。

## backend/internal/handler/certification_model_handler.go
- [P3][错误处理] certification_model_handler.go:83-110 — GetModel 中岗位不存在返回 200 + 空模型而非 404（FindPositionRule 查不到时 rule=nil、domains 空），与 PutWeights/PutPointLevels 的 404 语义不一致（上轮已标，未修）；最佳实践：先 PositionTenantID 校验岗位存在。
- [P3][错误处理] certification_model_handler.go:176-180 — PutWeights 保存成功后 rule==nil（岗位无规则）时走 respondServerError 且 err 为 nil，500 语义误导；最佳实践：区分"无规则"与"查询失败"。

## 统计

- 审查文件数：22
- 总问题数：31（P0=1，P1=2，P2=10，P3=18）
- 无问题文件：8（affairs_config_import_test / affairs_term_handler / alliance_handler_test / auth_handler_test / batch_configs / brand_import_test / certificate_library_handler_test / certificate_library_handler.go 之外）——严格说无问题文件为：affairs_config_import_test.go、affairs_term_handler.go、alliance_handler_test.go、auth_handler_test.go、batch_configs.go、brand_import_test.go、certificate_library_handler_test.go（7 个）

P0 摘要（1）：
1. ability_domain_handler.go — crud 配置漏配 `TenantFn`，能力域 Get/Update/Delete 全部 404（08-07 租户隔离修复引入，被跳过的集成测试掩盖；已在测试库复现）。功能整体失效，必须修复并补跑测试。

P1 摘要（2）：
1. alliance_crud_handler.go — achievement/expert/agreement/brand 四个实体 CRUD 无部分更新兜底，store 全列覆盖 UPDATE，部分 PUT 清空整行数据（与已修的联盟同类 bug 相同的修复遗漏）。
2. certification_handler.go:406-485 — PutFullRule 不校验 req.CareerPositionID 租户归属，可跨租户改绑认证规则（UpdateRule 已修、PutFullRule 漏修）。
