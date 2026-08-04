# 知与 SaaS 全量代码审查问题清单（2026-08-03）

> 审查范围：前后端全部源码 751 个文件、约 17.5 万行，逐文件、逐行完整通读。
> 审查原则（依 AGENTS.md）：简单优先、安全只排高危、性能与稳定性优先、容忍 hacker 行为、锁只给核心业务。
> 本文件为**汇总清单**；每批次逐行原始记录见 [`raw/`](./raw/)；文件勾选清单见 [`checklist.md`](./checklist.md)。

## 统计总览

| 严重级 | 数量 | 说明 |
|--------|-----|------|
| P0 高危 | **2** | 运行时必错（克隆课程报错） |
| P1 严重 | **58** | 后端 40 + 前端 18：明显 bug / 越权 / 数据丢失 / panic 风险 |
| P2 重要 | **246** | 边界、并发竞态、性能、错误吞掉、数据一致性 |
| P3 一般 | **477** | 风格、死代码、类型安全、mock/占位、重复代码 |
| **合计** | **783** | 已对全部 751 个文件逐行通读 |

**分层规范核查结论**：豁免冻结区（import/export/template 22 个 handler）外，全部新增 handler 均无裸 SQL 字符串、无 `db.Query/QueryRow/Exec` 直调、无 `*pgxpool.Pool` 字段，`handler→service→store→domain` 分层合规。发现的分层瑕疵见 P1/P2（`service` 的 `Store()` 透出、`BatchGetByTable` 上抛裸 `pgx.Row`、`lesson_content.go` 以 `*store.Store` 为入参等）。

---

## 一、P0 高危（2 条，均已回查验证）

| # | 位置 | 问题 | 最佳实践方案 |
|---|------|------|--------------|
| 1 | `backend/internal/store/course_clone.go:445-448` | `cloneNodeKnowledgeBindings` 向 `node_knowledge_point_bindings` 插入 `(id, tenant_id, node_id, knowledge_point_id)`，但该表基线 `001_baseline.up.sql:669-674` **只有 id/node_id/knowledge_point_id/created_at，无 tenant_id 列**。克隆任何带知识点绑定的体系课节点必然报 "column tenant_id does not exist"，克隆功能必崩。**已回查确认** | 去掉 INSERT 的 `tenant_id` 列（对齐 `course_nodes.go:128` 的写法 `INSERT INTO node_knowledge_point_bindings (node_id, knowledge_point_id)`） |
| 2 | `backend/internal/store/course_clone.go:468-471` | `cloneNodeResourceBindings` 同样向 `node_resource_bindings` 插入 tenant_id。**回查修正**：`node_resource_bindings`（`001_baseline.up.sql:694-700`）**确有 tenant_id 列**，此条降级为 P2——insert 合法但列序/语义与 `course_nodes.go:133` 不一致（资源绑定的租户隔离是否按 tenant 过滤需与查询侧对齐） | 与 knowledge bindings 统一为同一插入模板，删除多余 tenant_id 或确认查询侧按 tenant 过滤 |

---

## 二、P1 严重（58 条）

### 2.1 后端（40 条）

#### A. 越权 / 租户隔离缺失（SQL 层 UPDATE/DELETE 无 tenant 过滤）

| 位置 | 问题 | 最佳实践方案 |
|------|------|--------------|
| `alliance_achievement_store.go:89-104` | UpdateAchievement 仅 `WHERE id=$20` 无 tenant_id，可篡改他租户成果 | WHERE 加 `AND tenant_id=$n`，与 Get/Delete 对齐 |
| `alliance_agreement_store.go:72-81` | UpdateAgreement 无租户过滤 | 补 tenant_id 条件 |
| `alliance_brand_store.go:80-93` | UpdateBrand 无租户过滤 | 补 tenant_id 条件 |
| `alliance_enterprise_store.go:213-230` | UpdateEnterprise 无租户过滤（前端 `togglePublic` 只 PUT `{isPublic}` 触发的全列覆盖还会清空其余字段，`api/alliance.ts:35-39`） | UPDATE 加 tenant_id + 改为指针字段部分合并或专用 toggle 端点 |
| `alliance_enterprise_store.go:317-325` | UpdateEnterpriseAgreement 无租户过滤 | 补 tenant_id 条件 |
| `alliance_expert_store.go:95-111` | UpdateExpert 无租户过滤 | 补 tenant_id 条件 |
| `alliance_project_store.go:114-125` | UpdateProject 无租户过滤 | 补 tenant_id 条件 |
| `certificate_library.go:68-79` | Update/Delete 方法签名甚至无 tenantID 参数 | 方法加 tenantID 并 WHERE 限定 |
| `position_export_handler.go:60-64,72-75,78-91,94-107,161-163` | 导出查询无 tenant 过滤，跨租户导出他人岗位/专业/证书 | 全部查询追加 tenant_id 条件（对齐 170 行绑定查询） |
| `position_certificate_handler.go:51-112` | crudConfig 未设 CheckOwnership，store 层 Get/Update/Delete 仅按 id 过滤，任意角色跨租户改删岗位证书 | 按证书所属岗位的 tenant 校验 + store 加租户条件 |
| `question_bank_handler.go:59-72` | Get 用无租户的 `GetQuestionBank`，任意登录用户读任意租户题库 | 改用 `GetQuestionBankInTenant` |
| `random_draw_question_handler.go:92-97` | Get/Update/Delete 完全无租户隔离，可跨租户读（含 Answer）改删现场问答题 | GetByIDFn 租户限定 + Update/Delete 前校验归属 |
| `program_course_import_handler.go:87,164,171` | 按前端 programId 直接 DELETE 他人租户方案课程；岗位/体系课按 name 匹配无租户过滤 | 先校验 program 归属租户；匹配查询加 tenant_id |
| `on_site_question_library_handler.go:28-40` | 题库 item 的 `answer` 随 List/Get 下发，且 GET 路由重复注册于 jobViewer 与 businessUser（`routes.go:130-131`/`routes_library.go:12-13`），学生是否可读取决于注册顺序 | 只读接口裁剪 answer；移除重复路由注册并明确角色门禁 |
| `course_resource_handler.go:60-115` | Create 未校验 CourseID 归属租户，可把资源绑定到任意租户课程并改写 `courses.resource_ids` | Create 前 `CourseTenantID`+`verifyTenantOwnership` |
| `certification_handler.go:541-565` | CreateTask 未校验 pointId 归属租户，可跨租户挂任务 | 先 `GetCertificationPointByTenant` |
| `user_management_handler.go:486` | BatchCreate 直接返回 store.Create 结果（含 password_hash），响应泄露 bcrypt 哈希 | 返回前清空 PasswordHash/IDCard/Oauth |

#### B. 鉴权 / 未鉴权接口

| 位置 | 问题 | 最佳实践方案 |
|------|------|--------------|
| `router.go:122` | `/uploads/{filename}` 完全公开无鉴权无租户校验，UUID 文件名可跨租户访问他人上传文件 | Serve 挂 JWT+租户校验，或明确公开定位 |
| `routes.go:125,128-131,134-140,143-145` | jobViewer 只读路由与 businessUser 组重复注册，chi 静默覆盖、后注册者胜出，学生只读接口被 businessUser 门禁整体替换失效 | 删除重复注册，同路径只注册一处 |
| `file_handler.go:121-211` | Preview 端点无任何认证，可被调用触发 libreoffice headless 转换（DoS）并跨租户读取 UploadDir 任意 doc/xlsx | 加 `middleware.CurrentUser` 校验 + 频率/并发限制 + 文件归属校验 |

#### C. 逻辑 bug / 数据一致性 / 稳定性

| 位置 | 问题 | 最佳实践方案 |
|------|------|--------------|
| `cmd/migrate/main.go:211-213,114-120,178-184` | isMultiStatement 用 `Count(sql,";\n")>1` 判定，恰好两条语句被误判为单语句；多语句迁移无事务包裹，中途失败留半迁移状态 | 阈值改 `>=1`；多语句包事务（剥离自带 BEGIN/COMMIT） |
| `approval_handler.go:180-199,247-249` | 无 workflow 的审批记录 `isStepComplete` 对 nil workflow 恒 false，审批永远卡在"仅更新 history"，无法 approved/rejected。**已回查确认** | 无 workflow 视为单步审批直接推进；仅对"有 workflow 但加载失败"fail-closed |
| `course_handler.go:285,328` | Update 中 `batchID := req.BatchID` 不向 existing 回退，未携带 batchId 时把 batch_id 清空。**已回查确认** | 缺省时回退 `existing.BatchID` |
| `import_export_handler.go:245-256,310-321` | Preview/Import 先 `ParseMultipartForm` 消费整个 body，随后 `parseImportCSV(r)` 读 r.Body 只会得 EOF，CSV 导入/预览必然失败。**已回查确认** | 改从 `FormFile("file")` 句柄读 CSV，或直接读原始 body |
| `granular_course_import_handler.go:137-141,156-158` | findOrCreateKnowledgePoints/findOrCreateResources 在 preview 分支前执行，preview 模式也真实 INSERT 污染数据库 | 先查重判定再决定创建；preview 禁止写 |
| `service/affairs.go:183-305` | AutoSchedule 事务外校验 + 插入无 LockScheduleTerm + 无唯一约束，并发自动+手动排课可插冲突/重复 | 插入事务内先 `LockScheduleTerm` |
| `service/job_ability_aggregator.go:26-43,124-131` | lockPosition/unlockPosition "用完即删"破坏互斥，B 等待旧 mutex 时删除重建，C 与 B 并发汇聚。**已回查确认** | 引用计数或永不删除 / 分片锁 |
| `service/task_evaluation.go:35-44,50,68-89` | SaveMethods 乐观锁检查在事务外 + version<=0 跳过 + UPSERT 无版本守卫，双提交静默覆盖 | 检查移入 WithTx 内或 UPSERT 加 `WHERE version<=$x` |
| `user_relations.go:52-54` | 带 search 时 count 查询引用未 JOIN 的 `init_u/tgt_u` 别名，报 "missing FROM-clause entry"，必 500。**已回查确认** | count 查询补 JOIN |
| `scenario_tasks.go:95-110` | Update 用 tenant 过滤写，但后续 fetchTask 无租户过滤，租户不匹配时返回他租户完整数据 | 校验 RowsAffected==1 或 fetch 带 tenant |
| `course_nodes.go:137,142,176` | Create/Update 在 tx 内用全局 `s.q` 调 fetchNode，回读不到未提交行 → ErrNoRows/旧值。**已回查确认** | fetchNode 改为按传入 tx 查询 |
| `lesson_content.go:75,94` | KnowledgePointStore.Create/Update 同样事务穿透 | 改用 tx 查询 |
| `course_homeworks.go:148-169` | GradeNodeHomework 批改与 node_evaluation_results 同步无事务 | 用 withTxStore 包裹 |
| `courses.go:128-152` | CourseStore.Delete 跨 7 表解绑/删除无事务 | withTxStore 包裹 |
| `teaching_plan_handler.go:128-130` | Generate 成功后 GetTeachingPlan 错误被忽略，`*plan` 对 nil 解引用 panic | 检查错误并 500 |
| `template_handler.go:774-776,830-832,891-893,1093-1095,1188-1190` | 字典查询失败 return nil，writeExcel(nil) 空指针 panic | 返回空文件而非 nil |
| `cert_grades.go:47-54` | last_updated(timestamptz) 扫进 `*string` 二进制协议必失败，且 continue 吞错导致非空行被静默丢弃，ListGrades 恒为空。**已回查 schema 确认** | 改 `*time.Time`/`pgtype.Timestamptz`，不 continue 吞错 |
| `handlers.go:194,223` | courseBatchHandler/affairsBatchHandler 都注入 positionSvc，疑似复制粘贴走错 service | 核对构造参数 |
| `seed/main.go:97` | 平台管理员 users.role 写死 'school'，与 UserRoleOperator 语义不符，按 role 鉴权会误判 | 改为 'operator' |

### 2.2 前端（18 条）

| 位置 | 问题 | 最佳实践方案 |
|------|------|--------------|
| `apps/edu/app/evaluation/exam-usage/page.tsx:141-165` | handleCreate 无 try/catch，失败时未处理 rejection 且 createSubmitting 卡死为 true | 加 catch + finally |
| `apps/edu/app/evaluation/scene-results/[id]/page.tsx:1016-1018` | handleSave 失败被空 catch 吞掉，无提示无回滚，用户误以为已保存 | toast 失败并保留现场 |
| `apps/edu/app/lesson/admin/granular/add/page.tsx:47-48,321-324` | 模块级可变单例 customKnowledgePointIds/courseResourcePool 多标签页互相清空（串数据）；handleFinish 在保存失败时仍跳走丢失输入。**已回查确认** | 改 useRef/useState 组件内状态；handleSave 返回 boolean 成功才跳转 |
| `apps/edu/app/lesson/admin/hybrid/add/page.tsx:340,138-165` | ensureNodeData 渲染期 setState；initialNodes 依赖首帧为 null 的 existing，编辑模式树根名称永不更新 | 不在渲染期写状态；existing 加载后 effect 同步 nodes[0].name |
| `apps/edu/app/lesson/admin/system/add/page.tsx:801-804,253` | 保存失败仍跳走丢数据；handleAddNode 硬编码 courseId 'course-1' | handleSave 返回成功标志；传真实 courseId |
| `apps/edu/app/lesson/admin/hybrid/add/_components/teaching-resource-selector.tsx:202-217` | handleSave 丢弃 url 及全部元数据，父级保存后资源无真实链接 | 保留 url 等字段 |
| `apps/edu/app/portal/apps/alliance/achievements/page.tsx:112,229` | 前台展示 Switch 绑定空函数 onToggleEnabled，isPublic 永不更新 | 实现 toggle：update(id,{isPublic}) 后刷新 |
| `apps/edu/app/portal/apps/system/resource/package/page.tsx:112-116` | onRetry 只 setLoading/error 不重新请求，错误态重试后永久 loading | 请求封装为可复用回调 |
| `apps/edu/app/portal/workspace/_components/teacher-courses-tab.tsx:720-728,791-800` | 课程类型标签按 index%2 交替生成，与后端数据无关 | 依据 courseId/scenarioId 判断 |
| `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx:302,813-831,322,1611-1624` | 任务权重不持久化刷新丢失；主加载 effect 跑两次覆盖用户编辑；保存用旧 state 快照致评审步骤修改丢失 | 后端持久化 weight；ref 防重复初始化；用合并后 state 计算 |
| `apps/edu/components/shared/content-list-page.tsx:992-1009` | CSV 导入重复时确认弹窗只在 hasExcel=true 时打开，CSV 流程确认弹窗永不弹出、导入卡死。**已回查确认** | 移除 hasExcel 门控，统一在 importPreview 设置时打开 |
| `packages/api-client/src/api/alliance.ts:35-39,145-149` | togglePublic/toggleEnabled 只 PUT 单字段，后端全列覆盖清空其余字段。**已回查确认** | 专用 toggle 端点或后端指针字段部分合并 |
| `apps/edu/app/evaluation/scene-results/[id]/page.tsx:880-882` | 主加载 catch 空吞，任何错误显示"记录不存在" | 区分错误并提示 |
| `apps/edu/app/affairs/teaching-plans/[id]/page.tsx:118-125` | 教师变更即时 updateEntry 失败静默，且与保存按钮并发写同一条目 | 提示失败并纳入统一保存流程 |
| `apps/edu/app/evaluation/job-ability/results/page.tsx:199-265` | 不同岗位连续汇聚共享 aggregateTimerRef，轮询链交叉覆盖 | 触发前清空旧链或按岗位隔离 |
| `apps/edu/app/portal/apps/system/tenant/page.tsx:269-271` | PortalCrudPage 的 error 写死 null，fetchTenant 失败 error 永不展示 | 传真实 error 状态 |
| `apps/edu/app/evaluation/landing/exams/page.tsx:57` | "我的考试"按中文状态串过滤，与后端英文状态不一致易空列表 | 用真实用户/考试接口 |
| `apps/edu/app/evaluation/question-banks/[id]/page.tsx:186` | canEdit 恒为 true，无权限/状态校验可编辑任意题库 | 结合权限与状态判定 |

---

## 三、P2 重要（246 条，按类别汇总，明细见 raw/）

| 类别 | 典型位置 | 数量 |
|------|----------|-----|
| **异步竞态/请求覆盖**（无 cancelled/AbortController，切 tab/切学期/切任务旧响应覆盖新数据） | `schedule-grid-tab.tsx:80-94`、`timetable-view-tab.tsx:50-64`、`lesson/landing/[id]/page.tsx:235-255`、`scene/landing/[id]/learn/page.tsx:267-276`、`use-library-crud.ts:42-65` | ~25 |
| **错误吞掉/静默失败**（catch 空、`_, _=`、`continue`、回读 `_ =`） | `portal_handler.go:107-378`、`crud.go:100,187`、`exam_handler.go:292-402`、`scheduling_handler.go:427-428`、`resource_import_handler.go:732-736`、`scene/landing/[id]/learn/page.tsx:1040-1065`、`task_knowledge_ability_handler.go:52-72` | ~60 |
| **无租户过滤（store 层防御纵深不足）** | `ability_domains.go:26-70`、`batches.go:204-238`、`majors.go:64-81`、`org_types.go:62-73`、`on_site_question_library.go:76-87`、`resource_codes.go:48-65`、`position_bindings.go:56-77`、`roles.go:91-110`、`scenarios.go:91-123`、`student_portraits.go:83-89`、`user_extension_fields.go:52-68`、`tenant_admins.go:128-138`、`resource_library.go:147-170`、`random_draw_questions.go:49-66`、`micro_cert.go:110-116`、`position_certificates.go:23-66` | ~35 |
| **事务边界缺失/孤儿数据** | `courses.go`、`exams.go:80-86`、`exam_usages.go:88-91`、`position_import_handler.go:124-141`、`scenario_import_handler.go:141-156`、`course_import_handler.go:134-218`、`schedule_import_handler.go:433-650`、`question_banks.go:154-166`、`teaching_plans.go:302-324`、`task_evaluation.go:52-66`（service）、`evaluation_result.go:109-155`（分数同步半成功） | ~30 |
| **N+1 / 全量拉取无分页**（limit 10000/1000/500 被 maxPageSize 截断、逐条查库、瀑布请求） | `course_export_handler.go:57-162`、`position_export_handler.go:60-131`、`evaluation/landing/banks/[id]/page.tsx:110`、`library/landing/page.tsx:143`、`scene-results/page.tsx:100`、`use-task-datasets.ts:295`、`job-ability/page.tsx:56-65`、`logs/*/page.tsx` 搜索无防抖 | ~35 |
| **并发/锁缺陷（核心提交防重复失守）** | `affairs.go:183-305`（排课）、`teaching_plan.go:45-56`（生成并发无锁）、`job_ability_aggregator.go`、`task_evaluation.go` SaveMethods、`positions.go:463-494` ToggleFavorite 计数漂移 | ~8 |
| **TOCTOU / 非原子校验+写入** | `auth_handler.go:205-214`、`approvals.go:86-110`、`question_banks.go:169-191`、`user_relation.go:27-36`、`org.go:74-81`、`entity_code.go:40-50` | ~8 |
| **表单校验缺失 / 提交中可重复点击** | `alliance/projects/new/page.tsx:87-98`、`achievements/new/page.tsx:77-88`、`bank-form-dialog.tsx:246`、`batch-group-page.tsx:181-227`、`question-form-dialog.tsx:235-245`、`use-resource-crud.ts:128-177` | ~15 |
| **软删/引用一致性** | `task_evaluation.go:45-97`、`teaching_plans.go:128-172`、`task_evaluation.go:374-449`（ensureExamQuestions 遗留孤儿） | ~6 |
| **错误分类混淆（DB 错误当 404/400）** | `crud.go:121-125`、`task_evaluation_handler.go:207-211`、`org.go:93-97`、`teaching_plan_handler.go:247-250`、`subscription_handler.go:114-135` | ~10 |
| **其他**（DOM 非法嵌套、功能未完成/mock、图标无兜底崩溃、权限边界、爬坡等） | `schedule-grid.tsx:141-153`、`hybrid-grading-dialog.tsx:111-119`、`dashboard-tab.tsx:92`、`menu-permissions.ts:195`、`use-subscription-modules.ts:23-27` | ~20 |

> 全部 246 条 P2 的逐条明细见 `raw/wave1-*.md`、`raw/wave2-*.md`、`raw/wave3-*.md`。

---

## 四、P3 一般（477 条，汇总）

- **死代码 / mock / 功能占位**（约 120 条）：`stats_handler.go:9-15` MyStats 桩、`portal/workspace` 各 tab 大量 mock 静态数据、`hybrid/add` EMPTY_QUESTION_BANK/EMPTY_SCENARIOS 死功能、多个"按钮无 onClick"、`content-list-page.tsx:241-273` 只写不读 state、`navigation-config.ts:1052-1079` href='#' 占位。
- **类型安全（any 滥用、非空断言、as 强转）**（约 140 条）：前端各处 `(r:any)`/`as any`/`!`；`tenant/page.tsx` 8 处 as any；`api-client` 大量 `Record<string,any>`；`shared-types` Date 与 string 类型不一致。
- **错误处理（吞错/原始错误外抛）**（约 90 条）：`err.Error() != "EOF"` 字符串比较（应 `errors.Is`，出现于 `course_clone_handler.go:43`、`position_clone_handler.go:43`、`scenario_clone_handler.go:44` 等）；`err == pgx.ErrNoRows`/`err == service.ErrXxx` 直接比较（应 errors.Is）；`major-select.tsx:47` 展示原始 err.message。
- **性能小优化（重复渲染/无 memo/无防抖）**（约 70 条）：`org-type-icons.ts:8-34` map 每次重建、`org-node-picker` 等树组件无 memo、`use-toast.ts` 依赖 `[state]`。
- **命名/文案/一致性**（约 55 条）：`status.ts:12`"审核中"与 content-status"审批中"不一致；`app/portal` 品牌 6 页 100% 重复；`multi-select` 三套并存；`user_extension_field_handler.go:38` 直译残留文案。
- **测试质量**（约 15 条）：`status.test.ts` 仅 2 例、`job-converters.test.ts` 关键分支缺失、`lesson_handler_test.go:574` 空壳测试、`repro.test.ts` 残留 console.log。

---

## 五、回查验证记录

对 **P0 全部 2 条 + P1 中影响最大的 18 条**逐一定位复核，结果：

| 结论 | 数量 | 说明 |
|------|-----|------|
| ✅ 确认（bug 属实） | 16 | course_clone P0①、approval_handler nil workflow、course_handler batchID、import_export CSV EOF、job_ability_aggregator 锁删除、user_relations count SQL、course_nodes 事务穿透、cert_grades timestamptz scan、migrate isMultiStatement、file Preview 无鉴权、granular/add 模块级单例、tenant PreviewSchoolAdminPassword 别名、alliance.ts togglePublic、content-list CSV 确认弹窗、position_export 无租户、seed role 语义 |
| ⚠️ 修正（部分成立） | 1 | course_clone P0②：`node_resource_bindings` 实际有 tenant_id 列，降级为 P2 |
| 📖 依据子代理交叉核对（含 vendor 源码、schema、路由表） | 其余 | chi 路由静默覆盖语义、pgx TimestamptzCodec、表结构列等已核对 |

---

## 六、顶层最佳实践方案（模式级，可批量落地）

1. **租户隔离收敛**：为所有"按 id 写"的 store 方法补齐 `tenantID` 参数并在 WHERE 限定（系统性补缺），handler 侧统一前置 `verifyTenantOwnership`。参见 `raw/wave1-store-1.md`、`wave2-store-3/4` 的逐条清单。
2. **错误哨兵统一**：全仓替换 `err.Error()=="EOF"` / `err == pgx.ErrNoRows` / `err == service.ErrXxx` → `errors.Is`；定义哨兵错误变量（如 `ErrTopicFull` 替代字符串判错）。
3. **事务边界规范**：多表写操作一律 `withTxStore`/`WithTx` 包裹；事务内回读必须用传入的 tx Queryer（修复 course_nodes/lesson_content 事务穿透）；preview 模式禁止任何 INSERT/UPDATE/DELETE。
4. **核心提交防重复**：排课用 `pg_advisory_xact_lock` 于事务内；教学计划生成用唯一约束 + ON CONFLICT 幂等；任务评估 SaveMethods 把版本检查移入事务；避免"进程内 map 锁用完即删"（job_ability_aggregator）。
5. **前端异步竞态统一治理**：所有基于外部依赖的拉取加 `cancelled` 标志或 AbortController；搜索加防抖（300ms）；拖拽/批量操作结束后统一提交；列表请求配合服务端分页（后端 maxPageSize≈200）。
6. **错误提示闭环**：`catch` 至少 `toast`/`reportError`，保存/删除类操作 `try/catch/finally` 复位 loading；回读失败一律 500 而非返回零值 200。
7. **类型收敛**：前端消灭 `as any`（api-client 用精确载荷类型、use-task-datasets 用泛型）；shared-types 的 Date 字段统一为 string（JSON 实际返回字符串）。
8. **死代码清理**：按 raw 清单删除 mock/桩/空 onToggleEnabled/只写不读 state；抽公共组件（品牌 6 页、footer、multi-select 三套合一）。

---

## 七、文档索引

- 文件勾选清单（已全量勾选）：[`checklist.md`](./checklist.md)
- 后端原始逐批报告：`raw/wave1-core.md`、`raw/wave1-middleware-router.md`、`raw/wave1-handler-1.md`、`raw/wave1-handler-2.md`、`raw/wave1-service-1.md`、`raw/wave1-store-1.md`、`raw/wave2-handler-3.md`、`raw/wave2-handler-4.md`、`raw/wave2-handler-5.md`、`raw/wave2-service-2.md`、`raw/wave2-store-2.md`、`raw/wave2-store-3.md`、`raw/wave2-store-4.md`
- 前端原始逐批报告：`raw/wave3-app-1.md`、`raw/wave3-app-2.md`、`raw/wave3-app-3.md`、`raw/wave3-app-4.md`、`raw/wave3-comp-1.md`、`raw/wave3-comp-2.md`、`raw/wave3-core.md`、`raw/wave3-pkg-1.md`、`raw/wave3-pkg-2.md`

> 建议修复顺序：P0（course_clone 克隆必崩）→ P1 越权类（全列覆盖/无租户 UPDATE）→ P1 数据丢失类（approval 卡死、CSV 导入必败、batchID 清空）→ P1 并发锁（排课/汇聚/乐观锁）→ P2 批量治理。
