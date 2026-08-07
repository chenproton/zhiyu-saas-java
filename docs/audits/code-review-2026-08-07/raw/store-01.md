# store 层审查报告 01（31 文件，逐行通读，schema 已对照 backend/migrations）

审查依据：AGENTS.md 分层规范（store 唯一 SQL 层、store 方法应接受 tenantID 参数、禁止越权/跨租户读写）；表结构以 001_baseline.up.sql 及增量 migration 为准。

---

## backend/internal/store/abilities.go
- [P2][性能] abilities.go:128-148 — `CitationStats` 对 position_ability_bindings/node_ability_point_bindings/task_ability_bindings/certification_ability_points 四个关联表做相关子查询 `WHERE pab.ability_point_id = ap.id`，migrations 中这些绑定表只有 `career_position_id`/`task_id` 等索引（001_baseline.up.sql:1748,1810），**没有 ability_point_id 索引**，租户内能力点越多子查询全表扫描越严重；最佳实践：为绑定表补 `ability_point_id` 索引，或改用 LEFT JOIN 聚合一次扫出。
- [P2][性能] abilities.go:151-204 — `ListUncited` 的 COUNT 与 LIST 两条 SQL 均含 4 个 NOT EXISTS 相关子查询（同上无 ability_point_id 索引），全表扫描；最佳实践：同上一并加索引。
- [P3][健壮性] abilities.go:44-47 — `GenerateUniqueEntityCode` 失败时静默回退到 `GenerateEntityCode`（无唯一性保证），而 `ability_points` 无 code 唯一约束（仅 uq_ability_points_tenant_name），极端并发下可产生重复 code；最佳实践：直接返回错误而非静默降级。
- 其余（Get/Create/Update/Delete）均带 `tenant_id` 过滤，无问题。

## backend/internal/store/ability_domains.go
- [P1][越权] ability_domains.go:26-35（Get）与 81-96（fetchDomain）— `Get(ctx, id)` 按 id 查询**无 tenant_id 过滤**；ability_domains 是租户表（ListConfig 声明 TenantScoped=true，migration 001:58 有 tenant_id 列、idx_abilitydomains_tenant 索引），任意登录用户可凭 id 读取他租户能力域；最佳实践：Get 增加 tenantID 参数并 `WHERE id=$1 AND tenant_id=$2`。
- [P1][越权] ability_domains.go:52-64 — `Update` 无租户过滤，`UPDATE ability_domains ... WHERE id = $6` 可改他租户数据；最佳实践：方法签名加 tenantID，WHERE 追加 `AND tenant_id=$n`。
- [P1][越权] ability_domains.go:67-70 — `Delete` 无租户过滤，`DELETE FROM ability_domains WHERE id = $1` 可删他租户数据（且不清理 resource_tags 等关联）；最佳实践：加 tenantID 参数并过滤。
- 注意：Get/Update/Delete 与 ListConfig（TenantScoped）行为不一致，属明显疏漏。

## backend/internal/store/alliance_achievement_store.go
- [P3][数据完整性] alliance_achievement_store.go:70-87 / 89-104 — `CreateAchievement`/`UpdateAchievement` 直接接受并写入 `a.ViewCount`（客户端可控，可清零/伪造阅读数）；最佳实践：view_count 由服务端累加，Create 强制 0、Update 不含该列。
- [P3][健壮性] alliance_achievement_store.go:89-104 — `UpdateAchievement` 不检查 RowsAffected，id 不存在时静默成功；最佳实践：`tag.RowsAffected()==0` 时返回 ErrNotFound。
- 其余（GetByID/Delete/公开查询）均带租户或 is_public+status 限定，无问题。

## backend/internal/store/alliance_agreement_store.go
- [P3][健壮性] alliance_agreement_store.go:72-81 — `UpdateAgreement` 不检查 RowsAffected，id 不存在/跨租户时静默成功；最佳实践：RowsAffected==0 时返回 ErrNotFound。
- 其余均带 `tenant_id` 过滤，无问题。

## backend/internal/store/alliance_brand_store.go
- 无问题（Create/Update/Delete/GetByID 均租户限定；ListPublicBrands 限定 is_public+status）。

## backend/internal/store/alliance_dictionary_store.go
- 无问题（均租户限定）。

## backend/internal/store/alliance_enterprise_store.go
- [P3][性能] alliance_enterprise_store.go:377-384 — `GetPublicStats` 连发 5 条独立 COUNT 查询（非批量），门户每次打点 5 次往返；最佳实践：合并为单条 UNION ALL / 子查询聚合。
- [P3][健壮性] 各 Update/Delete 不检查 RowsAffected，跨租户 id 静默成功（与 alliance 模块风格一致，列为低优先级）。
- 其余均租户限定，无问题。

## backend/internal/store/alliance_expert_store.go
- 无问题（Create/Update/Delete/GetByID 均租户限定；公开查询限定 is_public+status）。

## backend/internal/store/alliance_permission_store.go
- 无问题（Create/Update/Delete 均租户限定；GetPermissionByID 在 alliance_store.go 中也带租户）。

## backend/internal/store/alliance_project_store.go
- [P1][越权] alliance_project_store.go:197-200 — `DeleteMilestone` 签名接收 `tenantID` 但 SQL 只用 `WHERE id = $1`，**tenantID 未使用**；与同文件 `GetMilestoneByID`(174)/`UpdateMilestone`(192)（均 `AND tenant_id=$n`）不一致，可凭 id 删除他租户里程碑；最佳实践：WHERE 追加 `AND tenant_id = $2` 并传参。
- [P3][健壮性] alliance_project_store.go:114-125 — `UpdateProject` 不检查 RowsAffected，跨租户 id 静默成功；最佳实践：RowsAffected==0 返回 ErrNotFound。
- 其余（项目 CRUD/公开查询）均租户限定，无问题。

## backend/internal/store/alliance_store.go
- [P1][逻辑 bug/必 500] alliance_store.go:55-73 — `UpsertSchoolInfo` 的 `nilToEmpty`（71-73）是**空操作**（原样返回入参），而 SQL 用 `COALESCE($1, gen_random_uuid())`；当 `info.ID` 为空字符串（handler 解码客户端 body，新建学校信息时客户端不带 id，见 alliance_handler.go:UpdateSchoolInfo）时 COALESCE 返回 `''`，`''::uuid` 转换失败 → INSERT/EXCLUDED 元组求值报错 → 500，新建学校信息必失败；最佳实践：`nilToEmpty` 应返回 `nil`（或 SQL 用 `COALESCE(NULLIF($1,''), gen_random_uuid())`）。
- [P2][越权] alliance_store.go:105-118 — `ListEnterpriseAgreements` 仅按 `enterprise_id` 过滤，无 tenant_id；enterpriseID 来自请求时若调用方未先校验归属，可跨租户读协议列表；最佳实践：加 tenantID 参数并 `AND tenant_id=$n`。
- [P2][越权] alliance_store.go:120-126 — `ListMilestones` 仅按 `project_id` 过滤，无 tenant_id；同上风险；最佳实践：加 tenantID 参数并过滤。
- [P2][错误处理] alliance_store.go:78-86 — `queryList` 用 `items, _ := scan(rows)` **吞掉行扫描错误**（注释声明与旧行为一致），扫描失败时静默返回部分/空列表，无任何日志；最佳实践：至少记录日志或返回错误（不建议静默吞错）。
- 其余无问题。

## backend/internal/store/approvals.go
- [P2][越权] approvals.go:75-84 与 187-204 — `Get`/`fetchApproval` 按 id 查询无 tenant 过滤（approval_records 是租户表，TenantScoped=true）；handler 若未先校验租户归属即可读他租户审批记录；最佳实践：Get 加 tenantID 参数并过滤。
- [P2][越权] approvals.go:127-136 / 139-148 / 151-160 — `UpdateHistory`/`RejectRecord`/`AdvanceRecord` 均只按 `id` 过滤（CAS 仅防并发，不防越权），任一调用路径漏校验即跨租户操作审批；最佳实践：统一增加 tenantID 参数。
- [P3][边界] approvals.go:115-124 — `ExistsPending` 无租户过滤，若两个租户恰有相同 target_id（低概率，uuid 全局唯一）会误判存在；影响极小，可容忍。
- [P3][健壮性] approvals.go:88-112 — `Create` 中 `p.Status == pending` 时先查后插，唯一索引 uq_approval_records_target_pending（112 迁移）兜底，并发下依赖索引报错而非优雅处理；简单优先原则下可容忍。
- 无问题：SyncEntityStatus 白名单+参数化+租户过滤，测试完备。

## backend/internal/store/approvals_test.go
- 无问题（映射一致性/注入拒绝/租户参数均有覆盖）。

## backend/internal/store/auth.go
- [P3][健壮性] auth.go:49-56 — `FindUsersByUsername` 扫描失败时 `continue` 静默跳过该登录候选行（登录时若某行字段损坏，用户被静默剔除出候选列表，无日志）；最佳实践：记录日志或返回错误。
- [P3][错误处理] auth.go:163-184 / 187-201 / 204-216 — `GetTenantByID`/`GetOrganizationByID`/`GetMajorByID` 出错时返回 `nil`（吞错），调用方若不解 nil 即解引用 → 500；最佳实践：返回 (nil, error) 由调用方处理。
- [P3][错误处理] auth.go:219-243 — `ListUserRoles` 出错返回 nil（吞错），且行扫描失败 `continue` 静默丢角色；最佳实践：返回 (nil, error)。
- 无问题：登录查询 JOIN tenants 带租户名、UpdateLastLogin/RecordLoginLog 无返回值设计合理。

## backend/internal/store/banners.go
- 无问题（Get/Create/Update/Delete 均租户限定，isEnabled 参数化布尔）。

## backend/internal/store/batch_configs.go
- 无问题（纯配置+行扫描，列与白名单一致）。

## backend/internal/store/batches.go
- [P2][越权] batches.go:204-220（UpdateFields）/223-229（Delete）/232-238（UpdateStatus）— 均无 tenant 过滤，仅靠调用方先 `TenantOf()` 校验（147-154 提供了该校验入口，说明设计如此）；一旦任一 handler 漏调 TenantOf 即跨租户写；最佳实践：把这些方法统一改为要求传入 tenantID 并 `AND tenant_id=$n`（或提供带租户的变体），把校验内聚进 store。
- [P2][越权] batches.go:40-53 — `GetByTable` 无租户过滤（依赖调用方校验），同上风险；最佳实践：加 tenantID 参数。
- [P3][健壮性] 上述 Update/Delete 均不检查 RowsAffected，id 不存在时静默成功；最佳实践：返回 RowsAffected 或 ErrNotFound。
- 无问题：表/列名白名单 SanitizeIdentifier 校验到位，参数化拼接正确。

## backend/internal/store/cert_grades.go
- [P3][越权风险] cert_grades.go:36-42 / 73-80 / 108-116 — `ListGrades`/`ListCompRequirements`/`ListLeaderboard` 均无 tenant 过滤（按 positionID/gradeIDs 查）；该 store 为只读聚合，且调用方有 `PositionTenantID`(19-23) 校验入口，岗位 uuid 不可猜测，风险中低；最佳实践：增加 tenantID 参数由调用方传入。
- [P3][错误处理] cert_grades.go:88 / 124 — 行扫描失败 `continue` 静默丢弃行（能力要求/排行榜条目缺失无日志）；最佳实践：返回错误。
- [P3][信息损失] cert_grades.go:51-55 — `last_updated` 为 timestamptz，格式化为 `2006-01-02` 仅保留日期；若前端需精确时间则丢失精度；若产品按日展示可容忍。

## backend/internal/store/certificate_library.go
- [P3][越权风险] certificate_library.go:18-20 — 嵌入 DictStore 的 `CreateSQL/GetByIDSQL/DeleteSQL` 基础版**无租户过滤**（`WHERE id=$1`）；本类型已用外层 GetByID/Update/Delete（59-91）覆盖了查询/删除路径故当前安全，但后续若误用 `s.DictStore.GetByID/Delete` 即跨租户；最佳实践：基类 SQL 直接写租户过滤，或禁止暴露基础版。
- [P3][设计] certificate_library.go:47-56 — `URL` 为非指针 string + `NULLIF($2,'')`：无法区分"未传"与"清空"，空字符串无法清空 url（保留旧值）；若需支持清空应改 *string。
- 其余（CitationStats/ListUncited 与 abilities.go 同类，引用表 position_certificates 关联仅一表，索引 idx_position_certificates？baseline 未建 ability_point 类索引问题较轻）无问题。

## backend/internal/store/certifications.go
- [P3][越权风险] certifications.go:75-84（GetRule）、148-166（ListItems）、220-238（ListPoints）、362-415（ListFullItems/ListFullPoints）、418-436（ListTasksByPointIDs）— 均按 id/ruleID/itemID 无租户查询；上游 FindRuleByPosition/CreateRule 等已租户限定（87-95、98-109），约定调用方先校验归属；最佳实践：统一补充 tenantID 参数。
- [P3][越权风险] certifications.go:440-514 — `fetchRule/fetchItem/fetchPoint/fetchTask` 的 tenantID="" 分支（449-452/468-471/487-490/506-509）提供无租户读取通道；与 GetItem/GetPoint(169-175/241-247) 的"非空才限定"语义一致但易误用；最佳实践：去掉空串分支，全部强制租户。
- [P3][逻辑] certifications.go:815-822（LoadModel 步骤 2a）— 直接关联查询 `s.career_position_id=$1` 未过滤 `s.tenant_id`（步骤 2 有 `m.tenant_id=$2`），也未过滤场景状态，draft 场景任务会进入能力模型；岗位 id 全局唯一故无跨租户泄露，但建议补 `s.tenant_id` 与状态条件保持一致性。
- [P3][并发] certifications.go:98-109 — `CreateRule` 无 ON CONFLICT，`uq_certification_rules_position UNIQUE(career_position_id)`（001:1607）下并发创建会唯一冲突 500；最佳实践：调用方先 FindRuleByPosition（当前语义已有），可接受。
- [P3][越权风险] certifications.go:656-674 — `PutWeights` 中 `DELETE FROM certification_weights WHERE rule_id=$1` 无租户过滤，ruleID 已在同事务内租户限定查询取得，实际安全；可容忍。
- 无问题：PutFullRule 事务完整、非法能力点 UUID 跳过有注释、LoadModel 权重/均分逻辑正确（splitEvenly 余数补给第一位）。

## backend/internal/store/citation_stats.go
- 无问题（纯 SQL 片段与固定分桶组装，逻辑正确）。

## backend/internal/store/community.go
- [P3][越权风险] community.go:184-209 — `ListReplies` 仅按 `topic_id` 过滤无 tenant；上游 GetTopic(135-156) 已租户校验，风险低；最佳实践：加 tenantID 参数。
- [P3][健壮性] community.go:161-168 — `CreateReply` 中 `$4::uuid` 若 parentID 为非法 UUID 字符串会 cast 报错 → 500（依赖 handler 预校验）；最佳实践：store 内先做 uuid 解析或让 handler 校验后传入。
- 无问题：CreateReply 的帖子归属+父评论同帖校验到位（159-173），ListTopics 租户+作者过滤正确，LIMIT/OFFSET 参数序号按分支正确拼接（99-102）。

## backend/internal/store/content_actions.go
- [P2][越权] content_actions.go:94-138（Transition）/141-157（Review）/160-176（Invite）— 均只按 `id` 操作无 tenant 参数，依赖调用方先 `GetTenantID`(65-76) 校验归属；作为全系统内容实体的公共入口，任一 handler 漏校验即跨租户状态流转/审核/邀请；最佳实践：方法增加 tenantID 参数并在 WHERE 中过滤（或强制调用方传入 GetTenantID 结果）。
- [P3][健壮性] content_actions.go:169-172 — `Invite` 的 `ARRAY[$1]::uuid[]`，userID 非法时 cast 报错 → 500（依赖 handler 校验）。
- [P3][死代码] content_actions.go:24-31 与 content_actions_test.go:10-17 — 状态流转矩阵在实现与测试中各声明一份（transitionMatrix 为测试副本），易漂移（当前一致）；最佳实践：测试直接引用 `allowedStatusTransitions`。
- 无问题：Transition 的 CAS（113-119）+ 撤回审批清理 + 事务 hook 设计正确，表/列名白名单到位。

## backend/internal/store/content_actions_test.go
- 无问题（矩阵、注入、翻页钳制均有覆盖；与 content_actions.go:24-31 的矩阵重复见上条）。

## backend/internal/store/course_assessments.go
- [P3][越权风险] course_assessments.go:76-79（UpdateNodeEvalData）、82-92（FindNodeUsage）、96-114（CreateNodeUsage）、167-175（UpdateUsageWindow）、178-182（NodeHomeworkExists）、185-198（CreateNodeHomework）— 均无租户过滤（按 nodeID/examID/usageID），设计依赖调用方在课程发布事务内已确认归属；最佳实践：加 tenantID 参数。
- [P3][错误处理] course_assessments.go:201-213 — `CleanupCourseLevelAssessments` 两处 `_, _ = q.Exec(...)` 吞错，删除失败无感知；最佳实践：返回 error。
- [P3][数据可见性] course_assessments.go:241-248 — `ListCourseExamUsages` 用 `JOIN exams e`（inner join），临时考试被删则该安排从列表消失；是否可接受取决于产品，建议 LEFT JOIN。
- 无问题：CreateTempExam 的复用逻辑（119-141）正确规避 25P02；ON CONFLICT 目标与 096/098 唯一索引匹配。

## backend/internal/store/course_clone.go
- [P2][越权] course_clone.go:82-116 — `CloneCourse` 不校验源课程 `oldCourseID` 的租户归属（tenantID 参数仅用于新行），若调用方漏校验，可将他租户课程结构克隆进本租户（跨租户数据复制）；`FetchSource`(52-77)/`FetchCourse`(527-558) 亦无租户过滤；最佳实践：CloneCourse/FetchSource 增加源课程租户校验（如旧课程 tenant 不匹配直接报错）。
- [P3][数据一致性] course_clone.go:132-138 / 159-165 — `cloneCourseBindings` 行扫描失败 `continue` 静默丢行（其余 clone 函数均 return err），绑定静默缺失导致克隆不完整且无日志；最佳实践：与其余函数一致返回错误。
- 无问题：事务内读（tx.Query）防穿透、nodeIDMap 父子映射正确、子表批量按 ANY($1) 查询避免 N+1、课程 status 固定 'draft' 合理。

## backend/internal/store/course_homeworks.go
- [P2][错误处理] course_homeworks.go:177-188 — `scanHomeworkSubmissions` 行扫描失败 `continue` 静默丢弃提交记录（成绩列表缺项，教师看不到部分学生提交且无日志）；最佳实践：返回错误并中止。
- 无问题：提交/批改均租户+父实体双限定，ON CONFLICT 与 096/098 唯一索引匹配，批改事务内同步评价结果正确。

## backend/internal/store/course_nodes.go
- [P2][数据一致性] course_nodes.go:180-183 — `Delete` 只删 `system_course_nodes` 一行，不清理 `node_knowledge_point_bindings`/`node_resource_bindings`/`node_quizzes`(+questions)/`node_homeworks`(+submissions)/`hybrid_node_modules`/`node_evaluation_results` 等子表（这些表无 ON DELETE CASCADE），删节点后产生孤儿数据；最佳实践：事务内级联清理。
- [P3][越权风险] course_nodes.go:186-196 — `Reorder` 无租户过滤（依赖 courseID 已校验）；可接受。
- [P3][校验缺失] course_nodes.go:111-138 — `Create` 不校验 `parent_id` 是否同租户/同课程节点；可提交他租户节点为父；最佳实践：校验 parent 归属。
- [P3][错误处理] course_nodes.go:383-397 — `scanCourseNodeBaseRows` 返回 `rows.Err()` 被忽略（return nil），查询中途错误被吞；最佳实践：返回 rows.Err()。
- 无问题：Update 先校验后写、fetchNodeWith 支持事务内读取、批量 ANY 查询避免 N+1。

## backend/internal/store/courses.go
- [P2][数据一致性] courses.go:133-161 — `Delete` 清理了 submissions/homeworks/eval_results 与排课/人培/教学计划解绑，但**未清理**：`exam_usages`(target_type='course')、`system_course_nodes` 及其全部子表、`course_knowledge_bindings`/`course_resource_bindings`、`approval_records`(target=course)、view_counters 等关联数据；删课程后遗留孤儿考试安排/节点/审批；最佳实践：事务内补齐级联清理（可复用 course_clone 的节点子表清单）。
- [P3][健壮性] courses.go:114-130 — `Update` 中 `resource_count = COALESCE(array_length($23::uuid[],1),0)`：`$23`（resource_ids）含非 UUID 字符串时 cast 报错 → 500（依赖 handler 校验）；最佳实践：store 内先解析/过滤非法 id。
- [P3][错误处理] courses.go:318-334 — `ScanCourseRows` 返回 `rows.Err()` 正确；无问题。fetchCourse/fetchCourseScoped 双版本语义明确（GetUnscoped 注释说明用途）。
- 无问题：Create/Update/Delete 租户限定；SyncKnowledgePointGranularLessons 的 array_append/array_remove 幂等逻辑正确。

## backend/internal/store/dict_store.go
- [P1][越权模式风险] dict_store.go:56-85 — 基类 `GetByID/Update/Delete` **全部无租户过滤**（SQL 为配置注入，本清单内 certificate_library.go:19-20 的 GetByIDSQL/DeleteSQL 即 `WHERE id=$1`），嵌入方若不覆盖即跨租户读写；本清单内 certificate_library/learn_roads 已覆盖租户版本，但 roles.go:61（Delete）、staff_titles.go:51（UpdateStatus）等嵌入方直接暴露基类无租户方法；最佳实践：基类强制租户参数（DictConfig 增加租户列配置，GetByID/Update/Delete 自动拼 `tenant_id`），嵌入方不再各自覆盖。
- [P3][文档耦合] dict_store.go:23-24 — 注释声明"GetByIDSQL/SelectColumns 列序必须与 T 字段序一致"，一旦改表/改结构会静默错列或扫描失败，无编译期保障；可接受但建议测试覆盖。
- 其余（Create 参数化正确）无问题。

## backend/internal/store/entity_code.go
- [P3][健壮性] entity_code.go:42-53 — 仅 10 次重试，之后返回错误由调用方决定降级（abilities.go:44-47 直接静默回退非唯一编码）；无 DB 唯一约束兜底时重复 code 无感知；最佳实践：调用方记录日志或重试更优雅。
- 无问题：表名白名单校验防注入，查询参数化。

---

# 汇总

- 审查文件数：31
- 问题总数：43（P1×4，P2×12，P3×27）

## P0
无。

## P1 摘要
1. ability_domains.go:26-70 — Get/Update/Delete 无 tenant_id 过滤，跨租户读写删能力域（与 ListConfig TenantScoped 矛盾）。
2. alliance_project_store.go:197-200 — DeleteMilestone 接收 tenantID 但 SQL 未使用，可跨租户删除里程碑。
3. alliance_store.go:55-73 — nilToEmpty 为空操作，UpsertSchoolInfo 空 ID 时 `''::uuid` 必 500，新建学校信息必失败。
4. dict_store.go:56-85 — 基类 GetByID/Update/Delete 无租户过滤，嵌入方不覆盖即跨租户读写（证书库已覆盖，roles/staff_titles 等未覆盖）。

## P2 摘要
1. abilities.go:128-148 — CitationStats 关联表缺 ability_point_id 索引，相关子查询全表扫描。
2. abilities.go:151-204 — ListUncited 4 个 NOT EXISTS 子查询同缺索引。
3. alliance_store.go:105-126 — ListEnterpriseAgreements/ListMilestones 无租户过滤（父 id 维度）。
4. alliance_store.go:78-86 — queryList 吞行扫描错误，列表静默缺项。
5. approvals.go:75-204 — Get/UpdateHistory/RejectRecord/AdvanceRecord 无租户过滤。
6. content_actions.go:94-176 — Transition/Review/Invite 无租户参数，公共入口依赖调用方校验。
7. batches.go:40-238 — GetByTable/UpdateFields/Delete/UpdateStatus 无租户过滤（依赖 TenantOf 前置校验）。
8. course_clone.go:82-116 — CloneCourse 不校验源课程租户归属，可跨租户复制课程结构。
9. course_homeworks.go:177-188 — scanHomeworkSubmissions 扫描失败静默丢行。
10. course_nodes.go:180-183 — Delete 不清理节点子表，产生孤儿数据。
11. courses.go:133-161 — Delete 不清理 exam_usages/system_course_nodes/审批等关联，遗留孤儿数据。
12. certification.go:815-822 — LoadModel 2a 查询无 tenant_id/状态过滤（岗位 uuid 全局唯一，实际无泄露，列为一致性）。
