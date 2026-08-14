# 前后端全量代码问题清单

> 由 1163 个源文件的逐文件完整审查报告聚合生成（审查规范见 docs/code-review/REVIEW-GUIDE.md，逐文件勾选进度见 docs/code-review/checklist.md）。

## 聚合统计

| 级别 | 数量 |
|---|---|
| P0 安全/数据损坏 | 1 |
| P1 性能/稳定性 | 74 |
| P2 维护性/复用 | 639 |
| 复用候选条目 | 211 |

## 问题明细（按批次报告）

### report-001-002.md

# 代码审查报告 batch 001-002（backend）

- 审查依据: docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，39 个文件共 5183 行）
- 审查范围: /tmp/batches/001-backend.json（21 文件）+ /tmp/batches/002-backend.json（18 文件）
- 结论: P0 = 0，P1 = 0，P2 = 5，复用候选 = 2
- 方法: 每个文件用 read 工具完整逐行阅读；关键跨文件事实（路由鉴权、缓存键租户隔离、crud 框架调用、迁移文件定界符用法、测试覆盖）均已用 grep/read 核实

---

## `backend/cmd/backfill-geo/main.go`（74 行）
- 完整逐行检查：完成
- 未发现问题（一次性回填脚本，幂等可重复执行；全表载入内存 + 逐条 UPDATE 属维护工具可接受的慢，不报）

## `backend/cmd/migrate/main.go`（303 行）
- 完整逐行检查：完成
- [P2] L230-254: splitSQLStatements 仅识别 `$$` 定界符（L235/L240），不识别 `$tag$` 定界符，也不处理字符串字面量内的分号；若未来迁移文件包含带 `$func$...$func$` 标签的 PL/pgSQL 函数体，函数体内的分号会被当作语句边界切碎，导致迁移执行失败。当前仓库 migrations 仅用 `$$`（已核实 4 处），暂未触发，属潜在风险（最佳实践: 支持 `$tag$` 解析或在切分前校验）

## `backend/cmd/seed/main.go`（131 行）
- 完整逐行检查：完成
- 未发现问题（种子/密码重置脚本；L49/L64 忽略 EXISTS 查询错误的影响可容忍，不报）

## `backend/cmd/server/main.go`（91 行）
- 完整逐行检查：完成
- 未发现问题（优雅关闭、ReadTimeout/WriteTimeout/IdleTimeout 合理）

## `backend/internal/ai/client.go`（140 行）
- 完整逐行检查：完成
- 未发现问题（整体超时 60s、响应体限 4MB、上游错误只透传 error.message 不透传原始 body、apiKey 仅入 Authorization 头不落日志）

## `backend/internal/ai/client_test.go`（121 行）
- 完整逐行检查：完成
- 未发现问题（成功/尾斜杠/上游错误/非 JSON 错误四类场景覆盖良好）

## `backend/internal/cache/cache.go`（41 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/cache/key.go`（68 行）
- 完整逐行检查：完成
- 未发现问题（已核实公开岗位列表 PublicList 使用固定 PublicListConfig、角色无关，缓存键缺角色段不构成越权；租户取自 JWT claims，公开路由均在 auth 中间件内，无匿名跨租户串缓存风险）

## `backend/internal/cache/middleware.go`（157 行）
- 完整逐行检查：完成
- 未发现问题（SCAN 游标失效、缓存写入独立超时、限流失败回退放行、XFF 伪造仅影响自身等设计合理）

## `backend/internal/config/config.go`（50 行）
- 完整逐行检查：完成
- 未发现问题（AISecret 缺省回落 JWT_SECRET 有注释说明，属设计取舍）

## `backend/internal/crypto/aes.go`（67 行）
- 完整逐行检查：完成
- 未发现问题（AES-256-GCM + 随机 nonce + 长度校验，正确）

## `backend/internal/crypto/aes_test.go`（62 行）
- 完整逐行检查：完成
- 未发现问题（roundtrip/随机 nonce/错误密钥/非法密文覆盖）

## `backend/internal/db/db.go`（44 行）
- 完整逐行检查：完成
- 未发现问题（连接池参数与 statement_timeout=15s 设置合理）

## `backend/internal/domain/affairs_batch.go`（19 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/affairs.go`（176 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/ai.go`（27 行）
- 完整逐行检查：完成
- 未发现问题（APIKeyEncrypted 标记 `json:"-"`，不会外泄）

## `backend/internal/domain/alliance.go`（590 行）
- 完整逐行检查：完成
- [P2] L262: `// ===== 合作项目 =====` 注释位置错误（紧跟在 `// ===== 企业合作协议 =====` 之后，重复标题，应为 L263 AllianceProject 的模块头注释）
- 复用候选: PublicBrandItem（L485-540）与 EmployerBrand（L450-469）重复约 17 个企业资料字段（EnterpriseName/Logo/Industry/Region/CreditCode/Contact*/Address/EstablishedYear/EmployeeCount/Cover*/License/IP/Qual 等），与 JobBrand（L472-480）重复岗位字段；建议抽取共享的企业视图/岗位视图结构体（如 BrandEnterpriseView）供三者嵌入组合

## `backend/internal/domain/certification_model.go`（36 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/community.go`（35 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/evaluation.go`（346 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/job.go`（169 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/lesson.go`（131 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/library.go`（52 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/models.go`（96 行）
- 完整逐行检查：完成
- 未发现问题（PasswordHash 标记 `json:"-"`，不泄露）

## `backend/internal/domain/partner_cobuild.go`（16 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/portal.go`（179 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/scene.go`（189 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/status.go`（45 行）
- 完整逐行检查：完成
- 未发现问题（状态枚举统一收敛，别名保持模块兼容，设计良好）

## `backend/internal/domain/tag.go`（29 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/domain/unified.go`（284 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/geo/geo.go`（73 行）
- 完整逐行检查：完成
- 未发现问题（私网/保留地址过滤、加载失败降级为空地点，容错合理）

## `backend/internal/geo/geo_test.go`（58 行）
- 完整逐行检查：完成
- 未发现问题（数据文件缺失自动 Skip，用例覆盖国内/国外/保留段/非法 IP）

## `backend/internal/handler/ability_code_test.go`（97 行）
- 完整逐行检查：完成
- 未发现问题（NL- 编码自动生成两条路径均有断言，测试数据自清理）

## `backend/internal/handler/ability_domain_handler.go`（140 行）
- 完整逐行检查：完成
- 未发现问题（无 SQL；CreateFn/UpdateFn 校验岗位租户归属防越权；ListConfig 已核实 TenantScoped=true 且 ExtraFilter 参数化）

## `backend/internal/handler/ability_handler.go`（150 行）
- 完整逐行检查：完成
- 未发现问题（无 SQL；ListConfig 已核实 TenantScoped=true）

## `backend/internal/handler/affairs_config_import_handler.go`（237 行）
- 完整逐行检查：完成
- [P2] L55-56: 注释声明"三 Sheet 导入包在同一事务：任一步骤失败整体回滚"，但 L75-80/L110-115/L159-164 对逐行导入错误仅 failed++ 后 continue，闭包恒返回 nil，事务因行级错误永不回滚——注释与实际行为不符（跳过失败行本身可接受，属导入容错设计）（最佳实践: 修正注释为"行级失败跳过并计数"或改为失败即回滚）

## `backend/internal/handler/affairs_config_import_test.go`（122 行）
- 完整逐行检查：完成
- 未发现问题（时段类型推断 morning/afternoon/evening/morning_self 四分支断言完整）

## `backend/internal/handler/affairs_term_handler.go`（135 行）
- 完整逐行检查：完成
- [P2] 测试缺失（仅提示）: 学期 CRUD（List/Create/Update/Delete）无任何 handler/service/store 测试——已核实 handler 测试 0、TermStore 仅 whitelist_consistency_test 校验 ListConfig 形状，无 CRUD 行为测试（最佳实践: 至少补充 TermStore CRUD 或 handler 集成测试，尤其 isCurrent 置位/清空与删除引用检查）

## `backend/internal/handler/ai_handler.go`（364 行）
- 完整逐行检查：完成
- 未发现问题（护栏齐全：消息 1-50 条/单条 ≤8000/岗位条目与文本上限/场景文本与任务链上限；错误映射符合契约 412/502/500；Admin 路由已核实处于 RequirePlatform(saas)+platformAdmin+auth 三层中间件内，无未鉴权暴露；apiKey 仅入请求体不落响应；L293/L345 CurrentUser 依赖 tenantIDRequired 早退保证非 nil，安全）


### report-003-004.md

# 代码审查报告：批次 003 + 004（backend/internal/handler）

- 审查时间：按 REVIEW-GUIDE.md 全量逐行审查（禁止抽样/跳读，已逐文件完整阅读）
- 审查范围：/tmp/batches/003-backend.json、/tmp/batches/004-backend.json 所列 15 个文件，共 4824 行
- 结论：P0 0 条；P1 2 条；P2 若干；复用候选 2 项

---

## `backend/internal/handler/alliance_crud_handler.go`（424 行）
- 完整逐行检查：完成
- [P2] L375-377、L405-407: brandCRUD 的 ValidateUpdateExisting 内 `if len(t.Data) == 0 { t.Data = existing.Data }` 完全重复出现两次，第二处（L405-407）为冗余死代码（最佳实践: 删除重复分支）
- [P2] L70-80、L90-161、L166-258、L263-331、L335-423: project/achievement/agreement/brand 四个 CRUD 的 ValidateUpdateExisting 字段回退逻辑高度同构（十多个字段逐一 nil 判断回退），可抽象为通用 partial-fallback 辅助函数
- 复用候选: 与 alliance_handler.go 的 UpdateMilestone/UpdatePermission/UpdateDictionaryItem/UpdateSchoolExpert 同属"部分更新字段回退"模式，建议收敛为公共工具（详见 alliance_handler.go 段）

## `backend/internal/handler/alliance_expert_display_test.go`（173 行）
- 完整逐行检查：完成
- 未发现问题（夹具/权限/双控断言完整，清理函数按序执行）

## `backend/internal/handler/alliance_grant_options_test.go`（163 行）
- 完整逐行检查：完成
- 未发现问题（覆盖岗位/场景/批次/来源/他租户隔离断言）

## `backend/internal/handler/alliance_handler.go`（1508 行）
- 完整逐行检查：完成
- [P1] L765-811: UpdateSchoolExpert 部分更新兜底不完整。store 层 UpdateExpert 为全列 UPDATE（alliance_expert_store.go L107-123，nil 指针直接写 NULL），handler 仅兜底 Name/Status/IsPublic/UserID/CreatedAt，未携带的可选字段（gender/title/position/expertType/industry/specialties/education/introduction/workExperience/city/avatarUrl/coverImage/photos/attachments/organization/rating/positionDirection/secondaryColleges 等约 20 个）会被覆盖为 NULL。同文件 project/achievement/agreement/brand 的 CRUD 均实现完整 ValidateUpdateExisting 兜底（注释明确"避免 PUT 全列覆盖清空数据"，且 L200-283 测试注释证实该 bug 曾实际发生），此处不一致；若前端局部保存（如仅改姓名/开关）将清空专家档案可选字段（最佳实践: 补充其余可选字段的回退逻辑，或复用 L107-150 的兜底模式）
- [P2] L574-589: UpdateMilestone 仅兜底 ProjectID/Name/Description/DueDate/CompletedDate；is_completed/sort_order 为 bool/int 无法区分"未携带"与"默认值"，store 全列 UPDATE（alliance_project_store.go L211-219）会将已完成里程碑在局部编辑时重置为未完成、排序重置为 0（最佳实践: 与 L107-150 一致增加回退语义，如用指针/显式标记）
- [P2] L949-971: UpdatePermission 未兜底 IsEnabled（bool 无法区分未携带与 false），store 全列 UPDATE（alliance_permission_store.go L61-70）会在局部更新时把已启用权限重置为停用（最佳实践: 增加 isEnabled 显式携带语义或回退）
- [P2] L1081-1091: UpdateDictionaryItem 未兜底 SortOrder，局部更新会把排序重置为 0（最佳实践: 同上，显式携带或回退）
- [P2] L1255-1276、L1440-1471: SaveBrandMajorRankConfigs（无任何 handler 内权限检查）与 ToggleExpertDisplay（仅 requireTenant，无 canManageAlliance）完全依赖路由中间件 RequireAllianceManager（routes.go L455/L472/L488）把关，与同文件其余 handler 自带 canManageAlliance 检查的模式不一致（防御纵深：路由一旦换挂载点即退化为未授权写接口）（最佳实践: handler 内补 canManageAlliance 校验，保持全文件一致）
- [P2] L1296-1298: ListPublicTalentRanking 对 `len(g.Students) > g.RankLimit` 时截断，但未处理 RankLimit<=0 的极端配置（截断为空数组），低风险，可忽略
- 复用候选: 与 alliance_crud_handler.go 的 ValidateUpdateExisting 同属部分更新兜底模式（4+ 处重复），建议抽象公共函数

## `backend/internal/handler/alliance_handler_test.go`（751 行）
- 完整逐行检查：完成
- [P2] L285: 悬空注释 `// TestAllianceProject_PartialUpdatePreservesPublicFlag ...` 声称存在的测试并未实现（该注释后无任何测试函数），易误导后续维护者（最佳实践: 删除或补写测试）
- [P2] L39-55（doWithClaims）、L213-227（内联 do 闭包）、L301-315（内联 do 闭包）: 同一"带 claims 请求路由"辅助逻辑重复 3 处（最佳实践: 统一用 doWithClaims，或收敛为一个带 Content-Type 的公共 helper）
- 复用候选: doWithClaims + 2 个内联 do() 共 3 处重复，可收敛为单一测试辅助函数

## `backend/internal/handler/alliance_import_test.go`（163 行）
- 完整逐行检查：完成
- 未发现问题（名称关联/二级学院/公开开关/自动补建 link 断言完整）

## `backend/internal/handler/alliance_mentor_handler.go`（33 行）
- 完整逐行检查：完成
- 未发现问题（分层合规：service 调用，无 SQL、无 pgxpool 字段）

## `backend/internal/handler/alliance_mentor_handler_test.go`（403 行）
- 完整逐行检查：完成
- 未发现问题（双控/权限/分配持久化断言完整，defer 顺序正确）

## `backend/internal/handler/alliance_public_achievement_links_test.go`（137 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/alliance_public_agreements_test.go`（181 行）
- 完整逐行检查：完成
- [P2] L170: `body[strings.Index(body, "["):strings.LastIndex(body, "]")+1]` 用字符串切片手工截取 items 数组，若响应为无方括号的错误 JSON（如 `{"error":...}`），Index 返回 -1 造成越界 panic，掩盖真实断言失败（最佳实践: 先 UnmarshalList 到完整响应结构再断言 DTO 键）

## `backend/internal/handler/alliance_public_brands_display_test.go`（95 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/alliance_public_display_test.go`（127 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/alliance_public_milestones_test.go`（186 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/appeal_handler.go`（149 行）
- 完整逐行检查：完成
- 未发现问题（权限由路由 businessUser 组中间件把关（routes.go L211/L58：教师/校管/企业导师/平台管理员），handler 内检查与路由一致；Get/Create 均有租户归属校验）

## `backend/internal/handler/approval_handler.go`（331 行）
- 完整逐行检查：完成
- [P1] L197-247（配合 store/approvals.go L139-178）: 多步骤 "all"（全部审批）模式下并发评审竞态导致工作流卡死。流程：各审批人先 GetApproval 读到旧 History（L136），本地追加自己的 entry 后调用 isStepComplete（L206）——此时各自的 History 只含自己一条，必然返回 false，于是都只走 UpdateApprovalHistory（L208，SQL 原子追加 history || entry，互不覆盖），无人触发 AdvanceRecord 推进 step；当该步骤审批人恰好全部批准完毕后，再无新请求到来触发重算（isUserApproverForStep 已放行过全部审批人，后续请求 403），记录永远停在 pending（current_step_idx 不变）。AdvanceRecord 的 CAS（status + current_step_idx）只能防重复推进，不能补推进（最佳实践: 追加 History 后在同一事务内重读最新 History 重算 stepComplete 并推进，或把"追加+重算+推进"合并为单个原子 SQL/事务）
- [P2] L277-280: workflow 加载失败（GetWorkflow err）时 isStepComplete fail-closed 返回 false，评审走 UpdateApprovalHistory 分支，接口仍返回 200 且 History 已记录——操作者会以为审批已生效，实际状态未推进且无任何提示（最佳实践: 该分支对 workflow 加载失败返回 500 或响应中带提示，避免静默不生效）
- 未发现问题项（已核实）：无工作流记录 isUserApproverForStep 返回 true（L251-253）与 isStepComplete 返回 true（L273-276）为注释明确的单步审批设计；拒绝分支 syncStatus=true 与缓存失效（L187）正确；同步实体状态表名经白名单校验（store L180-193）


### report-005-006.md

# 代码审查报告 批次 005-006（backend/internal/handler）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、严格按严重级别与报告模板）。
批次来源：/tmp/batches/005-backend.json、/tmp/batches/006-backend.json。
审查方式：所有文件均用 read 工具完整逐行阅读（含测试文件），行号已用 read 核对。
审查范围：仅本批次 19 个文件；未修改任何源代码。

---

## `backend/internal/handler/auth_handler.go`（574 行）
- 完整逐行检查：完成
- [P2] L353-362: usedNonces 一次性校验为"先 Load 后 Store"的非原子操作（L354 Load、L361 Store），同一 preAuthToken 被两个并发请求同时使用时可双双通过校验，各签发一个正式 token。影响面小（1 分钟有效期、仅限本人登录链路），但属于明显竞态（最佳实践: 改用 sync.Map.CompareAndSwap 原子写入，或把 JTI 去重下沉到 DB 唯一约束）。
- 其余未发现问题：登录防爆破/新设备验证码策略（L185-218）、多候选租户选择（L278-315）、preAuthToken 有效期 1 分钟 + 过期清理（L34-52）、签发前清空 PasswordHash/Oauth（L409-411）均正确。
- 备注（按指南不报低价值）：L293 rand.Read 错误被忽略、L393-394 日志/LastLogin 错误忽略，均属"小概率异常宁可容忍"。

## `backend/internal/handler/auth_handler_test.go`（109 行）
- 完整逐行检查：完成
- 未发现问题（覆盖登录成功/密码错误/用户不存在/me 有 token/无 token 五类场景）。

## `backend/internal/handler/batch_configs.go`（60 行）
- 完整逐行检查：完成
- 未发现问题（薄封装，SQL 与扫描配置已沉淀 store/batch_configs.go）。
- 复用候选: 本文件 5 个批次子 handler（JobBatchHandler/SceneBatchHandler/CourseBatchHandler/EvaluationBatchHandler/AffairsBatchHandler，L12-60）结构完全同构（均为"嵌入 *BatchHandler + NewXxxBatchHandler 工厂，仅表配置不同"），可用一个工厂函数（入参 svc + store.BatchTableConfig）加类型别名收敛，消除 5 份重复样板。

## `backend/internal/handler/batch_handler.go`（302 行）
- 完整逐行检查：完成
- 未发现问题：List 的 orgNodeId/status 条件经 qb.NextArg 参数化（L79-84）；Get/Update/Delete/UpdateStatus 均经 checkTenantAccess 校验租户归属（L108-118）；创建时租户域表禁止空租户落库（L169-176）。

## `backend/internal/handler/brand_import_test.go`（632 行）
- 完整逐行检查：完成
- 未发现问题（测试文件；覆盖模板表头对齐、六类品牌导入、类型化导入、覆盖导入）。

## `backend/internal/handler/captcha_handler.go`（22 行）
- 完整逐行检查：完成
- 未发现问题（生成端点公开为设计意图，答案仅存服务端）。

## `backend/internal/handler/captcha_handler_test.go`（145 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/certificate_library_handler.go`（156 行）
- 完整逐行检查：完成
- [P2] L78-83: UpdateFn 的 URL 合并逻辑存在 NULL/空串语义不一致：请求未传 url（t.URL == nil）且旧值 existing.URL 也为 nil 时，updateURL 被赋为 ""（空串）而非 nil，把数据库中的 NULL 静默改写为空串；同理 L84-91 的 Description/ImageURL 分支保留 nil 语义，行为不一致。建议未传字段时保持 existing 原值（含 NULL）不动。
- [P2] L69-98: crud() 未配置 ValidateUpdate/ValidateUpdateExisting（L44-47 为空），PUT 显式传 name:"" 可把证书名称清空为空串（创建时 name 必填，更新时无一致性校验）。建议补更新校验或合并时忽略空串。
- 其余未发现问题：Get/Update/Delete 均校验租户归属（CheckOwnership/GetOwnership，防跨租户 IDOR）；UncitedList 带 limit/offset 与日期范围校验。

## `backend/internal/handler/certificate_library_handler_test.go`（86 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/certification_handler.go`（689 行）
- 完整逐行检查：完成
- [P2] L315-325: ConfigPoints 创建认证点时未校验 AbilityPointID 对应能力点是否存在、是否属于当前租户；且 L322-324 对非 UUID 字符串静默执行 uuid.NewSHA1 生成确定性 UUID——输入拼写错误或跨租户能力点 ID 会落库为悬挂引用，错误难以发现。建议在 service/store 层校验能力点存在性与租户归属，非 UUID 输入直接 400。
- 备注（按指南不报低价值）：L449-452 把 point.Tasks 复制为同类型切片后再校验，为冗余拷贝；L149-153 CreateRule 的"同岗位只允许一条规则"检查为读后写，存在并发双写窗口（认证规则属配置类非核心业务，允许重复容忍）。

## `backend/internal/handler/certification_model_handler.go`（182 行）
- 完整逐行检查：完成
- 未发现问题（PutPointLevels/PutWeights 均先校验岗位租户归属；权重之和校验含浮点容差）。

## `backend/internal/handler/citation_stats_ability_cert_test.go`（399 行）
- 完整逐行检查：完成
- 未发现问题（测试文件）。

## `backend/internal/handler/citation_stats_test.go`（382 行）
- 完整逐行检查：完成
- 未发现问题（测试文件）。

## `backend/internal/handler/common.go`（467 行）
- 完整逐行检查：完成
- 未发现问题：decodeBody 有 10MB body 上限（L137/L143）；respondServerError 对 context.Canceled 静默退出（L115-117）；safeHandler panic-recover 兜底（L213-221）；goAsync/recordViewAsync 均带 panic 防护（L439-467）；SQL 组装全部下沉 store/query.go（L395-403）。

## `backend/internal/handler/community_handler.go`（198 行）
- 完整逐行检查：完成
- 未发现问题（标题/内容/标签长度与空值校验、sort 白名单、limit 上限 100、租户域读写）。

## `backend/internal/handler/community_handler_test.go`（254 行）
- 完整逐行检查：完成
- 未发现问题（含跨租户隔离用例）。

## `backend/internal/handler/content_actions.go`（231 行）
- 完整逐行检查：完成
- [P2] L220: invite 仅校验了被操作实体（id）的租户归属（checkTenantAccess），未校验被邀请用户 req.UserID 是否属于当前租户，store 层 Invite（store/content_actions.go L229-245）也只做 array_append 不做用户租户校验。任意租户用户可把已知 UUID 的其他租户用户写入协作者列，产生跨租户协作者引用（若协作者可见实体则扩大数据暴露面）。建议在 store 层校验被邀请用户 tenant_id 与实体租户一致，不一致返回 400/403。
- 其余未发现问题：表名/列名白名单校验（L56-75，防 SQL 注入）、Transition CAS 更新防并发双发（store 层）、路由层另有 TenantOwnedContent 中间件兜底。
- 复用候选: L77-96 的 checkTenantAccess（uuid.Parse + 按表查 tenant_id + verifyTenantOwnership + 404/403）与 batch_handler.go L108-118 的 checkTenantAccess 为同一职责的重复实现，且与 crud.go 的 CheckOwnership/GetOwnership 机制职责重叠——当前存在 crudConfig / contentActions / BatchHandler 三套并行"租户域实体操作模板"，建议统一为单一模板（含租户归属校验、404/403 文案、回读刷新）。

## `backend/internal/handler/course_clone_handler.go`（67 行）
- 完整逐行检查：完成
- [P2] L36: 内联 JSON 解码未复用全站 decodeBody 约定：无 10MB body 上限（common.go L143），且用 err.Error()=="EOF" 字符串比较判断空请求体（应 errors.Is(err, io.EOF)，字符串比较在错误文案变化时失效）。建议改为 decodeBody。

## `backend/internal/handler/course_export_handler.go`（224 行）
- 完整逐行检查：完成
- [P2] L166-177: lookupCourseAbilityPointNames 在 handler 层直连 SQL（h.Store.Q().QueryRow / Query 执行 SELECT），违反分层红线"handler 禁止直接 db.Query/QueryRow/Exec"（docs/refactor-layering.md 三、1）。本文件其余查询均已下沉 CourseStore（git 历史 240373de 确认），此处为迁移残留，建议下沉为 CourseStore 方法（如 ListCourseAbilityPointNames），handler 只调用 store。
- 其余未发现问题：导出逐课程/逐节点查询（L94-159）属管理端低频导出场景，按指南"非核心接口允许慢"不报 N+1。


### report-007-008.md

# 代码审查报告 007-008（backend/internal/handler）

> 依据 docs/code-review/REVIEW-GUIDE.md 执行：每个文件完整逐行阅读，行号经 read 工具核对。
> 批次 007：course/course-import/course-node/course-resource/crud 等 10 个文件；批次 008：evaluation/exam 系列 7 个文件。
> 结论摘要：P0=0，P1=6，P2=7，复用候选=1。

## `backend/internal/handler/course_handler.go`（441 行）
- 完整逐行检查：完成
- 未发现问题。List/Get 对学生强制只看已发布课程（L90-93、L123-127），Create/Update/Delete 均经 requireTenant 与租户限定查询，无 handler 层 SQL，唯一键冲突映射 409，Delete 处理 ErrResourceInUse。

## `backend/internal/handler/course_import_handler.go`（585 行）
- 完整逐行检查：完成
- [P1] L183、L208-212、L230、L242-249、L388-392、L405-409、L414-418、L422-426、L444-447、L478-483、L497、L511-516、L524-527、L543-546: handler（CourseImportHandler）层直接编写并执行 SELECT/INSERT/UPDATE/DELETE（q.QueryRow/q.Query/q.Exec），违反后端分层红线（docs/refactor-layering.md 明确"全量适用，含 import/export/template"）。SQL 均为参数化（无注入），但整个导入流程绕过 store 层，属红线必报项（最佳实践: 将 importCourses/importNodes/createSystemCourseNode 等下沉到 store/service 层）。
- [P2] L403、L412: 覆盖导入整体包在事务内（注释 L117-118 承诺"任一步失败整体回滚"），但 createSystemCourseNode 内 findOrCreateKnowledgePoints/findOrCreateResources 传入的是 h.Store.Q()（池连接）而非事务内 txStore.Q()，新建的知识点/资源在事务外提交，导入失败回滚时残留为孤儿数据，破坏原子性（最佳实践: 统一传 q 参数）。
- [P2] L404-410、L413-419、L428-452: createSystemCourseNode 内循环逐条 INSERT（知识点绑定、资源绑定、测评），大批量文件导入时 SQL 往返次数多（导入为批量维护场景，建议批量 INSERT）。
- [P2] L265-267: importNodes 在 preview 模式下直接 return，预览只统计课程不校验节点，预览结果与真实导入不一致（低价值提示）。

## `backend/internal/handler/course_knowledge_names_test.go`（94 行）
- 完整逐行检查：完成
- 未发现问题。测试覆盖课程列表/详情知识点名称回显，清理逻辑完整。

## `backend/internal/handler/course_node_handler.go`（555 行）
- 完整逐行检查：完成
- [P1] L289-294: Update 的"部分更新兜底"（注释 L242）对 KnowledgePointIds/ResourceIds 未做 nil 回退（其余字段 L243-287 均回退现有值）；store 层 CourseNodeStore.Update（store/course_nodes.go L160-175）会先 DELETE 全部绑定再按传入列表重建，因此请求未携带 knowledgePointIds/resourceIds 时会清空节点全部知识点/资源绑定，造成数据丢失。同批 course_handler.Update（L313-321）对数组字段有 nil 回退，此处不一致（最佳实践: 与课程 Update 一致，nil 时回退 existing 绑定；仅当显式传空数组时清空）。
- [P2] L535-547: checkNodeRefsTenant 对每个 kpID/resID 各执行一次 Get 查询（N+1），节点含大量绑定时的创建/更新请求会放大查询次数（最佳实践: 批量 IN 查询后一次校验）。
- [P2] L249: `if req.SortOrder == 0 { req.SortOrder = existing.SortOrder }`，无法将节点排序显式设为 0（低价值提示）。

## `backend/internal/handler/course_node_usage_window_test.go`（162 行）
- 完整逐行检查：完成
- 未发现问题。覆盖测评方式时间窗/时长同步到考试安排的创建与更新路径，含节流重置，断言完整。

## `backend/internal/handler/course_resource_handler.go`（199 行）
- 完整逐行检查：完成
- [P2] L174-179: UnbindResource 中 BindTargetID 的任意错误（含数据库故障）都被当作"绑定不存在"返回 200 成功，错误被吞掉，前端会误以为解绑成功（最佳实践: 仅 ErrNotFound/pgx.ErrNoRows 时幂等返回 200，其余错误走 respondServerError）。

## `backend/internal/handler/crud.go`（265 行）
- 完整逐行检查：完成
- 未发现问题。通用 CRUD 骨架（鉴权→decode→校验→store→回读→响应）实现清晰，DeleteChecks/唯一键冲突/资源占用冲突处理完整。

## `backend/internal/handler/edge_case_test.go`（174 行）
- 完整逐行检查：完成
- 未发现问题。覆盖空列表、分页、搜索过滤、未鉴权 401、非平台角色 403。

## `backend/internal/handler/error_codes.go`（40 行）
- 完整逐行检查：完成
- 未发现问题。状态码→错误码映射完整，未登记兜底 internal_error。

## `backend/internal/handler/error_log_test.go`（43 行）
- 完整逐行检查：完成
- 未发现问题。验证 5xx 结构化日志含 request_id 与原始 error。

## `backend/internal/handler/evaluation_handler_test.go`（1096 行）
- 完整逐行检查：完成
- 未发现问题。题库/题目/试卷/考试安排/结果/证书/画像/申诉全覆盖，含批量、时间窗、删除联动清理等场景，断言与清理完整。

## `backend/internal/handler/evaluation_import_test.go`（124 行）
- 完整逐行检查：完成
- 未发现问题。覆盖题库/题目/试卷三类 Excel 导入。

## `backend/internal/handler/evaluation_result_handler.go`（286 行）
- 完整逐行检查：完成
- [P1] L258-278: BatchGrade 在循环内对每个 item 执行一次 GetEvaluationResult（逐条 DB 查询）后再批量评分，批量评分为核心教学流程，成绩量大时查询次数线性放大（N 条成绩 ≈ N 次查询）（最佳实践: 一次 WHERE id = ANY($1) 批量查询后逐条做租户校验）。
- [P2] L262-264: BatchGrade 循环内任一 item 不存在即中止整个批次并返回 404，无部分成功语义（可接受，低价值提示）。

## `backend/internal/handler/exam_export_handler.go`（113 行）
- 完整逐行检查：完成
- [P1] L85-90: ExamExportHandler 在 handler 层直接 h.Store.Q().Query 执行 SELECT，违反后端分层红线（规范"全量适用，含 import/export/template"）（最佳实践: 下沉到 store 层查询方法）。
- [P2] L52-76、L79-110: 导出时每份试卷依次执行 试卷详情 + 批次名 + 题目 查询（2~3 次/试卷），多试卷导出呈 N+1（最佳实践: 试卷与题目分别按 ID 批量 IN 查询后在内存组装）。

## `backend/internal/handler/exam_handler.go`（544 行）
- 完整逐行检查：完成
- [P1] L385-394 与 L440-449: UpdateQuestionScore/BulkUpdateScores 中先执行 `if claims.TenantID != nil`（L388/L443）解引用 claims，之后才做 `if claims == nil` 判空（L391/L446）；若 claims 为 nil（未鉴权请求到达 handler 或鉴权中间件未兜底）即空指针 panic。同文件其余方法（List/Get/Create/Update/Delete 等）均为先判 nil，写法不一致（最佳实践: 先判 claims == nil，再取 TenantID）。
- [P2] L182: Update 中 `existing.TenantID != nil && !verifyTenantOwnership(...)`，existing.TenantID 为 nil 时跳过归属校验（与其他方法一致的低概率场景，低价值提示）。

## `backend/internal/handler/exam_import_handler.go`（283 行）
- 完整逐行检查：完成
- [P1] L150、L173-176、L185、L203、L214-218、L264-267、L274-277: ExamImportHandler 在 handler 层直接编写并执行 SELECT/INSERT/UPDATE/DELETE（q.QueryRow/q.Query/q.Exec），违反后端分层红线（规范"全量适用，含 import/export/template"）。SQL 均为参数化（无注入）（最佳实践: 下沉到 store/service 层）。
- [P2] L264-277: importExamQuestions 每行题目一次 SELECT + 一次 INSERT，大批量导入时逐条往返（建议批量查询题目 ID、批量 INSERT）。
- [P2] L135-144: 同一文件内重名试卷，preview 模式计数 Skipped 与真实导入不一致（低价值提示）。

## `backend/internal/handler/exam_result_handler.go`（193 行）
- 完整逐行检查：完成
- [P1] L140-143: Get 的租户校验条件为 `result.TenantID != nil && claims.TenantID != nil && *result.TenantID != *claims.TenantID`，当 claims.TenantID 为 nil（或无租户 token）时校验整体跳过，可读取他租户考试结果（越权读取成绩数据）。同文件 Grade（L170）与 evaluation_result_handler.Get（L98）均使用 `claims.TenantID == nil ||` 严格写法，此处不一致（最佳实践: 改为 `claims.TenantID == nil || result.TenantID == nil || *result.TenantID != *claims.TenantID` 时 404）。
- [P2] L82-90: Create 中 ExamUsages().Get 的任意错误（含数据库故障）都返回 404"考试安排不存在"，错误被误导为"不存在"（最佳实践: ErrNotFound/pgx.ErrNoRows 映射 404，其余走 respondServerError）。

---
- 复用候选: 1 — 全部 import handler 的 result 结构体与 preview/overwrite/rename 流程高度重复：courseImportResult（course_import_handler.go L30）、examImportResult（exam_import_handler.go L20）、resourceImportResult（resource_import_handler.go L26）、pcImportResult（program_course_import_handler.go L27）、scenarioImportResult（scenario_import_handler.go L23）、granularCourseImportResult（granular_course_import_handler.go L21）、scheduleImportResult（schedule_import_handler.go L21），字段几乎一致（Created/Failed/Skipped/PermissionSkipped/Errors/DuplicateItems），且各自重复"预览/覆盖/重命名/事务包裹"骨架。可抽象通用 importResult + 泛型导入执行器（配合已存在的 import_common.go），一处修改全导入器受益。


### report-009-010.md

# 代码审查报告 009-010（backend handler 批次）

> 依据 `docs/code-review/REVIEW-GUIDE.md` 逐文件完整逐行审查，行号均经 read 工具核对。
> 批次：`/tmp/batches/009-backend.json`（10 个文件）+ `/tmp/batches/010-backend.json`（10 个文件），共 20 个文件。
> 说明：本批次大量为测试文件（`*_test.go`，package handler_test/handler），按指南仅审查测试代码本身质量。

## `backend/internal/handler/exam_retake_policy_test.go`（271 行）
- 完整逐行检查：完成
- 未发现问题（测试数据经 defer 清理；测试断言覆盖重交策略/提交窗口/节点评分回写三个场景，逻辑自洽）

## `backend/internal/handler/exam_usage_flow_test.go`（259 行）
- 完整逐行检查：完成
- 未发现问题（buildExamFlowRouter/execJSONWithRouter/insertExamWithQuestions/insertTestClass 为同包多个测试文件共用的脚手架函数，属既有复用）

## `backend/internal/handler/exam_usage_handler.go`（272 行）
- 完整逐行检查：完成
- 未发现问题（未持有 `*pgxpool.Pool`、无 SQL；Finish/Publish 先 GetExamUsage+verifyTenantOwnership 校验归属再改状态；CreateTenantFn 经 requireTenant 兜底；manualOnly 拦截自动创建安排）

## `backend/internal/handler/exam_usage_visibility_test.go`（171 行）
- 完整逐行检查：完成
- 未发现问题（对"考试管理列表/学生工作台不展示临时考试"的可见性回归覆盖完整）

## `backend/internal/handler/expert_grant_flow_test.go`（467 行）
- 完整逐行检查：完成
- 未发现问题（授权可见性/专家账号自动创建/编辑稿合并/共建资源授权并入四组场景，断言与清理完整）

## `backend/internal/handler/favorites_handler.go`（139 行）
- 完整逐行检查：完成
- 未发现问题（GetFavorite/ToggleFavorite/List 均先校验登录；checkTargetTenant 跨租户目标按 404 处理，无越权；FavoriteCount 失败降级为 0 且仅 Warn 日志，合理）

## `backend/internal/handler/favorites_handler_test.go`（155 行）
- 完整逐行检查：完成
- 未发现问题（覆盖切换/列表/取消/非法类型/未登录五类场景）

## `backend/internal/handler/file_handler.go`（475 行）
- 完整逐行检查：完成
- [P1] L419、L452: Preview 用 `exec.Command("libreoffice", ...)` 执行外部转换，无 `CommandContext`/超时、无并发上限，且 L433/L459 用 `os.ReadFile` 把整份转换产物读入内存再 base64（约 4/3 膨胀）返回。任意已登录用户可对该接口并发发起转换请求，多个 LibreOffice 进程与超大内存占用可拖垮整机，影响核心服务可用性（最佳实践: 改用 `exec.CommandContext` 设超时、限制并发/单请求大小、流式或临时文件落盘后限速下发）
- [P2] L439-441: `format=="png"` 分支 `len(images)==0` 时 `respondServerError(w, r, err, ...)` 使用的 `err` 是循环后的陈旧/为 nil 值，错误信息与状态码失真（最佳实践: 用独立错误变量记录"未生成幻灯片"原因）
- [P2] L347-352: Serve 中 `tenantID` 直接来自 URL 参数且未做 UUID 格式校验，路径包含依赖 `resolveTenant` 前置判定 + `strings.HasPrefix` 双重防御；若 `IsPublicAllianceFile` 上游判定未来对异常租户串放行，`filepath.Clean("..")` 的租户目录可退化为上传目录父级（最佳实践: 在 resolveTenant/Serve 对 tenantID 增加 UUID 格式校验，纵深防御）
- 说明: 上传白名单/内容 sniff（L100-112）、Serve 的 `..`/`/` 拦截与 xssRiskyExts 的 CSP sandbox+nosniff（L338-361）、签名 URL HMAC 校验（L238-261）均正确，未发现高危问题

## `backend/internal/handler/file_handler_test.go`（344 行）
- 完整逐行检查：完成
- 未发现问题（覆盖鉴权/路径穿越/公开联盟文件/签名 URL/租户白名单/双端 cookie/跨租户判定，测试充分）

## `backend/internal/handler/granular_course_export_handler.go`（161 行）
- 完整逐行检查：完成
- [P2] L114-119、L139-144: handler 层直接 `h.Store.Q().Query(...)` 执行 SELECT，违反分层红线"handler 层出现 SELECT/...或直接 db.Query/QueryRow/Exec（含 import/export/template）"（最佳实践: 下沉为 service/store 方法，handler 只做 HTTP 适配；该文件与 granular_course_import_handler.go、import_export_handler.go 同属红线重灾区）
- [P2] L51-108: fillCoursesData 循环内对每个课程串行执行 专业名/批次名/知识点名/资源名 4 次查询（N+1）；导出为非核心接口允许慢，但批量导出可一次 JOIN/IN 批量查询（最佳实践: 按 courseIDs 一次性查询再内存组装）
- 说明: 参数化查询 + tenant_id 过滤正确，无 SQL 注入

## `backend/internal/handler/granular_course_import_handler.go`（267 行）
- 完整逐行检查：完成
- [P2] L142、L173-178、L195、L207-214、L230-255、L262: handler 层大段直接 SQL（QueryRow/Exec 的 SELECT/UPDATE/INSERT/DELETE，含 replaceCourseBindings 内循环逐条写绑定），整段导入业务逻辑（约 100 行）都在 handler，违反分层红线"handler 层出现 SELECT/INSERT/UPDATE/DELETE 或直接 db.Query/QueryRow/Exec（含 import/export/template）"（最佳实践: 导入流程下沉 service/store，handler 仅保留解析与响应）
- [P2] L259-267: generateGranularCourseCode 用 `MAX(...)+1` 生成编码且无锁，并发导入时可能生成重复 code；属普通业务可容忍，但若 `courses` 存在 (tenant_id, code) 唯一约束，同租户并发导入会整行失败（最佳实践: 批量导入预取/事务内取号，或依赖 ON CONFLICT 兜底）
- 说明: 全部 SQL 参数化且过滤 tenant_id，无注入；overwrite/rename/permission 判定逻辑完整

## `backend/internal/handler/hybrid_grading_writeback_test.go`（129 行）
- 完整逐行检查：完成
- 未发现问题（混合课教师评分回写 exam_results 的回归测试，断言与清理完整）

## `backend/internal/handler/hybrid_module_handler.go`（149 行）
- 完整逐行检查：完成
- 未发现问题（UpsertModule/BatchSave 均先校验目标节点归属当前租户，DeleteModule 按租户查找，无越权；未持有 pool、无 SQL）

## `backend/internal/handler/import_common.go`（453 行）
- 完整逐行检查：完成
- 未发现问题（SQL 均委托 store 层白名单查询（LookupByTableAndName 等），handler 层无 SQL；枚举映射/解析工具函数单一职责）
- 说明: findOrCreateResources 按名称逐个调用 store 查询，属导入类非核心路径允许慢，未单列

## `backend/internal/handler/import_common_test.go`（48 行）
- 完整逐行检查：完成
- 未发现问题（resourceTypeByExt 与前端扩展名映射一致性表驱动测试）

## `backend/internal/handler/import_export_handler.go`（452 行）
- 完整逐行检查：完成
- [P2] L133、L358、L375、L400、L413、L442: handler 层直接执行/拼接 SQL（`h.Store.Q().Query/QueryRow/Exec`，含 `fmt.Sprintf` 动态 SQL 与逐实体 SQL 模板常量），违反分层红线（红线原文明确点名 import/export）（最佳实践: 实体元数据与 SQL 下沉 store 层，handler 只做文件解析/权限/响应组装）
- [P2] L371: 用 `strings.Count(meta.updateSQL, "$") == 3` 推断占位符个数来决定是否追加 code 参数，实现脆弱，后续新增实体/改 SQL 极易漏改（最佳实践: 为实体元数据增加显式参数数量/列定义字段）
- 说明: 表名/列名均经 `store.SanitizeIdentifier` 白名单校验、值全部参数化，Export 有 LIMIT 1000，未发现 SQL 注入；导入无事务、逐行报错累积为设计意图，未单列

## `backend/internal/handler/import_rename_test.go`（172 行）
- 完整逐行检查：完成
- 未发现问题（rename 模式与覆盖权限两场景覆盖完整，数据断言精确）

## `backend/internal/handler/industry_handler.go`（125 行）
- 完整逐行检查：完成
- 未发现问题（创建/更新/删除限 canManagePortal，Get 对业务角色只读；CreateTenantFn 校验请求租户与 claims 一致；删除前检查子行业）

## `backend/internal/handler/job_ability_result_handler.go`（479 行）
- 完整逐行检查：完成
- [P2] L381-441: Aggregate 仅校验登录（`CurrentUser == nil` 即拒绝），未限制角色，学生等任意角色可对本租户任意岗位反复触发耗时聚合任务（后台 goroutine 最长 30 分钟、按岗位去重但无全局/租户并发上限与频率限制），存在资源滥用面（最佳实践: 限教师/管理员角色调用，并为聚合任务增加全局并发信号量）
- 说明: List/Get/CourseScores 对学生的本人数据强制过滤（L229-231、L290-293、L359-361），GetAggregateLog 按租户过滤，无越权；后台任务带 30 分钟超时与 panic 兜底（L429-439），in-flight 清理完整

## `backend/internal/handler/job_ability_result_handler_test.go`（186 行）
- 完整逐行检查：完成
- 未发现问题（落库值优先/NULL 回退实时计算、汇总含零结果岗位两类场景，断言含数值精度校验）


### report-011-012.md

# 代码审查报告 011-012（backend/handler 批次）

审查方式：按 REVIEW-GUIDE.md 对批次清单中每个文件完整逐行阅读（read 工具，无跳读），
行号均经 read 工具核对。仅审查，未修改任何源代码。

---

## `backend/internal/handler/job_advanced_test.go`（385 行）
- 完整逐行检查：完成
- 未发现问题。测试均经 testhelper 走 HTTP 路由，直接 SQL 仅用于测试数据准备/清理，符合测试惯例。

## `backend/internal/handler/job_banner_handler.go`（152 行）
- 完整逐行检查：完成
- [P2] L27/L31: 未登录（CurrentUser 为 nil）与缺少租户均返回 403；同包 node_resource_handler.go 未登录返回 401、node_evaluation_result_handler.go 部分端点返回 403，HTTP 语义不统一（最佳实践: 未认证统一 401，越权/缺租户 403，避免前端对未登录态误判为权限不足）
- [P2] L139-152: derefInt/derefBool 属于通用 nil 安全解引用工具，定义在业务 handler 文件内，建议收敛到 common.go 与既有工具函数同处（可维护性）
- 复用候选: 无（该文件自身无重复）

## `backend/internal/handler/job_handler_test.go`（1274 行）
- 完整逐行检查：完成
- [P2] L465-466: before.Next() 返回值未检查即 Scan，Scan 错误也未检查；L512 QueryRow.Scan 错误未检查，COUNT 查询异常时测试静默继续，可能产生误导性失败（最佳实践: Next/Scan 错误应 t.Fatalf/t.Errorf）
- 其余未发现问题

## `backend/internal/handler/knowledge_point_handler.go`（172 行）
- 完整逐行检查：完成
- 未发现问题。CRUD 走 crudConfig 骨架、service 层实现，无 SQL、无越权；UpdateFn 部分更新回填现有值逻辑正确。

## `backend/internal/handler/landing_handler.go`（36 行）
- 完整逐行检查：完成
- 未发现问题。未登录/缺租户均 403，tenantFilter 限定本租户。

## `backend/internal/handler/landing_handler_test.go`（213 行）
- 完整逐行检查：完成
- 未发现问题。覆盖正常、未分班、未登录三场景，租户隔离有验证（外租户岗位 E 不出现）。

## `backend/internal/handler/learn_road_handler.go`（130 行）
- 完整逐行检查：完成
- 未发现问题。CRUD 经 crudConfig 骨架，部分更新回填逻辑正确。

## `backend/internal/handler/lesson_batch_test.go`（69 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/lesson_behavior_handler.go`（388 行）
- 完整逐行检查：完成
- [P2] L261-263: 外层 if quizCount > 0 内又重复判断 quizCount > 0，冗余嵌套（最佳实践: 删除内层判断，保留外层即可）
- [P2] L376-388: intPtr/countIntPtr 与 job_banner_handler.go 的 derefInt/derefBool 功能重叠（nil 安全解引用），分散在不同文件重复实现（见报告末尾复用候选）
- 其余未发现问题（Aggregate 聚合为单查询内存计算，量级受课程规模约束，可接受）

## `backend/internal/handler/lesson_handler_test.go`（1037 行）
- 完整逐行检查：完成
- 未发现问题。execOrFail 为同包 portal_learning_test.go 共享 helper，测试数据清理完整。

## `backend/internal/handler/log_handler.go`（52 行）
- 完整逐行检查：完成
- 未发现问题。租户来自 claims（listParamsFromRequest tenantScoped=true），未认证自然 403。

## `backend/internal/handler/major_handler.go`（122 行）
- 完整逐行检查：完成
- 未发现问题。CreateTenantFn 用请求体 tenantId + verifyRequestTenant 双重校验，防跨租户创建；DeleteChecks 防删有学生的专业。

## `backend/internal/handler/node_evaluation_result_handler.go`（228 行）
- 完整逐行检查：完成
- [P2] L56-81: ListByCourse 无分页一次返回课程下全部节点测评结果，未走 List 的分页参数；课程规模大（多班级 × 多节点）时响应体与查询开销无上限（最佳实践: 复用 listParamsFromRequest 的分页参数或在 service 层设上限）
- 其余未发现问题（Get/Grade 拒绝学生、Submit 学生仅可本人、评价人租户归属校验均正确）

## `backend/internal/handler/node_quiz_handler.go`（290 行）
- 完整逐行检查：完成
- 未发现问题。题目列表 limit 默认 500、上限 1000，防全表拉取。

## `backend/internal/handler/node_resource_handler.go`（206 行）
- 完整逐行检查：完成
- [P2] L136-151: BindResource 先调用 checkNodeTenant（L141）再校验必填字段（L144）；nodeId 为空时返回 404"节点不存在"而非 400"缺少必填字段"，校验顺序颠倒（最佳实践: 先做必填校验再查库）
- [P2] L182-187: UnbindResource 对 BindTargetID 的任何错误（含绑定不存在与真实 DB 错误）一律返回 200 成功，DB 故障被静默吞掉，用户无从感知（最佳实践: 仅对"绑定不存在"幂等返回 200，其余错误走 respondServerError）
- 其余未发现问题（Create/Unbind 均经节点→课程→租户链路校验归属）

## `backend/internal/handler/on_site_question_library_handler.go`（186 行）
- 完整逐行检查：完成
- [P2] L128-135: KnowledgePointIDs/Tags 部分更新以"空数组=未传"回填现有值，导致无法通过提交空数组显式清空知识点/标签（最佳实践: 若前端有清空需求，需区分 nil 与空数组）
- 其余未发现问题（List/Get 对学生的答案/分值剥离正确，基于 claims.RoleCodes，token 中确有填充）

## `backend/internal/handler/on_site_question_library_handler_test.go`（73 行）
- 完整逐行检查：完成
- 未发现问题。

---

## 汇总
- 审查文件数：17（011 批次 8 个，012 批次 9 个）
- 问题统计：P0 = 0，P1 = 0，P2 = 9
- 后端分层红线：未发现 handler 直写 SQL / service 拼 SQL / store 读 HTTP / handler 持有 pgxpool 字段
- 复用候选：1 处（nil 安全指针解引用小工具在 4 个文件重复实现：job_banner_handler.go 的 derefInt/derefBool、lesson_behavior_handler.go 的 intPtr/countIntPtr、resource_import_handler.go 的 boolPtr、store/query.go 的 BoolVal，可统一收敛为 common 工具）


### report-013-014.md

# 代码审查报告 batch 013-014（backend handler）

> 依据 REVIEW-GUIDE.md：逐行完整阅读，仅报告指南限定范围内的问题（安全只排高危、性能稳定性优先、后端分层红线、前端专项）。

## `backend/internal/handler/org_handler.go`（255 行）
- 完整逐行检查：完成
- 未发现问题。List/Tree/Get/Create/Update/Delete 均先经 service，handler 无直接 SQL、无 `*pgxpool.Pool` 字段；Tree 成员数统计为单次 GROUP BY 查询（非 N+1）；buildOrgTree 的排序依赖 store Tree 查询的 `ORDER BY sort_order ASC, created_at ASC`（organizations.go L65），子节点顺序稳定，无问题。

## `backend/internal/handler/org_handler_test.go`（498 行）
- 完整逐行检查：完成
- [P2] L296: `_ = ctx` 为未使用变量占位（ctx 在本测试 TestOrg_Delete 中未被使用），属死代码，删除变量声明与占位行即可。
- 复用候选: L37/L65/L83/L132/L188/L222/L237/L275/L308/L373 等 10 处重复定义 `do := func(method, path string, body interface{}) *httptest.ResponseRecorder` 闭包，可抽象为 testhelper 上的公共方法（如 `env.DoJSON(t, token, method, path, body)`）。

## `backend/internal/handler/org_type_handler.go`（130 行）
- 完整逐行检查：完成
- [P2] L62-66 与 L71-73 校验语义不一致：创建（PrepareCreate）时无效 category 被静默兜底为 `internal`，而更新（ValidateUpdate）时返回 400 "无效分类"。建议创建也校验拒绝（或在 ValidateCreate 中校验），保持读写一致。
- 分层合规：持有 `*store.OrgTypesStore`（非 pgx pool），List 走 `executeListQuery`，无直接 SQL。

## `backend/internal/handler/partner_cobuild_handler.go`（891 行）
- 完整逐行检查：完成
- [P1] L670-686（透传点 L680）: UpdateTask 无部分更新兜底——请求体字段经 `scenarioTaskParams(req.ScenarioID, nil, &req)` 直接透传，store `ScenarioTaskStore.Update`（scenario_tasks.go L96-106）是全列覆盖 UPDATE。与 portal 端 `scenario_task_handler.go` UpdateTask（L168-224 对每个字段逐项回退，注释明确"前端任务保存不提交 evalData，防止被清空为 {}"）不一致。共建任务编辑若提交部分字段（如不带 evalData/难度/依赖等），其余字段将被清空为 NULL/空串 → 数据损坏隐患。建议复用 portal 的合并兜底（或 service 内 fetch+merge）。
- [P2] L225-227: UpdatePosition 内 `if req.ShortName == nil || *req.ShortName == ""` 把空串当"未携带"回退原值（无法显式清空 shortName），而同 handler 中 CoverImage/Description/CareerPath 等 *string 字段空串可清空，语义不一致；建议统一为 UpdateScenario（L534-548）的 Nullable 语义。
- [P2] L611-633: `scenarioTaskParams` 的 `tenantID` 形参两个调用点（L662、L680）均传 nil，为死参数，可移除。
- 其余（ListPositions/Create/Submit/Withdraw/子资源只读/学校只读列表/权重等）鉴权与错误映射完备，未发现越权或 SQL 问题；service 会以任务实际场景覆盖 ScenarioID（partner_cobuild.go L699），客户端伪造 ScenarioID 无迁移风险。

## `backend/internal/handler/partner_cobuild_handler_test.go`（1246 行）
- 完整逐行检查：完成
- [P2] L1227-1235: TestPartnerCoBuild_SchoolDataEndpoints 用 `strings.Contains(w.Body.String(), c.expect)` 断言预置 ID 出现在响应中，若 ID 字符串恰好出现在其他字段（如日志/错误信息）可能误报通过，弱断言易掩盖回归；建议改为解析响应后精确比对字段值。

## `backend/internal/handler/partner_handler.go`（659 行）
- 完整逐行检查：完成
- [P0] L454-465（UpdateMyExpert）: 部分更新兜底缺失，仅回退 name（applyExpertPartialUpdate，L462）与 isPublic（L457-461），其余字段（user_id、enterprise_id、status、title、rating、photos、attachments、secondary_colleges、position_direction 等）未回退；store `AllianceStore.UpdateExpert`（alliance_expert_store.go L107-123）是全列覆盖 UPDATE，nil 字段全部置 NULL/空串。专家本人维护档案一旦提交部分 payload（现有测试 expert_grant_flow_test.go L222-225 仅传 `{"name":..., "isPublic":true}` 即触发），将清空账号绑定（user_id→NULL，之后 GetMyExpert 查不到本人档案）、企业归属（enterprise_id→NULL）及学校侧维护字段，与 L455-456 注释"学校侧维护字段……未携带时回退已有值，不得清空"直接相悖，属确定性数据损坏。修复：参照同文件 UpdateExpert（L306-375）对每个字段补回退，或抽公共 merge 函数（见复用候选）。
- [P2] L377-393（UpdateExpert）: 档案更新（L377）先于密码校验/重置（L382-393）执行——若 req.Password 无效（validatePassword 失败返回 400），档案已落库而请求报错，客户端误以为更新失败；应先校验密码再更新，或先校验后置更新。
- [P2] L372-375（UpdateExpert）: user_id 仅在 nil 时回退 existing.UserID，客户端可提交任意 user_id（store 不做租户归属校验直接写入）；跨租户 user_id 产生悬空绑定，同租户可改绑他人账号。建议校验 user_id 属本租户或强制回退。
- 其余（GetProfile/UpdateProfile/专家 CRUD/改密/合作视图等）鉴权与错误映射正确；CreateExpert 的 service 会强制覆盖 UserID 与租户（partner.go L311），响应回显 initialPassword 为管理员本人提交值的回显确认，不构成泄露。

## `backend/internal/handler/partner_handler_test.go`（1170 行）
- 完整逐行检查：完成
- 未发现问题。覆盖注册/登录/me、资料部分更新兜底（L425-528）、专家 isPublic 兜底（L532-594）、合作状态流转（L637-715）、合作内容过滤（L718-799）、测评任务隔离（L803-972）、多企业登录选租户（L984-1169）；cleanupPartnerTenant 的租户删除依赖 alliance_experts 的 ON DELETE CASCADE（migration 140），无残留问题。


### report-015-016.md

# 代码审查报告 015-016（backend/handler）

> 审查范围：批次 015（12 文件）+ 批次 016（10 文件），全部为 backend/internal/handler 下文件。
> 依据：docs/code-review/REVIEW-GUIDE.md（逐行完整阅读、严重级别、报告模板）+ docs/refactor-layering.md（分层红线）。
> 说明：refactor-layering.md 将"分层红线"标为 P0 门禁且宣称"P0-P3 全部收口"；本批次多个 import/export handler 仍直接在 handler 层执行 SQL，属红线必报项，按指南严重级别归入 P1（结构性架构违规，非运行时高危）。

## `backend/internal/handler/period_slot_replace_test.go`（155 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/point_levels_handler_test.go`（109 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/portal_handler.go`（530 行）
- 完整逐行检查：完成
- [P2] L56/L84: `dash.Announcements` 在构造结构体时（L56）同步调用一次 listAnnouncements，非管理员分支（L84）又在 goroutine 中再次调用覆盖——非管理员每次工作台请求该查询执行两次且第一次结果被丢弃，同时该查询先于 wg 并行段串行执行，削弱了并行化收益（最佳实践: 删掉 L56 的初始化，改为仅在 schoolAdmin 分支或非管理员 goroutine 内各取一次）。
- [P2] L205: `examEvents, _ := h.Service.ListExamEvents(...)` 错误被忽略且无日志，查询失败时考试日程从工作台静默缺失（最佳实践: 记录 slog.Error，与同文件其他查询一致）。
- [P2] L462: 节次标签按"多个节次名 join 后的整串"（L449 periodName）查 periodLabel，而 PeriodLabelMap 的键是单个节次名（如"上午1"），多节次排课永远查不到标签；与 L166/L193 按 `periodNames[0]` 单节次查询的行为不一致，此分支实际为死代码（最佳实践: 与 listSchedule 统一按单节次名查，或对每个节次分别映射后拼接）。
- [P2] L136/L149/L351: 学生场景下 UserClassNodeID 在同一请求内被查询 3 次（listTodos、listSchedule、listStudentExams 各一次），可先取一次后传参复用（最佳实践: WorkspaceDashboard 内取一次 classNodeID 传入各列表函数）。

## `backend/internal/handler/portal_handlers_test.go`（231 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/portal_learning_test.go`（208 行）
- 完整逐行检查：完成
- [P2] L79-87: 插入 scenarios（L79-82）与 scenario_tasks（L84-87）时未写入 tenant_id（该列可空，见 001_baseline.up.sql L1020），而清理语句 L155-156 均按 tenant_id 过滤（`DELETE FROM scenario_tasks WHERE scenario_id IN (SELECT id FROM scenarios WHERE tenant_id=$1)`、`DELETE FROM scenarios WHERE tenant_id=$1`），清理不生效，测试库中残留 NULL 租户的孤儿场景/任务且跨测试累积（最佳实践: 插入时带 tenant_id，与 portrait_dashboard_test.go 一致，或在清理时按场景 ID 精确删除）。

## `backend/internal/handler/portal_workspace_test.go`（133 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/portrait_dashboard_test.go`（168 行）
- 完整逐行检查：完成
- 未发现问题（L143 的 `env.Do` 走 OperatorToken 鉴权，无未鉴权疑点；userId 查询参数由同租户管理员读取学生画像，属既有设计）。

## `backend/internal/handler/position_ability_handler.go`（200 行）
- 完整逐行检查：完成
- [P2] L153: `if req.Weight == 0 { req.Weight = binding.Weight }` 以 0 作为"未携带"哨兵，导致无法将权重显式更新为 0（与 L144-152 用 nil 判空的其他字段策略不一致）（最佳实践: 改用 *float64 或显式字段存在标志）。
- [P2] L74-81（Create）/L113-139（Update）: 仅校验 CareerPositionID 的租户归属，未校验 ResponsibilityID / AbilityPointID 是否属于当前租户或该岗位，攻击者若已知他租户 UUID 可将外部能力点/职责引用写入本租户绑定（影响限于引用完整性，需已知 UUID；最佳实践: 追加对 responsibility/abilityPoint 的租户归属校验，与岗位一致）。

## `backend/internal/handler/position_certificate_handler.go`（185 行）
- 完整逐行检查：完成
- [P2] L40-44: `if err != nil || !verifyTenantOwnership(w, r, posTenant) { respondError(w, http.StatusNotFound, "岗位不存在"); return }` —— 租户不匹配时 verifyTenantOwnership（common.go L325-336）已写入 403 响应并返回 false，随后 respondError 再次写 404，导致重复 WriteHeader（Go 记录 superfluous 警告）且 403 JSON 与 404 JSON 拼接成损坏响应体（最佳实践: 与同仓其他 handler 一致，先 `if err != nil { return }` 再单独 `if !verifyTenantOwnership(...) { return }`）。
- 复用候选: crudConfig 框架已正确套用（与 position_responsibility_handler 一致），无重复代码问题。

## `backend/internal/handler/position_clone_handler.go`（72 行）
- 完整逐行检查：完成
- 未发现问题（L39 以 `err.Error() != "EOF"` 判空请求体可改 `errors.Is(err, io.EOF)`，价值低，按指南不报）。

## `backend/internal/handler/position_delete_cleanup_test.go`（109 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/position_export_handler.go`（232 行）
- 完整逐行检查：完成
- [P1] L60-64/L72/L78/L94/L111/L161/L165-172: handler 层直接执行 SQL（`h.Store.Q().QueryRow/Query/Exec` + 多条 SELECT/UPDATE），违反 docs/refactor-layering.md 分层红线（"handler 层出现 SELECT/INSERT/UPDATE/DELETE 或直接 db.Query/QueryRow/Exec（含 import/export/template）"，export 类别被明确覆盖；该红线在规范中标注为 P0 门禁）（最佳实践: 下沉 store，如 positions 域提供 ExportRows/ExportBindings 批量查询方法，handler 仅做解析与 Excel 组装）。
- [P2] L55-132: 循环内逐条 SQL——每个岗位最多 5 次查询（岗位/行业/专业/证书/批次）+ 每岗位 1 次绑定查询，导出大量岗位时查询次数线性放大（导出属非核心接口可容忍慢，但与红线修复一并下沉为批量查询更优）。
- 复用候选: 与 question_bank_export_handler.go、question_export_handler.go 三个导出 handler 同构（鉴权/租户/ID 解析/模板生成/逐行填充/写文件），可抽象通用 Excel 导出骨架。

## `backend/internal/handler/position_handler.go`（654 行）
- 完整逐行检查：完成
- [P2] L210-212: `if req.ShortName == nil || *req.ShortName == "" { req.ShortName = existing.ShortName }` —— 空串也回退已有值，导致无法将 shortName 清空；而同文件 Description/CoverImage/CareerPath 等 *string 字段以"nil 回退、空串可清空"处理，策略不一致（最佳实践: 统一为 nil 判空）。
- [P2] L555: ToggleFavorite 中 `cnt, _ := h.Service.FavoriteCount(...)` 错误被忽略，查询失败时收藏数静默显示 0（GetFavorite L532 有日志，此处无）（最佳实践: 记录 slog.Warn 后回落 0）。

## `backend/internal/handler/position_import_handler.go`（466 行）
- 完整逐行检查：完成
- [P1] L107/L132-139/L147-152/L159/L170/L188/L200-205/L213/L216/L225/L284/L289/L318-321/L343/L360/L371/L376/L378/L387/L391/L396/L400/L402/L411/L413/L417: handler 层直接执行 SQL 20+ 处（SELECT/INSERT/UPDATE/DELETE 遍布 importPositions/importResponsibilities 及全部 lookup/findOrCreate 辅助函数），严重违反 docs/refactor-layering.md 分层红线（import 类别明确覆盖，红线标注 P0 门禁）（最佳实践: 将整文件下沉为 store 的 PositionImportStore（事务内批处理），handler 仅保留文件解析与结果聚合）。
- [P2] L147-152: overwrite 覆盖模式清理关联数据时未包含 ability_domains（仅清 career_position_majors/position_certificates/position_responsibilities/position_ability_bindings），旧文件的领域（ability_domains.binding_ids）在新文件不含同名领域时残留孤儿数据（最佳实践: 覆盖时一并删除该岗位的 ability_domains）。
- 复用候选: 与 question_bank_import_handler.go、program_course_import_handler.go 三个导入 handler 同构（multipart 解析/preview-execute 双模式/去重与 DuplicateItems 计数/overwrite-rename 策略/canOverwriteContent/lookupBatchID 等），可抽象通用 Excel 导入骨架。

## `backend/internal/handler/position_responsibility_handler.go`（156 行）
- 完整逐行检查：完成
- [P2] L72-77 与 L93-95: ValidateUpdate 强制要求 CareerPositionID 非空，使 ValidateUpdateExisting（L93-95）中"CareerPositionID 为空回退已有值"的分支永远不可达（死代码）；且 L102-104 SortOrder==0 回退已有值，无法显式设置 sortOrder=0（最佳实践: ValidateUpdate 与 ValidateUpdateExisting 职责对齐，SortOrder 改用指针或显式标志）。

## `backend/internal/handler/position_stats_test.go`（125 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/position_tenant_isolation_test.go`（214 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/handler/program_course_import_handler.go`（236 行）
- 完整逐行检查：完成
- [P1] L69/L174/L181: handler 层直接 `h.Store.Q().QueryRow` 执行 SELECT（方案租户校验、岗位查询、体系课查询），违反 docs/refactor-layering.md 分层红线（import 类别明确覆盖）（最佳实践: 下沉 store，如 ProgramCourseImportStore 提供 ResolvePosition/ResolveCourse/方案租户校验方法）。
- [P2] L160-190: 行级校验只检查原始行的"岗位名/课程名至少填一项"（L160-163），不检查解析结果——若岗位名查不到且课程名也未解析到，c.Name 为空串的课程仍被 append 并最终写入方案（空名称课程导入，数据质量问题）（最佳实践: 岗位/课程均未解析到时计入错误并跳过该行）。
- [P2] L164-165: `credits, _ := strconv.ParseFloat(...)`、`hours, _ := strconv.Atoi(...)` 解析失败静默为 0，非法数字会被当作 0 学分/0 学时写入（最佳实践: 解析失败计入 errors 或使用默认值并提示行号）。
- 复用候选: 与 position_import_handler.go、question_bank_import_handler.go 导入骨架同构（见 position_import_handler 条目）。

## `backend/internal/handler/question_bank_export_handler.go`（87 行）
- 完整逐行检查：完成
- [P1] L61-64: handler 层直接 `h.Store.Q().QueryRow` 执行 SELECT 读取题库基本信息，违反 docs/refactor-layering.md 分层红线（export 类别明确覆盖）（最佳实践: 下沉 store 提供 ExportBanks 批量查询）。
- [P2] L73: 批次名查询 `h.Store.Q().QueryRow(...)` 错误被忽略（批次名导出为空串且无日志）；查询未带租户过滤（bank 已租户校验、batch_id 来自本租户数据，实际风险低，但一致性欠佳）（最佳实践: 记录日志并加 tenant_id 过滤）。
- 复用候选: 与 position_export_handler.go、question_export_handler.go 导出骨架同构。

## `backend/internal/handler/question_bank_handler.go`（311 行）
- 完整逐行检查：完成
- [P2] L163: `if req.Description == nil || *req.Description == "" { req.Description = existing.Description }` —— 空串回退已有值，无法清空 description（与 CoverImage L166 仅 nil 回退的策略不一致）（最佳实践: 统一为 nil 判空）。

## `backend/internal/handler/question_bank_import_handler.go`（209 行）
- 完整逐行检查：完成
- [P1] L117（lookupBatchID）/L137/L162-164/L180/L191-195: handler 层直接执行 SQL（SELECT/UPDATE/INSERT），违反 docs/refactor-layering.md 分层红线（import 类别明确覆盖）（最佳实践: 下沉 store 提供 QuestionBankImportStore 批量方法，handler 仅做文件解析与结果聚合）。
- 复用候选: 与 position_import_handler.go、program_course_import_handler.go 导入骨架同构（见 position_import_handler 条目）。

## `backend/internal/handler/question_export_handler.go`（238 行）
- 完整逐行检查：完成
- [P1] L138: handler 层直接 `h.Store.Q().QueryRow` 执行 SELECT（知识点名称查询），违反 docs/refactor-layering.md 分层红线（export 类别明确覆盖）（最佳实践: 下沉 store 提供 BatchKnowledgePointNames 批量查询，顺带消除 L128-144 的逐 ID 查询循环）。
- [P2] L106-111: 选项最多写入 4 列（C-F，`'C'+i` 到 `'C'+3`），且 mapOptionToLetter（L222-238）仅映射前 4 个选项（索引 0-3），选项数超过 4 的题目导出时丢选项（最佳实践: 按题目实际选项数动态分配列或追加备注列）。
- 复用候选: 与 position_export_handler.go、question_bank_export_handler.go 导出骨架同构（见 position_export_handler 条目）。


### report-017-018.md

# 代码审查报告 017-018（backend/internal/handler）

审查依据：`docs/code-review/REVIEW-GUIDE.md`（完整逐行阅读，禁止抽样；按严重级别 P0/P1/P2 与报告模板执行）。
批次：017（6 文件，1383 行）+ 018（4 文件，2795 行）。

---

## `backend/internal/handler/question_handler.go`（318 行）
- 完整逐行检查：完成
- 鉴权/租户隔离检查：List/Get/Create/Update/Delete/BatchCreate 均有 CurrentUser 判空；Create/Update/BatchCreate 通过 checkBankTenant（L104/L194/L286）校验目标题库归属当前租户，防跨租户写他人题库；Delete 有 GetQuestion 租户限定 + 引用检查（L248）防破坏试卷快照。未发现越权问题。
- [P2] L76-79: `marshalJSON` 忽略 `json.Marshal` 错误（`b, _ :=`），出错时静默返回空串；此处字段为 string slice/JSONSlice，实际不会失败，属低风险，但建议返回 error 或至少记录日志，与其它 marshal 处理保持一致性。

## `backend/internal/handler/question_import_handler.go`（372 行）
- 完整逐行检查：完成
- [P1] L19/L40/L84/L193/L219-222/L237/L249-252: 违反后端分层红线——handler 直接持有 `*store.Store` 字段（L19），并在 handler 内直写 SQL：`SELECT id FROM question_banks ...`（L40、L84）、`SELECT id, COALESCE(creator_id...) FROM questions ...`（L193）、`UPDATE questions SET ...`（L219-222）、`SELECT id FROM questions ...`（L237）、`INSERT INTO questions ...`（L249-252）。规范见 `docs/refactor-layering.md`（import 明确在红线范围内），应下沉到 service/store 并带测试。
- [P2] L248: `code := generateEntityCode("TM")` 走 `store.GenerateEntityCode`（8 位随机码，无库内唯一性校验），而 question_handler.go L108 走 `Service.GenerateEntityCode`（`store.GenerateUniqueEntityCode`，含存在性校验与重试）。两条编码路径并存，导入路径存在编码冲突（唯一约束失败导致整行 Failed，或无约束时产生重复 code）风险，应统一走唯一编码路径。
- [P2] L172-173: `answerJSON, _ := json.Marshal(answer)`、`optionsJSON, _ := json.Marshal(options)` 忽略序列化错误（同 question_handler.go 的 marshalJSON 问题）。
- [P2] L281-288: `mapQuestionType` 对无法识别的题型默认返回 `"single"`，用户填错题型（如"单选"）会被静默当成单选题导入，缺少告警；建议未知类型计入 Failed 并提示。
- 性能说明：逐行 SELECT 存在性 + 逐行 INSERT/UPDATE 为导入场景固有模式，且要求管理员权限，按指南非核心接口允许慢，不记问题。

## `backend/internal/handler/random_draw_question_handler.go`（119 行）
- 完整逐行检查：完成
- 未发现问题。CRUD 走统一 crudConfig 框架，TenantFn=requireTenant，GetByIDFn/UpdateFn/DeleteFn 均带 tenantID 租户限定查询，隔离完整；List 有 CurrentUser 判空。

## `backend/internal/handler/recommend_handler.go`（116 行）
- 完整逐行检查：完成
- 未发现问题。CreateFn（L69-75）对 CareerPositionID 校验 `pos.TenantID != tenantID` 防跨租户关联；GetByIDFn 租户限定；TenantFn=requireTenant。List 有 CurrentUser 判空。

## `backend/internal/handler/resource_code_handler.go`（120 行）
- 完整逐行检查：完成
- 鉴权/租户隔离检查：写操作经 crud 框架 Permit=canManagePortal（L50-52）+ CheckOwnership/GetOwnership + TenantIDFn（L100-102）校验实体租户归属；Create 经 verifyRequestTenant（L64）校验请求 tenantId。未发现越权。
- [P2] L26-39: `List` 未显式校验登录（仅依赖 `listParamsFromRequest(r, true)` 在无 claims 时返回 ok=false → 403"缺少租户信息"），与同目录其它 List（先判 CurrentUser 返回"权限不足"）风格不一致；鉴权本身有效，属一致性/可读性问题。

## `backend/internal/handler/resource_export_handler.go`（332 行）
- 完整逐行检查：完成
- [P1] L20/L113/L139/L149/L211/L287-289/L309: 违反后端分层红线——handler 直接持有 `*store.Store`（L20）并在 handler 内直写 SQL：`Query` 组织/用户列表（L113、L211）、`QueryRow` org_types/organizations/staff_titles（L139、L149、L287-289、L309）。export 明确在红线范围内，应下沉 store。
- [P2] L137-143/L145-156: 导出组织时对每行分别 `QueryRow` 查组织类型名与上级组织名（N+1），可并入主查询一次 JOIN 取回（或整表预载 map）。
- [P2] L276-300/L302-315: `buildAncestorChain` 对每个用户逐层级查询、`lookupTitleNames` 对每个职称逐条查询，师生导出在大数据量时延迟明显（管理端非核心，可接受，但建议批量预取组织链/职称名）。
- [P2] L52-55: body JSON 解码失败一律按"导出全部"处理（`req.IDs = nil`），畸形请求体也会触发全量导出；建议区分"空 body"与"非法 JSON"（后者 400）。
- 复用候选: `buildAncestorChain`（L276-300）与 resource_import_handler.go L880-904 逻辑几乎完全相同（同签名、同循环防环实现），可提取为 handler 包共享函数。

## `backend/internal/handler/resource_import_handler.go`（2186 行）
- 完整逐行检查：完成
- [P1] L23 及全文件直写 SQL: 违反后端分层红线——handler 持有 `*store.Store` 字段（L23），并在 handler 内直写大量 SELECT/INSERT/UPDATE（代表性行号：L191/L203-206/L222/L229-232/L268/L285 行业；L324/L335-338/L352/L359-362 专业；L395/L441/L452-455/L471/L478-481 组织；L573-576/L699-702/L728/L730/L748/L757/L763/L778-785/L791-794 用户/角色；L830-832/L891-893 组织路径；L1056-1060/L1080-1087 项目；L1140/L1150-1154/L1175-1185 成果；L1248-1252/L1272-1277 协议；L1321/L1331-1334/L1355-1359 权限；L1435/L1445-1452/L1466/L1473-1479 品牌）。import 明确在红线范围内，应下沉 service/store。
- [P2] L809-821: 路径分隔符优先级 bug——`separators = []string{"-", "/", "\\", "->", "_"}` 中 `"-"` 排在 `"->"` 之前，任何含 `"-"` 的路径（包括 `"学校->学院"`）都会先按 `"-"` 拆分，产生孤立 `">"` 段，多候选消歧必然失败（fallback 单候选时侥幸成功）。应将 `"->"` 置于 `"-"` 之前或改用正则按优先级匹配。
- [P2] L657-670 与 L547-555: 教师导入的组织路径解析失败仅记错误并继续（不带 org 节点创建用户），而学生导入解析失败整行 Failed——同为组织归属解析，行为不一致，易造成导入结果与用户预期不符。
- [P2] L573-576/L699-702: overwrite 模式下对已存在用户无条件重置 `password_hash`；若仅需更新姓名/班级/状态而重复导入（sheet 密码列填写旧值或默认值），会静默重置全部学生/教师登录密码。建议：未变化的密码列可跳过重置，或明确提示覆盖会重置密码。
- [P2] L726-736: 教师创建后又 `SELECT id FROM users` 再 `UPDATE users SET title_ids`（两次往返）；`createUser` 可直接接收 titleIDs 一并写入，减少往返并消除按 username 二次匹配的竞态窗口。
- [P2] L790-794: `user_roles` INSERT 错误被 `_, _ =` 忽略，但 `roles.user_count` 无条件 `+1`，插入失败时计数漂移（低概率，简单修复：先判 err）。
- [P2] L1422-1432/L1435 等: 通用品牌导入对每行执行 6 次名称→ID 查询（users/partner_enterprises/career_positions/majors/alliance_experts）+ 存在性查询，N+1 明显；大批量导入延迟高，可先整表预载 `name→id` 映射。
- [P2] L862-870: `findOrgNodeByPath` 对每个候选节点逐级查询祖先链（每行多级查询），导入班级归属时可预载组织树一次解析。
- 复用候选: `doImport*`（Industries/Majors/Organizations/Students/Teachers/Projects/Achievements/Agreements/Permissions/BrandsGeneric，10 处）重复"读取 Sheet → 跳过表头 → 校验 → 存在性查询 → overwrite/rename/skip 三分支 → INSERT/UPDATE + 计数"骨架，可抽象为通用逐行导入框架（配置列映射 + 实体 upsert 回调）；`buildAncestorChain`（L880-904）与 resource_export_handler.go L276-300 重复。

## `backend/internal/handler/resource_library_handler.go`（276 行）
- 完整逐行检查：完成
- 未发现问题。全部读写经 Service；鉴权由 requireTenant（claims 判空，common.go L305-312）覆盖，Get/Update/Delete 经 verifyTenantOwnership 校验租户归属（L153/L206/L267）；Update 采用指针字段部分更新语义（L224-244），可显式清空 URL/描述等字段，语义正确；分页限流 parseLimitOffset(r, 50)。

## `backend/internal/handler/resource_library_handler_test.go`（176 行）
- 完整逐行检查：完成
- 未发现问题。三组用例（分页 L60-92、按类型统计 L95-133、导入重名校验 L137-176）覆盖完整，测试数据用随机前缀隔离并 t.Cleanup 清理，固定 uuid 用户避免 22P02 类型错误（L20 注释准确）。

## `backend/internal/handler/role_handler.go`（153 行）
- 完整逐行检查：完成
- 鉴权/租户隔离检查：CRUD 经 crud 框架 Permit=canManagePortal + CheckOwnership/GetOwnership + TenantIDFn 校验归属；Assign（L112-153）对角色租户、目标用户租户双重 verifyTenantOwnership，隔离完整。未发现越权。
- [P2] L14-16: handler 直接持有 `*store.RolesStore` 字段并直调 store 方法（未走 Service 层），与同仓 Service-based handler（question/recommend/resource_library 等）模式不一致；未违反"持有 *pgxpool.Pool"红线，但建议统一为 Service 封装。
- [P2] L29-42: `List` 无显式登录检查，依赖 `executeListQuery` 内部租户校验返回 403"缺少租户信息"，与其它 handler 风格不一致（一致性/可读性）。

---

## 汇总

| 文件 | P0 | P1 | P2 |
|------|----|----|----|
| question_handler.go | 0 | 0 | 1 |
| question_import_handler.go | 0 | 1 | 3 |
| random_draw_question_handler.go | 0 | 0 | 0 |
| recommend_handler.go | 0 | 0 | 0 |
| resource_code_handler.go | 0 | 0 | 1 |
| resource_export_handler.go | 0 | 1 | 3 |
| resource_import_handler.go | 0 | 1 | 7 |
| resource_library_handler.go | 0 | 0 | 0 |
| resource_library_handler_test.go | 0 | 0 | 0 |
| role_handler.go | 0 | 0 | 2 |
| **合计** | **0** | **3** | **17** |

复用候选：3（① buildAncestorChain 在 export/import 两个 handler 重复；② doImport* 十个函数的逐行导入骨架可抽象；③ 题目编码生成双路径 generateEntityCode/GenerateEntityCode 应统一）。


### report-019-020.md

# 代码审查报告 019-020（backend/handler 批次）

审查方式：按 REVIEW-GUIDE.md 对批次清单（/tmp/batches/019-backend.json、/tmp/batches/020-backend.json）中每个文件完整逐行阅读（read 工具，无跳读），行号均经 read 工具核对。仅审查，未修改任何源代码。

---

## `backend/internal/handler/role_handler_test.go`（225 行）
- 完整逐行检查：完成
- [P2] L172: 声明 `ctx` 仅用于 `_ = ctx` 消除未使用变量告警（TestRole_Delete 中 ctx 实际未被任何 DB 调用使用），属死代码（最佳实践: 删除未使用的 ctx 声明与 `_ = ctx` 赋值）
- 其余未发现问题。测试经 testhelper 走 HTTP 路由，直接 SQL 仅用于测试数据准备/清理，符合测试惯例。
- 复用候选: 6 个测试函数（Create/List/Get/Update/Delete/Assign）各自重复定义 `do` 闭包与 schoolAdminToken 初始化样板（L19-21、L47-49、L81-83、L115-117、L152-154、L184-186），可提取为 testhelper 共享的请求 helper

## `backend/internal/handler/role_isolation_test.go`（68 行）
- 完整逐行检查：完成
- [P1] L52-55: TestStudentCannotViewOthersExamResult 断言 `w.Code != http.StatusOK && w.Code != http.StatusBadRequest && w.Code != http.StatusForbidden` 才失败，即响应 200 时测试**照样通过**——与注释"学生传他人 usageId 拉成绩列表……应返回 400/403 而非他人数据"的自述意图直接矛盾，且从未校验响应体内容；若回归导致接口返回 200 携带他人成绩数据，该安全回归测试不会报警（最佳实践: 明确断言 400/403，或断言 200 时响应 items 为空且不含他人 usageId 数据）
- 其余未发现问题（其余用例均严格断言 403）

## `backend/internal/handler/scenario_clone_handler.go`（73 行）
- 完整逐行检查：完成
- [P2] L20-23/L45: CloneScenarioRequest.Code 字段被解析但从不使用（Clone 仅传 req.Name 给 service，新 code 由 service 生成），对外 API 契约包含误导性字段（最佳实践: 移除 Code 字段，或显式支持自定义 code 并传入 service）
- 其余未发现问题（`err == service.ErrScenarioNotInTenant` 哨兵比较安全：service.CloneScenario 直接返回该哨兵未经包装；克隆后按租户前缀失效列表缓存与 scenario_handler.go 一致）

## `backend/internal/handler/scenario_export_handler.go`（222 行）
- 完整逐行检查：完成
- [P1] L75/L80/L113/L156/L171/L186/L201: handler 层直接执行 SQL（h.Store.Q().QueryRow 多行），违反后端分层红线"handler 层出现 SELECT/…/或直接 db.Query/QueryRow/Exec（含 import/export/template）"；L156 lookupNames 还以 `fmt.Sprintf` 拼接表名（虽为内部常量 "industries"/"majors" 非用户输入，但绕过了 store 层 SanitizeIdentifier 白名单校验）（最佳实践: 将导出查询收敛为 store 方法，表名经白名单校验后由 store 拼接）
- [P1] L55-94: fillScenariosData 对每个导出 scenarioID 直接 `h.Store.Scenarios().Get(ctx, sid)` 后填充数据，全程**无租户归属校验**（对比 scenario_handler.go Get/Update/Delete 均有 verifyTenantOwnership，clone handler 有 ErrScenarioNotInTenant 检查）；decodeIDList 仅解析 ids 不校验归属，任意登录用户可传他人租户 scenarioID 导出其场景基本信息、岗位/批次名称、任务与知识点/能力点/资源名称（越权访问他人数据）（最佳实践: 导出前对每个 ID 校验租户归属，不属本租户的 ID 跳过或报错）
- 其余未发现问题（逐 ID 查询为导出类非核心接口，按指南"非核心接口允许慢"不报 N+1）

## `backend/internal/handler/scenario_grade_handler.go`（109 行）
- 完整逐行检查：完成
- 未发现问题。Upsert 先校验必填、再校验场景租户归属、更新时再校验既有映射归属，双校验防越权；无直接 SQL。

## `backend/internal/handler/scenario_handler.go`（374 行）
- 完整逐行检查：完成
- [P2] L240-243: Update 中 `if difficulty == 0 { difficulty = existing.Difficulty }`，客户端无法显式将难度设为 0（0 被当作"未传"）（最佳实践: 用 *int 区分未传与显式 0，或确认业务上 0 非法后加文档说明）
- [P2] L244-247: CoBuilderIDs `if coBuilderIDs == nil { coBuilderIDs = existing.CoBuilderIDs }`，无法通过提交空数组清空共建人（与其他字段的 NullableStringSlice 清空语义不一致）（最佳实践: CoBuilderIDs 改用 NullableStringSlice 或区分 nil/空数组）
- [P2] L125-133: `var userID, tenantID any` 使用裸 any 类型传递给 recordViewAsync，丢失类型信息（最佳实践: 声明为 string/*string 具体类型）
- 其余未发现问题（Get 学生仅读已发布；Create/Update/Delete 租户归属校验齐全；写入后失效列表缓存；错误分支处理正确）

## `backend/internal/handler/scenario_import_eval_method_test.go`（24 行）
- 完整逐行检查：完成
- 未发现问题。mapEvalMethod 映射表覆盖含首尾空格、未知、空串用例。

## `backend/internal/handler/scenario_import_eval_weight_test.go`（107 行）
- 完整逐行检查：完成
- 未发现问题。测试构造 handler 时 RedisClient 为 nil 安全（cache.InvalidatePrefix 对 nil client 直接返回）；权重等分断言（4 种各 25）验证了修复目标。

## `backend/internal/handler/scenario_import_handler.go`（433 行）
- 完整逐行检查：完成
- [P1] L124/L149-155/L162-163/L171/L183-188/L247-254/L273-285/L307/L324/L343/L362: handler 层大量直接 SQL（QueryRow/Exec，SELECT/UPDATE/DELETE/INSERT 全覆盖），违反后端分层红线"handler 层出现 SELECT/INSERT/UPDATE/DELETE 或直接 db.Query/QueryRow/Exec（含 import/export/template）"，import 场景被红线明示包含（最佳实践: 全部收敛为 store 层方法，参考同包 schedule_import_handler.go 的 store.ClearDraftScheduleEntries/store.InsertScheduleEntry 模式）
- [P1] L263-271: evalMethodNames 非空但全部无法映射时（如文件填"未知方式"），validMethods 为空切片，`weight := 100.0 / float64(len(validMethods))` 除零得 +Inf，INSERT 将 `weight=Infinity` 写入 task_evaluation_methods，后续评分均分/综合分计算产生 Inf/NaN，直接损坏评分数据（最佳实践: len(validMethods)==0 时跳过写入并计入错误/跳过计数）
- [P2] L162-163: 覆盖模式下两条 DELETE（task_evaluation_methods、scenario_tasks）的错误被忽略，删除失败时旧任务残留，叠加后续 INSERT 可能产生重复 task code（TSK-前缀按场景内计数器生成）与新旧混合数据（最佳实践: 检查 Exec 错误并计入 result.Failed/Errors）
- [P2] L181: 导入场景 code 用 `generateEntityCode("CJ")`（store 随机码，无唯一性校验），与 scenario_handler.go Create 使用的 `h.Service.GenerateEntityCode`（带 DB 唯一性重试）不一致；碰撞时依赖唯一约束报错计入 failed，概率虽低但行为不一致（最佳实践: 统一走 service.GenerateEntityCode 或 store.GenerateUniqueEntityCode）
- 其余未发现问题（租户/用户均取自 claims 经 requireTenant/parseMultiImportRequest，无越权；overwrite 覆盖前有 canOverwriteContent 权限判断）

## `backend/internal/handler/scenario_import_resource_type_test.go`（110 行）
- 完整逐行检查：完成
- 未发现问题。覆盖各后缀类型推断、无后缀/未知后缀归 other、同名命中不重复创建，断言完整。

## `backend/internal/handler/scenario_task_handler.go`（323 行）
- 完整逐行检查：完成
- [P1] L56-64: List 的"学生仅可查已发布场景任务"守卫仅在请求携带 scenarioId 参数时生效；学生不带 scenarioId 直接列表时（`/api/v1/scene/tasks?tenantId=…`）跳过守卫返回本租户**全部**任务（含 draft 场景任务），与注释"防枚举未发布场景任务"意图不符，是条件性失效的越权防护（最佳实践: 学生场景下强制要求 scenarioId 且校验该场景已发布，或服务端按学生角色过滤已发布场景任务）
- [P1] L73-89: Get 只校验租户归属，无学生/已发布校验——学生可凭任务 ID 直接读取 draft 场景的任务详情（与 scenario_handler.go Get 的"学生仅可读已发布"决策 7 不一致）（最佳实践: Get 中追加与学生列表相同的已发布场景校验）
- [P2] L200-208: Update 兜底 `if req.SortOrder == 0 { 回退 }`、`if req.EstimatedHours == 0 { 回退 }`、`if !req.IsReferenced { 回退 }` 导致无法显式设置 sortOrder=0、estimatedHours=0、isReferenced=false（最佳实践: 用指针/显式布尔区分未传与零值）
- 其余未发现问题（Create/Update/Delete/Reorder 场景租户归属校验齐全；Delete 处理 ErrResourceInUse 返回 409）

## `backend/internal/handler/scenario_weight_handler.go`（101 行）
- 完整逐行检查：完成
- 未发现问题。Upsert 对场景租户归属与既有配置归属双校验，防越权；无直接 SQL。

## `backend/internal/handler/scene_handler_test.go`（1249 行）
- 完整逐行检查：完成
- 未发现问题。测试覆盖 CRUD/状态流转/校验错误/测评方式（含 score_rule、临时试卷幂等、部分保存）、权重/等级映射/克隆等核心链路，均经 HTTP 路由断言状态码与关键数据；L560-562 nil 判断正确（失败分支才解引用非 nil 值）。

## `backend/internal/handler/scene_task_ability_names_test.go`（101 行）
- 完整逐行检查：完成
- 未发现问题。验证列表/详情返回能力点名称（修复 maxPageSize=200 截断导致的预览缺名），断言完整。

## `backend/internal/handler/scene_task_knowledge_names_test.go`（100 行）
- 完整逐行检查：完成
- 未发现问题。验证列表/详情返回知识点名称，断言完整。

## `backend/internal/handler/schedule_import_day_test.go`（68 行）
- 完整逐行检查：完成
- 未发现问题。parseDayOfWeek/parseWeekMatrix/normalizePeriods 边界用例覆盖充分（空串、空白、中文/数字、未知输入）。

## `backend/internal/handler/schedule_import_handler.go`（415 行）
- 完整逐行检查：完成
- [P2] L102/L118/L190: `overwrite := importOverwriteParam(r)` 读取后传入 importFromCourseList，但函数体内从未引用该参数——"清空重排"（ClearDraftScheduleEntries）无条件执行，overwrite=false 与 true 行为完全相同，请求参数为死参数（最佳实践: 若导入语义固定为清空重排，删除 overwrite 参数；若需支持追加/不清空模式，在事务内按 overwrite 分支处理）
- [P2] L225-226: startWeek/endWeek 的 `strconv.Atoi` 错误被忽略，非法周次静默转为 0，且 endWeek < startWeek 未校验，会写入周次区间 0-0 的无效排课数据（最佳实践: 解析失败/区间非法时计入 result.Failed/Errors 并跳过该行）
- 其余未发现问题（数据读写全部经 store 层方法，符合分层红线；termId 校验租户归属；事务内缓存课程/班级/教师/场地查询避免 N+1；清空与重建同事务保证原子性）

---

## 汇总
- 审查文件数：17（019 批次 12 个，020 批次 5 个）
- 问题统计：P0 = 0，P1 = 7，P2 = 10
- 后端分层红线：发现 2 个文件违反（scenario_import_handler.go、scenario_export_handler.go 在 handler 层直写 SQL，import/export 为红线明示包含场景）；schedule_import_handler.go 走 store 层方法，符合红线
- 复用候选：3 处
  1. role_handler_test.go 6 个测试重复 do 闭包/授权样板，可提取 testhelper 请求 helper
  2. scenario_import_handler.go 的 h.lookupCareerPosition/h.lookupIndustries/h.lookupProfessions/h.lookupAbilityPoints 与 import_common.go 的 lookupIDByName/lookupSingleIDByName 功能重复（按租户+名称查 ID），且前者绕过白名单直写 SQL，可统一收敛到 store 白名单查询
  3. mapTaskType（scenario_import_handler.go，中文→英文）与 mapTaskTypeToChinese（scenario_export_handler.go，英文→中文）为互逆映射分散两处，应合并为单一共享映射表


### report-021-022.md

# 代码审查报告 021-022（backend/internal/handler）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，禁止抽样/跳读；行号经 read 工具核对）。
范围：批次 021（11 文件）+ 批次 022（14 文件），共 25 文件。仅审查与报告，未修改任何源代码。

---

## `backend/internal/handler/scheduling_handler.go`（1045 行）
- 完整逐行检查：完成
- [P2] L292-296: DeletePeriodSlot 未处理外键冲突：节次已被排课引用时删除会直接 500；而同文件 DeleteVenue（L145-148）已用 isForeignKeyViolation 返回友好 400（"该场地已被排课引用"），行为不一致（最佳实践: 与 DeleteVenue 一致，捕获外键冲突返回 400）
- [P2] L396-503 / L505-594: CreateSchedule 与 UpdateSchedule 重复实现同一段组装逻辑：entryType/weekPattern 默认值（L440-447、L531-538）、courseID 解析（ResolveCourseIDByCode + PlanEntryCourseID 覆盖，L449-457、L540-552）、classIDs 合并与 primaryClass 兜底（L459-466、L553-560）、冲突 409 响应（L492-495、L583-586）几乎逐行重复（最佳实践: 抽公共辅助函数解析 ScheduleCreateParams，两处复用）
- 复用候选: CreateSchedule/UpdateSchedule 的入参组装与冲突响应逻辑（见上）

## `backend/internal/handler/settings_handler.go`（112 行）
- 完整逐行检查：完成
- 未发现问题（GetTheme 租户回退逻辑 L33-43 与平台默认回退 L45-49 处理正确；主题色正则校验完整；UpdateTheme/UpdateTenantTheme/DeleteTenantTheme 的权限由 admin 路由中间件保证，测试亦覆盖 401/403）

## `backend/internal/handler/settings_handler_test.go`（139 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/snapshot_handler.go`（67 行）
- 完整逐行检查：完成
- 未发现问题（租户双重限定 + 学生角色 L63-65 经 StripStudentAnswers 剥离答案/解析，符合安全要求）

## `backend/internal/handler/snapshot_handler_test.go`（423 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/staff_title_handler.go`（222 行）
- 完整逐行检查：完成
- 未发现问题（crudConfig 骨架 + 租户归属校验 + DeleteChecks 引用检查完整；ToggleStatus 有 canManageUsers 与 verifyTenantOwnership）

## `backend/internal/handler/staff_title_handler_test.go`（96 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/stats_handler.go`（15 行）
- 完整逐行检查：完成
- 未发现问题（MyStats 为返回固定 0 的占位实现，属有意桩代码，无安全隐患）

## `backend/internal/handler/student_honor_handler.go`（155 行）
- 完整逐行检查：完成
- 未发现问题（List 学生强制本人 L57-59；增删改限学生角色 L79/110/141；业务用户按 userId 只读为预期设计）

## `backend/internal/handler/student_honor_test.go`（96 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/student_portrait_handler.go`（313 行）
- 完整逐行检查：完成
- [P2] L212-217: Generate 用 context.WithTimeout(context.Background(), 30*time.Minute) 脱离请求上下文并同步阻塞 HTTP 请求最长 30 分钟：前端/网关可能先超时、长连接与连接池被占用，且客户端无法取消（最佳实践: 改为异步任务 + 轮询结果，或至少绑定请求上下文让客户端可取消）
- [P2] L253-290: CreateArchive 未像 Generate（L205-209）那样校验 req.UserID 属于当前租户（Generate 显式 Users().Get 校验 tenantID），跨租户写入依赖 service 层兜底，两个接口校验策略不一致（最佳实践: 与 Generate 一致，创建前校验 userId 租户归属；需确认 service 层是否已校验）
- 复用候选: Generate 的 userId 租户归属校验逻辑可提取公共函数供 CreateArchive 复用

## `backend/internal/handler/subscription_admin_ai_test.go`（183 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/subscription_handler.go`（158 行）
- 完整逐行检查：完成
- 未发现问题（Update/AdminUpdate 限 canManagePlatform 与 admin 路由；AdminUpdate 未订阅返回默认空订阅、名称/状态/有效期保留逻辑 L119-136 正确）

## `backend/internal/handler/tag_filter_regression_test.go`（133 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/tag_handler.go`（210 行）
- 完整逐行检查：完成
- 未发现问题（名称长度/颜色格式校验、重复名 409、资源类型白名单 L24-30、批量查询上限 200 L200-203 均到位）

## `backend/internal/handler/tag_handler_test.go`（273 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/task_auto_exam_naming_test.go`（136 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/task_evaluation_handler.go`（356 行）
- 完整逐行检查：完成
- [P2] L133-155: ListMethods 未校验 taskID 所属租户（同文件 SaveMethods L177-181 有 TaskTenantID 校验、Unbind 类接口也有 task→scenario→tenant 链路校验），若 service 仅按 taskID 查询而 tenantID 未参与 SQL 过滤，存在跨租户读取测评方式配置（含题目/答案/评分规则）的风险（最佳实践: 与 SaveMethods 一致，先校验任务租户归属；需确认 service 层是否按 tenantID 限定）

## `backend/internal/handler/task_knowledge_ability_handler.go`（150 行）
- 完整逐行检查：完成
- [P2] L28-52 / L81-105: BindKnowledge/BindAbility 未校验任务租户归属，而对应 UnbindKnowledge（L62-73）/UnbindAbility（L115-126）均经 verifyTaskTenant（L135-149）走 task→scenario→tenant 校验，绑定与解绑的越权校验策略不一致；若 service 未按 tenantID 限定可跨租户写入绑定关系（最佳实践: Bind 前同样调用 verifyTaskTenant；需确认 service 层校验）
- 复用候选: UnbindKnowledge/UnbindAbility 结构完全对称重复（TaskBindingTaskID → 404 兜底 → verifyTaskTenant → Unbind），verifyTaskTenant 亦与 task_resource_handler.go 的 L184-196 内联链路重复，可抽公共函数

## `backend/internal/handler/task_resource_handler.go`（202 行）
- 完整逐行检查：完成
- [P2] L141-166: BindResource 未校验 task 租户归属（UnbindResource L184-196 校验了 task→scenario→tenant 链路），绑定/解绑校验不一致，跨租户写入依赖 service 层兜底（最佳实践: Bind 前复用 task_knowledge_ability_handler.go 的 verifyTaskTenant 同类校验；需确认 service 层校验）
- 复用候选: L184-196 的 task→scenario→tenant 校验链路与 task_knowledge_ability_handler.go verifyTaskTenant 重复，可提取公共函数

## `backend/internal/handler/teaching_plan_export_handler.go`（161 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/teaching_plan_export_handler_test.go`（119 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/teaching_plan_generate_classes_test.go`（139 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/handler/teaching_plan_handler.go`（420 行）
- 完整逐行检查：完成
- 未发现问题（Generate 查重与已排课冲突保护 L108-114；UpdateEntry 状态/周次模式白名单校验 L216-246；删除外键 400 映射 L370-373）

## `backend/internal/handler/teaching_plan_handler_test.go`（53 行）
- 完整逐行检查：完成
- 未发现问题

---

## 汇总
- P0: 0
- P1: 0
- P2: 7（scheduling_handler.go 2；student_portrait_handler.go 2；task_evaluation_handler.go 1；task_knowledge_ability_handler.go 1；task_resource_handler.go 1）
- 复用候选: 3 处


### report-023-024.md

# 代码审查报告：批次 023-024（backend）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，未抽样；行号均经 read 工具核对）。

## `backend/internal/handler/template_handler.go`（1635 行）
- 完整逐行检查：完成
- [P1] L87/L98/L109/L120/L131/L142/L153、L603、L789、L830、L844、L905、L1107、L1202、L1224: handler 层直接执行 SQL（`h.Store.Q().Query/QueryRow`），违反后端分层红线（docs/refactor-layering.md：handler 禁止 SELECT/INSERT/UPDATE/DELETE 与直接 db.Query/QueryRow/Exec，且红线明确点名 import/export/template 场景）。queryDicts、queryLessonBatches、generateQuestionBankTemplate/generateQuestionTemplate/generateExamTemplate/generateOrganizationTemplate/generateTeacherTemplate/queryOrgPaths 中十余处直查 industries/majors/certificate_library/career_positions/knowledge_points/ability_points/resource_library/lesson_batches/evaluation_batches/org_types/staff_titles/organizations 表。建议统一下沉到 store/service（可收敛为 1-2 个字典/参考数据查询方法）。（最佳实践: 抽取 `store.DictQuery`/模板数据服务，handler 只组装 Excel）
- [P2] L31: `h.queryDicts(ctx, tenantID) // preload dicts` 返回值被完全丢弃，随后 L169 `generatePositionTemplate` 内部再次调用 queryDicts，导致每次下载岗位模板对 7 张字典表重复查询一遍，注释宣称的 "preload" 实际无效。应删除 L31 或将其结果传入生成函数复用。
- [P2] L88-164: queryDicts 及各内联查询出错时静默 `return`（`if err != nil { return }`），失败后仍以空数据继续生成模板，用户下载到的模板缺少参考 Sheet（行业/专业/证书等）却无任何提示。建议至少记录日志或在模板中标注加载失败。
- 复用候选: ① generatePositionTemplate/generateScenarioTemplate/generateGranularCourseTemplate/generateSystemCourseTemplate/generateQuestionBankTemplate/generateQuestionTemplate/generateExamTemplate/generateIndustryTemplate/generateMajorTemplate/generateOrganizationTemplate/generateStudentTemplate/generateTeacherTemplate/generateProjectTemplate/generateAchievementTemplate/generateAgreementTemplate/generatePermissionTemplate/generateGenericBrandTemplate 等 17 处各自重复定义局部闭包 setHdr/setA1（表头样式+行高、合并单元格说明行），可抽象为包级公共函数（如 `sheetHelpers(f *excelize.File)` 返回复用闭包），与已公共化的 addRefSheet/makeHeaderStyle 等保持一致；② L789/L844/L905 三处内联批次/知识点查询与 queryDicts 模式重复，可并入统一字典查询方法。

## `backend/internal/handler/tenant_handler.go`（1024 行）
- 完整逐行检查：完成
- [P2] L286: 注释 "内部隐藏控制台，不做鉴权，跨租户管理" 与事实不符——routes.go L279-291 中 /admin/tenants 全部 Admin* 路由实际挂在 `RequirePlatform(saas)` + `platformAdmin` 中间件之下（入口有门禁，当前无越权风险），但注释会误导后续维护者误以为无需门禁而在别处暴露同批 handler。建议更新注释，或在各 Admin* handler 内补 canManagePlatform 校验形成纵深防御。
- 其余：List/Get/Create/Update/UpdateStatus 均有角色/租户校验（canManagePlatform/canManagePortal/verifyTenantOwnership）；企业租户创建/编辑（adminCreateEnterprise/AdminUpdateEnterprise）同步租户与企业主体逻辑完整；管理员 CRUD/重置密码经 AdminService 且限超管入口；未发现 handler 层直接 SQL。

## `backend/internal/handler/tenant_handler_test.go`（827 行）
- 完整逐行检查：完成
- 未发现问题。覆盖 Create（含缺字段/重复 code/订阅默认创建）、List（租户隔离断言）、Get、Update、UpdateStatus、超管创建企业租户、企业主体查看/编辑、企业管理员 CRUD、租户-企业主体合并更新同步等，清理函数按 FK 依赖顺序删除，测试数据命名唯一避免相互干扰。

## `backend/internal/handler/tenant_validity_test.go`（74 行）
- 完整逐行检查：完成
- 未发现问题。三用例（过期禁登 403 / 未开始禁登 403 / 有效期内可登 200）逻辑清晰，defer 恢复 valid_from/valid_until 避免污染后续测试。

## `backend/internal/handler/testhelper/setup.go`（315 行）
- 完整逐行检查：完成
- [P2] L109-118: `generateTestToken` 对 operator 与 saas 两个 token 都注入 `RoleCodes: []string{domain.RolePlatformAdmin}`，即 portal 的 OperatorToken 也携带 platform_admin 角色码。任何按 `HasRole(platform_admin)` 鉴权的 handler 都会对"普通 operator"放行，测试可能掩盖越权回归（当前依赖 operator token 触达平台管理员分支的测试即使越权也会通过）。建议 OperatorToken 注入业务角色码（operator/portal），仅 SaasAdminToken 注入 platform_admin。
- 其余：TEST_DATABASE_URL 未配置时跳过并打印提示（防误连生产库，好实践）；复用生产路由装配避免漂移；token 生成、Do/DoWithToken/Unmarshal 等工具封装合理。无 P0/P1。

## `backend/internal/handler/training_program_handler.go`（403 行）
- 完整逐行检查：完成
- [P2] L111-115: Create 未把 `req.BatchID` 传入 `store.TrainingProgramParams`，而 Update（L170-174）支持 BatchID 且请求结构体（L27）声明了该字段——创建人培方案时 batchId 被静默丢弃，与更新语义不一致（若产品上创建即需关联批次则属字段遗漏）。建议 Create 同步传 BatchID。
- 其余：全部经 AffairsPlanService，无 handler 直连 SQL；Get/Update/Delete/Publish/ListCourses/PutCourses/Clone 均以 `GetTrainingProgram(id, tenantID)` 先做租户隔离；PutCourses 校验岗位/课程至少关联其一。无 P0/P1。

## `backend/internal/handler/user_extension_field_handler.go`（85 行）
- 完整逐行检查：完成
- [P2] L38: List 失败时用户可见文案 "确保default extension fields失败" 是内部实现描述且中英混杂，建议改为 "查询扩展字段失败"。
- 其余：List 经 tenantFilter 租户隔离；Update 有 canManageUsers + verifyTenantOwnership 双重校验，字段校验完整。无 P0/P1。

## `backend/internal/handler/user_management_handler.go`（725 行）
- 完整逐行检查：完成
- 未发现问题。UpdateMe/ChangeMyPassword 限本人（claims.UserID）；List/Get 响应统一脱敏（mask.User + Oauth 清空 + PasswordHash 置空），仅管理角色可见明文；Create/Update/BatchCreate 经 verifyRequestTenant 校验租户、roleOrEmpty 白名单约束角色；Delete/UpdateStatus/ResetPassword/BatchGraduate/BatchDelete/BatchUpdateOrgNode/BindRoles 均 canManageUsers + verifyTenantOwnership 双门禁；批量接口对 UserIDs 逐条 uuid 校验；slog 日志不含密码等敏感字段。无 P0/P1。

## `backend/internal/handler/user_management_handler_test.go`（294 行）
- 完整逐行检查：完成
- 未发现问题。覆盖 Create/List/Get/Update/Delete（含删除后 404）/UpdateStatus/BatchCreate，均以 school_admin 角色 token 触发管理权限路径；createTestRole 用 t.Cleanup 自动清理。L210 `_ = ctx` 无害。

## `backend/internal/handler/user_relation_handler.go`（115 行）
- 完整逐行检查：完成
- [P2] L92-115: Delete 仅按租户隔离（`Service.Delete(id, effectiveTenantID)`），未校验调用者是否为该关系的发起者/目标，租户内任意登录用户可删除他人建立的关系（如学生删除老师与同学间的师徒/帮扶关系）。建议删除前校验关系归属（调用者 = initiator 或 target，或至少限定管理角色）。Create 已强制 `InitiatorID == claims.UserID`（L69），语义一致性问题仅存在于删除侧。

## `backend/internal/handler/workflow_handler.go`（173 行）
- 完整逐行检查：完成
- [P2] L101-126: UpdateFn 部分更新兜底覆盖了 Steps/MajorIds/Name/Description（未携带回退现有值），但 `Scene` 未做回退——更新请求省略 scene 时会把现有 scene 置空，与"未携带保留原值"语义不一致（若需支持清空也应显式设计）。建议 Scene 同样做 nil 回退。
- 其余：List 校验登录、角色门禁在路由层（registerWorkflowRoutes: school_admin/teacher）；Create/Update/Delete 经 crudConfig 统一租户隔离（CheckOwnership=true、TenantFn=requireTenant）；Delete 前校验无待处理审批单。无 P0/P1。

## `backend/internal/handler/workflow_handler_test.go`（136 行）
- 完整逐行检查：完成
- 未发现问题。两个回归测试有针对性：ids 逗号拼接过滤（防 malformed array literal 500）、删除保护（待审批 409 且流程保留、完结后 200）。测试预置数据考虑 FK 约束（approval_records.submitter_id 先建真实用户）。

## `backend/internal/mask/mask.go`（68 行）
- 完整逐行检查：完成
- 未发现问题。脱敏策略（手机 3-4、身份证 3-3、邮箱首字符+域名、学号/工号 2-2、短串整体掩码）实现正确，maskPtr 对 nil/空串原样返回；User 仅在非管理角色时原地脱敏，输出侧执行、存储层保留原值，符合设计。

## `backend/internal/mask/mask_test.go`（59 行）
- 完整逐行检查：完成
- 未发现问题。表驱动用例覆盖各函数正常/短值边界，及管理/非管理角色的 User 脱敏开关。

## `backend/internal/metrics/metrics.go`（96 行）
- 完整逐行检查：完成
- [P2] L84-92: `statusRecorder` 仅记录 WriteHeader 状态码，未透传 `http.Flusher` 也未实现 `Unwrap() http.ResponseWriter`。该中间件挂在全局 router（router.go L113）包裹所有路由，一旦有 handler 依赖流式输出（SSE / AI 流式 / 大文件流），经此包装后 `http.ResponseController.Flush()` 会返回 ErrNotSupported，流式响应失去即时推送（当前代码无依赖 HTTP Flush 的 handler，属潜在隐患）。建议 statusRecorder 实现 Flush/Unwrap 透传。
- 其余：指标定义合理（路由模式标签避免高基数），db 连接池统计用 GaugeFunc 且 nil 安全，RegisterPool 启动时单次调用无并发问题。


### report-025-026.md

# 代码审查报告 batch 025-026（backend）

- 审查依据: docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，31 个文件）
- 审查范围: /tmp/batches/025-backend.json（18 文件）+ /tmp/batches/026-backend.json（13 文件）
- 结论: P0 = 0，P1 = 1，P2 = 5，复用候选 = 0
- 方法: 每个文件用 read 工具完整逐行阅读；关键跨文件事实（排课并发语义、企业删除路由 handler 存在性、收藏路由跨组重复注册、router_dup_test 检测盲区、crypto 密钥派生、AI 配置密钥来源、oplog buffer 生产初始化）均已用 grep/read/测试运行核实

---

## `backend/internal/middleware/auth.go`（287 行）
- 完整逐行检查：完成
- 未发现问题（HS256 白名单校验、强制 UserID 非空防令牌类型混淆、平台独立 cookie + 旧 cookie 兼容、ensureAuthCookie 幂等补发、JWT 瘦身派生字段与旧令牌 7 天回退逻辑自洽；systemMenuPrefix 定义于同包 rbac.go L11，引用正确）

## `backend/internal/middleware/auth_test.go`（308 行）
- 完整逐行检查：完成
- 未发现问题（过期/错误密钥/篡改/缺头/双平台 cookie 共存等场景覆盖完整）

## `backend/internal/middleware/oplog_buffer.go`（126 行）
- 完整逐行检查：完成
- 未发现问题（缓冲满丢弃仅告警不阻塞请求；Shutdown 先 cancel 再排空剩余条目，flush 用独立 10s 超时 context 保证关机前最后一次落库；panic recover 后 close(done) 保证 Shutdown 不悬挂；生产 main.go L50 恒创建 buffer，非 nil）

## `backend/internal/middleware/oplog.go`（223 行）
- 完整逐行检查：完成
- 未发现问题（statusRecorder 默认 200 与隐式写入兼容；nil buffer 的同步 INSERT 回退路径仅测试场景触发，生产恒走 buffer；ClientIP 仅信任回环/私网直连方携带的代理头，防伪造）

## `backend/internal/middleware/oplog_test.go`（69 行）
- 完整逐行检查：完成
- 未发现问题（ClientIP 六类场景含公网直连不信任代理头的安全用例）

## `backend/internal/middleware/platform.go`（42 行）
- 完整逐行检查：完成
- 未发现问题（平台白名单 map 化判断；无 claims 401、平台不匹配 403 分级合理）

## `backend/internal/middleware/platform_test.go`（74 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/middleware/rbac.go`（233 行）
- 完整逐行检查：完成
- 未发现问题（RequireRoleOrMenu 的菜单放行仅限只读方法，写操作强制角色绑定，防"有任意菜单即可写"绕过；新旧令牌双路径判断自洽）

## `backend/internal/middleware/rbac_alliance_test.go`（58 行）
- 完整逐行检查：完成
- 未发现问题（B13 企业导师收窄用例覆盖到位）

## `backend/internal/middleware/rbac_permissions_test.go`（195 行）
- 完整逐行检查：完成
- 未发现问题（JWT 瘦身/旧令牌回退矩阵覆盖完整）

## `backend/internal/middleware/tenant.go`（39 行）
- 完整逐行检查：完成
- 未发现问题（无 {id} 放行、跨租户/不存在统一 404 防探测；走 store 层查询，符合分层）

## `backend/internal/router/handlers.go`（262 行）
- 完整逐行检查：完成
- 未发现问题（纯装配；各 handler 依赖注入完整，无 *pgxpool.Pool 字段持有）

## `backend/internal/router/router_audit_test.go`（154 行）
- 完整逐行检查：完成
- 未发现问题（公开路由白名单强制登记 + 全量路由授权中间件兜底审计 + 文件路由平台矩阵三测试互补；审计测试已实际运行通过）

## `backend/internal/router/router_dup_test.go`（121 行）
- 完整逐行检查：完成
- [P2] L44-50: recordingRouter 的 With/Group/Route 包装每次经 wrap（L36-38）新建 recordingRouter（独立 seen map，L37/L45/L49），跨组/跨作用域的同 method+pattern 重复注册检测不到——正是本文件注释（L13-14、L111-113）声称要防的"chi 静默覆盖、弱权限组顶替强权限组"回归类别（曾致 sign-url 被 partner 组顶替）。实测：routes.go 中收藏路由跨 businessUser/jobViewer 两组重复注册，本测试不报错（见 routes.go P2）。（最佳实践: seen map 提升为共享引用，或在包装层把 inner 子路由的注册也记入同一 map）

## `backend/internal/router/router.go`（178 行）
- 完整逐行检查：完成
- 未发现问题（不用 chi RealIP 防 IP 伪造并注明原因；/health/ready 探针带 3s 超时；/uploads 混合鉴权挂 OptionalJWT 语义正确；FileHandler 跨租户放行回调注入合理）

## `backend/internal/router/routes_affairs.go`（70 行）
- 完整逐行检查：完成
- 未发现问题（replace 先于 {id} 注册规避捕获，节次只读接口挂在 jobViewer 组注释与实际注册一致）

## `backend/internal/router/routes_affairs_test.go`（35 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/router/routes_evaluation.go`（89 行）
- 完整逐行检查：完成
- 未发现问题（certifications 静态段 items/points 与 {id} 参数路由由 chi 静态优先匹配，注册顺序无冲突；读接口单点挂 jobViewer 组、写接口本组注册，无 GET 冲突）

## `backend/internal/router/routes.go`（596 行）
- 完整逐行检查：完成
- [P2] L460-461: DELETE /alliance/enterprises/{id} 与 DELETE /alliance/enterprises/{id}/link 均映射到 UnlinkEnterprise（解除引入链接）。已核实 AllianceHandler 无 DeleteEnterprise 方法，即不存在真正删除企业主体的路由；若前端"删除企业"预期删除企业主体，将静默退化为解绑且无法删除。建议明确路由语义（删除即解绑）或补充企业主体删除接口，二者留其一。
- [P2] L267-269 与 L272-274: 收藏路由（/job/positions/{id}/favorite、/job/positions/favorites、/favorites、/favorites/{targetType}/{id}）在 jobViewer 组（本文件，L242-275，后注册）与 businessUser 组（routes_job.go L9-15，经 registerJobRoutes 注册）重复注册，依赖"后注册覆盖"（L240-241 注释说明意图）；当前两侧 handler 相同故功能一致，但属冗余注册，一旦两侧 handler 分叉将静默覆盖且无任何告警，router_dup_test 亦检测不到（见 router_dup_test.go P2）。
- 未发现授权缺口（公开白名单/平台分组/角色分组与 router_audit_test 白名单一致，审计测试已运行通过）

## `backend/internal/router/routes_job.go`（71 行）
- 完整逐行检查：完成
- [P2] L9-15: 收藏路由在 businessUser 组内注册，与 routes.go jobViewer 组 L267-269/L272-274 重复（后注册覆盖前者，同 handler 功能一致）；建议只保留 jobViewer 组单点注册，删除本处 6 行冗余。

## `backend/internal/router/routes_lesson.go`（54 行）
- 完整逐行检查：完成
- 未发现问题（quizzes/questions 静态段与 {id} 无冲突；behavior-collection 命中 opLogSkips 前缀不落操作日志，与 oplog.go L72 一致）

## `backend/internal/router/routes_library.go`（28 行）
- 完整逐行检查：完成
- 未发现问题（静态段 stats/citation-stats/uncited 均先于 {id} 注册）

## `backend/internal/router/routes_partner.go`（91 行）
- 完整逐行检查：完成
- 未发现问题（partnerUser/adminOnly 角色分组清晰；experts/me 静态段优先于 {id}；/auth/partner/me 挂在平台组内按设计放行）

## `backend/internal/router/routes_scene.go`（46 行）
- 完整逐行检查：完成
- 未发现问题（scenarios 写路由挂 TenantOwnedContent 试点；tasks/reorder 与 tasks/{id} 无冲突）

## `backend/internal/scheduler/scheduler.go`（180 行）
- 完整逐行检查：完成
- 未发现问题（SkipIfStillRunning 防重入；panic recover + 失败重试 1 次；job_run_logs 尽力而为；SET statement_timeout=0 前持连接、defer RESET 回池防会话级泄漏；pg_try_advisory_lock(737001) 分布式防重；告警 webhook 5s 超时且失败仅记日志）

## `backend/internal/service/ability.go`（69 行）
- 完整逐行检查：完成
- 未发现问题（纯 store 透传，无 SQL 拼接，租户参数化）

## `backend/internal/service/affairs.go`（474 行）
- 完整逐行检查：完成
- [P1] L215 与 L226: AutoSchedule 在 advisory 锁（L226 LockScheduleTerm，事务内 L224）之前读取待排条目快照（L215 ListPendingPlanEntries，筛选 e.status='planned'）。若并发手动排课（CreateScheduleChecked 使用同一把锁，但在快照读取后、本任务加锁前完成提交），该条目状态已被置为 'scheduled'，内存快照仍含它；锁内重读的 existing（L230 ListTermScheduleBriefs）含该手动排课，但 hasScheduleConflict 对同 plan_entry 跳过冲突（L373-375），自动排课将为同一计划条目再生成一条 draft 排课，课表出现重复。已核实 store/scheduling.go L302-308（CreateSchedule 提交后 UPDATE 条目 status='scheduled'）且 schedule_entries 无 plan_entry 唯一约束。（最佳实践: 将 ListPendingPlanEntries 移入锁内读取，或在锁内按快照 id 复核 status='planned' 再排）
- [P2] L265-267: 每个候选（天×节次×场地）循环内重建 checkSet（拷贝 len(existing)+len(creates)），整体复杂度 O(待排条目×7×节次×场地×(existing+creates)) 且伴随大量切片分配；可维护单一冲突列表、creates 增长时增量追加。（最佳实践: 把 checkSet 提出三层循环，仅在新 creates 追加时更新）

## `backend/internal/service/affairs_plan.go`（14 行）
- 完整逐行检查：完成
- 未发现问题（仅服务类型声明，方法分布在同域其余文件）

## `backend/internal/service/ai.go`（284 行）
- 完整逐行检查：完成
- 未发现问题（缓存存密文版 key 且独立结构避免 marshal 丢字段；坏缓存按未命中处理；GetConfig 仅返回脱敏末 4 位；SaveConfig 空 key 保留已有、无配置且空 key 报 ErrAIKeyRequired；recordUsage best-effort 不影响主流程；AISecret 缺省回落 JWT_SECRET 已在 config.go 审查中按设计取舍处理；上游调用有 60s 超时，非流式无需额外超时）

## `backend/internal/service/ai_position.go`（455 行）
- 完整逐行检查：完成
- 未发现问题（JSON 模式失败仅 400/422 回落重试一次；解析失败追加修复指令仅重试一次，属"解析修复"非上游无脑重试，符合 docs/ai-development.md；属性/掌握等级白名单过滤防脏数据入库；两次成功调用用量均落库）

## `backend/internal/service/ai_position_test.go`（325 行）
- 完整逐行检查：完成
- 未发现问题（未配置/非法 field/提取器容忍/各 field 解析与空判定/提示词内容/修复重试且用量双落库，覆盖充分）

---

## 汇总

- P0: 0
- P1: 1（affairs.go AutoSchedule 锁外快照竞态）
- P2: 5（router_dup_test.go 跨组检测盲区；routes.go 企业删除路由语义 + 收藏路由重复注册；routes_job.go 收藏路由重复注册；affairs.go checkSet 重建）
- 复用候选: 0（收藏路由重复注册属"去重"候选而非复用；无 ≥3 处重复的组件/函数；strPtr 仅两处、跨包不构成复用候选）


### report-027-028.md

# 代码审查报告 027-028（backend/internal/service）

> 审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、严重级别 P0/P1/P2、报告模板）。
> 批次：027（19 文件，2693 行）+ 028（12 文件，2319 行），共 31 文件 4981 行，全部逐行读完。
> 结论：P0=0，P1=1，P2=4，复用候选=2。禁止修改源代码，仅本报告为产物。

## `backend/internal/service/ai_scenario.go`（557 行）
- 完整逐行检查：完成
- 未发现问题。field 白名单校验（L32-40）、taskAbility 无岗位前置校验（L413-415）、LLM 输出按 field 解析并钳制/过滤（clampDifficulty/白名单类型/空结果判定）、实体建议按名精确匹配回填（L449-516，岗位能力点匹配域限定为岗位绑定能力点）、请求输入长度/条数上限在 handler 层已校验（本文件外的 ai_handler.go L327-344）均合理。positionAbilities List Limit=1000 有界。

## `backend/internal/service/ai_scenario_test.go`（293 行）
- 完整逐行检查：完成
- 未发现问题。覆盖提示词构造、各 field 解析/枚举过滤/空结果、前置校验、实体匹配回填、修复重试与 usage 落库、无岗位集成路径。

## `backend/internal/service/ai_test.go`（348 行）
- 完整逐行检查：完成
- 未发现问题。覆盖加密落库/脱敏视图、空 key 保留、首次无 key 拒绝、未配置错误映射、用量聚合（30 天窗口/补 0/全量合计）、Chat 用量落库、缓存载荷密文回归。

## `backend/internal/service/alliance_mentor.go`（24 行）
- 完整逐行检查：完成
- 未发现问题。薄封装，直接透传 store。

## `backend/internal/service/approval.go`（74 行）
- 完整逐行检查：完成
- [P2] L27: ReviewApproval 方法签名含 10 个参数（id/action/newStatus/stepIdx/oldStepIdx/history/targetType/targetID/tenantID/syncStatus），且拒绝/通过两分支通过布尔与指针参数隐式区分行为，可读性与调用方一致性风险高（最佳实践: 收敛为结构体参数或按语义拆分方法，如 RejectApproval/ApproveApproval）。
- 事务逻辑本身正确：拒绝分支 RejectRecord+SyncEntityStatus；通过分支 AdvanceRecord+MergeSourceEditDraft（编辑稿覆盖原资源）或 SyncEntityStatus，任一失败整体回滚。

## `backend/internal/service/approval_service.go`（14 行）
- 完整逐行检查：完成
- 未发现问题。仅结构体定义与构造函数。

## `backend/internal/service/auth.go`（76 行）
- 完整逐行检查：完成
- 未发现问题。登录查询/最后登录/IP 归属地（Geo nil 时留空，不 panic）/角色查询均为薄封装。

## `backend/internal/service/banner.go`（37 行）
- 完整逐行检查：完成
- 未发现问题。薄封装。

## `backend/internal/service/batch.go`（57 行）
- 完整逐行检查：完成
- 未发现问题（table/selectColumns 字符串直传 store，其合法性依赖 handler 白名单，属既有架构约定）。
- 复用候选: 与 `evaluation_common.go` 完全重复 7 个通用批次方法（BatchList/BatchTenantOf/BatchCreate/BatchUpdate/BatchDelete/BatchUpdateStatus/BatchGetByTable），仅接收者不同（PositionService vs EvaluationService）。

## `backend/internal/service/captcha.go`（295 行）
- 完整逐行检查：完成
- 未发现问题。Redis 优先、内存降级双路径实现一致；答案一次性消费防重放（GetDel/删除）；失败计数窗口 TTL、设备信任滑窗 30 天；内存路径 pruneLocked 在每次操作时清理过期项，map 有界；答案不下发前端。

## `backend/internal/service/captcha_test.go`（187 行）
- 完整逐行检查：完成
- 未发现问题。覆盖生成/校验/一次性消费、错误答案、阈值与清零、IP/账号×设备隔离、信任过期与清理。

## `backend/internal/service/community.go`（121 行）
- 完整逐行检查：完成
- 未发现问题。发帖/回复在事务内递增计数；阅读计数失败仅 warn 不阻断详情（注释明确为非核心写路径）；列表 IsMine 按作者比对正确。

## `backend/internal/service/evaluation_ability_result.go`（77 行）
- 完整逐行检查：完成
- 未发现问题。薄封装，租户/用户限定参数传递完整。

## `backend/internal/service/evaluation_appeal.go`（27 行）
- 完整逐行检查：完成
- 未发现问题。薄封装（GetAppeal/ProcessAppeal 未带租户，属 handler 层鉴权职责，本文件无越权写逻辑）。

## `backend/internal/service/evaluation_cert.go`（229 行）
- 完整逐行检查：完成
- 未发现问题。validateLevelMapping 校验完整（恰好 5 档/顺序/整数/0-100/递增/连续/末档=100/首档>0）；GetCertificationFull 三级查询按 ID 批量拉取无 N+1；PutCertificationWeights/PutCertificationPointLevels 事务内完成且校验先行。

## `backend/internal/service/evaluation_common.go`（42 行）
- 完整逐行检查：完成
- 复用候选: 与 `batch.go` 完全重复 7 个通用批次方法（同函数体仅接收者不同）；建议抽出共享 BatchService（或泛型嵌入）供 PositionService/EvaluationService 复用。

## `backend/internal/service/evaluation_exam.go`（115 行）
- 完整逐行检查：完成
- 未发现问题。ListExamCenter 学生路径先查班级节点再按班级过滤，2 次查询无 N+1；删除试卷/批量更新分数事务包裹。

## `backend/internal/service/evaluation.go`（64 行）
- 完整逐行检查：完成
- [P2] L27-34: GetQuestionBank 与 GetQuestionBankInTenant 函数体完全相同（同调 GetScoped），仅参数顺序不同（tenantID,id vs id,tenantID），属于同文件重复方法（最佳实践: 保留一个并统一调用方参数顺序，或删除冗余别名）。

## `backend/internal/service/evaluation_portrait.go`（37 行）
- 完整逐行检查：完成
- 未发现问题。薄封装。

## `backend/internal/service/evaluation_question.go`（110 行）
- 完整逐行检查：完成
- 未发现问题。批量建题/试卷题目增删改均事务包裹且带 RecalcExamTotal；UpdateExamQuestionScore 未命中回 ErrNotFound。

## `backend/internal/service/evaluation_result.go`（366 行）
- 完整逐行检查：完成
- [P1] L39-125: SubmitExamResult 的防重校验（ResultTeacherGraded L47、ResultSubmitted+allowRetake L55-67）与写入事务（L125）非原子：教师评分检查到事务提交之间隔着 FetchExamGradingData/LoadStudentTaskScores 与 FetchUserProfile 两个可能较慢的查询，并发交卷与教师评分竞态时，学生提交可覆盖教师已评分数（upsert 语义下后写者胜），核心交卷路径的防重/防覆盖保护被绕过（最佳实践: 在事务内以行锁/SELECT FOR UPDATE 或 UPDATE ... WHERE graded_at IS NULL 原子化检查与写入，或依赖唯一键 + 条件更新）。
- [P2] L305-308: syncExamResultScoreTx 中 FindExamResultForGrading 返回真实 DB 错误时直接 `return nil` 静默吞掉，批量/单条评分后考试分数回写可能永久失败且无日志痕迹（对照 node_evaluation_result.go L46-51 对同类错误会 slog.Error）；应至少记录错误日志。
- 其余：窗口校验、班级约束、判分快照化（exam_version）、客观分重算/主观分汇总、RoundScore 均正确。

## `backend/internal/service/favorites.go`（59 行）
- 完整逐行检查：完成
- 未发现问题。薄封装。

## `backend/internal/service/hybrid_module.go`（37 行）
- 完整逐行检查：完成
- 未发现问题。Upsert 按 id 判空分流；ReplaceHybridModules 事务包裹。

## `backend/internal/service/job_ability_aggregator.go`（610 行）
- 完整逐行检查：完成
- [P2] L151-153: 同岗位并发汇聚仅靠进程内 map 互斥（lockPosition），若多实例部署，跨实例同岗位汇聚无互斥保护（最佳实践: 采用 DB advisory lock 或分布式锁；单实例部署下当前实现正确）。
- 其余：汇聚日志成功/失败状态落库；LoadStudentTaskScores 由 store SQL 层 MAX 去重（已核对 store/job_ability_results.go L350-366，"同一任务多方法取最高"语义成立）；学生按 100/批合并事务；能力点达成/胜任度/认知分公式有单测覆盖；岗位锁 map 常驻不删除有注释说明（岗位数有界）。

## `backend/internal/service/job_ability_levels_test.go`（295 行）
- 完整逐行检查：完成
- 未发现问题。覆盖分档校验全分支、自定义/默认档位等级映射、胜任度 v2 示例表、旧公式回归（区分 ×10000/×100 写法）、档位标签。

## `backend/internal/service/landing.go`（12 行）
- 完整逐行检查：完成
- 未发现问题。薄封装。

## `backend/internal/service/lesson_behavior.go`（17 行）
- 完整逐行检查：完成
- 未发现问题。薄封装。

## `backend/internal/service/lesson_content.go`（594 行）
- 完整逐行检查：完成
- 未发现问题。克隆课程生成唯一编码在事务内；知识点名称填充为批量 IN 查询（已核对 store/courses.go L419-466，无 N+1）；课程发布时按 evalRuleConfig/hybridEvalRules 生成节点测评，复用已存在 usage（FindNodeUsage 空则建、有则按需更新窗口），temp exam 快照同步；节点删除先行清理考试安排防幽灵残留。

## `backend/internal/service/log.go`（29 行）
- 完整逐行检查：完成
- 未发现问题。薄封装。

## `backend/internal/service/node_evaluation_result.go`（70 行）
- 完整逐行检查：完成
- [P2] L36-59: Grade 方法与考试结果分数回写不在同一事务（先 Grade 提交，再非事务回写 UpdateExamResultScore），回写失败仅 slog.Warn，节点测评已评但关联考试结果分数永久不同步（对照 evaluation_result.go GradeEvaluationResult 的事务化实现，两处口径不一致；最佳实践: 将评分与回写包入同一事务，或回写失败时标记待重试）。
- 其余：FindNodeExamResult 真实 DB 错误（非 ErrNoRows）会 slog.Error 而非静默（L46-51），处理正确。

## `backend/internal/service/org.go`（108 行）
- 完整逐行检查：完成
- 未发现问题。更新前先校验类型存在/父级租户归属/自引用/后代防环（handler 必填 TypeID，已核对 org_handler.go L154）；删除在事务内解绑用户+删除子树。


### report-029-030.md

# 代码审查报告 029-030（backend service/store）

- 审查指南：docs/code-review/REVIEW-GUIDE.md
- 审查方式：逐文件完整逐行阅读（read 工具，全量），无跳读
- 严重级别：P0 安全高危/数据损坏/核心必现；P1 性能热点/稳定性/非必现但影响核心；P2 维护性/一致性/复用

## `backend/internal/service/partner_cobuild.go`（983 行）
- 完整逐行检查：完成
- [P2] L779-780: 同一注释分隔行 `// ===== 学校数据只读列表（编辑器数据源） =====` 连续出现两次，删除其一
- [P2] L196-204 / L488-496: EditSourcePosition/EditSourceScenario 的幂等检查 `FindDraftBySource` 在事务外执行，随后才在 WithTx 内 CopyAsDraft，非原子：并发重复提交可各建一份 draft 副本，与注释承诺的"幂等"不符（建议幂等检查与复制同事务，或依赖唯一约束）
- 复用候选: EditSourcePosition/EditSourceScenario、SubmitPosition/SubmitScenario、WithdrawPosition/WithdrawScenario 三对岗位/场景方法结构同构（归属校验→link 校验→Transition+Approval 创建），可抽公共模板或泛型 helper

## `backend/internal/service/partner.go`（371 行）
- 完整逐行检查：完成
- [P2] L339-350: DeleteExpertWithAccount 在 service 层直接执行裸 SQL（`UPDATE task_review_steps ...`、`DELETE FROM user_roles/users`），违反分层（SQL 应下沉 store，service 只编排），建议封装为 store 方法
- 其余：注册事务、bcrypt 旧密码校验、Dashboard 分块查询均正常

## `backend/internal/service/portal.go`（14 行）
- 完整逐行检查：完成
- 未发现问题（仅服务骨架声明）

## `backend/internal/service/position_clone.go`（69 行）
- 完整逐行检查：完成
- [P2] L33: 租户归属校验条件为 `src.TenantID != nil && *src.TenantID != tenantID`，TenantID 为 nil 时跳过校验直接进入克隆，建议 nil 时同样拒绝或由 store 端兜底
- 其余：事务内生成 code + ClonePosition，正常

## `backend/internal/service/position_config.go`（99 行）
- 完整逐行检查：完成
- 未发现问题（纯薄转发；归属校验由 handler 经 PositionTenantID 完成）

## `backend/internal/service/position.go`（145 行）
- 完整逐行检查：完成
- 未发现问题（SaveFull 事务内能力点/证书预写入，回滚不留孤儿；收藏/浏览直通 store）

## `backend/internal/service/recommend.go`（32 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/resource_binding.go`（80 行）
- 完整逐行检查：完成
- [P2] L28-45: Create/Bind/Unbind 将 bindTable/bindCol 原样透传 store，store 端直接拼接进 SQL（store/resource_bindings.go L113-115、L138-141 为 `INSERT INTO `+bindTable+` ... `+`+bindCol+` ...`）。当前 handler 均传固定常量（node/task/course_resource_bindings）无注入面，但 service 层对 bindTable/bindCol 无白名单校验，一旦后续有调用方透传用户输入即构成 SQL 注入；建议 service 层枚举限定（store 的 Unbind/BindTargetID 已有 bindColOf 白名单，CreateResource/Bind 未覆盖，属不一致）
- 其余：租户归属校验辅助方法正常

## `backend/internal/service/resource_code.go`（32 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/resource.go`（66 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/scenario_config.go`（84 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/scenario.go`（174 行）
- 完整逐行检查：完成
- [P2] L172-173: BatchGetByTable 直接返回 `pgx.Row`，把数据库游标泄漏出 store/service 抽象：调用方必须自行 Scan（未 Scan 则连接不释放，存在连接池耗尽隐患），且 handler 层接口依赖 pgx 类型，建议 store 内完成扫描返回结构体（与 ExecuteListQuery 风格一致）
- 说明：ListTasks/GetTask 的 Populate* 已在 store 内按 ANY($1) 批量查询（scenario_tasks.go），无 N+1
- 其余：DeleteTask 事务内清理考试占用、Reorder 事务化，正常

## `backend/internal/service/service.go`（34 行）
- 完整逐行检查：完成
- 未发现问题（Service 仅持 store，不持连接池，符合分层红线）

## `backend/internal/service/snapshot.go`（164 行）
- 完整逐行检查：完成
- 未发现问题（版本解析顺序、live 回退条件、学生答案剥离均按文档实现，解析失败宁可多返）

## `backend/internal/service/subscription.go`（27 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/tag_service.go`（49 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/task_evaluation.go`（252 行）
- 完整逐行检查：完成
- 未发现问题（advisory 锁 + 乐观版本号防双提交，临时考试联动在锁内执行，设计良好；JSON 转换容错合理）

## `backend/internal/service/teaching_plan.go`（106 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/tenant_admin.go`（86 行）
- 完整逐行检查：完成
- 未发现问题（明文密码为"仅创建/重置时返回一次"的设计；handler 在 ResetPassword/SetPassword 前已用 Get(tenantID, adminID) 校验归属，无越权）

## `backend/internal/service/tenant.go`（66 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/term.go`（48 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/training_program.go`（73 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/user_extension_field.go`（38 行）
- 完整逐行检查：完成
- 未发现问题（EnsureDefaultSlots 幂等补齐；角色码先过滤为租户内真实存在）

## `backend/internal/service/user.go`（172 行）
- 完整逐行检查：完成
- [P2] L58-72: BatchCreate 对缺字段/重复项静默 skip，且单个用户创建失败会整体回滚并报错，但"跳过"类不反馈——导入条数与返回 created 数不一致时前端无从得知哪些被跳过，建议返回 skipped 明细或错误说明
- 其余：Update 校验机构/专业归属、BindRoles 先校验角色租户内存在，正常

## `backend/internal/service/user_relation.go`（47 行）
- 完整逐行检查：完成
- 未发现问题（Create 的 UsersExist 预检与创建之间非原子，属普通业务重复容忍范围，不报）

## `backend/internal/service/workflow.go`（37 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/service/workspace_stats.go`（114 行）
- 完整逐行检查：完成
- 未发现问题（统计全部下沉 store，service 薄转发）

## `backend/internal/store/abilities.go`（220 行）
- 完整逐行检查：完成
- [P2] L60-63: Create 中 GenerateUniqueEntityCode 失败时静默降级为 `GenerateEntityCode("NL")`（随机、无唯一性保证），吞掉了原始错误；可能生成重复 code 触发唯一约束失败，且掩盖底层故障，建议失败直接上抛
- 说明：CitationStats/ListUncited 每条能力点带 4 个相关子查询（COUNT/EXISTS），数据量大时偏慢，但属统计类非核心接口，按指南不报

## `backend/internal/store/ability_domains.go`（132 行）
- 完整逐行检查：完成
- [P2] L67-70: Delete 不检查 RowsAffected，删除不存在的记录静默返回 nil，与 abilities.go L99-101（0 行影响返回 ErrNotFound）行为不一致，建议统一

## `backend/internal/store/ai_config.go`（61 行）
- 完整逐行检查：完成
- [P2] L44-55: Upsert 的 ON CONFLICT 分支只更新 base_url/api_key_encrypted/model/updated_at，不更新 extra 列；若调用方携带新的 extra 期望覆盖，会静默失效，建议一并更新或文档注明
- 其余：api_key 密文存取，符合密钥红线

## `backend/internal/store/ai_usage.go`（72 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/store/alliance_achievement_store.go`（248 行）
- 完整逐行检查：完成
- [P1] L15-49（ScanAchievementRows）: 查询与扫描均含 `is_public`（L23/L27 的 `var isPublic bool` 已 Scan），但赋值段（L31-45）从未执行 `a.IsPublic = &isPublic`，导致列表/公开列表/公开详情（queryList/queryOne 复用本扫描器）返回的 `AllianceAchievement.IsPublic`（*bool）恒为 nil，JSON 输出 `"isPublic": null`
- [P1] L112-148（GetAchievementByID）: 同样未赋值 IsPublic，且 created_by（L117 已 Scan 的 createdBy）也未赋给 a.CreatedBy，详情接口丢失 isPublic 与 createdBy 两个字段
- 影响链：详情（编辑加载）IsPublic 恒 nil → handler ValidateUpdateExisting（alliance_crud_handler.go L239-241"请求未携带时保留已有状态"）保留 nil → UpdateAchievement 经 BoolVal(nil)=false 写库（query.go L544），用户设置的"公开"开关在任意一次编辑后被静默重置为 false，前端开关展示亦错误——确定性功能缺陷
- 最佳实践: 与 alliance_agreement_store.go ScanAgreementRows（L36 `a.IsPublic = &isPublic`）对齐，扫描后补赋值；并补充 handler/store 测试覆盖

## `backend/internal/store/alliance_agreement_store.go`（191 行）
- 完整逐行检查：完成
- 未发现问题（IsPublic 正确赋值；DeleteAgreement 清理项目侧 agreement_ids 反指，避免死 id；公开列表不下发 content/attachments）

## `backend/internal/store/alliance_brand_import.go`（276 行）
- 完整逐行检查：完成
- [P2] L233: UpsertTeacherExpertProfile 直接解引用 `*e.UserID`，若调用方传入 UserID 为 nil 将 panic（500），建议入口判空返回错误
- 其余：导入保存岗位复用 SaveFull 同事务；专家档案 COALESCE 部分更新正确
- 复用候选: L17-100 的 LookupUserIDByNameWithRole / LookupTeachingPositionIDByName / LookupJobBrandIDByName / LookupAchievementIDByTitle / LookupCourseIDByName / LookupIndependentEmployerBrandIDByName 六个查询结构完全同构（tenant+name LIMIT 1），可抽一个带表/列参数的通用 helper

## `backend/internal/store/alliance_brand_store.go`（571 行）
- 完整逐行检查：完成
- [P2] L451-476 / L539-563: ListEmployerBrands/ListJobBrands 的 LIMIT/OFFSET 用 `Itoa` 直接拼进 SQL（非参数化）且未做上限 clamp，依赖调用方；虽为整数无注入风险，但与 ExecuteListQuery 的参数化 + ClampLimitOffset 风格不一致，建议统一
- 其余：IncrementAllianceView 表名白名单 switch 防注入；enrichHiredStudentMajors 按 ANY($1) 批量查询无 N+1
- 复用候选: employerBrandSelect（L402-410）与 publicBrandSelect（L180-188）的前 21 列（品牌基础列+企业资料列）完全一致，可抽公共列常量拼接；ListEmployerBrands/GetEmployerBrandByID 与 ListJobBrands/GetJobBrandByID 两对同构，可模板化

## `backend/internal/store/alliance_dictionary_store.go`（59 行）
- 完整逐行检查：完成
- 未发现问题


### report-031-032.md

# 代码审查报告 031-032（backend/internal/store）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，禁止抽样/跳读；行号经 read 工具核对）。
范围：批次 031（11 文件，2680 行）+ 批次 032（11 文件，2087 行），共 22 文件。仅审查与报告，未修改任何源代码。
结论汇总：P0 = 0，P1 = 1，P2 = 20；复用候选 3 处。

---

## `backend/internal/store/alliance_enterprise_link_store.go`（367 行）
- 完整逐行检查：完成
- [P2] L82-108: EnsureLinksByEnterpriseIDs 对每个 enterpriseID 各发一条 EXISTS 查询（L85-89）+ 可能一次插入，导入数百企业时循环内逐条 SQL（N+1 模式）（最佳实践: 单条 `SELECT enterprise_id FROM alliance_enterprise_links WHERE tenant_id = $1 AND enterprise_id = ANY($2)` 批量求差后只插入缺失项；导入场景非核心，故定 P2）

## `backend/internal/store/alliance_enterprise_link_store_test.go`（142 行）
- 完整逐行检查：完成
- 未发现问题（fakeAggRows 仅支持 *string/*int 扫描，但仅用于聚合测试，覆盖面足够）

## `backend/internal/store/alliance_enterprise_store.go`（463 行）
- 完整逐行检查：完成
- [P2] L396-463: GetPublicStats 的 count 闭包（L398-404）在任一统计查询失败时仅 slog.Warn 并返回 0，接口对调用方静默返回全 0 统计，DB 故障时门户展示"0 企业/0 专家/0 项目"误导用户（最佳实践: 查询失败时返回错误，或至少通过响应标记统计不可用）

## `backend/internal/store/alliance_enterprise_store_test.go`（70 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/store/alliance_expert_store.go`（354 行）
- 完整逐行检查：完成
- [P2] L157-203: ListByEnterpriseIDs 跨租户直查 `enterprise_id = ANY($1::uuid[])`，SQL 无任何租户约束，越权防线完全依赖调用方把 enterpriseIDs 限定为本校 links（L156 注释已声明）；一旦某调用方漏限定即可读取任意企业专家数据（最佳实践: store 内 JOIN alliance_enterprise_links 以 tenant_id 强制约束，杜绝依赖调用方自觉）
- [P2] L324-329: UpdateExpertIsPublic 跨租户按 id 直接 UPDATE is_public，无 tenant 条件，依赖调用方先校验专家所属企业已引入本校，越权风险面与上同
- [P2] L333-354: ListMentorOptionsBySchoolTenant 无 LIMIT，全量返回本校已引入企业全部专家，选择器数据量增长后全量加载（最佳实践: 加分页或前端搜索型接口）

## `backend/internal/store/alliance_grant_store.go`（263 行）
- 完整逐行检查：完成
- [P2] L173-187: IsGranted 外层 WHERE（L180）与内层 EXISTS 子查询（L176-178）条件完全相同——命中时 EXISTS 恒为 true，布尔返回值实际恒 true；未授权时则返回 pgx.ErrNoRows 而非 (tenantID, false, nil)，调用方必须按 ErrNoRows 判"未授权"，语义不直观且易误用（最佳实践: 去掉冗余 EXISTS，改为 `SELECT tenant_id FROM ... LIMIT 1`，ErrNoRows 即未授权，或显式返回 granted=false）

## `backend/internal/store/alliance_grant_store_test.go`（237 行）
- 完整逐行检查：完成
- 未发现问题（集成测试依赖 TEST_DATABASE_URL，未配置时正确 Skip）

## `backend/internal/store/alliance_job_brand_store_test.go`（149 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/store/alliance_permission_store.go`（75 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/store/alliance_project_store.go`（360 行）
- 完整逐行检查：完成
- [P2] L70-100: GetProjectByID 手写 18 列逐字段扫描，与 ScanProjectRows（L23-51）完全重复，且 ScanPublicProjectRows（L228-257）又是第 3 份近似拷贝，同一文件内三份同构扫描逻辑，列增改易漏改（最佳实践: 统一用 queryOne + 公共扫描器，公共列差异用可选项处理）
- [P2] L131-154: DeleteProject 的三次 Exec（成果 project_ids 清理、协议 project_ids 清理、删除本体）未包事务，中途失败会残留部分清理（如成果已清、协议未清、项目未删），数据不一致（最佳实践: 包裹在单个事务中执行）
- 复用候选: GetProjectByID / ScanProjectRows / ScanPublicProjectRows 三份同构扫描（见上）

## `backend/internal/store/alliance_source_edit_store.go`（200 行）
- 完整逐行检查：完成
- [P2] L74-86 / L172-184: Merge*DraftToSource 的覆盖 UPDATE（`WHERE cp.id = d.source_resource_id`）未检查 RowsAffected——若原资源已被删除或 source_resource_id 为空（异常数据），覆盖静默不生效但函数返回 nil，随后 draft 被删除，企业编辑成果静默丢失（最佳实践: 校验 UPDATE 行数，0 行时返回错误并中止删除 draft）

## `backend/internal/store/alliance_store.go`（126 行）
- 完整逐行检查：完成
- [P2] L71-73: nilToEmpty(s string) string 恒等返回入参，是空操作死代码；且入参为 string 不可能为 nil，L60 的 COALESCE($1, gen_random_uuid()) 兜底永远不会触发——若调用方传空串 info.ID，插入无效 uuid 直接报错（最佳实践: 删除该函数，或把 id 参数改为 *string 让 COALESCE 真正生效）
- [P2] L78-86: queryList 忽略 scan 返回的错误（`items, _ := scan(rows)`，含 rows.Err()），扫描类型不匹配时静默返回空/部分数据并显示成功，与 queryOne（L89-103 检查 scan 错误）行为不一致，可能误导调用方（最佳实践: 与 queryOne 一致检查 scan 错误）

## `backend/internal/store/alliance_talent_rank_store.go`（246 行）
- 完整逐行检查：完成
- [P2] L21-55 + L116: listRankPositions 无 LIMIT 全量拉取租户全部 job_ability_results 评估明细进内存，listRankStudents 又 LIMIT 1000 硬截断——评估量大时内存占用高，且超过 1000 学生的租户榜单静默缺人（最佳实践: 榜单在 SQL 侧完成聚合/分页，或按专业分批）

## `backend/internal/store/alliance_talent_rank_store_test.go`（238 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/store/appeal.go`（101 行）
- 完整逐行检查：完成
- [P2] L78-88: Process 三次往返（Get→Update→Get）完成一次状态更新，且 UPDATE 仅按 id 定位无 tenant 条件，依赖调用方先 TenantID 校验归属（最佳实践: 合并为单条 UPDATE ... RETURNING，减少往返；租户校验在调用方保持或并入 SQL）

## `backend/internal/store/approvals.go`（241 行）
- 完整逐行检查：完成
- [P1] L112: Create 在插入后执行 `s.Get(ctx, *tenantID, id)`，对 *string 参数直接解引用——tenantID 入参为指针（tenant_id 列可空，设计上存在传 nil 的调用路径，L89 亦以指针接收），一旦为 nil 即 panic（核心审批创建流程，稳定性隐患）；且 tenantID 为 nil 时插入 tenant_id=NULL 后按 *tenantID 查询必然失败（最佳实践: 判空处理，或用插入返回的租户值构造查询）
- [P2] L116-125: ExistsPending 与 Create 之间非原子（先查后插），并发双提交同一目标时依赖唯一索引兜底，此时返回原始唯一冲突错误而非 ErrApprovalExists（L19 定义），调用方错误类型不一致（注释已说明唯一索引兜底，可接受；最佳实践: 捕获唯一冲突转 ErrApprovalExists）

## `backend/internal/store/approvals_test.go`（91 行）
- 完整逐行检查：完成
- 未发现问题

## `backend/internal/store/auth.go`（275 行）
- 完整逐行检查：完成
- [P2] L51-58: FindUsersByUsername 行扫描失败时 continue 静默跳过该用户且不记日志——同用户名多租户场景下若一行扫描失败，该用户将无法登录且无从排查（最佳实践: 记录 slog.Warn 或返回错误）
- [P2] L171-192 / L195-224: GetTenantByID / GetOrganizationByID / GetMajorByID 出错一律返回 nil，调用方无法区分"记录不存在"与"DB 错误"，登录/鉴权链路上可能把 DB 故障误判为"无此租户"（最佳实践: 返回 error 或至少记录日志）

## `backend/internal/store/banners.go`（120 行）
- 完整逐行检查：完成
- [P2] L120: 文件末尾悬挂 `// ===== 学期 =====` 无任何实现内容的残留注释段（疑似重构/裁剪残留，应删除或补充对应实现）

## `backend/internal/store/batch_configs.go`（239 行）
- 完整逐行检查：完成
- [P2] L44-135 + L139-239: 5 个 New*BatchTableConfig（岗位/场景/课程/评测/教务）与 5 个 Scan*BatchRows 扫描函数高度同构，仅领域类型与列集不同，新增第 6 类批次需复制粘贴整份（最佳实践: 泛型/表驱动配置生成扫描器）
- 复用候选: 5 组配置结构 + 5 个扫描函数同构（见上；与 batches.go 的 5 个单行扫描合计 10 个同构函数）

## `backend/internal/store/batches.go`（255 行）
- 完整逐行检查：完成
- [P2] L205-239: UpdateFields / Delete / UpdateStatus 写操作仅 `WHERE id = $N`，无 tenant 条件——跨租户可改写/删除任意批次，完全依赖调用方先调 TenantOf（L148-155）校验归属（越权风险面；最佳实践: 写操作并入 tenant 条件，或在 store 内强制校验）
- 复用候选: ScanJobBatchRow 等 5 个单行扫描（L57-136）与 batch_configs.go 的 5 个多行扫描函数同构重复

## `backend/internal/store/certificate_library.go`（155 行）
- 完整逐行检查：完成
- [P2] L15-29: DictConfig 中 GetByIDSQL / DeleteSQL 无租户条件（`WHERE id = $1`），虽被本文件显式带租户方法（GetByID L59-73、Delete L85-91）遮蔽，但若任何路径经嵌入的 DictStore 泛型方法调用即绕过租户隔离（最佳实践: 确认嵌入泛型方法不可达，或在配置 SQL 中直接带 tenant 条件）

---

汇总：P0=0，P1=1（approvals.go L112 nil 指针解引用），P2=20；复用候选 3 处（alliance_project_store.go 三份同构扫描；batches.go + batch_configs.go 十份同构批次扫描/配置；各测试文件 fake rows 扫描器重复）。


### report-033-034.md

# 代码审查报告 批次 033-034（backend/internal/store）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，禁止跳读；行号经 read 工具核对）。
批次清单：/tmp/batches/033-backend.json（8 文件）、/tmp/batches/034-backend.json（9 文件），共 17 文件，全部完整逐行检查完毕。
后端分层红线核查：本批次均为 store 层文件，全部 SQL 沉淀于 store 内，未发现 handler 层违规（本批次无 handler/service 文件）；store 层无读取 HTTP/Claims 行为；SQL 均为参数化查询，表名经 SanitizeIdentifier 白名单校验（content_actions.go / entity_code.go），未发现 SQL 注入；未发现密钥/敏感信息泄露。

## `backend/internal/store/certifications.go`（978 行）
- 完整逐行检查：完成
- [P2] L434: ListTasksByPointIDs 中 `if err := rows.Scan(...); err == nil { items = append(...) }` 将单行扫描错误静默吞掉，且 rows.Err() 不含 scan 错误，扫描失败时关联任务被静默丢弃且不返回任何错误。该函数被 service/evaluation_cert.go:180 GetCertificationFull 使用（认证模型聚合视图），属核心展示数据，一旦发生类型不匹配等扫描错误将产生静默不完整数据（最佳实践: 扫描错误应 `return nil, err`，与其他列表扫描函数如 ListFullPoints L411-414 保持一致）。
- [P2] L113-124 / L127-138: UpdateRuleStatus 与 UpdateRule 内 fetchRule 返回的 pgx.ErrNoRows 未映射为 ErrNotFound 直接透传（同文件 GetRule L76-85、GetRuleByTenant L519-529 均做了映射），错误语义不一致；handler 虽在调用前有 GetCertificationRuleByTenant 前置校验兜底，但存在检查与更新之间的竞态窗口会暴露裸 pgx.ErrNoRows（最佳实践: 统一由 fetch 后映射 ErrNotFound）。
- 复用候选: 无（LoadModel 的多段查询为有界固定次数查询，无 N+1）。

## `backend/internal/store/certifications_test.go`（75 行）
- 完整逐行检查：完成
- 未发现问题（测试通过 recordingQueryer 断言 UPDATE 不引用不存在列，覆盖合理）。

## `backend/internal/store/citation_stats.go`（64 行）
- 完整逐行检查：完成
- 未发现问题（分桶统计按固定标签顺序组装，逻辑正确）。

## `backend/internal/store/community.go`（210 行）
- 完整逐行检查：完成
- [P2] L78-87 与 L89-102: ListTopics 中 COUNT 查询与列表查询的 where 条件（含 mine 分支）各拼一份，参数占位符编号还需随 mine 分支切换（LIMIT $2/$3 vs $3/$4），两处过滤逻辑重复维护，后续新增过滤条件时易漏改导致 count 与列表不一致（最佳实践: 复用同一条件构建，或对 mine 分支统一参数序）。
- 复用候选: 无。

## `backend/internal/store/content_actions.go`（245 行）
- 完整逐行检查：完成
- 未发现问题（Transition 采用事务内 CAS 更新防并发双发，版本自增与快照写入均在同一事务，Review/Invite 的表名与列名经白名单 SanitizeIdentifier 校验，无注入风险；NextVersion 边界行为与测试一致）。
- 复用候选: allowedStatusTransitions 状态流转矩阵与 content_actions_test.go L10-17 的 transitionMatrix 完全重复定义，双份维护易漂移（见测试文件段）。

## `backend/internal/store/content_actions_test.go`（152 行）
- 完整逐行检查：完成
- [P2] L10-17: transitionMatrix 与 content_actions.go L59-66 的 allowedStatusTransitions 重复定义同一张状态流转表，且测试断言依赖这份副本而非被测实现的数据，若实现改动而测试副本未同步，测试将无法发现真实行为变化（最佳实践: 测试直接引用 store 包内定义的 allowedStatusTransitions）。
- 复用候选: 与 content_actions.go 的状态矩阵重复（同文件已记录）。

## `backend/internal/store/course_assessments.go`（211 行）
- 完整逐行检查：完成
- [P2] L127-133: CreateTempExam 先 SELECT 查重再 INSERT 的 check-then-act 非原子，并发下仍可能触发 exams 唯一键冲突使事务中止（25P02），与注释"避免唯一键冲突"的意图不完全吻合；当前依赖发布流程 Transition 的 CAS 串行兜底，实际影响小（最佳实践: 直接尝试 INSERT 并在唯一冲突时 SELECT 复用，或将查重与插入置于同一语句/锁内）。
- 复用候选: 无。

## `backend/internal/store/course_clone.go`（517 行）
- 完整逐行检查：完成
- [P2] L170-171: cloneCourseBindings 中资源绑定行的 `if err := resRows.Scan(&resID); err != nil { continue }` 静默吞掉扫描错误，而同一函数内知识点绑定循环 L141-147 对扫描错误是正常 return err，处理不一致；一旦发生扫描错误，克隆的课程会静默缺失部分资源绑定（最佳实践: 与 L141-147 一致 return err）。
- [P2] L253-257: 克隆节点时若父节点 ID 不在 nodeIDMap（历史脏数据/父节点缺失），newParentID 静默置 nil，父子层级关系被静默破坏（子节点变根节点）而不报错或告警，克隆结果与源课程结构不一致且难以察觉（最佳实践: 父节点映射缺失时返回错误或至少记录告警）。
- 复用候选: 无（整树克隆在单事务内批量执行，无循环内逐条独立事务问题）。

## `backend/internal/store/course_nodes.go`（497 行）
- 完整逐行检查：完成
- [P2] L415/L437/L456: ListNodeKnowledgePointNames、ListNodeResourceNames、ListNodeEvalMethods 三个导出辅助方法均以 `err == nil` 条件吞掉扫描错误并返回部分数据，出错时导出内容静默不完整（容错设计但无任何失败信号）（最佳实践: 扫描错误直接 return，或返回 ([]string, error) 让调用方感知）。
- [P2] L182-199: Delete 的删除保护为"先 EXISTS 检查后 DELETE"的非原子 check-then-act，检查与删除之间的窗口内新产生的测评成绩/考试结果不会被保护，节点仍被删除（成绩随 FK CASCADE 丢失）；低频竞态，非核心场景（最佳实践: 将检查并入 DELETE 的 WHERE 子查询，或对节点加锁）。
- 复用候选: 见报告末尾候选 1（与 courses.go 的绑定名称导出查询同构）。

## `backend/internal/store/courses.go`（496 行）
- 完整逐行检查：完成
- [P2] L174-176: Delete 中 `DELETE FROM course_evaluation_results WHERE course_id = $1` 在 L141-155 的 inUse 保护（EXISTS course_evaluation_results 即拒绝删除）下永不可达（存在成绩则提前 return ErrResourceInUse，不存在则 DELETE 影响 0 行），属冗余死代码，建议删除或补充注释说明其仅为防御性兜底。
- [P2] L410/L491: ListCourseKnowledgePointNames、ListCourseResourceNames 同样以 `err == nil` 吞掉扫描错误返回部分数据（与 course_nodes.go 同模式）。
- 复用候选: 见报告末尾候选 1。

## `backend/internal/store/dict_store.go`（124 行）
- 完整逐行检查：完成
- [P2] L98-106: Update/Delete 不检查 RowsAffected，对不存在的 id 更新/删除静默成功返回 nil；与 GetByID（L77-85 返回 pgx.ErrNoRows）及其他 store 的"删除不存在→ErrNotFound"语义不一致，前端可能向用户误报"删除成功"（最佳实践: 检查 tag.RowsAffected()，为 0 时返回 ErrNotFound）。
- 复用候选: 无。

## `backend/internal/store/entity_code.go`（54 行）
- 完整逐行检查：完成
- 未发现问题（表名经 SanitizeIdentifier 白名单校验后才拼接 SQL，无注入；随机编码碰撞有存在性检查+10 次重试兜底；rand.Read 失败回退固定编码属可容忍异常）。

## `backend/internal/store/entity_code_test.go`（35 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/store/evaluation_results.go`（489 行）
- 完整逐行检查：完成
- [P2] L142-154: Grade 单条评分 UPDATE 限定 status='pending'，0 行受影响时统一返回 ErrNotFound，会把"已评分/状态非 pending"的结果误报为"结果不存在"；同文件 BatchGrade L166-169 对同样场景返回明确的"结果不在待评分状态"错误，两处语义不一致，可能误导教师界面（最佳实践: 单条评分也区分"不存在"与"不在待评分状态"）。
- 复用候选: 见报告末尾候选 2（exam_id 匹配 SQL 片段重复）。

## `backend/internal/store/evaluation_results_ownonly_test.go`（47 行）
- 完整逐行检查：完成
- 未发现问题（覆盖 ownOnly 与普通查询的条件装配与参数数量）。

## `backend/internal/store/exam_questions.go`（113 行）
- 完整逐行检查：完成
- 未发现问题（ON CONFLICT 单语句 upsert 消除每题 2 次往返的 N+1，checksum 比对避免假变更，重算总分在事务内）。

## `backend/internal/store/exam_results.go`（589 行）
- 完整逐行检查：完成
- [P2] L351-362: FetchUserProfile 两个查询错误均被 `_ =` 吞掉，用户不存在或 DB 出错时静默返回空姓名/班级/专业；该函数结果用于 SaveResult 写入 student_name 等字段，错误路径下会以空姓名落库且调用方无从感知（最佳实践: 返回 error，由调用方决定是否容忍）。
- [P2] L48-72: Get 无行时返回裸 pgx.ErrNoRows（L62-63），而本文件其他路径与同包多数 Get 方法均映射 ErrNotFound，错误语义不一致，依赖调用方自行处理 pgx 错误（最佳实践: 统一映射 ErrNotFound）。
- 复用候选: 见报告末尾候选 2。

## 复用候选汇总（3 项）
1. 绑定实体名称导出查询同构重复（≥4 处）：courses.go ListCourseKnowledgePointNames(L396)/ListCourseResourceNames(L477) 与 course_nodes.go ListNodeKnowledgePointNames(L401)/ListNodeResourceNames(L423)/ListNodeEvalMethods(L445)，均为"按 course_id/node_id 查绑定表的名称列表返回 []string"的同构方法，可抽象为共享 helper（如 `listBoundNames(ctx, q, joinSQL, orderCol, condSQL, args)`）或泛型函数。
2. exam_id 匹配 SQL 片段重复（≥5 处）：`eu.exam_id = COALESCE(NULLIF(tem.resource_config->>'paperId',''), NULLIF(tem.resource_config->>'examId',''))::uuid` 出现在 evaluation_results.go L187-190 与 exam_results.go L243-246、L280-283；另有 hybridEvalRules jsonb 合并片段（FindNodeExamResult evaluation_results.go L315-329 与 UsageAllowRetake exam_results.go L292-306）重复，可提取为公共 SQL 常量/拼接 helper 统一维护。
3. 状态流转矩阵双份维护：content_actions.go allowedStatusTransitions 与 content_actions_test.go transitionMatrix 完全重复定义（测试应引用实现常量）。


### report-035-036.md

# 代码审查报告：批次 035 + 036（backend/internal/store）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、严重级别 P0/P1/P2、后端专项红线、复用候选）。
审查范围：批次 035 共 15 个文件（2709 行）、批次 036 共 9 个文件（2751 行），全部使用 read 工具完整逐行核对，行号均以 read 结果为准。

## `backend/internal/store/exams.go`（375 行）
- 完整逐行检查：完成
- [P1] L167-183: BulkUpdateScores 在事务内对每道题目循环执行单条 UPDATE（`for questionID, score := range scores { tx.Exec(UPDATE exam_questions ...) }`），题目数量多时（试卷可达上百题）逐条写放大；可改为单条批量 UPDATE（unnest 或 CASE WHEN）后一次性重算总分。
- [P2] L248-251: fetchExam 中 `if err == nil { e.Questions = questions }` 静默吞掉 fetchExamQuestions 的错误——题目查询失败时返回"无题目"的试卷而非报错，问题列表缺失且无日志。
- [P2] L150-153 / L156-164 / L167-183 / L186-192: RemoveQuestion、UpdateQuestionScore、BulkUpdateScores、RecalcExamTotal 均只按 exam_id/question_id 操作，未带 tenant 条件；而本文件注释（L30-31）明确"租户为强制参数：SQL 级限定 tenant_id，杜绝漏写归属校验即跨租户 IDOR"。一旦调用方遗漏 exam 归属校验，即可操作他租户试卷的题目/总分。建议统一按 exam_id + tenant 双条件限定（exam_questions 表含 tenant_id 列）。
- 复用候选: examListFrom/examListSelectColumns 常量被 favorites.go ListExams 复用（已复用，无需再抽象）。

## `backend/internal/store/exam_usage_config.go`（42 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/store/exam_usages.go`（360 行）
- 完整逐行检查：完成
- [P1] L301-329: fetchExamUsage 签名接收 tenantID（Get/Update/Create 均经此路径传入），但查询 SQL（L307-310）仅 `WHERE id = $1`，未使用 tenant 条件；与 exams.go 声明的"SQL 级租户限定"原则相悖。若任一调用方（service/handler）漏做归属比对，即可跨租户读取/更新考试安排。建议补 `AND tenant_id = $2`。
- [P2] L270: ListExamCenter 行扫描出错时 `continue` 静默跳过（无日志），考试中心列表会缺行且调用方拿到"成功"结果，排障困难。
- [P2] L91-120: SyncScheduledExamUsageStatus 在 Get（tenantID 传 ""）时会对全库 exam_usages 执行无 LIMIT 的 UPDATE 全表扫描（有 60s 节流，但每租户/每 60s 仍各触发一次）；租户多、表大时是周期写放大。可限定扫描范围或仅扫描时间窗命中的行。
- [P2] L207-213: NextAutoUsageName 采用"COUNT + 1"生成序号，并发创建同类型安排时序号可能重复（自动安排名称重复）。普通业务容忍，仅提示。

## `backend/internal/store/favorites.go`（166 行）
- 完整逐行检查：完成
- [P2] L80-124: ToggleFavorite 注释声称"避免并发下计数漂移"，但"先查 EXISTS 再插/删 + 计数 ±1"存在 TOCTOU 窗口：并发双击时两边都读到不存在 → 都 INSERT（其一 ON CONFLICT DO NOTHING）→ 计数 +2，收藏数漂移。普通业务低风险（指南允许普通业务重复插入），仅提示；如需严格可用 ON CONFLICT 后判断 RowsAffected 决定计数增减。
- 复用候选: 无。

## `backend/internal/store/honors.go`（110 行）
- 完整逐行检查：完成
- 未发现问题（List/Get/Update/Delete 均含 tenant 限定）。

## `backend/internal/store/hybrid_modules.go`（129 行）
- 完整逐行检查：完成
- 未发现问题（ReplaceByNode 的循环 INSERT 在事务内、模块数有限，可接受）。

## `backend/internal/store/imports.go`（262 行）
- 完整逐行检查：完成
- [P1] L238-240: InsertScheduleEntry 直接 `p.ClassIDs[0]` 取第一个班级 ID，未判空。导入行缺班级数据时触发 Go 数组越界 panic；handler 若无 recover，panic 会终止整个服务进程（全部用户受影响）。建议 `if len(p.ClassIDs) == 0 { return errors... }` 或在调用方校验。
- [P2] L15-46 / L50-78: FindOrCreateKnowledgePointsByNames 与 FindOrCreateResourcesByNames 中 `_, _ = q.Exec(...)`（L36/L67）与 `_ = q.QueryRow(...)`（L38/L70）吞掉 INSERT/回查错误；且 SELECT 时 `err != nil` 一律当作"不存在"（DB 瞬时错误也会走插入分支）。若插入失败且回查也失败，会把从未落库的 uuid 加入返回列表，下游按该 id 写关联会产生悬挂引用/FK 错误。建议至少把 INSERT/回查错误透出或记录日志。
- [P2] L20-44 / L55-77: 每个名称循环 2-3 条 SQL（SELECT→INSERT→SELECT），大批量导入（数百行）时逐条往返放大；可先 `name = ANY($2)` 批量查已有，再批量插入。导入为低频管理操作，仅提示。
- 复用候选: FindOrCreateKnowledgePointsByNames 与 FindOrCreateResourcesByNames 结构完全相同（查→插→回查），可抽象泛型 `findOrCreateByNames`。

## `backend/internal/store/industries.go`（67 行）
- 完整逐行检查：完成
- [P2] L18-20: UpdateSQL/GetByIDSQL/DeleteSQL 均无 tenant_id 条件，而 DictStore.Update/Delete/GetByID（dict_store.go L77-106）只按 id 执行，不做租户附加——跨租户改/删/读依赖调用方先校验归属（GetByID 返回行含 tenant_id 可供比对）。与 exams.go 的"SQL 级租户限定"原则不一致，漏校验即越权。建议 UpdateSQL/DeleteSQL 补 tenant 条件或由调用方统一先 GetByID 校验。
- 复用候选: 见 org_types.go/majors.go/on_site_question_library.go/learn_roads.go——同根因的 dict 类 SQL 配置模式（根因在 dict_store.go，不在本批次内）。

## `backend/internal/store/job_ability_results.go`（453 行）
- 完整逐行检查：完成
- [P1] L27-64: ListStudentCourseScores 的 CTE（L29-36）先对租户内全部 `status='evaluated'` 的节点测评结果做 AVG 聚合与 RANK 窗口，再在 L43 按当前学生 `WHERE ca.evaluatee_id = $2` 过滤——聚合在前、过滤在后，租户学生/节点多时每次学生查询都要全量扫描聚合。建议把 evaluatee_id 过滤下推到 CTE 内（先按学生收敛再聚合），并利用 (tenant_id, evaluatee_id, status) 索引。
- 其余查询（List/Get/Summary/聚合日志/候选学生/成绩加载/Upsert/RefreshRanks）均参数化且带租户限定，未发现问题。

## `backend/internal/store/landing.go`（49 行）
- 完整逐行检查：完成
- 未发现问题（递归 CTE 沿组织树向上，majors 按名称匹配已约束租户，DISTINCT 去重，结果集有界）。

## `backend/internal/store/learn_roads.go`（124 行）
- 完整逐行检查：完成
- 未发现问题（GetByID/Update/Delete 均显式带 tenant_id 覆盖了嵌入的 DictStore 方法；normalizePositionIDs 丢弃非法 UUID 合理）。

## `backend/internal/store/lesson_behaviors.go`（111 行）
- 完整逐行检查：完成
- 未发现问题（ListRecords LIMIT 1000 有界；Upsert ON CONFLICT 幂等）。

## `backend/internal/store/lesson_content.go`（285 行）
- 完整逐行检查：完成
- [P2] L47-66: CitationStats 对租户内每个知识点执行 4 个相关子查询计数（courses/node_knowledge_point_bindings/question_bank_knowledge_points/questions），知识点多时统计查询较慢；管理页低频接口，仅提示，可改为 LEFT JOIN + 分组聚合。
- 其余（FindByNames/ListUncited/CRUD/SyncCourseKnowledgePoints）均参数化、带租户限定，未发现问题。

## `backend/internal/store/logs.go`（93 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/internal/store/majors.go`（68 行）
- 完整逐行检查：完成
- [P2] L18-20: UpdateSQL/GetByIDSQL/DeleteSQL 无 tenant_id 条件（同 industries.go，依赖 DictStore 按 id 直执行 + 调用方校验归属），漏校验即跨租户改/删。建议补租户条件。
- 复用候选: 与 industries.go/org_types.go/on_site_question_library.go 同模式的 dict 配置。

## `backend/internal/store/node_evaluation_results.go`（284 行）
- 完整逐行检查：完成
- [P2] L49-90: Get 方法 `WHERE id = $1` 无租户参数/条件（存在租户限定版本 GetByID L145-186，但 Get 仍导出）；若 handler 以用户可控 id 直接调用 Get 即可能跨租户读取测评结果（含主观作答内容）。建议 Get 内部加租户参数或仅保留内部使用。
- 复用候选: Get（L55-89）/GetByID（L151-185）/ScanNodeEvaluationResultRows（L256-281）三处重复"pgtype.Text 可选字段 + 指针回填"样板，可抽象 `scanNodeEvalResult` 辅助函数统一处理。

## `backend/internal/store/node_quizzes.go`（235 行）
- 完整逐行检查：完成
- 未发现问题（CRUD 均带租户限定；ListQuestions 有 COUNT + LIMIT 分页）。

## `backend/internal/store/on_site_question_library.go`（54 行）
- 完整逐行检查：完成
- [P2] L16-18: UpdateSQL/GetByIDSQL/DeleteSQL 无 tenant_id 条件（同 industries/majors/org_types 模式），漏校验即跨租户改/删/读。建议补租户条件。
- 复用候选: 同上，dict 类 SQL 模式。

## `backend/internal/store/organizations.go`（282 行）
- 完整逐行检查：完成
- [P2] L105-114 / L130-145 / L251-266: Get、Update、fetchOrg 均只按 id 操作（L257 `WHERE id = $1`、L139 `WHERE id = $5`），无租户限定；Update 尤其危险——若 handler 漏校验归属即可跨租户改组织名/父节点/排序。返回行含 TenantID 供比对，但建议 SQL 层补租户条件（组织树结构变更影响面大）。
- 其余（Tree 的 1=0 纵深防御、DeleteSubtree/SubtreeIDs/MemberCounts/IsDescendant）均带租户限定或参数化，未发现问题。

## `backend/internal/store/org_types.go`（62 行）
- 完整逐行检查：完成
- [P2] L18-20: UpdateSQL/GetByIDSQL/DeleteSQL 无 tenant_id 条件（同 industries/majors 模式），漏校验即跨租户改/删。建议补租户条件。
- 复用候选: 同上，dict 类 SQL 模式（4 处同类文件）。

## `backend/internal/store/partner_cooperation_detail_test.go`（224 行）
- 完整逐行检查：完成
- 未发现问题（fakeDetailRows.Next 边界正确；assignRow 类型覆盖与 store 扫描目标一致；断言覆盖 SQL 关联过滤与参数）。

## `backend/internal/store/partner_store.go`（579 行）
- 完整逐行检查：完成
- [P2] L445-447 / L507-515: GetCooperationProject/GetCooperationAchievement 中 `_ = json.Unmarshal(colleges, ...)` 等吞掉 JSON 解析错误，数据损坏时静默返回空数组；建议记录 Warn 日志。
- [P2] L269-321: ListCooperation 固定 1+3 条查询（学校列表 + 三类内容各一条 ROW_NUMBER 窗口查询），非 N+1 且每类限 50 条，可接受；仅提示 content 表的 enterprise_ids 过滤（jsonb_array_elements_text + EXISTS）在大表上依赖 GIN/表达式索引，若无索引会全表扫描。
- 其余（租户/企业双限定、LIMIT 200 的 ListMentorTasks、参数化）未发现问题。

## `backend/internal/store/platform_settings_store.go`（78 行）
- 完整逐行检查：完成
- 未发现问题（平台级与租户级配置读写均正确，ON CONFLICT 幂等）。

## `backend/internal/store/portal.go`（944 行）
- 完整逐行检查：完成
- [P2] L48/L358/L388/L444/L512/L567/L624/L671/L727/L766/L797/L824/L860/L933: 14 处列表/统计行扫描错误被 `continue` 静默跳过，列表缺行或统计缺失且无日志、调用方拿到"成功"结果。建议统一为记录 Warn 后 continue 或返回错误（低频率类型错误至少应有日志可查）。
- [P2] L292-332 / L341-364: StudentStats、SchoolAdminStats、SchoolAdminResourceStats、PersonnelStats 等统计查询使用 `$1::uuid IS NULL OR tenant_id = $1::uuid`——tenantID 为 nil 时返回全平台（全部租户）计数；若某角色 handler 漏传租户，普通用户页面会看到平台全局统计数字（弱信息泄露）。建议调用方强制传租户，nil 仅限平台管理员入口。
- 其余（ListStudentCourses/ListSceneTasks/ListStudentExams/ListClassPlans 等均有 LIMIT 有界、参数化、班级命中过滤），未发现问题。
- 复用候选: ①14 处"scan 错误 continue"模式可抽象泛型辅助函数；②ListStudentExams（L589-630）与 exam_usages.go ListExamCenter（L237-283）高度相似——同为"手动考试安排 + 班级命中 + LEFT JOIN exam_results + SyncScheduledExamUsageStatus"，可合并为共享查询；③ResourceVersion 三级回退（排课版本→快照→live）在 StudentCourseRow（L479-487）与 SceneTaskRow（L535-543）重复，可抽象公共 SQL 片段。

## 总结
- P0: 0 处；P1: 4 处；P2: 19 处。
- 复用候选: 5 个。


### report-037-038.md

# 代码审查报告 037-038（backend/internal/store）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，禁止抽样；行号经 read 工具核对）。
批次：037（position_bindings / position_certificates / position_clone / positions / query / query 测试），038（question_banks / questions / random_draw_questions / recommends / resource_bindings / resource_codes / resource_library / roles / scenario_clone / scenario_configs）。

审查范围外确认（用于判断越权/SQL 注入是否成立，未改动任何代码）：
- handler 层对 store 无租户限定的 Get/Update/Delete 均有归属校验（position_ability/position_certificate/position_responsibility handler 已核验，无越权）。
- resource_bindings.go / scenario_configs.go 中拼接进 SQL 的表名/列名，全部调用点均为硬编码常量（node/task/course_resource_bindings），不可注入。
- roles.go Assign 的跨租户角色问题由 service 层 ErrInvalidRoles 校验兜底（user_management_handler L673-675 已核验）。
- 克隆接口的租户校验在 service 层（ErrPositionNotInTenant / ErrScenarioNotInTenant），store 层未限定租户属设计。
- course_resource_handler 的 limit 经 parseLimitOffset→store.ParsePageLimit 钳制到 maxPageSize=200，无无界 LIMIT。

---

## `backend/internal/store/position_bindings.go`（269 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L56-77（PositionAbilityStore.Update/Delete）与 L199-217（PositionResponsibilityStore.Update/Delete）：Update/Delete 均不带 tenant 限定（WHERE 仅 id），租户隔离完全依赖 handler 层先查后校验（已核验 position_ability_handler L108-120、position_responsibility_handler GetByIDFn L126-137，当前不可利用）。属既有设计模式，仅提示：此类"无租户限定"store 方法一旦被新调用点绕过 handler 校验即成为越权点，建议在方法注释中显式标注"调用方必须完成租户校验"。
- 复用候选: 无（fetchBinding/scanPositionAbilityRows 与本仓库各 store 的 fetch/scan 常规模式一致，不单独计）。

## `backend/internal/store/position_certificates.go`（197 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L148-164（findOrCreateLibrary）：先查后插无 ON CONFLICT 兜底；positions.go 的 PrepareCertificate（L486-506）对同一 certificate_library 插入已用 `ON CONFLICT (tenant_id, name) DO NOTHING` 幂等化，两处行为不一致。并发首次创建同名证书时唯一约束冲突 → 其中一个请求 500（低概率、非核心；最佳实践: 对齐 PrepareCertificate 的幂等写法）。

## `backend/internal/store/position_clone.go`（343 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L106-131 / L134-171 / L173-219 / L221-262 / L264-292：cloneMajors/cloneResponsibilities/cloneAbilityBindings/cloneAbilityDomains/cloneCertificates 五个函数均为"SELECT 全量 → 循环逐条 INSERT"的相同骨架（事务内可接受，但骨架重复 5 处）。
- 复用候选: 与 scenario_clone.go 的 cloneTaskDeliverables 等 6 个函数是同一"读全量→逐条插入"模式（合计 ≥3 处），可抽象通用 `cloneRows(tx, selectSQL, insertSQL, ...)` 辅助函数；另 FetchPosition（L295-343）与 positions.go fetchPosition（L576-626）查询高度重复（仅少 tenant_id/source_type/source_resource_id 列），可合并为带列选择的单一实现。

## `backend/internal/store/positions.go`（731 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L421-432（SaveFull 能力绑定插入）：`ON CONFLICT (career_position_id, responsibility_id, ability_point_id) DO UPDATE` 分支下，冲突命中时数据库保留的是首条已插入行（id 为第一次生成的 uuid），而 bindingIDMap 记录的却是本次新生成的 uuid（从未入库）；当一次 SaveFull payload 内出现重复 (responsibility_id, ability_point_id) 组合时（异常/恶意输入），L441-447 的 ability_domains.binding_ids 会写入不存在的绑定 id（孤儿引用，前端能力域回显断裂）。L386 已先 DELETE 该岗位全部绑定，正常流程不触发，但建议冲突分支改为回读实际行 id 再入 map（如 `INSERT ... ON CONFLICT ... RETURNING id`）。
- [P2] L682-685（ListBySourceEnterprise）：search 直接拼 `"%"+search+"%"` 进 ILIKE，未转义 %/_ 通配符；query.go ExecuteListQuery（L412-419）已做转义，此处行为不一致（搜索 `50%` 会匹配所有含 50 的串）。
- [P2] L476-478（PrepareAbilityPoint）与 L502-504（PrepareCertificate）：`_ = q.QueryRow(...).Scan(&existingID)` 忽略回读查询错误，仅依赖 ON CONFLICT 幂等兜底；若回读因瞬时故障失败，会返回未落库的 newID，随后 Get 404。建议显式处理 err（至少记日志）。

## `backend/internal/store/query.go`（664 行）
- 完整逐行检查：完成
- 未发现问题。白名单校验（SanitizeIdentifier/ValidateIdentifiers）覆盖 Table/SelectColumns/OrderBy/TenantColumn/SearchColumns/CountTable，搜索通配符转义（L412-419）、limit 钳制（maxPageSize=200）、租户缺失报 ErrMissingTenant（L399-408）等防御到位；日志仅输出参数化 SQL 文本不含用户数据。

## `backend/internal/store/query_normal_test.go`（59 行）
- 完整逐行检查：完成
- 未发现问题（覆盖 NextArg 连续编号、混合搜索参数、批次表配置完整性）。

## `backend/internal/store/query_test.go`（230 行）
- 完整逐行检查：完成
- 未发现问题（白名单注入拦截、ErrMissingTenant、ListQueryBuilder、白名单覆盖关键配置的回归守护）。

## `backend/internal/store/question_banks.go`（345 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L44-45（NewQuestionBankStore）：`b, _ := q.(txBeginner)` 静默忽略类型断言失败；Create（L75 用 withTxStore）无 beginner nil 校验，而 Update（L111-113）/Delete（L169-171）有显式 nil 检查 → 行为不一致。若 q 非 txBeginner（如单元测试 fake），Create 会在 withTxStore 内 nil 解引用 panic；生产环境 q 恒为 *store.Store（实现 Begin），风险低。最佳实践: 与 Update/Delete 对齐显式检查，或断言失败即 panic。
- 复用候选: fetchBank（L240-277）与 fetchBankScoped（L280-317）除 WHERE 租户条件外逐行相同（20 列扫描体重复 3 份：fetchBank/fetchBankScoped/ScanQuestionBankRows L320-345）。可合并为"可选租户过滤"单查询 + 共用行扫描函数。

## `backend/internal/store/questions.go`（231 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L104（BatchCreate）：批量生成 code 用 `GenerateEntityCode("TM")`（纯随机 8 字符、无存在性检查/重试），而单条 Create 用调用方传入 code、其他实体（如 question_banks.go L202、positions.go L465）用 GenerateUniqueEntityCode（查询+重试 10 次）。批量导入量足够大时随机碰撞 → 整批事务因唯一约束失败（低概率）。最佳实践: 统一走 GenerateUniqueEntityCode。

## `backend/internal/store/random_draw_questions.go`（140 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L27-33（Get）：直接透传 pgx.ErrNoRows，未映射为 ErrNotFound（当前靠 crud 骨架 crud.go L130 同时兼容两种错误才正常 404）；与本仓库多数 store（如 position_bindings.go L30-32）约定不一致。
- [P2] L65-72（Delete）：withTxStore 无 beginner nil 校验（与 question_banks.Create 同模式，仅一致性提示）。

## `backend/internal/store/recommends.go`（134 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L25-31（Get）：同 random_draw_questions.go，直接透传 pgx.ErrNoRows 未映射 ErrNotFound（crud 骨架兼容，非功能性缺陷，一致性提示）。

## `backend/internal/store/resource_bindings.go`（336 行）
- 完整逐行检查：完成
- [P1] L146-149（Bind）：`_ = afterBind(ctx, s.q, bindID, resourceID)` 吞掉 afterBind 错误。课程绑定场景 afterBind=CourseSyncBind（L317-325 同步 courses.resource_ids/resource_count），若该 UPDATE 失败，绑定行已插入但课程聚合字段未同步 → 静默数据不一致（课程资源两处视图不一致且用户无感知）；而 Unbind（L167-171）对 afterUnbind 错误是上抛的，行为不对称。最佳实践: 与 Unbind 一致返回错误；或至少记日志并提示前端。
- [P2] L61 / L113-116 / L138-140 / L156 / L164 / L178：bind.Table、bind.IDCol、bindTable、bindCol 直接字符串拼接进 SQL，未经 SanitizeIdentifier 白名单校验（query.go 已有白名单先例）。当前全部调用点均为硬编码常量（node_resource_handler L105/153/183、task_resource_handler L160/175、course_resource_handler L96/158/175），不可利用；建议加白名单作为纵深防御。
- [P2] L154-173（Unbind）：先 SELECT 再 DELETE 无事务包裹，并发下两语句之间行被删除时 afterUnbind 收到的是已删行的旧 id（幂等容忍，低风险）。
- 未发现 P0。

## `backend/internal/store/resource_codes.go`（124 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L124：文件尾部残留 `// ===== 推荐位 =====` 注释（从 recommends.go 复制遗留），应删除。
- [P2] L25-31（Get）：同前，pgx.ErrNoRows 未映射 ErrNotFound（crud 骨架兼容，一致性提示）。

## `backend/internal/store/resource_library.go`（425 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L318-326（Delete）：withTxStore 无 beginner nil 校验（同模式，一致性提示）。Get/Update 无租户限定为设计（L268 注释明确 handler 层负责跨租户校验，已核验 handler）。

## `backend/internal/store/roles.go`（100 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L81-99（Assign）：INSERT user_roles 前未校验 roleID 存在且属于 tenantID（tenant 仅用于 user_count 更新条件）；当前由 service 层 ErrInvalidRoles 校验兜底（已核验 user_management_handler L671-675），不可利用；建议在 Assign 内校验角色租户归属作为纵深防御，避免未来调用点遗漏。
- [P2] L61-71（Delete）：withTxStore 无 beginner nil 校验（同模式）。

## `backend/internal/store/scenario_clone.go`（533 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L104-110（主任务循环）、L203-208（cloneTaskDeliverables）、L413-417（cloneSimpleBindings）、L463-467（cloneScenarioWeights）、L504-508（cloneScenarioGradeMappings）：多处 rows.Scan 失败时 `continue` 静默跳过该行，克隆"成功"但结果不完整（如某任务/交付物/权重被静默丢弃），用户无任何提示；且与同文件 L248/L295 等处的 `return err` 处理不一致。最佳实践: 扫描失败返回错误（事务回滚）或至少 slog.Error 记录。
- [P2] L436-439（remapTaskDependencyIDs）：`if err != nil || len(oldDeps) == 0 { return nil }` 查询出错时静默吞错继续，依赖重映射可能缺失且无提示。建议 err != nil 时返回错误。
- [P2] L170-185（GenerateUniqueScenarioCode）：查询出错时（`err != nil || !exists`）直接返回 base，可能撞唯一约束 → 由外层事务回滚兜底（非静默失败），可接受；可考虑显式报错。
- 复用候选: cloneTaskDeliverables / cloneTaskScoreRules / cloneTaskEvalPoints / cloneTaskReviewSteps / cloneScenarioWeights / cloneScenarioGradeMappings 六个函数均为"SELECT 全量 → 逐条 INSERT"重复骨架（≥3 处，与 position_clone.go 同类），可抽象通用 cloneRows 辅助（cloneSimpleBindings L406-432 已示范该模式）。

## `backend/internal/store/scenario_configs.go`（258 行）
- 完整逐行检查：完成
- 未发现 P0/P1。
- [P2] L162：ScenarioGradeStore 上残留注释 `// Delete 删除等级映射。`，但该类并无 Delete 方法（误留注释），应删除或补方法。
- [P2] L223-226（TaskIDOf）：bindTable 直接拼接进 SQL 无白名单校验；当前调用点（task_knowledge_ability_handler L62/L115）均为硬编码常量，不可利用（同 resource_bindings 的 P2，纵深防御建议）。

---

## 汇总
- P0: 0
- P1: 1（resource_bindings.go Bind 吞 afterBind 错误 → 课程资源聚合字段静默不一致）
- P2: 见各文件段落
- 复用候选: 3 组（position_clone.go 与 scenario_clone.go 的克隆骨架；position_clone.FetchPosition 与 positions.fetchPosition；question_banks.fetchBank/fetchBankScoped/ScanQuestionBankRows）


### report-039-040.md

# 代码审查报告 039-040（backend/internal/store 快照/排课/场景任务域）

审查依据：docs/code-review/REVIEW-GUIDE.md；逐文件完整逐行阅读，行号经 read 工具核对。
批次 039：scenarios.go / scenario_tasks.go / scheduling.go / scheduling_test.go / snapshot_builders.go
批次 040：snapshot_grading_test.go / snapshots.go / snapshot_stamping_test.go / snapshots_test.go / staff_titles.go / store.go

## `backend/internal/store/scenarios.go`（348 行）
- 完整逐行检查：完成
- [P2] L164: 场景删除 SQL `DELETE FROM scenarios WHERE id = $1` 无 tenant_id 条件，与同批 scenario_tasks.go L129 的任务删除（`AND tenant_id = $2`）不一致；当前隔离依赖 handler 层 verifyTenantOwnership（scenario_handler.go L308 先查行校验归属），store 层无兜底，若未来调用方遗漏归属校验将造成跨租户物理删除。（最佳实践: 删除 SQL 增加 tenant_id 参数，或至少在 store 注释中显式声明"租户校验由调用方保证"）
- [P2] L122-175: Delete 在事务内先收集全部 taskID 再逐条调用 CleanupTaskExamUsages（每条含 2 次 SQL）；任务数多时事务内 SQL 数翻倍，属删除低频路径可接受，仅提示可批量化为单条 `DELETE ... WHERE target_type='task' AND target_ids && ARRAY[...]`。

## `backend/internal/store/scenario_tasks.go`（395 行）
- 完整逐行检查：完成
- [P2] L134-143: Reorder 循环内逐条 UPDATE（每个任务一条 SQL）；同一事务内执行，任务数通常较少（≤几十），非核心接口，仅维护性提示——可改为 `UPDATE scenario_tasks SET sort_order = u.ord FROM unnest($1::uuid[]) WITH ORDINALITY u(id, ord) WHERE id = u.id AND scenario_id = $2` 单条完成。
- 复用候选: PopulateAbilityPointNames（L147-189）与 PopulateKnowledgePointNames（L193-235）结构完全同构（唯一差异是查询表/列名），可泛化为一个按（`id` 列名、表名、目标字段名）参数化的填充函数，消除两份 40 行重复。

## `backend/internal/store/scheduling.go`（1104 行）
- 完整逐行检查：完成
- [P2] L1083-1104: BatchCreateSchedules（自动排课批量插入）为循环内逐条 INSERT + 逐条 UPDATE teaching_plan_entries（每条 2 次 SQL）；一次排入上百条时事务内往返放大明显，可合并为单条 `INSERT INTO schedule_entries ... SELECT ... FROM unnest(...)` 批量语句 + 一次批量 UPDATE（未排条目用 `teaching_plan_entries.id = ANY(...)`）。
- [P2] L634（ListPendingPlanEntries）、L774-776（ListTimetableEntries）、L977（ListScheduledExportMap）、L1034/1053/1075（ListTeacherNames/ListVenueNames/ListClassNames）: 列表扫描在 rows.Scan 失败时以 `continue` 静默丢行并最终返回 nil err，与其他 store（如 scenario_tasks.go scanTaskRows 直接返回错误）行为不一致；Scan 错误极少见，但会导致列表在类型不匹配等异常时静默缺行、前端误以为数据不存在。（最佳实践: 统一为扫描错误即返回，或至少对 continue 分支记日志）
- 其余（冲突校验 L377-460 参数化、PublishScheduleEntries L692-731 发布低频每行相关子查询、advisory 锁 L327-329、ReplacePeriodSlots 小基数循环 L156-213）均属合理设计，未发现问题。

## `backend/internal/store/scheduling_test.go`（81 行）
- 完整逐行检查：完成
- 未发现问题（fake Queryer 单测，覆盖 PlanEntryTenantID 经 teaching_plans JOIN 取租户的回归语义与错误路径）。

## `backend/internal/store/snapshot_builders.go`（674 行）
- 完整逐行检查：完成
- [P2] L419-430: 课程快照的颗粒课一层对每个 granularID 顺序调用 buildCourseCore（每颗粒课约 6 次查询）；引用颗粒课较多（如 20 门）时发布路径查询数放大为 N×6（N+1 形态）。发布为低频操作可接受，仅提示可改为并发或批量读取。
- 其余（putObj/putArr 片段累积抽象、taskIDsSub/configIDsSub 子查询参数复用、连带引用 ID 聚合单条查询、ability_points 跨租户 is_public 放宽、BuildExamSnapshot/QuestionBankSnapshot 简单结构）均未发现问题。

## `backend/internal/store/snapshot_grading_test.go`（577 行）
- 完整逐行检查：完成
- 未发现问题（DB 集成测试：判分快照化与缺档回退、反向回写链版本定位、删题 FK SET NULL、五类资源删除保护、temp exam 清理防 CASCADE 毁成绩、联盟合并 bump+快照；断言完整）。

## `backend/internal/store/snapshots.go`（201 行）
- 完整逐行检查：完成
- [P2] L36-37: SaveSnapshot 的 ON CONFLICT 依据唯一约束 uq_resource_snapshots（migration 158：UNIQUE(resource_type, resource_id, version)，不含 tenant_id），DO UPDATE 会以 EXCLUDED.tenant_id 覆盖既有行；跨租户同 (type,id,version) 需资源 UUID 碰撞或他租户以同一资源 id 写入，实际不可达且写路径均带资源所属租户，仅建议将 tenant_id 纳入唯一约束作防御性兜底。
- 其余（LiveState/GetSnapshot 一律 tenant 限定、SanitizeIdentifier 白名单防注入、ResolveResourceVersion/ExpectedOrLatestVersion 降级语义、SyncTempExamSnapshot 幂等）均未发现问题。

## `backend/internal/store/snapshot_stamping_test.go`（497 行）
- 完整逐行检查：完成
- 未发现问题（DB 集成测试：排课发布/考试安排/场景节点提交/同步三函数/temp exam 兜底的版本盖章语义全覆盖）。

## `backend/internal/store/snapshots_test.go`（674 行）
- 完整逐行检查：完成
- 未发现问题（常量一致性校验、Save/Get/Latest 幂等与跨租户隔离、场景/课程/试卷/题库/岗位快照往返、Transition 发布落快照与 teaching_plans 白名单过滤）。

## `backend/internal/store/staff_titles.go`（87 行）
- 完整逐行检查：完成
- [P2] L18/L19/L20（UpdateSQL/GetByIDSQL/DeleteSQL）与 L51-56（UpdateStatus）: SQL 均无 tenant_id 条件，租户隔离完全依赖 handler 层 crud 骨架的 CheckOwnership/verifyTenantOwnership（staff_title_handler.go L74-75、L175）；当前调用路径安全，但 store 层无兜底，属于 DictStore 通用基类的既定契约（dict_store.go L27-31 注释），建议在 SQL 中限定 tenant_id 或显式注释该契约，防止未来绕过 handler 的调用方造成跨租户读写。
- 其余（BatchCountUsersByTitle 单条 unnest 聚合、CountUserRefs 参数化）未发现问题。

## `backend/internal/store/store.go`（688 行）
- 完整逐行检查：完成
- 未发现问题（纯装配注册表 + WithTx/Begin/withTxStore 事务模板；txBeginner 仅池/连接可 Begin、事务内返回 ErrNestedTransaction 的防护正确）。


### report-041-042.md

# 代码审查报告 041-042（backend/internal/store 批次）

审查范围：/tmp/batches/041-backend.json 与 /tmp/batches/042-backend.json 所列 17 个文件，全部完整逐行阅读。
审查依据：docs/code-review/REVIEW-GUIDE.md（严重级别 P0/P1/P2、排除项、后端专项红线）。
统计：P0 = 0，P1 = 1，P2 = 22，复用候选 = 3。

---

## `backend/internal/store/store_tx_test.go`（72 行）
- 完整逐行检查：完成
- 未发现问题。测试文件：fakeQueryer 仅验证 Begin 嵌套事务防护；TestStoreWithTxOnConn 为 TEST_DATABASE_URL 集成测试（未设置时 Skip），无资源泄漏（pool/conn 均 defer 释放）。

## `backend/internal/store/student_portraits.go`（288 行）
- 完整逐行检查：完成
- [P2] L54-60: GetPortraitByUserPosition 按 (user_id, career_position_id) 查询无租户条件；当前唯一调用方 handler Generate（student_portrait_handler.go L205-209）在调用前已校验用户属当前租户，暂无越权利用，但 store 层方法本身不限定租户，与同文件 GetPortrait/DeleteArchive 的租户限定风格不一致（最佳实践: 将租户校验收敛进 store，或至少在方法注释标明"须由调用方先校验租户归属"）。
- [P2] L83-89/L160-179: GetArchive 与 fetchArchive 仅按 id 查询、无租户限定（DeleteArchive/GetPortrait 均带 tenant_id）。当前 GetArchive 仅被 CreateArchive 内部调用，风险低，但与同文件其他方法不一致，属潜在 IDOR 缺口（最佳实践: 统一租户限定或注明归属校验责任方）。

## `backend/internal/store/subscriptions.go`（103 行）
- 完整逐行检查：完成
- [P2] L78-90: Update 先 Get(id) 做存在性检查再 Exec UPDATE 再 Get 返回，单次更新 3 次往返；非循环调用影响小，但与 GetByTenant 等单查模式不一致（最佳实践: 用 UPDATE ... RETURNING 或检查 RowsAffected 收敛为 1 次查询）。
- 复用候选: 与 task_evaluation.go UpdateRubricTemplate、training_programs.go Update/UpdateStatus、workflows.go Update、user_extension_fields.go Update 同为"先 Get 校验 → Update → 再 Get 返回"双往返模式（≥5 处），可统一为"UPDATE ... RETURNING + RowsAffected"或共享封装。

## `backend/internal/store/subscriptions_test.go`（49 行）
- 完整逐行检查：完成
- 未发现问题。fake Queryer/Row 仅验证 ErrNotFound 映射，符合"简单优先"。

## `backend/internal/store/tags.go`（231 行）
- 完整逐行检查：完成
- [P2] L17-19: isUniqueViolation 只是 IsUniqueViolation 的零语义薄包装（同名同参数直接转发），无额外行为（最佳实践: 直接调用 IsUniqueViolation，删掉包装层）。
- 复用候选: L99-127 SetResourceTags 的事务内"先删后插 + ON CONFLICT DO NOTHING"关系替换模式，与 teaching_plans.go L405-416 UpdatePlanEntry 班级关联替换、training_programs.go L145-167 PutCourses 全量替换同构（3 处），可抽象通用 replaceRelations(ctx, tx, 删除条件, 插入项列表) 助手。

## `backend/internal/store/task_evaluation.go`（700 行）
- 完整逐行检查：完成
- [P2] L150-156/L168-174/L186-195: FetchTaskMethods 三个子查询循环（eval_points/score_rules/review_steps）中 Scan 出错仅 `continue` 静默跳过，且循环结束后均未检查 rows.Err()——若连接中途失败，方法会静默返回残缺数据而不报错（最佳实践: 收集首个 scan 错误并 return，循环后补 rows.Err() 检查）。
- [P2] L693-698: ListEnabledMethodKeys 同样用 `if err := rows.Scan(&k); err == nil` 吞掉扫描错误且无 rows.Err() 检查，导出时可能静默缺失方法 key（最佳实践: 与 L694-697 改为出错即返回 err 并检查 rows.Err()）。
- [P2] L46-98: GetRubricTemplate/UpdateRubricTemplate/DeleteRubricTemplate 均无租户条件；当前 handler（task_evaluation_handler.go L245-248/L310-313）在调用后/调用前有 TenantID 归属比对兜底，暂无越权，但 store 层缺少租户限定与同文件 SaveTaskMethod 等带租户的方法不一致（最佳实践: 租户限定下沉 store 或注释标明责任方）。
- [P2] L77-89: UpdateRubricTemplate 先 Get 后 Update 再 Get 共 3 次往返（见 subscriptions.go 复用候选）。
- 复用候选: 同 subscriptions.go——"先 Get → Update → 再 Get"双往返模式。

## `backend/internal/store/teaching_plans.go`（489 行）
- 完整逐行检查：完成
- [P2] L293-304/L439-444: GetByID、MarkConfirmed 无租户限定（注释说明供 contentActions 流转后回查），与 Get/ListPlanEntries 等租户限定方法风格不一致；若未来被新 handler 以用户可控 id 调用即为 IDOR 缺口（最佳实践: 限定调用方范围并在方法注释声明"仅限内部流转回查，禁止直接暴露给 handler"）。
- [P2] L476-489: ScanTeachingPlanRows 未检查 rows.Err()（同文件 ListPlanEntries L358 有检查），ExecuteListQuery 若未兜底则列表可能静默截断（最佳实践: 与 ListPlanEntries 保持一致 return items, rows.Err()）。
- 复用候选: 同 tags.go——L391-419 UpdatePlanEntry 的"事务内删除+逐条 INSERT ... ON CONFLICT DO NOTHING"关系替换模式。

## `backend/internal/store/tenant_admins.go`（181 行）
- 完整逐行检查：完成
- [P2] L79-84: Create 中角色绑定用 `INSERT ... SELECT id FROM roles WHERE tenant_id=$3 AND code=$4 LIMIT 1`，若租户内不存在该角色则插入 0 行且不报错——管理员用户创建成功但无角色绑定，静默降级（最佳实践: 检查 RowsAffected，为 0 时返回明确错误）。
- [P2] L128-138: ResetPassword 仅按 adminID 更新密码、无租户条件；当前调用方（tenant_handler.go L817-820/L831）已先经 AdminService.Get(tenantID, adminID, roleCode) 校验归属，但 store 层方法可被任意调用方重置任意用户密码，责任面大（最佳实践: 增加 tenantID 参数或注释声明必须由调用方校验）。
- [P2] L19/L742-743: TenantAdminItem.NewPassword 携带明文密码回传前端（创建时一次性返回初始密码，属有意设计"仅创建时返回一次"），但明文密码出现在 HTTP 响应体中，若网关/日志记录响应体即构成泄露面（最佳实践: 确认访问日志不记录响应体；可考虑前端首次登录强制改密以缩短明文暴露窗口）。
- 复用候选: L85-90/L107-111 的角色 user_count 维护与 users.go Create/BindRoles/RebindUserRole/BatchDelete、tenants.go CreateWithDefaults 共 7 处重复（UPDATE roles SET user_count±1），可抽象 store 层 adjustRoleUserCount(ctx, q, roleID, delta) 助手。

## `backend/internal/store/tenants.go`（705 行）
- 完整逐行检查：完成
- [P2] L235-249: Update 对字段空值处理不一致——province/city 用 COALESCE(NULLIF($n,''), 原值) 保留原值，而 logo_url/domain/enterprise_code/contact/phone/address/website 等指针字段传 nil 会直接清空列；调用方若以部分字段 PUT 可能误清数据（最佳实践: 统一为 COALESCE 保留语义或明确区分"清空"与"不修改"）。
- [P2] L399-405/L415-420: CreateWithDefaults 先 EXISTS 预查 code/login_name 再 INSERT，存在 TOCTOU；并发创建同 code 时唯一约束冲突未映射为 ErrCodeExists 而直接 500（超管控制台低频操作，非核心，仅提示）。
- 复用候选: L486-490 角色 user_count 维护（见 tenant_admins.go 复用候选）。

## `backend/internal/store/terms.go`（120 行）
- 完整逐行检查：完成
- 未发现问题。Create/Update 置当前时清空其他学期在同一事务内完成，参数化查询，租户限定一致。

## `backend/internal/store/training_programs.go`（261 行）
- 完整逐行检查：完成
- [P2] L145-167: PutCourses 逐条课程循环，每条最多 2 次名称回查（L152/L155）+ 1 次 INSERT；且 L152/L155 用 `_ = tx.QueryRow(...).Scan(&name)` 丢弃错误，position/course 不存在时 name 静默为空串入库（配置保存场景量小、可容忍，但错误被吞属隐患）（最佳实践: 用 IN 批量回查名称，或至少把 Scan 错误并入返回值）。
- [P2] L227-242: GetByID 无租户条件（注释说明 contentActions 用），与 Get 的租户限定风格不一致，同 teaching_plans.go GetByID 处理意见。
- 复用候选: PutCourses 全量替换模式（见 tags.go 复用候选）。

## `backend/internal/store/user_extension_fields.go`（172 行）
- 完整逐行检查：完成
- [P2] L138-155: fetchField 的 SQL 仅 `WHERE id = $1`，形参 tenantID 完全未参与过滤；Get(tenantID, id) 名义上租户限定实则不限定，可返回任意租户的字段配置。当前唯一调用方 handler Update（user_extension_field_handler.go L56-61）在 Get 后做了 verifyTenantOwnership 兜底，暂无实际越权利用，但 store 层忽略租户参数属潜伏越权缺口（最佳实践: SQL 补 `AND tenant_id = $2`，或删除形参防止误用）。

## `backend/internal/store/user_relations.go`（146 行）
- 完整逐行检查：完成
- [P2] L98-104: UsersExist 用 `COUNT(*) == len(userIDs)` 判定，userIDs 含重复 id 时 COUNT 去重后小于 len，误判为不全部存在（重复 id 请求被拒，普通业务可容忍；最佳实践: 请求侧去重或改 `COUNT(DISTINCT id)` 与去重后长度比较）。
- 说明: List 动态 WHERE 全部参数化且有"无租户时 1=0"纵深防御，LIMIT 钳制 50，符合规范。

## `backend/internal/store/users.go`（517 行）
- 完整逐行检查：完成
- [P2] L134-145: Update 注释称"指针字段未携带时 COALESCE 保留原值"，但 title_ids 用 `COALESCE($14::uuid[], '{}'::uuid[])`——传 nil 会清空全部 title_ids，与其他字段保留语义不一致（部分更新可能误清岗位/职称绑定）（最佳实践: 与 institution_id 等一致改为 COALESCE($14, title_ids) 或单独处理清空语义）。
- [P2] L290-314: RebindUserRole 的角色 user_count 递减与递增为两条独立 Exec（走 s.q 非事务），第二条失败时计数漂移，与同文件 BindRoles 的事务内实现不一致（最佳实践: 包进 withTxStore）。
- [P2] L317-349: AttachUserRoles 查询失败直接 return（L335-336）且无 rows.Err() 检查，角色信息静默缺失且吞错（最佳实践: 返回 error 让调用方感知，循环后检查 rows.Err()）。
- [P2] L160-173/L148-157: UpdateStatus/ResetPassword/UpdateSelfName/UpdateContact 均无租户条件；当前 handler（user_management_handler.go L382-389/L425-432）均先 Get(tenantID, id)+verifyTenantOwnership 兜底，暂无越权，但 store 层责任面大（最佳实践: 关键写操作如 ResetPassword 增加 tenantID 形参）。L410 handler 已显式 `user.PasswordHash = ""` 防回传，处理正确。
- 复用候选: L176-186/L200-221/L254-287/L290-314 角色 user_count 维护（见 tenant_admins.go 复用候选）。

## `backend/internal/store/whitelist_consistency_test.go`（93 行）
- 完整逐行检查：完成
- 未发现问题。防回归测试逐一实例化全部 ListQueryConfig 校验白名单，覆盖全面。

## `backend/internal/store/workflows.go`（138 行）
- 完整逐行检查：完成
- [P1] L56-60: Create 在 tenantID 为 nil（全局/平台级流程，handler workflow_handler.go L61-67 在 claims.TenantID 为 nil 时传空串、经 StrPtrIfNonEmpty 转 nil）时插入 tenant_id 为 NULL 的记录，随后用 `tenant = ""` 调 s.Get：SQL 为 `tenant_id IS NOT DISTINCT FROM ''`，NULL 与 '' 互不 distinct → 必然查不到 → 返回错误，但 INSERT 已成功持久化（响应 500 + 残留数据 + 重试触发唯一冲突）。仅在无租户用户创建流程时触发，属非必现但破坏创建流程一致性的缺陷（最佳实践: tenantID 为 nil 时回查传 nil（NULL IS NOT DISTINCT FROM NULL 可命中），或直接按 INSERT RETURNING 的 id 构造返回、忽略回查失败）。

## `backend/internal/store/workflows_list_test.go`（33 行）
- 完整逐行检查：完成
- 未发现问题。验证 ids 逗号拆分与空片段行为，覆盖充分。


### report-043-044.md

# 代码审查报告 批次 043-044（frontend）

审查范围：/tmp/batches/043-frontend.json、/tmp/batches/044-frontend.json 所列全部文件，逐行完整阅读（read 工具核对行号）。
审查依据：docs/code-review/REVIEW-GUIDE.md。仅报告，未修改任何源代码。

---

## `apps/edu/app/affairs/approvals/page.tsx`（234 行）
- 完整逐行检查：完成
- [P2] L60-61: batchMap/affairsBatchMap 声明为 `Map<string, any>`，弱类型，丢失字段校验（最佳实践: 定义 `Record<string, { id: string; name: string }>` 或直接复用 AffairsBatch 类型）
- [P2] L65-68: 培养方案/教学计划列表用 `limit: 1000` 无分页拉取，而批次列表用了 fetchAllPages 分页，方式不一致；数据超 1000 条时方案/计划被截断（最佳实践: 统一使用 fetchAllPages）
- [P2] L89-94: getStepInfoFn 通过 `programRecords.includes(a)` 判断记录归属，mapRecord 对每条记录调用一次，O(n²)；数据量大时重复线性扫描（最佳实践: 维护一个 Set 或按 id 建 Map 判断）

## `apps/edu/app/affairs/batches/page.tsx`（17 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/affairs/config/page.tsx`（40 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/affairs/layout.tsx`（12 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/affairs/majors/page.tsx`（1 行）
- 完整逐行检查：完成
- 未发现问题（单行转发壳，复用 portal 资源页）

## `apps/edu/app/affairs/org-structure/page.tsx`（1 行）
- 完整逐行检查：完成
- 未发现问题（单行转发壳）

## `apps/edu/app/affairs/positions/page.tsx`（1 行）
- 完整逐行检查：完成
- 未发现问题（单行转发壳）

## `apps/edu/app/affairs/programs/[id]/_components/courses-tab.tsx`（509 行）
- 完整逐行检查：完成
- [P1] L114-136 + L227-252: 加载时按 positionId 把同岗位多条课程行合并为一个分组行（保留第一条的学分/学时/性质），保存时每个分组行只生成一条 payload；若后端此前存在同一岗位的多条关联（Excel 批量导入可产生），保存会把多条折叠为一条，其余条目的学分/学时配置丢失（最佳实践: 保存前区分"原有分组行"与"新分组行"，或后端按 positionId 合并前先确认去重语义；至少加提示）
- [P2] L101-113: 对每个岗位串行 `await scenarioApi.list`（循环内逐条网络请求），岗位多时串行拉长加载时间；且该 setState 在 L134 的 seq 过期检查之前执行，快速切换 programId 时旧岗位场景数据仍会写入 map（最佳实践: Promise.all 并行请求，并复用 fetchPositionScenarios 的缓存逻辑）
- [P2] L74 + L86-146: loadCourses 未在开头 `setLoading(true)`，初次加载靠初始 state；切换 programId 重载时表格无加载态、短暂显示上一个方案的旧数据（最佳实践: loadCourses 开头置 loading）
- [P2] L129: 分组行 key 用 `pos-${pid}-${Date.now()}`，每次加载都生成新 key 导致整行 remount（最佳实践: 用 `pos-${pid}` 稳定 key）
- 复用候选: L339-357 / L382-399 / L421-438 三处完全相同的「未关联/岗位/体系课」LinkType Select（含相同 SelectItem 与 onValueChange 清空逻辑），可抽象为 `LinkTypeSelect` 组件复用

## `apps/edu/app/affairs/programs/[id]/_components/program-course-import-dialog.tsx`（132 行）
- 完整逐行检查：完成
- [P2] L31-34: handleDownload 无 try/catch，模板下载失败（网络/后端错误）产生未处理 Promise rejection（最佳实践: 包一层 try/catch 并 toast 失败原因，与其他导入对话框一致）
- [P2] L62-89: preview 失败被吞掉：未检查 `previewRes.ok`，服务端报错时 `preview.duplicates` 为 undefined → 落到 `preview.duplicates > 0` 分支之外直接执行 doImport；L86-88 的 catch 也直接改走 doImport，导致用户看到的是"导入失败"而非真实的预览失败原因，错误信息误导（最佳实践: 检查 previewRes.ok 并 toast 服务端 error，不要静默降级到直接导入）

## `apps/edu/app/affairs/programs/[id]/page.tsx`（272 行）
- 完整逐行检查：完成
- [P2] L39 + L77-82: 新建保存后 router.replace 到真实 id，isNew 翻转但 loading state（初始值 `!isNew` 只在首次挂载计算）不会重置为 true，跳转后编辑页短暂渲染空表单、无加载态（最佳实践: 监听 id 变化时重新 setLoading(true)，或对 id 变化显式触发加载态）

## `apps/edu/app/affairs/programs/page.tsx`（164 行）
- 完整逐行检查：完成
- 未发现问题（基于 ContentListPage 封装，职责清晰）

## `apps/edu/app/affairs/relations/page.tsx`（1 行）
- 完整逐行检查：完成
- 未发现问题（单行转发壳）

## `apps/edu/app/affairs/scheduling/_components/affairs-config-import-dialog.tsx`（73 行）
- 完整逐行检查：完成
- 未发现问题（allowMultiple=false 与仅取 files[0] 一致；toast 文案完整）

## `apps/edu/app/affairs/scheduling/_components/schedule-edit-dialog.tsx`（222 行）
- 完整逐行检查：完成
- 未发现问题（render 期重置 state 模式正确；删除/保存均带防重复 busy 态）

## `apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx`（501 行）
- 完整逐行检查：完成
- [P2] L86-88: 已注释 TODO 确认的已知限制——排课列表 `limit: 200` 且场地筛选在前端执行，草稿超过 200 条时场地筛选结果不完整（已标注，非新增问题；建议后续改服务端筛选/分页）

## `apps/edu/app/affairs/scheduling/_components/schedule-import-bar.tsx`（159 行）
- 完整逐行检查：完成
- 未发现问题（useImportFlow 封装完整；下载/导入均有错误 toast）

## `apps/edu/app/affairs/scheduling/_components/timetable-view-tab.tsx`（286 行）
- 完整逐行检查：完成
- [P2] L36-39: usePortalUsers 仅取 `pageSize: 100` 且无分页/搜索，教师超过 100 人时教师视图下拉缺人（最佳实践: 教师下拉支持搜索或分页加载；可复用 UserSelector 的搜索能力）

## `apps/edu/app/affairs/scheduling/_components/venue-period-config-tab.tsx`（1182 行）
- 完整逐行检查：完成
- [P2] L82: 学期列表 `limit: 100` 与 L330 场地列表 fetchAllPages 分页不一致，学期超过 100 个时列表截断（最佳实践: 统一分页策略）
- 复用候选: TermsSection（L62-310）与 VenuesSection（L314-549）的 CRUD 骨架（loadItems/openCreate/openEdit/handleSave/handleDelete + 表格 + Dialog + ConfirmDialog）几乎逐行同构，仅字段不同，可抽象泛型 CRUD Section（目前 2 处，扩展第三个即达到阈值）

## `apps/edu/app/affairs/scheduling/page.tsx`（221 行）
- 完整逐行检查：完成
- [P2] L45-46: `setPlanId((prev) => prev || targetId)` 只在首次加载时跟随 URL 的 planId 参数，SPA 内后续跳转携带不同 `?planId=` 不会切换选中计划（最佳实践: 监听 planIdParam 变化时同步 setPlanId）

## `apps/edu/app/affairs/student-portraits/page.tsx`（309 行）
- 完整逐行检查：完成
- [P1] L86-129 + L131: 搜索与组织架构筛选（filteredStudents）只作用于 usePortalUsers 返回的当前分页数据，而 totalPages/total 基于未筛选的总数；学生超过一页时，跨页匹配的学生永远搜不到，且翻页后列表与"共 N 条"总数不一致，筛选结果误导（最佳实践: 搜索/组织筛选下沉到服务端参数，或前端拉全量再分页）

## `apps/edu/app/affairs/students/page.tsx`（1 行）
- 完整逐行检查：完成
- 未发现问题（单行转发壳）

## `apps/edu/app/affairs/teachers/page.tsx`（1 行）
- 完整逐行检查：完成
- 未发现问题（单行转发壳）

## `apps/edu/app/affairs/teaching-plans/_components/generate-plan-dialog.tsx`（168 行）
- 完整逐行检查：完成
- 未发现问题（render 期重置 state 正确；409 冲突通过 toast 展示；选项加载仅弹窗打开时执行）

## `apps/edu/app/affairs/teaching-plans/[id]/_components/entry-type-badge.tsx`（24 行）
- 完整逐行检查：完成
- 未发现问题

---

## 汇总
- 批次 043：16 个文件；批次 044：8 个文件；合计 24 个文件全部逐行审查。
- P0：0 个；P1：2 个；P2：11 个。
- 复用候选：1 个（courses-tab.tsx 三处 LinkType Select 重复）。


### report-045-046.md

# 代码审查报告 批次 045-046（frontend）

审查范围：/tmp/batches/045-frontend.json、/tmp/batches/046-frontend.json 所列全部文件（共 17 个），逐行完整阅读（read 工具核对行号，未跳读/未抽查）。
审查依据：docs/code-review/REVIEW-GUIDE.md。仅报告，未修改任何源代码。

---

## `apps/edu/app/affairs/teaching-plans/[id]/page.tsx`（484 行）
- 完整逐行检查：完成
- [P2] L130-147: handleSaveAll 对每条教学计划条目串行 await teachingPlanApi.updateEntry（N 条条目 = N 次串行网络往返），条目多的计划保存耗时长（最佳实践: 用 Promise.allSettled 并行提交，失败条目仍保留编辑态供单独重试，与现有失败处理逻辑兼容）
- [P2] L182-188: handleSubmitApproval 两步非原子：先 teachingPlanApi.submit(plan.id) 成功后再 approvalApi.create，若 create 失败，catch 提示"提交失败"但计划实际已提交；用户重试会再次 submit+create，可能产生重复审批记录（最佳实践: 后端把提交与创建审批合并为单接口/单事务，或前端失败后提示"已提交待确认审批"并禁止重复提交）

## `apps/edu/app/affairs/teaching-plans/page.tsx`（222 行）
- 完整逐行检查：完成
- [P2] L18-29: mapPlan/mapBatch 参数与返回值均用 `any`，后端字段拼写错误无法静态发现（最佳实践: 用 TeachingPlan/AffairsBatch 类型或 Partial<T> 约束）

## `apps/edu/app/affairs/workflows/page.tsx`（9 行）
- 完整逐行检查：完成
- 未发现问题（薄转发壳，复用 WorkflowConfigPage）

## `apps/edu/app/changelog/page.tsx`（163 行）
- 完整逐行检查：完成
- 未发现问题（自研极简 markdown 渲染器，输入为受控静态 CHANGELOG_MARKDOWN；列表/表格解析边界由静态内容保证）

## `apps/edu/app/error.tsx`（33 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/evaluation/approvals/page.tsx`（244 行）
- 完整逐行检查：完成
- [P2] L61-66: 一次拉取题库/试卷/批次三个全量列表（limit 1000，后端实际封顶 200）仅用于名称映射，租户资源多时 payload 大、无分页（最佳实践: 改用 fetchAllPages 或按需懒加载名称映射）
- [P2] L82 + L138-176: getStepInfoFn/mapRecord 用 `bankRecords.includes(a)` 线性判定记录归属，每条记录 O(n) 扫描（最佳实践: 维护 Set<recordId> 或按 id 建 Map 判定）

## `apps/edu/app/evaluation/batches/page.tsx`（17 行）
- 完整逐行检查：完成
- 未发现问题（薄转发壳，复用 BatchGroupPage）

## `apps/edu/app/evaluation/exams/[id]/page.tsx`（744 行）
- 完整逐行检查：完成
- [P1] L254-263: handleAddQuestions 对每道题串行 await addQuestionToExam，而 addQuestionToExam 内部每次都会 loadExams() 全量刷新试卷列表（data-provider L280-281），自动抽题/手动多选一次添加 N 题 = N 次 POST + N 次全量列表刷新，组卷核心流程的性能热点（最佳实践: Promise.all 并行添加，全部完成后统一 refreshExam 一次）
- [P2] L242-243: canEdit 包含 approved/published/archived 三种终态，已审批/已发布/已归档的试卷仍可直接增删题目、改分值、拖拽排序，绕开重新审批流程，可能静默改动已发布考试内容且不升版本（最佳实践: 仅 draft/rejected 可编辑，编辑终态试卷需强制重新审批或版本号递增；与 question-banks 页的编辑口径保持一致）
- [P2] L297-323: 拖拽排序 onDragOver 每次落到不同目标位都触发一次完整 reorder PUT（含全量题目数组 + loadExams），同一拖动过程中多次拖过不同位置会并发多个请求且完成顺序不定，最终顺序可能不是最后一次拖放的位置（最佳实践: onDragEnd 时只提交一次，拖动期间仅更新本地顺序）
- [P2] L265-270: handleCreateQuestion 无 try/catch，createQuestion/addQuestionToExam 失败产生未处理 Promise rejection、无任何用户提示（最佳实践: 与其他 handler 一致包 try/catch + toast）
- [P2] L97-111: 详情拉取失败仅 reportError，静默降级到列表数据（无 questions），页面显示"暂无题目"误导用户（最佳实践: 失败时展示错误提示或重试入口）

## `apps/edu/app/evaluation/exams/page.tsx`（160 行）
- 完整逐行检查：完成
- [P2] L32-35: ExamItem 含 `questions: any[]`、mapExamItem 入参 `backend: any`，弱类型（最佳实践: 复用 lib/types 的 Exam 类型或显式字段类型）

## `apps/edu/app/evaluation/exam-usage/page.tsx`（591 行）
- 完整逐行检查：完成
- [P1] L174-180 + L197-231: 定时启用（scheduled）提交的 startTime/endTime 是 datetime-local 字符串 "YYYY-MM-DDTHH:mm"（无秒、无时区），后端 SubmitExamResult 用 time.Parse(time.RFC3339, ...) 严格解析（已用 Go 实测该格式解析失败：cannot parse "" as ":"），解析失败时 L29/L34 的窗口校验被静默跳过 → 未到开始时间/已过结束时间仍可提交，"定时开启/停止"核心功能失效；且 L174-180 toDatetimeLocal 用 UTC 时刻渲染到 datetime-local 输入框，本地时区（如 UTC+8）用户看到/回存的时间语义错乱（最佳实践: 前端提交完整 RFC3339（含秒与时区，如 ":00Z"），展示时按本地时区转换；或后端放宽/统一时间格式解析）
- [P2] L226-227 + L236-237 + L246-247 + L265-266: 创建/编辑/开启/停止/删除失败仅 reportError（控制台），无用户可见错误提示，弹窗停留无说明，用户误以为操作未生效或已生效（最佳实践: 与成功路径对称，统一 toast 失败原因）
- [P2] L101-122: 已定义 loadUsages 但初始加载（L111-122）未复用它，重复实现同一段逻辑（最佳实践: useEffect 直接调用 loadUsages）
- [P2] L104/L115: examUsageApi.list() 不带 limit，后端默认 50 条（封顶 200），考试安排超过 50 条时列表静默截断且无分页（最佳实践: 显式 limit + 分页/加载更多）

## `apps/edu/app/evaluation/exam-usage/results/page.tsx`（376 行）
- 完整逐行检查：完成
- [P1] L69: examResultApi.list({ usageId }) 不带 limit，后端默认 50 条（maxPageSize 200，见 store/query.go），>50 人考试时仅加载前 50 条（score DESC 排序）；L107-117 统计（参考人数/平均分/最高分/最低分/及格/不及格人数）与列表均基于截断数据 → 统计错误、多数学生不可见、无分页（最佳实践: 显式传 limit 并加分页，或后端提供按 usage 的聚合统计接口）
- [P1] L352: 查看详情跳 `/evaluation/lesson-results/${result.id}`，该路由是课程节点测评结果详情页（lesson-results/[id]/page.tsx 用 nodeEvaluationResultApi.get），在线考试结果应跳 `/evaluation/lesson-results/daily-exams/${result.id}`（daily-exams/[resultId] 用 examResultApi.get）；拿考试结果 id 查节点结果必失败/错数据（最佳实践: 改为 daily-exams 详情路由）
- [P2] L318: `${(result.score / result.totalScore) * 100}%`，totalScore 为 0 时产生 Infinity/NaN 无效宽度（最佳实践: 除以 0 时回退 0）
- [P2] L67-70: usage 拉取失败被 `.catch(() => null)` 吞掉，网络错误时误显示"考试记录不存在"（最佳实践: 区分 404 与网络错误并给出错误提示）

## `apps/edu/app/evaluation/job-ability/config/[id]/_components/combined-config-dialog.tsx`（333 行）
- 完整逐行检查：完成
- 未发现 P0/P1/P2 实质问题（任务权重合计校验、分档递增校验、locked 均分逻辑完整，保存失败由父组件返回 false 停留弹窗）
- 复用候选: "权重编辑 + 锁定 + 一键平均分配（distribute）"整段逻辑与 weight-config-dialog.tsx、apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx、apps/edu/app/partner/co-build/scenes/[id]/edit/tasks/page.tsx 重复（≥4 处），可抽象 WeightEditor 组件；LEVEL_ORDER 五档常量及分档 rows/error 校验与 level-config-dialog.tsx 重复（2 处）

## `apps/edu/app/evaluation/job-ability/config/[id]/_components/level-config-dialog.tsx`（199 行）
- 完整逐行检查：完成
- 未发现问题（校验完整、保存失败有 toast）
- 复用候选: LEVEL_ORDER 常量、rows/error 递增校验、resetDefault 逻辑与 combined-config-dialog.tsx 重复，可抽取共享常量/分档工具函数

## `apps/edu/app/evaluation/job-ability/config/[id]/_components/position-weight-config.tsx`（458 行）
- 完整逐行检查：完成
- 未发现问题（加载带 cancelled 防竞态、两级权重校验（点内/岗位内合计 100%）、合并弹窗保存顺序（分档→权重）与失败回滚合理）

## `apps/edu/app/evaluation/job-ability/config/[id]/_components/weight-config-dialog.tsx`（183 行）
- 完整逐行检查：完成
- 未发现问题（校验完整）
- 复用候选: 同 combined-config-dialog.tsx（distribute/lock 权重编辑模式 ≥4 处）

## `apps/edu/app/evaluation/job-ability/config/[id]/page.tsx`（10 行）
- 完整逐行检查：完成
- 未发现问题（薄转发壳，async params 用法正确）

## `apps/edu/app/evaluation/job-ability/page.tsx`（295 行）
- 完整逐行检查：完成
- [P1] L57-66: 列表加载时为每个规则各发一次 certApi.getPositionModel（Promise.all 并发，请求数 = 规则数，最高与 limit 200 同量级），典型的列表页 N+1 请求模式，规则多时后端瞬时压力大（最佳实践: 后端提供批量返回各岗位能力点数的接口，或合并进 listRules 响应）
- [P2] L50: positionApi.list({limit:200})/certApi.listRules({limit:200}) 后端封顶 200 且页面无分页，超过 200 的岗位/规则不可见（最佳实践: 分页或加载更多）


### report-047-048.md

# 代码审查报告 batch 047-048（frontend）

审查范围：批次 047（6 文件，2438 行）+ 批次 048（6 文件，2342 行），全部为 apps/edu/app/evaluation 域前端页面。
审查方式：每个文件用 read 完整逐行阅读（无跳读/抽查），行号均经 read 工具核对。
依据：docs/code-review/REVIEW-GUIDE.md（前端专项 + 严重级别 + 复用候选规则）。

## `apps/edu/app/evaluation/job-ability/results/page.tsx`（561 行）
- 完整逐行检查：完成
- 未发现问题（汇聚轮询定时器有卸载清理（L63-67）、轮询链有 generation 守卫防跨岗位交叉（L188、L170）、列表/汇总加载均有 cancelled 标记防竞态，符合前端专项要求）。

## `apps/edu/app/evaluation/landing/banks/[id]/page.tsx`（590 行）
- 完整逐行检查：完成
- [P2] L133-136: 快照 bundle 获取失败被 catch 吞掉并置 bank=null，页面渲染为"题库不存在或暂未公开"（L241）。网络/服务端瞬时错误也会呈现"不存在"文案，误导用户（前端专项：API 错误未处理误导用户）。（最佳实践: 区分"未找到"与"加载失败"两种错误态，失败时保留错误提示）
- [P2] L137-147 与 L169-178: 两个 effect（快照路径/live 路径）内重复实现同一段"knowledgeApi.list({limit:1000}) 构建知识点 id→name 字典"逻辑，复制粘贴两份。（最佳实践: 提取公共 hook 如 useKnowledgePointMap()）
- 复用候选: 知识点字典构建逻辑在本文件内重复 2 次，且全仓同类模式出现 5+ 处（random-question-dialog/question-form-dialog/knowledge-graph 等），可抽象 useKnowledgePointMap()（详见批次汇总）。

## `apps/edu/app/evaluation/landing/exam-center/page.tsx`（140 行）
- 完整逐行检查：完成
- [P2] L32: 为给考试卡片补封面图，用 `examApi.list({ status: 'published', limit: 1000 } as any)` 全量拉取最多 1000 份已发布试卷（返回完整试卷记录仅取 coverImage），`as any` 绕过类型；超过 1000 份时封面缺失且请求载荷偏大。（最佳实践: 按 examId 批量查询封面，或后端在 center 接口直接附带封面字段；去掉 as any）
- [P2] L43: `isStudent = items.length > 0 ? items[0]?.studentView : true`——以首条记录推断是否学生视图，items 为空时默认按学生视图显示"我可参加"Tab，教师空数据场景下 Tab 展示失真（低价值，属一致性提示）。

## `apps/edu/app/evaluation/landing/exams/[id]/page.tsx`（1110 行）
- 完整逐行检查：完成
- 未发现 P0/P1（防作弊监听器均随答题结束/卸载正确解绑（L300-307）、倒计时 interval 有清理（L315）、超时自动交卷有 submittedRef 防重（L320-325）、交卷失败不会误弹遮罩（endingExamRef L190、L283））。
- [P2] L44-51: 自定义 typeLabelMap 硬编码中文题型标签，与已存在的共享常量 QUESTION_TYPE_LABELS（banks/[id] L30 已使用）重复且口径可能漂移。（最佳实践: 复用 @zhiyu/shared-types 的 QUESTION_TYPE_LABELS）
- [P2] L56-81: examFromSnapshot 快照行→Exam 形状转换函数与另外 2 个文件重复（见复用候选）。
- 复用候选: examFromSnapshot（snake_case 快照行→前端 Exam 形状）在本文件 L56、daily-exams/[resultId]/page.tsx L39、scene-results/[id]/page.tsx L135 共 3 处各自实现，建议提取到 @/lib/exam-snapshot 统一维护并补类型。

## `apps/edu/app/evaluation/landing/exams/page.tsx`（7 行）
- 完整逐行检查：完成
- 未发现问题（纯 redirect 占位页）。

## `apps/edu/app/evaluation/landing/layout.tsx`（24 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/app/evaluation/landing/page.tsx`（673 行）
- 完整逐行检查：完成
- [P2] L159-160: 首屏并发拉取最多 1000 个题库 + 1000 份试卷（均 `as any` 绕类型），仅取前 1000 条参与筛选/统计（totalQuestions、批次、试卷数均可能被截断）；非核心 landing 页可容忍慢，但数量截断会导致资源静默缺失。（最佳实践: 改为分页/懒加载或提供 count 聚合接口）
- [P2] L172: `catch { /* ignore */ }` 完全吞掉首屏加载错误，失败时静默渲染空列表，无任何错误提示，误导用户（前端专项：错误未处理）。（最佳实践: 失败时提示"加载失败，请刷新重试"）

## `apps/edu/app/evaluation/layout.tsx`（15 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/app/evaluation/lesson-results/daily-exams/page.tsx`（299 行）
- 完整逐行检查：完成
- [P1] L81-87: 切换左侧考试安排时，results 状态未清空且无加载态/竞态序号守卫——新安排的接口返回前，表格持续展示上一安排的"学生/得分/提交时间"记录，与新表头（新考试安排名）错位；若两次快速切换，先后响应还可能乱序覆盖。评分页属核心流程，教师可能按错位列表误判提交人数（前端专项：状态未清空/异步竞态）。（最佳实践: 切换时先 setResults([]) 置空并显示加载态，或用 seq ref 丢弃过期响应——参考 lesson-results/page.tsx L69/L108-127 的 courseResultSeqRef 模式）
- [P2] L72 与 L91-96: 首个考试安排的 loadStats 被触发两次（主加载里 void loadStats(firstId) 未登记 statsDoneRef，随后选中 effect 又对同一 id 发起一次），重复请求。（最佳实践: 统一走 statsDoneRef 去重）
- [P2] L48/L84: examResultApi.list({ limit: 500 }) 以返回条数当"已提交人数"，超过 500 条提交的安排统计会低估（班级规模下概率低，一致性提示）。

## `apps/edu/app/evaluation/lesson-results/daily-exams/[resultId]/page.tsx`（440 行）
- 完整逐行检查：完成
- 未发现 P0/P1（评分分值校验由 QuestionGradingCard 承担、保存按钮受 allScored 约束、snapshot 版本口径 result.version→usage.examVersion→最新 回退链完整（L96-100））。
- [P2] L167-169/L425: 保存失败置 saveFailed=true 后，重试成功（setSaved(true)）时未复位 saveFailed，页面同时显示"已提交"徽标与"保存失败，请重试"红字，状态残留误导（前端专项：状态未清空）。（最佳实践: 成功路径 setSaveFailed(false)）
- [P2] L136-140: pendingQuestions 未排除 q.score===0 的题目（而 allScored L150 已排除 0 分题），0 分主观题会永远计入"待评分题目 (n)"，出现"待评>0 但可提交评分"的计数矛盾。（最佳实践: 与 allScored 同样排除 score===0）
- [P2] L39: examFromSnapshot 返回 any 且与另 2 文件重复（见复用候选），快照字段缺校验，类型安全差。
- 复用候选: examFromSnapshot 见批次汇总。

## `apps/edu/app/evaluation/lesson-results/[id]/page.tsx`（351 行）
- 完整逐行检查：完成
- 未发现 P0/P1（评分输入有 isValidScore 边界校验（L98-104）、保存成功 toast 与跳转正常、附件链接带 rel=noopener（L258）、objectiveAnswers 用 JSON.stringify 渲染无注入风险（L272））。
- [P2] L51: userManagementApi.list({ limit: 1000 }) 全量拉用户只为反查一个学生姓名，超过 1000 用户时姓名缺失显示"未知学生"；该模式在 lesson-results/page.tsx L85 等 6 处重复（见复用候选）。

## `apps/edu/app/evaluation/lesson-results/page.tsx`（558 行）
- 完整逐行检查：完成
- 未发现 P0/P1（课程结果请求已用 courseResultSeqRef 序号守卫丢弃过期响应（L69、L110-126），防快速切换竞态，模式正确）。
- [P2] L83/L85: courseApi/userManagementApi 各 limit 1000 全量拉取（`as any`），超过 1000 门课程或 1000 用户时列表/学生姓名被截断缺失（显示"未知"）。（最佳实践: 分页或按需查询）
- [P2] L108-127: 切换课程时 nodes/results 未在请求前清空，新课程数据返回前旧课程节点与提交数短暂错位展示（有 seq 守卫防竞态，仅短暂展示问题；建议 setNodes([])/setResults([]) 置空加加载态）。

# 复用候选汇总
1. **examFromSnapshot**（snake_case 试卷快照行 → 前端 Exam 形状）：landing/exams/[id]/page.tsx L56、lesson-results/daily-exams/[resultId]/page.tsx L39、scene-results/[id]/page.tsx L135 共 3 处独立实现且返回类型松散（后两处为 any）。建议提取 @/lib/exam-snapshot 统一转换 + 补类型。
2. **题型中文标签映射**：landing/exams/[id]/page.tsx L44-51 硬编码 typeLabelMap，与 @zhiyu/shared-types 的 QUESTION_TYPE_LABELS（landing/banks/[id] L30 已用）重复实现，建议统一引用共享常量。
3. **知识点 id→name 字典构建**（knowledgeApi.list({limit:1000}) + forEach 建 Map）：landing/banks/[id]/page.tsx 内重复 2 次，全仓同模式 5+ 处（components/evaluation/random-question-dialog.tsx L124、question-form-dialog.tsx L110、job/student/knowledge-graph.tsx L42 等），建议抽象 useKnowledgePointMap() hook。
4. **"全量用户表反查姓名"模式**（userManagementApi.list({limit:1000})）：lesson-results/[id]/page.tsx L51、lesson-results/page.tsx L85、scene-results/page.tsx L101、scene-results/[id]/page.tsx L763 等 6 处重复，建议封装 useUserNameMap() 或后端在结果行附姓名。


### report-049-050.md

# 代码审查报告 049-050（frontend）

审查范围：/tmp/batches/049-frontend.json、/tmp/batches/050-frontend.json，共 15 个文件。
审查方式：每个文件用 read 工具完整逐行阅读（大文件分段读完全部行），按 REVIEW-GUIDE.md 原则与严重级别记录。
审查结论：未发现 P0（安全高危/数据损坏/核心流程必现错误）；P1 共 3 条（均在 scene-results 列表页）；其余为 P1 以下维护性与稳定性问题。未修改任何源代码。

---

## `apps/edu/app/evaluation/question-banks/page.tsx`（134 行）
- 完整逐行检查：完成
- 未发现问题。（`mapBankItem` 的 `_currentUserId` 参数未使用，已以下划线命名，按"简单优先"不报。）

---

## `apps/edu/app/evaluation/question-banks/[id]/page.tsx`（902 行）
- 完整逐行检查：完成
- [P2] L95-98: `loadQuestionBanks?.().finally(() => setLoadingBank(false))` 先可选调用再链式 `.finally`：若 `loadQuestionBanks` 为 undefined，`?.()` 结果为 undefined 后调用 `.finally` 会抛 TypeError（与同文件 L102 `loadBankQuestions?.(bankId)` 的可选风格不一致；当前 data-provider 实际总是提供该函数所以暂不触发）。（最佳实践: 改为 `loadQuestionBanks?.()` 单独调用，或将 finally 也写成 `?.finally`，保证可选性一致）
- [P2] L341-351 / L353-373: 批量删除（handleBatchDelete）与批量复制（handleBatchCopy）都是循环内逐条 `await deleteQuestion/createQuestion`：选中 N 题产生 N 个顺序网络请求，任一条失败即中断并整体报"失败"，已成功部分无提示且剩余未处理（部分成功被掩盖）；批量场景应并发 + 汇总成败。（最佳实践: 参考 `apps/edu/app/job/archive/page.tsx` L105-118 handleBatchRestore 的 `Promise.allSettled` + 成功/失败数 toast 模式）
- [P2] L488（配合 L136-143）: 页面头部"题目数量"显示后端字段 `bank.questionCount`，但代码注释（L136）明确"后端 question_count 未维护"，此处已用 `questionCountByBank`（按已加载题目实时计算）却未用于该展示，数量可能与实际不一致，误导用户。（最佳实践: 头部数量改用 `questionCountByBank.get(bankId)`，或后端维护 question_count）
- 复用候选: 无（批量删除/批量复制均为单文件内同类模式，未达 3 处阈值）

---

## `apps/edu/app/evaluation/scene-results/[id]/page.tsx`（1501 行）
- 完整逐行检查：完成
- [P2] L254-432: `EvalPointGradingCard`（L254-338）与 `ScoreRuleGradingCard`（L344-432）为近乎完全重复的评分卡片组件：均为"本地分数 string state + 失焦 commitIfValid + 满分即时提交 + 评语 Textarea + 同结构 JSX"，仅数据源字段（evalPoint/scoreRule）不同，代码约 80 行重复。（最佳实践: 合并为一个通用评分卡片，props 改为 `{ id, label, description, weight, score, comment, isGraded, onChange }`）
- [P2] L763: 每次进入评分详情都 `userManagementApi.list({ limit: 1000 })` 全量拉取最多 1000 个用户，仅用于取 1 名被评学生的姓名/班级，属于核心评分页面的无谓大请求。（最佳实践: 后端提供按 id 查用户接口，或接口支持 ids 批量过滤）
- [P2] L1001: `DrawnQuestionCard` 的 key 写成 `\`${q.id}-\${oralAnswers[q.id] || ''}\``，失焦提交口头回答后 key 变化导致整张卡片卸载重挂载（局部 state 重建、滚动/焦点丢失），属于用 key 强制同步的 hack。（最佳实践: key 只保留 `q.id`，卡片内改为受控值同步）
- 复用候选: EvalPointGradingCard / ScoreRuleGradingCard 两处重复（未达 3 处阈值，仅记录，可在合并后一并考虑与 `components/shared/exam-grading/question-grading-card.tsx` 的关系）

---

## `apps/edu/app/evaluation/scene-results/page.tsx`（680 行）
- 完整逐行检查：完成
- [P1] L99-104: 页面加载即 `fetchAllPages((page, pageSize) => taskApi.list(...))` 全量分页拉取所有任务（无上限），并同时拉 200 场景 + 1000 用户 + 500 岗位；任务/用户量增长后首屏接口负载与渲染耗时线性上升，属于核心评分入口的全表拉取式加载。（最佳实践: 任务映射按需（仅当前场景/有提交记录的任务）获取，或后端提供批量映射接口）
- [P1] L139-145: 场景切换的 `evaluationResultApi.list` 请求无请求序号/取消保护，快速连续切换场景时，先发请求（旧场景）的响应后到达会 `setResults` 覆盖当前场景数据，造成"当前场景展示另一场景的学生列表"的异步竞态，属评分入口的误导性展示。（最佳实践: 参照 `job/landing/[id]/page.tsx` L88-92/L112-145 的 seq 序号丢弃过期响应，或用 AbortController）
- [P1] L292-440: `TaskMethodTabs` 组件定义在 `GradingPageContent` 渲染函数内部，每次父组件重渲染（搜索输入、展开/收起、切换场景）都会生成新的函数引用，React 视作新组件类型导致所有 `TaskMethodTabs` 卸载重挂载：已选中的测评方法 Tab 被重置回第一个、学生列表滚动/内部状态丢失。（最佳实践: 将 `TaskMethodTabs` 移到组件外部顶层定义，通过 props 传入 task）
- [P2] L142: `evaluationResultApi.list({ sceneId, limit: 500 })` 硬上限，场景提交记录超过 500 条时统计数与学生列表被静默截断。（最佳实践: 分页加载或后端聚合统计）
- [P2] L101: `userManagementApi.list({ limit: 1000 })` 全量拉用户，与评分详情页重复（见 scene-results/[id]/page.tsx L763）。（最佳实践: 同详情页建议，按需查询用户）
- 复用候选: 无

---

## `apps/edu/app/evaluation/workflows/page.tsx`（9 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `apps/edu/app/global-error.tsx`（48 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `apps/edu/app/globals.css`（130 行）
- 完整逐行检查：完成
- 未发现问题。（Tailwind v4 主题变量与工具类定义，无异常）

---

## `apps/edu/app/job/approvals/page.tsx`（140 行）
- 完整逐行检查：完成
- [P2] L44: 页面加载即对 `positionApi.list` 与 `batchApi.list` 各做一次 `fetchAllPages` 全量拉取（无上限）仅用于名称映射，数据量增长后加载变慢；且该写法与 archive/learn-roads/recommend 页重复。（最佳实践: 封装公共 `fetchAllPositions()/fetchAllBatches()` 辅助函数，见复用候选）
- 复用候选: `fetchAllPages((p,s) => positionApi.list(...))` 共 4 处（本文件 L44、job/archive L30、job/learn-roads L517、job/recommend L58）；`fetchAllPages((p,s) => batchApi.list(...))` 共 4 处（本文件 L44、job/archive L31、job/learn-roads L518、affairs/approvals L67）——可抽象为 `lib/api` 下的 `fetchAllPositions()/fetchAllBatches()` 统一分页封装

---

## `apps/edu/app/job/archive/page.tsx`（238 行）
- 完整逐行检查：完成
- [P2] L30-31: 同 approvals 页，`fetchAllPages` 全量拉取归档岗位 + 全部批次（无上限）。（最佳实践: 复用公共分页封装，并考虑归档列表后端分页）
- [P2] L120-139: `confirmBatchDelete` 用 `Promise.all` 并发删除，任一失败时 catch 统一报"批量删除失败，请稍后重试"，但此时其余删除可能已成功（部分成功被笼统报为全败，与同文件 L105-118 `handleBatchRestore` 的"成功 N 失败 M"汇总风格不一致），误导用户重试可能造成重复删除。（最佳实践: 改用 `Promise.allSettled` 并按成功/失败数量分别提示）
- 复用候选: 见 approvals 页条目

---

## `apps/edu/app/job/batches/page.tsx`（17 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `apps/edu/app/job/landing/[id]/learn/page.tsx`（185 行）
- 完整逐行检查：完成
- [P2] L54-74: 按场景逐个 `taskApi.list` 加载任务（场景数 N 个并行请求，N+1 式），且单接口 `limit: 1000` 硬上限，场景任务超过 1000 条会被截断；该逻辑与详情页 [id]/page.tsx L125-145 完全重复（含逐任务容错注释与写法）。（最佳实践: 后端提供按场景批量取任务接口，或抽取公共 hook `useScenarioTasks(scenarioId)` 复用）
- 复用候选: "场景列表 + 逐场景任务加载"逻辑 2 处（本文件 L54-74 与 job/landing/[id]/page.tsx L125-145）；`LoginPrompt` 组件 2 处（本文件 L160-184 与 job/landing/[id]/page.tsx L331-355，内容完全一致）——均未达 3 处阈值，仅记录

---

## `apps/edu/app/job/landing/[id]/page.tsx`（356 行）
- 完整逐行检查：完成
- [P2] L125-145: 场景任务加载为 N+1 并行请求 + `limit: 1000` 截断风险，且与 learn 页逻辑重复（见上）。（最佳实践: 批量接口或公共 hook）
- 说明：L112-174 第二个 effect 已用 `loadSeqRef` 序号机制正确丢弃过期响应（含 L154 注释说明复用 seq 的原因），异步竞态处理正确，无问题。
- 复用候选: 见 learn 页条目

---

## `apps/edu/app/job/landing/layout.tsx`（23 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `apps/edu/app/job/landing/page.tsx`（5 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `apps/edu/app/job/layout.tsx`（12 行）
- 完整逐行检查：完成
- 未发现问题。


### report-051-052.md

# 代码审查报告 051-052（frontend）

> 依据 docs/code-review/REVIEW-GUIDE.md 执行；全部文件已完整逐行阅读（read 工具，无跳读/抽查），行号已用 read 逐文件核对。

## `apps/edu/app/job/learn-roads/page.tsx`（855 行）
- 完整逐行检查：完成
- [P2] L617-622（配合 L578-606）: 异步竞态。`loadPositionScenes` 在内部 L590-591 直接 `setPositionScenarios/setPositionTasks`，早于外层 `seq` 守卫（L622 `if (seq !== editSeqRef.current) return`）执行；快速连续点击不同岗位"编辑学习路径"时，先发后至的过期请求仍会覆盖 `positionScenarios/positionTasks`。注释（L621）声称"丢弃过期响应"，但守卫只覆盖 `scenes` 与 loading 状态，未覆盖这两个 state（影响头部"已加载 X 个场景，Y 个任务"计数显示准确性）。
- [P2] L701: `setTimeout(() => setSaved(false), 2000)` 未保存句柄、组件卸载时未清理，卸载后回调仍会对已卸载组件 setState。
- [P2] L544 与 L618: `learnRoadApi.list({ limit: 1000 })` 在挂载 effect 与每次进入编辑时重复全量拉取（无分页、无缓存），可复用一次加载结果。
- 复用候选: 无

## `apps/edu/app/job/positions/[id]/edit/page.tsx`（397 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/job/positions/page.tsx`（105 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/job/recommend/page.tsx`（393 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/job/workflows/page.tsx`（9 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/layout.tsx`（65 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/approvals/page.tsx`（155 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/archive/page.tsx`（151 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/batches/page.tsx`（17 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/_components/ability/ability-point-selector.tsx`（202 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/_components/assessment/evaluation-method-selector.tsx`（165 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/_components/common/rich-text-editor.tsx`（219 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/_components/courses/course-admin-page.tsx`（130 行）
- 完整逐行检查：完成
- [P2] L41-44: 创建人展示逻辑不一致：当前用户是创建人时显示固定公司名"杭州知与未来科技有限公司"，否则直接透出原始 `creatorId`（UUID）。对非创建人而言"创建人"列展示的是 UUID 而非用户名/公司名，前后语义不统一（疑似意图是标记公司内置课程，但实现会让大多数浏览者看到原始 ID）。

## `apps/edu/app/lesson/admin/_components/courses/course-list.tsx`（178 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/_components/knowledge/knowledge-selector.tsx`（3 行）
- 完整逐行检查：完成
- 未发现问题（纯 re-export）

## `apps/edu/app/lesson/admin/_components/resources/resource-selector.tsx`（3 行）
- 完整逐行检查：完成
- 未发现问题（纯 re-export）

## `apps/edu/app/lesson/admin/granular/add/page.tsx`（656 行）
- 完整逐行检查：完成
- [P2] L70-73: `detailedDescription`、`background`、`estimatedHours` 三个 `useState` 均未解构 setter，值恒为 `''`；保存 payload（L361-363）恒定以空值覆盖，编辑已有课程时若后端已存有这些字段会被清空（dead state + 潜在数据覆盖）。
- [P2] L100-114: 知识点资源池的 `linked` 标志在 L106-113 用渲染闭包中的旧 `customKnowledgePointIds` 计算，早于 L100 `setCustomKnowledgePointIds(new Set())` 与 L101-105 的追加生效；首次加载时本课程自定义知识点被标为 `linked:true`，跨课程连续编辑时还会沿用上一课程的标记（stale closure 竞态）。
- [P2] L407-411（配合 L375、L386-399）: 新建课程首次点击"完成配置"只走 create + `router.replace`，`hasSavedRef` 仅在编辑分支（L375）置位，首次点击不会跳转列表页，需二次点击；期间若连续点击存在重复建课风险。

## `apps/edu/app/lesson/admin/granular/page.tsx`（17 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx`（1133 行）
- 完整逐行检查：完成
- [P2] L608-613: `ResourceModuleEditor.handleChange` 仅按资源库 `pool` 重建选中项，已绑定课程但不在资源库中的资源会在任意一次勾选变更时被静默丢弃（与颗粒课 add 页 L124-143 显式合并已绑定资源的做法不一致，编辑已有课程时存在资源丢失风险）。
- 复用候选: PreQuizzesModule（L651-690）、InClassQuizzesModule（L774-813）、HomeworksModule（L968-1007）三处"测评方式选择 + 评价规则配置"JSX 结构几乎相同，可抽象为公共 `EvalConfigSection` 组件。


### report-053-054.md

# 代码审查报告 053-054（frontend）

> 审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读，禁止抽样；仅报告高价值问题）
> 审查方式：批次 053-054 共 14 个文件全部逐行读完（含大文件分段），行号均经 read 工具核对。

---

## `apps/edu/app/lesson/admin/hybrid/add/_components/module-preview.tsx`（282 行）
- 完整逐行检查：完成
- 未发现 P0/P1/P2 实质问题。isModuleConfigured / getModuleSummary 的 switch 无 default 分支，但 AtomicModuleKey 为穷尽 union，TS 编译期可拦截，可接受。
- 复用候选：无

## `apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.test.ts`（122 行）
- 完整逐行检查：完成
- [P2] L23、L36: preQuizEvalRules/homeworkEvalRules 测试数据用 `as any` 强转，未使用正式 EvalRuleConfig 类型，测试类型覆盖不足（最佳实践: 用 makeEvalRuleConfig 类工厂构造）。
- 复用候选：无

## `apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.ts`（145 行）
- 完整逐行检查：完成
- [P2] L10、L45、L89: moduleDataFor/isEmptyData/applyModuleData 均使用 `Record<string, any>`，序列化字段无类型约束，字段名拼写错误只能在运行时暴露（最佳实践: 定义 HybridModuleData 具体类型或按 key 映射的联合类型）。
- 复用候选：无

## `apps/edu/app/lesson/admin/hybrid/add/page.tsx`（1516 行）
- 完整逐行检查：完成
- [P1] L219-224 与 L705-708: 编辑加载时从 `c.evalData` 读取 learningGoal/background/estimatedHours 写入 courseForm（L219 课程目标、L221 background、L222-224 estimatedHours），但 buildCoursePayload 的 evalData 仅回写 descriptionPdf（L705-707）。若后端对 eval_data 整列覆盖，编辑保存会静默丢失这三项数据（数据损坏风险，核心流程）（最佳实践: 保存 payload 中把 courseForm.courseObjectives/background/estimatedHours 一并回写，或与后端确认合并语义）。
- [P1] L418-444: handleReorderNodes 无环检测：拖拽节点 A 到其自身后代 B 上时，L427 `parentId: target.parentId` 会把 A.parentId 设为 A 自身（或其后代），形成 parentId 环；CourseNodeTree.buildTree 中 A 成为自身子节点，renderTreeNode 无限递归 → React 渲染栈溢出、页面崩溃（非必现但属核心编辑流程）（最佳实践: 在 handleReorderNodes 或 CourseNodeTree.handleDrop 中拒绝"目标为拖拽节点后代"的放置）。
- [P2] L411-413: handleDeleteNode 仅当 `selectedNodeId === nodeId` 时清空选中；删除父节点时若选中的是其后代，selectedNodeId 悬空，L458-464 effect 会为该已删除节点重建默认数据（幽灵状态条目，虽不落库但污染 state）。
- [P2] L716 与 L752: 删除比对仅排除 `node-` 前缀临时 ID，而新建流程根/子节点临时 ID 为 `hybrid-node-*`（L64、L306），与 isTempId 判定（L752 含 hybrid-node- 前缀）不一致；当前流程下因首次保存后端列表为空无实际影响，但属隐患（最佳实践: 删除过滤与 isTempId 使用同一判定函数）。
- [P2] L232、L359: 新节点临时 ID 用 `node-${Date.now()}`，同毫秒连续添加两个节点会碰撞导致节点/数据互相覆盖；文件内已有 uid()（L66-68）助手未复用。
- [P2] L43: 注释"以下 import 来自占位 mock 文件，后续应替换为真实 API"与实际不符（MockRichEditor 为文件内定义，下方 import 均为真实模块），误导后续维护。
- [P2] L113-127、L242-247: abilityApi.list({limit:1000}) 能力点池可能截断；编辑回填时若池加载晚于课程加载，abilityPoints 回退为 `{ id, name: id }` 且无再映射，界面上能力点名称显示为原始 id（竞态，L107-111 注释已提示但未闭环）。
- [P2] L209、L708: `(c.evalData as any)` 与整包 `as any` 绕过类型检查（最佳实践: 定义 Course 的 evalData 具体类型）。
- 复用候选：handleReorderNodes（L418-444）与 system/add/page.tsx L288-315 逐行近似重复；saveNodes 的"删除多余后端节点 + 拓扑排序 + 临时 ID→真实 ID 映射"管道（L710-813）与 system 版 L604-747 高度相似；能力点池加载（abilityApi.list + ref 同步，L107-127）与 system 版 L134-163 重复 → 建议抽公共 hook/工具函数。

## `apps/edu/app/lesson/admin/hybrid/page.tsx`（16 行）
- 完整逐行检查：完成
- 未发现问题（CourseAdminPage 薄封装）。
- 复用候选：无

## `apps/edu/app/lesson/admin/layout.tsx`（34 行）
- 完整逐行检查：完成
- 未发现问题（登录态校验 + PermissionGuard 标准布局）。
- 复用候选：无

## `apps/edu/app/lesson/admin/system/add/_components/CourseNodeTree.tsx`（384 行）
- 完整逐行检查：完成
- [P1] L180-188: handleDrop 未阻止把节点拖放到其自身后代上（L183 仅判断 `draggingId !== targetId`），配合上层两个页面的 handleReorderNodes 会把 parentId 指向后代/自身形成环，L52-74 buildTree 自引用导致 renderTreeNode（L190-265）无限递归 → 页面崩溃。建议在此处（或页面 handler）增加"目标是拖拽节点后代则拒绝"的检测，一处修复可同时覆盖 hybrid/system 两个页面。
- [P2] L43 与 L76-84: 接口声明了 `disableCloneQuote` 但组件实现未解构、未使用（hybrid 页传入该 prop 无效果），属死 prop。
- 复用候选：无（本组件已是 hybrid/system 两页的共享组件）

## `apps/edu/app/lesson/admin/system/add/_components/lesson-save-roundtrip.test.ts`（261 行）
- 完整逐行检查：完成
- [P2] L14: makeEvalRuleConfig 中 `methods as any` 强转，测试数据未使用正式类型（最佳实践: methods 类型化为 `EvalMethodKey[]`）。
- 复用候选：无

## `apps/edu/app/lesson/admin/system/add/_components/lesson-save-utils.ts`（187 行）
- 完整逐行检查：完成
- [P2] L137-139、L147: `draft?.learningGoal || node.teachingGoals`、`draft?.learningGoalPdf || node.descriptionPdf`、`draft?.background || node.background`、`draft?.hours ? parseFloat(...) : node.duration` 等用 `||` 回退，用户清空输入（空串/清空 PDF）保存后仍回退为节点旧值 → 编辑态字段"无法清空"（学习目标、节点说明、背景、课时等）。L141-146 estimatedHours 的注释声称"显式清空（''）生效"，但实现 `v === ''` 时 return node.estimatedHours（旧值），注释与代码矛盾（最佳实践: 对可清空字段用 nullish 合并 + 显式 undefined 判定）。
- [P2] L141-147: estimatedHours/duration 用 parseFloat 且无 NaN 兜底，用户输入非数字字符时 NaN 进入 payload（JSON 序列化为 null）静默入库。
- [P2] L30: NodeSavePayload.evalData 为 `Record<string, any>`，无字段约束。
- 复用候选：resolveResourceIds / buildNodeSavePayload 的"本地临时资源拆分 + ID 映射"逻辑与 hybrid/add/page.tsx saveNodes 内联实现（L748-787）重复 → 可抽公共序列化工具。

## `apps/edu/app/lesson/admin/system/add/_components/PublishCheckPanel.tsx`（214 行）
- 完整逐行检查：完成
- 未发现问题（L200 进度条 `completed/total`：hideEval+hideDetailedDescription 时 total 最小为 5，无除零路径）。
- 复用候选：无

## `apps/edu/app/lesson/admin/system/add/page.tsx`（1416 行）
- 完整逐行检查：完成
- [P1] L288-315: handleReorderNodes 无环检测（同 hybrid 版）：L297 `parentId: target.parentId` 在拖拽节点到自身后代时形成 parentId 环 → CourseNodeTree.buildTree 自引用 → 渲染无限递归崩溃（最佳实践: 增加"目标为拖拽节点后代则拒绝"判定）。
- [P2] L555: `courseApi.get(`${grain.id}?_t=${Date.now()}` as any)` 把缓存击穿查询串拼进课程 ID 传给 API，依赖 client 实现是否剥离 query，且 `as any` 绕过签名（最佳实践: 用 API 层支持的缓存参数）。
- [P2] L559: 克隆/引用颗粒课时 knowledgePoints 仅从本地 knowledgePool 过滤（L388 池加载 limit 200），若颗粒课知识点不在池内（池未加载完/超出 200 条）会被静默丢弃 → 克隆后节点知识点缺失（数据缺失）。
- [P2] L388: knowledgeApi.list({limit:200}) 知识点池截断，超出 200 的知识点无法被选择/回显。
- [P2] L1124-1125: `hover:${opt.border}` / `hover:${opt.bg}` 运行时拼接 Tailwind 类名，构建时无法静态提取对应 hover 变体类 → hover 边框/背景样式失效（最佳实践: 用静态映射表或 safelist）。
- [P2] L383、L1244: customKnowledgePointIdsRef 只写（add）从未读取，死代码。
- [P2] L233-234: 加载 effect 尾部空 `.finally(() => {})`，无意义。
- [P2] L735-739: 保存后按 `name` 匹配重映射选中节点，存在重名节点时可能选中错误节点（最佳实践: 保存后直接 setSelectedNodeId(realNodeId)，idMapping 已可用）。
- [P2] L763-765: 课程级 evalData 仅回写 descriptionPdf（本页未读取 learningGoal 等其它字段，风险低于 hybrid 版，但与 hybrid 页不一致）。
- [P2] L555、L564、L667: 多处 `as any` 类型绕过。
- 复用候选：handleReorderNodes（L288-315）与 hybrid/add/page.tsx L418-444 逐行近似重复；saveNodes 管道（L604-747）与 hybrid 版 L710-813 高度相似；能力点池加载（L134-163）与 hybrid 版重复 → 建议抽公共 hook/工具函数。

## `apps/edu/app/lesson/admin/system/page.tsx`（16 行）
- 完整逐行检查：完成
- 未发现问题（CourseAdminPage 薄封装）。
- 复用候选：无

## `apps/edu/app/lesson/admin/workflows/page.tsx`（9 行）
- 完整逐行检查：完成
- 未发现问题（WorkflowConfigPage 薄封装）。
- 复用候选：无

## `apps/edu/app/lesson/landing/[id]/learn/page.tsx`（374 行）
- 完整逐行检查：完成
- [P2] L180: nodeEvaluationResultApi.list 的 evaluateeId 传 `user?.id`，未登录/未取到用户时为 undefined；若后端对该接口不强制鉴权或不做 evaluateeId 过滤，存在读取该节点全部测评结果的风险（前端无法确认后端行为，需后端核实；若本页入口已强制登录则无影响）。
- [P2] L129、L146: courseNodeApi.list / hybridModuleApi.list 均 limit 1000，超大课程（>1000 节点/模块）会被截断。
- [P2] L168、L220、L243: `evalRuleConfigToMethods(config as any)`、`toEvalMethodView(m: any)`、`as unknown as KnowledgePoint` 多处类型宽松，缺正式类型。
- 复用候选：无

---

### 汇总
- P0: 0
- P1: 4（hybrid/add/page.tsx ×2、system/add/page.tsx ×1、CourseNodeTree.tsx ×1 —— 其中重排环为同一根因在 3 个文件中的体现）
- P2: 25
- 复用候选: 5（节点重排逻辑 ×2 页、saveNodes 保存管道 ×2 页、能力点池加载 ×2 页、资源/序列化工具与 hybrid 内联实现、临时 ID 生成未复用 uid()）


### report-055-056.md

# 代码审查报告 055-056（frontend）

> 依据 docs/code-review/REVIEW-GUIDE.md 执行；全部文件已完整逐行阅读（read 工具，无跳读/抽查），行号已用 read 逐文件核对。

## `apps/edu/app/lesson/landing/[id]/page.tsx`（879 行）
- 完整逐行检查：完成
- [P2] L180: 教师/管理员 live 预览路径用 `courseNodeApi.list({ courseId: id, limit: 1000 } as any)` 拉节点，并带 `as any` 绕过类型。若后端列表接口沿用 maxPageSize=200 上限（my-resources/page.tsx L120 注释确认存在该上限），节点数 >200 的课程在此路径会被静默截断，课程目录树/统计不完整。建议改用 `fetchAllPages` 或确认该端点上限。
- [P2] L188-195: `knowledgeApi.list({ limit: 1000 })` 无任何课程维度过滤，把全平台知识点一次性拉回前端再本地建 Map；当平台知识点总数 >1000 时，课程关联的知识点可能不在返回集合中，知识图谱/计数缺失。建议按课程或知识点 ID 过滤。
- [P2] L157-174 与 L176-196: live 预览路径的两个 useEffect 均无 `cancelled` 标志/竞态保护（快照路径 L130-154 有），组件卸载或课程 id 变化时，先发后至的过期响应仍会 setState，存在写入过期数据风险（与 L132 的 cancelled 模式不一致）。
- [P2] L686: 创建人展示 `(course.creatorId || '').slice(0, 8)` 直接透出原始 UUID 前 8 位，而课程 landing 列表页（lesson/landing/page.tsx L25）已有 `course.creatorName` 可用；建议展示 creatorName，避免暴露内部 ID 形态且语义统一。
- 复用候选: 无

## `apps/edu/app/lesson/landing/layout.tsx`（24 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/lesson/landing/page.tsx`（381 行）
- 完整逐行检查：完成
- [P2] L189-193: `useEffect` 内包一层无意义 async IIFE 仅做 `setCurrentPage(1)`，挂载即执行一次冗余 setState（当前值本就是 1）；应直接 `setCurrentPage(1)`。
- [P2] L326-335（配合 L350-376）: 分页（LandingPagination）仅作用于体系课，混合课/颗粒课全量渲染；课程量大时 DOM 节点与渲染开销大（无分页/懒加载/虚拟滚动）。
- [P2] L207: `executeSearch` 内 `setTimeout(..., 50)` 未保存句柄、组件卸载时未清理，卸载后仍可能触发 scrollIntoView（一次性短定时器，影响轻微）。
- 复用候选: 无

## `apps/edu/app/lesson/layout.tsx`（33 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/library/ability/page.tsx`（326 行）
- 完整逐行检查：完成
- [P2] L134-143: 双层 try/catch 冗余——内层 catch（L137-139）已捕获 `saveTags` 错误且不 rethrow，外层 catch（L140-142）为不可达死代码；两处 toast 提示完全重复。应只保留一层。
- 复用候选: 无（页面级 CRUD 样板见汇总）

## `apps/edu/app/library/certificates/page.tsx`（319 行）
- 完整逐行检查：完成
- [P2] L135-147: 编辑分支的 `saveTags`（L138）未包 try/catch，与新增分支（L142-146）不一致：标签保存失败时走外层 catch 提示"保存失败"，但实体实际已更新成功，错误信息误导用户，且中断后续 `setIsDialogOpen(false)/loadItems()`，对话框滞留、列表不刷新。建议与新增分支一致单独提示"标签保存失败"。
- 复用候选: 无（页面级 CRUD 样板见汇总）

## `apps/edu/app/library/_components/library-page-shell.tsx`（165 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/library/_components/use-library-crud.ts`（111 行）
- 完整逐行检查：完成
- 未发现问题（`loadSeqRef` 丢弃过期响应、`optionsRef` 防陈旧闭包、`filterKey` 驱动 effect 重载，设计合理）

## `apps/edu/app/library/knowledge/_components/granular-lesson-select-dialog.tsx`（160 行）
- 完整逐行检查：完成
- [P2] L43: `search` 状态在对话框关闭后不重置，重新打开时保留上次搜索词（父组件复用同一组件实例时），建议 onOpenChange(false) 时清空。
- 复用候选: 无

## `apps/edu/app/library/knowledge/_components/knowledge-point-form-dialog.tsx`（227 行）
- 完整逐行检查：完成
- [P1] L65-75: 表单初始化 effect 依赖 `initialValues`，而父组件（knowledge/page.tsx L302-312）每次渲染都内联新建该对象（编辑/克隆模式下引用不稳定）。父组件任一重渲染（典型触发：对话框内"新建颗粒课"后父组件 `setGranularCourses`/loadItems/loadGranularCourses，或标签绑定异步完成）都会重跑 effect 并把表单字段重置为 initialValues：用户正在输入的修改可能被清空；更具体地，编辑模式下新建颗粒课后，本地 `granularLessonIds` 刚追加的新课程 ID（L186-191）会被重置回旧列表，随后点"保存修改"会用旧列表覆盖，把刚关联的颗粒课在数据库中还原掉（L167-176 已落库的关联被静默撤销）。建议 effect 只依赖 `[open]`，打开时用初始值初始化一次，或在父组件用 `useMemo`/稳定化 initialValues。
- [P2] L44-46: `generateKpCode` 取 `Date.now()` 后 6 位作编码后缀，跨时段存在碰撞可能（如毫秒时间戳 123456789 与 223456789 同尾数），若后端 code 有唯一约束则创建偶发失败；建议追加随机段或自增序列。
- 复用候选: 无

## `apps/edu/app/library/knowledge/page.tsx`（319 行）
- 完整逐行检查：完成
- [P2] L167-176: 编辑模式下点击"新建颗粒课"会立即（不经保存按钮）把新颗粒课 ID 持久化关联到当前知识点（`knowledgeApi.update`），随后若用户取消对话框，该关联已落库而其他表单修改（名称/描述等）丢失——半持久化状态，用户感知不一致。建议仅在保存时统一提交关联，或在创建颗粒课后同步更新本地 `editingItem` 再让表单重新初始化。
- 复用候选: 无（页面级 CRUD 样板见汇总）

## `apps/edu/app/library/landing/layout.tsx`（23 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/library/landing/page.tsx`（437 行）
- 完整逐行检查：完成
- [P2] L189: `fetchAllPages` 把整个资源库全量拉回前端再做筛选/分页（逐页串行请求，页数=资源数/200）；公共 landing 页资源量大时首屏慢、请求数与内存占用高。可考虑按需加载/服务端筛选。
- [P2] L238: `now` 用 `useState(() => Date.now())` 冻结在挂载时刻，页面长驻时"近一周/近一月/近一年"时间筛选窗口随时间漂移失真。
- [P2] L314: `executeSearch` 内 `setTimeout(..., 50)` 未清理（一次性短定时器，影响轻微）。
- 复用候选: 无

## `apps/edu/app/library/layout.tsx`（36 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/library/my-resources/page.tsx`（456 行）
- 完整逐行检查：完成
- [P2] L120-171: 五个列表（知识点/能力点/证书/现场问答/各资源类型）均只拉单页 `limit: 200`，超出被静默截断（仅 banner 提示 + L120 TODO 注释），用户无法查看第 200 条之后的数据；建议改为服务端分页或"加载更多"。
- [P2] L173-191（配合 L97）: 各资源类型 tab 共享单一 `loadingResourceKind` 状态，快速切换资源类型 tab 时，先发请求完成后会把后发请求的 loading 指示提前清掉（UI 加载态闪烁/提前结束），纯展示问题。
- 复用候选: 无

## `apps/edu/app/library/questions/page.tsx`（310 行）
- 完整逐行检查：完成
- [P2] L73-76: `majorNameMap` 在每次渲染时重建（O(majors) 遍历），建议 `useMemo`。
- [P2] L80: `majorApi.list({ limit: 1000 })` 专业数超 1000 时被截断（低概率，仅提示）。
- [P2] L172: 统计卡 `statCount={items.length}` 显示当前页条数而非总数（该页未解构 `total`），与 ability/certificates/knowledge 页用 `total` 不一致，翻页后统计数错误。
- 复用候选: 无（页面级 CRUD 样板见汇总）

## `apps/edu/app/library/resources/_components/resource-batch-import-dialog.tsx`（318 行）
- 完整逐行检查：完成
- [P2] L240-250（配合 L94-98、L152-175）: 上传进行中文件选择 input 仍可触发 onChange 追加文件（仅拖拽区 onClick 有 `!uploading` 守卫），上传完成后 `reset()` 会把用户上传中途新选的文件一并清空（选择丢失的边缘用例）；建议 uploading 期间禁用 input 或忽略追加。
- [P2] L106-176: 文件逐个串行上传（await 循环），批量文件多时总耗时线性增长；非核心流程，可接受，可考虑小并发（3-5）提升体验，仅提示。
- 复用候选: 无

## 汇总
- P0: 0 ｜ P1: 1（knowledge-point-form-dialog.tsx L65-75 表单被不稳定 initialValues 重置，可致已关联颗粒课在保存时被还原）
- P2: 22
- 复用候选: 2
  1. library CRUD 管理页样板（ability/certificates/knowledge/questions 4 页）：`handleSubmit` 实体保存 + `saveTags` 失败提示（"实体已保存，标签未关联"）、`confirmDelete`、TagFilterBar + `useLibraryCrud` + `loadBindings` 接线高度重复（ability L90-149 / certificates L111-153 / knowledge L100-148 / questions L114-160），且 certificates 页编辑分支漏包 saveTags（见上）正是复制粘贴不一致的体现；可抽 `useLibraryEditor`（统一 saveTags 包裹与提示文案）进一步收敛。
  2. 资源类型 → 图标/emoji 映射分散 3 处：lib/resource-type-constants 的 `LIBRARY_LANDING_TYPE_ICONS`、my-resources/page.tsx 的 `RESOURCE_ICONS`（L53-65）、library/landing/page.tsx 的 `TYPE_EMOJI`（L29-41）；建议在 lib 中统一 type → Icon 常量供三处引用。

### report-057-058.md

# 代码审查报告 057-058（前端批次）

审查依据：《代码审查指南》REVIEW-GUIDE.md。逐文件完整逐行阅读，行号均经 read 工具核对。
审查范围：
- 057-frontend.json（9 个文件，2197 行）
- 058-frontend.json（3 个文件，2731 行）

---

## `apps/edu/app/library/resources/_components/resources-page.tsx`（614 行）
- 完整逐行检查：完成
- [P2] L489-491: 总览视图下编辑已有资源时，弹窗描述仍显示「补充本地资源，上传后将加入资源公共库」（新增语义），与编辑语义不符，误导用户；编辑态应改为「编辑资源」类文案（如 `editingItem ? t('编辑资源信息') : ...`）。
- 未发现 P0/P1 问题。

## `apps/edu/app/library/resources/_components/resource-upload-zone.tsx`（107 行）
- 完整逐行检查：完成
- 未发现问题。选中文件后重置 input value（L60）保证可重复选择同一文件，拖拽/键盘操作均正确。

## `apps/edu/app/library/resources/_components/use-resource-crud.ts`（255 行）
- 完整逐行检查：完成
- [P2] L14/L246: `resFileInputRef` 创建后被放入返回值，但调用方 resources-page.tsx 未解构使用，为无用代码（死代码），建议删除。
- [P2] L38-71: `loadItems` 无竞态防护（无 AbortController/请求序号）。搜索/类型/标签筛选快速连续变化时，若旧请求后返回会以过期数据覆盖新结果（列表显示与当前筛选不一致）；建议用递增序号或取消上一次请求（`loadItems` 调用处亦为 L119/L209 的保存后刷新，均共用此函数）。
- 未发现 P0/P1 问题。

## `apps/edu/app/library/resources/[type]/page.tsx`（11 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/app/library/tags/page.tsx`（202 行）
- 完整逐行检查：完成
- 未发现问题。客户端过滤、增删改流程、删除确认均正确。

## `apps/edu/app/not-found.tsx`（18 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/app/partner/co-build/positions/[id]/edit/page.tsx`（422 行）
- 完整逐行检查：完成
- 未发现问题。详情加载有 cancelled 防护；未加载完子表禁止保存（saveDisabled），避免空草稿覆盖已保存数据；未保存草稿返回时删除（L298-304）行为合理。

## `apps/edu/app/partner/co-build/positions/page.tsx`（190 行）
- 完整逐行检查：完成
- 未发现问题。删除按钮仅对 enterprise 来源且 draft/rejected 状态展示（L173），符合"发布由学校端进行"的权限约定。
- 复用候选: 与 scenes/page.tsx 几乎完全同构（学校筛选 + 创建弹窗 + 列表 + 行操作），见该文件条目。

## `apps/edu/app/partner/co-build/scenes/[id]/edit/page.tsx`（369 行）
- 完整逐行检查：完成
- 未发现问题。行业/专业字段只读展示且保存时不携带（后端保留原值）符合 partner 数据源缺失的约束；目标岗位下拉仅列本企业共建岗位（L78-80）。

## `apps/edu/app/partner/co-build/scenes/[id]/edit/tasks/page.tsx`（2184 行）
- 完整逐行检查：完成
- [P2] L3-13: 文件头裁剪注释与实际实现不符——注释称"删除 knowledge/ability/resources/weight 卡片（含 WeightConfigDialog/persistWeights）、删除克隆/引用（my/collab/public 三 tab）"，但实际 `PARTNER_CARD_TYPES`（L104-113）保留了全部 8 种卡片，克隆/引用三 tab 对话框（L1339-1450）与 WeightConfigDialog（L1993+）均存在；注释会误导后续"共通 bug 双向检查"，建议更新为与实际一致的裁剪清单。
- [P2] L452-455: `taskStatesRef` 仅写入从未读取（同步 effect 之外无任何消费点），为死代码，建议删除。
- [P2] L517-521: 首屏对每个任务单独发起 `listEvaluationMethods` 请求（N 个任务 = N 次 HTTP），任务链较长时请求数随任务数线性增长；建议后端提供按场景批量拉取评价方式的接口，或前端合并为一次批量请求。
- [P2] L2026-2036: `distributeGlobal`（一键平均分配）对已锁定权重未做钳制：当锁定任务的权重合计 > 100 时（如两个任务各锁定 60%），`remaining` 为负，未锁定任务会被分配负权重（如 -10），且总权重可能恰好等于 100 从而允许保存负权重到后端；建议 `Math.max(0, ...)` 钳制或锁定合计超过 100 时提示。
- 未发现 P0/P1 问题。
- 复用候选: 整页为 portal 版场景任务链编辑页（apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx）的复制改造版（见 L3-13 注释），体量约 2000 行；仅部分纯函数/卡片组件做了 import 复用，其余（useCoBuildDatasets、主页面、对话框）为复制后裁剪，存在"共通 bug 修复需双向检查"的维护负担，建议评估将差异参数化后统一为共享组件。

## `apps/edu/app/partner/co-build/scenes/page.tsx`（189 行）
- 完整逐行检查：完成
- 未发现问题。与 positions/page.tsx 逻辑一致（删除仅限 enterprise + draft/rejected，L172）。
- 复用候选: 与 apps/edu/app/partner/co-build/positions/page.tsx 几乎逐行同构（仅 API/标题/实体名词不同），两文件约 190 行重复；建议抽象一个参数化的合作共建列表页组件（入参：list/create/delete API、标题、实体名、跳转路径），两处共用。

## `apps/edu/app/partner/cooperation/page.tsx`（355 行）
- 完整逐行检查：完成
- [P2] L195-214: `openDetail` 无竞态防护：快速点击不同行时，先发起的慢请求可能后返回并覆盖 `detailData`，导致弹窗标题（`detail.name`）与内容（`detailData`）属于不同条目；建议记录请求序号或请求发起时的 kind/id 比对，不一致则丢弃。
- 未发现 P0/P1 问题。

---

## 汇总
- 057: P0=0, P1=0, P2=3
- 058: P0=0, P1=0, P2=5
- 复用候选: 2


### report-059-060.md

# 代码审查报告 059-060（frontend 批次）

> 审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、优先级原则、严重级别、报告模板）。
> 本批次全部为前端页面（apps/edu），无后端 handler/service/store 红线问题。

## `apps/edu/app/partner/enterprise/page.tsx`（596 行）
- 完整逐行检查：完成
- [P2] L175-176: 注释声称"当前表单实时数据 → 展示页 props（未保存也能预览）"，但 L581-582 预览 Dialog 实际传入 `toPreview(item)`（已保存数据），而非表单实时状态 `form`；编辑未保存时点预览看到的是旧数据，与注释意图不符（最佳实践: 预览传入 `form`，或修正注释）。
- 复用候选: 本文件 L102-117 本地 `PhotoGrid` 与 `components/alliance/enterprise-detail-view.tsx` L66 导出的共享 `PhotoGrid` 功能重复（仅样式微差），可删除本地定义直接复用共享组件。

## `apps/edu/app/partner/experts/_components/expert-form.tsx`（292 行）
- 完整逐行检查：完成
- 未发现问题（表单受控组件，specialty 输入/删除逻辑正确，无定时器/监听器泄漏）。

## `apps/edu/app/partner/experts/[id]/edit/page.tsx`（122 行）
- 完整逐行检查：完成
- [P2] L42-61: 专家实体 → 表单状态映射与 `experts/page.tsx` L37-56（MyExpertProfile）完全重复，仅 2 处未达复用候选阈值，建议后续抽为共享工具函数（最佳实践: 提取 `toExpertForm(expert)`）。
- 其余未发现问题（非 admin 重定向、加载态、保存错误处理均正确）。

## `apps/edu/app/partner/experts/[id]/page.tsx`（169 行）
- 完整逐行检查：完成
- 未发现问题（notFound 分支、编辑入口仅 admin 可见、加载态处理正确）。

## `apps/edu/app/partner/experts/new/page.tsx`（116 行）
- 完整逐行检查：完成
- 未发现问题（用户名/密码必填校验在提交前；创建成功 toast 展示初始密码为管理员自行输入内容的回显转交，属既有产品模式，不报）。

## `apps/edu/app/partner/experts/page.tsx`（212 行）
- 完整逐行检查：完成
- 未发现问题（member 仅见"我的档案"，admin 见列表；删除经 PortalCrudPage 确认流程）。

## `apps/edu/app/partner/layout.tsx`（103 行）
- 完整逐行检查：完成
- 未发现问题（认证守卫先渲染再重定向属文件内注释声明的有意设计，避免 SSR 404；数据接口鉴权在服务端，无越权风险）。

## `apps/edu/app/partner/login/page.tsx`（446 行）
- 完整逐行检查：完成
- 未发现问题（验证码消费/过期刷新、多企业选择流程、加载态恢复路径均正确；密码字段 autoComplete 配置合理）。

## `apps/edu/app/partner/page.tsx`（5 行）
- 完整逐行检查：完成
- 未发现问题（纯重定向到 /partner/workspace）。

## `apps/edu/app/partner/schools/page.tsx`（172 行）
- 完整逐行检查：完成
- 未发现问题（状态流转按钮按 negotiating/active/paused/terminated 正确分支；terminate 走 ConfirmDialog；`enterpriseStatus` 标签键已核对 shared-types 一致）。

## `apps/edu/app/partner/settings/page.tsx`（91 行）
- 完整逐行检查：完成
- 未发现问题（改密成功登出、失败恢复按钮态，逻辑正确）。

## `apps/edu/app/partner/tasks/page.tsx`（86 行）
- 完整逐行检查：完成
- 未发现问题（评分进度三态渲染正确，无操作按钮，纯展示）。

## `apps/edu/app/partner/workspace/page.tsx`（512 行）
- 完整逐行检查：完成
- [P2] L386-388: `{resourceTotal === 0 && …}` 为死代码——外层 L336 三元已保证仅 `resourceTotal > 0` 时才渲染该分支（最佳实践: 删除该冗余判断）。

## `apps/edu/app/portal/alliance/achievements/[id]/page.tsx`（376 行）
- 完整逐行检查：完成
- [P1] L107-108: 关联企业/项目列表以单次请求（仅带 tenantId）拉取，未分页全量；本仓库 `achievements/page.tsx` L31 与 `enterprises/page.tsx` L31 注释已确认 public 接口默认 100 条截断，学校链接对象超 100 条时关联企业/归属项目会被静默漏掉，详情页关联信息不完整（最佳实践: 改用 `fetchAllPages` 全量拉取，与列表页一致）。
- [P2] L117-124: 网络/接口失败与"成果不存在"混淆——catch 仅 `reportError`，achievement 保持 null 后展示"成果不存在"空态，用户误以为数据被删除（最佳实践: 区分请求失败态与 notFound 态，失败时展示可重试的错误提示）。
- 复用候选: attachments/scenes/courses/positions 四个 tab（L268-372）均为"卡片网格 + 空态 EmptyState"同构结构，重复 4 次，可抽象为通用 `RelatedGridTab` 组件。

## `apps/edu/app/portal/alliance/achievements/page.tsx`（97 行）
- 完整逐行检查：完成
- 未发现问题（fetchAllPages 全量分页、类型/关键字筛选 useMemo 正确）。

## `apps/edu/app/portal/alliance/brands/[id]/page.tsx`（1120 行）
- 完整逐行检查：完成
- [P1] L92-115: 品牌详情依赖的关联列表（job 品牌 L93-95、major 分支的雇主品牌/岗位品牌/成果/企业 L100-114）均为单次请求未分页，同样受 public 接口 100 条截断影响，关联对象超量时专业品牌关联卡、岗位跳转映射（L393-397 `jobBrandByPosition`）会静默缺失（最佳实践: 与列表页一致改用 `fetchAllPages`）。
- [P2] L1120: 单文件巨型组件——job/teacher/employer/major 四种完全不同的详情布局堆在同一 1120 行组件内，多个 useMemo 与三段早退渲染分支，可读性与可维护性差（最佳实践: 按 brandType 拆分为独立组件/文件）。
- 复用候选: L244-261（就业方向）、L293-310（合作企业）、L339-356（合作成果）三处"置灰占位卡片" JSX 结构完全一致，可抽象为 `PrivatePlaceholderCard`（名称/图标/提示文案参数化）。

## `apps/edu/app/portal/alliance/brands/page.tsx`（154 行）
- 完整逐行检查：完成
- [P2] L131-143: `isRowLayout ? (<div className={gridClassName}>…) : (<div className={gridClassName}>…)` 两个分支渲染完全相同的 JSX，三元冗余（最佳实践: 直接渲染一份，删掉 isRowLayout 分支判断）。

## `apps/edu/app/portal/alliance/enterprises/[id]/page.tsx`（113 行）
- 完整逐行检查：完成
- [P1] L64-69: 专家/项目/成果/协议列表均为单次请求未分页，与 achievements 详情同样存在 100 条截断导致关联内容（L73-93 过滤）静默缺失的风险（最佳实践: 改用 `fetchAllPages` 全量拉取）。
- [P2] L95-102: 请求失败与"企业不存在"混淆，失败时展示"企业不存在"误导用户（最佳实践: 区分失败态与 notFound 态）。

## `apps/edu/app/portal/alliance/enterprises/page.tsx`（100 行）
- 完整逐行检查：完成
- 未发现问题（fetchAllPages 全量分页、评级/关键字筛选 useMemo 正确）。


### report-061-062.md

# 代码审查报告 061-062（前端批次）

> 依据 docs/code-review/REVIEW-GUIDE.md 原则执行；仅审查批次清单内文件，未修改任何源代码。
> 行号均以 read 工具核对。后端行为核对：公开列表接口默认 limit=100（handler publicListParams），
> 品牌 PUT 走 crudUpdate + ValidateUpdateExisting 局部合并，协议-项目关联走 syncAgreementProjectLinks 顺序同步。

## `apps/edu/app/portal/alliance/experts/[id]/page.tsx`（234 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/portal/alliance/experts/page.tsx`（101 行）
- 完整逐行检查：完成
- 未发现问题（fetchAllPages 分页全量拉取，offset=page*pageSize 与 fetch-all.ts 的 0 基 page 语义一致）

## `apps/edu/app/portal/alliance/landing/page.tsx`（839 行）
- 完整逐行检查：完成
- 未发现问题（各请求均带 catch 兜底，Promise.all 不会整体 reject；列表只取前 6/8 条展示属有意截断）

## `apps/edu/app/portal/alliance/layout.tsx`（28 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/portal/alliance/projects/[id]/page.tsx`（408 行）
- 完整逐行检查：完成
- [P2] L56-59: 企业/协议/成果三个公开列表请求未携带 limit，后端 publicListParams 默认 limit=100 会静默截断；当本校链接企业/协议/成果超过 100 条时，"合作主体 / 项目协议 / 关联成果"的关联数据会缺失（同仓已有 fetchAllPages 约定"分页全量拉取避免截断"，本页未遵循）。最佳实践: 改用 fetchAllPages 拉全量后再按 id 过滤，或直接按 projectId 过滤的专用接口

## `apps/edu/app/portal/alliance/projects/page.tsx`（97 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/portal/apps/ai/chat/page.tsx`（128 行）
- 完整逐行检查：完成
- 未发现问题（412 错误经 portalRequest 映射为 Error.message='ai_not_configured'，L35 判断可命中；sending 状态防重复发送）

## `apps/edu/app/portal/apps/alliance/achievements/[id]/edit/page.tsx`（242 行）
- 完整逐行检查：完成
- [P2] L88-93: 连续 6 处 `(item as any)` 取 enterpriseIds/projectIds/secondaryColleges/attachments/ownerPersons/coBuilders，类型断言掩盖了 AllianceAchievement 类型缺口，后续字段改名无编译期保护；建议补齐类型定义
- [P2] L48-49: 企业/项目下拉数据 list({ limit: 200 }) 硬编码上限，超过 200 条时下拉选项静默缺失，无法选中/保留超限企业（已终止企业另被过滤，当前已关联企业可能不在选项中）；建议复用全量拉取工具或后端分页搜索

## `apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx`（423 行）
- 完整逐行检查：完成
- [P2] L79/L113-140: 搜索防抖 timer（searchTimer）在组件卸载/关闭弹窗时未清理，且 runSearch 无过期响应丢弃——快速输入时先发请求晚返回会覆盖后发请求的结果（异步竞态，结果与当前关键字不符）。最佳实践: 卸载时 clearTimeout，并用请求序号/AbortController 丢弃过期响应

## `apps/edu/app/portal/apps/alliance/achievements/new/page.tsx`（225 行）
- 完整逐行检查：完成
- [P2] L56-57: 企业/项目下拉 list({ limit: 200 }) 截断隐患（同 achievements/[id]/edit L48-49）

## `apps/edu/app/portal/apps/alliance/achievements/page.tsx`（222 行）
- 完整逐行检查：完成
- [P2] L39-40: 企业/项目全量列表 limit=200 截断；超过 200 条时列表页"合作企业"列会退化为展示原始 id（名称解析不到），且排序在前 200 之外的项目在"关联项目"列无法显示名称；建议与 usePagedList 一致改用服务端分页或全量拉取

## `apps/edu/app/portal/apps/alliance/agreements/[id]/edit/page.tsx`（252 行）
- 完整逐行检查：完成
- [P1] L42-53/L55-85: item 初始化为全默认值，加载失败时仅 catch 弹 toast、finally 置 loading=false，随后直接渲染"空白表单"；用户此时填写并保存，PUT 会以默认值（type=strategic/status=draft、enterpriseIds/projectIds/attachments 清空、isPublic=false）整条覆盖真实协议，造成数据丢失。同目录 achievements/[id]/edit 有 `if (!item) return <EmptyState>` 防护，此处缺失。建议: 加载失败时置 item 为 null 并渲染 EmptyState/重试，禁止以默认值进入可保存状态
- [P2] L96-98: update 成功后 syncAgreementProjectLinks 失败会整体提示"保存失败"，但协议实际已更新，误导用户重试造成重复提交/重复同步；且 sync 内部按项目顺序 GET+PUT（每项目 2 个请求），中途失败会留下部分项目已同步、协议未同步的不一致状态。建议: 区分"已保存但关联同步失败"的提示，或由后端提供原子批量接口
- [P2] L59-60: 企业/项目下拉 limit=200 截断隐患（同前）

## `apps/edu/app/portal/apps/alliance/agreements/[id]/page.tsx`（190 行）
- 完整逐行检查：完成
- [P2] L28-29: 企业/项目全量列表 limit=200 截断；超过 200 条时关联对象名称解析失败，退化为展示原始 id 字符串

## `apps/edu/app/portal/apps/alliance/agreements/new/page.tsx`（256 行）
- 完整逐行检查：完成
- [P2] L96-99: `if (!item.name)` 为死代码——L84 已做 `!item.name.trim()` 校验且通过即返回，L96 永不触发；建议删除
- [P2] L102-104: create 成功后 syncAgreementProjectLinks 失败提示"保存失败"，但协议实际已创建；用户重试会重复创建协议（重复插入）。建议: 捕获同步失败单独提示（"已创建但关联同步失败"），或失败后引导到编辑页重试同步
- [P2] L58-59: 企业/项目下拉 limit=200 截断隐患（同前）

## `apps/edu/app/portal/apps/alliance/agreements/page.tsx`（260 行）
- 完整逐行检查：完成
- [P2] L41-42: 企业/项目全量列表 limit=200 截断（同 achievements/page L39-40，名称解析退化展示原始 id）

## `apps/edu/app/portal/apps/alliance/brands/culture/page.tsx`（189 行）
- 完整逐行检查：完成
- 未发现问题（toggleBrandField 局部更新 `{ [field]: value }` 与后端 ValidateUpdateExisting 部分合并语义匹配，不会清空其他字段；本页用 usePagedList 服务端分页）
- 复用候选: 与 employer/job 品牌页重复的 toggleBrandField 与 PortalCrudPage 品牌列表骨架（见 brands/employer/page.tsx 复用候选）

## `apps/edu/app/portal/apps/alliance/brands/employer/page.tsx`（382 行）
- 完整逐行检查：完成
- [P2] L53-60/L70-77: 品牌列表与可引用企业均用 useAsync 拉 limit=200 且无分页/无搜索请求——超过 200 条时列表静默截断、引用弹窗缺企业；而同为品牌页的 culture 用 usePagedList 服务端分页，风格不一致。建议: 统一为 usePagedList 或全量拉取
- 复用候选: toggleBrandField（L173-181）与 culture（L40-48）、job（L46-54）页完全重复 3 处，可上提为通用 useBrandToggle 或并入泛化 BrandCrudPage

## `apps/edu/app/portal/apps/alliance/brands/[id]/page.tsx`（165 行）
- 完整逐行检查：完成
- 未发现问题（employer/major 分支渲染独立详情组件，其余类型走通用信息页，加载期有 loading 兜底）

## `apps/edu/app/portal/apps/alliance/brands/job/page.tsx`（195 行）
- 完整逐行检查：完成
- [P2] L35-42: 品牌列表 useAsync limit=200 无分页截断隐患（同 employer L53-60；culture 页用 usePagedList，风格不一致）
- 复用候选: 同 employer（toggleBrandField 3 处重复）

## `apps/edu/app/portal/apps/alliance/brands/major/page.tsx`（166 行）
- 完整逐行检查：完成
- 未发现问题（/majors?limit=500 对一般学校规模足够；togglePublic 创建/更新逻辑与后端部分合并语义匹配）

---

## 复用候选汇总（3 项）
1. 企业/项目下拉选项加载 + 终止企业过滤逻辑：achievements/new(L56-57)、achievements/[id]/edit(L48-49)、achievements/page(L39-40)、agreements/new(L58-59)、agreements/[id]/edit(L59-60)、agreements/page(L41-42)、agreements/[id]/page(L28-29)、brands/employer 引用弹窗(L70-77) 共 ≥7 处重复 → 可抽象 `useAllianceLinkOptions(tenantId)` hook（含 limit 与终止过滤、统一分页策略）
2. 品牌管理页 toggleBrandField + PortalCrudPage 骨架：culture/employer/job 3 处高度重复 → 可泛化 BrandCrudPage（差异仅列定义与弹窗内容）
3. achievements/agreements 的 new 与 [id]/edit 四个表单页：FormPageShell + sidebar ComboboxSelect 多选卡片 + FormFieldGrid 结构几乎一致 → 可抽象 `AllianceEntityFormPage` / `AllianceFormSidebar` 组件


### report-063-064.md

# 代码审查报告 063-064（frontend：联盟管理模块）

- 审查指南：docs/code-review/REVIEW-GUIDE.md
- 审查方式：逐文件完整逐行阅读（read 工具，无跳读/抽查），行号均经 read 核对
- 批次：063-frontend.json（5 文件，2080 行）、064-frontend.json（7 文件，2518 行）

---

## `apps/edu/app/portal/apps/alliance/brands/page.tsx`（120 行）
- 完整逐行检查：完成
- 未发现问题。品牌计数按 brandType 前端聚合，pageMap 六类路由齐全，加载失败经 reportError 处理，无竞态/泄漏（单次 effect）。

## `apps/edu/app/portal/apps/alliance/brands/talent/page.tsx`（214 行）
- 完整逐行检查：完成
- 未发现问题。toggle/保存/删除均 try-catch 并刷新列表，开关更新失败有错误 toast，导入 extraQuery 传 brandType 正确。

## `apps/edu/app/portal/apps/alliance/brands/teacher/page.tsx`（667 行）
- 完整逐行检查：完成
- [P2] L48: 品牌列表 `allianceBrandApi.list({ brandType, limit: 200 })` 无分页上限 200，超过 200 条时其余品牌不可见且两个 Tab 计数不完整（最佳实践: 改用 usePagedList 或 fetchAllPages）。
- [P2] L75: `allianceExpertApi.delete(expertId).catch(() => null)` 吞掉专家档案删除失败；若删除失败而品牌仍被删除，brand.data.teacherExpertId 悬挂成为孤儿档案（最佳实践: 删除失败时提示并中止品牌删除，或删除成功后一并清理引用）。
- [P2] L395-426: saveProfile 先 create 专家再 update 品牌回写 teacherExpertId，两步非原子；若第二步失败会遗留无品牌引用的孤儿专家（最佳实践: 失败时回滚或提示）。
- [P2] L437: `pickerTitle.replace('关联', '')` 依赖中文原文做字符串裁剪推导按钮文案，i18n 其他语言下语义易错（最佳实践: 单独维护按钮文案）。
- 复用候选: 见文末第 1 条（limit 200 引用数据拉取）。

## `apps/edu/app/portal/apps/alliance/dictionaries/page.tsx`（305 行）
- 完整逐行检查：完成
- 未发现问题。字典列表数据量小，全量拉取可接受；增删改均有错误 toast 与刷新，表单必填由 disabled 兜底。

## `apps/edu/app/portal/apps/alliance/enterprises/[id]/page.tsx`（769 行）
- 完整逐行检查：完成
- [P1] L60-64: 每次加载用 `fetchAllPages` 拉取全租户协议/项目/成果全量列表（3 条无界分页全扫），数据量大时请求数随数据量线性增长、详情页加载明显变慢；且与 projects/[id] 页的 limit:200 截断做法不一致（最佳实践: 后端提供按 enterpriseIds 过滤/关联查询端点，前端按企业过滤）。
- [P2] L106: 关联协议时 `[...(agreement.enterpriseIds || []), id]` 未去重，依赖 availableForLink 过滤兜底；若并发/重复点击可能出现重复 id（普通业务，影响小）。
- 复用候选: 见文末第 2/3 条（关联弹窗与详情页骨架）。

## `apps/edu/app/portal/apps/alliance/enterprises/page.tsx`（649 行）
- 完整逐行检查：完成
- [P2] L62-77: 引用数据（协议/项目/成果）`limit: 200` 截断，超过 200 条时表格"合作协议/合作项目/合作成果"计数不准确（注释称"引用数据全量"但实际有上限）。
- [P2] L212-220: 已引入企业全集 `limit: 200`，超过 200 家时 linkedIds 不完整，引入弹窗中已引入企业可能仍显示"引入"按钮（可重复引入）。
- 复用候选: 见文末第 1 条。

## `apps/edu/app/portal/apps/alliance/experts/[id]/page.tsx`（218 行）
- 完整逐行检查：完成
- [P2] L26: `allianceEnterpriseApi.list({ limit: 200 })` 取前 200 家企业查找所属企业，超出时"所属机构/关联企业"缺失显示（最佳实践: 提供按 id 获取或企业详情接口）。
- 复用候选: 见文末第 1 条。

## `apps/edu/app/portal/apps/alliance/experts/page.tsx`（146 行）
- 完整逐行检查：完成
- [P2] L36: 企业筛选下拉仅前 200 家，超出无法按企业筛选专家（最佳实践: 支持服务端搜索的 Combobox）。
- 说明: L139-143 onToggleEnabled 未本地刷新，但 PortalCrudPage.handleToggleEnabled 成功后会调用 onRetry()（=list.refresh），无状态过期问题，不报。
- 复用候选: 见文末第 1 条。

## `apps/edu/app/portal/apps/alliance/layout.tsx`（57 行）
- 完整逐行检查：完成
- 未发现问题。权限门禁（hasMenuPermission）与 loading 态处理正确，导航配置翻译 useMemo 依赖 [t] 正确。

## `apps/edu/app/portal/apps/alliance/permissions/page.tsx`（490 行）
- 完整逐行检查：完成
- [P2] L68: 可授权企业列表 `limit: 200` 截断，超过 200 家时其余企业无法选择授权（最佳实践: 企业选择改为服务端搜索下拉）。
- 说明: checked 覆盖 granted 的合并逻辑（L109）正确；切换企业/保存后均清理 checked；保存按类型整组生效与文案一致，不报。
- 复用候选: 见文末第 1 条。

## `apps/edu/app/portal/apps/alliance/projects/[id]/edit/page.tsx`（223 行）
- 完整逐行检查：完成
- [P2] L44: 企业下拉 `limit: 200` 截断，超出 200 家时部分合作企业无法选择（最佳实践: 支持服务端搜索的 ComboboxSelect）。
- 说明: L142 未选类型时默认取字典首项，属正常默认值行为，不报。
- 复用候选: 见文末第 1 条。

## `apps/edu/app/portal/apps/alliance/projects/[id]/page.tsx`（728 行）
- 完整逐行检查：完成
- [P2] L74-75: 协议/成果 `limit: 200` 截断，超过 200 条时"项目协议/关联成果"列表与关联弹窗数据不完整（与 enterprises/[id] 用 fetchAllPages 不一致）。
- [P2] L216: `new Date().toISOString().slice(0, 10)` 取 UTC 日期作为完成日期，UTC+8 时区凌晨 0-8 点会被记为前一天（最佳实践: 用本地日期格式化）。
- [P2] L641: 关联协议弹窗未过滤已关联协议（enterprises/[id] 用 availableForLink 过滤），已关联协议仍可勾选，重复关联靠 Set 去重兜底（无数据危害但交互不一致）。
- 复用候选: 见文末第 2/3 条。

---

## 复用候选汇总（3 项）

1. **"limit:200 全量引用数据拉取"模式**：出现在 brands/teacher/page.tsx L48、enterprises/page.tsx L62-77/L212-220、experts/page.tsx L36、experts/[id]/page.tsx L26、projects/[id]/edit/page.tsx L44、projects/[id]/page.tsx L74-75、permissions/page.tsx L68 共 7+ 处。可抽象统一 hook（如 `useAllianceRefs` / `useAllianceEnterpriseOptions`），统一分页/截断与去重逻辑，避免各页 200 上限不一致。
2. **"关联已有 X"复选弹窗**（Dialog + Checkbox 列表 + EmptyState + FormDialogFooter + 循环保存/取消关联）：enterprises/[id] 3 个（协议/项目/成果）、projects/[id] 2 个（协议/成果）、enterprises/page 引入企业弹窗 1 个，共 6+ 处重复。可抽象 `LinkExistingDialog` 组件（props: 候选列表、已选、onConfirm、loading）。
3. **详情页"加载全量引用 + 关联/取消关联 + 刷新"骨架**：enterprises/[id]/page.tsx 与 projects/[id]/page.tsx 结构高度相似（AllianceDetailShell + link/unlink handler 模式），可进一步抽象通用关联管理 hook/组件。


### report-065-066.md

# 代码审查报告 065-066（frontend 批次）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、按严重级别与模板报告；已排除指南列出的目录）。
批次来源：/tmp/batches/065-frontend.json、/tmp/batches/066-frontend.json，共 14 个文件，全部完整逐行阅读。

---

## `apps/edu/app/portal/apps/alliance/projects/new/page.tsx`（235 行）
- 完整逐行检查：完成
- 未发现问题。表单校验（名称非空）、保存/失败 toast、创建成功后跳转详情页、企业下拉过滤已终止合作企业等逻辑均正常；DateInput/Select/SingleImageUpload 用法正确，无状态残留或竞态。

## `apps/edu/app/portal/apps/alliance/projects/page.tsx`（255 行）
- 完整逐行检查：完成
- [P2] L59-76: 里程碑数据存在重复拉取：useAsync 的 deps `[list.items, tenantId]` 在 list.items 变化时自动触发一次拉取，随后 L74-76 的 useEffect 又调用 `refreshMilestones()` 再拉一次；每次翻页/搜索/首载都会对每页 N 个项目重复调用 2 次 listMilestones（共 2×N 个请求）。（最佳实践: 去掉 useAsync 的 deps 自动加载改为 autoLoad:false 仅由 useEffect 驱动，或删除冗余的 useEffect。）
- 其余（企业全量映射、Switch 前台展示开关、onSave/onDelete/onToggleEnabled 均依赖 PortalCrudPage 统一错误处理与刷新）未见问题。

## `apps/edu/app/portal/apps/alliance/school/page.tsx`（559 行）
- 完整逐行检查：完成
- [P2] L170-184, L273: 首屏 fetchTenant 失败时错误只写入 state，主页面（L273 `{tenant && ...}`）在 tenant 为空时只渲染页头、不展示任何错误提示或重试入口，用户看到"空白页"而不知道加载失败。（最佳实践: 主视图增加 error 状态展示与"重试"按钮，或在 !tenant && error 时渲染 ErrorState。）
- 其余（loadTenantToForm 回填防覆盖逻辑、website 自动补 https、省份/城市联动、二级学院多选、编辑对话框错误展示）均正常。

## `apps/edu/app/portal/apps/page.tsx`（392 行）
- 完整逐行检查：完成
- 未发现问题。localStorage 计数 SSR 安全（首屏空计数 + setTimeout 加载）、scroll 监听有清理、权限过滤/常用服务排序/移动端芯片导航逻辑正确。

## `apps/edu/app/portal/apps/system/layout.tsx`（180 行）
- 完整逐行检查：完成
- 未发现问题。render 期守卫式收起抽屉（条件 setState，符合 React 派生状态模式）、权限门禁（loading/permitted）、菜单展开状态、移动端 Sheet 均正确；无监听器泄漏。

## `apps/edu/app/portal/apps/system/logs/login/page.tsx`（182 行）
- 完整逐行检查：完成
- [P2] L38-43: 搜索时全量拉取 limit=10000 条登录日志到前端过滤后分页，日志量大时每次搜索（防抖 300ms）都拉 1 万条，网络/内存开销大。（最佳实践: 后端登录日志接口支持 free-text 搜索参数（userName/ip），或前端按日期分段分页过滤。）
- [P2] L54-59: loadLogs 异步响应无请求序号守卫（对比 useAsync 有 seqRef）：快速翻页/连续输入时，旧请求晚返回会覆盖新请求的结果并提前 setLoading(false)，展示过期数据。（最佳实践: 用 useAsync 或自增序号丢弃过期响应。）
- 其余（翻页越界守卫、状态徽标、设备描述、批量导出占位）正常。

## `apps/edu/app/portal/apps/system/logs/operation/page.tsx`（189 行）
- 完整逐行检查：完成
- [P2] L37-42: 同登录日志页：搜索时全量拉取 limit=10000 条操作日志再前端过滤，数据量大时开销大。
- [P2] L54-58: 同登录日志页：异步响应无序号守卫，快速翻页/搜索时旧响应可能覆盖新数据。
- [P2] 整页（L1-189）与 login/page.tsx 几乎完全重复（状态管理、loadLogs、searchFiltered、LogTableShell 用法逐行一致，仅 API/列定义/搜索字段不同），两份日志页约 370 行重复代码，维护需同步修改。（最佳实践: 抽象共享 LogPage 组件，参数化 api、columns、搜索字段。）
- 其余（状态徽标、formatTarget、导出占位）正常。

## `apps/edu/app/portal/apps/system/org-user/accounts/page.tsx`（396 行）
- 完整逐行检查：完成
- [P2] L149-150: 搜索时未重置分页页码：当前处于第 2 页及以上时输入搜索词，usePortalUsers 用新搜索词但仍取原页码（offset=(page-1)*pageSize），展示的是搜索结果的第 N 页而非第 1 页，用户可能看到"未找到"而误判无结果（对比日志页 onChange 均有 setPage(1)）。
- [P2] L168-174: 翻页/切换筛选后行选择（selectedAccounts）不清空且跨页累积，而"全选"只作用于当前页（L173）：用户在第一页勾选后翻页，按钮计数仍是旧选中，存在批量删除非当前页账户的误操作风险。（最佳实践: 翻页/搜索时清空选择，或全选改为跨页全选并提示范围。）
- 其余（角色绑定/重置密码/启停/批量删除的 confirm 与错误 toast、PortalCrudPage 统一 onRetry）正常。

## `apps/edu/app/portal/apps/system/org-user/fields/page.tsx`（225 行）
- 完整逐行检查：完成
- 未发现问题。开关/编辑均回传完整字段（fieldName/isEnabled/isRequired/applicableRoleCodes）避免后端全列覆盖被静默禁用，注释说明了原因；角色多选、Badge 展示正常。

## `apps/edu/app/portal/apps/system/org-user/graduates/page.tsx`（340 行）
- 完整逐行检查：完成
- [P2] L207-218: "毕业年份"筛选是客户端 filterItems，只作用于当前页数据；且年份选项（L108-114 graduateYears）也只来自当前页。跨页的毕业生无法通过年份筛选检索到，数据量分页后筛选功能不完整。（最佳实践: 年份筛选改为服务端参数（usePortalUsers 增加 graduateYear 参数）或全量拉取后过滤。）
- [P2] L190-191: 搜索时未重置页码（同 accounts 页 L149-150）：在非第 1 页时搜索展示搜索结果的当前页，可能误显"未找到"。
- 其余（编辑回传完整用户字段、恢复入学、班级选择器、确认对话框）正常。

## `apps/edu/app/portal/apps/system/org-user/org-structure/page.tsx`（731 行）
- 完整逐行检查：完成
- [P2] L94-96 与 L63-70: totalMembers 只累加顶层节点的 memberCount、不递归子节点，而 countByType 递归统计；若后端 memberCount 为节点自身人数（非累计），则统计卡片"总人数"只统计一级节点、数值偏低，两个统计口径不一致。（最佳实践: totalMembers 改为递归累加，或确认后端 memberCount 语义后统一口径。）
- 其余（fetchData 有 cancelled 守卫、编辑时父节点选项排除自身子树防环、迁移提示、批量毕业 fetchAllPages 的 offset=page*pageSize 与 page 从 0 起的语义匹配、高亮滚动 timer 有清理、导出/删除/确认对话框）均正常。

## `apps/edu/app/portal/apps/system/org-user/org-types/page.tsx`（211 行）
- 完整逐行检查：完成
- 未发现问题。onSave/onDelete 无 try/catch 但 PortalCrudPage 统一捕获并 toast；系统默认类型禁删、分类 Badge 颜色映射正常。

## `apps/edu/app/portal/apps/system/org-user/positions/page.tsx`（282 行）
- 完整逐行检查：完成
- [P2] L90, L238: "查看用户"对话框仅拉取 limit=200 条关联用户，标题"共 {n} 名用户关联此职位"用的是截断后的数组长度：职位关联用户 >200 时显示数量与真实 userCount（表格行 Badge）不符，且无分页或"仅显示前 200 名"提示。（最佳实践: 用 position.userCount 显示总数并提示仅展示前 200，或对话框加分页。）
- 其余（新建/编辑职位、启停、导出/导入占位、错误 toast）正常。

## `apps/edu/app/portal/apps/system/org-user/relations/page.tsx`（215 行）
- 完整逐行检查：完成
- [P2] L53-64: 搜索无防抖：useAsync 的 deps 直接是 `[searchText]`，每次按键都触发一次 list 请求（本库其他页面如日志页均用 useDebouncedValue 防抖），连续输入时产生大量请求。（最佳实践: 引入 useDebouncedValue 或复用统一防抖搜索 hook。）
- 其余（创建/删除经 PortalCrudPage 统一 onRetry 刷新、类型映射、UserSelector 单选）正常。

---

## 汇总
- P0: 0
- P1: 0
- P2: 14（14 个文件中有问题 9 个，无问题 5 个）
- 复用候选: 1
  - "批量导出/批量导入"占位按钮（disabled + title 即将上线）在 login(138-141)、operation(145-148)、graduates(223-226)、positions(127-134)、org-types(92-99) 共 5 处重复，可抽象为公共占位按钮组件；另 login 与 operation 两个日志页整体高度重复（约 370 行），建议抽象共享 LogPage 组件。


### report-067-068.md

# 代码审查报告 067-068（frontend）

> 依据 docs/code-review/REVIEW-GUIDE.md 逐行完整审查；仅审查批次清单内文件，未修改任何源代码。
> 本批次均为前端 React 页面（apps/edu），无后端分层红线问题（handler/service/store 规则不适用）。

## `apps/edu/app/portal/apps/system/org-user/roles/page.tsx`（745 行）
- 完整逐行检查：完成
- [P1] L362-364: 操作权限保存与展示对 `subscriptionModules === null` 的处理不一致。展示层（L216-224）在 null 时展示全部模块（`subscriptionModules == null ||` 放行），但保存层 filter 用 `subscriptionModules?.[...] === true`，null 时迭代 0 个模块，用户勾选/取消的操作权限改动全部静默丢弃（`permissions` 仅保留旧值 + 新 menus，L358），且无任何提示。`subscriptionModules` 在订阅接口失败时会持续为 null（见 hooks/use-subscription-modules.ts 注释：失败保持 null 跳过校验），此时权限配置核心功能静默失效。（最佳实践: 保存时对 null 与展示层一致地按"全部已订阅"处理，即 `subscriptionModules == null || subscriptionModules[...] === true` 作为保存过滤条件）
- [P2] L384/L408: `roleApi.update` 提交整个 `{ ...selectedRole, permissions }` / `{ ...item }`，包含 userCount、createdAt 等非编辑字段，依赖后端忽略多余字段（最佳实践: 仅提交可编辑字段）
- [P2] L434-435: `openUsersDialog` 失败时把错误写入页面级 `error` 状态，弹窗内用户看到的是主列表错误横幅而非弹窗内提示；且关闭弹窗后错误不清理（最佳实践: 弹窗内独立错误态）
- [P2] L250-256: `generateRoleCode` 依赖 `roles` 列表状态计算自增后缀，若列表加载失败（空数组）则可能生成与库内已有角色冲突的编码（最佳实践: 后端生成或基于查询最大后缀）

## `apps/edu/app/portal/apps/system/org-user/students/page.tsx`（529 行）
- 完整逐行检查：完成
- [P2] L394-400: 新建学生密码输入框使用 `type="text"`（L395），密码明文可见（与教师页同模式）（最佳实践: 使用 `type="password"`）
- [P2] L164: `confirmBatchDelete` 中 `await refetch()` 位于 try/finally 之外，refetch 抛错会产生未处理 rejection（最佳实践: 移入 try/finally 或单独 catch）
- 未发现 P0/P1 问题

## `apps/edu/app/portal/apps/system/org-user/teachers/page.tsx`（517 行）
- 完整逐行检查：完成
- [P2] L373-379: 新建教师密码输入框使用 `type="text"`（L374），密码明文可见（最佳实践: 使用 `type="password"`）
- [P2] L228-232: 角色 Badge 用数组索引 `key={i}` 作 key（L229），列表顺序变化时可能导致错误复用（最佳实践: 用角色名等稳定标识作 key）
- [P2] L161: `confirmBatchDelete` 中 `await refetch()` 位于 try/finally 之外（同学生页）
- 未发现 P0/P1 问题

## `apps/edu/app/portal/apps/system/page.tsx`（5 行）
- 完整逐行检查：完成
- 未发现问题（纯 redirect 到 /portal/apps/system/tenant）

## `apps/edu/app/portal/apps/system/resource/codes/page.tsx`（92 行）
- 完整逐行检查：完成
- 未发现问题（只读列表页，逻辑简单清晰）

## `apps/edu/app/portal/apps/system/resource/industries/page.tsx`（231 行）
- 完整逐行检查：完成
- [P2] L42-51: `parentMap` 构建为对每个有 parentId 的行业执行 `industries.find`，O(n²)（数据量 ≤1000，仅提示）（最佳实践: 先建 id→industry 的 Map 再一次性关联）
- [P2] L194: code/name 为空时直接 `return` 无任何提示，用户点击保存无反馈（最佳实践: 提示必填或依赖表单校验）
- 未发现 P0/P1 问题

## `apps/edu/app/portal/apps/system/resource/majors/page.tsx`（173 行）
- 完整逐行检查：完成
- [P2] L139: code/name 为空时直接 `return` 无任何提示（同 industries 页）（最佳实践: 提示必填或依赖表单校验）
- 未发现 P0/P1 问题

## `apps/edu/app/portal/apps/system/resource/package/page.tsx`（265 行）
- 完整逐行检查：完成
- 未发现问题（纯展示页；buildPackageModules 将二级模块 enabled 与一级模块绑定为全开/全关，若后端存在更细粒度数据则展示不全，但当前接口契约下无实际影响）

## `apps/edu/app/portal/apps/system/tenant/_components/school-admin-manager.tsx`（464 行）
- 完整逐行检查：完成
- [P2] L124-127: 创建管理员后初始密码通过 toast 明文展示（`t('初始密码：{pwd}')`）。属创建流程的既定设计（一次性告知），但明文出现在 toast 中可能被截图/日志留存，建议提示"请管理员登录后立即修改密码"（最佳实践: 展示后引导修改，或仅提示密码已通过其他渠道下发）
- 未发现 P0/P1 问题（修改密码弹窗对规则/一致性校验完整，密码 input 为 type="password"）

## `apps/edu/app/portal/apps/system/tenant/page.tsx`（896 行）
- 完整逐行检查：完成
- [P2] L102-109: `mapBackendTenant` 中 shortName/schoolType/province/city/website/contactPhone/educationLevel/educationNature 等字段用 `(t as any)` 强转访问，绕过了类型检查（最佳实践: 扩展 BackendTenant 类型定义，避免 any）
- [P2] L698-707 与 L331-347: "联系电话"输入框 onChange 同时写入 `phone` 与 `contactPhone` 两个字段并整体提交，若后端两字段原值不同，编辑保存后会被合并覆盖为同一值（潜在数据丢失）（最佳实践: 区分两个字段或明确后端字段语义）
- [P2] L744-748/L355-356: 编辑弹窗保存失败写入主页面级 `error` 状态，弹窗关闭后错误横幅仍残留（最佳实践: 弹窗内独立错误态）
- 未发现 P0/P1 问题（AI API Key 以 password 输入、仅展示 apiKeyMasked、不落前端存储，符合 AI 开发红线）

## `apps/edu/app/portal/layout.tsx`（63 行）
- 完整逐行检查：完成
- 未发现问题（认证守卫逻辑正确：未登录/平台不符重定向登录页，workspace 按角色放行）

## `apps/edu/app/portal/login/page.tsx`（306 行）
- 完整逐行检查：完成
- [P2] L66-72: `doLogin` 内 `setToken` 后若 `authApi.portalMe()` 抛错（网络/会话问题），token 已写入存储但页面停在登录页并提示"登录失败"，造成"已登录但显示未登录"的中间态，下次刷新可能直接进入已登录态（最佳实践: doLogin 内自行 try/catch，失败时清除 token 并统一报错）
- 未发现 P0/P1 问题（验证码防爆破流程、开发环境测试账号 NODE_ENV 门禁、密码 type="password" 均正确）

## `apps/edu/app/portal/page.tsx`（566 行）
- 完整逐行检查：完成
- 未发现问题（静态营销首页；卡片权限锁定逻辑 hasMenuPermission 处理正确，未配置路由的平台展示"暂未开放"）

## `apps/edu/app/portal/workspace/_components/account-info-form.tsx`（76 行）
- 完整逐行检查：完成
- 未发现问题（表单简单清晰，unchanged 禁用逻辑正确，错误处理完整）


### report-069-070.md

# 代码审查报告 069-070（frontend：学生/教师/学校管理员工作台组件）

- 审查指南：docs/code-review/REVIEW-GUIDE.md
- 审查方式：逐文件完整逐行阅读（read 工具，无跳读/抽查），行号均经 read 工具核对真实
- 批次：069-frontend.json（7 文件，2401 行）、070-frontend.json（11 文件，2111 行）
- 结论：P0 0 项、P1 0 项、P2 12 项；复用候选 1 项

---

## `apps/edu/app/portal/workspace/_components/assessment-tab.tsx`（398 行）
- 完整逐行检查：完成
- [P2] L65-76: openDetail 无取消/请求序号保护；连续点击不同行"查看明细"时后发请求先返回会覆盖用户最后点击的明细（setDetail 无竞态守卫），与本文件 L27-46 两个 useEffect 均带 cancelled 守卫的风格不一致（最佳实践: 引入请求序号 ref 或 cancelled 标志，参照 community-tab loadTopics）。
- 说明: 结果列表 limit:50 分页，考试列表来自 dashboard 接口，均无越权/泄露问题（后端按角色过滤）；未发现问题项。

## `apps/edu/app/portal/workspace/_components/career-tab.tsx`（533 行）
- 完整逐行检查：完成
- [P2] L69-259: CourseCoverCard/BankCard/ExamCard 三张卡片结构高度重复（封面渐变 + CoverBadge + 信息区 + 底部统计），且"取消收藏"按钮样式在 L122-132/L185-195/L246-256 及 L417-424/L445-452 共 5 处重复（最佳实践: 抽象 FavoriteCard 与 UnfavoriteButton 复用组件）。
- 复用候选: 见文末第 1 条。

## `apps/edu/app/portal/workspace/_components/change-password-form.tsx`（84 行）
- 完整逐行检查：完成
- 未发现问题。密码规则校验、两次一致校验、提交防重（submitting）与错误展示完整；密码不回传前端日志。

## `apps/edu/app/portal/workspace/_components/community-tab.tsx`（647 行）
- 完整逐行检查：完成
- [P2] L120-139: openDetail 无取消保护：详情加载中点击"返回列表"（closeDetail L141-146 已置 detail=null 并回到列表）后，迟到的 getTopic 响应仍会执行 setDetail(topicDetail) 重新弹出详情；连续打开不同话题也可能显示旧话题（最佳实践: 复用 loadTopics L91-112 的 loadSeqRef 序号守卫，或加 cancelled 标志）。
- 说明: 排序切换已有 seq 防竞态（L101/L110）；发帖/回复提交均有 disabled 防重与错误处理；右侧小组/导师为需求明确保留的 mock 数据（L39 注释），不报。

## `apps/edu/app/portal/workspace/_components/dashboard-tab.tsx`（181 行）
- 完整逐行检查：完成
- 未发现问题。角色切换 seq 防竞态正确；useT（useCallback 依赖 locale）与 toast 依赖稳定不会引发重复请求；错误经 reportError + toast 处理。

## `apps/edu/app/portal/workspace/_components/grading-iframe-dialog.tsx`（65 行）
- 完整逐行检查：完成
- [P2] L55-60: iframe 仅 onLoad 结束 loading；若外部平台拒绝被嵌入（X-Frame-Options）或网络加载失败，L47-54 的 loading 遮罩将永久显示（最佳实践: 增加 onError 兜底结束 loading 并提示用户）。

## `apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx`（493 行）
- 完整逐行检查：完成
- [P2] L86-102: loadCourseData 无请求序号/取消保护，快速切换左侧课程（L242-247 每次切换都调用）时，旧课程的响应若晚到会覆盖新课程数据，导致右侧节点/学生与顶部选中课程标题不一致（最佳实践: 引入 loadSeqRef 守卫，参照 community-tab loadTopics）。
- [P2] L89-91: 节点（limit 1000）、测评结果（listByCourse 全量）、用户（limit 1000）一次性全量拉取；节点多/班级大时单次请求体量大，且用户数超 1000 时学生姓名回退为"未知"（最佳实践: 按选中课程/节点分页或按需加载）。

## `apps/edu/app/portal/workspace/_components/learning-tab.tsx`（338 行）
- 完整逐行检查：完成
- [P2] L103/L110/L115/L123: 顶部统计卡硬编码静态值（"本学期共 5 门"、"2 个待完成"、学习时长 "86h"、本周完成 12），与真实 API 数据（courses.length/sceneTasks.length）并存混排，实际数据不同时会误导用户（最佳实践: 由后端返回统计值，或删除硬编码文案）。

## `apps/edu/app/portal/workspace/_components/my-schedule-tab.tsx`（108 行）
- 完整逐行检查：完成
- 未发现问题。useAsync 统一处理 loading/错误；404/未配置学期按空态处理；student/teacher 跳转分支正确。

## `apps/edu/app/portal/workspace/_components/portrait-tab.tsx`（15 行）
- 完整逐行检查：完成
- 未发现问题。userId 经 encodeURIComponent 处理嵌入 iframe 查询参数，无注入风险。

## `apps/edu/app/portal/workspace/_components/prep-associate-dialog.tsx`（223 行）
- 完整逐行检查：完成
- [P2] L15-20/L45: 子项数据来自占位 mock（hybridCourseSessions/scenarioTasks），关联结果仅前端本地 selectedIds 生效、无真实 API 持久化，功能尚未落地（文件头已注明待替换，仍提示）（最佳实践: 接入真实备课关联 API 后移除 mock 并补充错误处理）。

## `apps/edu/app/portal/workspace/_components/profile-tab.tsx`（562 行）
- 完整逐行检查：完成
- [P2] L186: 手机号脱敏 `user.phone.slice(0, 3)****user.phone.slice(-4)` 对长度 ≤7 的号码会重叠泄露全部号码（如 7 位号 "1234567" → "123****4567"，12 位以下号码同样部分暴露完整数字）（最佳实践: 按长度保护，保证遮蔽段覆盖中间全部位数）。
- [P2] L68-97: loadHonors（L68-78）与 useEffect（L80-97）重复实现同一拉取逻辑（最佳实践: 复用 loadHonors）。
- [P2] L171-179/L453-456/L478-481: 通知偏好为硬编码常量且 Switch 全部 disabled，无保存/持久化行为，却以可配置样式展示，用户无法修改（最佳实践: 后端提供偏好接口并接入，或明确标注"暂未开放"）。
- 说明: 上传附件失败静默保持原状（L124-126）符合"简单优先"；荣誉增删改均有错误 toast 与刷新。

## `apps/edu/app/portal/workspace/_components/school-admin-approvals-tab.tsx`（113 行）
- 完整逐行检查：完成
- 未发现问题。审批跳转 href 映射齐全（pending- 与 type 双映射兜底）；加载失败置空态，无异常。

## `apps/edu/app/portal/workspace/_components/school-admin-overview-tab.tsx`（248 行）
- 完整逐行检查：完成
- 未发现问题。说明: L100-135/L149-175 的待办/公告区块与 dashboard-tab.tsx 结构相似（各 2 处，未达 ≥3 处复用候选标准），暂不记入。

## `apps/edu/app/portal/workspace/_components/school-admin-personnel-tab.tsx`（129 行）
- 完整逐行检查：完成
- 未发现问题。人员统计 iconMap 中文键映射完整，快捷入口 href 正确。

## `apps/edu/app/portal/workspace/_components/school-admin-resources-tab.tsx`（206 行）
- 完整逐行检查：完成
- 未发现问题。增长图按 resourceTrendItems 六类资源映射取值（L104-107），缺失键值仅图表断点无崩溃；待审批列表正确。

## `apps/edu/app/portal/workspace/_components/section-card.tsx`（81 行）
- 完整逐行检查：完成
- [P2] L22-31: colorMap 与 stat-card.tsx L19-27 重复定义（仅差 gray 一项），同目录两组件各自维护一份（最佳实践: 提取共享颜色映射常量或统一放到 ui 工具模块）。

## `apps/edu/app/portal/workspace/_components/stat-card.tsx`（88 行）
- 完整逐行检查：完成
- 未发现问题。可点击卡片带 role/tabIndex/键盘 Enter+Space 处理，可访问性正确；颜色映射重复见 section-card.tsx 条目。

---

## 复用候选汇总（1 项）

1. **收藏卡片三件套 + 取消收藏按钮**：career-tab.tsx 中 CourseCoverCard（L69-135）、BankCard（L137-198）、ExamCard（L200-259）三张卡片结构高度重复（封面渐变 + CoverBadge + 名称/描述 + 底部统计 + 悬浮取消收藏按钮），取消收藏按钮样式共 5 处重复。可抽象 FavoriteCard（props: cover/href/badge/content/onUnfavorite）与 UnfavoriteButton 复用组件。


### report-071-072.md

# 代码审查报告 批次 071-072（frontend）

审查依据：docs/code-review/REVIEW-GUIDE.md（逐文件完整逐行阅读，行号经 read 工具核对）。
批次 071：apps/edu/app/portal/workspace/_components/ 下 3 个教师工作台组件；批次 072：teacher-profile-tab、workspace-schedule-grid、_data 下 2 个数据文件、workspace/page.tsx 及 scene 下 3 个页面。
结论：未发现 P0 问题；P1 共 3 处（周次计算 bug ×2、批量删除失败误弹成功）；P2 若干；复用候选 4 项。

---

## `apps/edu/app/portal/workspace/_components/teacher-courses-tab.tsx`（1176 行）
- 完整逐行检查：完成
- [P2] L44-63: 引入的全部演示 mock（mockSignInData、mockQuizResults、mockRushAnswerRanking、mockClassInteraction、mockAttendanceRateData、mockStudentDetails、mockHomeworkSubmissions、mockHomeworkTrend、mockPeerReviewStats、mockTrainingReports、mockSemesterSummary、mockAssessmentDimensions、mockCompositeDistribution、mockStudentRanking）在 `_data/workspace-teacher-types.ts` 中已全部清空为默认值/空数组，导致 TrackingView/AssessmentView/FinalView 打开后展示全零/空表/空图（如 L126-130 测验均分恒为 0、L140 抢答参与率硬编码 0%、L149 课堂互动次数硬编码 28、L193-218 排行表空、L253-275 明细表空）。代码注释已声明为占位，但"课程期末总评/教学进展/测评进展"弹窗对外呈现为有数据形态的空白报表，建议尽快接入真实 API（最佳实践: 在接入前隐藏入口或展示空态提示，避免误导）。
- [P2] L362-380: 单元测验分数分布为硬编码静态数据（90-100:35、80-89:30 等），与 mock 数据无关联，演示残留。
- [P2] L815/L824: prepUrl 硬编码 `/lesson/admin/hybrid/add?id=hybrid-1` 与 `${SCENE_PLATFORM_URL}/student_teacher.html?task=task-1-1`，实际节次 id 未参与拼接，所有节次跳转同一演示链接。
- 复用候选: 与 teacher-dashboard-tab.tsx 重复了 ① 备课关联（prepDialogOpen/prepPlanId/... 状态 + PrepAssociateDialog 接线）、② 混合课评分（hybridGrade* 状态 + HybridGradingDialog 接线）、③ 课程/场景的 prepUrl+learnUrl 配置（accentColors vs getCourseUrls）、④ portalApi.workspaceDashboard({role:'teacher'}) 数据拉取，可抽公共 hook/组件。

## `apps/edu/app/portal/workspace/_components/teacher-dashboard-tab.tsx`（817 行）
- 完整逐行检查：完成
- [P1] L392-397: weekIndex 计算 bug——`offset = weekStart.getDate() + startDay - 2` 在"该月 1 号非周一"（约 6/7 月份）时，第 1 周的 weekStart 落在上月，`getDate()` 取到上月末的 28~31，导致第 1 周被算成第 5/6 周（与真实末周索引重复，页头显示"第 N 周"错误、周下拉出现重复值）。例如 2025 年 4 月第 1 周（3/31 起）weekStart=31、startDay=2 → offset=31 → weekIndex=5，而真实第 5 周（4/28 起）也=5。建议改为基于绝对日期的周计数（如用 `(weekStart - firstDayWeekStart) / 7 + 1` 或时间戳差值），并复用同一实现。
- [P2] L299-313: getCourseUrls 硬编码 prepUrl（`id=hybrid-1`/`task=task-1-1`），演示残留（与 teacher-courses-tab.tsx 相同问题）。
- [P2] L711-718: `if (onGradeRequest)` 块缩进错位（调用语句未与上层 if 对齐），可读性问题，建议格式化。
- 复用候选: ① 周导航逻辑（getWeekStart/getWeekEnd/getWeeksInMonth/weekIndex/handleWeekChange）与 workspace-schedule-grid.tsx 基本重复；② 备课/混合课评分弹窗接线与 teacher-courses-tab.tsx 重复；③ 与 teacher-courses-tab.tsx 各自独立拉取同一 `workspaceDashboard({role:'teacher'})` 接口。

## `apps/edu/app/portal/workspace/_components/teacher-portraits-tab.tsx`（520 行）
- 完整逐行检查：完成
- [P2] L94: `jobAbilityResultApi.list({ limit: 200 })` 固定上限且无分页/加载更多，学生数 >200 时列表静默截断，教师无法看到全部学生。
- [P2] L119-124: `r.abilityPointDetails as unknown as JobAbilityPointDetail[]` 双重类型断言，掩盖了字段类型不一致，建议在 `JobAbilityResult` 类型上修正字段定义。
- 未发现其他问题（L91-110 已正确处理取消标志）。

## `apps/edu/app/portal/workspace/_components/teacher-profile-tab.tsx`（225 行）
- 完整逐行检查：完成
- [P2] L109-110: `[Lock, Smartphone, Mail, Phone][index]` 按数组下标取图标，与 `teacherSecurityItems` 数组顺序强耦合，后续增删条目会错配图标（当前该数组已清空，安全项列表实际为空）。
- 未发现其他问题（L21-28 通知偏好为硬编码开关且全部 disabled，属演示占位，与代码注释一致）。

## `apps/edu/app/portal/workspace/_components/workspace-schedule-grid.tsx`（612 行）
- 完整逐行检查：完成
- [P1] L138-143: 与 teacher-dashboard-tab.tsx 相同的 weekIndex 计算 bug——`offset = weekStart.getDate() + startDay - 2`，当该月第 1 周始于上月时 weekIndex 错误（如 2025 年 4 月第 1 周显示"第 5 周"且周下拉值重复），建议修正为绝对日期周计数并抽公共工具函数。
- [P2] L574: YearView 的事件归属为占位伪逻辑 `e.dayOfWeek % 4 === m % 4`，与具体月份完全无关（事件按星期取模被随机塞进月份卡片），演示残留，接入真实数据后需改为按事件日期归属月份。
- [P2] L28: `import { formatDate , formatYMD }` 有多余空格，格式问题。
- 复用候选: 周导航/周次计算（getWeekStart/getWeekEnd/getWeeksInMonth/weekIndex/handleWeekChange/prevPeriod/nextPeriod）与 teacher-dashboard-tab.tsx 重复，建议抽取公共 schedule-utils。

## `apps/edu/app/portal/workspace/_data/workspace-student-types.ts`（33 行）
- 完整逐行检查：完成
- 未发现问题（纯类型/常量定义；dayOfWeek 1=周一~7=周日 的注释与使用方匹配）。

## `apps/edu/app/portal/workspace/_data/workspace-teacher-types.ts`（235 行）
- 完整逐行检查：完成
- 未发现问题（文件头已声明所有 mock 清空为默认值/空数组、等待接入真实 API；该清空是有意为之，但导致引用方 teacher-courses-tab/teacher-profile-tab 展示空值，见对应文件的 P2）。

## `apps/edu/app/portal/workspace/page.tsx`（909 行）
- 完整逐行检查：完成
- [P2] L344-354 + L469: `roleConfigs.teacher`/`roleConfigs.admin` 为死代码——teacher/school_admin 角色在 L421/L446 已提前分支返回，通用视图固定 `config = roleConfigs.enterprise`（L469），建议删除未使用的配置项。
- [P2] L72-78 + L770: weeklyData/monthlyTrend/resourceUsage/contacts 全部为空数组（图表渲染为空），但 L770 仍硬编码展示 "+12.5%" 活跃度徽标，数据与展示不一致，属演示残留。
- [P2] L344/L428: 欢迎语硬编码"张老师"（与 teacher 分支 L428 相同），未取真实用户名。
- 复用候选: StudentWorkspace（L104-171）/TeacherWorkspace（L180-258）/SchoolAdminWorkspace（L267-325）三份 Tab 导航栏结构（sticky 容器 + tabs 数组 + button 渲染）高度重复（≥3 处），可抽取共享的 `WorkspaceTabs` 组件统一渲染。

## `apps/edu/app/scene/approvals/page.tsx`（143 行）
- 完整逐行检查：完成
- [P2] L44: `scenarioApi.list({ limit: 1000 })` / `sceneBatchApi.list({ limit: 1000 })` 固定上限，场景/批次超过 1000 时对应列回退显示 targetId/raw key（L108/L140），无分页方案，建议服务端提供按需查询或增量加载。
- 未发现其他问题（mapRecord/useCallback 依赖完整，错误处理走 handleLoadError）。

## `apps/edu/app/scene/archive/page.tsx`（228 行）
- 完整逐行检查：完成
- [P1] L110-116: 批量删除部分失败时先弹"部分删除失败"（L112-114），随后无条件再弹成功 toast"已批量删除 N 个场景"（L116），失败场景仍向用户显示成功，属"失败弹成功"误导（Promise.allSettled 不会 reject，L117 catch 仅兜 refresh 异常）。建议 failedCount > 0 时不再弹成功 toast，改为汇总文案（如"成功 X 个，失败 Y 个"）。
- [P2] L22-23: 与 approvals 相同的 limit 1000 固定上限问题。
- 未发现其他问题（单条恢复/删除错误处理正确）。

## `apps/edu/app/scene/batches/page.tsx`（17 行）
- 完整逐行检查：完成
- 未发现问题（纯包装组件，委托 BatchGroupPage）。

---

### 复用候选汇总（4 项）
1. workspace/page.tsx 三处角色工作台 Tab 导航栏重复（≥3 处）→ 抽取 `WorkspaceTabs` 组件。
2. teacher-dashboard-tab.tsx 与 workspace-schedule-grid.tsx 的周导航/周次计算逻辑重复 → 抽公共 schedule-utils（并顺带修复 P1 周次 bug）。
3. teacher-dashboard-tab.tsx 与 teacher-courses-tab.tsx 的备课关联/混合课评分弹窗接线与课程 URL 配置重复 → 抽公共 hook（usePrepAssociations / getCourseUrls）。
4. teacher-dashboard-tab.tsx 与 teacher-courses-tab.tsx 各自独立拉取 `portalApi.workspaceDashboard({role:'teacher'})` → 抽公共数据 hook 或提升到父级共享。


### report-073-074.md

# 代码审查报告 073-074（frontend · scene 场景模块）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、按模板报告、行号经 read 核对）。
批次：073（7 个文件，2511 行）+ 074（8 个文件，2051 行），合计 15 个文件。
审查方式：每个文件用 read 工具分段完整阅读；跨文件问题已结合父页面/公共组件核实（tasks/page.tsx 表单包裹、Button/Tabs 默认 type、use-ai-assist 流水线时序）。

---

## `apps/edu/app/scene/landing/[id]/learn/page.tsx`（356 行）
- 完整逐行检查：完成
- [P2] L131-132: live 路径（教师/管理员预览）任务列表用 `taskApi.list({ scenarioId: id, limit: 1000 })` 单次拉取且无分页，场景任务超过 1000 时预览缺失；同目录 `[id]/page.tsx` L445 已改用 `fetchAllPages`，两处不一致（最佳实践: 统一改用 fetchAllPages 分页拉取）
- [P2] L166-171: 知识点/能力点/颗粒课列表均为 `limit: 1000` 单次拉取，无分页，数据量超限时映射缺失（非核心接口，仅提示）
- 复用候选: L129-187 的 live 数据组装（任务/资源/知识点/能力点/课程 + 资源归一化）与 `landing/[id]/page.tsx` L441-485 高度重复，可抽公共 hook

## `apps/edu/app/scene/landing/[id]/page.tsx`（1101 行）
- 完整逐行检查：完成
- [P2] L731-736: `typeColors` 映射表在 `resources.map` 回调内每项重新创建，可提升为模块级常量（可读性/微小性能）
- 复用候选: L454-459 的资源归一化（`type: r.resourceType || r.type; size: fileSize ?? size`）与 learn/page.tsx L157-158、use-task-datasets.ts L215-216 三处重复，可抽 `normalizeTaskResource(r)`；L311-319 与 L617-627 的「考核/训练」彩色徽章与 learn/page.tsx L342-352 三处重复，可抽 `TaskTypeBadge`

## `apps/edu/app/scene/landing/layout.tsx`（24 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/scene/landing/page.tsx`（5 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/scene/layout.tsx`（12 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/scene/page.tsx`（105 行）
- 完整逐行检查：完成
- 未发现问题（`generateCode` 用 Math.random 生成 4 位编号，碰撞概率低且属普通业务，按指南容忍）

## `apps/edu/app/scene/scenarios/[id]/edit/page.tsx`（901 行）
- 完整逐行检查：完成
- [P1] L406-411（关联 L121-123、L159-182）: 快速补全弹窗确认后同步调用 `runAiAssist()`，而 `pipeline.request`（L164-165）同步读取 `formRef.current`；`formRef` 由 useEffect（L121-123）在渲染提交后才同步，同一次点击内仍持有旧值 → AI 请求携带的是旧（可能为空）的 name/background，刚输入的补全内容不会进入 AI 上下文，且 AI 结果随后会覆盖用户刚输入的内容（最佳实践: 确认补全后先 `await` 状态生效或直接在 `formRef.current` 写入 quickFill 值再发起请求）
- [P2] L102: `creatorName` 恒为「当前用户」占位，查看他人创建的既有场景时「创建人」也显示当前用户，与 creatorId 不符（最佳实践: 用 `creatorId` 关联用户列表反查真实姓名）
- 未发现 P0

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/ai-task-chain-suggestion.tsx`（370 行）
- 完整逐行检查：完成
- [P2] L305-309: 复选框 `onCheckedChange={() => {}}` 空实现且 `onClick` stopPropagation——复选框只是纯视觉标记，点击无效（只能点整张卡片切换），键盘用户也无法用复选框操作（最佳实践: 让复选框自身 toggles 或去掉复选框只保留卡片交互）
- 未发现 P0/P1

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/hooks/use-task-datasets.ts`（389 行）
- 完整逐行检查：完成
- [P2] L157-159: `loadDatasets` 在请求发起前就把 key 写入 `loadedDatasetsRef`，一旦某数据集加载失败（网络/接口异常），同会话内后续 `loadDatasets` 不会再重试，数据集保持为空直到整页刷新（最佳实践: 失败时回退标记，或允许显式重试）
- [P2] L165/191/205/276/303-304: 知识/能力/资源/用户列表与克隆候选的场景/任务均为 `limit: 1000` 无分页单次拉取，超限截断（非核心接口，仅提示；克隆场景的全量任务拉取在租户数据量大时较重）
- 未发现 P0/P1

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/repro.test.ts`（147 行）
- 完整逐行检查：完成
- 未发现问题（console.log 为测试调试输出，可保留）

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-description-card.tsx`（218 行）
- 完整逐行检查：完成
- [P1] L165、L169-177、L178-181: 「预览 / 重新上传 / 移除文件」三个 `<Button>` 均未设 `type="button"`；父级 tasks/page.tsx L2886-2903 将卡片内容包在 `<form onSubmit={...handleSave}>` 内，本项目 Button（packages/ui/src/components/ui/button.tsx）未默认 type，点击即触发原生 form submit → 父级 `handleSave()` + `onClose()` 直接保存并关闭整个卡片对话框；「预览」弹窗因组件随对话框卸载永远无法显示，「重新上传/移除文件」操作后对话框意外关闭（最佳实践: 上述按钮补 `type="button"`）
- 未发现 P0

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card.tsx`（130 行）
- 完整逐行检查：完成
- [P1] L103: 难度星级 `<button onClick={() => onDifficultyChange(n)}>` 未设 `type="button"`，原生 button 默认 type=submit；父级 tasks/page.tsx L2886-2903 卡片对话框包在 `<form>` 内 → 点击任意星级即触发 form submit，走父级 `handleSave()`（L2251-2258 保存信息并 `onClose()` 关闭对话框），用户无法连续调整难度（对比同批次 edit/page.tsx L636 星级按钮已正确写 `type="button"`）（最佳实践: 补 `type="button"`）
- 未发现 P0

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.test.ts`（236 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.tsx`（534 行）
- 完整逐行检查：完成
- [P2] L248-256 ↔ L317-325: `taskStateToEvalRuleConfig` 转出 reviewSteps 时不携带 `id`，`evalRuleConfigToTaskStateUpdates` 回转时用 `uid('rs')` 重新生成 id → 每次「打开评价规则编辑器→保存」往返后 reviewStep id 都会变化；若后端按 id 增量更新会产生无效更新/孤儿记录（现有 repro.test.ts 未覆盖 reviewSteps id 稳定性）（最佳实践: 转换链保留原始 id）
- 未发现 P0/P1

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-weight-card.tsx`（19 行）
- 完整逐行检查：完成
- 未发现问题


### report-075-076.md

# 代码审查报告 075-076（前端批次）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、严重级别、报告模板）
范围：batch 075 + 076 共 6 个前端文件

## `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx`（3120 行）
- 完整逐行检查：完成
- [P2] L248-251: 注释声称"离开编辑页时清理模块级缓存"，但 useEffect 的 cleanup 函数体为空（L249-250），未做任何清理，属无效死代码（最佳实践: 删除该 effect，或实现真实缓存清理）
- [P2] L1977/L1979/L2069/L2073: AI 结果字段 `p.name` / `p.background` 未经判空直接 `.trim()`；AI 返回缺字段时抛 TypeError，中断 AI 写入管线（最佳实践: 使用 `p.name?.trim()` 或 `(p.name || '').trim()` 防御）
- [P2] L779-780: `handleClone` 克隆任务权重按"总任务数"均分（`Math.floor(100 / count)` 只分给新克隆任务，既有任务权重保留），当场景已有已配置权重（如 2 个任务各 50%）再克隆 2 个任务时，新任务各得 25%，总权重变为 150%，突破 100%（最佳实践: 参照 L644-648 `handleAddTask` 的"剩余权重"分配模式：先算既有权重占用，再在克隆任务间分配 remainder）
- [P2] L1400-1405: 拖拽排序 `taskApi.reorder` fire-and-forget，失败仅 `reportError` 记录、无用户提示；失败时 UI 顺序与后端不一致，用户无感知（最佳实践: 失败时 toast 提示并回滚排序或提示重试）
- [P2] L1744: 权重弹窗关闭时 `persistWeights(tasks, taskStates)` 未 await、返回值被丢弃；失败仅内部计数、无任何提示（最佳实践: await 结果，失败数 >0 时 toast）
- [P2] L1126-1175 + L823-841: 核心"完成配置/保存草稿"路径对每个任务串行发起 2-3 个 API 调用（taskApi.update/create + saveMethodsWithRetry + scenarioWeightApi.upsert），任务数多时保存耗时线性放大（最佳实践: 按任务用 Promise.all 并行，权重保存同样并行；注意 409 重试仍可保留）
- [P2] L1189-1224: `handleSaveDraft` 与 `handleFinish` 主体逻辑几乎完全相同（saveTasksToBackend + 条件 saveDraft + toast + setExistingScenario），仅结尾 router.push 不同（最佳实践: 抽公共 `saveAndDraft()` 供两者调用）
- [P2] L210/L311/L318-321/L1525-1541: 缩进不一致（如 L210 `const [loadFailed...]` 多缩进 2 空格；L310-311、L318-321 花括号对齐错乱），格式问题
- [P2] L2227-2233: 四段空注释占位（"For random draw custom questions"、"For resources search & upload" 等），对应代码已不存在，属死代码残留（最佳实践: 删除）
- 未发现问题之外：整体结构清晰（AI 辅助写入的 ref 快照/1 级撤销、409 版本重试、临时 ID 任务迁移等处理得当）

## `apps/edu/app/scene/workflows/page.tsx`（9 行）
- 完整逐行检查：完成
- 未发现问题（薄封装页：仅渲染 `WorkflowConfigPage` 并传入 subtitle，无逻辑）

## `apps/edu/app/superadmin/layout.tsx`（5 行）
- 完整逐行检查：完成
- 未发现问题（简单布局壳）

## `apps/edu/app/superadmin/page.tsx`（2325 行）
- 完整逐行检查：完成
- [P2] L301/L338: `await fetchThemeColor()` / `await fetchThemeColor(ten.id)` 无 try/catch，请求失败产生未处理的 Promise rejection（最佳实践: catch 后回退默认主题色或 toast 提示）
- [P2] L1661-1673: 企业详情弹窗 `enablePublic` Switch 乐观更新（L1666 `void saveEnterpriseProfile` + L1667 直接 setViewProfile），保存失败时仅 toast，本地状态不回滚，UI 与后端展示开关不一致（最佳实践: 失败时依据后端重新加载结果回滚，或 await 成功后再更新 UI）
- [P2] L391-396 与 L433-438: JWT payload 解码逻辑（`atob(token.split('.')[1].replace(...))`）在两处重复，且项目无公共解码工具（最佳实践: 抽 `parseJwtPayload(token)` 公共函数到 lib）
- 其余（登录验证码流程、API Key 不回显/留空不提交、删除需输入租户名确认、企业资料加载失败禁用保存等）处理得当

## `apps/edu/components/alliance/alliance-detail-shell.tsx`（249 行）
- 完整逐行检查：完成
- [P2] 与 `components/shared/alliance-detail-shell.tsx`（105 行）构成平行实现：两者同为详情页壳（标题/返回/徽章/Tabs），但 props 形态不同（本文件提供 breadcrumbs/stats/coverImage/icon 渐变视觉，shared 提供 notFound/loading/defaultTab/URL tab 同步），两个页面组各自引用其一，后续视觉或行为改动需同步两处，易漂移（最佳实践: 评估合并为单一 shell，通过可选 props 覆盖两种视觉形态；如保留两份，至少补充注释说明差异边界）
- 文件本身实现无逻辑错误（Tabs 空数组时 `tabs[0]?.value` 为 undefined 属安全边界）

## `apps/edu/components/alliance/employer-brand-detail.tsx`（890 行）
- 完整逐行检查：完成
- [P2] L610/L753: 引用岗位与学生拉取 `limit=200` 硬截断；学校/企业数据超过 200 条（岗位或学生）时，超出部分在弹窗中不可达且无法搜索到（最佳实践: 分页加载，或提升 limit 并在服务端搜索）
- [P2] L614/L756: `useAsync` 的 `onError: () => true` 吞掉加载失败；请求失败时用户看到"没有可引用的岗位/学生"空态而非错误提示，属误导（最佳实践: onError 中 toast 错误信息）
- [P2] L61-66: `salaryText` 与 `components/alliance/job-brand-dialogs.tsx` L28-32、`app/portal/alliance/brands/[id]/page.tsx` L64-68 完全相同（共 3 文件 4 处实现）（最佳实践: 提取公共 `formatSalaryRange(p)` 工具）
- 复用候选: `salaryText`（L61-66）与 job-brand-dialogs.tsx、portal/alliance/brands/[id]/page.tsx 重复（≥3 处）→ 建议抽公共函数
- 其余（hooks 顺序、notFound 早返回位于全部 hooks 之后、saveData 失败不乐观更新等）处理得当

---
合计：P0 = 0，P1 = 0，P2 = 16；复用候选 = 1（salaryText ×4 处）


### report-077-078.md

# 代码审查报告 077-078（前端批次）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、严重级别、报告模板）
范围：batch 077 + 078 共 16 个前端文件（alliance 模块 9 个、evaluation 模块 5 个、公共组件 2 个）

## `apps/edu/components/alliance/enterprise-detail-view.tsx`（362 行）
- 完整逐行检查：完成
- 未发现问题（纯展示组件：PhotoGrid/ContactRow/EnterpriseDetailView 均无副作用；PhotoGrid 使用 idx 作 key，照片列表为静态 props 数组，可接受）

## `apps/edu/components/alliance/enterprise-profile-form.tsx`（254 行）
- 完整逐行检查：完成
- [P2] L50-253: 与 `independent-enterprise-form.tsx` L65-233 构成字段级重复表单（同一套 EnterpriseInfo 字段：企业名称/信用代码/类型/行业/地区/成立年份/规模/联系人/邮箱/地址/Logo/封面/三组照片/二级学院/简介），仅布局分区（Separator 分区 vs 平铺）与 Input 样式不同，两处独立维护易漂移（最佳实践: 抽公共 `EnterpriseInfoFields` 区块组件，按 props 切换分区/平铺布局；注意 EnterpriseInfo 类型已在 independent-enterprise-form.tsx 定义、本文件反向 import，类型归属也应上移）
- 未发现问题之外：受控 value/onChange 模式、num() 数值转换、useSecondaryColleges 加载均处理得当

## `apps/edu/components/alliance/independent-enterprise-form.tsx`（233 行）
- 完整逐行检查：完成
- [P2] L65-232: 与 `enterprise-profile-form.tsx` L50-253 字段级重复（同上，两处表单共享全部字段，仅布局不同）（最佳实践: 同上，抽公共字段组件）
- 未发现问题之外：normalizeEnterpriseInfo 旧字段兼容（logo/creditCode → logoUrl/unifiedSocialCreditCode）处理得当

## `apps/edu/components/alliance/job-brand-dialogs.tsx`（398 行）
- 完整逐行检查：完成
- [P2] L96-103: `JobBrandRefDialog.confirm` 对选中的每个岗位逐条 `await allianceBrandApi.create`，串行发起 N 个请求，选中较多岗位时耗时线性放大且全程阻塞提交按钮（最佳实践: 改用 `Promise.all(selected.map(...))` 并行创建，或后端提供批量引用接口）
- [P2] L243-286: 编辑加载在 L257-264 已用 Promise.all 并行拉取职责/证书（处理得当），但 L248-251 单条 `portalRequest('/job/positions/' + target.positionId)` 失败时 `.catch(() => null)` 静默置空并显示"岗位不存在"，网络抖动会被误判为岗位不存在（低概率，容忍范围内，仅提示）
- 复用候选: `salaryText`（L28-33）与 public-cards.tsx L513、employer-brand-detail.tsx L61、app/portal/alliance/brands/[id]/page.tsx L64 完全重复（共 4 处，逻辑逐行相同）→ 建议抽公共 `formatSalaryRange` 工具
- 未发现问题之外：新建流程"先建草稿再 save-full 再建品牌"若最后一步失败会留下孤儿岗位草稿（小概率，容忍范围内）；onOpenChange 关闭时重置已选项处理得当

## `apps/edu/components/alliance/major-brand-detail.tsx`（420 行）
- 完整逐行检查：完成
- 未发现问题（RefSection 复用选择器结构清晰；删除按钮作为 Link 的兄弟节点而非嵌套，无嵌套交互问题；notFound 早返回位于全部 hooks 之后，hooks 顺序正确）

## `apps/edu/components/alliance/public-cards.tsx`（750 行）
- 完整逐行检查：完成
- [P2] L67/L141/L199/L239/L311/L577/L632/L700: 8 处卡片外壳 class 字符串完全重复（`group border border-[#e7e5e4] shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] hover:border-primary/30 rounded-2xl overflow-hidden bg-white h-full flex flex-col p-0 gap-0`），分布在 7 种卡片组件中，后续视觉调整需同步 8 处（最佳实践: 抽 `CardShell` 包装组件或导出一个共享 className 常量）
- 复用候选: ① 卡片外壳 class ×8 处（见上）；② `salaryText`（L513-520）与 job-brand-dialogs.tsx L28-33、employer-brand-detail.tsx L61-66、app/portal/alliance/brands/[id]/page.tsx L64-68 重复（4 处，含 null 分支返回差异）→ 建议抽公共工具
- 未发现问题之外：employerBrandOf 归一化逻辑、GradientPlaceholder 确定性取色、ExpertCard 未公开置灰分支均处理得当

## `apps/edu/components/alliance/public-list-shell.tsx`（137 行）
- 完整逐行检查：完成
- 未发现问题（纯布局壳：Tabs + MobileTabDropdown + 搜索 + 骨架屏，无状态逻辑）

## `apps/edu/components/alliance/related-object-card.tsx`（81 行）
- 完整逐行检查：完成
- 未发现问题（kindMeta 路由表清晰；coverStyle 内联背景图来自服务端 URL，无注入面；children 插槽与 Link 为兄弟节点，无嵌套交互问题）

## `apps/edu/components/alliance/talent-ranking-panel.tsx`（447 行）
- 完整逐行检查：完成
- 未发现问题（排序比较器对缺失字段按 positionCount→0 / 其余→-Infinity 兜底且同名次用 localeCompare 决胜、展开行明细、RankConfigDialog 独立加载配置均处理得当；Tabs value 对失效 activeMajor 有 currentMajor 回退保护）

## `apps/edu/components/auth-provider.tsx`（242 行）
- 完整逐行检查：完成
- [P2] L92-99: `fetchMe` 的 catch 分支对**任何**失败（含网络抖动、后端 5xx 等瞬时故障）都执行 `removeToken('portal')` 并置 error，导致瞬时故障也会使 token 失效、用户被踢回登录页重登（最佳实践: 仅对 401/403 鉴权类错误清除 token，其余错误保留登录态、仅提示重试）
- 未发现问题之外：meSeqRef 请求序号防过期响应竞态、公共页面跳过登录态请求、setActiveRole 整页刷新重建状态、hasPermission 多形态权限结构兼容均处理得当

## `apps/edu/components/chunk-error-handler.tsx`（68 行）
- 完整逐行检查：完成
- 未发现问题（unhandledrejection 监听器正确 add/removeEventListener 成对清理；ChunkErrorBoundary 仅对 ChunkLoadError 触发降级，其余错误正常向上抛）

## `apps/edu/components/evaluation/bank-form-dialog.tsx`（229 行）
- 完整逐行检查：完成
- [P2] L36-228: 与 `exam-form-dialog.tsx` L37-229 整体高度重复（约 180 行同构：批次加载 effect、5MB 封面校验上传、共建人 UserSelector、所属批次 Select、当前版本号展示、FormDialogFooter 提交），仅标题文案与 exam 的 duration 回填字段不同（最佳实践: 抽 `EvaluationBaseFormDialog` 公共表单，通过 props 区分题库/试卷场景；同时可统一本文件 L57-58 批次加载失败的静默吞错与 exam 版本 L58-59 的 reportError 不一致）
- 未发现问题之外：useEffect 的 cancelled 标志防竞态、queueMicrotask 延迟表单回填避免渲染期 setState、5MB/图片类型校验均处理得当

## `apps/edu/components/evaluation/evaluation-list-table.tsx`（190 行）
- 完整逐行检查：完成
- 未发现问题（全选/半选状态计算、草稿库禁用勾选、StatusActionBar 按状态渲染操作、sticky 操作列均处理得当）

## `apps/edu/components/evaluation/exam-center-card.tsx`（143 行）
- 完整逐行检查：完成
- 未发现问题（STATUS_META 状态映射带缺省回退；canEnter 条件（participatable && !submitted && !finished）与禁用按钮文案分支完整；已交卷显示分数处理得当）

## `apps/edu/components/evaluation/exam-form-dialog.tsx`（230 行）
- 完整逐行检查：完成
- [P2] L37-229: 与 `bank-form-dialog.tsx` L36-228 整体高度重复（同构表单，仅文案与 duration 字段不同）（最佳实践: 同上，抽 `EvaluationBaseFormDialog` 公共表单）
- 未发现问题之外：L94 `duration: exam?.duration ?? 60` 编辑时沿用已有时长、不静默重置，处理得当；批次加载失败走 reportError 比 bank 版本更规范

## `apps/edu/components/evaluation/manual-question-dialog.tsx`（320 行）
- 完整逐行检查：完成
- 未发现问题（切题库时重置已选、关闭时重置选中/搜索/类型过滤、select-all 按 filteredQuestions 计算、Checkbox 点击 stopPropagation 防冒泡、loadBankQuestions 为 useCallback 稳定引用无重复拉取循环、knowledgePoints fetchAllPages 分页拉全均处理得当）

---
合计：P0 = 0，P1 = 0，P2 = 7；复用候选 = 2（卡片外壳 class ×8 处；salaryText ×4 处）


### report-079-080.md

# 代码审查报告 079-080（frontend：评价/测评规则组件）

> 审查依据：docs/code-review/REVIEW-GUIDE.md；批次：079-frontend.json（5 文件 2465 行）、080-frontend.json（3 文件 5171 行）。
> 逐文件完整逐行阅读，行号均已用 read 工具核对。

## `apps/edu/components/evaluation/question-form-dialog.tsx`（1069 行）
- 完整逐行检查：完成
- [P1] L101 / L954-965: 高级设置「选项随机排序」`shuffleOptions` 状态只被勾选框读写，从未写入 `buildFormData`（L196-223）或任何提交数据，保存后设置不产生任何效果，用户勾选会被静默丢弃（最佳实践: 要么持久化该字段，要么移除该控件）
- [P2] L279-293: `removeOption` 在 `setOptions` 的 updater 内部调用 `setAnswer`，updater 非纯函数（副作用）；React StrictMode 下 updater 会执行两次，虽结果幂等但属反模式，可能导致双更新（最佳实践: 在事件处理器中先基于当前 state 计算 next options 与 next answer，再分别 setState）
- [P2] L196-223: 单选（single）未选择答案时 `answer` 为 `''`，`buildFormData` 会生成 `['']` 空答案并静默提交，无任何校验/提示，容易保存无正确答案的题目
- [P2] L171-176 + L606-638: `blankCount` 取 `{n}` 标记中的最大序号而非实际空位个数，若题目手动输入不连续编号（如 `{1}`、`{3}`），答案输入区会多出与实际空位不对应的输入框，且答案序号与空位错位
- 复用候选: 无（题型常量直接复用 `QUESTION_TYPES`，正确）

## `apps/edu/components/evaluation/question-preview.tsx`（94 行）
- 完整逐行检查：完成
- [P1] L34: 判断题答案在后端以 JSON 数组存储（backend `question_handler.go` 中 `Answer domain.JSONSlice`，本表单 `buildFormData` 也提交 `['true']`/`['false']`），此处 `question.answer === 'true'` 恒为 false，判断题预览必现显示「错误」（最佳实践: 按数组取值，如 `Array.isArray(answer) ? answer[0] === 'true' : answer === 'true'`）
- [P2] L30: single/essay 用 `question.answer as string` 强转，实际为数组（单元素时 React 渲染恰好正确），类型断言掩盖真实数据结构，一旦出现多元素数组会无分隔符拼接（最佳实践: 统一按 `string[]` 处理）
- 复用候选: 无

## `apps/edu/components/evaluation/random-question-dialog.tsx`（674 行）
- 完整逐行检查：完成
- [P2] L35-42: 本地重复声明 `questionTypes` 数组，与 `@/lib/types` 导出的 `QUESTION_TYPES` 常量完全重复（且顺序不同：short_answer 在 essay 之前），存在漂移风险（最佳实践: 直接引用 `QUESTION_TYPES`）
- [P2] L87: `(q.createdAt as unknown as string) || new Date().toISOString()` 对必填字段做防御性兜底并伪造当前时间，属过度防御死代码；若字段缺失应让调用方感知而非掩盖（按指南「简单优先」原则，属低价值代码）
- 复用候选: 本地 `questionTypes` 与 `@/lib/types` 的 `QUESTION_TYPES` 重复（可抽象为统一常量源）

## `apps/edu/components/evaluation-rules/bank-question-selector-panel.tsx`（578 行）
- 完整逐行检查：完成
- [P2] L109-137: 已选题目预加载的 `Promise.all(...).then(...)` 无 `cancelled`/卸载防护，组件卸载后仍会 `setQuestionCache`/`setPreloadedQuestions`（React 18 无告警但属无效更新）；且 effect 依赖含 `questionCache`/`preloadedQuestions`，加载完成后会重复运行一次（靠 early return 兜住，无循环但可读性差）
- [P2] L172-176: `handleSelectBank` 切换题库时未清空 `questionSearch`，上一个题库的搜索词会带进新题库，可能显示「没有找到匹配的题目」造成困惑（与 `handleBackToBanks` 会清空搜索的行为不一致）
- 复用候选: 无

## `apps/edu/components/evaluation-rules/constants.tsx`（45 行）
- 完整逐行检查：完成
- 未发现问题（`'use client'` 对纯常量文件非必需但无害）

## `apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx`（5048 行）
- 完整逐行检查：完成
- [P2] L456-473: `setReviewStepsAndSync` 在 `setReviewSteps` 的 updater 内部调用 `store.setReviewSteps`（副作用），updater 非纯函数；StrictMode 下会执行两次导致 store 重复写入/onChange 重复触发（最佳实践: 先算出 next 再统一提交，与 question-form-dialog 的同类问题一并治理）
- [P2] L226: `methodInstanceCounts` 恒为空对象，`getMethodInstances`（L777-784）与 L4363/L4480 的「多实例」展示分支（`instanceCount > 1`）永远不可达，属未完成的功能脚手架死代码
- [P2] L4604-4614: `showAddQuestion` 对话框全文件无任何 `setShowAddQuestion(true)` 调用，永远不会打开，属残留死代码
- [P2] L1232-1239: readOnly 模式下「编辑现场问答题」按钮未隐藏（与文档「仅浏览与勾选」不符），点击后 `handleCreateRdq`（L603-630）因 `if (readOnly) return` 静默无反馈；readOnly 门禁不完整（新增/删除/选择已隐藏，编辑未隐藏）
- [P2] L400-451: reviewSteps 外部 prop 同步 effect 依赖 `configProp.reviewSteps` + `store`，在 `incoming.length === 0` 时通过 queueMicrotask 写默认步骤回 store；若父组件对 reviewSteps 做过任何归一化（排序/裁剪字段），`lastSyncedReviewStepsRef` 与父值比较会误判 changed 并把本地编辑覆盖回默认值，属脆弱同步逻辑（当前未复现，标注风险）
- [P2] L871: 本地重新声明 `EvalPointField` 类型，与同目录 `./types.ts` L45-52 的定义完全重复，两处易漂移
- 复用候选: ①方法→字段名映射（`standardNameField`/`standardModeField`/`scoreRulesField` 三元组）在 L983-1002、L2631-2654、L3686-3709 三处重复，可提取 `getMethodFields(methodKey)` 助手；②「一键均分」（base+余数分配）逻辑在 L1017-1027（methodWeights）、L1624-1640（reviewSteps）、L2885-2895（量规 points）、L3049-3059（评分规则）、L3820-3837（评价主体）及 bank-question-selector-panel L214-230 共 6 处重复，可抽象 `distributeEvenly(total, n)`；③`EvalPointField` 与 ./types.ts 重复

## `apps/edu/components/evaluation-rules/exam-activation-config.tsx`（93 行）
- 完整逐行检查：完成
- 未发现问题（`showPicker` 带可选链调用，兼容性安全）

## `apps/edu/components/evaluation-rules/index.ts`（27 行）
- 完整逐行检查：完成
- 未发现问题（重导出类型均已在 `./types` 中定义，已核对）


### report-081-082.md

# 代码审查报告 081-082（前端）

- 批次：081-frontend（8 个文件，2146 行）/ 082-frontend（6 个文件，2441 行）
- 审查方式：read 工具完整逐行阅读，全部 14 个文件无跳读
- 结论：P0 0 个、P1 0 个、P2 15 个；复用候选 2 个
- 排除项：本批次全为前端组件，无后端专项红线涉及

---

## `apps/edu/components/evaluation-rules/shared-defs.ts`（24 行）
- 完整逐行检查：完成
- 未发现问题（纯类型定义与 @zhiyu/shared-types 再导出）

## `apps/edu/components/evaluation-rules/types.ts`（72 行）
- 完整逐行检查：完成
- 未发现问题（纯类型定义）

## `apps/edu/components/evaluation-rules/utils.ts`（7 行）
- 完整逐行检查：完成
- 未发现问题（uid/clone 小工具；uid 仅 Date.now()+3 位随机后缀，同毫秒高频调用理论可撞，按"简单优先"不报）

## `apps/edu/components/evaluation/score-config-dialog.tsx`（138 行）
- 完整逐行检查：完成
- [P2] L45-55: useEffect 内的 async IIFE 无任何 await，纯同步逻辑无需包装；且每次 open/types 变化时无条件把各题型分值重置为 '0'，若弹窗打开期间父组件更新 questions（types 引用变化），用户已输入的分值会被清空（最佳实践: 去掉 async 包装；只在 open 从 false→true 时初始化）
- [P2] L61, L69-73: Input type=number 未限制整数，可输入小数；L69-70 的 Math.floor+余数分配对小数产生非整数单题分值，且 L61 的 totalInput === 100 严格相等对小数浮点和（如 33.3+33.3+33.4≈99.9999…）不成立，合法配置可能无法提交（最佳实践: 输入校验整数或在提交时归一化取整）

## `apps/edu/components/global-api-error-handler.tsx`（34 行）
- 完整逐行检查：完成
- 未发现问题（全局错误 handler 注册/清理正确，code 优先于 status 的分支合理）

## `apps/edu/components/job/position-builder/ai-assisted-2/step3-result-table.tsx`（374 行）
- 完整逐行检查：完成
- [P2] L119, L130-141, L151-158: runAiFill 的 apply 闭包引用发起点击时渲染的 position（position.abilityBindings.map），撤销快照 snapshot（L119）同样取自点击时；若 AI 请求期间用户编辑了表格（onUpdate 更新 position），apply 会用过期数据整体覆盖新编辑，撤销也会回滚用户的编辑（前端专项"闭包过期值/异步竞态"）（最佳实践: 仿 step-basic-info 的 positionRef 模式，apply 内读取最新快照）
- [P2] L130-142: matched === 0 时 L130 已先执行 onUpdate（数据等同的全量重写），触发一次无意义父级更新；且 fills.length>0 但全部未匹配时也会走该分支（最佳实践: 将 onUpdate 移入 matched > 0 分支）
- 复用候选: L42-48 COMPETENCY_LEVELS 与 step-ability-modeling/ability-point-card/competency-standards 中的五级等级定义重复

## `apps/edu/components/job/position-builder/ai-assist-progress-dialog.tsx`（85 行）
- 完整逐行检查：完成
- [P2] L54: L18 注释契约声明"currentStep < 0 表示全部完成"，但 isDone = currentStep >= steps.length || idx < currentStep 对 currentStep<0 恒为 false，全部步骤会显示为灰色待处理而非完成态，与文档契约不符（最佳实践: 增加 currentStep < 0 的分支判断）
- [P2] L27-28: 默认 title/description 为硬编码中文，未走 t()，组件若在多语言场景使用默认文案无法翻译（当前调用方均显式传 t() 值，仅兜底生效，属一致性问题）

## `apps/edu/components/job/position-builder/step-ability-modeling.tsx`（1404 行）
- 完整逐行检查：完成
- [P2] L510-511, L533-534, L549: runAiAssist 以点击时的 bindingsSnapshot 初始化 allBindings，每个 apply 用累积的 allBindings 整体替换 position.abilityBindings；AI 运行期间用户手动新增/编辑/删除的能力点会被覆盖丢失；撤销同样恢复点击时快照，回滚运行期间的手动修改（前端专项"闭包过期值/异步竞态"）（最佳实践: apply 前用最新 positionRef 重新取 bindings 合并）
- [P2] L382-391: 职责名编辑保存时空名称即删除职责（L382-384），但仅过滤 responsibilities，未同步删除该职责下的 abilityBindings，与 handleRemoveResponsibility（L363-372 同时清理绑定的行为）不一致，保存后产生 responsibilityId 悬空的孤儿绑定（最佳实践: 与删除路径一致，同步过滤 abilityBindings）
- [P2] L609-612 + L379-390: 职责名编辑框 Escape 键（L611）调用 handleSaveEditResp() 保存而非取消；结合"空名称即删除职责"语义，用户清空名称后按 Escape 会无确认删除整个职责（最佳实践: Escape 取消编辑，空名删除前加确认）
- [P2] L107, L706-711: aiNotice 状态仅初始化为 null、setter 从未使用，L706-711 的警告条渲染为死代码
- [P2] L258/L290/L352/L523: 使用 `bind-${Date.now()}`、`resp-${now}-${random}` 等本地拼接生成临时 id，同毫秒连续操作（如快速双击添加）可能产生重复 id，导致 React key 冲突与更新错乱（最佳实践: 复用统一 uid 工具，见复用候选 2）

## `apps/edu/components/job/position-builder/step-basic-info.tsx`（1541 行）
- 完整逐行检查：完成
- [P2] L339-354, L363-371: applyPolishTarget/applyPolishAll 对 p.name/p.shortName/p.description 直接 .trim()，未判字段存在性；LLM 返回的 polish 对象缺任一字段时 undefined.trim() 抛 TypeError，中断整个 polish 应用流程（onError 通常只拦截请求错误，不拦截 apply 内异常）（最佳实践: 改用 p.name?.trim() 等可选链）
- [P2] L1364: 手动创建 file input 选择图片后 URL.createObjectURL(file) 生成的 blob URL 从未 revokeObjectURL（更换图片/关闭弹窗时旧 URL 持续占用内存，轻微泄漏）
- [P2] L1051: 任职要求列表 key={index}，删除中间行时 React 复用错位 DOM（data-focus-id 与输入框状态串行）；职责列表 L993 用 item.id 作 key，两者不一致（最佳实践: 要求行也使用稳定 id 作 key）
- 复用候选: L382/397/495/566/616/656 的 `${prefix}-${Date.now()}-${random}` 临时 id 生成，与 step-ability-modeling、step3-result-table 重复（见复用候选 2）

## `apps/edu/components/job/positions/position-list.tsx`（216 行）
- 完整逐行检查：完成
- [P2] L183: onView 硬编码路由 /job/landing/${position.id}，其余导航均基于 basePath（L136/L184/L200）；组件若在其他 basePath 场景复用，查看详情会跳到固定模块路由（最佳实践: 与编辑导航一致使用 basePath 拼接）

## `apps/edu/components/job/student/ability-point-card.tsx`（108 行）
- 完整逐行检查：完成
- 未发现问题
- 复用候选: L20-26 LEVEL_LABELS 五级等级定义与其它 3 个文件重复（见复用候选 1）

## `apps/edu/components/job/student/ability-tree.tsx`（183 行）
- 完整逐行检查：完成
- 未发现问题（弹层无 Escape 关闭、分组 O(n*m) 查找均属轻微，按"简单优先"不报）

## `apps/edu/components/job/student/cert-cards.tsx`（137 行）
- 完整逐行检查：完成
- 未发现问题（L52 CSS url() 直接内插 imageUrl 属低概率样式风险，按"简单优先"不报）

## `apps/edu/components/job/student/competency-standards.tsx`（250 行）
- 完整逐行检查：完成
- [P2] L49-62, L77, L90, L156: 分组 key 与 DOM id 均使用职责名称（g.duty = resp.name），step-ability-modeling 允许创建同名职责；同名时 map.set 覆盖导致分组合并，且 comp-sec-{name} 生成重复 DOM id，滚动监听 getElementById 只命中第一个，导航高亮/滚动定位错乱（最佳实践: 以职责 id 作为分组 key，name 仅作展示）

---

## 复用候选汇总（2 个）
1. **五级能力等级常量重复（4 处）**：step3-result-table.tsx L42-48（COMPETENCY_LEVELS）、step-ability-modeling.tsx L95-101（competencyLevels，含描述）、ability-point-card.tsx L20-26（LEVEL_LABELS，含颜色映射）、competency-standards.tsx L15-21（LEVELS，含中英文对照）各自定义了 understand→了解…expert→精通 的同一组等级，建议提取共享常量模块（label/值/英文/描述/颜色集中一处），避免四份漂移。
2. **客户端临时 id 生成模式重复（≥3 处）**：step-basic-info.tsx（L382/397/495/566/616/656）、step-ability-modeling.tsx（L258/290/352/523）、step3-result-table.tsx（L523）均手写 `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`；evaluation-rules/utils.ts 已有 uid(prefix) 但未复用。建议将 uid 上移为公共工具（如 @/lib/utils）并统一替换。


### report-083-084.md

# 代码审查报告 083-084（前端）

审查依据：docs/code-review/REVIEW-GUIDE.md；逐文件完整逐行阅读（read 工具），行号均经 read 核对。

## apps/edu/components/job/student/duty-table.tsx（252 行）
- 完整逐行检查：完成
- 未发现问题。分组/分页/弹窗逻辑正确，打开弹窗时重置页码（L107-110），无泄漏（无定时器/监听器）。

## apps/edu/components/job/student/job-card.tsx（111 行）
- 完整逐行检查：完成
- 未发现问题。纯展示组件，props 均有默认值兜底（L22-24）。

## apps/edu/components/job/student/job-home.tsx（799 行）
- 完整逐行检查：完成
- [P1] L176-181: 场景模式下对每个场景逐个调用 `taskApi.list({ scenarioId, limit: 1000 })`（Promise.all 并发，数量=场景数，场景列表 limit 1000 无上限）。场景多时一次页面加载发起几十上百个请求，且 `setLoading(true)`（L166）要等全部请求结束后才关闭 loading（L218），任一请求挂起即整页持续 loading（这些 API 调用无超时控制）。（最佳实践: 后端提供按场景批量查任务统计的接口，或列表接口一次返回任务数/知识点数）
- [P2] L531: 场景模式 stats 中 `majorCount: totalTasks`，把"任务数"赋给"专业数"，语义错误（当前 sceneStats 未展示该字段所以不可见，但作为统计对象语义混乱，jobStats 复用同一对象时若未来取用会出错）。
- [P2] L189: `taskList.forEach((t: any) =>` 使用 any 类型，依赖未声明的 `knowledgePointIds` 字段，类型安全缺失。
- 其余（定时轮播 L40-45 清理正确、筛选/排序/分页逻辑、竞态防护）未发现问题。

## apps/edu/components/job/student/knowledge-graph.tsx（206 行）
- 完整逐行检查：完成
- 未发现问题。请求带 cancelled 清理（L39-56），图谱节点/边构建逻辑（含兜底领域）正确。

## apps/edu/components/job/student/learning-path.tsx（362 行）
- 完整逐行检查：完成
- [P2] L330: `t('{n}课时', { n: task.estimatedHours })` 直接展示 `estimatedHours`，该字段为可选时可能渲染 "undefined课时"；同文件 L106 的汇总处用了 `|| 0` 兜底，此处不一致。
- 其余（滚动监听 L128-141 清理正确、场景去重排序、越界重置）未发现问题。

## apps/edu/components/job/student/overview-tab.tsx（38 行）
- 完整逐行检查：完成
- 未发现问题。

## apps/edu/components/job/student/position-header.tsx（231 行）
- 完整逐行检查：完成
- 未发现问题。收藏状态拉取带 cancelled 清理（L55-74），收藏切换有 loading 防重入（L81-91），错误有 toast 反馈。

## apps/edu/components/job/student/ranking-list.tsx（179 行）
- 完整逐行检查：完成
- 未发现问题。useSyncExternalStore + matchMedia 用法正确（含 SSR snapshot），页码在视口切换时于渲染期夹紧（L51），无空页问题。

## apps/edu/components/job/student/scene-list.tsx（181 行）
- 完整逐行检查：完成
- [P2] L169: 与 learning-path.tsx L330 相同问题，`t('{n}课时', { n: task.estimatedHours })` 无 `|| 0` 兜底，字段缺失时显示异常。

## apps/edu/components/job/student/stats-box.tsx（47 行）
- 完整逐行检查：完成
- 未发现问题。

## apps/edu/components/knowledge-graph/graph-data-context.tsx（43 行）
- 完整逐行检查：完成
- 未发现问题。

## apps/edu/components/knowledge-graph/graph-node-detail.tsx（571 行）
- 完整逐行检查：完成
- [P2] L15-19: `COURSE_TYPE_LABEL` 中 `material`/`quiz` 两个键从未被使用（节点类型只有 position/domain/unit/knowledge/course），死代码。
- [P2] L455: `t(COURSE_TYPE_LABEL[node.type])` 所在分支 `node.type` 恒为 'course'，等价于直接 `t('颗粒课')`，间接引用了上面的死键映射，维护时易误以为支持多种资源类型。
- 复用候选: GRAPH_TYPE_META（L21-30）与 knowledge-graph-view.tsx 的 TYPE_META、knowledge-graph-d3-view.tsx 的 TYPE_META_D3 三处节点类型元数据表重复（详见 knowledge-graph-view.tsx 段）。
- 其余（各节点类型的关联推导、抽屉栈 MAX_DRAWERS 裁剪、关闭/导航逻辑）未发现问题。

## apps/edu/components/knowledge-graph/knowledge-graph-d3-view.tsx（758 行）
- 完整逐行检查：完成
- [P2] L46: 类型 `GraphViewProps` 声明了 `role?: string`，组件解构（L159-169）未使用，属死字段（knowledge-graph-view.tsx L36 同样存在）。
- [P2] L197: `const filteredNodes = useMemo(() => nodes, [nodes])` 是恒等 memo，无任何价值，反而暗示存在过滤逻辑。
- [P2] L643-653: 定义了 marker `arrow-d3`，全文件无任何 `marker-end` 引用，死代码（若意图是链路箭头，应加到 linkG 的 marker-end 上）。
- 其余（escapeHtml 防 tooltip XSS L3-11 正确、ResizeObserver/监听器清理 L181-195 正确、模拟清理 L465-469 正确、tooltip 事件）未发现问题。
- 复用候选: TYPE_META_D3（L59-110）与 knowledge-graph-view.tsx 的 TYPE_META（L39-73）、graph-node-detail.tsx 的 GRAPH_TYPE_META（L21-30）三份节点类型元数据表重复；GraphViewProps 接口（L36-47）与 knowledge-graph-view.tsx L26-37 完全重复（含未使用的 role）。

## apps/edu/components/knowledge-graph/knowledge-graph-shell.tsx（120 行）
- 完整逐行检查：完成
- 未发现问题。动态加载 + 错误边界 + 视图切换结构清晰；传入 toolbarSlot 时 ViewToggle 被替换属合理设计（调用方接管）。

## apps/edu/components/knowledge-graph/knowledge-graph-view.tsx（385 行）
- 完整逐行检查：完成
- [P2] L36: 类型 `GraphViewProps` 声明 `role?: string` 未解构使用，死字段（与 d3 视图一致）。
- 复用候选: TYPE_META（L39-73）与 knowledge-graph-d3-view.tsx 的 TYPE_META_D3、graph-node-detail.tsx 的 GRAPH_TYPE_META 三份重复 —— 建议抽公共常量（label/color/bg/icon/radius/fontSize），三个文件统一引用；另有图例渲染块（本文件 L314-332 与 d3 视图 L682-696）重复（2 处，未达 3 处阈值，仅提示）。
- 其余（fitView 定时器清理、选中/高亮状态推导、节点/边布局）未发现问题。

## apps/edu/components/knowledge-graph/types.ts（13 行）
- 完整逐行检查：完成
- 未发现问题。

## apps/edu/components/lesson/course-evaluation-rules-dialog.tsx（141 行）
- 完整逐行检查：完成
- 未发现问题。已核对依赖组件 EvaluationRulesEditor 通过 useEvalRuleStore 自管状态（config 仅作初始化、每次变更经 onChange 上抛），因此本组件以 config（initialConfig 派生）传入、liveConfig 用于权重校验的模式成立，无受控/非受控丢失问题；提交前权重校验有 toast 反馈（L106-115）。


### report-085-086.md

# 代码审查报告 085-086（前端）

> 审查方式：每个文件完整逐行阅读（read 工具全量读取，行号已核对）。
> 审查指南：docs/code-review/REVIEW-GUIDE.md。仅报告，未修改任何源代码。

## `apps/edu/components/lesson/student/hybrid-modules-view.tsx`（667 行）
- 完整逐行检查：完成
- [P2] L281、L299（配合 L340）: label 被重复翻译两次：renderModuleContent 中先 `label={t(label)}`，EvalModuleCards 内部又 `{t(label)}` 与 `t(label)` 拼接方法名。当前 t() 对中文原样返回、英文未命中回退原文，结果恰好一致，但属于双重翻译的一致性问题：一旦 en 字典出现"英文键"，翻译将错乱。建议只在一处翻译，传入原文 key 或已翻译文本二选一。
- [P2] L253-257: `evalRuleConfigToMethods(ruleConfig)` 解析异常被空 catch 静默吞掉并置空 methods，导致整个评价模块直接不渲染，用户无任何提示。建议至少在异常时保留提示（如渲染"配置解析失败"占位）而非静默消失。
- [P2] L570-573: JSX 内联 IIFE 解析模块图标（`(() => { const Icon = MODULE_ICONS[...] || Lightbulb; return <Icon/> })()`），可读性差；建议改为模块级辅助函数返回元素。
- 复用候选: 无

## `apps/edu/components/lesson/student/knowledge-graph.tsx`（83 行）
- 完整逐行检查：完成
- 未发现问题（图谱构建逻辑与 scene/job 两处重复，见文末复用候选汇总）

## `apps/edu/components/partner-auth-provider.tsx`（116 行）
- 完整逐行检查：完成
- 未发现问题（catch 中 removeToken 与 portal auth-provider 既有模式一致；seq 防竞态、登录页跳过、loading 保持等处理正确）

## `apps/edu/components/platform-shell/index.ts`（15 行）
- 完整逐行检查：完成
- 未发现问题（纯 re-export 文件）

## `apps/edu/components/platform-shell/PlatformShell.tsx`（56 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/portal/footer.tsx`（91 行）
- 完整逐行检查：完成
- 未发现问题（授权院校/电话等为占位文案，属模板内容，不涉及代码缺陷）

## `apps/edu/components/portal/mobile-access-dialog.tsx`（44 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/portal/mobile-access-url.test.ts`（26 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/portal/mobile-access-url.ts`（9 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/portal/top-nav.tsx`（344 行）
- 完整逐行检查：完成
- 未发现问题（时钟 interval/visibilitychange 监听均有清理；溢出隐藏算法有界；语言/字号按钮 preventDefault 处理正确）

## `apps/edu/components/portal/yi-know-assistant.tsx`（1202 行）
- 完整逐行检查：完成
- [P2] L770-777: 聊天模式下点击推荐资源卡片仅 `setActiveTab`/`setExpandedIds` 修改状态，而内容区仍渲染 chatView，点击后无任何可见反馈（需用户手动关闭 AI 对话后才看到对应资源展开）。建议点击推荐后同步关闭对话或直接跳到对应 Tab 内容。
- [P2] L425、L1159: 使用 `t(tag)`/`t(tag.label)`（翻译结果）作为 React key，翻译相同时 key 会碰撞；建议用原始 id/索引作为 key。
- 复用候选: 无

## `apps/edu/components/providers/data-provider.tsx`（395 行）
- 完整逐行检查：完成
- [P2] L21: `parseDate` 对 truthy 但非法的日期串执行 `new Date(v).toISOString()` 会抛 RangeError（Invalid Date），接口返回异常数据时整页加载失败；建议对 isNaN 做回退。
- [P2] L160-162: `updateQuestion` 若本地 state 中找不到题目（如未预加载该题库），`q?.bankId` 为 undefined 仍会随请求提交，后端按题库归属校验时可能 400；建议找不到时显式报错。
- [P2] L237-243: `submit` 成功后 `approvalApi.create` 失败无补偿：试卷已提交但审批记录未创建，状态不一致且重试可能二次提交。建议失败时提示并引导（或后端保证原子性）。
- 复用候选: 无

## `apps/edu/components/scene/scenarios/scenario-list.tsx`（214 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/scene/student/knowledge-graph.tsx`（124 行）
- 完整逐行检查：完成
- 未发现问题（边去重、空数据回退均正确）

## `apps/edu/components/scene/student/scene-card.tsx`（132 行）
- 完整逐行检查：完成
- [P2] L17-27、L42/L45: `industryTagMap`/`professionTagMap` 仅含 default 一个条目且所有调用处都硬编码 `.default`，抽象名存实亡；建议直接提取为两个常量对象，删除 map 结构。
- 复用候选: 无

## `apps/edu/components/shared/ai-not-configured-dialog.tsx`（52 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/alliance-detail-shell.tsx`（105 行）
- 完整逐行检查：完成
- [P2] L50-57: URL 深链 `?tab=xxx` 首帧不生效：`prevUrlTab` 初始化为当前 `urlTab`，首帧同步分支 `urlTab !== prevUrlTab` 恒不成立，`activeTab` 始终取 defaultTab，只有后续 URL 变化才会同步。建议 useState 初始化时即按 urlTab 校验取值。

## `apps/edu/components/shared/approval-list-page.tsx`（361 行）
- 完整逐行检查：完成
- [P2] L41、L48: `records: any[]` 与 `mapRecord: (record: any) => T` 丢失类型约束，页面复用方传错字段结构只能运行时暴露；建议使用 `unknown` + 窄化或在泛型上约束 record 形状。
- 复用候选: 无

---

## 复用候选汇总
1. **学生端知识图谱构建逻辑 ×3**：`lesson/student/knowledge-graph.tsx`、`scene/student/knowledge-graph.tsx` 与 `job/student/knowledge-graph.tsx`（本批次外）三处均重复"根节点 → 域节点 → 知识点节点"的 GraphNode/GraphEdge 构建 + 边去重 + KnowledgeGraphShell 渲染模式，可抽象共享的图谱数据构建器（输入：根节点信息、域列表、knowledgeMap、可选课程映射），三处一并改造。


### report-087-088.md

# 代码审查报告 087-088（前端 shared 组件）

- 审查指南：docs/code-review/REVIEW-GUIDE.md（已按原则/级别/模板执行）
- 批次：087-frontend.json（12 文件，2267 行）+ 088-frontend.json（5 文件，2471 行）
- 方法：每个文件用 read 工具完整逐行阅读（大文件分段读完），行号均已核对
- 结论：P0 = 0，P1 = 1，P2 = 6，复用候选 = 1

---

## `apps/edu/components/shared/archive-list-page.tsx`（375 行）
- 完整逐行检查：完成
- [P2] L137: `colSpan = columns.length + (hasBatchOps ? 2 : 1)` 计算错误。表格实际列数 =（有批量操作时 1 个勾选列）+ columns 列 + 「状态」列 + 「操作」列 = columns.length + 3（有批量操作）或 columns.length + 2（无批量操作），而 colSpan 恒比实际少 1 列。加载中/空列表行（L272、L281）的单元格少跨一列，表格末尾出现多余空列，视觉错位（最佳实践: colSpan 应改为 columns.length + (hasBatchOps ? 3 : 2)）

## `apps/edu/components/shared/batch-group-page.tsx`（557 行）
- 完整逐行检查：完成
- [P2] L188-192: 批次编号 `'BG-' + 年份 + Math.floor(Math.random()*10000)` 纯前端随机生成，同年内每 10000 次创建就约有重复风险；重复编号会破坏编号唯一性，用户按编号检索时可能混淆（最佳实践: 改由后端生成并加唯一约束，或至少校验已存在编号）

## `apps/edu/components/shared/batch-selector.tsx`（68 行）
- 完整逐行检查：完成
- 未发现问题（注：L40-45 useEffect 依赖 `batchApi` 对象引用，若调用方内联传入新对象会反复请求；已核实当前 4 处使用方均传入稳定的模块级 API 对象，暂不构成问题）

## `apps/edu/components/shared/brand-relation-select.tsx`（90 行）
- 完整逐行检查：完成
- [P2] L75 与 L81-85: 当 `optional=true` 且选项为空时，L75 先渲染一个 `value="__none"` 的「不关联」SelectItem，L81-85 又渲染一个 disabled 的 `value="__none"`「暂无选项」SelectItem，两个 SelectItem 值重复；Radix Select 遇到重复 value 会同时高亮/标记两个条目，选择行为异常（最佳实践: 空态占位应在 `!optional` 时才渲染，或复用同一 `__none` 条目）

## `apps/edu/components/shared/captcha-input.tsx`（126 行）
- 完整逐行检查：完成
- 未发现问题（用 ref 持有 onError/t 避免父组件 re-render 反复拉取验证码的设计正确；object URL 无使用）

## `apps/edu/components/shared/citation-stats-panel.tsx`（180 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/co-build-collaborator-picker.tsx`（210 行）
- 完整逐行检查：完成
- [P2] L43-54: `loadOptions` 以 `options !== null` 做缓存，若 `schoolTenantId` 属性变化（切换到另一所合作学校），不会重新拉取，弹窗仍显示旧租户的共建人候选，提交时会把旧租户用户写进 collaborators；加载失败时 catch 静默置空无提示（最佳实践: 依赖 schoolTenantId，变化时清空 options 重新加载）

## `apps/edu/components/shared/combobox-select.tsx`（3 行）
- 完整逐行检查：完成
- 未发现问题（re-export `@zhiyu/ui`）

## `apps/edu/components/shared/_components/approval-dialogs.tsx`（315 行）
- 完整逐行检查：完成
- [P2] L144-154 / L156-167: `confirmApprove`/`confirmReject` 内 `await onApprove(comment)`（L148）与 `await onReject(comment.trim())`（L161）没有 try/catch，仅 finally 复位 submitting；若父组件传入的回调 reject（接口失败），会产生未处理的 Promise rejection，且对话框保持打开、用户得不到任何失败提示（最佳实践: 包一层 catch，失败时 toast 提示并保持弹窗）

## `apps/edu/components/shared/_components/org-filter-tree.tsx`（143 行）
- 完整逐行检查：完成
- 未发现问题（折叠按钮 stopPropagation 正确；递归 TreeRow key 正确）

## `apps/edu/components/shared/_components/workflow-editor.tsx`（185 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/confirm-dialog.tsx`（3 行）
- 完整逐行检查：完成
- 未发现问题（re-export `@zhiyu/ui`）

## `apps/edu/components/shared/content-list-page.tsx`（2130 行）
- 完整逐行检查：完成
- [P1] L720-734: `handleBatchDelete` 遍历 `selectedIds` 无条件执行 `itemApi.delete(id)`，未像批量归档（L763-780，逐项校验 `['draft','rejected','approved','published']`）那样按状态过滤；且批量删除没有任何确认弹窗。按钮可用性由 `canBatchDelete`（L596-598，`.some` 仅需一项可删）控制，一旦勾选混含已发布/审批中资源，点击「删除」会对所有选中项执行删除。若后端不强制状态校验即造成已发布内容误删（核心内容管理流程，数据损坏风险）；即使后端拦截，也会逐项弹失败提示、静默部分失败，体验混乱（最佳实践: 与 handleBatchArchive 一致逐项过滤可删状态，并在执行前弹 ConfirmDialog 确认）
- [P2] L1665-1675: Excel 批量导出未检查 `res.ok`，接口失败（4xx/5xx 返回错误 JSON）时直接 `downloadBlob(await res.blob(), ...)`，用户会下载到一个内容为错误信息的 .xlsx 文件；CSV 导出路径（L816-819）已显式处理非 2xx 并抛出带 message 的错误，此处处理不一致（最佳实践: 与 CSV 路径一致先检查 res.ok，失败时解析错误 JSON 并 toast）

## `apps/edu/components/shared/cover-image-upload.tsx`（138 行）
- 完整逐行检查：完成
- 未发现问题（object URL 在 finishEdit 中 revoke；input value 重置允许重复选择同一文件）

## `apps/edu/components/shared/date-input.tsx`（24 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/date-range-picker.tsx`（116 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/detail-page-header.tsx`（58 行）
- 完整逐行检查：完成
- 未发现问题

---

## 复用候选汇总
1. 「专业筛选 + 可选列表」区块重复 ≥3 处：content-list-page.tsx 的 `renderBatchSelector`（L1249-1300）、`renderWorkflowSelector`（L1302-1329）与 batch-group-page.tsx 的 `renderForm` 中的审批流选择列表（L289-338）均为「专业 Tab/Select 过滤 + 可点选列表行 + 选中高亮」的相同结构（含 max-h 滚动、border-b 行、Check 标记），可抽象为公共 `BatchSelectList` 组件统一接收 `options/filter/value/onChange`，三处替换。


### report-089-090.md

# 代码审查报告 089-090（frontend 批次）

审查依据：docs/code-review/REVIEW-GUIDE.md（完整逐行阅读、严重级别 P0/P1/P2、后端专项红线、前端专项）
批次：089-frontend.json（15 文件）、090-frontend.json（4 文件）
审查方式：每个文件经 read 工具完整逐行阅读（大文件分段补读），行号均已核对。

---

## apps/edu/components/shared/editor-shell.tsx（261 行）
- 完整逐行检查：完成
- 未发现问题。纯展示型编辑器外壳组件（全屏/内联两种模式、步骤徽标、保存/预览/上一步/下一步/提交按钮、移动端下拉菜单），无状态副作用、无定时器、无数据访问。

## apps/edu/components/shared/error-state.tsx（3 行）
- 完整逐行检查：完成
- 未发现问题。仅从 @zhiyu/ui 转发导出 ErrorState。

## apps/edu/components/shared/eval-method-card.tsx（579 行）
- 完整逐行检查：完成
- [P2] L332: 提交载荷中 `maxScore: 100` 硬编码，未读取 `resourceConfig` 中配置的分值；若服务端以 payload.maxScore 为准，配置了其他满分的测评会得到错误的分值口径（建议改为 `resourceConfig.maxScore ?? 100` 或由服务端按方法配置计算）。
- [P2] L166/L169: `t(getEvalMethodLabel(...))` 传的是中文标签原文（EVAL_METHOD_LABELS 的 value），依赖"中文即 key"的约定，若 EVAL_METHOD_LABELS 未来改为英文值会失效；建议 t() 与 label 取值职责分离（低价值，可维护性提示）。
- 复用候选: L76-124 的 methodIconMap/methodActionText/methodDescMap/methodBgMap/methodBorderMap 与 eval-method-selector.tsx L33-154 的 EVALUATION_METHOD_OPTIONS、evaluation-rules/constants.tsx L6-11、@/lib/types 的 EVAL_METHOD_LABELS/EVAL_METHOD_COLORS 重复维护同一套测评方法元数据（≥3 处），建议统一为单一配置源（label/desc/icon/color/action/bg/border 合一）。

## apps/edu/components/shared/eval-method-config-module.tsx（112 行）
- 完整逐行检查：完成
- 未发现问题。value 缺失时 useMemo 生成默认配置（JSON 深拷贝 DEFAULT_EVAL_RULE_SUBJECTS 防共享引用），受控 onChange 透传，无竞态/泄漏。

## apps/edu/components/shared/eval-method-selector.tsx（304 行）
- 完整逐行检查：完成
- 未发现问题。纯展示分类选择器（平台/行业两级 tab、可用/未开通态、互斥切换），toggleMethod 对不可用项短路，无副作用。
- 复用候选: 见 eval-method-card.tsx 段落（EVALUATION_METHOD_OPTIONS 与多处测评方法元数据重复）。

## apps/edu/components/shared/exam-grading/question-grading-card.tsx（363 行）
- 完整逐行检查：完成
- [P2] L156: `useState(score.toString())` 仅在首次挂载时同步父组件 score；若父组件在外部更新该题分数（如"批量给满分/自动评分后回填"），本地输入框显示不刷新，仍为旧值（建议对 score 增加 useEffect 同步或由父组件 key 重挂载）。
- [P2] L324/L347/L353: 对学生答案/正确答案等动态文本调用 `t(getAnswerLabel(...))`，en 环境下会以整段学生答案作字典 key 查询（未命中回退原文），语义不当但无害；建议动态内容直接渲染、仅静态文案走 t()。
- 注：多选题仅全对给满分、无部分得分，属设计取舍；答案归一/判分逻辑（L22-66）自洽。

## apps/edu/components/shared/favorite-button.tsx（118 行）
- 完整逐行检查：完成
- 未发现问题。状态拉取 effect 带 cancelled 竞态防护；切换按钮 loading 防抖防连点；未登录点击仅 toast 提示；无泄漏。

## apps/edu/components/shared/form-field-row.tsx（105 行）
- 完整逐行检查：完成
- 未发现问题。FormFieldRow/FormFieldGrid/IconInput/FieldValue 均为无状态展示组件，结构注释清晰。

## apps/edu/components/shared/form-page-shell.tsx（54 行）
- 完整逐行检查：完成
- 未发现问题。无状态布局组件（返回按钮、标题、两栏网格、页脚插槽）。

## apps/edu/components/shared/hover-action-bar.tsx（3 行）
- 完整逐行检查：完成
- 未发现问题。仅从 @zhiyu/ui 转发导出 HoverActionBar。

## apps/edu/components/shared/image-editor-dialog.tsx（100 行）
- 完整逐行检查：完成
- [P2] L46/L78: `loaded` 状态在弹窗关闭后不重置（DialogContent 卸载的是编辑器、不是该状态）；再次打开时 ImageEditor 重新加载脚本但"编辑器加载中..."遮罩不再显示（loaded 仍为 true），加载期间出现短暂空白，属轻微 UX 回归。建议 onOpenChange 置 false 时重置 loaded。

## apps/edu/components/shared/image-list-upload.tsx（306 行）
- 完整逐行检查：完成
- [P2] L102-107: `addUrl` 基于闭包 `value` 构造新数组，而并发上传路径（L50-63）刻意用 `valueRef` 避免旧值覆盖；若上传进行中（valueRef 已更新、父组件尚未重渲染）用户同时添加 URL，会以旧 value 覆盖丢并发条目。建议 addUrl 同样基于 valueRef.current 构造。
- 注：多文件上传队列（queueRef）+ 编辑器串行处理 + blob URL revoke（L94/L228）逻辑正确，无泄漏；上传失败不降级 blob（L53-54）处理得当。
- 复用候选: 文件内 ImageListUpload（L30-180）与 SingleImageUpload（L183-306）的"上传中状态/编辑弹窗接线/finishEdit/URL 直填"逻辑高度重复（2 组件，接近阈值），建议抽公共 hook（如 useImageUploadFlow）。

## apps/edu/components/shared/image-upload-utils.ts（12 行）
- 完整逐行检查：完成
- 未发现问题。GIF/SVG 直传、HEIC/HEIF 拦截判定简单明确。

## apps/edu/components/shared/import-confirm-dialog.tsx（4 行）
- 完整逐行检查：完成
- 未发现问题。仅从 @zhiyu/ui 转发导出 ImportConfirmDialog。

## apps/edu/components/shared/import-wizard-dialog.tsx（4 行）
- 完整逐行检查：完成
- 未发现问题。仅从 @zhiyu/ui 转发导出 ImportWizardDialog。

## apps/edu/components/shared/knowledge-selector.tsx（1213 行）
- 完整逐行检查：完成
- [P2] L182-185: dataSource.listKnowledgePoints 路径只取第一页（limit 200, offset 0），而默认 API 路径（L193）经 fetchAllPages 全量分页；学校/企业只读数据源知识点超过 200 条时，场景/岗位筛选结果会遗漏（两路径行为不一致）。
- [P2] L408-424: 编辑知识点仅更新 `selected` 数组，pool/searchResults 中同 id 的旧数据不更新（L421 setAllKps(null) 只失效懒加载缓存，pool 是 prop 不受影响），左栏列表仍显示旧名称/旧描述，保存后界面不一致。
- [P2] L783-786: readOnly（只读数据源）模式下，右侧"已选择"卡片仍渲染删除按钮并调用 handleRemoveKp→onChange；若父组件未对只读场景忽略变更，会破坏只读语义。
- [P2] L138-152/L155-173: 组件挂载即拉取全部颗粒课、岗位、场景（fetchAllPages 多页顺序请求），即使选择器/弹窗从未打开；含选择器的表单页会无谓增加多个往返请求（建议挂载到弹窗打开/首次聚焦时再加载）。
- [P2] L318-340: 岗位筛选对每个场景并发发起任务请求（Promise.all 无并发上限），岗位下场景数多时产生请求风暴（建议限流或按需分批）。
- [P2] L35-37: generateKpCode 取 Date.now() 后 6 位，相近时间创建易撞码；若后端对 code 有唯一约束，撞码导致创建失败（低概率，可加随机后缀）。
- 注：搜索/筛选均有 seq 序号防护丢弃过期响应（L207-235/L262-340）、fetchAllPages 分页正确、对象 URL 无泄漏，整体健壮。

## apps/edu/components/shared/landing-filter-row.tsx（131 行）
- 完整逐行检查：完成
- [P2] L7-65: ACCENT_CLASSES 主题色映射与 landing-pagination.tsx L7-42 重复定义（结构略异：selected/unselected/expand/border vs active/hover），新增/修改主题色需同步两处；仅 2 处未达复用候选阈值，建议抽取统一主题令牌。
- 注：overflow 检测（L89-92）仅在 items 变化时测量、窗口 resize 不复测且 expanded 不自动收起，属轻微 UX，不报。

## apps/edu/components/shared/landing-pagination.tsx（117 行）
- 完整逐行检查：完成
- [P2] L7-42: 与 landing-filter-row.tsx L7-65 重复的 ACCENT_CLASSES 映射（见上条），建议统一。
- 注：页码省略算法（L65-78）边界正确（totalPages<=7 全显、首尾/中间省略分支无重复页码），上一页/下一页禁用态正确。

## apps/edu/components/shared/landing-shell.tsx（291 行）
- 完整逐行检查：完成
- 未发现问题。Hero/统计条/筛选卡/工具栏/计数/页脚统一骨架，scrollToList 使用 listRef 或内部 ref，LandingSkeleton/LandingEmpty 无状态；统计值 toLocaleString 对 string 原样返回，无异常。


### report-091-092.md

# 代码审查报告 091-092（frontend）

- 审查范围：/tmp/batches/091-frontend.json（10 文件，2092 行）+ /tmp/batches/092-frontend.json（4 文件，1678 行），全部为 apps/edu/components/shared/ 下组件
- 审查方式：每个文件用 read 工具完整逐行阅读（learn-page.tsx 因工具输出截断，已分段补读中间区段），行号均经 read 核对
- 指南依据：docs/code-review/REVIEW-GUIDE.md（前端专项：明显 bug / 内存泄漏 / 错误处理误导 / 重复组件 / 敏感信息）

## `apps/edu/components/shared/learn-page.tsx`（873 行）
- 完整逐行检查：完成
- [P2] L196/L205/L212: aggregate useMemo 中计算的 `pendingCount`（L196 初始化、L205 累加、L212 返回）在 JSX 中从未使用，属于死代码（最佳实践: 移除未使用字段，或按格式函数展示待评数量）
- [P2] L72/L537/L748: `LearnUnit.resources` 类型声明为 `{ id; name; type; size? }` 缺少 `url` 字段，但实际运行时数据为含 `url` 的 `TaskResource`（场景页 L254-256 直接塞入），导致 L537/L748 两处只能以 `as any` 绕过类型（最佳实践: 类型声明补上 url 字段，消除 `as any`）
- 其余检查项（状态清空、闭包、key、错误处理、资源预览去重、测评提交乐观状态）未发现问题

## `apps/edu/components/shared/log-table-shell.tsx`（99 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/major-select.tsx`（102 行）
- 完整逐行检查：完成
- [P2] L56-60: 异步竞态——成功路径 L54 有 `seq !== loadSeqRef.current` 过期请求丢弃，但 catch（L57 setError）与 finally（L59 setLoading(false)）未做同样的序号校验。tenantId 快速切换时，过期请求的失败会把错误态错误设置到新租户上（错误信息误导），过期请求的 finally 也会把新请求的 loading 提前复位（最佳实践: catch/finally 内同样先校验 `seq !== loadSeqRef.current` 再更新状态）

## `apps/edu/components/shared/mobile-tab-dropdown.tsx`（110 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/multi-org-node-picker.tsx`（407 行）
- 完整逐行检查：完成
- 未发现问题（注：L336 `orgLoading || !tenantId` 在 tenantId 缺省时永久转圈属调用方契约，按指南"小概率异常宁可容忍"不报）
- 复用候选: L108-125 内联的展开/收起按钮与同文件 L377-406 导出的 `OrgTreeNodeToggle` 完全重复，且 org-node-picker.tsx L94-111 还有第三份拷贝——共 3 处实现同一交互（chevron 折叠按钮），建议统一收敛为 `OrgTreeNodeToggle` 单一实现并两文件共用

## `apps/edu/components/shared/org-node-picker.tsx`（298 行）
- 完整逐行检查：完成
- [P2] L63: `selectableTypes` 匹配语义与 multi-org-node-picker.tsx L43/L89 不一致——此处用精确匹配 `selectableTypes.includes(typeName)`，multi 版用子串匹配 `typeName.includes(t)`。同一批类型配置在两个组织选择器中的可选性结果可能不同（如 selectableTypes 传 '班级' 而 typeName 为 '行政班级' 时多选器可勾选、单选器不可选），建议统一匹配规则（最佳实践: 提取共享的组织类型匹配工具函数）
- 复用候选: L94-111 内联展开/收起按钮为第三份拷贝（同 multi-org-node-picker 复用候选）

## `apps/edu/components/shared/page-header-card.tsx`（66 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/pagination-bar.tsx`（44 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/permission-guard.tsx`（36 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/platform-layout.tsx`（47 行）
- 完整逐行检查：完成
- [P2] L22-36: 未登录用户访问受保护页面时的误导性闪屏——L28 `allowed = !loading && !!user && ...` 在未登录时为 false，渲染层先展示 PermissionGuard 的"当前角色暂无权限访问该页面，请联系管理员在角色权限中开通"文案（L36），随后 useEffect（L22-26）才异步 `router.replace('/portal/login')` 跳转。对未登录用户而言"联系管理员开通权限"是错误引导（最佳实践: 未登录且非 landing 时直接渲染登录跳转或加载态，不进入 PermissionGuard 无权限分支）

## `apps/edu/components/shared/portal-crud-page.tsx`（543 行）
- 完整逐行检查：完成
- 未发现问题（保存/开关/删除均先操作成功再刷新列表，刷新失败不误报操作失败，符合指南要求）

## `apps/edu/components/shared/portal-sidebar-crud-page.tsx`（640 行）
- 完整逐行检查：完成
- [P2] L434-441: 表头全选 Checkbox 只传布尔 checked，缺少"部分选中"indeterminate 态；portal-crud-page.tsx L383-389 同场景已实现 `someSelected ? 'indeterminate' : allSelected`，两处行为不一致（最佳实践: 对齐 indeterminate 表现，L289-290 已具备 someSelected 判定所需信息）
- 其余检查项（批量加入防重复提交、删除/导入/导出错误处理、弹窗状态清空）未发现问题

## `apps/edu/components/shared/reset-password-dialog.tsx`（139 行）
- 完整逐行检查：完成
- 未发现问题（密码仅通过 API 提交、无日志/console 输出；打开时清空旧输入；提交错误明确提示）

## `apps/edu/components/shared/resource-preview-modal.tsx`（352 行）
- 完整逐行检查：完成
- 未发现问题（signUrl 竞态有 cancelled 标志防护；拖拽/缩放监听器随 effect 清理；外链按钮受 isSafeExternalUrl 约束；hook 顺序一致，条件返回在全部 hook 之后）


### report-093-094.md

# 代码审查报告 093-094（前端 shared 组件 / hooks / lib）

> 依据 docs/code-review/REVIEW-GUIDE.md 执行。逐文件完整逐行阅读（无跳读），行号均经 read 工具核对。
> 本批次全部为前端代码，后端专项红线不适用；仅涉及前端专项与性能/稳定性检查项。

---

## `apps/edu/components/shared/resource-selector.tsx`（943 行）
- 完整逐行检查：完成
- [P1] L140: `resourceLibraryApi.list({ limit: 1000 })` 请求资源库列表，但后端 `parseLimitOffset`/store 统一把 limit 钳制到 maxPageSize=200（backend/internal/store/query.go L521-522），资源库超过 200 条时选择器静默截断，第 200 条之后的资源无法被搜索/选择。项目其他位置（如 use-resource-maps.ts、user-selector.tsx）均用 `fetchAllPages` 分页合并规避该上限（packages/api-client/src/fetch-all.ts 注释明确说明）（最佳实践: 改用 `fetchAllPages((p, ps) => resourceLibraryApi.list({ limit: ps, offset: p * ps }))` 全量拉取或改为服务端搜索/分页）
- [P2] L263-272 与 L371-380: 本地定义 `fileTypes` 与 `fileTypesWithUpload` 两个数组，内容完全相同（document/spreadsheet/image/audio/video/archive/other/software），且 `apps/edu/lib/resource-type-constants.tsx` L310 已导出同名 `fileTypesWithUpload`，本文件却重复定义（复用候选）
- [P2] L219-230: 本地 `validateResourceFile` 与 `resource-type-constants.tsx` L323 导出的 `validateResourceFile` 重复实现（仅多了 i18n 文案），应复用导出函数（复用候选）
- [P2] L307-357: `useApi && apiAvailable` 不成立时（资源库加载失败但文件上传成功）走本地分支，新资源用 `res-1786641853335` 本地 id（L295），未加入 mergedPool，选中后侧栏/徽标无法回显名称；且 L364 仍弹「资源已上传并选中」成功提示，实际资源并未入库，父组件保存表单会提交一个不存在的资源 id（API 异常边缘场景，但成功提示有误导性）
- 复用候选: 与 apps/edu/lib/resource-type-constants.tsx 重复 fileTypesWithUpload 数组与 validateResourceFile 函数

## `apps/edu/components/shared/schedule-grid.tsx`（286 行）
- 完整逐行检查：完成
- [P2] L143-155 + L178-197: 当 `onEntryClick` 与 `onEntryMoveStart` 同时传入时（props 注释 L36-37 明确支持两者共存），卡片内的铅笔编辑按钮（L144-155，`<button>`）会嵌套进外层 `<Link>`（L180，`<a>`）或外层 `<button>`（L187）内，构成嵌套交互元素（无效 HTML，可能引发浏览器行为异常）；且卡片 onClick 的 `e.stopPropagation()`（L121）会阻止点击事件冒泡到外层 Link，导致 `getEntryHref` 的跳转永远无法通过点击卡片触发。当前无调用方同时传这两个 props（已核实 3 处调用方），属潜在缺陷（最佳实践: 铅笔按钮改用 `e.stopPropagation()` 已无法解决嵌套问题，应重构卡片渲染，避免外层再包 button/Link，或由调用方约定互斥）
- 其余未发现问题

## `apps/edu/components/shared/search-input.tsx`（4 行）
- 完整逐行检查：完成
- 未发现问题（纯 re-export @zhiyu/ui 的 SearchInput）

## `apps/edu/components/shared/status-action-bar.tsx`（286 行）
- 完整逐行检查：完成
- 未发现问题（onApprove/onReject 已注释为仅保留接口兼容、不再渲染，符合设计）

## `apps/edu/components/shared/status-badge.tsx`（3 行）
- 完整逐行检查：完成
- 未发现问题（纯 re-export）

## `apps/edu/components/shared/table-row-actions.tsx`（3 行）
- 完整逐行检查：完成
- 未发现问题（纯 re-export）

## `apps/edu/components/shared/tag-badge.tsx`（23 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/tag-filter-bar.tsx`（117 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/tag-input.tsx`（66 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/tag-picker.tsx`（51 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/theme-color-picker.tsx`（118 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/uncited-resources-dialog.tsx`（349 行）
- 完整逐行检查：完成
- [P2] L176-197: 批量删除用 `Promise.all([...selected].map(deleteItem))` 并发执行，部分失败时 catch 分支（L187-192）不刷新列表：已删除项仍显示、selected 未清空，`total - selected.size`（L183）的下一页计算也会失真；下次重试会对已删除项再次调用 delete（可能 404）。建议失败时也调用 load 刷新（最佳实践: 无论成败都在 finally 后重载当前页，或改用逐条失败统计后统一刷新）

## `apps/edu/components/shared/user-selector.tsx`（672 行）
- 完整逐行检查：完成
- [P2] L211-255: `loadUsers` 每次打开弹窗/切换组织/搜索变化都会 `fetchAllPages` 全量拉取用户（L226-228），无搜索词时把租户全部用户串行分页拉完（大租户数千人时为 50+ 次请求），而 excludeStudent/excludeUserIds 均为客户端过滤（L231-237）；虽非核心接口允许慢，但与 use-portal-users 等服务端过滤模式不一致，建议将 excludeStudent 下沉为服务端参数或限制拉取量（最佳实践: 让后端支持 excludeStudent/excludeUserIds 过滤，或改为服务端搜索分页）
- 其余未发现问题（loadSeqRef 过期响应丢弃、fetchAllPages 防截断、专家名字缓存等处理得当）

## `apps/edu/components/shared/use-tag-bindings.ts`（51 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/components/shared/use-tags.ts`（73 行）
- 完整逐行检查：完成
- [P2] L39/L67-70: `reload()`（标签管理页增删改后调用）置 cachedTags=null 并 emitChange 后，订阅方 effect 重新拉取期间 `loading` 不会重置为 true（仅首次挂载时初始化），期间 UI 无加载态；且首次请求失败时 cachedTags 保持 null、loading 变 false，标签筛选栏会误显示「暂无标签，请先在标签管理」引导文案（L48-58 分支），直到下次 reload 才恢复（最佳实践: reload 内同时置 loading 状态或在 effect 拉取开始时 setLoading(true)，失败时保留提示而非静默降级为空列表）

## `apps/edu/components/shared/workflow-config-page.tsx`（371 行）
- 完整逐行检查：完成
- [P2] L76: `workflowApi.list({ limit: 1000 })` 同样会被后端 maxPageSize=200 钳制，审批流程超过 200 条时列表静默截断（最佳实践: 用 `fetchAllPages` 或服务端搜索，与项目其他列表一致）
- 其余未发现问题

## `apps/edu/components/shared/zip-preview.test.ts`（107 行）
- 完整逐行检查：完成
- 未发现问题（测试覆盖 isZipUrl 大小写/查询串行为、mac 风格 zip 文件名乱码修复、GBK 解码等；其中「`?x=1` 查询串视为非 zip」为明确的设计行为断言）

## `apps/edu/components/shared/zip-preview.tsx`（284 行）
- 完整逐行检查：完成
- [P1] L100-114: 仅校验压缩包（压缩后）大小 ≤50MB，未限制解压后内容总大小。zip 炸弹（如 1MB 压缩包解压出数 GB 数据）经 `unzipSync` 全量解压进内存，可致预览者浏览器卡死/崩溃。资源库上传允许用户上传 zip（resource-type-constants.tsx ARCHIVE_EXTS 含 zip），他人预览时即触发，属客户端 DoS/稳定性隐患（最佳实践: 解压后累计 `data.length` 超过上限（如 200MB）即中止并提示下载后本地解压）
- [P2] L105: `unzipSync` 为同步解压，50MB 压缩包解压期间阻塞主线程（UI 冻结数秒）。可接受但建议对超大包提示或改用异步解压（fflate unzip 的异步版本）
- 其余未发现问题（blob URL 创建/撤销管理正确，卸载时 revoke）

## `apps/edu/components/theme-brand-sync.tsx`（57 行）
- 完整逐行检查：完成
- 未发现问题（fetchAndApplyBrandColor 内部经 fetchThemeColor 捕获所有异常（lib/theme-brand.ts L43-53），无未处理 promise rejection；storage/事件监听均正确清理）

## `apps/edu/components/theme-provider.tsx`（7 行）
- 完整逐行检查：完成
- 未发现问题（next-themes 包装）

## `apps/edu/contexts/portal-auth-context.tsx`（6 行）
- 完整逐行检查：完成
- 未发现问题（re-export）

## `apps/edu/hooks/use-approvals.ts`（203 行）
- 完整逐行检查：完成
- [P2] L42-45: `UseApprovalsOptions.limit` 接口字段声明但从未解构/使用（死选项），建议删除或实现
- 其余未发现问题（fetchAllPages 防截断、Promise.allSettled 批量审批、权限拒绝提示等处理得当）

## `apps/edu/hooks/use-font-scale.ts`（81 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/hooks/use-import-flow.ts`（4 行）
- 完整逐行检查：完成
- 未发现问题（re-export）

## `apps/edu/hooks/use-org-tree.ts`（116 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/hooks/use-paged-list.ts`（64 行）
- 完整逐行检查：完成
- [P2] L31-36: 文档注释声称「搜索切换时自动回到第 1 页」，但实现（L41-47）只在 `setSearch` 时更新 search，并未重置 page；当前各调用方（如 alliance/experts/page.tsx L71-74）在 onSearchChange 里手动 `list.setPage(1)` 补偿，但未来新调用方若按注释依赖该行为，会在非首页搜索时看到错误分页/空结果（最佳实践: 在 setSearch 包装函数里同时 `setPage(1)`，或修正文档注释）

## `apps/edu/hooks/use-portal-users.ts`（87 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/hooks/use-secondary-colleges.ts`（21 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/hooks/use-submitter-names.ts`（42 行）
- 完整逐行检查：完成
- [P2] L22-24: 每次挂载都 `fetchAllPages` 全量拉取租户全部用户（无任何过滤参数），大租户下请求量大且仅在挂载时拉取一次，后续新增用户不会刷新（依赖调用方自行处理）；属性能/一致性提示（最佳实践: 按需只拉取涉及的 userId 集合，或提供刷新机制）

## `apps/edu/hooks/use-subscription-modules.ts`（41 行）
- 完整逐行检查：完成
- 未发现问题（接口失败保持 null 跳过套餐校验的设计合理，不会把失败态变成最严拦截态）

## `apps/edu/lib/active-role.ts`（42 行）
- 完整逐行检查：完成
- 未发现问题

## `apps/edu/lib/ai/use-ai-assist.ts`（207 行）
- 完整逐行检查：完成
- 未发现问题（AbortController 取消、串行流水线、快照历史/恢复逻辑正确；flash 定时器为一发即清的短时计时器，无泄漏）

---

## 汇总
- P0: 0
- P1: 2（resource-selector.tsx L140 资源库 200 条静默截断；zip-preview.tsx L100-114 解压无总大小上限）
- P2: 12
- 复用候选: 2（resource-selector.tsx 与 resource-type-constants.tsx 重复的 fileTypesWithUpload 数组、validateResourceFile 函数）


### report-095-096.md

# 代码审查报告 批次 095-096（frontend）

审查依据：docs/code-review/REVIEW-GUIDE.md（逐行完整阅读，行号经 read 核对）。
批次 095：23 个文件（2461 行）；批次 096：11 个文件（2597 行）。均为 apps/edu/lib 下工具/配置/转换类代码。
结论：未发现 P0/P1 问题；P2 共 6 处；复用候选 4 处。

---

## `apps/edu/lib/alliance-dicts.ts`（115 行）
- 完整逐行检查：完成
- [P2] L47-53: fetchAllianceDict 的失败结果同样被写入模块级 cache（catch 返回 [] 后 cache.set 存入该 promise）。一次瞬时网络错误后，本会话内该字典类型恒为空数组（表单下拉选项为空、列表/详情展示标签回退），即使后续网络恢复也不再重试。建议失败时不缓存（在 catch 中 delete cache key），或仅成功结果入缓存并带 TTL。
- 未发现其他问题（module 级缓存跨页面共享、useEffect 取消标记、mergeDictOptions 存量值回填等实现均正确）。

## `apps/edu/lib/alliance-links.ts`（38 行）
- 完整逐行检查：完成
- [P2] L18-31: 对每个新增/移除的项目串行执行 get+update（共 2×N 次 API 往返），项目数多时请求量大；且中途任一项目失败即中止，无补偿——已写入的项目的 agreement_ids 与协议的 project_ids 出现不一致（部分同步）。建议批量端点，或失败时重试并对未完成部分给出提示/补偿。

## `apps/edu/lib/changelog-content.ts`（396 行）
- 完整逐行检查：完成
- 未发现问题（纯静态变更记录 Markdown，无逻辑）。

## `apps/edu/lib/converters/job-converters.test.ts`（227 行）
- 完整逐行检查：完成
- 未发现问题（用例覆盖基础映射/截断/salaryRange 映射/反向映射/空值清理，断言与实现一致）。

## `apps/edu/lib/converters/job-converters.ts`（171 行）
- 完整逐行检查：完成
- [P2] L35: salaryRange 由 salaryMin/salaryMax 各自独立取 `?? 0`，当只填最低工资（salaryMax 缺失）时产生 [8000, 0] 的非法区间，展示层可能出现"最高 0 元"。建议任一端缺失时两端一并置 0（或保留 undefined 由展示层兜底），保证区间单调。

## `apps/edu/lib/cover-gradients.ts`（23 行）
- 完整逐行检查：完成
- 未发现问题（哈希取色稳定，与注释描述一致）。

## `apps/edu/lib/error-handling.ts`（32 行）
- 完整逐行检查：完成
- 未发现问题（非阻塞记录、生产/开发分支处理合理；console 输出不涉及敏感信息）。

## `apps/edu/lib/evaluation-rule-store.test.ts`（140 行）
- 完整逐行检查：完成
- 未发现问题（权重钳制/均分/移动/评价点增删改/不可变性均有覆盖，断言正确）。

## `apps/edu/lib/evaluation-rule-store.ts`（556 行）
- 完整逐行检查：完成
- [P2] L100 / L432: `SET_RESOURCE_CONFIG` 的 action 类型与 setResourceConfig 参数使用 `Record<string, any>`，绕过类型检查（resourceConfig 结构完全自由）；建议为各测评方式的资源配置定义窄接口或联合类型，避免拼写错误静默通过。
- 说明（已核查，非问题）：ADD_EVAL_POINT 的 `[...((next as any)[field])]` 依赖字段数组已初始化——已确认 makeDefaultEvalRuleConfig 初始化全部 7 个评价点数组，不会 spread undefined 崩溃；MOVE_METHOD_UP/DOWN 对越界 index 无防御属调用方约束，按"不过度防御"原则不报。

## `apps/edu/lib/external-links.ts`（49 行）
- 完整逐行检查：完成
- [P2] L13-48: 六个平台地址默认回退为公网演示环境 `http://111.170.170.202:3002~3010` 与 `http://demo2.zhiyu.com.cn:5000`。正式 https 部署若漏配 NEXT_PUBLIC_* 环境变量，前端引用这些 http 地址会产生混合内容被浏览器拦截（页面功能静默失效），且演示地址随包分发。建议正式构建时默认值置空/相对地址并由调用方隐藏入口，或部署校验必填。

## `apps/edu/lib/font-size-scale.test.ts`（36 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/font-size-scale.ts`（16 行）
- 完整逐行检查：完成
- 未发现问题（clamp 对 NaN/Infinity 处理正确，指数缩放计算正确）。

## `apps/edu/lib/format-utils.test.ts`（27 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/format-utils.ts`（143 行）
- 完整逐行检查：完成
- [P2] L72-77: NT_VERSION 映射缺失 Windows 11 识别——Windows 11 的 UA 为 `Windows NT 10.0`，会被显示为"PC web · Windows 10"。建议按 NT 10.0 + build 号（>=22000）判定 Windows 11，或至少标注版本模糊性。

## `apps/edu/lib/frequent-services.test.ts`（41 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/frequent-services.ts`（29 行）
- 完整逐行检查：完成
- 未发现问题（localStorage 不可用/损坏均有 try-catch 兜底，条目数有上限裁剪）。

## `apps/edu/lib/hybrid-eval.test.ts`（41 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/hybrid-eval.ts`（52 行）
- 完整逐行检查：完成
- 未发现问题（复合 key 解析/标签/排序逻辑正确；parseHybridMethodKey 对无冒号与未知模块返回 null 合理）。

## `apps/edu/lib/i18n/locale-provider.tsx`（81 行）
- 完整逐行检查：完成
- 未发现问题（初始 locale 从 data-locale 读取避免闪变、localStorage 写入有兜底、t 函数 useCallback 依赖正确）。

## `apps/edu/lib/i18n/translate.test.ts`（41 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/learn-links.ts`（65 行）
- 完整逐行检查：完成
- 未发现问题（版本参数拼接/空值省略/编码均正确，注释明确了不带 v 的语义）。

## `apps/edu/lib/load-error.ts`（21 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/menu-permissions.test.ts`（98 行）
- 完整逐行检查：完成
- 未发现问题（已知路径回退中止、未知路径兜底放行、订阅开关链路等断言与实现一致）。

## `apps/edu/lib/menu-permissions.ts`（266 行）
- 完整逐行检查：完成
- 未发现问题（checkMenuPermission 的"先套餐后菜单、已知路径处中止、未知路径兜底"逻辑与测试逐一吻合；knownMenuPaths 模块级静态构建无副作用）。
- 复用候选: permissionModuleConfig 中 scene/job/lesson/evaluation 四个模块的 actions 数组（submit_approval/withdraw_approval/publish/unpublish/delete/review/reject，L197-205、L216-224、L235-243、L254-262）逐字相同，可抽为公共常量 `COMMON_APPROVAL_ACTIONS` 后引用。

## `apps/edu/lib/navigation-config.ts`（1290 行）
- 完整逐行检查：完成（1-438、438-647、616-1290 分段覆盖，无跳读）
- 未发现问题（各平台导航结构、firstHrefFromNavConfig/subModulesFromNavConfig 推导、PLATFORM_CARD_DESCRIPTIONS 键与 subModule id 全部对齐，未发现失效引用）。
- 复用候选:
  1. unifiedNavigationConfig（L20-106）与 adminNavigationConfig（L108-194）的 sideNavItems 结构几乎逐字相同，仅 brandTitle/currentPlatformLabel 等元数据不同，可合并为一个配置 + 差异覆盖参数。
  2. userMenuItems 块（{profile/account/logout}，L32-36、L120-124、L211-215、L297-301、L364-368、L631-635、L782-786 共 7 处）逐字重复，可抽公共常量。

## `apps/edu/lib/org-type-icons.ts`（42 行）
- 完整逐行检查：完成
- 未发现问题（map 每次调用重建开销可忽略，按"简单优先"不报；React.ElementType 类型引用在 type 位置合法）。

## `apps/edu/lib/partner-enterprise-completeness.ts`（33 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/public-routes.ts`（5 行）
- 完整逐行检查：完成
- 未发现问题。

## `apps/edu/lib/resource-type-constants.test.ts`（56 行）
- 完整逐行检查：完成
- 未发现问题（accept 串与 extensionMap 一致性、全格式校验、未收录格式拒绝均有断言）。

## `apps/edu/lib/resource-type-constants.tsx`（332 行）
- 完整逐行检查：完成
- 未发现问题（SOFTWARE_EXTS 与 ARCHIVE_EXTS 均含 zip 属轻微重复收录，不构成错误）。
- 复用候选: TYPE_COLORS（L30-42）/TYPE_BG（L44-56）/TYPE_BADGE（L58-70）/LIBRARY_LANDING_TYPE_COLORS（L72-84）四张按类型并行的样式映射，可合并为单个 per-type 元数据对象（如 `{ color, bg, badge, landingColor }`）一次定义。

## `apps/edu/lib/snapshot-converters.ts`（412 行）
- 完整逐行检查：完成
- 未发现问题（num 容错、数组/单对象兼容、dedupe、live 元数据保留等转换逻辑正确；缺失引用项被过滤属快照一致性前提）。

## `apps/edu/lib/theme-brand.ts`（60 行）
- 完整逐行检查：完成
- 未发现问题（hex 校验、租户隔离缓存、接口失败回退缓存均正确；fetch 无 AbortController 但失败有兜底且不 setState，不构成泄漏）。

## `apps/edu/lib/use-resource-maps.ts`（84 行）
- 完整逐行检查：完成
- 未发现问题（模块级缓存 + inflight 去重正确，失败后 inflight 在 finally 清空、缓存保持 null，下次挂载可重试；取消标记防 setState 泄漏）。

## `apps/edu/next-env.d.ts`（6 行）
- 完整逐行检查：完成
- 未发现问题（Next.js 自动生成文件，含 typed routes 引用，符合注释"不应编辑"）。


### report-097-098.md

# 代码审查报告 097-098

- 批次 097（frontend）：apps/edu/vitest.config.ts
- 批次 098（packages）：packages/api-client 15 个文件
- 审查方式：逐文件完整逐行阅读（read 工具核对行号）；对 vitest include 模式用仓库实际依赖 picomatch@4.0.5（vitest@4.1.10 的依赖）做了实证匹配验证
- 时间：2026-08-14

---

## `apps/edu/vitest.config.ts`（40 行）
- 完整逐行检查：完成
- [P2] L8-13: include 清单与现存测试文件脱节，2 个真实存在的测试文件不会被任何 include 模式匹配（用 vitest 依赖的 picomatch@4.0.5 实证：`components/portal/mobile-access-url.test.ts`、`app/lesson/admin/hybrid/add/_components/module-serialize.test.ts` 均 NOT COVERED），它们将静默不执行，相关回归（移动端访问地址拼接、混合课程模块序列化）无法被 CI 捕获。建议补充 include 或改为更宽的 `app/**/*.test.ts`（注意 `[id]` 段在 picomatch 4.x 下可正常匹配字面路径，无需转义）。
- [P2] L16-37: 注释声明"与 tsconfig.json paths 保持一致"，但 tsconfig 中 `@/lib/api`、`@/lib/api-factory`、`@/hooks/use-toast`、`@zhiyu/ui`、`@zhiyu/ui/*`、`@zhiyu/shared-types`、`@zhiyu/shared-types/*` 共 7 项未在 vitest alias 中定义；一旦测试引入这些路径（如复用 api-client 的 `@/lib/api`），会被 catch-all `@/(.*)` 解析到 `apps/edu/lib/api`（不存在）或直接解析失败。属潜在不一致（当前已覆盖的测试仅使用 `@/lib/types/*`，尚未触发）。
- 未发现 P0/P1 问题。

---

## `packages/api-client/src/api/affairs.ts`（207 行）
- 完整逐行检查：完成
- 未发现问题（学期/人培方案/教学计划/场地/节次/排课/我的课表/批次 API 均为封装良好的请求函数；排课 409 冲突明细通过 ScheduleConflictError 保留，处理正确；exportExcel 的 `encodeURIComponent` 使用正确）。
- 复用候选: L85-88、L164-167 两处 exportExcel 的 `if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || \`HTTP ${res.status}\`) }` 错误处理块与 import-export.ts 中 4 处完全同构（合计 ≥3 处），可抽取 authedFetch 的 JSON 错误抛出助手。

---

## `packages/api-client/src/api/ai.ts`（63 行）
- 完整逐行检查：完成
- 未发现问题（租户/超管 AI 配置均走正确的 portalRequest/saasRequest；assist 接口支持 AbortSignal 取消；无密钥回传/日志等敏感信息）。

---

## `packages/api-client/src/api/alliance.ts`（241 行）
- 完整逐行检查：完成
- 未发现 P0/P1 问题（企业引入/授权/项目/协议/成果/专家/品牌/权限 API 路径与方法语义一致，公开里程碑等跨租户只读接口与私有接口区分清晰）。
- 复用候选: projectApi(L101-125)/agreementApi(L127-142)/achievementApi(L144-159)/brandApi(L192-220)/permissionApi(L222-241) 五个 API 的 list/get/create/update/delete 封装结构重复（≥3 处），可参考 api-factory.ts 的 createCrudApi 抽象为按前缀生成的工厂（注意 list 返回形状为 AllianceListResponse 且 create 入参为 Partial，需参数化）。

---

## `packages/api-client/src/api/auth.ts`（26 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `packages/api-client/src/api/evaluation.ts`（400 行）
- 完整逐行检查：完成
- 未发现问题（题库/试题/试卷/考试使用/结果/认证规则/岗位能力/画像/批次 API 覆盖完整，全量读写与细粒度编辑请求体类型清晰；updateQuestionScores 与 updateQuestionScore 的 PUT 路由在 questionId 为 `scores` 时存在理论冲突，但 ID 均为 UUID，按"小概率异常容忍"不报）。

---

## `packages/api-client/src/api-factory.ts`（35 行）
- 完整逐行检查：完成
- 未发现问题（createCrudApi/createContentApi 封装合理；path 拼接未 encodeURIComponent id，但 UUID 场景可容忍）。

---

## `packages/api-client/src/api/favorites.ts`（27 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `packages/api-client/src/api-helpers.test.ts`（124 行）
- 完整逐行检查：完成
- 未发现问题（buildQuery 边界、401 跳转/清 token/防死循环、非 401 走全局错误处理器均覆盖；afterEach 清理全局 mock 完整）。

---

## `packages/api-client/src/api-helpers.ts`（303 行）
- 完整逐行检查：完成
- [P2] L178-237 与 L264-287: `requestWithPlatform` 与 `authedFetch` 各自实现 token 装配 + 401 清 token + 登录页跳转逻辑（L223-229 vs L278-285 几乎相同），后续 401 跳转规则变更需同步改两处，存在漂移风险；可抽取公共 `attachAuth`/`handle401` 助手（与 affairs.ts、import-export.ts 的错误处理助手可合并为同一复用候选）。
- 未发现 P0/P1 问题（40s 超时、204/非 JSON 响应判定、FormData 不设 Content-Type 均处理正确；token 仅存 localStorage 未写 console/日志）。

---

## `packages/api-client/src/api/honors.ts`（19 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `packages/api-client/src/api/import-export.ts`（216 行）
- 完整逐行检查：完成
- 未发现 P0/P1 问题（上传/导入/预览/模板下载/各实体 Excel 导出均基于 authedFetch，query 拼接正确：importPreview 用 `?`、importExcel 用 `&` 衔接 extraQuery）。
- 复用候选: ① L156-215 八个 export\*Excel 方法结构完全一致（`authedFetch(\`/export/{entity}/excel\`, { method:'POST', body: JSON.stringify({ ids }) })`），可抽象为 `exportByIds(entity, ids)`；② L8-11/L64-67/L80-83/L116-119 四处 `if (!res.ok) { json().catch; throw new Error(data.error || HTTP) }` 错误处理块重复（≥3 处），可抽取 authedFetch 的 JSON 错误抛出助手（与 affairs.ts 两处、api-helpers.ts 内部重复同源）。

---

## `packages/api-client/src/api/job.ts`（185 行）
- 完整逐行检查：完成
- 未发现问题（岗位/能力/职责/证书/证书库/批次/推荐/目标岗位/学习路径 API 覆盖完整；L116 `careerPositionId=` 手拼 query 与文件内其他 buildQuery 用法略不一致，但 ID 为 UUID 无编码风险，按"不过度防御"不报）。

---

## `packages/api-client/src/api/lesson.ts`（176 行）
- 完整逐行检查：完成
- 未发现问题（课程/知识点/节点/资源/混合模块/批次/节点评价结果 API 语义一致，提交时 expectedVersion 降级语义注释清晰）。

---

## `packages/api-client/src/api/library.ts`（63 行）
- 完整逐行检查：完成
- 未发现问题。

---

## `packages/api-client/src/api/partner-cobuild.ts`（200 行）
- 完整逐行检查：完成
- [P2] L118: `saveEvaluationMethods` 的 `data: { version?: number; methods: any[] }` 中 `any[]` 类型过宽，与 L114 `listEvaluationMethods` 返回的 `TaskEvaluationMethod[]` 不对齐，payload 字段可写错而无法被类型检查拦截；建议引入 `TaskEvaluationMethod` payload 类型。
- 复用候选: L142-199 `partnerCobuildSchoolApi` 13 个 list 方法结构完全重复（`partnerRequest<ListResponse<T>>(\`/partner/co-build/schools/${tenantId}/${resource}${buildQuery(params || {})}\`)`），可抽象为 `schoolList<T>(resource, tenantId, params)` 助手（≥3 处）。

---

## 汇总

- P0: 0
- P1: 0
- P2: 4（vitest.config.ts ×2、api-helpers.ts ×1、partner-cobuild.ts ×1）
- 复用候选: 4（① authedFetch 统一 JSON 错误/401 助手：import-export.ts ×4 + affairs.ts ×2 + api-helpers.ts 内部 2 处；② import-export.ts exportByIds：8 个 export\*Excel；③ alliance.ts CRUD 工厂：5 个 API 块；④ partner-cobuild.ts schoolList：13 个 list 方法）


### report-099-100.md

# 代码审查报告 099–100（packages：api-client / shared-types）

> 审查依据：docs/code-review/REVIEW-GUIDE.md；逐文件完整逐行阅读（read 工具核对行号）。
> 批次来源：/tmp/batches/099-packages.json（30 文件，2324 行）、/tmp/batches/100-packages.json（11 文件，2301 行）。
> 结论概览：P0 = 0，P1 = 0，P2 = 10，复用候选 = 5。

---

## `packages/api-client/src/api/partner.ts`（120 行）
- 完整逐行检查：完成
- 未发现问题。全部端点经 partnerRequest 统一鉴权封装，登录/注册/选择企业/改密等请求体无明文敏感信息泄露（专家创建密码为管理员管理侧常规操作）。

## `packages/api-client/src/api/portal.ts`（189 行）
- 完整逐行检查：完成
- 未发现问题。CRUD 与批量操作均携带请求体，无 URL 拼接注入面。

## `packages/api-client/src/api/scene.ts`（123 行）
- 完整逐行检查：完成
- [P2] L85: `saveMethods` 的入参 `methods: any[]` 无类型约束（最佳实践: 定义 `TaskEvaluationMethodInput` 结构化类型，避免后端字段变更静默穿透）。
- [P2] L101/L114: `createTemplate`/`updateTemplate` 的 `data: Record<string, any>` 与 `types?: string[]` 之外字段均未建模（最佳实践: 为 RubricTemplate.data 定义联合类型）。

## `packages/api-client/src/api/system.ts`（79 行）
- 完整逐行检查：完成
- [P2] L20: `tree` 响应类型嵌套 `children?: any[]`（最佳实践: 递归类型 `OrgTreeNode = Organization & { children?: OrgTreeNode[] }`，避免深层 any 漂移）。

## `packages/api-client/src/api.ts`（17 行）
- 完整逐行检查：完成
- 未发现问题（纯 barrel 导出）。

## `packages/api-client/src/device.ts`（21 行）
- 完整逐行检查：完成
- 未发现问题。localStorage 仅存随机设备 ID（非敏感信息），读写均被 try/catch 包裹，异常时返回空串降级。

## `packages/api-client/src/fetch-all.ts`（19 行）
- 完整逐行检查：完成
- [P2] L7–L12: `fetchAllPages` 以 `items.length < pageSize` 作为唯一终止条件，无最大页数/重复数据护栏；若服务端分页实现异常（恒返回满页或忽略 offset），会无限循环导致页面挂死（最佳实践: 增加 `maxPages` 上限或对重复 items 计数熔断，如 `page > 1000` 即中止抛错）。

## `packages/api-client/src/index.ts`（6 行）
- 完整逐行检查：完成
- 未发现问题（纯 barrel 导出）。

## `packages/api-client/src/types/affairs.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/ai.ts`（215 行）
- 完整逐行检查：完成
- 未发现问题。纯类型定义，API key 仅以 masked 形式建模（`apiKeyMasked`），未回传明文。

## `packages/api-client/src/types/alliance.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/backend.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/citation.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题。引用类型（CitationBucket/CitationStats）定义于 shared-types/src/library.ts，此处 re-export 属有意为之（已核对 library.ts L98–104）。

## `packages/api-client/src/types/evaluation.ts`（8 行）
- 完整逐行检查：完成
- 未发现问题（barrel 聚合）。

## `packages/api-client/src/types/index.ts`（13 行）
- 完整逐行检查：完成
- 未发现问题（barrel 聚合）。

## `packages/api-client/src/types/job.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/lesson-source.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（仅导出 SystemCourseNode）。

## `packages/api-client/src/types/lesson.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/library.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/partner.ts`（355 行）
- 完整逐行检查：完成
- 未发现问题。类型与 docs/spec/partner-enterprise-platform.md §5 契约对齐；角色、状态等枚举有注释说明前端/后端字段差异（roleCodes/roleCode），无敏感字段建模。

## `packages/api-client/src/types/portal.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/scene.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/src/types/snapshot.ts`（1 行）
- 完整逐行检查：完成
- 未发现问题（re-export）。

## `packages/api-client/vitest.config.ts`（8 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/shared-types/src/affairs.ts`（284 行）
- 完整逐行检查：完成
- 未发现问题。纯类型定义，状态枚举/载荷字段与后端模型一致。

## `packages/shared-types/src/ai.ts`（27 行）
- 完整逐行检查：完成
- 未发现问题。AI 评分结果类型，无敏感字段。

## `packages/shared-types/src/alliance.ts`（555 行）
- 完整逐行检查：完成
- 未发现问题。类型与运行时字典工具（registerAllianceDicts/allianceLabel）职责清晰；模块级 runtimeAllianceDicts 由登录时注册覆盖，属设计预期。

## `packages/shared-types/src/approval.ts`（27 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/shared-types/src/backend.ts`（218 行）
- 完整逐行检查：完成
- 复用候选: `WorkflowStep`（L176–181，name/order/approverIds/approvalMode）与 job-source.ts L34–39 定义完全同形，建议收敛为单一类型后由两文件引用。

## `packages/shared-types/src/certification.ts`（163 行）
- 完整逐行检查：完成
- 未发现问题。calculateLevel 对未命中区间回退 '不合格' 为文档化兜底，默认映射区间连续，无实际缝隙。

## `packages/shared-types/src/content-status.ts`（31 行）
- 完整逐行检查：完成
- 未发现问题。状态机与后端对齐，canPerformAction 无副作用。

## `packages/shared-types/src/evaluation-exam.ts`（312 行）
- 完整逐行检查：完成
- 未发现问题。题型别名（judgment/fill_blank）为兼容映射，QUESTION_TYPES 已去重排序；answers/gradingScores 使用 Record<string, unknown> 更严格。

## `packages/shared-types/src/evaluation-rules.ts`（624 行）
- 完整逐行检查：完成
- 未发现问题。权重分配（makeDefaultEvalRuleConfig/mergeEvalRuleWeights/mergeEvalRuleMethods）取整与余数分发逻辑核对正确（总和恒为 100）；exam→homework 别名归一有注释说明。
- 复用候选: `EvalRulePoint`（L21–32）与 lesson.ts 的 `EvalPoint`（L214–225）字段几乎完全一致（id/name/desc/subType/types/knowledgePointIds/abilityPointIds/scoringMethod/gradeMapping/weight），建议合并。

## `packages/shared-types/src/evaluation-scene.ts`（157 行）
- 完整逐行检查：完成
- [P2] L47: `gradedAt?: Date`、L51: `createdAt?: Date`/L52: `updatedAt?: Date` 声明为 Date 对象，但接口 JSON 序列化后前端拿到的是 ISO 字符串（同文件 L93 `evaluationTime: string | Date` 即双写）；类型与实际运行值不符，调用方误用 Date API 会产生运行时错误（最佳实践: 统一为 string，或提供解析层）。

## `packages/shared-types/src/evaluation.ts`（7 行）
- 完整逐行检查：完成
- 未发现问题（barrel 聚合，原文件按领域拆分有注释说明）。

## `packages/shared-types/src/index.ts`（21 行）
- 完整逐行检查：完成
- 未发现问题（barrel 聚合；approval 经 backend.ts/approval.ts 双路径导出为同源模块，无命名冲突）。

## `packages/shared-types/src/job-source.ts`（302 行）
- 完整逐行检查：完成
- [P2] L280–282: 悬空注释 `// 岗位状态标签映射 / 批次状态标签映射 / 角色标签映射` 后并无对应映射定义（文件头注明了与 job.ts 的两视图分工，但此三行注释为历史残留），建议删除或补齐实现，避免误导阅读。
- 复用候选: ① `WorkflowStep`（L34–39）与 backend.ts L176–181 同形重复；② `ApprovalStatus`（L214，'pending'|'approved'|'rejected'）与 approval.ts L12 完全重复；③ `PositionRecommendation`（L284–296，positionId+major 字段）与 job.ts L114–126（careerPositionId+majorName 字段）同名异形，两处消费方极易混淆，建议统一命名或合并。

## `packages/shared-types/src/job.ts`（155 行）
- 完整逐行检查：完成
- 未发现问题（majorName Deprecated 有标注）。
- 复用候选: `PositionRecommendation`（L114–126）与 job-source.ts L284–296 同名异形重复（见上）。

## `packages/shared-types/src/lesson-source.ts`（250 行）
- 完整逐行检查：完成
- 未发现问题（文件头已标注 @deprecated 并指引改用 lesson.ts；INDUSTRIES 中 '软件测试工程师' 为遗留数据条目，非本次审查范围）。
- 复用候选: 全文件类型（Course/KnowledgePoint/SystemCourseNode/NodeResource/NodeQuiz 等）与 lesson.ts 规范版重复，属已文档化的遗留视图，建议后续整体删除并迁移引用。

## `packages/shared-types/src/lesson.ts`（268 行）
- 完整逐行检查：完成
- 未发现问题。
- 复用候选: `EvalPoint`（L214–225）与 evaluation-rules.ts 的 `EvalRulePoint` 重复（见 evaluation-rules.ts 段落）。

---

# 汇总

| 批次 | 文件数 | P0 | P1 | P2 |
|------|-------|----|----|----|
| 099 | 30 | 0 | 0 | 4 |
| 100 | 11 | 0 | 0 | 6 |
| 合计 | 41 | 0 | 0 | 10 |

复用候选：5（WorkflowStep、ApprovalStatus、PositionRecommendation、EvalPoint/EvalRulePoint、lesson-source.ts 整文件与 lesson.ts 重复）。


### report-101-102.md

# 代码审查报告：批次 101-102（packages）

> 依据 `docs/code-review/REVIEW-GUIDE.md` 全量逐行审查。
> 批次清单：`/tmp/batches/101-packages.json`（17 文件）、`/tmp/batches/102-packages.json`（23 文件）。
> 说明：本批全部为 packages 下共享类型（shared-types）与共享 UI 组件（packages/ui），无后端代码，故后端专项红线（handler/service/store）不适用；P0 未发现。

## `packages/shared-types/src/library.ts`（125 行）
- 完整逐行检查：完成
- [P2] L57: `metadata?: Record<string, any>` 使用 any 削弱类型安全（最佳实践: 改为 `Record<string, unknown>` 或定义明确结构）
- 其余为资源类型/标签常量与接口定义，未发现其他问题

## `packages/shared-types/src/online-classroom.ts`（56 行）
- 完整逐行检查：完成
- 未发现问题（纯接口定义）

## `packages/shared-types/src/portal.ts`（224 行）
- 完整逐行检查：完成
- [P2] L75/L129: `WorkspaceCourse.status` 用 '已完成'、`WorkspaceTeacherCourse.status` 用 '已结课'，同文件两个"结课"状态枚举不一致（最佳实践: 统一状态字面量，避免前端两套判断）
- 其余为工作台/社区/荣誉接口定义，未发现其他问题

## `packages/shared-types/src/portrait.ts`（136 行）
- 完整逐行检查：完成
- 未发现问题（纯接口定义）

## `packages/shared-types/src/scene-mock.ts`（238 行）
- 完整逐行检查：完成
- [P2] L1-12: 文件整体标注 @deprecated 但仍保留在 shared-types 公共包并导出，且与 `scene.ts` 存在重名异构类型（Scenario L26、Task L78、TaskDeliverable L116、TaskEvalPoint L56、GradeMapping L200 等），新代码引用时易误用（最佳实践: 确认无引用后删除本文件，统一使用 scene.ts 规范类型）
- [P2] L103: `evalData?: Record<string, any>` 使用 any（最佳实践: 改为 unknown 或结构化类型）
- 复用候选: 与 `scene.ts` 的 Scenario/Task/TaskDeliverable/TaskEvalPoint/GradeMapping 类型重复（详见文末汇总）

## `packages/shared-types/src/scene.ts`（225 行）
- 完整逐行检查：完成
- [P2] L55/L80/L93/L123/L136/L140/L167/L208: 8 处 `Record<string, any>`（evalData、evaluationPoints、extraData、data、evalSubjects、resourceConfig、gradeMapping、snapshotData），与快照/场景数据相关的自由结构建议收敛为明确类型或 `unknown`
- [P2] L219: `majorName?: string // Deprecated` 遗留字段无迁移说明（最佳实践: 标注替代字段或移除）
- 其余（SCENE_DIFFICULTY 统一配置等）未发现其他问题

## `packages/shared-types/src/shared-models.ts`（55 行）
- 完整逐行检查：完成
- [P2] L23: `oauth?: Record<string, any>` 使用 any（最佳实践: 明确 OAuth 载荷结构或 unknown）
- 未发现其他问题

## `packages/shared-types/src/snapshot.ts`（529 行）
- 完整逐行检查：完成
- [P2] L22/L34/L74/L85/L88/L103/L114/L136/L234/L262/L291/L465/L489/L512: 14 处 `Record<string, any>`（attributes、metadata、eval_data、eval_subjects、resource_config、grade_mapping、rule、evaluation_points、data、level_mapping、custom_level_mapping 等）。作为 jsonb 快照镜像可接受，但建议对高频字段（eval_data）定义明确 schema 以利消费端类型安全
- 其余为快照 bundle 结构定义（含学生侧答案剥离注释），未发现其他问题

## `packages/shared-types/src/status.test.ts`（17 行）
- 完整逐行检查：完成
- 未发现问题（覆盖已知状态与未知状态兜底两条路径）

## `packages/shared-types/src/status.ts`（76 行）
- 完整逐行检查：完成
- [P2] L20 vs L48: 键 'ready' 与 '待发布' 都显示标签"待发布"，但配色不同（`#4f46e5/#e0e7ff` vs `#64748b/#f1f5f9`）；L27 vs L34: 'in_progress' 与 '进行中' 均显示"进行中"，配色也不同（`#16a34a/#dcfce7` vs `#2563eb/#eff6ff`）——同一语义状态在不同页面（英键来自 API、中文键来自 Portal workspace）渲染颜色不一致（最佳实践: 同标签统一取同一配色，消除中英双键差异）
- [P2] L56/L58: 'failed' 与 'failure' 双键并存（历史遗留），建议收敛单一键
- 其余（含未知状态兜底 `label: status`）未发现其他问题

## `packages/shared-types/vitest.config.ts`（14 行）
- 完整逐行检查：完成
- 未发现问题（`__dirname` 在 vitest 配置加载机制下可用；`@/*` 通配别名由 @rollup/plugin-alias 语义支持）

## `packages/ui/src/components/platform-shell/config.ts`（68 行）
- 完整逐行检查：完成
- 未发现问题（纯配置接口）

## `packages/ui/src/components/platform-shell/icons.ts`（68 行）
- 完整逐行检查：完成
- 未发现问题（未知 key 兜底 `Settings` 为合理降级）

## `packages/ui/src/components/platform-shell/index.ts`（14 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/platform-shell/PlatformSideNav.tsx`（250 行）
- 完整逐行检查：完成
- [P2] L13-24: `getMatchedTarget` 与同目录 `utils.ts` L1-12 `matchesPath` 匹配逻辑几乎完全重复（仅返回"首个命中" vs "是否存在"差异），且 apps 内另有 `app/portal/apps/system/layout.tsx` L53、`app/portal/alliance/layout.tsx` L21、`app/portal/layout.tsx` L29、`lib/public-routes.ts` L4 等多处内联同构实现（最佳实践: 抽取共享 `isPathActive(pathname, href, matchers)` 工具，见文末复用候选）
- [P2] L73-103: `visibleSideNavItems`/effect 依赖链中 `hasMenuPermission` 参与 useMemo 依赖；调用方若传 inline 箭头（如 `apps/edu/app/partner/layout.tsx` L83 `() => true`），每次父组件渲染都会使 useMemo 缓存失效、effect 重跑 `setExpandedItems` 触发多余渲染（不会死循环，但会成倍放大渲染）。且 effect 只增不删：平台切换后旧平台展开 id 残留 `expandedItems`（最佳实践: 父组件用 useCallback 稳定引用；effect 内仅追加活跃父项，不合并 prev 全量）
- [P2] L84: `useState(defaultExpanded)` 仅首渲染生效，`config.defaultExpandedSideNavIds` 变化后展开状态不回落（最佳实践: 用 key 或受控展开态同步）
- 其余（render 期守卫式收抽屉、权限裁剪 children）未发现其他问题

## `packages/ui/src/components/platform-shell/utils.ts`（12 行）
- 完整逐行检查：完成
- 复用候选: `matchesPath` 与 PlatformSideNav.tsx L13-24 `getMatchedTarget` 及 apps 内 5+ 处内联实现重复（详见文末汇总）；本文件本身无缺陷

## `packages/ui/src/components/shared/combobox-select.tsx`（245 行）
- 完整逐行检查：完成
- [P2] L199: `CommandItem value={o.label}` 用 label 作 cmdk 条目 value；L229: 徽章移除按 `label` 反查 value（`options.find((o) => o.label === label)`）；L223: 徽章 `key={label}` —— 选项 label 重复时，键盘导航/移除操作会命中错误条目且产生重复 key（最佳实践: 以 value 作为条目 value 与 key，移除时直接按 value 操作）
- [P2] L75-76: `search` 状态在弹层关闭后未清空，再次打开仍保留上次搜索词并保持过滤（状态未清空；最佳实践: `onOpenChange` 关闭时 setSearch('')）
- 其余（单选/多选切换、全选、防重复提交）未发现其他问题

## `packages/ui/src/components/shared/confirm-dialog.tsx`（62 行）
- 完整逐行检查：完成
- 未发现问题（pending 时禁用按钮并拦截 onOpenChange，防重设计正确）

## `packages/ui/src/components/shared/empty-state.tsx`（71 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/shared/error-state.tsx`（34 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/shared/form-dialog-footer.tsx`（39 行）
- 完整逐行检查：完成
- 未发现问题（submit 型确认按钮交由表单提交，loading 由 Button 承接）

## `packages/ui/src/components/shared/hover-action-bar.tsx`（51 行）
- 完整逐行检查：完成
- 未发现问题（桌面 hover 显隐 + 移动端下拉双态正确；`className` 模板拼接建议用 cn，属风格问题不报）

## `packages/ui/src/components/shared/import-confirm-dialog.tsx`（158 行）
- 完整逐行检查：完成
- [P2] L66/L128: 三个导入按钮已做 busy 防重与禁用，但 `Dialog` 层 `onOpenChange` 未在 busy 时拦截——导入进行中用户仍可经 ESC/遮罩/X 关闭弹窗，界面与异步导入状态脱节（组件自身防重意图未覆盖弹窗级关闭；最佳实践: busy 时 `onOpenChange={(v) => v || busy ? false : onOpenChange(v)}` 或禁用关闭）
- 其余（重复项预览前 10 条、hasMore 提示、run 的 pending 防重）未发现其他问题

## `packages/ui/src/components/shared/import-wizard-dialog.tsx`（230 行）
- 完整逐行检查：完成
- [P2] L198-205: file input 未在添加后重置 `e.target.value`，移除文件后再选择同一文件不触发 onChange（浏览器对 value 未变的同文件选择不发 change 事件），需先选别的文件才能重新加入（最佳实践: `handleAddFiles` 末尾 `e.target.value = ''`）
- [P2] L211: 取消按钮未在 `importing` 时禁用/拦截，导入进行中可关闭向导（与 import-confirm-dialog 同类问题）
- 其余（受控/非受控双模式、两步状态机、去重）未发现其他问题

## `packages/ui/src/components/shared/mixed-tag-editor.tsx`（338 行）
- 完整逐行检查：完成
- [P2] L49/L57-85/L305-307: `cursorOffsetRef` 只写不读（updateCursorOffset 计算的光标偏移从未被消费），属死代码，且 onInput/onKeyUp/onMouseUp 每键入都执行 TreeWalker 遍历（最佳实践: 删除该 ref 与三个事件绑定；若后续需要光标恢复再补实现）
- [P2] L159-160: 用 `JSON.stringify` 比较数组集合变化，数组顺序变化会误判为变更导致多余 DOM 操作（最佳实践: 用 Set 差集比较）
- 其余（contentEditable 防注入 paste 纯文本、聚焦时仅追加保光标、异步数据补渲染 missing 标签）设计正确，未发现其他问题

## `packages/ui/src/components/shared/search-input.tsx`（70 行）
- 完整逐行检查：完成
- 未发现问题（cloneElement 注入 className 的类型断言为已知可接受写法）

## `packages/ui/src/components/shared/status-badge.tsx`（33 行）
- 完整逐行检查：完成
- 未发现问题（复用 getStatusConfig 统一状态配色；apps 侧为 re-export，无重复实现）

## `packages/ui/src/components/shared/table-row-actions.tsx`（19 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/shared/underline-tabs.tsx`（52 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/ui/alert-dialog.tsx`（145 行）
- 完整逐行检查：完成
- 未发现问题（标准 Radix 封装）

## `packages/ui/src/components/ui/alert.tsx`（60 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/ui/avatar.tsx`（41 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/ui/badge.tsx`（37 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/ui/button.tsx`（75 行）
- 完整逐行检查：完成
- 未发现问题（loading 自动 disabled + spinner；asChild 分支正确）

## `packages/ui/src/components/ui/card.tsx`（75 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/ui/chart.tsx`（320 行）
- 完整逐行检查：完成
- [P2] L171/L266: `key={item.dataKey}` 与 `key={item.value}` 在多个序列同 dataKey/同 name 时可能重复（Recharts 常规 payload 下不触发，属防御性建议）
- 其余（ChartStyle 注入 config 派生 CSS 为开发者受控输入、tooltip/legend 逻辑）未发现其他问题

## `packages/ui/src/components/ui/checkbox.tsx`（29 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/ui/collapsible.tsx`（21 行）
- 完整逐行检查：完成
- 未发现问题

## `packages/ui/src/components/ui/command.tsx`（162 行）
- 完整逐行检查：完成
- 未发现问题（CommandDialog 的 DialogTitle 先于 DialogContent 挂载，Radix 无障碍警告检查可满足）

## `packages/ui/src/components/ui/dialog.tsx`（176 行）
- 完整逐行检查：完成
- [P2] L90-104: 自定义 `onOpenAutoFocus`/focus 逻辑将默认聚焦（容器）改为聚焦"第一个可聚焦控件"，若首个控件是操作按钮（如确认/危险按钮），Enter 可直接触发，偏离 Radix 默认行为（最佳实践: 保持聚焦容器或聚焦标题；如需自动聚焦输入框则显式传 autofocus 目标）
- 其余（DialogBranch 阻止外层关闭、关闭按钮/尺寸变体）未发现其他问题

---

## 复用候选汇总（n = 2）

1. **路径激活匹配逻辑重复（≥3 处）**：`packages/ui/src/components/platform-shell/utils.ts` L1-12 `matchesPath` 与 `PlatformSideNav.tsx` L13-24 `getMatchedTarget` 同构，apps 内另有 `app/portal/apps/system/layout.tsx` L53、`app/portal/alliance/layout.tsx` L21、`app/portal/layout.tsx` L29、`lib/public-routes.ts` L4 等内联实现。可抽象为共享工具 `isPathActive(pathname, target, matchers?)`（处理 '/'、'$' 精确匹配、前缀匹配），供 packages 与 apps 统一引用。
2. **场景类型重复**：`scene-mock.ts`（已 @deprecated）与 `scene.ts` 存在重名异构类型（Scenario、Task、TaskDeliverable、TaskEvalPoint、GradeMapping、RubricLevel 等），difficulty 分别定义为 `1|2|3|4|5` 与 `number`。建议确认无引用后删除 `scene-mock.ts`，统一收敛到 `scene.ts`。


### report-103-103.md

# 代码审查报告：批次 103（packages/ui）

- 审查指南：docs/code-review/REVIEW-GUIDE.md（已完整执行）
- 批次清单：/tmp/batches/103-packages.json（34 个文件，均为 packages/ui）
- 审查方式：每个文件 read 工具完整逐行阅读；行号均已用 read 核对
- 结论：未发现 P0/P1 级问题；4 处 P2 问题；2 个复用候选

---

## `packages/ui/src/components/ui/dropdown-menu.tsx`（228 行）
- 完整逐行检查：完成
- 未发现问题。标准 Radix DropdownMenu 封装；L36/L204 使用 Tailwind v4 的 CSS 变量简写 `max-h-(--radix-...)` 与 `origin-(--radix-...)`，在 v4.3.1 下有效。
- 复用候选：L36 与 L204 的弹层动画类串（`data-[state=open]:animate-in ... zoom-in-95 ... slide-in-from-*`）与 popover.tsx L29、select.tsx L58、tooltip.tsx L45、toast.tsx L28 完全重复（≥5 处），可抽为共享常量或 CSS 层统一维护。

## `packages/ui/src/components/ui/empty.tsx`（49 行）
- 完整逐行检查：完成
- [P2] L36/L38: `EmptyDescription` 的 props 类型声明为 `React.ComponentProps<'p'>`，但实际渲染的是 `<div>`（L38），类型与实际元素不一致：按段落语义传入的属性不会被 `<div>` 承接，屏幕阅读器语义也由段落退化为块级 div。建议改为 `React.ComponentProps<'div'>` 或直接渲染 `<p>`。
- [P2] L3-L47: 与 `packages/ui/src/components/shared/empty-state.tsx` 的 `EmptyState` 功能重叠（同为"空态"展示组件族，且均从 index.ts 导出），包内存在两套空态组件，维护与使用容易混乱，建议合并为一套。

## `packages/ui/src/components/ui/field.tsx`（232 行）
- 完整逐行检查：完成
- [P2] L122: `FieldTitle` 使用了 `data-slot="field-label"`，与 L107 `FieldLabel` 的 data-slot 值完全相同（shadcn 规范中 FieldTitle 应为 `field-title`）。导致 `[data-slot=field-label]` 选择器（如 L63 横向布局的 `[&>[data-slot=field-label]]:flex-auto`）无法区分两个组件，外部样式/自动化测试按 data-slot 定位时出现歧义。建议 FieldTitle 改用 `data-slot="field-title"`。
- 其余（L138 `nth-last-2:-mt-1` 为 Tailwind v4 合法变体；L200 静态列表 key 可接受）未发现问题。

## `packages/ui/src/components/ui/input.tsx`（21 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/label.tsx`（21 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/popover.tsx`（42 行）
- 完整逐行检查：完成
- 未发现问题。
- 复用候选：L29 的弹层动画类串与 dropdown-menu.tsx L36/L204、select.tsx L58、tooltip.tsx L45、toast.tsx L28 重复（≥5 处）。可抽象为一个共享常量（如 `lib/popover-animation.ts` 导出动画类串）或放入 globals.css 的 `@utility`，避免各处手抄、后续微调动画需多点同步修改。

## `packages/ui/src/components/ui/progress.tsx`（28 行）
- 完整逐行检查：完成
- 未发现问题（L22 `value || 0` 对 undefined/NaN 均有兜底，0~100 区间换算正确）。

## `packages/ui/src/components/ui/radio-group.tsx`（45 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/scroll-area.tsx`（56 行）
- 完整逐行检查：完成
- 未发现问题（滚动条监听由 Radix 管理并随组件卸载清理）。

## `packages/ui/src/components/ui/select.tsx`（178 行）
- 完整逐行检查：完成
- 未发现问题（hint 分支渲染结构正确；L102 的 `*:[span]:last` 仅作用于无 hint 分支，属外观细节，不影响功能）。

## `packages/ui/src/components/ui/separator.tsx`（28 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/sheet.tsx`（130 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/skeleton.tsx`（13 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/slider.tsx`（54 行）
- 完整逐行检查：完成
- 未发现问题（L16-19 useMemo 在受控/非受控/未传值三种场景下计算 thumb 数量均正确，与传给 Radix Root 的 value/defaultValue 一致）。

## `packages/ui/src/components/ui/spinner.tsx`（16 行）
- 完整逐行检查：完成
- 未发现问题。
- 复用候选：`Spinner`（Loader2 + animate-spin）与 `packages/ui/src/components/shared/status-badge.tsx` 的 `LoadingView`（L26-33 手写 Loader2 + animate-spin）重复，且 apps/ 下 75+ 个文件存在手写 `Loader2 ... animate-spin` 的加载态（远超 3 处）。建议统一收敛为 Spinner：LoadingView 改为复用 Spinner，apps 中加载态逐步替换，避免样式/尺寸分散。

## `packages/ui/src/components/ui/switch.tsx`（26 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/table.tsx`（92 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/tabs.tsx`（54 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/textarea.tsx`（18 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/toaster.tsx`（33 行）
- 完整逐行检查：完成
- 未发现问题（key=id 正确，action/title/description 渲染条件正确）。

## `packages/ui/src/components/ui/toast.tsx`（124 行）
- 完整逐行检查：完成
- 未发现问题（标准 shadcn toast 封装，Provider/Viewport/Action 等均正确）。

## `packages/ui/src/components/ui/toggle-group.tsx`（69 行）
- 完整逐行检查：完成
- 未发现问题（context 继承 variant/size 逻辑正确）。

## `packages/ui/src/components/ui/toggle.tsx`（27 行）
- 完整逐行检查：完成
- 未发现问题。

## `packages/ui/src/components/ui/tooltip.tsx`（57 行）
- 完整逐行检查：完成
- 未发现问题（Tooltip 内默认包一层 Provider，delayDuration 默认 0，行为一致）。

## `packages/ui/src/hooks/use-async.ts`（85 行）
- 完整逐行检查：完成
- 未发现问题。核心异步竞态防护正确：L54/L58/L62/L73 的 seq 序号机制可丢弃过期响应；L65 错误回调返回 true 时抑制默认 toast；L77-82 首载 effect 依赖 refresh（L75 useCallback 依赖稳定的模块级 toast，不随渲染重建）与调用方 deps，未发现闭包过期值或重复加载问题。

## `packages/ui/src/hooks/use-click-outside.ts`（17 行）
- 完整逐行检查：完成
- 未发现问题（L14-15 监听/清理成对，无泄漏）。

## `packages/ui/src/hooks/use-debounced-value.ts`（12 行）
- 完整逐行检查：完成
- 未发现问题（L8-9 定时器正确清理）。

## `packages/ui/src/hooks/use-import-flow.ts`（146 行）
- 完整逐行检查：完成
- [P2] L12: `UseImportFlowOptions` 中 `entityLabel: string` 声明为必填，但函数体（L18-23 仅解构 importType/templateFileName/onSuccess/extraQuery）从未使用该字段。调用方必须传一个被忽略的参数，属"必填但无用"的接口字段，误导使用者（以为会体现在提示语中）。建议：删除该字段，或用于导入/下载失败 toast 的文案。
- 其余（L74-79 onSuccess 失败静默为有意设计并有注释说明；导入成功/失败分支状态清理正确；预览重复时保留文件列表）未发现问题。

## `packages/ui/src/hooks/use-toast.ts`（180 行）
- 完整逐行检查：完成
- 未发现问题。L171 `}, [state])` 每次状态变更都会移除/重挂监听器，但因 setState 引用稳定且先移除后添加，无重复监听或泄漏；此为 shadcn 官方模板原样，属可接受写法（仅轻微多余开销，按指南不报低价值项）。

## `packages/ui/src/index.ts`（43 行）
- 完整逐行检查：完成
- 未发现问题（re-export 路径与包内实际文件一致；shared 与 platform-shell 模块不在本批次范围内，仅确认导出存在性，未展开审查）。

## `packages/ui/src/lib/dom-utils.ts`（42 行）
- 完整逐行检查：完成
- 未发现问题（L27 `textContent` 赋值、L33 aria-label 拼接均无 XSS 风险；按钮 onclick 中 stopPropagation + 移除节点顺序正确）。

## `packages/ui/src/lib/utils.ts`（13 行）
- 完整逐行检查：完成
- 未发现问题（cn 为标准 clsx + tailwind-merge；formatFileSize 对空值/NaN 均有兜底）。

## `packages/ui/src/utils.test.ts`（26 行）
- 完整逐行检查：完成
- 未发现问题（5 个用例覆盖合并、空输入、条件类、undefined、tailwind 冲突，均通过；L21-25 的冲突断言依赖 tailwind-merge 行为，正确）。

## `packages/ui/vitest.config.ts`（14 行）
- 完整逐行检查：完成
- [P2] L10-12: alias 仅映射 `'@/lib/utils'`，本包其他 `@/` 路径（如 `@/hooks/use-toast`、`@/components/ui/...`）未配置；当前测试只 import cn 所以能跑通，但后续为 hooks/组件补测试时必然解析失败。建议改为通用映射：`'@': path.resolve(__dirname, './src')`。
- 注：`__dirname` 在 `"type": "module"` 包下由 Vite config bundler 注入（已实际运行 `pnpm vitest run` 验证通过 5/5），非问题。

---

## 汇总

- P0：0
- P1：0
- P2：4 处（empty.tsx ×2、field.tsx ×1、use-import-flow.ts ×1、vitest.config.ts ×1）
- 复用候选：2（①Spinner/LoadingView/手写 animate-spin 加载态收敛为 Spinner；②Radix 弹层动画类串跨 5 文件重复，抽共享常量）


### report-104-105.md

# 代码审查报告 104-105（migrations）

> 依据 `docs/code-review/REVIEW-GUIDE.md` 执行：每个文件完整逐行阅读，行号均经 read 工具核对。
> 审查范围：`/tmp/batches/104-migrations.json`（76 文件）+`/tmp/batches/105-migrations.json`（80 文件），共 156 个文件，全部为 SQL 迁移文件（up/down 成对）。
> 结论摘要：P0 × 0，P1 × 1，P2 × 11；复用候选 2。

---

## `backend/migrations/001_baseline.up.sql`（2181 行）
- 完整逐行检查：完成
- [P2] L1-2: 文件注释声称是"migrations 001-091 的快照"，但全文件不含 091_certification_weights 创建的表（grep 验证 certification_weights 不存在），注释与实际内容不符（092 及之后的表同样不在其中，属正常；唯独 091 也在 001-091 声称范围内）。功能上因 migrate 工具会按序继续应用 091_certification_weights.up.sql 而不受影响，但注释误导后续维护者（最佳实践: 修正注释范围或说明"001-090 + 部分 091"）。

## `backend/migrations/001_baseline.down.sql`（9 行）
- 完整逐行检查：完成
- 未发现问题（DROP ALL 为 baseline down 的常规语义，使用了 quote_ident 防注入）。

## `backend/migrations/091_certification_weights.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/091_certification_weights.up.sql`（18 行）
- 完整逐行检查：完成
- 未发现问题（task_id 可空的 COALESCE 表达式唯一索引正确避免了 NULL 不唯一问题）。

## `backend/migrations/092_affairs.down.sql`（9 行）
- 完整逐行检查：完成
- 未发现问题（按依赖逆序 DROP，顺序正确）。

## `backend/migrations/092_affairs.up.sql`（140 行）
- 完整逐行检查：完成
- [P2] L12: terms.is_current 无"同一租户仅一个当前学期"的部分唯一索引约束，多租户下并发/脚本可能产生多个 is_current=true 的学期（最佳实践: 增加 `CREATE UNIQUE INDEX ... ON terms(tenant_id) WHERE is_current`）。

## `backend/migrations/093_course_eval_data.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/093_course_eval_data.up.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/094_course_assessments.down.sql`（6 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/094_course_assessments.up.sql`（37 行）
- 完整逐行检查：完成
- [P1] L12-19: 排课表 course_id 回填 UPDATE 仅按 `c.code = se.course_code` 匹配，未限定 `c.tenant_id = se.tenant_id`。courses.code 唯一性只在 (tenant_id, code) 维度（uq_courses_tenant_code），跨租户 code 撞名时会把排课条目错误关联到其他租户的课程（常见短码如 C001 极易撞名），产生跨租户数据错链（最佳实践: 增加 `AND c.tenant_id = se.tenant_id` 条件）。

## `backend/migrations/095_course_ability_aggregation.down.sql`（8 行）
- 完整逐行检查：完成
- 未发现问题（索引先行 DROP，避免删表时报依赖）。

## `backend/migrations/095_course_ability_aggregation.up.sql`（40 行）
- 完整逐行检查：完成
- 未发现问题（唯一索引含 tenant_id，语义正确）。

## `backend/migrations/096_course_homework_submissions.down.sql`（6 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/096_course_homework_submissions.up.sql`（25 行）
- 完整逐行检查：完成
- 未发现问题（(homework_id, student_id) 唯一，防重复提交）。

## `backend/migrations/097_knowledge_point_source.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/097_knowledge_point_source.up.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/097_node_eval_and_affairs_course.down.sql`（11 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/097_node_eval_and_affairs_course.up.sql`（44 行）
- 完整逐行检查：完成
- 未发现问题（UNIQUE 含 tenant_id，与 095 一致）。

## `backend/migrations/098_node_homework_submissions.down.sql`（11 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/098_node_homework_submissions.up.sql`（33 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/099_certificate_library_updated_at.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/099_certificate_library_updated_at.up.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/100_scene_eval_unique_tenant.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/100_scene_eval_unique_tenant.up.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题（原 (task_id, evaluatee_id, method_key) 全局唯一已保证无重复三元组，扩列 tenant_id 不会失败）。

## `backend/migrations/101_alliance_brand.down.sql`（12 行）
- 完整逐行检查：完成
- 未发现问题（按依赖逆序 DROP）。

## `backend/migrations/101_alliance_brand.up.sql`（251 行）
- 完整逐行检查：完成
- 未发现问题（各表均有 tenant_id + 查询索引；联盟字典 UNIQUE(tenant_id, dict_type, code) 正确）。

## `backend/migrations/101_teaching_plan_entry_classes.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/101_teaching_plan_entry_classes.up.sql`（11 行）
- 完整逐行检查：完成
- 未发现问题（旧数据迁移用 ON CONFLICT DO NOTHING，幂等）。

## `backend/migrations/102_program_course_position.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/102_program_course_position.up.sql`（5 行）
- 完整逐行检查：完成
- [P2] L2: `DELETE FROM training_program_courses;` 无条件清空整表数据（注释虽说明"清空旧数据"，但未先备份/迁移），down 仅恢复列结构不恢复数据；若该表在旧版本已有生产数据将直接丢失（最佳实践: 评估存量数据，必要时先迁移到新列或提供备份脚本）。

## `backend/migrations/103_alliance_enrich.down.sql`（14 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/103_alliance_enrich.up.sql`（27 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/104_program_content_mgmt.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/104_program_content_mgmt.up.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/104_tenant_school_fields.down.sql`（8 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/104_tenant_school_fields.up.sql`（8 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/105_tenant_education_fields.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/105_tenant_education_fields.up.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/106_affairs_batches.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/106_affairs_batches.up.sql`（15 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/107_alliance_relations.down.sql`（7 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/107_alliance_relations.up.sql`（8 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/107_schedule_multi_class.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/107_schedule_multi_class.up.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题（回填语句带 array_length 判空，幂等）。

## `backend/migrations/108_alliance_dict_seed.down.sql`（4 行）
- 完整逐行检查：完成
- 未发现问题（按 dict_type 删除，保留用户自建类型）。

## `backend/migrations/108_alliance_dict_seed.up.sql`（55 行）
- 完整逐行检查：完成
- 未发现问题（预插运营方固定 ID 字典的时序依赖已在 140 中明确豁免 FK，设计自洽；ON CONFLICT DO NOTHING 幂等）。

## `backend/migrations/109_alliance_agreement_project_ids.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/109_alliance_agreement_project_ids.up.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/110_remove_platform_links.down.sql`（37 行）
- 完整逐行检查：完成
- 未发现问题（回滚完整重建表+约束+索引，与 baseline 一致）。

## `backend/migrations/110_remove_platform_links.up.sql`（4 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/111_graduation_archive_unique.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/111_graduation_archive_unique.up.sql`（2 行）
- 完整逐行检查：完成
- [P2] L2: 直接 ADD UNIQUE(topic_id, user_id)，未像 112/114 那样先清理存量重复行；若存量已有同 (topic_id, user_id) 重复数据，迁移会失败（最佳实践: 参考 112/114 先 DELETE 去重再建约束）。

## `backend/migrations/112_approval_pending_unique.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/112_approval_pending_unique.up.sql`（11 行）
- 完整逐行检查：完成
- 未发现问题（先按 (created_at,id) 去重保留最早，再建部分唯一索引，正确）。

## `backend/migrations/113_exam_questions_unique.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/113_exam_questions_unique.up.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/114_cert_issuance_unique.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/114_cert_issuance_unique.up.sql`（12 行）
- 完整逐行检查：完成
- 未发现问题（去重保留最小 id + 唯一约束，防重复发放）。

## `backend/migrations/115_tenant_delete_fk.down.sql`（80 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/115_tenant_delete_fk.up.sql`（86 行）
- 完整逐行检查：完成
- 未发现问题（SET NULL/CASCADE 分类原则清晰，与 116 一致）。

## `backend/migrations/116_tenant_internal_fk.down.sql`（87 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/116_tenant_internal_fk.up.sql`（91 行）
- 完整逐行检查：完成
- [P2] L75-76: organizations.type_id 外键由 baseline 的 ON DELETE RESTRICT 改为 ON DELETE CASCADE，副作用是"删除被引用的组织类型会连带删除全部该类型组织"（超出租户级联删除的本意，baseline 当初特意用 RESTRICT 保护）；若存在组织类型删除入口，需确认业务预期（最佳实践: 评估改为 SET NULL 或维持 RESTRICT，仅对租户删除路径做特殊处理）。

## `backend/migrations/117_question_banks_permissions.down.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题（#- 移除幂等）。

## `backend/migrations/117_question_banks_permissions.up.sql`（12 行）
- 完整逐行检查：完成
- 未发现问题（jsonb_set create_missing=true，幂等）。

## `backend/migrations/118_workspace_indexes.down.sql`（4 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/118_workspace_indexes.up.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/119_evaluation_config_indexes.down.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/119_evaluation_config_indexes.up.sql`（6 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/120_ability_point_codes.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题（仅清 NL- 前缀，与 128 分工明确）。

## `backend/migrations/120_ability_point_codes.up.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题（md5 前缀编码，ability_points.code 无唯一约束，碰撞容忍）。

## `backend/migrations/121_task_eval_exam_to_homework.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题（不可逆迁移显式声明，符合惯例）。

## `backend/migrations/121_task_eval_exam_to_homework.up.sql`（16 行）
- 完整逐行检查：完成
- 未发现问题（先删后改，避免唯一约束冲突，顺序正确）。

## `backend/migrations/122_alliance_dict_english_codes.down.sql`（31 行）
- 完整逐行检查：完成
- 未发现问题（up/down 映射互逆，且 NOT EXISTS 防冲突）。

## `backend/migrations/122_alliance_dict_english_codes.up.sql`（36 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/123_eval_standard_copy.down.sql`（8 行）
- 完整逐行检查：完成
- 未发现问题（回滚不恢复 rubric_template_id 已在注释说明）。

## `backend/migrations/123_eval_standard_copy.up.sql`（47 行）
- 完整逐行检查：完成
- 未发现问题（存量复制/回填/清悬空三步顺序正确）。

## `backend/migrations/124_certification_point_levels.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/124_certification_point_levels.up.sql`（13 行）
- 完整逐行检查：完成
- 未发现问题（唯一索引含 tenant_id）。

## `backend/migrations/125_job_ability_indicators.down.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/125_job_ability_indicators.up.sql`（4 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/126_job_ability_competency_v2.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/126_job_ability_competency_v2.up.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/127_community.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/127_community.up.sql`（40 行）
- 完整逐行检查：完成
- 未发现问题（FK 与查询索引齐全）。

## `backend/migrations/128_knowledge_ability_point_codes.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/128_knowledge_ability_point_codes.up.sql`（9 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/129_student_honors.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/129_student_honors.up.sql`（16 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/129_user_favorites.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/129_user_favorites.up.sql`（17 行）
- 完整逐行检查：完成
- 未发现问题（(user_id, target_type, target_id) 唯一防重复收藏）。

## `backend/migrations/130_drop_ability_category.down.sql`（10 行）
- 完整逐行检查：完成
- 未发现问题（回滚从 attributes 近似还原 category，注释说明局限）。

## `backend/migrations/130_drop_ability_category.up.sql`（17 行）
- 完整逐行检查：完成
- 未发现问题（映射+去重正确）。

## `backend/migrations/131_industry_dict_seed.down.sql`（101 行）
- 完整逐行检查：完成
- 未发现问题（按 (code,name) 精确匹配删除，保留用户自建/改名行业）。

## `backend/migrations/131_industry_dict_seed.up.sql`（105 行）
- 完整逐行检查：完成
- 未发现问题（CROSS JOIN tenants + ON CONFLICT DO NOTHING）。

## `backend/migrations/132_daily_exam_grading.down.sql`（7 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/132_daily_exam_grading.up.sql`（7 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/133_exam_activation_mode.down.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/133_exam_activation_mode.up.sql`（43 行）
- 完整逐行检查：完成
- 未发现问题（状态归一化 + 两路回填均有 COALESCE 兜底；::uuid 强转依赖应用侧写入合法性，可容忍）。

## `backend/migrations/134_period_slot_type.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/134_period_slot_type.up.sql`（10 行）
- 完整逐行检查：完成
- 未发现问题（按 sort_order 回填，与默认值配合正确）。

## `backend/migrations/135_platform_settings.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/135_platform_settings.up.sql`（10 行）
- 完整逐行检查：完成
- 未发现问题（ON CONFLICT DO NOTHING 幂等）。

## `backend/migrations/136_tenant_settings.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/136_tenant_settings.up.sql`（8 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/137_resource_tags.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/137_resource_tags.up.sql`（23 行）
- 完整逐行检查：完成
- 未发现问题（UNIQUE(tenant_id, resource_type, resource_id, tag_id) 防重复绑定）。

## `backend/migrations/138_teaching_plan_content_mgmt.down.sql`（4 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/138_teaching_plan_content_mgmt.up.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/139_perf_reference_indexes.down.sql`（8 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/139_perf_reference_indexes.up.sql`（10 行）
- 完整逐行检查：完成
- 未发现问题（反向引用索引，消除相关子查询全表扫描，注释说明用途）。

## `backend/migrations/140_tenant_fk_cascade.down.sql`（20 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/140_tenant_fk_cascade.up.sql`（73 行）
- 完整逐行检查：完成
- 未发现问题（先清孤儿数据再加 FK，顺序正确；alliance_dictionaries 豁免 FK 的时序原因注释充分）。

## `backend/migrations/141_lesson_batches_status_default.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/141_lesson_batches_status_default.up.sql`（4 行）
- 完整逐行检查：完成
- [P2] L4: 仅将 status 默认值改为 'open'，未回填存量 `status='active'` 的行；若迁移前已有绕过 handler 写入的 'active' 行，升级后仍与 Go 侧 open/closed 两态冲突（最佳实践: 补一条 `UPDATE lesson_batches SET status='open' WHERE status='active'` 回填）。

## `backend/migrations/142_partner_enterprise.down.sql`（29 行）
- 完整逐行检查：完成
- 未发现问题（注释明确 up 中 TRUNCATE 数据不可恢复）。

## `backend/migrations/142_partner_enterprise.up.sql`（80 行）
- 完整逐行检查：完成
- [P2] L67-80: 迁移末尾 TRUNCATE 联盟模块全部业务表（含 partner_enterprises），属破坏性数据重置；注释说明为产品决策，但无备份/导出动作，且 down 无法恢复（最佳实践: TRUNCATE 前输出受影响行数到日志，或提供备份 SQL）。

## `backend/migrations/143_task_review_step_assigned_users.down.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/143_task_review_step_assigned_users.up.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/144_alliance_agreement_is_public.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/144_alliance_agreement_is_public.up.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/145_cobuild_source_mark.down.sql`（9 行）
- 完整逐行检查：完成
- 未发现问题（先删索引/约束再删列，顺序正确）。

## `backend/migrations/145_cobuild_source_mark.up.sql`（13 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/146_expert_account_grant.down.sql`（4 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/146_expert_account_grant.up.sql`（42 行）
- 完整逐行检查：完成
- [P2] L26: `TRUNCATE alliance_experts CASCADE` 会连带 TRUNCATE 所有引用 alliance_experts 的表（TRUNCATE CASCADE 语义），包括 alliance_brands（103 建的 expert_id FK）与 alliance_expert_mentor_links；142 已先行清空联盟数据故当前无实际损失，但 CASCADE 的连带清空范围大于注释"专家档案清空（影子账号关联随 FK 级联删除）"的描述（最佳实践: 在注释中明确 CASCADE 连带表范围，或显式列出）。

## `backend/migrations/147_job_run_logs.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/147_job_run_logs.up.sql`（11 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/147_tenant_ai_configs.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/147_tenant_ai_configs.up.sql`（9 行）
- 完整逐行检查：完成
- 未发现问题（api_key_encrypted 加密存储，符合密钥红线；tenant_id PK + ON DELETE CASCADE）。

## `backend/migrations/148_tenant_validity.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/148_tenant_validity.up.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/149_ai_usage_logs.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/149_ai_usage_logs.up.sql`（12 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/149_version_normalize.down.sql`（3 行）
- 完整逐行检查：完成
- 未发现问题（不可逆迁移显式声明）。

## `backend/migrations/149_version_normalize.up.sql`（31 行）
- 完整逐行检查：完成
- 未发现问题（plpgsql 函数定义正确，更新后即 DROP，幂等性由函数语义保证）。

## `backend/migrations/150_partner_enterprise_enable_public_default.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/150_partner_enterprise_enable_public_default.up.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/151_alliance_dict_backfill.down.sql`（52 行）
- 完整逐行检查：完成
- 未发现问题（近似回滚有明确说明与保护条件）。

## `backend/migrations/151_alliance_dict_backfill.up.sql`（55 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/152_subscription_ai_token_quota.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/152_subscription_ai_token_quota.up.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/153_brand_rank_configs.down.sql`（1 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/153_brand_rank_configs.up.sql`（12 行）
- 完整逐行检查：完成
- 未发现问题（UNIQUE(tenant_id, major_id)）。

## `backend/migrations/153_workspace_menu_default.down.sql`（6 行）
- 完整逐行检查：完成
- 未发现问题（#- 幂等）。

## `backend/migrations/153_workspace_menu_default.up.sql`（13 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/154_remove_mentor_links.down.sql`（16 行）
- 完整逐行检查：完成
- 未发现问题（重建表，数据不可逆已注释）。

## `backend/migrations/154_remove_mentor_links.up.sql`（21 行）
- 完整逐行检查：完成
- [P2] L6-17: assigned_user_ids 重映射用 `ARRAY(SELECT ... JOIN ...)` 整体替换数组，数组中无法映射到 expert.user_id 的 id（如混入的普通教师 id，或 mentor_links 中 e.user_id IS NULL 的项）会被静默丢弃，而非保留；若某步骤数组同时含影子账号与真实账号，真实账号分配将丢失（最佳实践: 保留未映射 id：`SELECT COALESCE(e.user_id, a.id) FROM unnest(...) a LEFT JOIN ...`）。

## `backend/migrations/155_cleanup_shadow_accounts.down.sql`（2 行）
- 完整逐行检查：完成
- 未发现问题（不可逆已注释）。

## `backend/migrations/155_cleanup_shadow_accounts.up.sql`（21 行）
- 完整逐行检查：完成
- [P2] L21: 按 `username LIKE 'em\_%' AND platform='portal'` 模式批量 DELETE users；若存在非影子账号但用户名以 em_ 开头（portal 平台）的正常用户将被误删（注释已说明按命名规则限定，但该模式本身非精确匹配，无法校验 uuid 段格式）（最佳实践: 用正则 `username ~ '^em_[0-9a-f]{8}_[0-9a-f]{8}$'` 精确匹配影子账号命名规则，并在删除前输出将删数量）。

## `backend/migrations/156_job_position_type_semantics.down.sql`（4 行）
- 完整逐行检查：完成
- 未发现问题（近似还原已注释）。

## `backend/migrations/156_job_position_type_semantics.up.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/157_resource_creator_retain.down.sql`（19 行）
- 完整逐行检查：完成
- [P2] L5/L9/L13: down 恢复 `creator_id SET NOT NULL`，但 up 已把该列改为可空（用户删除后置 NULL）；一旦 up 应用后确有 creator_id 为 NULL 的行，回滚会在 SET NOT NULL 处失败（158 down 对同类风险有注释，此处未说明）（最佳实践: down 注释该回滚前提，或先清理 NULL 行）。

## `backend/migrations/157_resource_creator_retain.up.sql`（22 行）
- 完整逐行检查：完成
- 未发现问题。

## `backend/migrations/158_snapshot_versioning.down.sql`（16 行）
- 完整逐行检查：完成
- 未发现问题（回滚失败前提已注释）。

## `backend/migrations/158_snapshot_versioning.up.sql`（50 行）
- 完整逐行检查：完成
- 未发现问题（快照表不加 FK 为有意设计并有注释；删题保护逻辑正确）。

## `backend/migrations/159_temp_exam_published.down.sql`（5 行）
- 完整逐行检查：完成
- 未发现问题（近似回滚已注释）。

## `backend/migrations/159_temp_exam_published.up.sql`（7 行）
- 完整逐行检查：完成
- 未发现问题。

---

## 复用候选
1. alliance_dictionaries 种子数据在 `108_alliance_dict_seed.up.sql`、`151_alliance_dict_backfill.up.sql` 两处 SQL 以及后端 `store/tenants.go` 的 allianceDictSeedSQL（151 注释自述）三处重复维护 40 条字典（dict_type/code/name/sort_order）→ 可抽取为单一权威数据源（如共享 SQL 常量/文件），三处引用。
2. "租户级种子回填"模式（`CROSS JOIN tenants t` + `ON CONFLICT ... DO NOTHING`）在 `108_alliance_dict_seed.up.sql`、`131_industry_dict_seed.up.sql`、`151_alliance_dict_backfill.up.sql` 三处重复 → 可抽公共 SQL 模板或脚本参数化。




---

# 修复状态与验证结论（2026-08-14）

## 修复概览

- **P0：1/1 已修复**（联盟专家 UpdateMyExpert 部分更新清空 user_id/enterprise_id → 抽公共 `applyExpertPartialUpdate` 全覆盖兜底，UpdateExpert/UpdateMyExpert/UpdateSchoolExpert 三处统一）。
- **P1：74 项全部处理**（详见下列分组）。
- **分层红线：清零**——import/export/template 等 19 个 handler 的 100+ 条直写 SQL 全部下沉 store（新建 7 个 store 文件），`grep` 复核 handler 目录已无 `h.Store.Q().Query/QueryRow/Exec` 与 SELECT/INSERT/UPDATE/DELETE 字符串。
- **P2：高价值项已修复**，纯风格/低价值项按「简单优先」原则评估后不改（理由附后）。
- **复用抽象落地**：`applyExpertPartialUpdate`/`applyTaskPartialUpdate`（专家/任务部分更新）、`scanApproval`/`scanWorkflow`（扫描去重）、`derefInt/derefBool/countPtr/boolPtr`（指针工具收敛 common.go）、`formatSalaryRange`（前端 4 处薪资格式化）、`schedule-utils.ts`（周次计算 2 处）、`wouldCreateCycle`（拖拽环校验 3 处）、`fetchAllPages/listAll`（分页全量拉取统一）、`coalesceStringSlicePtr`（可清空语义）。

## 后端修复明细

### 数据完整性 / 越权（P0/P1）
| 问题 | 位置 | 修复 |
|---|---|---|
| UpdateMyExpert 部分更新清空账号/企业绑定 | handler/partner_handler.go | applyExpertPartialUpdate 全字段兜底 |
| UpdateSchoolExpert 部分更新清空学校侧字段 | handler/alliance_handler.go | 同上（校本副本保持 enterprise_id=NULL） |
| 联盟成果 is_public/createdBy 扫描后未赋值（编辑后公开开关被重置） | store/alliance_achievement_store.go | Scan/Get 补赋值 |
| 审批「all」模式并发评审历史互覆/卡 pending | handler/approval_handler.go + service/approval.go + store/approvals.go | ReviewStep 事务+行锁+锁内重算完成度 |
| approvals Create 对 *tenantID 解引用 panic（全局流程） | store/approvals.go | 仅按 id 回查 fetchApprovalByID |
| workflows Create 全局流程（NULL 租户）回查失败 | store/workflows.go | fetchWorkflowByID |
| exam_usages fetchExamUsage 忽略 tenantID | store/exam_usages.go | WHERE 补 tenant_id=$2 |
| exam_result Get 无租户 token 跳过校验 | handler/exam_result_handler.go | 任一缺失一律拒绝 |
| scenario 导出无租户归属校验 | handler/scenario_export_handler.go | 跨租户行跳过 |
| scenario_task Get 学生可读未发布任务 / List 无 scenarioId 全量 | handler/scenario_task_handler.go | 学生仅已发布 + 必须带 scenarioId |
| 任务绑定（知识/能力/资源）无租户校验（与解绑不对称） | handler/task_knowledge_ability_handler.go / task_resource_handler.go | verifyTaskTenant/checkTaskTenant |
| 协作者邀请不校验被邀请人租户 | handler/content_actions.go | Users().Get 租户校验 |
| 认证点 AbilityPointID 非 UUID 静默哈希 + 跨租户引用 | handler/certification_handler.go | 严格 UUID + 租户存在性校验 |
| schedule 导入 ClassIDs[0] 越界 panic | store/imports.go | 空切片提前报错 |
| 排课 AutoSchedule 快照与手动排课竞态重复排课 | service/affairs.go | 锁内过滤已排条目 |
| 批量评分 BatchGrade 循环单查 N+1 | handler/evaluation_result_handler.go | ids 过滤一次查 |
| resource_bindings Bind 吞 afterBind 错误 | store/resource_bindings.go | 与 Unbind 对称上抛 |
| 共建任务 UpdateTask 无部分更新兜底 | handler/partner_cobuild_handler.go + service/partner_cobuild.go | applyTaskPartialUpdate 复用 |
| 课程节点 Update 清空知识点/资源绑定 | handler/course_node_handler.go | nil 回退现有绑定（显式空数组可清空） |
| exam_handler 两个方法 claims 判空顺序（panic 风险） | handler/exam_handler.go | 先判 nil |
| 交卷覆盖教师评分竞态 | service/evaluation_result.go | 核实 SaveResult 已有 WHERE graded_at IS NULL 条件更新兜底，无需改动 |
| migration 094 跨租户回填 | backend/migrations/094_course_assessments.up.sql | 历史已应用迁移不改文件（改动会造成新旧环境不一致）；已记录 |

### 性能 / 稳定性（P1）
| 问题 | 位置 | 修复 |
|---|---|---|
| Preview LibreOffice 无超时/无并发上限、504 后孤儿进程 | handler/file_handler.go | previewSem(2) + CommandContext 绑定请求上下文 |
| ListStudentCourseScores 聚合在前过滤在后 | store/job_ability_results.go | student_courses CTE 先收敛课程范围（保持排名语义） |
| BulkUpdateScores 逐题 UPDATE | store/exams.go | unnest 单条批量 UPDATE |
| role_isolation_test 允许 200 断言形同虚设 | handler/role_isolation_test.go | 200 时逐条校验 userId 为本人 |
| store 测试夹具过期（31 列 vs 38 列 panic） | store/alliance_talent_rank_store_test.go | 补齐 7 个新列 |

### 分层红线（P1，import/export/template handler 直写 SQL）
19 个 handler 的 SQL 全部下沉，新建 store 文件：position_import_export.go / course_import_export.go / question_import_export.go / resource_import_export.go / scenario_import_export.go / exam_granular_import_export.go / template_data.go（共 130+ 个 store 方法）。

## 前端修复明细（P1）
| 问题 | 位置 | 修复 |
|---|---|---|
| 周次计算错误（6/7 月第一周算错、下拉重复） | teacher-dashboard-tab / workspace-schedule-grid | 抽 lib/schedule-utils.ts |
| 批量删除部分失败仍弹成功 | scene/archive/page.tsx | 部分失败提示 |
| 学生搜索/组织筛选只作用于当前页 | affairs/student-portraits、org-user/students | listAll 全量拉取 + 客户端分页 |
| roles 订阅 null 时静默丢弃操作权限改动 | org-user/roles/page.tsx | 与展示层同口径过滤 |
| daily-exams 切换安排旧结果未清空/竞态 | lesson-results/daily-exams | 点击时清空 + 序号守卫 |
| 同岗位多课程保存折叠丢失 | affairs/programs courses-tab | 保存前确认提示 |
| knowledge-point-form-dialog 重渲染重置表单 | knowledge-point-form-dialog | 仅打开时初始化 |
| 批量删除无状态过滤无确认 | content-list-page | 可删状态过滤 + ConfirmDialog |
| job-home 场景模式 N+1 阻塞 | components/job/student/job-home | 后台异步加载统计 |
| 公开详情页关联列表 100 条截断 | alliance achievements/brands/enterprises [id] | fetchAllPages 分页合并 |
| 企业详情页全租户无界扫描 | portal/apps/alliance/enterprises/[id] | 首页有界 + 弹窗按需补全 |
| scene-results 全量拉取/竞态/Tab 重挂载 | evaluation/scene-results | 按场景加载 + 序号守卫 + 组件外移 |
| 课程编辑器拖拽成环无限递归 | hybrid/system add + CourseNodeTree | wouldCreateCycle 拒绝 |
| hybrid 保存丢 learningGoal 等字段 | lesson/admin/hybrid/add | payload 回写 |
| exam-usage/results 50 条截断 + 详情路由错误 | evaluation/exam-usage/results | fetchAllPages + daily-exams 路由 |
| 定时窗口 datetime-local 格式后端解析失败 | evaluation/exam-usage | 提交完整 RFC3339 + 本地时区展示 |
| 批量加题 N+1 | evaluation/exams/[id] | Promise.all + 统一刷新 |
| 岗位规则列表 N+1 | evaluation/job-ability | 岗位模型去重拉取 |
| agreements 编辑页加载失败可保存覆盖 | agreements/[id]/edit | item 置 null + EmptyState |
| resource-selector limit 截断 | components/shared/resource-selector | fetchAllPages |
| zip 炸弹无解压上限 | components/shared/zip-preview | 200MB 上限中止 |
| 判断题答案显示恒错 | evaluation/question-preview | 按数组取值 |
| shuffleOptions 保存无效 | evaluation/question-form-dialog | 写入 buildFormData |
| 星级/预览按钮误触发表单提交 | task-info-card / task-description-card | type="button" |
| AI 补全携带旧值 | scene/scenarios/[id]/edit | 先同步 formRef 再发请求 |

## 评估后不改（简单优先）
- 未认证 401 vs 403 语义不一致（存量 403 不影响功能与前端判断，全量改动收益低）
- certificate_library URL NULL→空串（列语义等价，前端无区分）
- student_portrait Generate 用 context.Background（30 分钟同步任务是刻意设计，改 r.Context 反而导致 30s 超时中断生成）
- 认证项/题库「空数组=未传」等语义（前端总是全量提交，无清空需求处保持现状）
- migration 094 跨租户回填（已应用历史迁移不可改）

## 工具完善
- deploy.sh --gates 前端门禁补 pnpm test（与 AGENTS.md 二.3 对齐）
- deploy.sh 缩进修正
- AGENTS.md 四、运维速查补「打包/迁移工具」：package-release.sh、migrate_uploads.sh


## 后续批次修复明细（逐批修复→本地验证→deploy.sh 部署自动合并）

### 后端批次

| 批次 | 提交 | 内容 |
|---|---|---|
| 001-002 | 2c0281a9 | 迁移 SQL 切分器支持 $tag$ 定界符、修正误导注释、补学期 CRUD 测试 |
| 003-004 | 49ec5c96 | 里程碑/权限/字典部分更新兜底、品牌 CRUD 死代码清理、SaveBrandRankConfigs/ToggleExpertDisplay 补权限校验、审批流加载失败 500、项目 isPublic 回归测试、公开协议测试解析加固 |
| 005-006 | 032c2c08 | preAuthToken 一次性校验 LoadOrStore 原子化、课程克隆解码走 decodeBody 约定 |
| 007-008 | 201aa629 | 课程导入 findOrCreate/查询统一走传入 Queryer（事务化时同连接回滚）、exam_result errors.Is 一致化 |
| 009-010 | 3201f06d | 导入导出实体 hasCode 显式化、预览空结果独立错误、Serve 租户 ID UUID 校验 |
| 013-014 | 78051c61 | 组织类型创建校验与更新一致、共建岗位 shortName 空串可清空、scenarioTaskParams 死参数移除、专家更新密码校验前置+绑定账号租户校验、org 测试死代码清理 |
| 015-016 | 476d14e9 | 工作台节次标签死代码、测试数据补租户列、证书/能力绑定越权校验、shortName/description 可清空、收藏数错误日志、导入清理补 ability_domains、题库导出错误日志、方案导入校验、题目导出 5-8 选项列 |
| 017-018 | e78c6306 | 组织路径分隔符优先级、未知题型计入失败行、导出非法 JSON 400、用户角色绑定错误检查 |
| 019-020 | 4d5a33ae | 场景覆盖导入清空失败计入失败行、排课导入移除死参数 overwrite、周次区间解析校验、角色测试死代码清理 |
| 021-022 | a4cabf83 | 节次删除外键冲突 400、学生档案创建租户校验、排课参数组装去重 |
| 023-024 | aafe272c | 模板 preload 重复查询、扩展字段错误文案、人培方案创建丢 batchId、用户关系删除归属校验、审批流 scene 回退、metrics 流式透传 |
| 025-026 | fba2c664 | 移除被 jobViewer 组覆盖的收藏路由冗余注册、澄清企业 DELETE 语义注释 |
| 027-028 | 0d1db9df | syncExamResultScoreTx 真实错误上抛、GetQuestionBank 重复方法收敛、批次通用操作抽 sharedBatchOps（两服务 7 方法去重） |
| 029-030 | 64877ca2 | service 裸 SQL 下沉 store、绑定表/列白名单、nil 租户与 nil UserID 防护、AI 配置 extra 更新、删除语义与 code 生成错误上抛、品牌列表 limit 钳制、重复注释清理 |
| 031-032 | ecfe59d5 | 专家/批次跨租户写读下沉 SQL 约束、批次写操作带租户条件（三服务共用实现）、queryList 扫描错误上抛、draft 覆盖 RowsAffected 校验、认证查询错误日志、项目扫描去重、唯一冲突映射、死代码清理 |
| 033-042 | 546bfe99 | 扫描错误日志化/上抛、ErrNotFound 语义统一、课程克隆资源扫描与父级缺失告警、LIKE 通配符转义、Prepare 回查错误日志、字典 Update/Delete 影响行数校验 |
| 037-038/041-042 | 3f2f3791 | user_extension_fields 租户过滤补全、title_ids COALESCE 保留语义、任务测评扫描错误上抛、角色重绑事务化、租户更新 COALESCE 一致化、UsersExist 去重、管理员角色绑定影响行校验、证书库幂等回读、SaveFull 冲突回读实际行 id、教学计划 rows.Err |
| 104-105 | — | 历史已应用迁移，不改文件（避免新旧环境不一致），已记录 |

### 前端批次（P2）

| 批次 | 提交 | 内容 |
|---|---|---|
| 083-084 | 3f2f6b7f | 场景统计 majorCount 语义修正、课时展示兜底、节点类型标签单一来源（GRAPH_NODE_TYPE_LABELS 三处收敛）、死字段/死代码清理 |
| 043-044 | 8fa8809e | 类型强化、分页一致化、O(n²) 收敛、异步竞态与加载态修复 |
| 045-050 | 3660147b | evaluation 批次（工作台四 Tab、登录页、任务链建议、bank-form-dialog 等 36 文件） |
| 051-062 | 7d6c3ffd | lesson-alliance 批次（39 文件：类型弱化/as any 去除、竞态序号守卫、下拉截断改用 fetchAllPages/listAll、死代码清理、NaN 兜底、错误态与 notFound 分离） |
| 063-078 | e22f2f94 | portal-alliance-scene 批次（36 文件：类型强化、竞态防护、加载态、死代码、复用收敛） |
| 079-103 | b4817454 | components-packages 批次（55 文件：evaluation 三弹窗、evaluation-rules、job/position-builder 6 文件、lesson/portal/providers/scene、shared 组件 14、hooks/lib 5、packages 11、vitest 配置——纯 updater/竞态防护/死代码清理/类型收紧/fetch-all 分页熔断） |
| 047-048 遗留 | 5bb91020 | examFromSnapshot 三处收敛共享 lib/exam-snapshot.ts（去 any）、题型标签复用 QUESTION_TYPE_LABELS、用户反查与提交计数改 listAll 防截断（saveFailed 复位/0 分题排除已在 045-050 修好，复核未动） |
| 051-052 遗留 | 8eb944e6 | learn-roads 编辑竞态（场景/任务计数移到序号守卫后落状态）、保存提示定时器卸载清理、学习路径列表缓存复用（编辑不再重复全量拉取） |
| 055-056 遗留 | 191b668d | 现场问答页专业列表改 fetchAllPages 全量拉取防截断（其余 21 项 P2 已由 051-062 批次修复：live 预览 cancelled/fetchAllPages、creatorName 优先、冗余 IIFE 移除、搜索定时器句柄化、ability 双层 try 收敛、majorNameMap useMemo、statCount 用 total、landing 时间窗口漂移、搜索词关闭重置、上传中忽略追加、kp code 防碰撞、my-resources 加载态守卫等） |
| 089-090 遗留 | （并入 fix-batch-1） | eval-method-card 提交满分改读 resourceConfig.maxScore（缺失兜底 100）；其余 13 项 P2 已由 079-103 批次修复（knowledge-selector 全量分页/编辑同步/readOnly 删除按钮守卫/kp code 随机后缀、grading-card 分数外部同步、image-editor loaded 关闭重置、image-list addUrl 走 valueRef） |
| 075-076 遗留 | （并入 fix-batch-1） | 雇主品牌引用岗位/学生弹窗 limit=200 截断改 fetchAllPages、superadmin JWT 解码两处收敛 parseJwtPayload、双 alliance-detail-shell 补边界注释；其余已由 063-078 批次修复（AI 字段 trim 兜底、克隆权重剩余分配不超 100、reorder/persistWeights 失败提示、主题色请求 catch、enablePublic 保存失败回滚、空 cleanup effect 与死注释清理、salaryText 收敛 formatSalaryRange） |
| 071-072 遗留 | （并入 fix-batch-1） | 教师画像列表 limit=200、场景归档/审批页 limit=1000 三处改 fetchAllPages 全量拉取；其余已由首轮大修复与 063-078 批次修复（周次计算抽 schedule-utils、批量删除失败不弹成功 toast、roleConfigs 死代码/张老师/12.5% 徽标清理、能力点详情双重断言修正、账号安全图标下标耦合移除） |
| 065-066 遗留 | （并入 fix-batch-1） | 登录/操作日志搜索改 fetchAllPages 分页全量拉取（后端 limit 上限 200，原单次 10000 被静默钳制导致搜索截断）；其余已由 063-078 批次修复（里程碑双重拉取去重、学校页失败态+重试、accounts 搜索回第一页+翻页清选择、positions 关联用户数用 userCount+仅展示前 N 提示、relations 搜索防抖、org-structure 总人数递归） |
| 081-082 | 无需补修 | 15 项 P2 全部由 079-103 批次修复（AI apply 走 positionRef 最新快照、空名删职责同步清绑定、Escape 取消编辑、polish 可选链 trim、blob URL revoke、任职要求稳定 key、score-config 整数输入+仅打开时初始化、progress-dialog currentStep<0 契约、onView 走 basePath、分组锚点用职责 id） |
| 035-036 遗留 | （并入 fix-batch-2） | portal.go 17 处行扫描吞错补 Warn、partner_store 4 处 JSON 解析吞错补 Warn、导入 findOrCreate 插入/回查错误补 Warn、删除无租户且无调用方的 NodeEvaluationResult.Get（Submit 回读改走 GetByID 租户限定）；4 个 P1 均已在首轮大修复解决（imports ClassIDs panic、fetchExamUsage 补租户、聚合先过滤、BulkUpdateScores unnest） |
| 039-040 | 无需补修 | 7 项 P2 均无需代码修改：scheduling 6 处列表扫描已带 Warn（546bfe99 批次）、场景/职称删除与更新无 SQL 租户条件（handler 层 verifyTenantOwnership/crud CheckOwnership 已覆盖）、排课批量插入与快照颗粒课 N+1 属低频管理路径、快照唯一约束不含租户实际不可达 |
| 067-068 遗留 | （并入 fix-batch-2） | 教师列表职称 Badge key 改用职称 id；其余已由大修复与 063-078 批次修复（roles 订阅 null 同口径、payload 仅提交可编辑字段、openUsersDialog 独立错误态、学生/教师密码 type=password、refetch 移入 try、industries parentMap 索引化+空值 toast、tenant as any 改类型断言、login doLogin 失败清 token、管理员初始密码引导语） |
| 095-096 | 无需补修 | 6 项 P2 已由 079-103 批次修复（alliance-dicts 失败不缓存、job-converters 区间单调、format-utils Windows 11 build 判定）；alliance-links 部分同步需后端批量端点、evaluation-rule-store 类型建模、external-links 演示地址默认值属部署配置项，均评估后不改 |
| 097-098 | 无需补修 | 4 项 P2 全部由 079-103 批次修复（vitest include 覆盖 mobile-access-url/module-serialize 两个漏跑测试 + alias 补全 7 条路径、saveEvaluationMethods 类型收紧 TaskEvaluationMethod[]） |
| 077-078 遗留 | （并入 fix-batch-2） | auth-provider fetchMe 仅对 401/403 清 token（瞬时错误不再误踢登录）；其余已由 063-078/大修复处理（job-brand 引用岗位并行创建、salaryText 四处置换 formatSalaryRange）；企业信息表单双份/卡片外壳 class 8 处/题库试卷弹窗 180 行同构属复用重构，评估后不改 |
| 049-050 遗留 | （并入 fix-batch-2） | 评分详情用户反查改 listAll、岗位归档批量删除改 allSettled 汇总；其余已由大修复与 045-050 批次修复（scene-results 序号守卫/TaskMethodTabs 模块级外移、题库批量删/复制 allSettled、头部数量用实时统计、可选 finally 出链、DrawnQuestionCard key 收敛） |
| 101-102 | 无需补修 | 19 项 P2 已由 079-103 批次修复（library metadata→unknown、status failed/failure 双键收敛、combobox label→value + 关闭清搜索、import-confirm busy 拦截关闭、import-wizard input 重置 + 取消禁用、mixed-tag 死代码与 JSON.stringify 比较移除）；scene-mock 已 deprecated 但仍被 3 个任务编辑页引用（迁移属中改）、status 中英键配色差异、scene/snapshot jsonb any 结构、PlatformSideNav effect 依赖等评估后不改 |
| 053-054 遗留 | （并入 fix-batch-2） | hybrid 能力点池改 fetchAllPages；其余已由大修复与 051-062 批次修复（拖拽成环 wouldCreateCycle、hybrid evalData 全字段回写、save-utils 可清空+NaN 兜底、测试数据正式类型、临时 ID 统一判定、知识点克隆池外 knowledgePointNames 兜底、课程缓存击穿参数与死代码/死 prop 清理、保存后 idMapping 重映射）；模块序列化 any 类型、learn 页 limit 1000、hover 动态类属评估后不改 |
| 037-038 遗留 | （并入 fix-batch-3） | scenario_clone 5 处行扫描吞错补 Warn、question_banks Create 补 beginner nil 校验、resource_codes Get 映射 ErrNotFound+删残留注释；其余已由大修复与 033-042/029-030 批次修复（Bind afterBind 上抛、SaveFull 冲突回读实际 id、LIKE 通配符转义、Prepare 回查 Warn、random_draw/recommends ErrNotFound、绑定表/列白名单、roles Assign 影响行校验） |
| 103 | 无需补修 | 4 项 P2 全部由 079-103 批次修复（EmptyDescription 类型改 div、FieldTitle data-slot 改 field-title、use-import-flow entityLabel 用于错误提示、ui vitest alias 改通用 @ 映射）；Spinner 收敛与 Radix 动画串两处复用候选评估后不改 |
| 033-034 遗留 | 7779f08a | 字典通用基类 DictStore Update/Delete 影响行数校验（ErrNotFound）、ExamResult Get 统一 ErrNotFound（handler 两处检查同步）、批量评分与单条评分错误语义统一（409 提示刷新） |

### 新增复用抽象（补充）
- 后端：sharedBatchOps（岗位/测评/场景三服务共用批量操作）、ReviewStep/LockApproval/SetHistory（审批并发评审）、scanApproval/scanWorkflow（扫描去重）
- 前端：GRAPH_NODE_TYPE_LABELS（知识图谱节点标签单一来源）、formatSalaryRange、schedule-utils.ts、fetchAllPages/listAll（分页全量拉取统一入口）、lib/exam-snapshot.ts（试卷快照转换三处收敛）

### 评估后不改（033-034 补充，简单优先）
- community.go COUNT/列表 where 条件双份维护（纯重构无行为缺陷，两处紧邻可同步改，收益低）
- content_actions_test.go transitionMatrix 与实现常量双份定义（测试副本作为独立规格，防实现漂移被同源掩盖）
- course_assessments.go CreateTempExam 与 course_nodes.go Delete 的 check-then-act（低频竞态、非核心，发布流程已有 CAS 兜底，符合「普通业务允许报错或重复插入」）
- courses.go Delete 中不可达的 course_evaluation_results 防御性 DELETE（保留作为删除保护变更时的兜底）
- exam_results.go FetchUserProfile 吞错（提交主链路稳定性优先：姓名查询失败不阻断交卷，宁缺名字不断流程）
- partner 共建任务链 listEvaluationMethods 每任务一次请求（N+1，需后端新增批量接口；非核心流程，容忍，见 057-058）
- 公开 landing 资源库 fetchAllPages 全量拉取 + 前端筛选（服务端筛选需后端配合；公共页非核心，容忍，见 055-056）
- lesson/landing 混合课/颗粒课无分页全量渲染（课程量大时 DOM 开销；大规模改造，容忍，见 055-056）
- library/knowledge 编辑时新建颗粒课立即落库（产品交互决策：不经保存即关联，保持现状，见 055-056）
- my-resources 五列表单页 limit 200 截断（banner 已有提示 + TODO；服务端分页属大规模改造，容忍，见 055-056）
- question-grading-card 对学生答案/正确答案动态文本调用 t()（未命中回退原文，语义不当但无害，见 089-090）
- knowledge-selector 挂载即拉颗粒课/岗位/场景 + 岗位筛选 Promise.all 无并发上限（非核心交互，场景数通常有限，见 089-090）
- landing-filter-row/landing-pagination ACCENT_CLASSES 双份映射（仅 2 处，报告自评未达复用阈值，见 089-090）
- eval-method-card t(中文标签) 依赖「中文即 key」约定（存量 i18n 约定，改造成本高收益低，见 089-090）
- 场景任务链保存路径按任务串行 2-3 个 API（并行化涉及 409 重试/权重时序，改造风险高，任务链通常短，容忍，见 075-076）
- handleSaveDraft/handleFinish 主体重复（30 行小重复，清晰可读，不抽，见 075-076）
- 双 alliance-detail-shell 平行实现（合并为单一壳属视觉重构，已补注释说明边界，见 075-076）
- workspace 教师课程/期末总评等演示 mock 空数据与硬编码跳转链接（数据接入真实 API 前保留演示占位，属产品排期，见 071-072）
- workspace-schedule-grid YearView 事件归属占位伪逻辑（同演示占位，见 071-072）
- 登录/操作日志两页约 370 行重复（抽共享 LogPage 属中度重构，两页仅 API/列不同，容忍，见 065-066）
- graduates 毕业年份筛选仅当前页（需后端 user 列表支持 graduateYear 参数，客户端全量拉取成本高，容忍，见 065-066）
- 批量导出/导入占位按钮 5 处重复（纯占位即将上线，不抽象，见 065-066）
- 五级能力等级常量 4 文件重复（四份形态各异：label/描述/颜色/en 对照，统一需超集建模且等级阶梯固定，评估后不改，见 081-082）
- Date.now+random 临时 id 生成 3 文件重复（碰撞风险已用随机后缀缓解；统一替换 uid 属机械改动，评估后不改，见 081-082）
- exams.go 题目增删改分未带租户条件（handler 已先按租户 fetchExam 校验，SQL 层补租户属纵深防御，见 035-036）
- dict 类 store（industries/majors/org_types/on_site）与 organizations Get/Update 无 SQL 租户限定（crud 框架 CheckOwnership 与 org handler verifyTenantOwnership 已覆盖，越权不可达，见 035-036）
- exam_usages SyncScheduledExamUsageStatus 全表 UPDATE（60s 节流 + 状态幂等，容忍，见 035-036）
- favorites ToggleFavorite TOCTOU 计数漂移与 NextAutoUsageName COUNT+1（普通业务，指南允许，见 035-036）
- lesson_content CitationStats 每知识点 4 子查询与 imports 逐名 2-3 条 SQL（管理页低频操作，容忍，见 035-036）
- portal.go 统计查询 nil 租户返回全平台计数（handler 恒传租户，nil 分支不可达，见 035-036）
- ListCooperation jsonb enterprise_ids 过滤依赖 GIN 索引（已有索引则无影响，仅提示，见 035-036）
- tenant 联系电话输入双写 phone/contactPhone（需确认后端两字段语义，评估后不改，见 067-068）
- roles generateRoleCode 依赖前端列表计算后缀（列表加载失败时可碰撞；需后端生成编码，低概率，见 067-068）
- school-admin-manager 初始密码 toast 明文（一次性告知 + 已引导立即修改，属产品设计，见 067-068）
- alliance-links 协议/项目同步串行 2×N 且失败部分同步（需后端批量端点，非核心低频，见 095-096）
- evaluation-rule-store resourceConfig 用 Record<string,any>（窄接口建模属大规模类型改造，见 095-096）
- external-links 六平台地址默认回退演示环境（部署需配置 NEXT_PUBLIC_* 环境变量，属部署配置项，见 095-096）
- navigation-config sideNavItems/userMenuItems、menu-permissions 审批 actions、resource-type-constants 四张并行映射等 4 处复用候选（机械重构，漂移风险低，评估后不改，见 095-096）
- api-helpers requestWithPlatform/authedFetch 401 逻辑双份、import-export exportByIds、alliance CRUD 工厂、schoolList 等 4 处复用候选（机械重构，漂移风险低，评估后不改，见 097-098）
- scene-results/[id] EvalPointGradingCard/ScoreRuleGradingCard 约 80 行重复与 job/approvals fetchAllPages 4 处重复（复用重构，评估后不改，见 049-050）
- job/landing 场景任务 N+1 与 LoginPrompt 双份（需后端批量接口/未达阈值，见 049-050）
- scene-mock.ts 已 @deprecated 但仍被 3 个任务编辑页引用（迁到 scene.ts 需动 3 个大文件，评估后不改，见 101-102）
- status.ts ready/待发布、in_progress/进行中 中英双键配色差异与 已完成/已结课 双字面量（不同页面数据源使用不同键，统一属视觉/数据迁移，见 101-102）
- scene.ts/snapshot.ts jsonb 镜像 Record<string,any> 20+ 处（快照自由结构，收紧需逐字段 schema 建模，见 101-102）
- 路径激活匹配逻辑 5+ 处内联重复与 PlatformSideNav effect 依赖/展开态（跨包复用重构，漂移风险低，见 101-102）
- module-serialize/evalData/learn 页多处 Record<string,any> 与 as any（序列化自由结构类型建模，见 053-054）
- lesson/landing/[id]/learn 节点/模块 limit 1000（超大课程边缘场景，容忍，见 053-054）
- system/add hover 动态 Tailwind 类（纯样式，构建期无法提取，人工确认，见 053-054）
- node-evaluation-results 前端 evaluateeId 可空（后端已强制学生按 claims.UserID 过滤，无泄露，见 053-054）
- position_bindings/certificates 等 store 无租户限定方法（handler 层已核验归属校验，建议注释标注契约，评估后不改，见 037-038）
- position_clone/scenario_clone 克隆骨架与 FetchPosition 重复、question_banks fetch 三份扫描体（事务内低频克隆与 20 列扫描重构，见 037-038）
- questions BatchCreate GenerateEntityCode 无重试（低概率碰撞、批量导入低频，见 037-038）
- random_draw/resource_library Delete 的 withTxStore 无 beginner nil 校验（生产恒为 Store，测试 fake 未触发，见 037-038）

## 验证结论
- 后端：gofmt 0 违规；go vet ./... 通过；go build ./... 通过；store/middleware/cache/crypto/geo/mask 单测通过（含修复后的品牌夹具测试）
- 前端：pnpm typecheck 4 包通过；pnpm lint 0 错误；pnpm test 97/97 通过
- 后续批次：每批均经 deploy.sh 质量门禁（后端 gofmt/go vet/go build/store 测试；前端 typecheck/lint/pnpm test）后合并 master；最后一轮 079-103 单测 104/104、ui 5/5、api-client 9/9、shared-types 2/2 全过
- 收尾：全部批次修复完成后统一执行 UI 冒烟巡检（见会话最终报告）
