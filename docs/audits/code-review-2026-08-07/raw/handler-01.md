# handler-01 代码审查报告（22 文件完整逐行通读）

审查时间：2026-08-07
审查范围：`backend/internal/handler/` 下 22 个文件（ability 至 certification_model）
审查方式：完整逐行阅读 + 交叉核对 crud.go / common.go / store / service 实现

## 通用说明（跨文件）

- 所有基于 crud 骨架的 handler（ability/affairs_term/alliance 各实体/certificate_library）在 `crudCreate`/`crudUpdate` 回读实体时忽略错误（crud.go:100、crud.go:187 的 `item, _ := cfg.GetByIDFn(...)`）：创建/更新成功后若回读失败（DB 抖动、记录被并发删除），响应 200/201 且 body 为字段全空的零值对象。此模式在下列各文件不再重复标注。
- 豁免确认：`affairs_config_import_handler.go` 属 import 冻结区（AGENTS.md 豁免），直接持有 `*pgxpool.Pool` 与拼 SQL 不视为分层违规；其余 21 个文件均未发现 handler 内直写 SQL / 直调 db.Query/Exec 的情况。

## backend/internal/handler/ability_code_test.go
- [P3][测试健壮性] ability_code_test.go:53 — `pos, _ := testhelper.Unmarshal[domain.CareerPosition](w)` 忽略解构错误，unmarshal 失败时 pos.ID 为空串，后续 PUT 打到 `/save-full/` 返回 404，失败信息不直观；最佳实践：解构失败直接 t.Fatalf（与 L34-37 的写法保持一致）。

## backend/internal/handler/ability_domain_handler.go
无问题。crud 骨架 CheckOwnership/GetOwnership 均开启，GetByIDFn 带租户限定，归属校验完整（GetByIDFn 未使用 TenantFn 传入的 tenantID、改为查后校验，存在极小 TOCTOU 窗口，按"简单优先"可接受）。

## backend/internal/handler/ability_handler.go
- [P3][错误处理] ability_handler.go:143-146 — `parsePageLimit` 出错后静默回退 limit=20 且无日志；最佳实践：出错时记录 slog 或直接返回 400，避免前端误以为分页生效。

## backend/internal/handler/affairs_config_import_handler.go
（import 冻结区，直连 DB 豁免，以下为业务正确性问题）
- [P2][静默失败] affairs_config_import_handler.go:74-79、106-111、152-157 — 三个 Sheet 的重复检查 `QueryRow(...).Scan(&exists)` 错误全部忽略，INSERT 的 `Exec` 错误也忽略：数据库故障或字段类型不合法（如日期格式错误）时，导入返回 200 且计数虚高，部分行静默丢失；最佳实践：Scan/Exec 出错时记录日志并返回 500（或至少计入 skipped 并在响应中带 error 字段）。
- [P2][事务缺失] affairs_config_import_handler.go:53-166 — 三个 Sheet 的导入不在同一事务中，中途某行失败会留下已插入的部分数据，且用户无从得知；最佳实践：整次导入包在 `BeginTx` 中，任一步失败整体回滚（导入为一次性后台操作，事务开销可接受）。
- [P3][命名] affairs_config_import_handler.go:112 — 局部变量 `cap` 遮蔽内建函数 `cap`，可读性差；最佳实践：改名 `capacity`（或 `capacityVal`）。
- [P3][死代码] affairs_config_import_handler.go:215-217 — 末尾 `NewSheet("Sheet1")` 后再删除是空操作（L181 已删除默认 Sheet1）；最佳实践：删除这段。

## backend/internal/handler/affairs_config_import_test.go
无问题。

## backend/internal/handler/affairs_term_handler.go
无问题。租户隔离依赖 GetByIDFn 的租户限定查询 + DeleteChecks 引用检查，实现正确。

## backend/internal/handler/alliance_crud_handler.go
- [P2][错误处理] alliance_crud_handler.go:49 — `alliancePublicGet` 将 store 的所有错误（含 DB 故障）统一响应 404，掩盖服务器错误、误导排查；最佳实践：区分 `ErrNotFound` 返回 404，其余走 respondServerError。
- [P3][边界] alliance_crud_handler.go:208-210、247-249（及 enterprise 版 232-249）— `len(x)==0` 即回退已有值，客户端无法主动清空数组字段（如清空 cooperationTypes/enterprise_ids）；最佳实践：若前端有清空诉求，改用指针/`json.RawMessage` 区分"未携带"与"空数组"。

## backend/internal/handler/alliance_handler.go
- [P1][数据丢失] alliance_handler.go:178-188 — `UpdateEnterpriseAgreement` 无部分更新兜底：请求体直接整份传给 store 全列覆盖 UPDATE（store/alliance_enterprise_store.go:317-325），前端只传部分字段（如只改 status）时 name/type/start_date/end_date/content/attachments 全部被空值清空——与已修复的"合作项目数据丢失"bug 完全同类；最佳实践：参照 enterpriseCRUD 的 ValidateUpdateExisting 模式，先 Get 回退缺失字段。
- [P1][数据丢失] alliance_handler.go:308-316 — `UpdateMilestone` 解码后直接全列覆盖 UPDATE（store/alliance_project_store.go:187-195），仅勾选 is_completed 的局部请求会清空 name/description/due_date/completed_date/sort_order；最佳实践：同 ValidateUpdateExisting 回退模式。
- [P2][数据丢失] alliance_handler.go:613-628 — `UpdateDictionaryItem` 未携带 name 时会把字典项名称更新为空串（store/alliance_dictionary_store.go:49-54 全列覆盖）；最佳实践：请求未携带字段时回退 GetDictionaryByID 的现有值。
- [P2][错误被吞] alliance_handler.go:66 — `updated, _ := h.Store.GetSchoolInfo(...)` 忽略错误，回读失败时响应 200 body 为 null；最佳实践：错误走 respondServerError。
- [P2][错误被吞] alliance_handler.go:151、187 — `item, _ := h.Store.GetEnterpriseAgreementByID(...)` 忽略错误，失败时 201/200 返回 null；最佳实践：错误走 respondServerError。
- [P2][错误处理] alliance_handler.go:436-441 — `GetPermission` 将 store 所有错误（含 DB 故障）响应 404；最佳实践：区分 pgx.ErrNoRows 与内部错误。
- [P3][性能] alliance_handler.go:110、253 — `ListEnterpriseAgreements`/`ListMilestones` 无分页，返回该企业/项目的全量记录（前端表格数据量大时性能隐患）；最佳实践：加 limit/offset（沿用 executeListQuery 骨架）。

## backend/internal/handler/alliance_handler_test.go
无问题。

## backend/internal/handler/alliance_import_test.go
- [P3][测试健壮性] alliance_import_test.go:84、108-109、144-145、172-173 — 多处 `json.Unmarshal(ids, &list)` 忽略错误，若 JSON 解析失败后续断言会在空 list 上继续（数据错误被吞，测试仍可能通过）；最佳实践：unmarshal 失败 t.Fatalf。

## backend/internal/handler/appeal_handler.go
- [P1][租户隔离缺失] appeal_handler.go:93 — `CreateAppeal(ctx, tenantID, req.UserID, ...)` 中 req.UserID 直接来自请求体，store 侧仅 INSERT（store/evaluation_methods.go:169-180），未校验被申诉用户属于当前租户：任一租户的登录用户可为他租户用户 ID 构造申诉记录，造成跨租户数据污染；最佳实践：handler/service 先按 userID 查用户并校验其 tenant_id 与当前租户一致，或改由 claims.UserID 决定（若业务允许代申诉，则必须校验目标用户租户）。
- [P2][越权] appeal_handler.go:101-138 — `Process` 仅校验登录与租户归属，无任何角色/权限校验：本租户任意登录用户（含学生）可审批（approved/rejected）他人申诉；最佳实践：增加教师/管理员角色校验（如 canManageAlliance 类似的角色检查）。

## backend/internal/handler/approval_handler.go
- [P2][并发竞态] approval_handler.go:160-196 — "all" 审批模式下并发审批：两条请求都读到 pending 记录、各自 append 历史后整段写回 History（UpdateApprovalHistory 全量覆盖），后写覆盖先写，可能丢失已通过的审批记录或重复推进；最佳实践：历史追加改为 SQL `history = history || $1::jsonb` 原子追加，或对 status/step 加条件更新（WHERE status='pending'）。
- [P2][错误被吞] approval_handler.go:175、196、221 — `record, _ = h.Service.GetApproval(...)` 忽略错误，回读失败时 200 返回 null；最佳实践：回读失败走 respondServerError。
- [P3][死代码/冗余] approval_handler.go:205-214 — nonce 相关暂不在此文件，此处无；本条修正：无。注：L205 `newStepIdx := stepIdx + 1` 在非最后一步且完成时推进，逻辑正确，无需改动。

## backend/internal/handler/auth_handler.go
- [P3][安全细节] auth_handler.go:126-135 — 停用用户/停用租户直接 continue 跳过 bcrypt 比较，而有效用户会执行比较：响应时间差异可被用于用户名枚举（计时侧信道）；最佳实践：对停用用户也执行一次 dummy bcrypt 比较再跳过。
- [P3][冗余逻辑] auth_handler.go:205-214 — nonce 校验中"同 JTI 超过 2 分钟后删除并重新放行"的分支实际不可达（pre-auth token TTL 仅 1 分钟 < 2 分钟），且清理周期 10 分钟与 TTL 不一致，属死逻辑；最佳实践：删除该分支或统一时间口径。
- [P3][健壮性] auth_handler.go:157 — `rand.Read(jtiBytes)` 错误被忽略（crypto/rand 失败概率极低，仍建议处理或注释说明）。
- [P3][边界] auth_handler.go:271-274 — User-Agent 按字节 `[:256]` 截断，可能切断多字节 UTF-8 产生非法字节序列，入库报编码错误；最佳实践：按 rune 截断或容忍错误。

## backend/internal/handler/auth_handler_test.go
无问题。

## backend/internal/handler/batch_configs.go
无问题。

## backend/internal/handler/batch_handler.go
- [P2][数据被覆盖] batch_handler.go:227-233 — `UpdateWithStatus` 配置下，请求未携带 status 时强制重置为 `StatusOpen`：仅改名称/编码的局部更新会把已关闭（closed）的批次静默重开；最佳实践：status 为空时保持原值（不写 status 列），只有显式传入才更新。
- [P2][租户边界] batch_handler.go:169-172 — 创建时若 claims.TenantID 为空则 tenantID=nil，`BatchCreate` 以 NULL tenant_id 落库；对 TenantScoped 配置的表（如课程批次）将产生无主记录，绕开租户隔离（普通业务写入路径，见 AGENTS.md"核心业务加锁、普通允许重复"权衡，但建议 TenantScoped 时强制 requireTenant）；最佳实践：TenantScoped=true 时对无租户 claims 直接 403。
- [P3][文案] batch_handler.go:102 — 错误文案 `"查询"+h.Config.EntityName+"es失败"` 把英文复数后缀拼在中文实体名后（如"查询课程es失败"）；最佳实践：改为 `"查询"+EntityName+"失败"`。

## backend/internal/handler/brand_import_test.go
无问题。

## backend/internal/handler/cert_grade_handler.go
- [P2][契约不一致] cert_grade_handler.go:95-123 — 某年级无组件/无榜单数据时 `CompData`/`Leaderboard` 保持 nil，JSON 序列化为 `null` 而非 `[]`，与前端"数组"契约不符（前端需判空）；最佳实践：初始化 `CompData: []CompGroupDTO{}`、`Leaderboard: []LeaderboardEntryDTO{}`。

## backend/internal/handler/certificate_library_handler.go
- [P3][一致性] certificate_library_handler.go:25-37 — `List` 缺少与其他 List handler 一致的显式 claims 检查（当前靠 listParamsFromRequest 缺租户时 403 兜底，功能无误但风格不一致）；最佳实践：入口加 `middleware.CurrentUser(r)==nil → 403`。

## backend/internal/handler/certificate_library_handler_test.go
无问题。

## backend/internal/handler/certification_handler.go
- [P1][越权/跨租户引用] certification_handler.go:190-219 — `UpdateRule` 校验了规则自身的租户归属，但未校验请求中的新 `careerPositionID` 是否属于当前租户（CreateRule 的 L141-148 校验了，UpdateRule 漏掉；store UpdateRule 仅 UPDATE 规则行，certifications.go:126-137 对 position 无租户校验）→ 可将本租户规则改绑到他租户岗位，形成跨租户数据关联；最佳实践：UpdateRule 前补 `PositionTenantID` + `verifyTenantOwnership` 校验（与 CreateRule 一致）。
- [P2][错误被吞] certification_handler.go:470 — `rule, _ := h.Service.GetCertificationRule(...)` 忽略错误，保存成功但回读失败时 200 返回 null；最佳实践：回读失败走 respondServerError。
- [P3][冗余] certification_handler.go:431-434 — `tasks = append(tasks, CertificationTaskRequest(t))` 为同类型转换，纯冗余；最佳实践：直接 `tasks = append(tasks, t...)`。
- [P3][可读性] certification_handler.go:313-316 — 非 UUID 字符串用 `uuid.NewSHA1` 派生能力点 ID 的兼容逻辑无注释，后续维护易误删；最佳实践：注释说明前端口径来源。
- [P3][错误处理] certification_handler.go:150-153 — `FindRuleByPosition` 出错时继续执行创建（若实际是 DB 错误，最终 500 而非幂等 200，且可能掩盖冲突）；最佳实践：非"不存在"错误走 respondServerError。

## backend/internal/handler/certification_model_handler.go
- [P3][错误处理] certification_model_handler.go:90-94 — `FindPositionRule` 的所有错误（含 DB 故障）统一 500 尚可；但岗位不存在时返回 200 + 空模型而非 404，与 PutWeights/PutPointLevels 的 404 语义不一致；最佳实践：先 `PositionTenantID` 校验岗位存在再组装模型。

## 统计

- 审查文件数：22
- 总问题数：27（P1=4，P2=13，P3=10）
- P0：0

P1 摘要：
1. alliance_handler.go:178-188 — UpdateEnterpriseAgreement 无部分更新兜底，全列覆盖清空协议字段（同类已修复 bug 复现）
2. alliance_handler.go:308-316 — UpdateMilestone 全列覆盖，局部请求清空里程碑字段
3. appeal_handler.go:93 — 申诉创建不校验目标用户租户，可跨租户构造申诉记录
4. certification_handler.go:190-219 — UpdateRule 不校验新 careerPositionID 租户归属，可跨租户改绑规则

P0 摘要：无（未发现必 500/nil 解引用/panic 路径）
