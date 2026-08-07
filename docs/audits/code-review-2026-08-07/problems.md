# 知与 SaaS 全量代码审查问题清单（2026-08-07）

> 审查范围：前后端全部源码 **980 个文件、约 20 万行**，逐文件、逐行完整通读。
> 审查原则（依 AGENTS.md 与本次要求）：简单优先不过度防御；安全只排高危；性能与稳定性优先；容忍 hacker 行为；锁只给核心业务。
> 审查方法：27 个批次并行逐行通读（清单见 [`checklist.md`](./checklist.md) 全部 `- [x]`），每批次原始逐行记录见 [`raw/`](./raw/)。
> **回查验证**：本清单生成后，已对全部 P0/P1 条目逐条重新回到代码确认（标注「已回查确认」「回查降级」「回查排除」）。

## 统计总览

| 严重级 | 数量 | 说明 |
|--------|-----|------|
| P0 高危 | **4** | 运行时必错（均回查确认） |
| P1 严重 | **82** | 原始记录 82 条（其中 1 条为 service 双 agent 重复报告）；去重后 80 条已逐条回查：**误报排除 2、降级 5，实际确认 P1 73 条** |
| P2 重要 | **458** | 边界、竞态、性能、错误吞掉、一致性（详见第三章） |
| P3 一般 | **911** | 死代码、风格、重复、类型 any、测试瑕疵（统计见第四章，明细在 raw/） |
| **合计** | **1454** | 已对全部 980 个文件逐行通读 |

**分层规范核查结论**：豁免冻结区（import/export/template）外，handler 均无裸 SQL 字符串、无 `db.Query/QueryRow/Exec` 直调、无 `*pgxpool.Pool` 字段，`handler→service→store→domain` 分层合规。

---

## 一、P0 高危（4 条，全部回查确认）

| # | 位置 | 问题 | 最佳实践方案 |
|---|------|------|--------------|
| 1 | `backend/cmd/migrate/main.go:211-241` | `isMultiStatement` 以 `;\n` 计数切分 SQL，任何含 `DO $$` 块或语句内分号换行的迁移都会被切碎成孤立语法错误语句；且 multi-statement 路径**非事务**、逐条执行，中途失败留下半迁移状态且版本未记录，重跑不可续。**已回查确认**（`001_baseline.down.sql` 即命中） | 用 pgx 多语句单 Exec（一次提交）替代手工 Split；或迁移执行器整体改为 psql -f / 单事务执行 |
| 2 | `backend/migrations/001_baseline.down.sql:1-9` | `DO $$ ... $$` 回滚块会被执行器按 `;\n` 切碎成 4 段语法错误语句，baseline 无法用 migrate 工具回滚。**已回查确认** | 改写为逐条 `DROP TABLE IF EXISTS`/`DROP TYPE IF EXISTS` 语句 |
| 3 | `backend/internal/store/exam_results.go:268` | `FetchUserProfile` 引用 `u.grade`，但 `users` 表**不存在 grade 列**（已全量核对 baseline:1289 及全部增量 migration）。考试交卷必经此函数（service/evaluation_result.go:113）→ **交卷接口必 500，考试无法提交**。**已回查确认** | 删除 `u.grade` 引用（grade 只存在于 exam_results/job_ability_results 表）；确有年级需求则先补 migration |
| 4 | `backend/internal/handler/schedule_import_handler.go:619-626` | 旧格式排课导入 INSERT 目标列 20 个（无 class_node_ids 列）而 VALUES 提供 21 个表达式（含多余的 `ARRAY[$9::uuid]`），PG 必报 `INSERT has more expressions than target columns`，旧格式导入每行必失败（HTTP 200 但 failed 全量递增）。**已回查确认**（092_affairs.up.sql 表结构无 class_node_ids） | 删除 `ARRAY[$9::uuid]` 表达式，使列数与 VALUES 对齐（与其他导入路径一致） |

---

## 二、P1 严重（82 条原始记录，去重 80 条，已逐条回查）

### A. 越权 / 租户隔离缺失（23 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `store/ability_domains.go:26-35,52-70` | Get/Update/Delete 无 tenant_id 过滤，可跨租户读写删能力域 | 已确认 | 方法签名加 tenantID，`WHERE id=$n AND tenant_id=$n` |
| `store/evaluation_methods.go:23` | `ListCategories` 无租户过滤，表有 tenant_id 列，任意登录用户可见全部租户评价分类 | 已确认 | 加 tenantID 参数 + `WHERE tenant_id=$1` |
| `store/evaluation_methods.go:169-180`（appeal Create） | `appeal_handler.go:93` req.UserID 直接来自请求体，未校验目标用户租户，可跨租户构造申诉 | 已确认 | 按 userID 查用户校验 tenant_id，或改由 claims.UserID 决定 |
| `store/positions.go:478,487,497` + handler `GetFavorite/ToggleFavorite/ListFavorites` | 收藏/计数/切换均无租户校验；`position_favorites` 无 tenant_id 列，收藏他租户岗位后列表可跨租户读出岗位数据 | 已确认 | 增 tenant_id 列或 Toggle 前校验 `career_positions.tenant_id` |
| `store/positions.go:90` | `FavoritesListConfig` 未设 TenantScoped，跨租户收藏列表泄露 | 已确认 | 前置 `cp.tenant_id = 当前租户` 过滤 |
| `handler/community_handler.go:140-157` | `ListReplies` 整条链路无租户校验（GetTopic/CreateReply 均传租户，唯独此处漏），凭 topicID 可读他租户帖子回复 | 已确认 | 加 tenantID 参数，store 按 (topicID, tenantID) 校验话题归属 |
| `handler/course_handler.go:417-424` | `Assessments` 的 `verifyTenantOwnership(w, r, *claims.TenantID)` 传入调用者自身租户，与己比对恒真，归属校验形同虚设；fetchCourse 无租户过滤 | 已确认 | 传取回课程的 tenant_id 比对，或改用 `GetCourseDetailInTenant(id, tenantID)` |
| `handler/exam_result_handler.go:151-167` | `Grade` 先写入后校验租户：service 层按 id 直查直改，handler 在写入完成后才比对返回 404——跨租户用户凭 result id 可**改他租户考试分数** | 已确认 | 评分前先按 id+tenant 校验归属，或 service 传入 tenantID 在 store 过滤 |
| `handler/job_ability_result_handler.go:268-305` | `Get` 详情无学生归属校验（List 强制本人，Get 无），同租户学生可读他人能力点明细/历史评级/学号 | 已确认 | 学生角色强制 `row.UserID == claims.UserID` |
| `handler/micro_cert_handler.go:215-245` | `IssueCerts` 未校验 req.UserIDs 的租户归属，可对他租户用户颁发证书；不存在 user_id 触发 FK 500 | 已确认 | store 内 `SELECT ... FROM users WHERE id=ANY($1) AND tenant_id=$2` 数量校验 |
| `handler/position_ability_handler.go:68-83` | `CreateBinding` 创建前未校验岗位/职责/能力点租户归属（Update/Delete 均校验，创建漏） | 已确认 | 创建前 `PositionTenantID` + `verifyTenantOwnership` |
| `handler/position_certificate_handler.go:41-46` | `List` 整条链路无租户过滤且挂在 jobViewer（含学生）组，可枚举他租户岗位证书 | 已确认 | List 前校验 careerPositionId 归属或 store 加租户过滤 |
| `handler/position_certificate_handler.go:79-86` | `Create` 不校验 CareerPositionID 租户归属，可把证书挂到他租户岗位；TenantID 为 nil 时空租户落库 | 已确认 | 创建前 `PositionTenantID` + 校验，不满足返回 403 |
| `handler/position_certificate_handler.go:109-122` | `Update` 只校验原证书岗位租户，新 CareerPositionID 无校验，可把证书改绑到他租户岗位 | 已确认 | 对请求中新 CareerPositionID 同样校验归属 |
| `handler/certification_handler.go:190-219` | `UpdateRule` 未校验新 careerPositionID 租户归属（CreateRule 校验了，Update 漏） | 已确认 | UpdateRule 前补 `PositionTenantID` + `verifyTenantOwnership` |
| `handler/alliance_handler.go:178-188` | `UpdateEnterpriseAgreement` 全列覆盖，部分更新清空 name/status（指针字段被置 NULL） | 已确认（范围修正：非指针字段必清、指针字段置 NULL） | 参照 enterpriseCRUD 的 ValidateUpdateExisting 先 Get 回退缺失字段 |
| `handler/alliance_handler.go:308-316` | `UpdateMilestone` 全列覆盖，仅勾选 is_completed 的局部请求清空全部其余字段 | 已确认 | 同 ValidateUpdateExisting 回退模式 |
| `handler/question_bank_handler.go:186` | `Update` 的 KnowledgePointIds 是唯一未做 nil→existing 默认化的字段，store 先删后重建绑定 → 前端省略该字段即清空题库全部知识点绑定 | 已确认 | `if req.KnowledgePointIds == nil { req.KnowledgePointIds = existing.KnowledgePointIDs }` |
| `store/scenarios.go:66-75` | `Get` 无租户过滤 | 回查降级 P2：handler 主路径 Get 有 `verifyTenantOwnership`，但 store 契约脆弱、部分调用点无校验 | `Get(ctx, id, tenantID)` 或单独公开读方法 |
| `store/positions.go:105` | `Get` 无租户过滤 | 回查降级 P2：handler 主路径有校验（488 行等调用点吞错），store 契约脆弱 | 加 tenantID 参数 |
| `store/dict_store.go:56-85` | 基类 GetByID/Update/Delete 无租户参数，SQL 为配置注入，嵌入方不覆盖即跨租户 | 回查降级 P2：crud 框架 CheckOwnership 已保护当前 roles/staff_titles 等嵌入方；属架构风险 | 基类强制租户参数（DictConfig 增租户列配置自动拼条件） |
| `store/alliance_store.go:55-73` | `UpsertSchoolInfo` 的 nilToEmpty 是空操作，空 ID 时 `''::uuid` 必 500 | 回查降级 P2：当前无前端调用方（学校页直接改 tenant），死代码潜在缺陷 | nilToEmpty 返回 nil 或 SQL 用 `COALESCE(NULLIF($1,''), gen_random_uuid())` |
| `store/alliance_project_store.go:197-200` | `DeleteMilestone` 声称 tenantID 未使用 | **回查排除（误报）**：SQL 实为 `WHERE id=$1 AND tenant_id=$2`，已正确传参 | — |

### B. 鉴权 / 敏感信息（5 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `packages/api-client/src/api-helpers.ts:122-139,250-261` | JWT 令牌明文存 localStorage（zhiyu-token/zhiyu-portal-token），XSS 可窃取会话（含 preAuthToken） | 已确认 | 改 httpOnly+Secure cookie（需后端 Set-Cookie），或缩短 TTL + refresh token |
| `backend/internal/cache/middleware.go:86-92,102` | 限流键仅取 RemoteAddr 不读 X-Forwarded-For；经 nginx 反代后全站共享同一桶（30 次/分钟），任一客户端可 1 分钟锁死全站登录 | 已确认 | 优先取 X-Forwarded-For 首段（信任代理场景），或键按 IP+用户名组合 |
| `backend/internal/middleware/oplog.go:109-112` | SaaS 运营端 `/admin/*` 全部操作（租户变更/重置密码/订阅）零审计日志 | 已确认 | admin 组挂 OperationLog 中间件 |
| `handler/tenant_handler.go:253-676` | Admin* 接口声称"完全无鉴权" | **回查排除（误报）**：路由实际挂在 `JWT + RequirePlatform(saas) + RequireRole(platformAdmin)` 三层之下（routes.go:252-255），匿名不可达；handler 内注释"不做鉴权"系指 handler 自身不校验，误导 | 仅建议：澄清注释，避免后续误删路由组 |
| `backend/internal/handler/user_management_handler.go:176-190`（P2 升级项，见 P2） | Get 详情无角色限制且保留身份证号，同租户任意用户可枚举读取 | 见 P2 | 返回前脱敏 id_card |

### C. 数据丢失 / 静默失败（23 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `handler/question_bank_export_handler.go:39-42` | `fillBanksData` 恒返回 nil（错误全被 slog.Warn+continue 吞），导出数据缺失时用户收到"成功"文件 | 已确认 | 返回失败行数或调用方校验实际导出行数并提示 |
| `store/evaluation_results.go:81-107` | 场景评价 `Submit` 的 ON CONFLICT 无条件重置 status='pending'/graded_at=NULL，教师已评分结果可被学生重交清空评分标记 | 已确认 | DO UPDATE 加 `graded_at IS NULL` 守卫或 service 提交前检查 |
| `store/node_evaluation_results.go:90-115` | 节点测评 `Submit` 同病 | 已确认 | 同上 |
| `apps/edu/app/affairs/teaching-plans/[id]/page.tsx:121-135,144-151` | 教师变更即时落库但 saveAll payload 不含 teacherId：(1) 失败提示"请通过保存修改重新提交"实为无效指引；(2) 取消编辑不回滚已落库变更 | 已确认 | teacherId 纳入编辑态由保存修改统一提交，取消时丢弃 |
| `apps/edu/app/affairs/teaching-plans/[id]/page.tsx:137-162` | `handleSaveAll` 失败条目静默跳过并清空 editMap，用户不知哪条失败且无法重试 | 已确认 | 收集失败条目明确列出并保留其 editMap 供重试 |
| `apps/edu/app/evaluation/exams/[id]/page.tsx:108-125` | `commitScore` 用 `.finally()` 无 catch：失败产生 unhandled rejection 且分值输入被清空 | 已确认 | `.then().catch(err => { toast; 保留 editScores })` |
| `apps/edu/app/evaluation/exam-usage/page.tsx:200-209` | 创建与编辑共用 payload 且无条件发送 targetType:'class'，编辑 major/department/public 安排被改写为 class | 已确认 | 编辑模式不发送 targetType/targetIds（后端保留原值） |
| `apps/edu/app/evaluation/landing/exams/[id]/page.tsx:484-491` | 判断题渲染为自由文本 Textarea，评分按 'true'/'false' 精确匹配，学生无法答对 | 已确认 | 判断题渲染为「正确/错误」单选 |
| `apps/edu/app/job/positions/[id]/edit/page.tsx:249-252` | `handleFinish` 保存失败仍无条件跳转，用户误以为已保存 | 已确认 | handleSave 返回 boolean，仅成功时跳转 |
| `apps/edu/app/lesson/admin/hybrid/add/page.tsx:765-769` | 节点模块 batchSave 异常被 reportError 吞掉仍提示"草稿已保存"，教学内容静默丢失 | 已确认 | 模块保存失败抛错中止并提示 |
| `apps/edu/app/lesson/admin/hybrid/add/page.tsx:723-754` | `saveNodes` 按 order 全局排序建节点，多根节点下子节点先于父节点创建命中 parent_id 外键，子树永远无法保存 | 已确认（001_baseline.up.sql:2157 外键核实） | 按 parentId 拓扑排序（父先子后） |
| `apps/edu/app/lesson/admin/system/add/page.tsx:616-697` | 同上（system 课程节点保存死锁） | 已确认 | 同上 |
| `apps/edu/app/lesson/admin/hybrid/add/page.tsx:699-704` + system/add:729 | 自定义能力点 `ap-custom-*` 假 ID 直接进 abilityPointIds；后端 `jsonSliceToUUIDSlice`（common.go:342）只过滤 `kp-custom-` → **courses.ability_point_ids 为 uuid[]，非法 UUID 直接使保存必 500** | 已确认（比原报告更严重：非法 uuid 触发 PG cast 错误） | 保存前将自定义能力点先 create 换取真实 ID，或后端补过滤前缀 |
| `apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx:49` | 请求 `/career/positions`（后端无此路由，实际为 `/job/positions`），404 被 catch 吞掉，关联职业岗位功能永久不可用 | 已确认 | 改用 `/job/positions?limit=200` |
| `apps/edu/app/portal/apps/alliance/projects/[id]/page.tsx:120-132` | 取消关联最后一个协议发送 `agreementIds: []`，后端 ValidateUpdateExisting 回退为原值 → 关联未解除但提示成功 | 已确认（alliance_crud_handler.go:318-320） | 后端提供"显式清空"可区分语义，或空数组走专门接口 |
| `apps/edu/app/portal/apps/system/tenant/_components/school-admin-manager.tsx:121-128` | 读 `created.plainPassword`，后端字段为 `newPassword`，初始密码 toast 恒为空 | 已确认（tenant_admins.go:19） | 改为 `created.newPassword` |
| `apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx:86-115` | courseId 未传时 loading 永真，弹窗无限转圈（teacher-dashboard 打开路径必现） | 已确认 | courseId 缺失时 effect 内也 setLoading(false)，或调用方必传 |
| `apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx:227-237` | 切换课程只改选中态，右侧仍是第一个课程的数据，静默错配 | 已确认 | 选中课程变化时按新 courseId 重拉 nodes/results/userMap |
| `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:644-659,991` | 新建/克隆任务权重永不持久化（persistWeights 跳过临时 id 且闭包陈旧），刷新后权重丢失 | 已确认 | 保存循环内为新任务同步 upsert 权重 |
| `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:566-576` | `handleAddTask` 把全部既有任务权重重置为均分，覆盖已配置权重 | 已确认 | 仅给新任务分配权重，保留既有值 |
| `apps/edu/components/evaluation/exam-form-dialog.tsx:89-101` | `duration: 60` 硬编码且无输入项，编辑时长≠60 的试卷保存后静默重置为 60 | 已确认 | 编辑时沿用 exam.duration（仅新建给默认值），弹窗提供时长输入 |
| `packages/ui/src/components/shared/mixed-tag-editor.tsx:266-286` | blur 只收集已渲染 span 的 id，未渲染标签被静默丢弃，保存即数据丢失 | 已确认 | blur 以 knowledgePointIds/abilityPointIds 快照为基准，未渲染 id 保留 |
| `packages/ui/src/components/shared/import-confirm-dialog.tsx:111-126` | 三个导入按钮无 pending 防重，连点可并发冲突导入 | 已确认 | 引入 pending 状态，导入中禁用全部按钮 |

### D. 并发竞态（5 条，均为核心业务）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `service/affairs.go:223-315` | `AutoSchedule` 内存冲突校验在 advisory 锁事务之外，并发自动/手动排课可产生重叠排课（schedule_entries 无排他约束） | 已确认 | 锁内重读 existing + 内存校验 + 插入整体放入同一事务 |
| `service/evaluation_result.go:39-152` | `SubmitExamResult` 重交保护检查全在事务外，SaveResult upsert 无 graded_at 守卫，评分与重交并发时学生重交可覆盖教师评分 | 已确认 | 检查移入事务 + 行锁，或 upsert 加 `graded_at IS NULL` 守卫 |
| `service/task_evaluation.go:42-90` | `SaveMethods` 临时考试联动在事务外、advisory 锁外执行，并发双保存时败者的 exam usage 写入污染胜者结果 | 已确认 | 联动移入事务内（持锁后执行）或改为幂等 upsert |
| `service/lesson_content.go:390-418,514-617` | 发布 hook 生成考试安排为 FindNodeUsage→Create 非原子流程，无唯一约束兜底，并发发布可产生重复安排 | 回查降级 P2：已在 txStore 内执行、并发发布低概率；仍建议兜底 | exam_usages 加 (exam_id, node_id) 唯一约束 + ON CONFLICT |
| `handler/approval_handler.go:160-196` | "all" 模式并发审批多步历史互相覆盖 | 见 P2 | 单行 CAS/锁 |

### E. 前端契约不符 / 类型错误（15 条）

| 位置 | 问题 | 回查 | 最佳实践方案 |
|------|------|------|--------------|
| `packages/api-client/src/api/portal.ts:39-43,81-85` | `batchCreate` 返回类型 `{count}`，后端实际返回 `{items,total}`，调用方读 .count 恒 undefined | 已确认 | 类型改 `ListResponse<User>` 并对齐调用方 |
| `packages/shared-types/src/approval.ts:2,21-30` | `ApprovalType` 枚举（question/onlineExam）与后端 7 个 targetType 不符；`ApprovalItem` 字段与 `domain.ApprovalRecord` 完全不符 | 已确认（unified.go:260-272） | 按后端重写类型，'questionBank'→'question_bank' |
| `packages/shared-types/src/backend.ts:196-204` | `ApprovalHistoryItem` 与后端 history 实际键（action/remark/stepIdx）不符（前端已用本地类型规避，此共享类型为错误副本） | 已确认 | 按后端键名修正或删除该导出 |
| `packages/shared-types/src/certificate-issuance.ts:26-40` | `CertIssuanceRecord` 5 个必填字段后端 ListHistory 从不返回 | 已确认（store/micro_cert.go:38-51） | 按后端列重写或后端 JOIN 补字段 |
| `packages/shared-types/src/evaluation-scene.ts:74` | `JobAbilityResult.positionCode` 标必填但后端无此字段 | 已确认 | 删除该字段 |
| `packages/shared-types/src/graduation.ts:9-10,16,56` | positionId/positionName/advisorName/evaluationTime 与后端 careerPositionId/advisorId/evaluatedAt 不符 | 已确认（domain/evaluation.go:324-361） | 按后端字段名修正 |
| `apps/edu/app/portal/apps/alliance/enterprises/[id]/page.tsx:135-148` | 协议 unlink 与 project 兜底语义不一致（两处"取消关联最后一个"行为不同），易错点 | 已确认 | 统一后端清空语义 |
| `apps/edu/app/portal/apps/alliance/layout.tsx:9-45` | 联盟管理布局缺前端 permitted 内容守卫（system/layout 有），未授权角色直达管理页（后端仍拦截 API） | 已确认 | 与 system/layout.tsx 对齐增加守卫 |
| `apps/edu/app/portal/workspace/_components/teacher-dashboard-tab.tsx:126-132` | 打开 HybridGradingDialog 未传 courseId，触发 loading 永真死锁 | 已确认 | 从 classPlans 解析 courseId 传入 |
| `apps/edu/components/shared/portal-sidebar-crud-page.tsx:574-582` | 批量加入弹窗 OrgNodePicker 未传 tenantId，按钮恒禁用，功能不可用 | 已确认（org-node-picker.tsx:212） | 从 useAuth 取 tenantId 传入 |
| `apps/edu/components/portal/yi-know-assistant.tsx:622-634` | 发送回复 800ms setTimeout 无清理，关闭后回复仍追加，已清空聊天区"复活" | 已确认 | timer ref + 关闭/unmount 时 clearTimeout |
| `backend/internal/handler/staff_title_handler_test.go:85-90` | 测试发送 status="disabled" 断言 200，handler 仅接受 active/inactive 必返 400，**CI 必红** | 已确认 | 改为 "inactive"（或确认 handler 是否应兼容 disabled） |
| `backend/migrations/121_task_eval_exam_to_homework.down.sql:1-2` | down 仅注释无 SQL，method_key 改写不可回滚 | 已确认 | 按 122 模式提供保守反向 UPDATE 或显式声明不可逆 |
| `backend/migrations/128_knowledge_ability_point_codes.down.sql:1` | down 仅注释无 SQL，KP- 编码回填不可回滚 | 已确认 | 至少回清 `WHERE code LIKE 'KP-%'` |
| `backend/migrations/108_alliance_dict_seed.up.sql:47` | `CROSS JOIN tenants` 在 seed 创建运营方租户前执行，全新安装种子 0 行且无代码回填，联盟字典数据缺失 | 已确认（时序依赖 deploy 流程） | 种子移到 seed 程序/租户创建逻辑（与 industries 对齐） |

### F. 无障碍（7 条，均为 ui 包；按"简单优先"可降级 P2）

`PlatformSideNav.tsx:116-120`（返回上级纯图标无 aria-label）、`combobox-select.tsx:121`（清除按钮非 button 元素不可键盘操作）、`multi-select-search.tsx:170-178`（Badge 删除按钮无 aria-label）、`multi-select.tsx:93-98`（移除标签 span+onClick 不可聚焦）、`dom-utils.ts:29-36`（contentEditable 内删除按钮无 aria-label 且不可 Tab 聚焦）。最佳实践：统一加 `aria-label` 并改为可聚焦 `<button type="button">`。

---

## 三、P2 重要（458 条）

> 以下为全部 P2 条目（按来源批次分组），每条均含精确位置与最佳实践；原始逐行记录见 `raw/`。


### backend-domain.md（5 条 P2）

- [NULL 扫描风险] evaluation.go:91 — `Exam.Version string` 直接扫描 DB 列 `exams.version`（001_baseline:427 定义，**无 NOT NULL**）；同一查询中 description 已用 `*string` + 判空处理（store/exams.go:208-212），version 却没有——任何 NULL version 行将导致 fetchExam/ScanExamRows 扫描报错（列表/详情 500）；最佳实践：domain 改 `*string` 或 SQL `COALESCE(e.version, '')`。
- [NULL 扫描风险] evaluation.go:22 — `QuestionBank.Version string` 直扫可空列 `question_banks.version`（001_baseline:848 无 NOT NULL）；同文件 `Description string`（evaluation.go:12）也直扫可空列 `description`（store/question_banks.go:241 直接 &b.Description），NULL 行会导致 fetchBank/列表扫描报错；最佳实践：改为 `*string` + 判空（参照 Exam.Description 的处理方式）。
- [枚举/DB 默认值错位] lesson.go:107 — `LessonBatch.Status LessonBatchStatus`（= ContentStatus，取值 open/closed，status.go:29/40-41），但 001_baseline:601 `lesson_batches.status` **默认值为 `'active'`**；正常路径经 BatchHandler 显式写入 status（batch_configs.go:96 CreateWithStatus: true）不受影响，但任何绕过 handler 的插入（种子/脚本/兼容代码）会得到 `'active'`，与 open/closed 两态语义冲突；最佳实践：新增迁移把默认值改为 `'open'`（或确认 'active' 已无数据后回填）。
- [枚举错位] models.go:85 — `InstitutionStatus = ContentStatus`（status.go:24），但 DB `institution_status` 枚举值只有 `pending/approved/disabled`（001_baseline:4-8）：ContentStatus 中的 draft/rejected/published/archived/open/closed 等值若写入该列会被 DB 拒绝，且 'disabled' 无对应 domain 常量；最佳实践：为 InstitutionStatus 定义独立枚举常量（含 disabled）或至少补充 `InstitutionStatusDisabled = "disabled"`。
- [NULL 扫描风险] scene.go:16 / scene.go:43 — `Scenario.Difficulty int`、`ScenarioTask.Difficulty int` 直扫 DB 可空列（001_baseline:1010/980 `difficulty smallint` 无 NOT NULL，且 CHECK(1-5) 对 NULL 放行）；存量 NULL 行会导致列表/详情扫描报错。另外 Create 路径 handler 绑定的 int 若前端不传为 0，会触发 CHECK 拒绝→500（scenario_handler.go:184 直传，update 路径有保留逻辑 :232-234）；最佳实践：domain 改 `*int`（表达"未设置"）并在 store 侧 COALESCE，或 handler 校验 1-5。

### backend-infra.md（9 条 P2）

- [配置继承] cmd/migrate/main.go:24-36 — migrate 通过 db.New 建立连接池后 Acquire，连接继承了 db.go:26-28 的 `statement_timeout=15000`；任何单条迁移 DDL 超过 15 秒即失败（大表建索引、数据回填类迁移在数据量上来后必然踩中），导致部署中断。最佳实践：Acquire 后先执行 `SET statement_timeout = 0`（迁移进程单飞，无需超时）。
- [迁移执行逻辑] cmd/migrate/main.go:211-213 — `isMultiStatement` 以 `strings.Count(sql, ";\n") > 1` 判定，行为依赖尾随换行：两语句文件以 `;\n` 结尾 → 走 execMultiSQL（非事务）路径；以 `;` 结尾（无尾随换行）→ 走单语句事务路径。同一内容因换行差异执行方式不同，且文件中的 `-- 注释;` 行（注释以分号结尾）会被误计为多语句。最佳实践：按 `;` 结尾的语句分割并去掉纯注释/空块后再判定，或改用文件内显式指令标记。
- [幂等缺失] cmd/migrate/main.go:215-241 — execMultiSQL 逐条非事务执行：中间语句失败时，之前的语句已生效但 schema_migrations 未记录版本，重跑会重放已成功的语句（如 `CREATE TABLE`/`INSERT` 报 already exists），需要手工回滚清理；另外按 `;\n` 分割不感知字符串字面量/PL/pgSQL 函数体内的 `;\n`，会被错误截断（该情况会报错暴露而非静默）。最佳实践：失败时对已执行语句回滚（依赖配套 .down.sql）或先备份整段 SQL 供人工处置；分割需识别函数体。
- [配置矛盾] cmd/server/main.go:62 — `WriteTimeout: 120 * time.Second` 与 routes.go:19-31 中 import/export/templates 的 10 分钟超时豁免直接矛盾：大文件导出/导入写响应阶段超过 120 秒会被服务器强制断连，客户端拿到截断文件（无错误响应），豁免形同虚设（另部署 nginx 反代 proxy_read_timeout 默认 60s 进一步收窄）。最佳实践：统一三层超时口径，导出类接口 WriteTimeout 放宽或改用流式分块写入。
- [启动顺序/优雅退出] cmd/server/main.go:56 + scheduler.go:40-43 — defer 逆序整体正确（sched→router→oplog→redis→db），但 sched.Stop() 会无限等待运行中任务（任务自身 ctx 上限 30 分钟），docker stop 默认 10 秒超时后 SIGKILL 强杀，正在执行的汇聚任务被中断、聚合表可能留下部分写入。最佳实践：Stop 增加带超时的等待（如等待最多 2 分钟），或任务端保证幂等可重跑。
- [配置副作用] db.go:26-28 — `statement_timeout=15000` 全局默认应用在**所有**连接上：调度器 30 分钟汇聚任务（scheduler.go:26）、迁移 DDL、复杂报表的单条语句只要超过 15 秒即被取消；且该参数无法在调用方按需放开（除非改 URL 或单独 SET）。最佳实践：默认不设或仅对短事务连接设置；长任务/迁移连接显式 `SET statement_timeout = 0`。
- [边界条件] middleware.go:118-119 — 限流语义为 `current > limit` 才拒绝（limit+1 触发），且 X-RateLimit-Reset 用 `time.Now().Add(window)` 而非实际过期时刻，与 Redis TTL 过期点不一致；429 响应无 Retry-After 头。功能可用，仅语义偏差，建议补充 Retry-After。
- [资源泄漏/优雅退出] scheduler.go:40-43 — Stop() 无限等待运行中任务（任务 ctx 上限 30 分钟），与容器优雅退出超时（默认 10s 后 SIGKILL）不匹配，强杀时汇聚任务可能中断留下部分聚合数据。最佳实践：Stop 加超时上限，并保证 AggregateAllPublished 幂等可重跑（下次运行自动补偿）。
- [超时冲突] scheduler.go:21-34 — 汇聚任务通过共享连接池执行，语句受 db.go:26-28 `statement_timeout=15000` 约束，任何单条汇聚语句超过 15 秒即失败，任务整体失败仅记日志、无重试（次日才补偿）。最佳实践：任务会话内 `SET statement_timeout = 0`，并在失败时立即告警。

### backend-middleware-router.md（7 条 P2）

- [JWT 校验] auth.go:53-57 — JWT 中间件只校验"能解析 + 签名有效"，不强制 `claims.UserID` 非空。登录预授权令牌（`preAuthClaims`，auth_handler.go:76-82）与正式令牌同密钥同 HS256，可被本中间件解析为 `Claims{Platform: "portal", Username: "xxx"}`（UserID 为空、RoleCodes 为空）。虽然所有角色/菜单门禁（RequireRole/RequireRoleOrMenu/RequireUserRead）都会因空角色/空权限拒绝它，但 `/auth/portal/me`、`/subscriptions` 等仅挂 `RequirePlatform` 的端点会放行进入 handler：`PortalMe` 以空 UserID 查库（返回 500 或空数据）、`SubscriptionHandler.Get` 因 `tenantFilter` 拒绝。无数据泄露，但属于令牌类型混淆的防御缺口。最佳实践：解析后强制 `claims.UserID != ""`，否则 401（同时天然排除 preAuthToken 与任何未来签名但结构不全的令牌）。
- [oplog 缓冲] oplog_buffer.go:63-69 — `flushLoop` 的 `defer recover()` 只是记录 panic 后让 goroutine **永久退出**（`done` 被 close、循环终止）。此后所有操作日志入队即被丢弃（enqueue 打 "buffer full" warn 或静默滞留），且 `Shutdown()` 立即返回。即 DB 异常/池关闭引发一次 panic 后，整个操作日志管线永久性失效。最佳实践：recover 后不 return，而是继续外层 for 循环（或重建 goroutine）。
- [oplog 缓冲] oplog_buffer.go:121-125 — 批量 `br.Exec()` 的错误处理不符合 pgx 语义：单行失败后，后续 `Exec()` 立即返回同一错误，剩余行实际不再消费（服务端是否已执行由服务端决定，但本地一律记失败），且每行各打一条 warn（错误风暴）。最佳实践：遇到第一个错误即 break，按"本批 N 行成功 / 第 K 行失败"统一记一条日志。
- [日志记录] oplog.go:109-112 — `claims.TenantID == nil` 时直接 return：SaaS 运营端（平台管理员）的全部操作（租户创建/停用、管理员重置密码、订阅修改等 `/admin/*` 高危动作）**完全不记录操作日志**，无审计轨迹。最佳实践：对平台管理员用固定占位（如 tenant_id = 'platform'）或至少单独记一条平台操作日志。
- [未鉴权接口] router.go:122 — `GET /uploads/{filename}` 完全公开（无 JWT、无租户隔离）：上传目录是全局共享的，任何获得 URL 的人（包括跨租户用户）都可读取任意上传文件（作业附件、证件照、导入的含个人信息的 Excel 等）。缓解因素：文件名是 UUID v4（不可枚举，file_handler.go:64）、扩展名白名单 + `..` 拒绝 + 前缀校验（file_handler.go:142-155）已防路径穿越和 XSS。最佳实践：至少要求登录（JWT），更进一步按租户子目录分目录存储。
- [路由注册] routes.go:60-256 — 存在至少 9 组同 method+path 双注册，全部依赖 chi"后注册胜出"静默覆盖，且全部为"后注册组 = 更宽角色门禁 + 同一 handler"的有意降权（已逐条核对无越权窗口）：
- [oplog 日志] routes_affairs.go:59-66 — 提示性交叉引用：`/import/schedules/*`、`/templates/schedules` 等注册在 businessUser 组（门禁与 registerImportExportRoutes 组一致，无越权）；其中 `/templates/*` 与 `/import/*` 已在 routes.go:24-27 的 10 分钟超时豁免前缀内，行为正确。无实质问题（该条不计入总数时请以 oplog.go:109-112 为准 —— 本条为冗余确认，不单计）。

### backend-migrations.md（21 条 P2）

- [迁移健壮性] 001_baseline.up.sql:1-2181 — 全部 CREATE TABLE/ALTER 无 IF NOT EXISTS，且 runner 对多语句文件按 ";\n" 切分逐条执行（cmd/migrate/main.go:211-241），非事务；中途失败后重跑会因"对象已存在"直接报错，无法续跑。最佳实践：语句包在单事务中执行，或建表统一加 IF NOT EXISTS；psql 兜底路径（deploy.sh:218）也存在同样问题。
- [外键缺失] 091_certification_weights.up.sql:9 — tenant_id 无 REFERENCES tenants 外键（后续 115/116 的租户级联清理也未覆盖此表），租户删除时产生孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [多租户隔离] 092_affairs.up.sql:70-89 — teaching_plan_entries 无 tenant_id 列（同批次 092 的 terms/training_programs/teaching_plans/venues/period_slots/schedule_entries 均有），仅经 plan_id→teaching_plans 间接归属租户，查询/过滤需多表 JOIN，跨租户数据隔离依赖应用层。最佳实践：补 tenant_id 列并加索引。
- [多租户隔离] 092_affairs.up.sql:37-51 — training_program_courses 同样无 tenant_id 列（间接经 program_id），问题同上。
- [数据正确性] 094_course_assessments.up.sql:12-19 — 回填 UPDATE 仅按 `c.code = se.course_code` 匹配 courses，未加 tenant 维度过滤；courses.code 仅租户内唯一（uq_courses_tenant_code），跨租户同 code 时可能把其他租户课程的 course_id 错误写入本租户排课。最佳实践：加 `AND c.tenant_id = se.tenant_id`。
- [编号重复] 097_node_eval_and_affairs_course.up.sql:1 — 与 097_knowledge_point_source 同号（097）。runner（cmd/migrate/main.go:85-93,144-148）按"数字前缀 + 文件名"排序、以完整文件名作版本号，up/down 顺序确定且对称，当前两个 097 无互相依赖，可正确执行；但编号约定被破坏，后续若两迁移产生依赖将导致隐性顺序错误。最佳实践：拆号为 097/098 并顺延后续编号，或在文件名中显式子序号（097a/097b）并保证 down 依赖。
- [外键缺失] 101_alliance_brand.up.sql:4,23,58,75,96,112,137,167,185,201,214,236 — 12 张联盟表（alliance_school_info/enterprises/enterprise_agreements/projects/milestones/achievements/experts/agreements/permissions/dictionaries/brands/brand_topics）tenant_id 均 NOT NULL 但无 REFERENCES tenants 外键，115/116 也未补：租户删除不级联清理，产生孤儿数据（联盟模块数据量随合作企业/项目增长后不可忽略）。最佳实践：统一加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [多租户隔离] 101_teaching_plan_entry_classes.up.sql:2-6 — 关联表无 tenant_id 列（同号 101 的另一迁移 alliance_brand 全部带 tenant_id，092 教务表也带），且 PK 仅 (entry_id, class_node_id)；虽然 entry_id 经 teaching_plan_entries 间接归属租户，但跨租户组织节点 id 若碰撞会造成跨租户班级串入。最佳实践：加 tenant_id 列并纳入 PK/复合索引。
- [编号重复] 101_teaching_plan_entry_classes.up.sql:1 — 与 101_alliance_brand 同号（runner 按文件名排序可正确执行，两个 101 无依赖；风险同上 097）。
- [数据破坏] 102_program_course_position.up.sql:2 — `DELETE FROM training_program_courses` 无条件清空业务数据，down 不恢复（见 102 down 记录）；若线上已有人培方案课程数据，该迁移直接丢数据。最佳实践：数据清理类操作应从部署流程分离执行并人工确认，或至少将 DELETE 限制为目标 schema 并记录执行前备份。
- [回滚不对称] 102_program_course_position.down.sql:1-2 — down 仅重建 scenario_id 列，up 中 DELETE 清空的数据无法恢复，且 down 无任何"数据不可恢复"提示；回滚后表结构对称但数据永久丢失。最佳实践：up 中 DELETE 前做备份表（如 INSERT INTO ..._backup SELECT ...）或在 down 提供还原脚本。
- [迁移健壮性] 111_graduation_archive_unique.up.sql:1-2 — ADD UNIQUE 约束前未清理存量重复（对照 112/114 均先 DELETE 去重再建约束）；若线上 graduation_project_archives 已存在 (topic_id, user_id) 重复记录，本迁移直接失败阻断部署。最佳实践：建约束前按 114 模式先 DELETE 保留最早一条。
- [迁移健壮性] 113_exam_questions_unique.up.sql:1-2 — 同 111：ADD UNIQUE (exam_id, question_id) 前无存量重复清理，线上重复则迁移失败。最佳实践：先 DELETE 去重再 ADD CONSTRAINT。
- [外键缺失] 123_eval_standard_copy.up.sql:11 — task_eval_score_rules.tenant_id 无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [外键缺失] 124_certification_point_levels.up.sql:4-6 — tenant_id/career_position_id/ability_point_id 均无外键（引用 tenants/career_positions/ability_points），租户删除产生孤儿数据。最佳实践：tenant_id 加 `REFERENCES tenants(id) ON DELETE CASCADE`，其余两列加逻辑外键。
- [外键缺失] 127_community.up.sql:4 — community_topics.tenant_id 无 REFERENCES tenants 外键（115/116 之后新增，未被覆盖），租户删除不级联，帖子孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [外键缺失] 129_student_honors.up.sql:4 — tenant_id 无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联，荣誉记录孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [编号重复] 129_user_favorites.up.sql:1 — 与 129_student_honors 同号（runner 按文件名排序可正确执行，无依赖；风险同上 097）。
- [种子时序失效] 131_industry_dict_seed.up.sql:104 — 同 108：CROSS JOIN tenants 在 seed 程序创建运营方租户之前执行，全新安装时 tenants 为空 → 种子 0 行；但与 108 不同，新建租户时 store/tenants.go:372 有 industryDictSeedSQL 代码回填，功能得以兜底，代价是"迁移种子 + 代码种子"双份维护（本次审查发现 131 与 industryDictSeedSQL 内容 97 条完全一致，未来改一处忘另一处即漂移）。最佳实践：迁移种子仅服务存量库升级，新库依赖代码回填；建议抽公共 SQL 常量或注释交叉引用。
- [外键缺失] 136_tenant_settings.up.sql:3 — tenant_id 无 REFERENCES tenants 外键，租户删除残留配置孤儿行（settings 无 created_by 亦无 FK 其他列）。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [外键缺失] 137_resource_tags.up.sql:4,13 — tags.tenant_id 与 resource_tag_relations.tenant_id 均无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联。最佳实践：两表 tenant_id 均加 `REFERENCES tenants(id) ON DELETE CASCADE`。

### frontend-api-client.md（11 条 P2）

- [超时] api-helpers.ts:162-196 — `requestWithPlatform` 的 `fetch` 未设置任何超时/`AbortSignal`；后端虽有 30s（导入导出 10min）超时中间件，但客户端在网络挂起时 UI 会无限等待，且无用户取消机制（页面跳转/关闭后请求仍在跑）。最佳实践：为 fetch 挂 `AbortSignal.timeout()`（读接口 30s、导入导出按场景放宽）并透传外部 AbortSignal。
- [错误处理] api-helpers.ts:178-179 — `hasBody` 以 `content-length !== '0'` 判断响应体；对 chunked（无 content-length）且 200 的成功响应，若返回非 JSON（如 text/csv），`res.json()` 失败后兜底为 `{error:'请求失败'}` 并作为业务数据返回，掩盖真实响应格式错误。最佳实践：按 `Content-Type` 判断解析，或对已知返回空体的接口显式处理。
- [契约] api-helpers.ts:136-140 + auth.ts:16 — `getToken`/`request` 的平台解析依赖 `NEXT_PUBLIC_DEFAULT_PLATFORM` 与 `window.location.pathname`；`/auth/me` 路由仅在 SaaS 平台组注册（routes.go:248），若在默认 portal 平台的应用中调用 `authApi.me()`（见 auth.ts:16），会携带 portal token 请求被 `RequirePlatform(saas)` 拒绝 → 401 → 清除 portal token 并跳登录页，造成会话被误清。最佳实践：`me()` 显式使用 `saasRequest`（与 `saasMe` 一致），或后端对 `/auth/me` 放宽平台校验。
- [契约] auth.ts:16-17 — `me()` 与 `saasMe()` 指向完全相同的后端 handler（`/auth/me` 与 `/auth/saas/me` 均注册为 `h.authHandler.SaasMe`，routes.go:248-249），两个方法语义重复且平台歧义（见 api-helpers.ts P2）。最佳实践：只保留 `saasMe()`，`me()` 内部委托或删除。
- [错误处理] affairs.ts:250-253 — `scheduleApi.exportExcel` 未检查 `res.ok` 即 `downloadBlob(await res.blob())`：非 2xx 时后端返回 JSON 错误体，会被当作「排课导出.xlsx」下载成垃圾文件；同文件 :153-160 的 `teachingPlanApi.exportExcel` 有 `res.ok` 检查，此处行为不一致。最佳实践：先判 `res.ok`，失败时解析 `data.error` 抛错（复用 :155-158 模式）。
- [契约] evaluation.ts:486-489 — `aggregateStatus` 的 `careerPositionId` 类型为可选，但后端 `AggregateStatus` 必填（job_ability_result_handler.go:389-393 缺失返回 400）；响应类型 `JobAbilityAggregateStatus | null` 也不会出现 —— 后端无记录时返回 404 错误（:402-405）而非 null。调用方按 null 处理会漏判，且空参调用必 400。最佳实践：`careerPositionId` 改为必填，类型改为 `Promise<JobAbilityAggregateStatus>`（404 交由全局错误处理）。
- [契约] job.ts:72 — `saveFull` 响应类型声明为 `{ position: CareerPosition }`，但后端直接返回岗位对象本身（position_handler.go:490 `respondJSON(w, http.StatusOK, pos)`），不存在 `position` 包装字段；调用方按 `res.position` 取值会得到 undefined。最佳实践：类型改为 `Promise<CareerPosition>` 并修正调用方。
- [契约] job.ts:17-19 — `publicPositionApi` 使用 `createCrudApi` 生成 list/get/create/update/delete 全套，但后端仅为 `/job/public/positions` 注册 GET List 与 GET {id}（routes.go:84-85），其余四个方法调用必 404。TS 的 `TCreate=never` 仅阻止编译期调用，运行时接口面仍暴露。最佳实践：改为只读 API 工厂（list/get 两个方法）。
- [契约] portal.ts:198 — `updateName` 返回类型声明为 `User`，后端 `UpdateMe` 返回 `{ id }`（user_management_handler.go:153）；类型与实际不符，调用方若读 user 字段将 undefined。最佳实践：改为 `{ id: string }`。
- [契约] system.ts:71-78 — `approvalApi.review` 请求体含 `nextStepIdx`，但后端 `ReviewApprovalRequest` 仅有 `action`/`remark`（approval_handler.go:47-50），`nextStepIdx` 被静默丢弃 —— 按步骤审批（stepIdx）功能实际无效且无报错。最佳实践：后端补齐 `nextStepIdx` 字段并实现分步流转，或前端移除该参数。
- [契约] honors.ts:5 — `list` 的 `userId` 声明为可选，但后端 `List` 对业务用户必填 `userId`，缺失返回 400「缺少用户ID」（student_honor_handler.go:63-66）；学生角色由后端强制本人。调用方（教师端）不传 userId 必然 400。最佳实践：类型拆分为「学生（无参）/业务用户（必传 userId）」或后端对当前用户兜底查询。

### frontend-app-01.md（30 条 P2）

- [数据丢失] courses-tab.tsx:121-128 — 加载时按 positionId 将多行合并为一行且只保留 `v[0]`（丢弃其余行的学分/学时配置）。后端 `training_program_courses` 是按行存储、不按岗位场景展开（backend/internal/store/training_programs.go:145 PutCourses 逐行插入），一旦同一 positionId 存在多条不同配置的记录（如用户重复添加同一岗位），重载合并后编辑保存将静默丢失其余行配置。最佳实践：加载时保持原始行（同岗位多行均展示），仅在展示统计层按岗位聚合；或后端保存时按岗位展开成多行与前端口径一致。
- [静默降级] program-course-import-dialog.tsx:62-89 — `handleImport` 中预览请求抛异常时 `catch { return await doImport(files, false) }`：预览失败（网络/服务异常）静默回退为直接导入，重复数据将不做确认直接写入。最佳实践：catch 分支应提示「预览失败」并中止，而非绕过去重直接导入。
- [错误处理] program-course-import-dialog.tsx:44 — `res.json()` 未做 try/catch，后端返回非 JSON（网关 502/500 HTML）时抛异常向上传播，导入结果提示丢失。最佳实践：`const data = await res.json().catch(() => ({}))`。
- [数据丢失] affairs-config-import-dialog.tsx:30 — `importExcel('affairs-config' as any, files[0])` 只导入第一个文件；导入向导允许选择多文件时其余文件被静默忽略。最佳实践：限制单选，或在多文件时逐个导入/提示。
- [已承认] schedule-grid-tab.tsx:88-89 — TODO 注释已承认：排课列表 limit:200 前端过滤场地，超 200 条时筛选结果不完整。建议尽快改服务端筛选（保留记录不重复）。
- [错误被吞] schedule-import-bar.tsx:52-60 — `handleDownloadTemplate` 在 `!res.ok` 时直接 throw，而 onClick 直接绑定该函数无 try/catch：下载模板失败产生 unhandled promise rejection，用户无任何提示。最佳实践：包一层 catch 弹 toast。
- [loading 缺失] scheduling/page.tsx:39、62 — `const [, setLoadingPlan] = useState(false)` 把加载状态丢弃：切换教学计划后 planDetail 加载期间页面渲染 `step==='grid' && selectedPlan && planDetail` 为假，直接空白，无任何加载提示。最佳实践：保留 loadingPlan 并渲染加载占位。
- [伪造数据] scheduling/page.tsx:173-187 — 用 `as any` 伪造 term 对象传给 TimetableViewTab（startDate/endDate 为空串、weeksCount:0）；若 selectedPlan.termId 为空，timetable 请求携带 `termId=''` 发起无效请求；且 weeksCount 为 0 时依赖 `|| 16` 兜底。最佳实践：从后端按 termId 真实加载学期数据。
- [状态不一致] teaching-plans/[id]/page.tsx:175-181 — `teachingPlanApi.submit` 成功后 `approvalApi.create` 失败：教学计划已提交但审批记录缺失，且无补偿逻辑（仅报错）。最佳实践：先创建审批记录再 submit，或失败时提示可重试且 submit 具备幂等。
- [重试不可行] exams/[id]/page.tsx:77、80-84 — `triedReload` ref 一次性标记：首次加载失败（网络/后端异常）后不再重试，页面停在「试卷不存在」引导用户返回，误杀可恢复场景。最佳实践：区分「确实不存在(404)」与「加载失败(其他)」，后者允许重试。
- [静默失败] exams/[id]/page.tsx:186-190 — `handleCreateQuestion` 在 `draftPoolBank` 缺失时静默 return（无提示）；且 `createQuestion` 成功但 `addQuestionToExam` 失败时会留下草稿库孤儿题目。最佳实践：无草稿库时提示；addQuestion 失败时提示并允许手动恢复。
- [逻辑缺陷] exams/[id]/page.tsx:235-246 — `handleEvenDistribution` 当题目数 >100 时 `base = Math.floor(100/n) = 0`，前 100 题各 1 分、其余题 0 分，总分虽为 100 但大量题目得 0 分。最佳实践：题目数超过 100 时提示无法均匀分配。
- [性能] exams/page.tsx:100、135 — `mapExamItem` 依赖 `backend.questions` 计数，而后端 ListExams 对列表内每份试卷批量填充全量题目（backend/internal/service/evaluation_exam.go:21 BatchFetchExamQuestions），配合 list limit 大时一次返回数千题目对象。最佳实践：后端列表接口增加 question_count 聚合字段，前端不再依赖 questions 数组。
- [错误被吞] exam-usage/page.tsx:223-227、230-248、255-265 — 创建/发布/停止/删除失败仅 `reportError`，无用户可见提示（部分错误被吞）。最佳实践：失败统一 toast。
- [字段语义错位] exam-usage/results/page.tsx:79 — `majorId: r.majorName || '-'`：把专业名称塞进 majorId 字段，309 行 `majorMap.get(result.majorId) || result.majorId` 靠 map 未命中兜底才侥幸显示正确；一旦 majorMap 恰好存在同名字段则展示错误映射。最佳实践：接口补真实 majorId 字段，或前端直接使用 majorName。
- [错误误导] exam-usage/results/page.tsx:66-68、126-138 — usage 与 results 任一请求失败都被 catch 成 null/空：网络故障时页面显示「考试记录不存在」误导用户；results 失败时静默显示空表。最佳实践：区分网络错误与 404，失败时提示并保留可重试入口。
- [性能] banks/[id]/page.tsx:121 — `questionApi.list({ bankId: id, limit: 10000 } as any)`：全量拉取并一次性渲染全部题目（无分页/虚拟化），大题库（上千题）首屏卡顿。最佳实践：服务端分页/加载更多。
- [权限判断不可靠] exam-center/page.tsx:44 — `isStudent` 由 `items[0]?.studentView` 推断，列表为空时默认按学生视图渲染「我可参加」页签；基于数据而非真实角色/权限。最佳实践：由 auth 上下文或后端接口提供角色标识。
- [性能] exam-center/page.tsx:32-41 — 为拿封面 `examApi.list({status:'published', limit:1000})`，后端列表会填充每份试卷全量题目（见 evaluation_exam.go ListExams），浪费严重；失败时 `catch(() => {})` 完全静默。最佳实践：后端提供轻量 cover 映射接口。
- [死状态] exams/[id]/page.tsx:84 — `const [, setUsages]` 只写不读（effect 里 setUsages 从未被使用）。最佳实践：删除该状态。
- [错误被吞] landing/page.tsx:150-151 — 首页 4 个 `limit: 1000` 请求整体 try/catch 后 `// ignore` 完全静默：加载失败时页面呈现空态，用户无任何错误提示。最佳实践：失败时 toast/重试入口。
- [请求风暴] daily-exams/page.tsx:53-67 — 对每个考试安排并发发一个 results 请求（`Promise.all`，limit 500 个 usage 时产生 500 个并发请求）。最佳实践：后端聚合统计接口或分页 + 按需加载。
- [串数据] daily-exams/page.tsx:77-83 — 切换左侧考试安排时未清空 `results` 也无 loading 指示：新数据返回前短暂展示上一个考试的学生记录。最佳实践：请求前清空或按 selectedUsageId 过滤渲染。
- [数据丢失] question-banks/[id]/page.tsx:199-240 — `executeImport` 只取 `importFiles[0]`：向导允许多选文件（importFiles 数组），其余文件被静默忽略。最佳实践：限制单选或逐个导入。
- [失败误报成功] question-banks/[id]/page.tsx:257 — `executeImport('skip').then(() => true)`：executeImport 内部 catch 后不 rethrow，这里无条件返回 true，导入失败时向导仍按「成功」关闭（虽有错误 toast）。最佳实践：executeImport 返回 boolean 失败标志。
- [按钮无效] scene-results/[id]/page.tsx:1266-1273 — 「全部展开/收起」仅切换 `allExpanded` 布尔值，该值未传给 QuestionGradingCard（卡片内部自持展开状态），点击除文案变化外无实际效果。最佳实践：将展开状态受控提升或删除该按钮。
- [状态重置] scene-results/page.tsx:293 — `TaskMethodTabs` 定义在 `GradingPageContent` 组件内部：每次父组件渲染（展开/收起任务、切换场景、搜索）都会创建新组件类型，其内部 `activeMethod` 状态全部重置回第一个方法。最佳实践：把 TaskMethodTabs 提升为顶层组件。
- [批量删除部分失败] job/archive/page.tsx:126 — `Promise.all(batchDeleteTarget.map(...))`：任一删除失败整体抛错，已删除部分不统计、不刷新（对比 104-117 行批量恢复用 allSettled + 失败统计，风格不一致）。最佳实践：改用 Promise.allSettled 并展示成功/失败数量。
- [部分失败全清空] job/landing/[id]/learn/page.tsx:57-68 — 场景列表成功后任一场景的 `taskApi.list` 失败会触发整链 Promise.all reject，catch 里把已成功加载的 `scenarios` 也清空（详情页 job/landing/[id]/page.tsx:119-128 已做逐任务容错，此页未同步）。最佳实践：逐任务 try/catch 保留已加载数据。
- [权限/数据不一致] job/landing/[id]/page.tsx:137-156 + 202-212 — 职责/证书/能力/图谱 5 个请求捆绑在 `Promise.all` 且仅登录后执行：任一失败则 5 类数据全不设置；同时「岗位职责」（203-209）与「涉及证书」（211-212）页签未做登录判断（ability/competency/graph 有 LoginPrompt），未登录用户进入这两个页签看到空白而非登录提示。最佳实践：请求间失败隔离 + duties/certs 页签同样加未登录提示。

### frontend-app-02.md（28 条 P2）

- [竞态] 行 610-613 — `handleEdit` 中 `loadPositionScenes` 与 `learnRoadApi.list` 并行，若用户快速连续点击两个岗位（按钮仅由 `editLoading` 禁用，点击第二行时第一行的 loading 尚未 setState 生效），先发起的请求可能后返回覆盖后发起的场景数据。最佳实践：保存请求序号或用 `editLoading` 同步阻塞 + 校验 `editingPosition.id` 是否仍为当前。
- [竞态] 行 181-192 — 字典加载 Promise 无 cancelled 守卫，卸载后 setState（React 18 无警告但属隐患）；且该结果未被任何地方使用（同上）。
- [一致性] 行 95-112 — `handleMove` 用 `Promise.all` 并发更新全部推荐顺序；若中途某个 update 失败，其余已成功更新，列表出现**部分排序生效**且无回滚（随后 refresh 拉回服务端状态，视觉上"排序失败"但服务端已部分变更）。最佳实践：串行逐个更新或失败时反向补偿。
- [内存/生命周期] 行 48-55 — 课程/批次字典加载无取消守卫，组件卸载后可能 setState。轻微。
- [状态陈旧] 行 97-111 — `customKnowledgePointIds` 在 effect 内先 `setCustomKnowledgePointIds(new Set())` 再逐条 functional update，随后**同步**读取 `customKnowledgePointIds.has(k.id)`（行 108）用的是本次渲染的陈旧空集合快照，导致池中所有课程自定义知识点 `linked` 恒为 true，自定义标识在复选框中不生效。最佳实践：在 effect 内先构建完整 Set 局部变量，一次 setState。
- [数据完整性] 行 275-283 — 新建课程（editId 为 null）时自定义知识点 `knowledgeApi.create({ sourceId: editId })` 写入 sourceId=null；保存后 `router.replace` 带新课程 id，再次加载时 `k.sourceId === editId` 匹配不到这些知识点 → 不再被识别为"课程自定义"，后续编辑改名/描述**静默不再同步**（仅保留绑定关系）。最佳实践：创建课程拿到真实 id 后补一次 `knowledgeApi.update` 回填 sourceId。
- [部分失败] 行 354-381 — 新课程 `courseApi.create` 成功后 `persistNewResources` 失败会走 catch，此时课程已创建但 URL 未替换（router.replace 未执行），用户重试保存会**再创建一门重复课程**。最佳实践：create 成功后先 replace URL 再持久化资源。
- [跨类型] 行 143 — `setHours(String(c.onlineHours ?? c.offlineHours ?? ''))`，混合课程线上/线下小时语义混用，仅用于展示，轻微。
- [陈旧闭包] 行 310-329 — `AttachmentListEditor.handleFileChange` 上传完成回填时读取闭包中的 `items`，若上传期间用户新增/删除/编辑了其他附件，`items.findIndex` 定位到旧索引，回填位置错位或丢失。最佳实践：上传开始时记录 itemId 对应的最新 index（或用 functional update 按 id 更新）。
- [重复加载覆盖] 行 190-323 — 加载 effect 依赖 `abilityPool`（行 323），首次渲染 abilityPool=[] 触发加载，ability 拉取完成后 abilityPool 变化 → effect **重跑**，编辑模式下重新拉取课程/节点/模块并整体覆盖 `nodeDataMap`/`moduleAssignments`/`selectedNodeId`——若用户在两次加载窗口内已编辑（毫秒级，概率低），编辑内容被静默覆盖。最佳实践：去掉 abilityPool 依赖或仅在未加载过时跑一次。
- [字段丢失] 行 691-692 — `buildCoursePayload` 使用 `existing?.semester`/`existing?.className`，用户对 `courseForm.semester` 的修改（表单初始化即持有该字段）永远不生效。若该字段无 UI 输入则为死字段，建议删除或打通。
- [运算符优先级] 行 141-144 — `draft?.estimatedHours || node.estimatedHours ? parseFloat(...) : undefined` 实际解析为 `(a || b) ? c : d`：当用户**清空** estimatedHours（draft=''）而 node 原值存在时，回退用旧值，**用户无法清空该字段**；且 draft='2.5' 之类字符串直接 parseFloat，无 NaN 兜底（parseFloat('')=NaN）。最佳实践：显式 `const v = draft?.estimatedHours; const eh = v !== undefined && v !== '' ? parseFloat(v) : node.estimatedHours`。
- [重复加载覆盖] 行 167-233 — 编辑加载 effect 依赖 `abilityPool`（行 233），abilityPool 首次填充后 effect 重跑，重复拉取并重置 courseName/nodes/selectedNodeId 等全部状态，存在覆盖用户编辑窗口。修复同 hybrid（去依赖或一次加载）。
- [引用节点资源绑定] 行 678-696 — quote 节点（refType=original）在 `buildNodeSavePayload` 中不携带 resourceIds，但**本地资源上传循环对所有真实节点执行**：引用模式下选中的颗粒课资源（handleGrainConfirm 行 552-554 已 setSelectedResourceIds）若命中 `res-`/本地池资源，会被 `nodeResourceApi.create+bind` 绑到引用节点上，与"引用不可编辑"语义冲突。最佳实践：引用节点跳过资源持久化。
- [静默丢失] 行 632-647 — 自定义知识点 `knowledgeApi.create` 失败仅 reportError 继续，后续 `resolveKnowledgePointIds` 把 `kp-custom-*` 过滤掉 → 该知识点从保存中**静默消失**，用户只看到一条控制台错误。最佳实践：失败即中止保存并 toast。
- [竞态] 行 524-590 — `handleGrainConfirm` 异步拉取颗粒课详情后 setKnowledgePoints/setSelectedResourceIds 无守卫，期间切换节点会把颗粒课数据写入错误节点。最佳实践：回填前校验 selectedNodeId 未变化。
- [跨节点状态残留] 行 273/280、322/341 — `submittedMethodKeys`/`hybridSubmittedKeys` 以 methodKey 为键、**切换节点不重置**；若节点 B 与节点 A 配置了相同 methodKey，切到 B 后卡片直接显示"已提交/pending"（`overriddenResult` 行 708-714 短路），用户误以为已提交。最佳实践：提交键带上 nodeId，或在 activeNodeId 变化时清空。
- [竞态] 行 182-191 — `nodeEvaluationResultApi.list` 无取消/序号守卫，快速切换节点时旧响应可能覆盖新节点结果。最佳实践：引入 cancelled 标志或 AbortController。
- [竞态] 行 132-156 — 节点/混合模块加载 effect 依赖 `[id, course, targetNodeId]`，无 cancelled 守卫，切换 id 时旧响应可覆盖。最佳实践：加取消标志。
- [崩溃风险] 行 649 — `course.creatorId.slice(0, 8)`：creatorId 为 null/undefined（老数据或异常记录）时 TypeError 整页崩溃。行 655/745/751 等 `course.nodeCount`/`onlineHours` 亦有 undefined 渲染风险（显示空白，不崩）。最佳实践：`(course.creatorId || '').slice(0, 8)`。
- [截断] 行 141 — `courseResourceApi.list({ courseId, limit: 10000 })` 超过后端 maxPageSize（200）被截断，资源中心数据不完整且无提示。最佳实践：分页拉取或多页合并。
- [竞态] 行 132-153 — 三个并行拉取均无取消守卫，切换课程 id 时旧数据可覆盖。轻微。
- [截断] 行 123 — `courseApi.list({ status:'published', limit:1000 })` 客户端全量拉取；课程数超后端上限时列表/筛选/统计不完整且无提示。最佳实践：服务端分页或至少展示截断提示。
- [部分成功误导] 行 115-139 — 实体 create/update 成功后才 `saveTags`，标签保存失败会整体 catch 并 toast"保存失败"，但实体实际已保存——用户重试会**重复创建**。最佳实践：标签失败单独 toast 且不阻止关闭弹窗。
- [部分成功误导] 行 124-149 — 与 ability 页相同问题（create/update 成功后 saveTags 失败被误报"保存失败"）。
- [截断] 行 232 — `resourceLibraryApi.list({ limit: 500 })` 客户端全量拉取，资源超过后端上限时统计卡片、类型/院系/专业筛选、列表均不完整且无提示。最佳实践：统计用 stats 接口、列表分页。
- [截断] 行 47 — `limit: 9999` 超后端 maxPageSize 被截断为 200，且 `totalPages = ceil(total/9999) = 1`，**只展示前 200 条、无分页也无截断提示**。最佳实践：limit 传 200 并用服务端分页。
- [部分成功误导] 行 186-212 — 与 ability/certificates 相同：实体保存成功、标签绑定失败 → toast"保存失败"且弹窗不关闭，重试会重复创建（无幂等）。最佳实践：标签失败单独提示。

### frontend-app-03.md（19 条 P2）

- [i18n] 第 464 行：`<LandingEmpty title={`暂无${t(cat.title)}`} />` — 模板字符串拼接中文前缀"暂无"，整串未作为翻译 key 传递，切换语言后仍是中文，与全站 t() 约定不一致；最佳实践：`t('暂无{t}', { t: t(cat.title) })`。
- [契约] 第 259 行 `/alliance/public/achievements?sort=latest`：后端 `ListPublicAchievements`（alliance_achievement_store.go:148）固定 `ORDER BY created_at DESC LIMIT 100`，忽略 sort 参数（默认即最新，无实际影响，但参数是无效契约）。
- [契约] 第 40 行（alliance/page.tsx）`/alliance/public/brands?isFeatured=true`：后端 `ListPublicBrands`（alliance_handler.go:722）仅读取 `brandType` 参数，`isFeatured` 被静默忽略；"推荐品牌"实际展示的是最近 12 条且前端再按 `isFeatured || isPublic` 过滤（第 304 行），语义与"推荐"不符。
- [契约] 第 40 行 `?isFeatured=true` 参数被后端忽略（见 landing 条），"品牌展示"实际是最近 6 条。
- [契约] 第 89-91 行：`(item as any).enterpriseIds / projectIds / secondaryColleges` — 依赖后端返回这些字段；已核实后端 `ScanAchievementRows`（alliance_achievement_store.go:26-43）返回 enterprise_ids/project_ids/secondary_colleges，运行时 OK，但类型层面 shared-types 的 `AllianceAchievement` 缺 `secondaryColleges` 之外的字段声明，全靠 `as any` 绕过。
- [契约] 第 116-118 行与第 73-91 行：`relatedPositions/relatedScenes/relatedCourses` 运行时为 `[{id,name}]` 对象数组，但 shared-types `AllianceAchievement.relatedPositions?: string[]`（alliance.ts:116）类型声明错误；若历史数据为字符串数组（导入/旧数据），`ref.name`/`removeItem` 的 `x.id` 过滤将失效。建议修正 shared-types 类型为 `RelatedRef[]`。
- [契约] 第 83 行 `allianceAchievementApi.create(item)` 中 `enterpriseIds/projectIds/secondaryColleges` 随 item 提交，后端支持；但第 48-57 行初始 item 未含 `relatedPositions` 等字段，创建后这些字段为空，与编辑页字段集不一致（编辑页可维护关联，新建后需二次编辑）— 功能缺口。
- [数据丢失] 第 55-79 行：加载失败（网络瞬时错误）时 `item` 保持初始空值且 `loading=false`，页面渲染空表单而非错误/不存在提示（对比 achievements/[id]/edit 有 `if (!item)` 空态分支，本页缺失）；用户误以为是新建表单，填写保存后 PUT 全列覆盖（协议无 ValidateUpdateExisting 兜底）→ 原记录内容被替换。最佳实践：加载失败后区分错误/空态，`item` 为空时禁用保存。
- [截断] 第 72-87 行 `allianceAgreementApi.list({limit:200})` 等 200 截断：超过 200 条协议/项目/成果时，已关联项在详情页"合作协议/合作项目/合作成果"Tab 中缺失（过滤基于截断列表）。
- [逻辑] 第 53-56 行 `p.accountName.toLowerCase()` — 若后端返回 accountName 为 null（空账号名）会抛 TypeError 导致整行渲染崩溃；后端 create 校验 accountName 非空（alliance_handler.go:460），风险低，但建议 `(p.accountName || '')` 防御。
- [契约] 第 107、121、142 行 `(project as any).agreementIds` — shared-types `AllianceProject`（alliance.ts:67-85）**未声明 agreementIds 字段**，全靠 `as any`；后端实际返回/写入 agreement_ids（alliance_project_store.go:103），运行时 OK，但类型契约缺失。
- [性能] 第 40-48 行：对每个项目**串行** `await allianceProjectApi.listMilestones(p.id)`（N+1 请求链），项目数多时列表加载极慢；最佳实践：改为 `Promise.all` 并发，或后端一次性返回里程碑统计。
- [i18n] 第 171-177 行阶段下拉直接渲染原始枚举值 `{v}`（archived/terminated 等显示英文），未走 `t()` 翻译，与第 163-167 行 `allianceLabel` 显示不一致。
- [数据覆盖] 第 155-156 行：租户原省份/城市为空时，编辑表单默认填入 `北京 / 东城区`，用户不修改直接保存会把原本无地区的数据覆盖为"北京/东城区"（数据污染边缘）；最佳实践：默认留空，未选择不提交。
- [性能] 第 34-39 行：搜索时 `limit: 10000` 全量拉取，且 `loadLogs` 随 `searchTerm` 每次击键变化 → useEffect 重新执行，**无防抖**，快速输入触发多次万级记录请求；最佳实践：输入防抖（300ms）。
- [性能] 同 login 页第 34-39 行：搜索无防抖 + limit 10000 全量拉取。
- [分页缺失] 第 61-65 行：`usePortalUsers` 仅解构 `users/loading/error/refetch`，未取 `total/page/pageSize/setPage`，且 PortalCrudPage 未传 `pagination` → 毕业学生超过默认 20 条时**只能看到第一页、无法翻页**（对比 accounts 页第 168 行正确传了 pagination，属功能缺口）。
- [状态不同步] 第 66-82 行 `handleCreate` 成功后仅 `setSearchText('')`：若搜索框本就为空，`setSearchText('')` 状态不变 → `useAsync` deps（第 63 行 `[searchText]`）不触发 → **新建的关系不会出现在列表中**，需手动刷新；最佳实践：创建成功后显式 `refresh()`。
- [权限语义] 第 307-310 行：`perms.menus` 缺失（学校管理员/平台管理员等"不限菜单"角色）时回显为全选；一旦在权限弹窗点保存，`savePermissions`（第 346-355 行）会把全量 `menus` 写入，将"不限制"变成显式白名单 — 后续新增页面/菜单不会自动可见，权限语义发生不可逆变化。最佳实践：menus 缺失时提示"当前角色不限制菜单"并禁止一键保存，或保存时剔除全选集合。

### frontend-app-04.md（41 条 P2）

- [契约] majors/page.tsx:26 — `majorApi.list({ tenantId, limit: 1000 })` 依赖 `tenantId`，若 portal auth 尚未就绪则返回空列表且 `authLoading` 变化后依赖触发重拉，逻辑正确；但后端 `/majors` 列表接口若存在 maxPageSize 上限（<1000）会静默截断，专业数超限时列表不全。最佳实践：核实后端分页上限，超出时改用分页或搜索。
- [状态] majors/page.tsx:29 — `useAsync` 的 `onError: () => true` 吞掉错误仅显示空表，未暴露错误信息；结合 `error?.message ?? null` 传入页面，实际 onError 返回 true 时 error 可能被重置。最佳实践：onError 返回 false 或直接展示 error。
- [数据丢失] tenant/page.tsx:163-164 — `loadTenantToForm` 中省份不在 `CHINA_REGION` 键集合（如实际值为「内蒙古」而键为「内蒙」）时静默回退到 `PROVINCES[0]`（北京），城市为空时回退「东城区」；保存后会把租户真实省份/城市改写为北京，且无任何提示。最佳实践：回退仅作展示占位，保存前校验「未修改」字段不应提交兜底值。
- [数据丢失] tenant/page.tsx:249-250 — `handleWebsiteChange` 输入框值即被前缀化（用户输入 `example.com` 立即显示 `https://example.com`），编辑时若用户想保留原始输入会被改写，但保存逻辑一致，可接受；风险在于用户粘贴带路径的 URL 会得到 `https://https://...` 的校验失败体验。最佳实践：仅在提交时归一化。
- [权限] portal/layout.tsx:28-36 — 工作台守卫只放行 teacher/student/school_admin，但企业导师（enterprise_mentor）被重定向到 /portal；而 workspace/page.tsx:357-359 明确为 enterprise_mentor 保留了兜底视图并拉取 dashboard，两者矛盾：enterprise_mentor 永远无法访问工作台。最佳实践：守卫放行 enterprise_mentor 或删除 workspace 中的对应分支。
- [状态] login/page.tsx:52-58 — `doLogin` 先 `setToken` 再 `refresh()`/`portalMe()`；若 portalMe 失败（如 token 立即失效），catch 显示错误但本地已写入失效 token，用户停留在登录页但后续请求全部带坏 token。最佳实践：先验证成功再 setToken。
- [错误处理] login/page.tsx:88-91 — `err.message` 直接展示，若后端返回非 Error（如网络层字符串）可能显示 undefined。最佳实践：`err instanceof Error ? err.message : ...`。
- [假数据] workspace/page.tsx:344-355 — enterprise 角色兜底视图使用硬编码假统计（合作项目 5、实习学生 23、在线用户 1256、总用户 8500），虽注释说明「兜底空值」，但 `config.stats` 是默认值而非 0，会展示虚假数字。最佳实践：兜底用 0/'-'。
- [竞态] dashboard-tab.tsx:53-69 — 请求无 cancelled 保护，角色切换（activeRoleCode 变化）时旧请求可能晚到覆盖新数据。最佳实践：加 cancelled 标志或 AbortController。
- [假数据] learning-tab.tsx:102-127 — 4 个 StatCard 中「学习时长 86h」「本月 +12h」「本周完成任务 12」「较上周 +3」「本学期共 5 门」「2 个待完成」为硬编码假数据，与上方真实 API 数据并列展示，学生看到虚假统计。最佳实践：接入真实接口或显示 '-/--'。
- [错误吞掉] career-tab.tsx:275-299 — 两个收藏列表请求失败时 `.catch(() => null)` 静默降级为空收藏，用户无法区分「没有收藏」与「加载失败」。最佳实践：至少展示错误提示。
- [乐观更新顺序] career-tab.tsx:308-327 — 先 await 接口成功再 removeFavorite，失败回滚天然正确；但 jobs 路径调用 `positionApi.favorite(id)`（后端为 toggle 语义，已核实 position_handler.go ToggleFavorite），单次调用即取消收藏，正确。无问题。
- [错误吞掉] community-tab.tsx:162-166 — `submitPost` 失败仅 `reportError` 无用户提示，用户点击发布后无任何反馈（弹窗保持打开，无 toast）。最佳实践：失败时 toast 提示。
- [竞态] community-tab.tsx:89-106 — `loadTopics` 无 cancelled/序号保护，快速切换 sort 时旧响应可能覆盖新排序的列表。最佳实践：记录请求序号，仅应用最新。
- [错误吞掉] profile-tab.tsx:142-146 — `handleSave` catch 为空注释「保存失败保持弹窗」，用户保存失败时无任何提示，仅弹窗不关闭。最佳实践：toast 展示错误。
- [错误吞掉] profile-tab.tsx:154-158 — `handleDelete` 失败静默忽略，列表无变化且无提示。最佳实践：失败 toast。
- [脆弱判定] my-schedule-tab.tsx:28-35 — 用「错误消息包含 '学期' 或 '404' 字符串」判断「未配置学期」，依赖后端文案，后端改文案后失效导致整页报错。最佳实践：后端用明确错误码（如 ERR_NO_TERM）或 404 状态码判定。
- [逻辑错误] workspace-schedule-grid.tsx:561 — YearView 用 `e.dayOfWeek % 4 === m % 4` 伪随机把事件分配到某个月份，展示的是错误数据（且 MonthView 里 weekStart 跨月时 weekIndex 可能为 0 或越界）。最佳实践：按 event.date 归属月份，无 date 事件不进入年视图或全部展示。
- [逻辑] workspace-schedule-grid.tsx:507 — MonthView 用 `e.dayOfWeek === (index % 7 || 7)` 匹配「每周重复事件」，带 date 的单次事件会在当月所有同星期格重复出现。最佳实践：单次事件按日期精确匹配。
- [假链接] teacher-dashboard-tab.tsx:303,309 — 备课/导学 URL 硬编码 `/lesson/admin/hybrid/add?id=hybrid-1` 与 `${SCENE_PLATFORM_URL}/student_teacher.html?task=task-1-1`，所有课程/场景跳转同一假 ID，用户进入错误页面。最佳实践：按 session/plan 真实数据构造。
- [假链接] teacher-courses-tab.tsx:815,823 — 同 teacher-dashboard-tab：prepUrl 硬编码 `id=hybrid-1` / `task=task-1-1`。最佳实践：接真实 ID。
- [假数据] teacher-courses-tab.tsx:91-280 — TrackingView/AssessmentView/FinalView 全部渲染 mock 空数据（0 人、0%、空表），但交互按钮（课程期末总评、教学进展、测评进展）可达，教师看到全零统计。产品已知（mock 标注），建议接入真实接口或隐藏入口。
- [运行时风险] teacher-portraits-tab.tsx:426,470 — `student.achievementRate.toFixed(1)` 与 `activeStudent?.achievementRate.toFixed(1)`：achievementRate 若后端缺失为 undefined 时直接 TypeError 崩溃（可选链只保护 activeStudent 本身）。最佳实践：`(student.achievementRate ?? 0).toFixed(1)`。
- [展示] scene/page.tsx:26,28 — mapScenario 将 `positionName`、`creatorName` 硬编码为 '- '，场景大厅列表永远不显示岗位与创建人（后端实际有 professionNames/creatorId）。最佳实践：解析后端字段。
- [数据截断] scene/approvals/page.tsx:43 — `scenarioApi.list({ limit: 1000 })` 全量拉场景用于名称映射，若后端 maxPageSize 截断，未命中场景的审批记录显示原始 targetId。最佳实践：分页或按需 fetch。
- [一致性] scene/archive/page.tsx:62,89 — 「恢复」调用 `scenarioApi.saveDraft` 恢复为草稿，与后端存档语义一致；但批量恢复 `Promise.allSettled` 后统一 refresh，部分失败时 toast 汇总正确。无问题。
- [数据截断] landing/[id]/page.tsx:407-420 — `resourceLibraryApi.list({ limit: 200 })`、`knowledgeApi/abilityApi.list({ limit: 200 })` 均有后端上限截断风险（代码内 TODO 已自述），任务引用超出列表范围的资源/能力点显示缺失。最佳实践：按需拉取或分页。
- [竞态] landing/[id]/page.tsx:380-393 — 场景加载无 cancelled 保护，快速切换场景 id 时旧响应覆盖新场景。最佳实践：加 cancelled 标志。
- [数据截断] learn/page.tsx:156 — `resourceLibraryApi.list({ limit: 10000 })`：后端若存在 maxPageSize 上限，无论传多少都会被截断，资源缺失且无提示。最佳实践：确认后端上限，改分页。
- [错误吞掉] learn/page.tsx:324-335 — `handleSubmitMethod` 无 try/catch，`evaluationResultApi.submit` 失败时产生 unhandled rejection，用户无任何失败提示，且提交状态可能停留在 submitting。最佳实践：捕获并 toast，成功后刷新 myResults。
- [数据覆盖] edit/page.tsx:77-115 — 加载 effect 依赖 `[scenarioId, t]`，语言切换（t 变化）会导致整页表单重新加载并覆盖用户未保存的编辑内容。最佳实践：仅依赖 scenarioId。
- [失败不重试] use-task-datasets.ts:159-161 — `loadedDatasetsRef` 在请求发出前就标记 key 已加载，若该 key 请求失败（catch 仅 reportError），后续所有 `ensureDatasets([key])` 直接跳过，数据集永久为空直到整页刷新。最佳实践：失败时从 loaded 集合移除该 key。
- [竞态] use-task-datasets.ts:182-191 — 多处 setState 在多个并发 job 中互不覆盖 key（每 key 独立 state），但 `knowledge` 内 setKnowledgePoints + setCustomKnowledgePointIds 与 useEffect（110-129 行）可能交错，最终以最后一次为准，幂等性尚可。风险低。
- [兼容] task-description-card.tsx:180-184 — 通过检测 `<img`/`<video` 字符串提示「已插入多媒体内容」，与纯文本编辑器矛盾（用户无法插入），提示基本不会出现。可容忍。
- [数据丢失] page.tsx:186-339 — 主加载 effect 依赖 `user?.id`：登录态晚到（undefined→id）时整页数据（含任务状态）重新加载，覆盖用户早期编辑。最佳实践：user?.id 只影响 users 数据集，从 deps 剔除主加载。
- [重排序失败] page.tsx:1183-1188 — 拖拽排序立即调用 `taskApi.reorder`，若列表中含未落库的临时任务（新建未保存），reorder 请求携带不存在的 task id，后端可能整体失败（仅 reportError，前端顺序已变，刷新后错乱）。最佳实践：排序仅在保存时提交，或临时任务先落库。
- [除零] page.tsx:2326-2328 — `distributeGlobal` 当 unlocked 为空（全部锁定）时 `Math.floor(remaining / 0)` 得 NaN，权重全部变 NaN。最佳实践：unlocked.length === 0 时直接返回。
- [脆弱契约] page.tsx:1582 — `saveMethodsWithRetry` 依赖错误消息精确等于「评价规则已被其他会话修改」判断 409 冲突，后端文案变更即失效。最佳实践：按 HTTP 409 状态码判断。
- [未处理异常] page.tsx:1651-1660 — `handlePersistStandard` 无 try/catch，`saveMethodsWithRetry` 抛错为 unhandled rejection，评价标准落库失败用户无感知。最佳实践：捕获并 toast。
- [安全校验] superadmin/page.tsx:256-278,286-289 — 认证状态仅靠前端解析 JWT payload 的 roleCodes 判断（签名未验证），但所有数据请求走后端 saasRequest（后端鉴权兜底），越权风险可控；仅存在「token 伪造本地通过但请求全部 401」的假登录体验。可接受，P2 提示。
- [未处理异常] superadmin/page.tsx:209-213 — `openTenantTheme` 中 `await fetchThemeColor(ten.id)` 无 try/catch，接口失败产生 unhandled rejection 且弹窗打开后颜色为默认值。最佳实践：捕获并 toast。

### frontend-comp-01.md（11 条 P2）

- [性能/状态] auth-provider.tsx:67-99 — `fetchMe` 依赖 `pathname`，每次路由变化都重新调用；且当进入公共页面时执行 `setState({ loading: false })`（无 `me` 字段），会**清空已登录用户状态**，用户从私有页切到公共页再返回时经历状态丢失 + 重新拉取的闪烁；最佳实践：公共页面仅跳过拉取、保留旧 state（`setState(prev => ({ ...prev, loading: false }))`），并把拉取条件改为「token/首次加载」而非 pathname。
- [错误被吞] question-form-dialog.tsx:111-112 — 知识点列表加载失败 `catch (_err) {}` 完全静默，用户打开「关联知识点」下拉只见「加载中…」→ 无数据，无法区分失败与确实无知识点；最佳实践：至少 `reportError` 或 toast 提示。
- [后端契约/数据不完整] random-question-dialog.tsx:78 — `questionApi.list({ limit: 10000 })` 被后端钳制为 200 条（query.go:439-440），**随机抽题池实际只有全量题目的前 200 题**，超出部分永远抽不到且无任何提示；最佳实践：按 bankId 分批拉取（如逐题库 limit=200 聚合）或后端支持 noPagination 全量。
- [后端契约/数据不完整] bank-question-selector-panel.tsx:121 — `questionApi.list({ bankId, limit: 1000 })` 被钳制为 200，题库题目超过 200 时列表截断，剩余题目无法被选中；最佳实践：分页加载或按类型/搜索分批聚合。
- [并发竞态] bank-question-selector-panel.tsx:118-137 — `handleSelectBank` 连续切换题库时旧 `loadQuestions` 请求未取消，先发后至的响应会覆盖新题库列表（显示错误的题目集合）；最佳实践：用请求序号/AbortController 丢弃过期响应。
- [后端契约/数据不完整] evaluation-rules-editor.tsx:441 — `randomDrawQuestionApi.list({ limit: 9999 })` 被钳制为 200：现场问答题超过 200 条时，「新增现场问答题」面板/详情/选择全部缺失；最佳实践：分页或后端提供全量模式。
- [后端契约/数据不完整] evaluation-rules-editor.tsx:539 — `examApi.list({ limit: 1000 })` 被钳制为 200：试卷超过 200 份时「选择已有试卷」列表截断且无提示；最佳实践：分页加载 + 搜索。
- [状态不持久化] evaluation-rules-editor.tsx:394-396,2014-2043 — `qbDrawMode`（答题方式：全部作答/自由刷题）与 `qbPassRate`（正确率）是纯本地 state，从未写入 `methodResourceConfigs`，关闭弹窗/刷新即丢失，且对保存结果无任何影响（自由刷题开关形同虚设）；最佳实践：随 `updateResourceConfig('question_bank', {...})` 持久化。
- [状态管理/多实例串数据] shared-defs.ts:21-23,50-61 — `_loadedExams/_questionCache/_allQuestions` 为模块级可变全局缓存：`loadPapers`（evaluation-rules-editor.tsx:535-536）在缓存非空时**跳过重新拉取**，而 `clearAllCaches` 仅场景任务编辑页（app/scene/scenarios/[id]/edit/tasks/page.tsx:181）调用——课程编辑器/其他任务页面打开时复用旧缓存：同 SPA 会话内新建/修改的试卷不显示、切换租户（登出重登）后仍显示上一个租户的试卷列表（跨租户数据泄露）；最佳实践：缓存收敛到 React Context/单页级状态，按 tenantId 隔离，或在每次编辑器挂载时以 loading 态重新拉取。
- [重复提示] global-api-error-handler.tsx:10-28 — api-helpers.ts:189-191 对**所有**非 401 错误回调全局处理器（无论调用方是否自行 catch），而本组件对所有 4xx/5xx 一律弹 toast：与组件内本地 toast 的 catch 分支（如 exam-form-dialog 上传失败、evaluation-rules-editor 保存失败等均先本地 toast）叠加形成**双 toast**；最佳实践：全局处理器仅处理「未被消费的」错误（如 request 层增加 consumed 标记），或全局只做 console/上报不弹 toast。
- [后端契约/数据不完整] job-home.tsx:169,202,209,236 — `scenarioApi.list`/`publicPositionApi.list`/`taskApi.list` 均传 limit:1000 被钳制为 200：岗位/场景超过 200 时首页总数、筛选、排行榜与详情页数据全部截断且无提示；最佳实践：服务端分页 + 搜索参数，或接受截断并展示「仅展示前 200」。

### frontend-comp-02.md（16 条 P2）

- [性能] knowledge-graph-d3-view.tsx:181-195,213-472 — ResizeObserver 每次尺寸变化都会触发全量重建（simulation 重启、节点位置/缩放丢失、fitTimer 重新执行）；窗口缩放/字体调整时图谱跳动明显。最佳实践：尺寸变化仅调整 svg viewBox，不重建 simulation；或将重建节流（requestAnimationFrame 合并）。
- [残留渲染] knowledge-graph-d3-view.tsx:213-214 — `filteredNodes.length === 0` 直接 return 不清空 g 元素；节点数据由有变无时旧图残留（外壳层 emptyView 只在 nodes 初始为 0 时兜底）。最佳实践：空数据时 `g.selectAll('*').remove()`。
- [性能] knowledge-graph-view.tsx:145-149 — filteredNodes/filteredEdges 每次渲染重建（未 memo），ReactFlow 每帧收到新引用触发全量 reconcile；connectedIds 已 memo，此处建议一并 useMemo。
- [提交/保存] course-evaluation-rules-dialog.tsx:119-135 — 对话框「保存」仅校验权重并关闭，真实持久化依赖父级 onChange 链路，保存失败无提示、错误不透传；若父级未保存，用户看到的是"已保存"的假象。
- [错误被吞] hybrid-modules-view.tsx:251-257 — `evalRuleConfigToMethods(ruleConfig)` 异常被 try/catch 吞掉 → methods=[] → 整个评价模块卡片静默消失，无任何提示；规则数据损坏时学生端完全无感知。最佳实践：catch 后至少渲染「评价规则异常」占位。
- [部分失败不一致] data-provider.tsx:244-250 — updateExamStatus submit 流程：`examApi.submit` 成功后 `approvalApi.create` 失败 → 试卷已提交但审批记录缺失，仅向调用方抛通用错误，无补偿/重试。最佳实践：approval create 失败时提示已提交但审批未建，或先建审批再提交。
- [静默 no-op] data-provider.tsx:257-270 — approve/reject 时查不到 pending 审批记录则静默跳过（仅刷新列表），用户点「通过」无任何反馈。建议无记录时 toast 提示。
- [状态管理] archive-list-page.tsx:91,103-120,215-248 — 搜索/侧栏筛选变化时不清空 selectedIds：批量操作可作用于不在当前列表中的条目（筛选后残留选择）；且批量操作异常抛出时（无 try/catch）选择同样被清空，用户丢失选择。最佳实践：onSearchChange/onSidebarSelect 时联动清空选择；批量操作失败时保留选择并提示。
- [依赖不稳定] batch-selector.tsx:40-45 — useEffect 依赖 `batchApi` 对象身份：调用方若传内联对象，每次渲染触发重新请求 → setState → 父级重渲染 → 新对象 → 再请求，形成拉取循环；且无 cancelled 清理。最佳实践：调用方 memo 化 API 对象，或组件内部以字符串 key 依赖。
- [错误被吞] citation-stats-panel.tsx:62-69 — fetchStats 失败静默 setStats(null)，页面显示 '-' 无任何错误提示；建议至少 console/reportError 留痕。
- [错误处理] approval-dialogs.tsx:142-153 — confirmApprove/confirmReject 的 `await onApprove/onReject` 无 try/catch：API 失败时异常上抛（父级未捕获即 unhandled rejection），弹窗保持打开但无任何错误提示，用户可无感知重试导致重复提交。最佳实践：catch 后在对话框内展示错误文案。
- [并发竞态] content-list-page.tsx:460-464 — loadData 无取消/序号保护，reloadKey 连续 bump（连续操作触发 refresh）时多个请求并发，先发的慢响应可能覆盖后发的新数据，列表回退到旧状态。
- [UX] content-list-page.tsx:399 — 每次 loadData 都 `setExpandedBatches(全部展开)`，用户折叠状态在每次操作后的 refresh 中丢失。
- [逻辑 bug] content-list-page.tsx:792-810 — CSV 导出 `importExportApi.export(exportEntityName)` 不带选中 ids，导出全部数据；而按钮文案/禁用态为"选中项导出"（Excel 路径 exportXxxExcel(selectedIds) 是正确的），行为与语义不符。
- [部分失败不一致] content-list-page.tsx:600-612,969-983,990-1009 — 提交审批均为"先 submit 再 approvalApi.create"两步：第二步失败时实体已进入 pending 但无审批记录，仅 toast 错误；用户重试又会触发 submit → pending→pending 后端 400。最佳实践：create 失败时提示"已提交但审批未创建，请勿重复提交"或后端合并为单接口。
- [后端契约] eval-method-card.tsx:326-329 — 提交载荷 `maxScore: 100` 硬编码；后端按 max_score 计分/展示（packages/api-client lesson.ts:249-251），若测评配置最大分 ≠ 100（如 50 分制），成绩与展示错位。最佳实践：从 method.resourceConfig/规则配置取 maxScore，缺省再回退 100。

### frontend-comp-03.md（14 条 P2）

- [状态管理] question-grading-card.tsx:150,163-175 — `localScore` 只在 `useState(score.toString())` 时初始化一次，外部 `score` 属性变化（撤销评分、服务端回填、父组件重置）后输入框不回显新值，且 `handleBlur` 失败时用旧 `score` 还原，可能把刚提交的值覆盖回旧值。最佳实践：`useEffect(() => setLocalScore(score.toString()), [score, question.id])` 同步或按 `question.id` 重建组件。
- [数据丢失] image-list-upload.tsx:74-83 — `handleFiles` 直接 `queueRef.current = list.filter(...)` 覆盖队列：若用户在前一批文件仍在上传/正在编辑（editTarget 打开）时再次选择文件，前一批剩余文件被静默丢弃，且 `editTarget` 被新文件覆盖（正在编辑的图片在 `finishEdit` 时以新 target 回调，编辑结果写错对象）。最佳实践：追加队列 `[...queueRef.current, ...files]`，或在 `uploading || !!editTarget` 时拒绝选择。
- [并发竞态] knowledge-selector.tsx:204-230,243-264 — `handleSceneChange`/`handlePositionChange` 无序号/取消保护：快速连续切换场景或岗位时，先发出的请求后返回会覆盖后发请求的 `filterKpIds`（fetch 覆盖，筛选结果错乱）；搜索（158-177）有 `searchSeqRef` 保护而筛选没有。最佳实践：与搜索一致加 seqRef 比对或 AbortController。
- [错误吞掉] knowledge-selector.tsx:355 — `handleSaveKp` 的 `onAddCustom?.(...)` 同步调用不 await：新建知识点名称与 pool 之外后端已有 KP 冲突时（findNameCollision 只查 pool/searchResults/selected，309-315 未覆盖懒加载的 allKps）后端返回 409，onAddCustom 的 rejection 无人捕获 → 未处理 Promise rejection、界面无提示。最佳实践：`await onAddCustom(...)` 并 catch 展示错误；或把冲突校验扩到 allKps。
- [与后端契约] major-select.tsx:42-46 — `limit: 1000` 被后端 `ParsePageLimit` 钳制到 MaxPageSize=200（backend/internal/handler/common.go:126 `MaxPageSize = 200`），专业数 >200 时列表静默截断且无分页/提示。最佳实践：参照 knowledge-selector 的 `fetchAllPages` 分页拉全量，或显式注明 200 上限。
- [逻辑] portal-crud-page.tsx:182-186,258-265 — 导入预览生成后打开确认弹窗；用户点「取消/关闭」确认弹窗后 `importPreview` 仍保留（不清空），无法再次打开确认弹窗（只有重新导入才触发 effect），且 `setImportFiles([])` 在向导关闭时清空导致重导需重新选文件。最佳实践：关闭确认弹窗时 `setImportFiles([])` 或保留 preview 可重开。
- [状态管理] portal-sidebar-crud-page.tsx:170,225-231 — `selectedIds` 在翻页/改搜索/改状态/改组织筛选后不清空：跨页残留选中，`toggleSelectAll` 的判定与替换只基于当前页 `filteredItems`（先选满第 1 页再翻到第 2 页，表头复选框表现为已全选但实际第 2 页未选；点击后清空全部含第 1 页），导出/批量加入的选中计数与所见不一致。最佳实践：筛选/翻页时清空 selectedIds，或全选语义改为跨页记录。
- [数据一致性] resource-selector.tsx:342-365 — `resourceLibraryApi.create` 成功后（355-359）`courseResourceApi.bind`/`nodeResourceApi.bind` 失败时进入 catch 提示「资源保存失败」并 return，但资源已在资源库创建、文件已上传 → 用户重试会重复创建资源（无幂等/无回滚），库中残留孤儿资源。最佳实践：bind 失败时提示"资源已创建但绑定失败"，或提供删除已建资源的补偿。
- [状态管理] resource-selector.tsx:367-368,375-377 — `useApi=false`（无 courseId/nodeId 的 standalone 场景）时上传仅走 `onUpload?.(newRes)`，`newRes` 不进 `mergedPool`，随后 `onChange([...selectedIds, newRes.id])` 后 `selectedResources` 按 id 在 mergedPool 查找失败 → 已选标签不显示刚上传的资源（依赖父组件把 onUpload 结果回填 externalPool 才能显示）。最佳实践：无论 useApi 与否都把 newRes 加入 internalPool。
- [与后端契约] user-selector.tsx:219,225 — `limit: 200` 静默截断用户列表：组织内用户 >200 时搜索/选择不到后续用户且无分页/提示。最佳实践：分页拉全量或加"仅显示前 200"提示。
- [状态管理-多实例串数据] use-tags.ts:9-11 — 模块级 `cachedTags` 未按租户 key 隔离：同一 SPA 内切换租户（多租户部署、超管切换组织上下文）会复用上一个租户的标签缓存直到 reload()，可能把 A 租户标签展示给 B 租户。最佳实践：缓存 key 加租户维度（如 `cachedTagsByTenant`）。
- [与后端契约] workflow-config-page.tsx:74-88 — `workflowApi.list({ limit: 1000 })` 被后端钳制到 200（MaxPageSize），审批流程 >200 时列表截断且无分页提示。流程数通常较少，可接受但建议注明。
- [重复提交] workflow-config-page.tsx:137-170 — `handleSave` 无 submitting 防重入：连点「创建流程」可重复创建（或重复 PUT）；保存按钮未 disabled。最佳实践：加 saving state 并禁用按钮。
- [性能] zip-preview.tsx:100-105 — 最大 50MB zip 在主线程 `unzipSync` 同步解压：大包解压期间 UI 完全冻结（移动端明显）。有 50MB 上限兜底，可接受，但可考虑 Worker。

### frontend-lib.md（9 条 P2）

- [逻辑] evaluation-rule-store.ts:345-347 — 导出配置时把所有 `homework` 反向映射为 `exam`，但 `'exam'` 不在 `EvalRuleMethodKey` 类型联合内（shared-types:5-11），且仅映射了 `evaluationMethods` 数组，`methodWeights`/`methodEvalObjects`/`methodResourceConfigs` 等兄弟字段仍保留 `homework` 键 → 导出配置内部键不一致；若父组件传入真实的 `homework` 方法（合法 key），导出后会被改写为 `exam`。当前调用方（course-evaluation-rules-dialog）通过二次归一化掩盖了此问题，但任何新消费方直接读 `onChange` 结果都会踩坑；最佳实践：导出时按"输入即输出"原样透传方法键，仅对来源为 `exam` 的做还原。
- [i18n] hybrid-eval.ts:6-10 — `HYBRID_EVAL_MODULE_LABELS` 硬编码中文「课前测验/随堂测验/课后作业」，且经抽查 `en.json` 中「课前测验」无对应翻译（「随堂测验/课后作业」有），EN 模式下该标签仍显示中文；最佳实践：标签改为 key 常量并在调用方用 `t()` 翻译，或补全 en.json。
- [i18n] menu-permissions.ts:42-69,181-257 — `buildMenuTree` 与 `permissionModuleConfig` 的平台名/落地页/动作标签全部硬编码中文，这些标签直接渲染在角色权限配置界面；EN 模式下不经过 `t()` 仍显示中文；最佳实践：label 处接入 `t()` 或引入集中式 key。
- [数据完整性] use-resource-maps.ts:12,31 — `limit: 1000` 硬编码且不传 tenantId 过滤，行业/专业超过 1000 条时列表被截断，map 静默缺失 name（详情页显示原始 id）；最佳实践：确认后端分页上限并分批拉取，或接口增加按需搜索。
- [i18n] use-approvals.ts:18,166 — `PERMISSION_DENIED_HINT` 未收录进 en.json（已核实 missing），且第 166 行直接渲染常量未走 `t()`，EN 模式下批量驳回权限不足提示为中文，与 119 行（有 `t()`）不一致；最佳实践：为常量补充 en.json 翻译并统一用 `t(PERMISSION_DENIED_HINT)`。
- [状态管理] use-portal-users.ts:34 — `options.page` 仅用于初始化 state，之后父组件改变 `options.page` 不会同步（受控/非受控混用），分页外部控制时页码失效；最佳实践：page 改为受控 props 直接消费，或用 useEffect 同步。
- [数据完整性] use-submitter-names.ts:18 — `userManagementApi.list({ limit: 1000 })` 全量拉取用户，超 1000 时姓名映射缺失，`getName` 回退显示原始 userId（对非本人可见的隐私兜底逻辑），且不传 tenantId（依赖服务端从 token 推断）；最佳实践：确认用户量级并支持分批/搜索式补充拉取。
- [i18n] 全站共 47 处正则命中中，去重后**确认缺失 3 个 key**，其中本次审查范围内 1 个：
- [i18n] 硬编码中文残留（不经 t() 直接渲染或作为常量）：hybrid-eval.ts 模块标签、navigation-config/menu-permissions 全部导航标签、resource-type-constants 报错文案、use-org-tree/use-submitter-names 错误兜底、org-type-icons 类型名 —— 详见各文件条目。

### frontend-shared-types.md（39 条 P2）

- [契约] affairs.ts:109 — `TeachingPlan.rejectReason?` 后端不存在：`domain/affairs.go` TeachingPlan 无该字段，全后端 grep 无 `reject_reason`/`rejectReason` 写入路径（content_actions.go 驳回仅改 status）。死字段，注释"驳回原因"不实；最佳实践：删除或等后端实现审批驳回原因后再补。
- [契约] affairs.ts:108 — `TeachingPlan.updatedAt?` 标可选，但后端 `domain/affairs.go:78` `UpdatedAt time.Time json:"updatedAt"` 无 omitempty 必返；最佳实践：改为必填 `updatedAt: string`。
- [契约] backend.ts:22 — `Tenant.adminIds: string[]` 标必填，后端 `domain/unified.go:112` `AdminIDs []string json:"adminIds,omitempty"` 可空；最佳实践：改 `adminIds?: string[]`。
- [契约] backend.ts:47 — `OrgType.isDefault?` 标可选，后端 `domain/unified.go:124` `IsDefault bool json:"isDefault"` 无 omitempty 必返；最佳实践：改必填。
- [契约] backend.ts:83 — `Role.status: string` 必填，后端 `domain/unified.go:217` 无 omitempty 必返，一致（无问题）；`StaffTitle.status`（83）同理一致。
- [契约] certificate-issuance.ts:19,38-39 — `IssueStatus` 含 `'revoked'` 且声明 `revokedAt/revokeReason`，但后端**无撤销端点/写入路径**（全后端 grep 无 revoke 操作，`store/micro_cert.go` 仅插入 `'issued'`），该状态永远不出现；最佳实践：删除或注明"预留"。
- [类型] certificate-issuance.ts:15-16,34-35 — `createdAt/updatedAt/issueDate/expireDate/revokedAt` 标 `Date`，JSON 反序列化得到的是 ISO 字符串，运行期并非 Date 对象；最佳实践：统一改 `string`（需要日期运算时再 new Date()）。
- [契约] certification.ts:5-13 — `RuleStatus` 含 `'reviewing'/'ready'/'none'`，后端 certification_rules.status 无校验约束（varchar(16)，migration 001:269-272），后端代码中仅出现 draft/not_submitted/published 写入（store/certifications.go:102,648、domain/status.go:19），reviewing/ready/none 是前端自造值；风险：与后端将来加约束或前端状态机不一致；最佳实践：注释标明哪些值仅前端本地流转。
- [契约] evaluation-exam.ts:104,180 — `QuestionBank.code?/Exam.code?` 标可选，后端 `domain/evaluation.go:10,78` Code string 无 omitempty 必返；最佳实践：改必填。
- [契约] evaluation-exam.ts:118 — `QuestionBank.isDraftPool?` 标可选，后端 `:24` 无 omitempty 必返；最佳实践：改必填。
- [契约] evaluation-exam.ts:143,173 — `Question.answer: string | string[]`，后端 `Answer JSONSlice json:"answer"`（:50,69）恒序列化为数组；标 string 分支运行期不存在；最佳实践：统一 `answer: string[]`（表单输入可另用联合）。
- [契约] evaluation-exam.ts:188 — `Exam.questions: ExamQuestion[]` 必填，后端 `:85` `json:"questions,omitempty"` 可空；最佳实践：改 `questions?: ExamQuestion[]`。
- [契约] evaluation-exam.ts:200 — `Exam.isTemp?` 标可选，后端 `:97` 无 omitempty 必返；最佳实践：改必填。
- [契约] evaluation-exam.ts:236 — `ExamUsage.status` 联合含 `'pending'|'scheduled'`，后端该实体的状态只有 draft/published/in_progress/finished（handler/exam_usage_handler.go:77-79,186-213、store/exam_usages.go:72-74）；pending/scheduled 是其他实体的状态；最佳实践：收缩为四值。
- [契约] evaluation-exam.ts:237 — `activationMode?` 标可选，后端 `domain/evaluation.go:113` 无 omitempty 必返；最佳实践：改必填。
- [契约] evaluation-exam.ts:256 — `ExamResult.gradingStatus?` 标可选，后端 `:134` 无 omitempty 必返（'pending'|'evaluated' 值正确）；最佳实践：改必填。
- [契约] evaluation-scene.ts:77 — `JobAbilityResult.studentId` 必填，后端 `StudentNo *string json:"studentId,omitempty"`（:41）可空；最佳实践：改可选。
- [契约] evaluation-scene.ts:75,87-91 — `userId?/positionCompetency?/positionCompetencyV2?/abilityCognitionScore?` 标可选，后端 handler 全部无 omitempty 必返（:39,54-58）；最佳实践：改必填。
- [契约] evaluation-scene.ts:16 — `EvaluationMethod.relatedTaskIds: string[]` 必填，后端 `domain/evaluation.go:170-178` EvaluationMethod **无此字段**（grep 全后端无 relatedTaskIds），永远 undefined；最佳实践：删除，或确认前端另有关联接口再补来源注释。
- [契约] evaluation-scene.ts:37-38 — `SceneEvaluationResult.evaluatorId?/evaluatorType?` 标可选，后端 `:188-189` 无 omitempty 必返；最佳实践：改必填。
- [契约] graduation.ts:18-21 — `startDate/endDate: Date` 且必填，后端 `*string json:"startDate,omitempty"`（:332-333）可空字符串；`createdAt: Date`（21）同文件多处 Date 类型为 ISO 字符串。
- [契约] graduation.ts:34-40 — `GraduationProjectArchive` 的 `topicName/studentName/advisorName/enterpriseMentorName?/positionName` 后端均不返回（后端仅 id/topicId/userId/phase/docStatus/docCount/hasRectification/lastUpdated，:339-348）。
- [契约] graduation.ts:50-54 — `GraduationProjectEvaluation.topicName/studentName/studentId/comprehensiveGrade: EvaluationGrade` 必填，后端不返回或 `ComprehensiveGrade *string omitempty`（:358）可空。
- [契约] graduation.ts:64-65 — `GraduationQueryResult.className/majorName` 必填，后端 `*string omitempty`（:368-369）可空。
- [契约] job.ts:3 — `CareerPosition.code?` 标可选，后端 `domain/job.go:27` Code string 无 omitempty 必返；最佳实践：改必填。
- [契约] job.ts:23-25 — `favoriteCount?/viewCount?/abilityCount?` 标可选，后端 `:46-48` 无 omitempty 必返；最佳实践：改必填。
- [契约] lesson.ts:3 — `Course.code?` 标可选，后端 `domain/lesson.go:9` Code string 无 omitempty 必返；最佳实践：改必填。
- [契约] lesson.ts:37 — `Course.viewCount?` 标可选，后端 `:42` 必返；最佳实践：改必填。
- [契约] lesson.ts:30 — `coCreatorIds: string[]` 必填，后端 `:36` `json:"coCreatorIds,omitempty"` 可空；最佳实践：改可选。
- [契约] lesson.ts:125 — `NodeResource.url: string` 必填，后端 `domain/lesson.go:134` `*string omitempty` 可空；`uploadedAt?: string`（128）标可选，后端 `:138` 必返；最佳实践：url 改可选、uploadedAt 改必填。
- [契约] portrait.ts:10-26 — `StudentAbilityArchive` 与后端 `domain/evaluation.go:303-317` 不符：studentName/studentId/className 后端不返回（后端为 UserID），`obtainDate: Date`（18）后端为 `*string omitempty`（:309）且可空，`isEnabled/auditStatus` 等一致。
- [契约] portrait.ts:44-75 — `StudentAbilityPortrait` 与后端 `:279-300` 不符：studentName/studentId/className/majorName/positionName/gender/gradeYear/yearRank/yearTotal/attendanceRate 等 15+ 字段后端不返回（后端为 userId/careerPositionId），`updatedAt: Date`（58）类型错误；字段名能对的仅 domainScores/classRank 等少数。
- [契约] scene.ts:4 — `Scenario.code?` 标可选，后端 `domain/scene.go:8` Code string 无 omitempty 必返；最佳实践：改必填。
- [契约] scene.ts:14,25 — `viewCount?/taskCount?` 标可选，后端 `:28-29` 必返；最佳实践：改必填。
- [契约] scene.ts:20 — `coBuilderIds: string[]` 必填，后端 `:23` `json:"coBuilderIds,omitempty"` 可空；最佳实践：改可选。
- [契约] scene.ts:118 — `RubricTemplate.isDeleted?` 标可选，后端 `:64` `IsDeleted bool` 无 omitempty 必返；最佳实践：改必填。
- [契约] scene.ts:214 — `SceneBatch.scenarioCount?` 标可选，后端 `:179` 必返；最佳实践：改必填。
- [契约] shared-models.ts:16 — `User.email: string` 必填，后端 `domain/models.go:58` `Email *string json:"email,omitempty"` 可空；最佳实践：改 `email?: string`。
- [类型] shared-models.ts:35 — `Collaborator.addedAt: Date`，JSON 反序列化为 ISO 字符串；最佳实践：改 string。

### frontend-ui.md（9 条 P2）

- [逻辑缺陷] PlatformSideNav.tsx:95-103 — 展开状态 effect 每次都执行 `[...defaultExpanded, ...activeParents, ...prev]` 并 setExpandedItems：① 只要某父项处于 active 路径，手动折叠后下一次路由变化会被强制重新展开，用户折叠意图被覆盖；② 集合只增不减（prev 永远并入），长期导航后展开项单调膨胀；最佳实践：折叠/展开交由用户显式控制，effect 仅在初始化/配置变化时设置默认展开，不再把 prev 并入；或将 active 父项展开与用户折叠状态分开管理。
- [错误处理缺失] import-wizard-dialog.tsx:99-106 — `handleDownload` 的 try 块无 catch：`onDownload()` 抛错时只有 finally 复位 loading，错误变成 unhandled promise rejection，用户无任何反馈；最佳实践：catch 后用 toast 提示下载失败。
- [错误处理缺失] import-wizard-dialog.tsx:108-117 — `handleImport` 同样无 catch：`onImport()` 抛错时导入状态复位但用户无反馈（调用方 useImportFlow 内部的 executeImport 有 catch，但受控模式传入的 onImport 可能直接抛错）；最佳实践：catch 并 toast。
- [事件处理缺陷] import-wizard-dialog.tsx:184-191 — file input 选择后未重置 `e.target.value`：用户先添加文件再移除，再次选择同一文件时 `onChange` 不会触发（input value 未变），表现为"点了没反应"；最佳实践：onChange 末尾加 `e.target.value = ''`。
- [无障碍] import-wizard-dialog.tsx:176-192 — 上传区是一个 div+cursor-pointer+onClick，无 `role="button"`/`tabIndex`/键盘事件，键盘用户无法触发文件选择；最佳实践：改为 `<label>`+隐藏 input 或补 `role="button" tabIndex={0} onKeyDown`。
- [重复 id] multi-select-search.tsx:121-127 — "全选" Checkbox 使用固定 `id="multi-select-all"`：同页多个实例时产生重复 id，`htmlFor` 只会命中第一个实例的 checkbox；最佳实践：用 `useId()` 生成实例唯一 id。
- [无障碍] multi-select.tsx:108-143 — 下拉面板是自建 div 实现：无 Escape 关闭、无焦点管理（打开后焦点不进入搜索框管理之外）、选项为 div+onClick 无键盘导航；最佳实践：迁移到 Radix Popover/Select 或补 Escape 监听与方向键导航。
- [竞态/泄漏] use-async.ts:51-70 — `refresh` 无竞态防护：并发触发多次 refresh 时，先发请求的响应可能覆盖后发请求（响应乱序）；组件卸载后仍在飞行中的请求 resolve 后继续 setState（内存与状态泄漏，React 18 无警告但浪费）；最佳实践：内部用 request id 或 AbortController 丢弃过期响应，并在 effect 清理时标记 unmounted。
- [产品行为] use-toast.ts:8 — `TOAST_LIMIT = 1`：新 toast 通过 `slice(0, 1)` 直接把旧 toast 从数组摘除，旧 toast 未走 DISMISS 流程（无收起动画、不触发其 onOpenChange），连续错误时用户只能看到最后一条；最佳实践：若为刻意取舍建议注释说明；否则改为叠加展示或先 DISMISS 再 ADD。

### handler-01.md（14 条 P2）

- [静默失败] affairs_config_import_handler.go:74-79、106-111、152-157 — 三个 Sheet 的重复检查 `QueryRow(...).Scan(&exists)` 错误全部忽略，INSERT 的 `Exec` 错误也忽略：数据库故障或字段类型不合法（如日期格式错误）时，导入返回 200 且计数虚高，部分行静默丢失；最佳实践：Scan/Exec 出错时记录日志并返回 500（或至少计入 skipped 并在响应中带 error 字段）。
- [事务缺失] affairs_config_import_handler.go:53-166 — 三个 Sheet 的导入不在同一事务中，中途某行失败会留下已插入的部分数据，且用户无从得知；最佳实践：整次导入包在 `BeginTx` 中，任一步失败整体回滚（导入为一次性后台操作，事务开销可接受）。
- [错误处理] alliance_crud_handler.go:49 — `alliancePublicGet` 将 store 的所有错误（含 DB 故障）统一响应 404，掩盖服务器错误、误导排查；最佳实践：区分 `ErrNotFound` 返回 404，其余走 respondServerError。
- [数据丢失] alliance_handler.go:613-628 — `UpdateDictionaryItem` 未携带 name 时会把字典项名称更新为空串（store/alliance_dictionary_store.go:49-54 全列覆盖）；最佳实践：请求未携带字段时回退 GetDictionaryByID 的现有值。
- [错误被吞] alliance_handler.go:66 — `updated, _ := h.Store.GetSchoolInfo(...)` 忽略错误，回读失败时响应 200 body 为 null；最佳实践：错误走 respondServerError。
- [错误被吞] alliance_handler.go:151、187 — `item, _ := h.Store.GetEnterpriseAgreementByID(...)` 忽略错误，失败时 201/200 返回 null；最佳实践：错误走 respondServerError。
- [错误处理] alliance_handler.go:436-441 — `GetPermission` 将 store 所有错误（含 DB 故障）响应 404；最佳实践：区分 pgx.ErrNoRows 与内部错误。
- [越权] appeal_handler.go:101-138 — `Process` 仅校验登录与租户归属，无任何角色/权限校验：本租户任意登录用户（含学生）可审批（approved/rejected）他人申诉；最佳实践：增加教师/管理员角色校验（如 canManageAlliance 类似的角色检查）。
- [并发竞态] approval_handler.go:160-196 — "all" 审批模式下并发审批：两条请求都读到 pending 记录、各自 append 历史后整段写回 History（UpdateApprovalHistory 全量覆盖），后写覆盖先写，可能丢失已通过的审批记录或重复推进；最佳实践：历史追加改为 SQL `history = history || $1::jsonb` 原子追加，或对 status/step 加条件更新（WHERE status='pending'）。
- [错误被吞] approval_handler.go:175、196、221 — `record, _ = h.Service.GetApproval(...)` 忽略错误，回读失败时 200 返回 null；最佳实践：回读失败走 respondServerError。
- [数据被覆盖] batch_handler.go:227-233 — `UpdateWithStatus` 配置下，请求未携带 status 时强制重置为 `StatusOpen`：仅改名称/编码的局部更新会把已关闭（closed）的批次静默重开；最佳实践：status 为空时保持原值（不写 status 列），只有显式传入才更新。
- [租户边界] batch_handler.go:169-172 — 创建时若 claims.TenantID 为空则 tenantID=nil，`BatchCreate` 以 NULL tenant_id 落库；对 TenantScoped 配置的表（如课程批次）将产生无主记录，绕开租户隔离（普通业务写入路径，见 AGENTS.md"核心业务加锁、普通允许重复"权衡，但建议 TenantScoped 时强制 requireTenant）；最佳实践：TenantScoped=true 时对无租户 claims 直接 403。
- [契约不一致] cert_grade_handler.go:95-123 — 某年级无组件/无榜单数据时 `CompData`/`Leaderboard` 保持 nil，JSON 序列化为 `null` 而非 `[]`，与前端"数组"契约不符（前端需判空）；最佳实践：初始化 `CompData: []CompGroupDTO{}`、`Leaderboard: []LeaderboardEntryDTO{}`。
- [错误被吞] certification_handler.go:470 — `rule, _ := h.Service.GetCertificationRule(...)` 忽略错误，保存成功但回读失败时 200 返回 null；最佳实践：回读失败走 respondServerError。

### handler-02.md（20 条 P2）

- [错误处理] content_actions.go:134-139 — transition 成功写入后回读 fetch 失败即响应 404"不存在"：状态已变更但前端收到"不存在"，且把 DB 故障伪装成资源缺失。最佳实践：fetch 错误区分 ErrNotFound 与内部错误，内部错误用 respondServerError。
- [错误处理] content_actions.go:183-184 — review 回读 fetch 错误被丢弃（`entity, _ :=`），失败时返回 200 + "null" 响应体。最佳实践：回读失败记录并返回 500（respondServerError）。
- [性能] course_export_handler.go:171-189 — lookupCourseAbilityPointNames 对每个能力点 ID 单独执行一条 QueryRow（N+1）；叠加 fillCoursesData 每课程 2 条额外查询（majors/lesson_batches:72-78）+ 每节点 3 条查询（148-150），大规模导出（数百课程/节点）时产生数百至数千次往返。最佳实践：能力点名称批量 `WHERE id = ANY($1::uuid[])` 一次查询。
- [错误处理] course_handler.go:465-469 — SubmitHomework：`exists, err := ...; if err != nil || !exists` 将 DB 内部错误与"不存在"同等对待，DB 故障静默返回 404"作业不存在"。最佳实践：err != nil 时走 respondServerError。
- [错误处理] course_handler.go:583-587 — SubmitNodeHomework 同上（err != nil || !exists → 404）。最佳实践：区分 DB 错误与不存在。
- [契约] course_handler.go:498-520,616-637 — ListHomeworkSubmissions/ListNodeHomeworkSubmissions 响应仅含 items 无 total 且 items 为 map[string]any 手拼，缺少 total 字段与 ListResponse 通用结构不一致。最佳实践：与前端确认契约后统一为 ListResponse。
- [数据丢失] course_import_handler.go:186-204 — overwrite 模式下对已存在课程 UPDATE 后立即 clearCourseNodes 删除全部节点/测评（201-202行），若后续同名课程节点导入因 Excel 错误中断，原课程节点数据已不可恢复（非事务）。最佳实践：overwrite 导入整体放入事务，失败回滚。
- [错误处理] course_node_handler.go:127-131,210-213,274-277 — Get/Update/Delete 对 GetNodeBase 的**任何**错误（含 DB 故障）统一响应 404"课程节点不存在"，内部错误被吞并误导。最佳实践：ErrNotFound → 404，其余 respondServerError。
- [性能] course_node_handler.go:315-454 — enrichCourseNodes 每次 List/Get 对知识/资源/测验/作业/继承源做 5 组批量查询，正确避免 N+1，但 List 场景无分页（ListConfig NoPagination），全量节点逐批富化，数据量大时响应延迟。最佳实践：评估前端列表是否需要全量节点，必要时分页。属于可接受权衡，仅提示。
- [错误处理] course_resource_handler.go:172-176 — UnbindResource：BindTargetID 查询失败（含 DB 内部错误与绑定不存在）时**响应 200 OK**，错误被吞、解绑静默"成功"。最佳实践：ErrNotFound 时也明确语义（如幂等 200 可接受但需区分 DB 错误），DB 错误走 respondServerError。
- [契约] course_resource_handler.go:97-124 — Create 响应手拼 domain.NodeResource 且仅含部分字段（无 total 等），与 ListResources 的 ListResponse 结构不一致。最佳实践：统一响应结构。
- [错误处理] crud.go:100 — crudCreate 回读 `item, _ := cfg.GetByIDFn(...)` 错误丢弃：创建成功但回读失败时返回 201 + 零值对象（前端拿到空壳数据）。最佳实践：回读失败走 respondServerError。
- [错误处理] crud.go:187 — crudUpdate 回读错误同样丢弃（`item, _ :=`），返回 200 + 零值对象。最佳实践：同上。
- [错误处理] crud.go:121-125,155-159,214-218 — crudGet/crudUpdate/crudDelete 对 GetByIDFn 的任何错误（含 DB 故障）统一 404 NotFoundMsg，内部错误被吞。最佳实践：区分 ErrNotFound 与内部错误。
- [错误处理] evaluation_result_handler.go:214 — Grade 评分成功后回读 `res, _ = h.Service.GetEvaluationResult(...)` 错误丢弃：DB 故障时返回 200 + "null" 响应体（此前 Get 已返回过完整实体，回读失败会清空响应）。最佳实践：回读失败 respondServerError。
- [性能] evaluation_result_handler.go:230-246 — BatchGrade 对每个 item 串行 GetEvaluationResult + 租户校验（N+1 到数据库），大批量评分时延迟累积。最佳实践：批量查询或保留（评分批次通常小），仅提示。
- [契约] evaluation_result_handler.go:66-70 — List 中学生强制 ownOnly 覆盖其余过滤参数（忽略 page/类型等），前端学生端若传其他参数静默失效。最佳实践：与前端确认契约（当前实现有注释说明，属设计取舍，仅提示）。
- [边界] exam_handler.go:206 vs 129 — Update 传入的 BatchID 未像 Create（emptyStrToNil:129）做空串归一化：客户端传 `"batchId": ""` 时 batch_id 写入空串到 uuid 列触发 22P02 → 500；且由于 178-180 行 nil 才回退 existing，空串既不能清空 batchId 也不报 400。最佳实践：Update 同样 emptyStrToNil，或校验后 400。
- [错误处理] exam_handler.go:292,317,362,402 — AddQuestion/RemoveQuestion/UpdateQuestionScore/BulkUpdateScores 写操作成功后 `exam, _ = h.Service.GetExam(...)` 回读错误丢弃：DB 故障返回 200 + "null" 响应体。最佳实践：回读失败 respondServerError。
- [错误处理] exam_handler.go:67-71,153-157,259-263,305-309,344-348,390-394 — GetExam 的任何错误（含 DB 故障）统一 404"考试不存在"，内部错误被吞。最佳实践：区分 ErrNotFound 与内部错误。

### handler-03.md（17 条 P2）

- [数据一致性] exam_import_handler.go:176 — 覆盖模式 `DELETE FROM exam_questions WHERE exam_id=$1` 错误被 `_, _ =` 完全吞掉。若删除失败（锁/连接抖动），旧题目残留、新题目以 sort_order 从 1 重新插入，出现重复题目/排序错乱，且无任何日志与错误提示；最佳实践：检查错误并记日志（或计入 result.Errors 让用户感知），同时建议删除与新写入放同一事务。
- [数据一致性] exam_import_handler.go:160-176 — 覆盖模式的 DELETE 与后续 importExamQuestions 写入分属两条独立连接流程（非事务）。若中途失败，试卷处于"题目被清空但新题目未写完"的中间态；最佳实践：overwrite 的更新+清题+写题包在一个事务内。
- [逻辑] exam_import_handler.go:240 — 题目分值 `parseFloatDefault(col(row,2), 0)`，非数字/空值静默记 0 分，导致试卷总分会失真且用户无感知；最佳实践：非空但非法分值应计入 Errors 提示。
- [越权] exam_result_handler.go:133-136、164-167 — Get/Grade 的租户校验条件是 `result.TenantID != nil && claims.TenantID != nil && *result.TenantID != *claims.TenantID`：任一为 nil 即跳过校验。claims.TenantID 为 nil 的用户（如部分平台角色）可绕过租户隔离读取/评分他人结果；最佳实践：nil 视为不匹配（拒绝），或改在 store 层带 tenant 过滤。
- [契约] exam_result_handler.go:118-137 — Get 无"结果归属学生"校验：同租户内任意学生可凭 id 读取其他学生的考试结果详情（Create/List 均按本人/班级限制，此处不一致）；最佳实践：学生角色强制 `result.UserID == claims.UserID`。
- [逻辑] exam_usage_handler.go:159 — manualOnly 仅当 `usage.TargetType != nil` 才校验手动类型：TargetType 为 NULL 的考试安排（异常数据/旧数据）可被任意编辑删除，绕过"自动创建不可改"约束；最佳实践：nil 视同非手动类型拒绝。
- [租户] favorites_handler.go:39,61 — GetFavorite/ToggleFavorite 只按 `claims.UserID` 操作收藏，对 targetId 所属租户无任何校验：用户可对**他租户**的 scene/course/question_bank/exam 收藏/取消收藏（favorites 表本身按 user 隔离，不构成写他人数据，但租户语义错乱、产生跨租户脏收藏）；最佳实践：收藏前校验 target 归属租户（或 store 层 JOIN 目标表过滤 tenant）。
- [信息泄露] favorites_handler.go:44,66 — `FavoriteCount(targetType, id)` 为全租户全局计数（favorites 表按 target_id 聚合、无租户维度），响应把其他租户对同一 target 的收藏数泄露给本租户用户；最佳实践：计数限定在 target 所属租户内，或目标归属校验通过后再计。
- [安全] file_handler.go:91-133,141-166 — allowedServeExts 白名单包含 `.js`/`.bat`/`.cmd`/`.sh` 等可执行文本类型，而 CSP sandbox 仅作用于 xssRiskyExts（html/htm/svg/xml/xbrl）。同源 `/uploads/*.js` 以 text/javascript 直出（无 Content-Disposition: attachment），若应用内存在任何可控 `<script src="/uploads/..">` 注入点即成存储型 XSS 载体；最佳实践：对非白名单可执行类型统一附加 `Content-Disposition: attachment` 或对代码类扩展也加 sandbox+CSP。
- [逻辑] file_handler.go:225 — `sort.Slice(images, func(i, j int) bool { return i < j })` 是空操作排序（恒真比较索引），多页 PPT 转 png 后图片顺序与页码无关，翻页预览顺序错误；最佳实践：按 `e.Name()` 解析页码排序（如 slide1.png → 1）。
- [边界] graduation_handler.go:103-104,146-147 — `time.Parse(time.RFC3339, req.StartDate)` 错误被忽略：非法日期静默变为 0001-01-01T00:00:00Z 落库，后续查询/排序出现"零日期"记录；最佳实践：解析失败返回 400，并校验 startDate < endDate。
- [并发] graduation_handler.go:203-211 — ApplyTopic 先在 handler 层 `AppliedCount >= Capacity` 预检，随后 service 才落库，两次并发申请可同时通过预检导致超容量；属于"核心业务加锁防重复"范畴；最佳实践：容量校验+自增放同一事务（store 层条件 UPDATE 原子判断）。
- [副作用] granular_course_import_handler.go:162-169 — overwrite 模式下 `findOrCreateKnowledgePoints`/`findOrCreateResources` 在**权限校验（PermissionSkipped）之前**执行：无权限用户覆盖导入时会先落库创建知识点/资源（写副作用），尽管课程本身被跳过；最佳实践：把权限校验提前到 findOrCreate 之前。
- [契约] hybrid_module_handler.go:61-63 — UpsertModule 的 NodeID 完全由客户端提供，未校验 node 是否属于当前租户（仅 service 侧依赖存储层过滤与否，未见显式归属校验）；若 service 未校验，可跨租户在他人节点下写入模块；最佳实践：Upsert 前校验 node 归属（同 DeleteModule 的 Get 前置校验）。
- [越权] import_export_handler.go:341-355 — 通用实体覆盖导入（overwrite=true）**无创建者权限校验**（对比 exam/granular 导入的 canOverwriteContent）：任意用户可覆盖更新租户内他人创建的题库/试卷/课程/岗位/场景（仅按 name/code 匹配）；最佳实践：查重时一并取 creator 并按 canOverwriteContent 校验，无权限计入 PermissionSkipped。
- [安全] import_export_handler.go:139-154 — CSV 导出未做公式注入防护：单元格以 `=`、`+`、`-`、`@` 开头时，Excel/WPS 打开后作为公式执行（CSV injection）；数据源是用户可控的名称；最佳实践：导出前对这类前缀加 `'` 前缀或制表符转义。
- [错误处理] job_ability_result_handler.go:280,454 — `err == pgx.ErrNoRows` 相等比较而非 errors.Is，service 包装错误时误走 500 而非 404。

### handler-04.md（11 条 P2）

- [逻辑] job_ability_result_handler_test.go:91 — `wantComp := ((85-70)/70*0.6 + 0) * 100` 中 `(85-70)/70` 为整数除法（15/70=0），wantComp 恒为 0，与注释"存量行胜任度应回退实时计算"矛盾，且与 99 行 V2 公式（浮点 `(100+(4.5-3)*50)*0.6`）不一致；若实现按浮点计算（≈12.857）该断言必然失败，若实现同样截断则断言毫无意义。最佳实践：改为 `((85.0-70)/70*0.6 + 0) * 100`，期望值应为 12.857。
- [字段清空] job_banner_handler.go:18-24,83-91 — 请求体 `IsEnabled bool` 非指针（LinkURL 用 `*string` 可区分"未传"），crudUpdate 全量覆盖时前端未传 `isEnabled` 会隐式清零为 false，导致更新任意字段（如仅改标题）后轮播图被禁用。最佳实践：`IsEnabled *bool`，UpdateFn 中 nil 时回填现有值（参照 learn_road_handler.go 的部分更新回填模式）。
- [测试必红] job_handler_test.go:1054-1070 — TestLearnRoad_CRUD 的 Create 请求 `"positionIds": ["pos-1"]` 非合法 UUID，store 层 `normalizePositionIDs`（store/learn_roads.go:82-91）会丢弃非法 ID 后落库 `position_ids=[]`，随后断言 `len(r.PositionIDs) != 1`（1068 行）必然失败（Update 的 `["pos-1","pos-2"]` 同样被过滤）。最佳实践：测试数据改用 `uuid.NewString()`，或断言空列表。
- [契约/顺序] lesson_behavior_handler.go:176-178,257-259,309-315,317-333 — SignInDaily/AttendanceRateData/StudentDetails 均由 map（dailyMap/rateMap/studentMap）遍历拼装，Go map 迭代顺序随机：无日期排序、无学生排序，前端趋势图/表格每次刷新顺序不定（与展示契约不一致）。最佳实践：按日期/名字排序后输出。
- [错误吞掉] micro_cert_handler.go:136,182 — CreateTemplate/UpdateTemplate 回读 `template, _ := h.Store.GetTemplate(...)` 忽略错误，插入/更新成功后回读失败仍返回 201/200 空结构体（静默失败）。最佳实践：错误时 respondServerError 并记录日志。
- [字段清空] micro_cert_handler.go:162-180 — UpdateTemplate 的 `CertTypeID string` 非指针，请求未传 certTypeId 时 `normalizeCertTypeID("")=""` 直接覆盖既有 cert_type_id 为空（同文件 coverImage 用 `*string` 可区分未传，语义不一致）；前端若部分更新模板即清空证书类型。最佳实践：CertTypeID 改 `*string`，nil 时回填现有值。
- [数据丢失] micro_cert_handler.go:186-213 + store/micro_cert.go:110-116 — DeleteTemplate 连带 `DELETE FROM cert_issuance_records WHERE template_id = $1` 永久删除全部证书发放记录（历史凭证），handler 无任何提示/确认。最佳实践：删除模板时提示将级联删除发放记录，或软删除/保留记录。
- [错误吞掉] node_evaluation_result_handler.go:42-46 — Get 对 Service.GetByID 的任何错误（含 DB 故障）统一 404"评价结果不存在"，真实故障被伪装成资源不存在，排障困难。最佳实践：`errors.Is(err, store.ErrNotFound)` 才返回 404，其余 respondServerError。
- [契约] node_evaluation_result_handler.go:104-107 — Grade 对 ErrNotFound 返回 409 Conflict"已评分或不存在"，将"已评分"(409) 与"不存在"(404) 合并且状态码语义不当，前端无法区分重试路径。最佳实践：ErrNotFound 区分 NotFound/已评分两种响应。
- [越权边界] node_resource_handler.go:82-131,133-158 — Create/BindResource 未校验 `nodeID` 对应节点是否存在及归属租户，store.CreateResource/Bind（store/resource_bindings.go:108-147）直接 INSERT 绑定行（node_id 无校验）：可对任意/不存在节点创建孤儿绑定行、可向其他租户节点绑定本租户资源（列表侧 store.List 以 rl.tenant_id 过滤资源本身，泄露受限，但 Unbind 的节点租户校验形同虚设）。最佳实践：创建/绑定时校验节点存在且属于当前租户（参照 UnbindResource 的 NodeCourseID+CourseTenantID 链路）。
- [功能受限] on_site_question_library_handler.go:102-145 — Update 部分更新语义下无法清空字段：`Answer`/`QuestionText` 传 null 保持旧值；`KnowledgePointIDs`/`Tags` 因 coalesceStringSlice（common.go:31-36）+ `len(kps)==0` 回填逻辑，显式传 `[]` 也会回填旧值，前端"清空知识点/标签"操作静默失效。最佳实践：用 `*[]string` 区分未传与显式空数组。

### handler-05.md（7 条 P2）

- [错误处理] org_handler.go:177 — `updated, _ := h.Service.Get(...)` 更新成功后回读错误被忽略，Get 失败时向响应写出 null 而非实体；最佳实践：回读失败时记录原始错误并按 500 处理（`respondServerError`）。
- [错误被吞] portal_handler.go:107,149,173,195,244,258,282,304,327,354,381 — 全部列表/统计服务调用均以 `rows, _ :=` / `_, _ :=` 吞掉错误；DB 故障或查询失败时工作台接口静默返回 200 + 空数据，前端无从区分"无数据"与"后端故障"；最佳实践：至少记录 slog.Error（工作台非核心接口可不阻断返回，但需留日志）。
- [性能] position_export_handler.go:55-204 — 每个岗位 4-6 条串行 SQL（基础行 60-64、行业 72、专业 78、证书 94、批次 111、绑定 165），导出 N 个岗位即 N+ 次往返；冻结区豁免分层规范，仅提示：可批量 IN 查询优化。
- [逻辑] position_export_handler.go:165-172 — 绑定查询对 ability_points 用内连接，ability_point_id 为空的绑定（save-full 创建的公共能力绑定）整行被静默跳过（仅日志 Warn），导出缺行无任何提示；最佳实践：改 LEFT JOIN 并容忍空能力名。
- [缓存] position_handler.go:181-281 — Update 更新岗位后未失效公开列表缓存（对比 Delete:302、SaveFull:489、ToggleFavorite:529、contentActions invalidate 均清理），已发布岗位被编辑后前台公开列表在缓存 TTL 内展示旧数据；最佳实践：Update 成功后调用 `h.clearPublicPositionsCache(r)`。
- [错误处理] position_handler.go:488 — SaveFull 回读 `pos, _ := h.Service.Get(...)` 错误被忽略，回读失败响应 null；最佳实践：与 org_handler.go:177 同，回读失败走 respondServerError。
- [逻辑] program_course_import_handler.go:182-200 — 岗位名未匹配（QueryRow 失败）且课程名也未匹配时，该行仍被 append 进 courses（c.Name 为空串、PositionID/CourseID 均为 nil），导入时以空名称写入 training_program_courses，静默产生脏数据且用户无感知；最佳实践：位置/课程都未匹配的行记入 errors 并跳过。

### handler-06.md（8 条 P2）

- [逻辑] question_bank_handler.go:280-290 — `isDraftPool` 查询出错时（line 283-285）静默返回 false，Submit/Publish 继续执行状态流转，错误被吞导致约束检查失效；且 `Service.IsDraftPool`（line 282）按 id 无租户限定查询（可探测他租户题库是否草稿池，随后 transition 有 checkTenantAccess 兜底）；最佳实践：出错时响应 500 并终止。
- [越权] question_handler.go:110-123,161-172,244 — Create/BatchCreate/Update 均未校验 BankID 属于当前租户（store/questions.go:44-47 直接 INSERT bank_id；Update 时 bank_id 非空即改库），可把题目挂到他租户题库或把题目移库；最佳实践：创建/更新前调用 GetQuestionBankInTenant 校验 req.BankID。
- [数据丢失] question_handler.go:161-177 — Update 为全量替换语义（store/questions.go:59-70 所有列无条件覆盖），options/answer/knowledgePoints/source 省略即被清空，且与 question_bank Update 的"省略保留"风格不一致，依赖前端全量提交；最佳实践：与前端确认契约，或改为非空回退。
- [错误被吞] resource_import_handler.go:283 — 行业父级关联第二遍 `_, _ = h.DB.Exec(UPDATE ... parent_id)` 错误完全吞掉，父级链接静默失败且无任何统计反馈；最佳实践：失败计入 result.Errors/Failed。
- [错误被吞] resource_import_handler.go:720-726 — 教师 title_ids 补写 UPDATE 错误被忽略（`_, _`），失败仍计 TeacherCreated++，教师导入成功但职位丢失且用户不知情；最佳实践：并入 createUser 事务内或失败时计 Failed。
- [越权] scenario_export_handler.go:108 — 任务配置 sheet 的场景名称 `SELECT name FROM scenarios WHERE id=$1` 无 tenant 过滤；传他租户 scenarioId 时，对方场景名会被写入导出 Excel（轻微信息泄露，任务行查询 line 116 有 tenant 过滤故无数据行）；最佳实践：补 `AND tenant_id=$2`。
- [越权] scenario_grade_handler.go:94-103 — req.TaskID 未校验属于目标场景/本租户（store/scenario_configs.go:114-141 upsert 直接写入 task_id，无任务归属校验），可把等级映射挂到他租户任务 id 或本场景外的任务 id，后续评估逻辑读到错配的 task_id；最佳实践：upsert 前用 TaskScenarioID 校验 task 归属。
- [越权] scenario_handler.go:130 vs 136 — Get 在租户归属校验之前执行 recordViewAsync，未授权/他租户请求也会先给目标场景的 view_count 加 1（对他人数据的写影响，虽仅计数）；最佳实践：ownership 校验通过后再记录视图。

### handler-07.md（13 条 P2）

- [逻辑] scenario_import_handler.go:272 — `weight := 100.0 / float64(len(validMethods))`：当"测评方式"列存在但全部映射失败（如填了未知方式名）时 `len(validMethods)==0`，除零得到 +Inf 而非报错，随后 `INSERT ... weight=+Inf` 成功写入 Infinity，导致评分计算出现 NaN/Inf。最佳实践：`len(validMethods)==0` 时跳过写入或记录错误，而不是除零。
- [事务/错误吞] scenario_import_handler.go:150-166 — 覆盖（overwrite）路径：UPDATE + 两条 DELETE（163-164 删除旧任务与旧测评方式）不在同一事务内，且两条 DELETE 的 `h.DB.Exec` 错误被完全忽略。若删除失败（如 FK 约束、DB 抖动），旧任务残留与新任务重复插入、旧测评方式残留，用户无感知。最佳实践：用事务包裹覆盖操作，检查 DELETE 错误并计入 result.Errors。
- [越权] scenario_task_handler.go:74, 95-102, 104-124 — Get 中 `task.TenantID != nil` 才做租户校验；Create 中 `scenarioTenantID != nil` 才校验并透传。一旦出现 TenantID 为 nil 的记录（旧数据/异常写入），该任务对任意租户可读可改，且新建任务可以无租户落库。最佳实践：TenantID 为 nil 一律视为越权（403），Create 强制要求场景属于当前租户。
- [契约] scenario_task_handler.go:90 — 必填校验强制 `Code` 非空，而前端创建任务通常不感知内部编码规则；与导入流程自动生成 code 的机制不一致，存在前端契约差异风险（若前端不传 code 则必 400）。最佳实践：与服务端生成 code 的策略对齐（服务端兜底生成）。
- [逻辑/数据丢失] schedule_import_handler.go:242-247 — 学期解析：取"第一门课程的任一条教学计划条目"的 term_id，未限定学期/计划，同名课程跨学期存在时可能清空并重建**错误学期**的整学期排课（263 行 DELETE 按 tenant+term 全删）。最佳实践：按文件名/参数显式指定学期，或按全部课程交叉验证学期一致性后再清空。
- [逻辑] schedule_import_handler.go:281-287 — 课程列表内匹配教学计划条目仅按 `course_name + term`（LIMIT 1 无班级/类型条件）：同一课程多个班级条目时随机命中一条，schedule_entries.class_node_id 可能与该条目的班级不一致（导入后课表班级错位）。最佳实践：按 课程名+班级 匹配条目。
- [边界] schedule_import_handler.go:193-194, 214-232 — importFromCourseList 路径不校验 起始周/结束周（`strconv.Atoi` 失败即为 0，weekPattern 非法值静默归为 all，weekPattern 非 all/odd/even 也直接入库），脏数据（0 周排课）直接落库；而 processRows 路径（parseScheduleRow）有完整校验。最佳实践：两路径校验对齐。
- [错误吞] scheduling_handler.go:491-492, 574-575 — `entry, _ := h.fetchScheduleEntry(...)` 错误被忽略：创建/更新成功后若回读失败（极小概率），响应 201/200 但 body 为 null，前端拿不到数据。最佳实践：回读失败时记录错误并返回通用 500（respondServerError）。
- [错误吞] scheduling_handler.go:739, 778, 795, 814, 833 — ExportSchedules 中 `ListScheduledExportMap / ListTeacherNames / ListVenueBriefs / ListClassNames / ListPeriodSlots` 的返回错误全部忽略，导出文件静默缺失教师/场地/班级名单等数据。最佳实践：错误时至少记日志或中断导出。
- [错误吞] staff_title_handler.go:190-192 — ToggleStatus 更新后二次 `GetByID` 错误被忽略：若记录被并发删除，返回零值 title（空 ID、空 TenantID）且 200，`CountUserRefs` 用空租户查询后 UserCount 为 0，前端展示空对象。最佳实践：二次读取失败时返回 404/500。
- [越权] student_portrait_handler.go:232-251 — ListArchives 对学生角色无自限定（对比 143-145 行 List 画像接口强制 `params.Values["userId"] = claims.UserID`）：学生可列出本租户全部学生的档案材料（隐私数据）。最佳实践：与 List 对齐，学生仅返回本人档案。
- [越权] student_portrait_handler.go:253-313 — CreateArchive / DeleteArchive 仅校验已登录+租户，无角色/本人校验：学生可任意指定 `userId` 创建/删除其他学生档案（业务侧无限制，DeleteArchive 无 user_id 条件）。最佳实践：业务角色可管理，学生仅限本人（UserID 强制 = claims.UserID）。
- [错误吞] subscription_handler.go:115-126 — AdminUpdate：`GetSubscriptionByTenant` 返回**非 NotFound 错误**（如 DB 故障）时被当作"未订阅"落入 CreateSubscription 分支，掩盖真实故障，且若并发/数据重复可能触发唯一约束冲突 500。最佳实践：区分 `store.ErrNotFound` 与其它错误，其它错误走 respondServerError。

### handler-08.md（18 条 P2）

- [越权/租户隔离缺失] task_knowledge_ability_handler.go:44 — `BindKnowledge` 调用 `Service.BindKnowledge(tenantID, ...)`，但 store 层 `TaskKnowledgeAbilityStore.BindKnowledge`（store/scenario_configs.go:204-219）的 INSERT 只带 tenant_id 参数，**不校验 task 是否属于该租户**；租户 A 用户可向租户 B 的任务/知识点插入绑定行，产生跨租户脏数据。解绑路径（:59-66）反而有完整 task→scenario→tenant 校验，两路径不对称。
- [越权/租户隔离缺失] task_knowledge_ability_handler.go:93 — 同上，`BindAbility`（store/scenario_configs.go:236-252）INSERT 无 task 归属校验，跨租户绑定行可被插入。
- [越权/租户隔离缺失] task_resource_handler.go:165 — `BindResource` 直接调 `Service.Bind`，store 层 `ResourceBindingStore.Bind`（store/resource_bindings.go:132-147）仅 INSERT `(tenant_id, task_id, resource_id)`，**不校验 task 或 resource 是否属于调用者租户**（无 FK 级租户约束）；租户 A 用户可把租户 B 的任务/资源写成绑定行，产生跨租户脏数据。解绑路径（:180-197）有完整归属校验，绑定路径缺失。
- [错误被吞] task_resource_handler.go:120-126 — `req.Size` 解析失败时（parseInt 返回 err）`fileSize` 静默保持 nil，创建成功但 size 丢失，前端显示异常；最佳实践：解析失败时返回 400 或至少记日志。
- [错误被吞] teaching_plan_handler.go:107 — `FindTeachingPlanExisting` 的 err 被忽略，DB 故障时当作"无已有计划"，随后可能重复生成或产生误导性 500；最佳实践：err 非 nil 时按 500 处理。
- [错误被吞] teaching_plan_handler.go:119 — `FetchPositionScenarios` 的 err 被忽略（`scenarios, _ :=`），场景课位置→场景映射静默丢失，生成出的计划场景信息不完整且无任何提示。
- [错误被吞] teaching_plan_handler.go:173 — `Get` 中 `ListTeachingPlanEntries` 错误被吞，条目查询失败时返回 200 + 空 entries，前端误判为无条目；最佳实践：与 :149-153 Generate 一致走 respondServerError。
- [错误被吞] teaching_plan_handler.go:293 — `Confirm` 后 `plan, _ := GetTeachingPlan` 错误被吞，成功确认但回读失败时返回 200 + JSON `null`。
- [错误被吞] teaching_plan_handler.go:318 — `PutCourses` 保存成功后回读 `coursesOut, _ :=` 错误被吞，返回 200 + 空 items，前端误判保存结果。
- [错误被吞] teaching_plan_handler.go:393 — `Clone` 克隆成功后 `program, _ :=` 错误被吞，返回 201 + JSON `null`。
- [性能/重复查询] template_handler.go:31 — `ServePositionTemplate` 先调用 `h.queryDicts(ctx, tenantID)` 丢弃全部返回值（仅"预热"），随后 `generatePositionTemplate`（:169）再完整查询一遍，等于每次请求重复 7 次租户全表扫描；最佳实践：删除 :31 的预热调用或改为复用结果。
- [错误被吞/静默失败] template_handler.go:86-165 — `queryDicts` 中 7 个查询任一失败直接 `return` 部分/空数据，模板仍照常生成，参考表静默缺失，用户拿到缺内容的模板无法察觉；最佳实践：查询失败时记录日志并返回明确的空/错误提示。
- [错误被吞] tenant_handler.go:209-210,240-241,353-354,378-379 — Update/UpdateStatus/AdminUpdate/AdminUpdateStatus 成功后回读 `tenant, _ :=` 错误被吞，回读失败返回 200 + JSON `null`。
- [错误被吞] training_program_handler.go:318 — `PutCourses` 保存后回读 `coursesOut, _ :=` 错误被吞，返回 200 + 空 items。
- [错误被吞] training_program_handler.go:393 — `Clone` 后 `program, _ :=` 错误被吞，返回 201 + JSON `null`。
- [敏感信息泄露面] user_management_handler.go:176-190 — `Get` 无角色限制（仅租户归属校验），同租户任何认证用户（含学生角色）可读取任意用户详情且**保留身份证号**（:187 注释声明"供编辑回显"）；配合 `List`（:156-174，同样无角色限制）可枚举全租户用户后逐个取身份证。虽为有意设计，但隔离面过大；最佳实践：详情接口限制为 portal 管理角色（canManageUsers）或对非管理角色裁剪 IDCard。
- [错误被吞] user_management_handler.go:649 — `BindRoles` 成功后 `AttachRoles` 错误被吞，响应中 roles 可能缺失或过期；最佳实践：记日志或按错误处理。
- [错误掩盖] user_relation_handler.go:92-95 — `Create` 对**所有**错误（含 DB 故障、重复关系冲突）统一响应 400"发起者或目标不在租户中"，错误被掩盖、误导前端且 500 被伪装成 400；最佳实践：`errors.Is(err, service.ErrRelationUsersNotInTenant)` 时 400，其余走 respondServerError。

### service-01.md（4 条 P2）

- [租户隔离契约缺失] evaluation_cert.go:92-94, 117-119, 157-185 — `ListCertificationItems(ruleID)`、`ListCertificationPoints(itemID)`、`GetCertificationFull(ruleID)`（及其内部 `ListFullItems`/`ListFullPoints`/`ListTasksByPointIDs`）均无租户限定参数，与同文件其他接口（`GetCertificationRuleByTenant`/`UpdateCertificationItem(tenantID)` 等）的租户限定风格不一致。若 handler 未先校验 ruleID/itemID 归属（`GetCertificationRuleByTenant` 可作校验途径），存在跨租户读取窗口。最佳实践：这些读取改为带 tenantID 的 Scoped 版本，或在 handler 先做归属校验。
- [错误吞导致静默失败] evaluation_exam.go:21-26 — `ListExams` 中 `BatchFetchExamQuestions` 失败仅以 `qErr == nil` 静默忽略，试卷列表返回空 `Questions`，前端无任何提示；题目批量拉取失败属数据完整性展示问题。最佳实践：失败时返回错误（或至少 slog.Error 并在响应中体现差异）。
- [错误吞导致静默缺失] evaluation_exam.go:95-98 — `ListExamCenter` 中 `UserClassNodeID` 错误被吞，`classNodeID` 取空串，学生端按班级过滤的考试（`Participatable`/`ClassMatch`）会静默全部消失，学生无法看到/参加本班考试且无报错。最佳实践：返回 error 或在失败时明确降级行为。
- [数据被零值覆盖] job_ability_aggregator.go:373-386 — `profile := profiles[studentID]` 对未命中的 studentID 得到零值结构体，随后 `UpsertResult` 会用空 `ClassName`/`MajorName`/`MajorID` 覆盖该学生已存在的岗位能力结果行（`UpsertResult` 为全量 upsert）。触发条件：候选学生（`ListCandidateStudents` 产出）与 `ListProfiles` 结果不一致（如并发删号、筛选口径差异）。最佳实践：profile 未命中时跳过该学生或保留旧值。

### service-02.md（6 条 P2）

- [明显逻辑 bug] lesson_content.go:514-548、551-617、620-629 — 测评实体生成"只增不删"：规则配置删除某份试卷（paperIds 清空）、清空题目（questionBankQuestions/quizQuestions 为空）或移除 homework 子规则后重新发布，已创建的 exam_usage / 临时考试 / 节点作业不会回收，学生仍会看到已从配置中移除的考试与作业；`applyRuleConfig` 对 `len(questionIDs)==0` / `len(paperIDs)==0` 直接 return 不清理；最佳实践：发布时对"该节点当前 rules 不再包含"的 usages/homework 执行清理（对比期望集合后删除），或至少在重新发布时全量重建该节点的测评实体
- [与 handler/store 契约不一致] lesson_content.go:186-188（GetCourse）、295-297（GetCourseDetail）— 两个课程读取接口不携带 tenantID，unscoped 直读；当前 handler 调用点（clone 后回查、`content_actions.transition` 先 `GetTenantID` 再 fetchCourse）均有租户前置校验所以暂未形成越权，但接口本身无防呆，后续新调用点遗漏校验即产生跨租户读取；同文件 `GetCourseDetailInTenant`（300-302）才是带租户版本，双接口并存易误用；最佳实践：统一为仅保留带 tenantID 的接口，unscoped 变体收敛到 contentActions 内部使用或明确注释调用前提
- [错误被吞/数据不一致] node_evaluation_result.go:33-50 — `Grade` 为三步走（GetByID → Grade → FindNodeExamResult → UpdateExamResultScore）且全部走全局连接、无事务包裹：Grade 成功后回写考试结果若失败仅 `slog.Warn` 后返回成功，节点测评结果与考试结果分数静默不一致；且 `FindNodeExamResult` 的 DB 错误（err != nil）与"未找到"被合并为 `return nil` 同样静默吞掉；最佳实践：Grade 与回写放入同一事务（回写失败随事务回滚），或回写失败降级为显式错误返回而非仅 Warn；Find 与 Update 错误分开处理
- [错误被吞/数据丢失] position.go:82-124 — `SaveFull` 中 `PrepareAbilityPoint`/`PrepareCertificate`（第 99、112 行）失败时 `continue` 静默跳过：某个自定义能力点/证书因并发同名、DB 异常而准备失败时，用户提交的该绑定被静默丢弃（后续 SaveFull 事务内全量重写，缺失项即消失），且无任何日志或返回提示；同时 prepare 在事务外执行，SaveFull 事务回滚时已 prepare 的能力点/证书成为孤儿数据；最佳实践：prepare 失败时记录错误并返回失败（或至少计入日志），将 prepare 移入同一事务内执行
- [副作用残留] task_evaluation.go:58-90 — 版本冲突（`ErrMethodVersionConflict`）时事务整体回滚，但第 42-56 行事务外已创建的临时考试/usage 不会回滚，残留孤儿考试实体（下一次成功保存可复用，但中间态存在）；最佳实践：随上一条修复（联动入事务）一并解决
- [租户隔离缺失/契约不一致] tenant_admin.go:64-77 — `ResetPassword`/`SetPassword` 仅以 adminID 定位用户，**不携带 tenantID 也无任何租户校验**，与同文件 Create/Update/Delete（均带 tenantID）契约不一致；已核实当前两处 handler 调用点（tenant_handler.go:527-530、657-660）在调用前均先执行 tenantID 限定的 `AdminService.Get` 校验，因此暂未形成实际越权，但存在：① Get 与 SetPassword 之间 admin 被迁移/删除的 TOCTOU 窗口；② 未来新增调用点遗漏校验即构成跨租户改密（学校管理员可直接重置其他租户管理员密码）；最佳实践：service 签名增加 tenantID 并在 store ResetPassword 中加 `AND tenant_id = $n` 约束（与 Delete 一致）

### store-01.md（14 条 P2）

- [性能] abilities.go:128-148 — `CitationStats` 对 position_ability_bindings/node_ability_point_bindings/task_ability_bindings/certification_ability_points 四个关联表做相关子查询 `WHERE pab.ability_point_id = ap.id`，migrations 中这些绑定表只有 `career_position_id`/`task_id` 等索引（001_baseline.up.sql:1748,1810），**没有 ability_point_id 索引**，租户内能力点越多子查询全表扫描越严重；最佳实践：为绑定表补 `ability_point_id` 索引，或改用 LEFT JOIN 聚合一次扫出。
- [性能] abilities.go:151-204 — `ListUncited` 的 COUNT 与 LIST 两条 SQL 均含 4 个 NOT EXISTS 相关子查询（同上无 ability_point_id 索引），全表扫描；最佳实践：同上一并加索引。
- [越权] alliance_store.go:105-118 — `ListEnterpriseAgreements` 仅按 `enterprise_id` 过滤，无 tenant_id；enterpriseID 来自请求时若调用方未先校验归属，可跨租户读协议列表；最佳实践：加 tenantID 参数并 `AND tenant_id=$n`。
- [越权] alliance_store.go:120-126 — `ListMilestones` 仅按 `project_id` 过滤，无 tenant_id；同上风险；最佳实践：加 tenantID 参数并过滤。
- [错误处理] alliance_store.go:78-86 — `queryList` 用 `items, _ := scan(rows)` **吞掉行扫描错误**（注释声明与旧行为一致），扫描失败时静默返回部分/空列表，无任何日志；最佳实践：至少记录日志或返回错误（不建议静默吞错）。
- [越权] approvals.go:75-84 与 187-204 — `Get`/`fetchApproval` 按 id 查询无 tenant 过滤（approval_records 是租户表，TenantScoped=true）；handler 若未先校验租户归属即可读他租户审批记录；最佳实践：Get 加 tenantID 参数并过滤。
- [越权] approvals.go:127-136 / 139-148 / 151-160 — `UpdateHistory`/`RejectRecord`/`AdvanceRecord` 均只按 `id` 过滤（CAS 仅防并发，不防越权），任一调用路径漏校验即跨租户操作审批；最佳实践：统一增加 tenantID 参数。
- [越权] batches.go:204-220（UpdateFields）/223-229（Delete）/232-238（UpdateStatus）— 均无 tenant 过滤，仅靠调用方先 `TenantOf()` 校验（147-154 提供了该校验入口，说明设计如此）；一旦任一 handler 漏调 TenantOf 即跨租户写；最佳实践：把这些方法统一改为要求传入 tenantID 并 `AND tenant_id=$n`（或提供带租户的变体），把校验内聚进 store。
- [越权] batches.go:40-53 — `GetByTable` 无租户过滤（依赖调用方校验），同上风险；最佳实践：加 tenantID 参数。
- [越权] content_actions.go:94-138（Transition）/141-157（Review）/160-176（Invite）— 均只按 `id` 操作无 tenant 参数，依赖调用方先 `GetTenantID`(65-76) 校验归属；作为全系统内容实体的公共入口，任一 handler 漏校验即跨租户状态流转/审核/邀请；最佳实践：方法增加 tenantID 参数并在 WHERE 中过滤（或强制调用方传入 GetTenantID 结果）。
- [越权] course_clone.go:82-116 — `CloneCourse` 不校验源课程 `oldCourseID` 的租户归属（tenantID 参数仅用于新行），若调用方漏校验，可将他租户课程结构克隆进本租户（跨租户数据复制）；`FetchSource`(52-77)/`FetchCourse`(527-558) 亦无租户过滤；最佳实践：CloneCourse/FetchSource 增加源课程租户校验（如旧课程 tenant 不匹配直接报错）。
- [错误处理] course_homeworks.go:177-188 — `scanHomeworkSubmissions` 行扫描失败 `continue` 静默丢弃提交记录（成绩列表缺项，教师看不到部分学生提交且无日志）；最佳实践：返回错误并中止。
- [数据一致性] course_nodes.go:180-183 — `Delete` 只删 `system_course_nodes` 一行，不清理 `node_knowledge_point_bindings`/`node_resource_bindings`/`node_quizzes`(+questions)/`node_homeworks`(+submissions)/`hybrid_node_modules`/`node_evaluation_results` 等子表（这些表无 ON DELETE CASCADE），删节点后产生孤儿数据；最佳实践：事务内级联清理。
- [数据一致性] courses.go:133-161 — `Delete` 清理了 submissions/homeworks/eval_results 与排课/人培/教学计划解绑，但**未清理**：`exam_usages`(target_type='course')、`system_course_nodes` 及其全部子表、`course_knowledge_bindings`/`course_resource_bindings`、`approval_records`(target=course)、view_counters 等关联数据；删课程后遗留孤儿考试安排/节点/审批；最佳实践：事务内补齐级联清理（可复用 course_clone 的节点子表清单）。

### store-02.md（34 条 P2）

- [越权防御缺失] evaluation_methods.go:86-96 — `Toggle` 仅按 id 更新 `enabled`，无 tenant 过滤（依赖 handler 先调 `TenantID` 校验）。属全库既有模式（store 提供 `TenantID()` 供 handler 前置校验），非新问题，但 `Toggle` 内部先 `Get` 后 `UPDATE` 两段式也不具原子性。最佳实践：`UPDATE ... WHERE id = $2 AND tenant_id = $3`。
- [越权防御缺失] evaluation_methods.go:183-193 — `AppealStore.Process` 按 id 直接改 status，无租户过滤（依赖 handler 前置校验）。同 `Toggle`。
- [越权防御缺失] evaluation_results.go:110-122 — `Grade` 仅按 `id + status='pending'` 更新，无 tenant 过滤（依赖 handler）。
- [错误处理] evaluation_results.go:125-135 — `BatchGrade` 不检查 `RowsAffected`：任一 id 不存在或已评分时静默跳过，与单条 `Grade` 返回 `ErrNotFound` 的行为不一致，批量评分可能"看起来成功"实则漏评。最佳实践：逐条检查 RowsAffected 并汇总失败。
- [输入校验] evaluation_results.go:140-159 — `FindLatestExamResult` 将 `tem.resource_config->>'paperId'/'examId'` 直接 `::uuid` 强转，若历史配置值非合法 UUID（项目中 learn_roads.go:82-91 注释已承认存在 "SHA1 伪 UUID" 脏数据）则整条查询报错 500。最佳实践：cast 前 `NULLIF` + 正则/长度过滤，或使用宽松比较。
- [事务穿透] evaluation_results.go:110-122 — `Grade`/`Submit` 使用 s.q 全局连接；`BatchGrade`/`BatchGetGradeTargets` 接收 tx 参数，设计正确。但注意 `Submit`（全局连接）若被 service 在 tx 内调用会读不到未提交行——当前调用链（service/evaluation_result.go:251）未包 tx，无实害，仅提示。
- [N+1] exam_questions.go:63-85 — 每题循环内先 `SELECT id` 再 `UPDATE/INSERT`（最多 3 次往返/题），试卷几百题时放大为千级查询。最佳实践：一次 `SELECT ... WHERE exam_id=$1` 取现有映射，内存 diff 后批量写。
- [边界] exam_questions.go:15 — `DELETE ... WHERE exam_id = $1 AND NOT (question_id = ANY($2))`：questionIDs 为空数组时 `NOT (x = ANY('{}'))` 恒真，删除该试卷全部题目。若调用方空列表语义为"无变更"则误删全部；当前语义依赖调用方（全量同步），建议显式注释或空列表短路返回。
- [无事务] exam_questions.go:13-93 — 整体 prune+update+recalc 无事务包裹（函数接收 q 而非 tx），中途失败留下部分同步状态。最佳实践：调用方在 tx 内调用（当前调用方需确认）。
- [边界] exam_results.go:37-40 — `ListConfig.ExtraFilter` 无条件追加 `er.exam_usage_id = $n`（`usageId` 为空串时过滤 `= ''` 返回空列表而非报错/全量），与其它 store 的"空值不过滤"约定不一致。
- [越权防御缺失] exam_results.go:83-92 — `Grade` 无租户过滤（依赖 handler）。
- [越权防御缺失] exams.go:65-86/100-177 — `Update`/`Delete`/`AddQuestion`/`RemoveQuestion`/`UpdateQuestionScore`/`BulkUpdateScores`/`RecalcExamTotal` 全部仅按 id 操作、无 tenant 过滤（依赖 handler 前置 `TenantID()` 校验）。全库既有约定，列为风险点而非新缺陷。
- [无事务] exams.go:80-86 — `Delete` 先删 exam_questions 再删 exams，两步无事务，中间失败残留孤儿题目。
- [读路径写库] exam_usages.go:56-57 — `Get` 每次调用先执行 `SyncScheduledExamUsageStatus(ctx, s.q, "", now)`：tenantID 为空 → UPDATE 覆盖**全租户**的 scheduled 考试安排（行锁 + updated_at 写放大），一个读请求触发全局写。`List`（:30）同样。最佳实践：仅 List/Get 携带租户时同步，或将状态流转改为定时任务。
- [一致性] exam_usages.go:168-214 — `ListExamCenter` 以 `JOIN users u ON u.id = eu.creator_id` 过滤租户，creator_id 为 NULL（历史/自动生成的安排）时行被静默丢弃；同文件 `ListConfig` 直接用 `tenant_id` 列（:39-40），两套口径不一致。
- [并发一致] favorites.go:59-93 — `ToggleFavorite` 为 check-then-act 两段式：并发双击/双端切换时，两个请求都可能通过 EXISTS 检查后各自执行 INSERT（后者被 ON CONFLICT DO NOTHING 吃掉）却**仍然执行 cnt+1**，或 DELETE 与 INSERT 交错导致 favorite_counters 漂移、返回状态与实际相反。最佳实践：单条 `INSERT ... ON CONFLICT DO NOTHING` + 依据 RowsAffected 决定增减，或对 counter 的增减也用 RowsAffected 判定。
- [边界] graduations.go:101-140 — `ApplyTopic` 用 `applied_count < capacity` 判满：capacity 默认 0（CreateTopic :63 写入 0）时任何申请都"已满"。若 0 代表"不限名额"则申请永远失败；若 0 代表"不可选"则应与前端校验一致。另：满员回滚依赖 `fmt.Errorf("topic full")` 字符串比较（:134），应改用哨兵错误。
- [越权防御缺失] industries.go:19-20 — 嵌入 DictStore 的 `GetByIDSQL`/`UpdateSQL`/`DeleteSQL` 均无 tenant_id 过滤，`DictStore.GetByID/Update/Delete`（dict_store.go:56-85）不带租户参数。当前 handler 层用 crud 框架 `CheckOwnership`（industry_handler.go:53,95）兜底，但 store 层自身不隔离，任何绕过 handler 的调用方可跨租户读写；learn_roads.go:60-80 已对该问题给出带租户参数的正确改法，此处未跟进。最佳实践：参照 learn_roads，重写 GetByID/Update/Delete 为 `... WHERE id=$1 AND tenant_id=$2`。
- [性能] job_ability_results.go:129-185 — `ListJobAbilityResults` 每行执行 `departmentNameSQL`（LATERAL 递归组织链 + org_types 关联），全量扫描 job_ability_results 后排序分页；`summary`（:223-248）对 certification_rules LEFT JOIN 无 `r.position_id` 索引保障。对照 migrations/118_workspace_indexes 未见 job_ability_results 相关索引。数据量增长后为大表全扫描。
- [过滤缺失] landing.go:34-53 — `ListExams` JOIN exam_usages 未过滤 `eu.status`/`eu.target_type`/`eu.tenant_id`：草稿（draft）安排的考试、任务/节点自动生成的临时考试也会出现在公开落地页，且同一试卷多个安排时行重复。最佳实践：`eu.status IN ('published','finished') AND eu.target_type IN ('class','major','department','public')`。
- [类型脆弱] lesson_content.go:139-155/158-174 — `Create`/`Update` 将 `domain.JSONSlice`（[]interface{}）直接作为参数写入 `granular_lesson_ids uuid[]` 列（baseline:578），依赖 pgx 反射把 []any 包装成数组按 uuid 元素编码：元素为非法 UUID 字符串时编码报错 500，且语义依赖 pgx 内部机制。课程侧同场景的正确写法是 `[]string` + `$23::uuid[]` 显式转换（courses.go:107/119-123）。最佳实践：参数改 `[]string` 并用 `$N::uuid[]`。
- [性能] lesson_content.go:30-49 — `CitationStats` 对 courses/node_knowledge_point_bindings/question_bank_knowledge_points/questions 四个表做相关子查询计数，knowledge_points 全表扫描 ×4 表无索引保障（对照 118_workspace_indexes 无 knowledge_points 相关索引）。
- [越权防御缺失] majors.go:19-20 — 同 industries：DictStore 的 GetByID/Update/Delete 无租户过滤，靠 handler crud `CheckOwnership`（major_handler.go:52）兜底；learn_roads 已给出正确改法未跟进。
- [越权防御缺失] micro_cert.go:77-116 — `GetTemplate`/`UpdateTemplate`/`DeleteTemplate` 均无租户过滤（依赖 handler 前置 `TemplateTenantID` 校验，既有约定；`DeleteTemplate` 连带的 `DELETE FROM cert_issuance_records WHERE template_id=$1` 也无租户条件）。
- [越权防御缺失] node_evaluation_results.go:49-87 — `Get` 无租户过滤（租户隔离版本是 `GetByID`，:118），若 handler 误用 Get 则跨租户读取；建议 Get 也带 tenant 参数。
- [越权防御缺失] on_site_question_library.go:17-18 — 同 industries：DictStore GetByID/Update/Delete 无租户过滤（handler 层 CheckOwnership:true 兜底，on_site_question_library_handler.go:70,152），learn_roads 正确改法未跟进。
- [越权防御缺失] organizations.go:102-142 — `Get`/`Create`/`Update` 无租户过滤（依赖 handler 前置校验，既有约定；Create 后 fetchOrg 按全局 id 读回）。
- [纵深防御不一致] organizations.go:75-99 — `MemberCounts` 在 tenantID 为空时统计**全租户**用户数（:76-81），而 `Tree`（:52-64）有 `WHERE 1=0` 兜底，两处防御不一致。建议同样拒绝空租户。
- [越权防御缺失] org_types.go:18-20 — 同 industries：DictStore CRUD 无租户过滤（handler org_type_handler.go:51,97 兜底）。
- [读路径写库] portal.go:223/558 — `ListExamEvents`/`ListStudentExams` 每个请求先执行 `SyncScheduledExamUsageStatus`（全租户或单租户 UPDATE），读接口触发写事务 + 行锁。低并发可容忍，列为风险点。
- [数据丢失口径] portal.go:227-240/563-577/87-105 — `ListExamEvents`/`ListStudentExams`/`UpcomingExamCount` 均 `JOIN users u ON u.id = eu.creator_id` 并以 `u.tenant_id` 过滤租户：creator_id 为 NULL 的考试安排（历史数据/系统自动创建未挂创建人）被静默排除，学生端看不到本应可见的考试。最佳实践：改用 `eu.tenant_id` 直接过滤（ListExamCenter 已是此口径）。
- [越权防御缺失] position_bindings.go:56-77/199-217 — `PositionAbilityStore.Update/Delete`、`PositionResponsibilityStore.Update/Delete` 均无租户过滤（依赖 handler 前置校验，既有约定）。
- [错误处理] position_certificates.go:148-164 — `findOrCreateLibrary`：SELECT 只要 `err != nil`（包括连接中断等真实错误）就视为"不存在"继续 INSERT，掩盖底层故障；且无并发保护（无 name 唯一约束），并发 find-or-create 产生重复证书库条目。
- [越权防御缺失] position_certificates.go:96-125 — `Update`/`Delete` 无租户过滤（依赖 handler 前置校验）。

### store-03.md（23 条 P2）

- [事务] backend/internal/store/positions.go:124-173 — `Create`/`Update` 写操作走 tx 参数、但回读用 `s.q`（store 自身连接）。当前唯一调用方 service/position.go:46,58 恰好传入 `txStore.Q()`（即 tx）所以不炸，但这是脆弱契约：任何人改为传独立 tx 或 pool 都会出现"tx 内写、全局连接读回看不到未提交数据 → 返回 ErrNoRows/404"。最佳实践：回读也走传入的 tx 参数。
- [健壮性] backend/internal/store/query.go:372-390 — 所有 Table/SelectColumns/OrderBy/TenantColumn/SearchColumn 字符串必须命中硬编码白名单，新增或微调任何 ListConfig 字符串而不同步白名单即线上 500（已有测试守护，但每次改配置都是运行时风险点）。
- [逻辑] backend/internal/store/question_banks.go:119-155 — `Update` 校验用方法参数 `tenantID`，但事务内知识点绑定 INSERT 用的是 `p.TenantID`（参数结构体字段，行145）。两值不一致时（handler 组装失误）知识点会绑到错误租户，且校验与写入口径不一。最佳实践：统一用方法参数 tenantID。
- [事务] backend/internal/store/question_banks.go:158-170 — `Delete` 三个 DELETE（绑定/题目/题库）无事务，中途失败留孤儿数据。最佳实践：包一层 withTxStore（该 store 已有 beginner）。
- [事务] backend/internal/store/resource_bindings.go:108-128 — `CreateResource` 资源插入与绑定是两条独立语句无事务，且绑定失败被 `_, _ = s.q.Exec` 吞掉（行117-121），资源已入库但接口返回"绑定成功"，前端看不到刚建的资源；`afterBind` 错误同样被忽略（行123）。最佳实践：至少对绑定失败记日志或回滚资源。
- [错误处理] backend/internal/store/resource_bindings.go:132-164 — `Bind`/`Unbind` 的 afterBind/afterUnbind（课程 `courses.resource_ids` 聚合同步）错误全部被忽略，聚合字段与绑定表漂移。
- [越权] backend/internal/store/roles.go:61-71 — `Delete` 的 `DELETE FROM roles WHERE id = $1` 及 user_roles 清理均无租户条件，依赖 handler 前置校验；角色 id 为 uuid，风险中低，但属缺租户过滤的典型面。
- [数据丢失] backend/internal/store/scenario_clone.go:103-111,203-209,293-299,334-336,372-374,414-417 — 各处 rows.Scan 失败一律 `continue` 静默丢弃该行：克隆出的任务可能缺交付物/评估点/评分规则/评审步骤/绑定，且事务照常提交，用户无感知（克隆结果残缺但"成功"）。最佳实践：克隆是核心操作，scan 失败应整体回滚报错。
- [错误处理] backend/internal/store/scenario_clone.go:434-448 — `remapTaskDependencyIDs` 中 `SELECT dependency_ids` 出错时静默返回 nil（行437 `if err != nil || len(oldDeps) == 0 { return nil }`），依赖重映射丢失无提示。
- [越权] backend/internal/store/scenario_configs.go:29-34,117-124 — `ScenarioWeightStore.Upsert`/`ScenarioGradeStore.Upsert` 的 UPDATE 分支 `WHERE id = $N` 无租户条件，且回读也跨租户（依赖调用方校验）。最佳实践：UPDATE 加 `AND tenant_id = $N`（该 store 有 tenantID 入参可用）。
- [越权] backend/internal/store/scenarios.go:95-112 — `Update` 先 `fetchScenario` 仅验证"存在"不验证归属，UPDATE `WHERE id = $12` 无租户条件，可改他租户场景。
- [越权] backend/internal/store/scenarios.go:115-152 — `Delete` 中 `UPDATE teaching_plan_entries / schedule_entries` 解绑及 `DELETE FROM scenarios WHERE id = $1` 均无租户条件（场景 id 全局 uuid，风险中低）。
- [数据完整性] backend/internal/store/scenario_tasks.go:74-92 — `Create` 的 `p.TenantID` 为 `*string`，nil 时插入 `tenant_id = NULL`，任务成为游离数据（租户列表查不到、也删不掉）。最佳实践：Create 接收必填 tenantID 参数。
- [越权] backend/internal/store/scheduling.go:302-308 — `CreateSchedule` 中 `UPDATE teaching_plan_entries SET status='scheduled' WHERE id = $1` 无租户条件，planEntryID 可指向他租户条目。
- [边界] backend/internal/store/scheduling.go:156-213 — `ReplacePeriodSlots` 注释声明"items 非空由调用方保证"，但若传空列表会清空该租户全部节次，无防御；建议函数内对空列表直接返回。
- [错误处理] backend/internal/store/teaching_plans.go:403-410 — `UpdatePlanEntry` 的班级关联 delete+insert 错误全部忽略（`_, _ =`）且不在事务内，班级关联更新失败静默（核心排课数据不一致）。
- [越权] backend/internal/store/teaching_plans.go:390-412 — `UpdatePlanEntry` 的 UPDATE 用 `FROM teaching_plans p` 校验租户（良好），但 `class_node_id = $5` 是 string 直写 uuid 列，空串/非法值会 22P02 报错（依赖 handler 转 nil，未防呆）。
- [并发] backend/internal/store/teaching_plans.go:169-221 — `GeneratePlan` 先 DELETE 再 INSERT，`teaching_plans` 有 UNIQUE(program_id, term_id)（092:65），并发生成两请求会触发唯一冲突 500；服务层若无锁即为竞态。
- [越权] backend/internal/store/tenant_admins.go:128-138 — `ResetPassword` 无租户条件（`WHERE id = $2`），adminID 指向他租户管理员时可直接改密（handler 若未先按租户查管理员即高危）。
- [边界] backend/internal/store/user_relations.go:106-112 — `UsersExist` 用 `COUNT(*) == len(userIDs)` 判断，userIDs 含重复项时即使全部存在也返回 false（误拒合法请求）；含非法 uuid 时 `$2::uuid[]` 转换报错。
- [事务] backend/internal/store/users.go:167-174 — `Delete` 两语句（递减 user_count + 删用户）无事务且无租户过滤，中途失败角色计数漂移。
- [数据一致性] backend/internal/store/users.go:187-203 — `BatchDelete` 两语句无事务，且删除 user_roles 后未递减 `roles.user_count`，角色计数永久虚高；返回数还是 user_roles+users 命中数之和（语义混乱）。
- [事务] backend/internal/store/users.go:272-294 — `RebindUserRole` 四条语句（校验/递减/删/插/增）无事务，中途失败计数漂移；且首条校验错误被 `_ =` 吞掉后靠"!validRole"分支兜底（可读性差）。


---

## 四、P3 一般（911 条）

主要类别（明细见 `raw/` 各批次文件）：
- **死代码/未使用**：如 `status.go` 死常量、`hybrid-eval.ts` 未用导出、多处 `fetchCourse` 返回值未用
- **重复代码**：多个 handler 重复的校验/回读模板、前端多页重复的 limit 常量
- **命名/风格**：`PeriodSlot.Type` vs `slot_type` 列命名不一致、租户 ID 暴露策略不统一（json:"-" 缺失）
- **类型 any**：前端约 60 处 `as any` 绕过类型检查
- **测试瑕疵**：断言恒为 0 的整数除法、非法 UUID 断言、跳过（t.Skip）用例

---

## 五、回查验证记录

本清单生成后，对 **82 条 P0/P1 记录全部逐条回到代码复核**（读取具体行确认；task_evaluation SaveMethods 为双批次重复报告，去重 1 条），结论：

| 结论 | 数量 | 明细 |
|------|------|------|
| 已回查确认 | 73 | 见上文各条目「回查」列 |
| 回查排除（误报） | 2 | `alliance_project_store.go:197` DeleteMilestone（SQL 已用 tenant_id）；`tenant_handler.go:253` Admin 接口（路由受 JWT+platformAdmin 保护，handler 注释误导） |
| 回查降级 P1→P2 | 5 | `positions.go:105`、`scenarios.go:66`（handler 有归属校验，store 契约脆弱）；`alliance_store.go:55` UpsertSchoolInfo（无前端调用方）；`dict_store.go:56`（crud CheckOwnership 已兜底）；`lesson_content.go:390`（已在 tx 内，低概率） |
| 重复报告去重 | 1 | `service/task_evaluation.go:42-90` SaveMethods 由 service-01/service-02 两批次重复报告 |
| 回查修正 | 2 | `alliance_handler.go:178`（实际清空范围为 name/status 非指针字段+指针置 NULL）；hybrid/add `ap-custom-*`（实际后果是 uuid[] cast 失败保存必 500，比原判更严重） |

**P2 抽查**：已对 backend-domain/infra、frontend-app-02 等批次代表性条目随机回读，位置与描述属实，未见系统性误报。

---

## 六、修复优先级建议（按项目原则排序）

1. **立即修（P0，阻塞核心流程）**：#3 考试交卷必 500、#4 旧格式排课导入必失败；#1/#2 迁移工具隐患（影响回滚与部署）
2. **本周修（P1 数据安全）**：越权/租户隔离 22 条（A 组）、场景/节点测评重交清空评分（C 组前两条）、题库知识点绑定被清空
3. **两周内修（P1 功能失效）**：判断题交互、批改 loading 死锁、任务权重丢失、课程节点保存死锁、联盟关联职业岗位 404
4. **持续修（P2）**：按批次逐项修复，优先性能（N+1、全表扫描、limit 截断）与错误吞掉类
5. **跟踪（P3）**：随重构批量清理

## 附录

- 逐文件勾选清单：[`checklist.md`](./checklist.md)（980 项全部 `- [x]`）
- 各批次原始逐行记录：[`raw/`](./raw/)（27 个文件）
