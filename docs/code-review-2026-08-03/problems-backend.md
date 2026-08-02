# 全量代码审查问题清单 — 后端

> 审查日期：2026-08-03
> 审查范围：backend/ 全部 283 个 Go 文件（含测试），逐行完整阅读，未抽样
> ✅ 已回查验证：每条问题已重新阅读代码确认，详见 [problems-verification.md](problems-verification.md)（后端）
> 文件清单与勾选状态见 [checklist.md](checklist.md)
> 严重级别：`[严重]` = 必须修复（安全漏洞/功能必炸/数据丢失）｜`[中]` = 建议修复（错误吞掉/数据不一致/明显缺陷）｜`[低]` = 可选（代码异味/健壮性/一致性）
> 前端问题清单见 [problems-frontend.md](problems-frontend.md)

---

## 0. 总体结论（先读这里）

### 0.1 三大系统性问题

1. **跨租户越权（IDOR）是全局性缺陷（最高优先级）**。
   根因：本项目 store 层 SQL 无 RLS，租户隔离完全依赖上层，但**大量 handler 的 `Get/Update/Delete` 只校验登录、不校验实体租户归属**，而对应 store 的 `GetByID/Update/Delete` 又统一 `WHERE id=$1` 不带 `tenant_id`。已确认可直接利用的跨租户读写删/数据泄露面覆盖约 40+ 个 handler、60+ 个 store 方法（见 1.1 节清单）。
   修复方向：store 层单条写操作统一补 `AND tenant_id=$n`（参数由 handler 从 claims 传入）；handler 层统一先取实体再 `verifyTenantOwnership`（参照 `resource_library_handler.go`、`alliance_crud_handler.go`、`training_program_handler.go` 的正确写法）。

2. **静默吞错泛滥**。
   `_, _ =`、`catch {}`、`continue` 吞掉错误后继续返回成功，覆盖 DB 故障、导出缺行、导入半覆盖、上传失败等场景，用户无感知数据损坏（典型：`course_export_handler.go`、`granular_course_export_handler.go`、`import_export_handler.go:339` 参数错位、前端 `landing` 各页 catch 吞错显示"暂无"）。

3. **前后端契约漂移**。
   - 前端 `api/job.ts saveFull` 期望 `{position}` 包裹，后端返回裸对象；
   - `api/auth.ts` saasLogin 用错 token 平台导致 403；
   - `shared-types/index.ts` barrel 同名类型冲突导致部分类型不可解析；
   - `api/system.ts approval.review` 传 `nextStepIdx` 后端不消费；
   - 前端大量页面用 `as any` 绕过 DTO 校验后提交多余/缺失字段。

### 0.2 立即会炸的功能（验证过的运行时错误）

| 位置 | 问题 |
|------|------|
| `store/certifications.go:360` `ListFullItems` | GROUP BY 未分组列，SQL 必报错 → 认证编辑页必然 500 |
| `store/resource_codes.go:34` `Create` | INSERT 列 6 个但 VALUES 7 个占位符，每次调用必报参数数错误 → 资源代码创建不可用 |
| `store/teaching_plans.go:59` `FetchProgramCourses` | 引用不存在的表 `program_courses` → 教学计划生成链路必炸 |
| `store/scenarios.go:111` `Delete` | 引用已被 migration 102 删除的 `training_program_courses.scenario_id` 列 → 场景删除必炸 |
| `store/node_evaluation_results.go:30` | nodeId 空字符串绑定 uuid 列 → 缺参时列表 500 |
| `store/batch_configs.go` 各 SearchColumns | JOIN majors 后裸列 `name` 歧义 → 带搜索参数即报错 |
| 前端 `rich-text-editor.tsx:46` | `toast.error` 不存在（toast 是函数非对象）→ 任何上传动作抛 TypeError ✅ 已修复 |
| 前端 `system/add/page.tsx:365` | 编辑模式 `contentCode` 硬编码 `CNT-SQL001` → 保存批量污染真实节点编码 ✅ 已修复 |

### 0.3 统计

- 后端问题总数：约 600 条（严重约 130 / 中约 170 / 低约 300）
- 前端问题总数：约 800 条（严重约 15 / 中约 180 / 低约 600）
- 其中安全类（越权/泄露/XSS）后端约 120 条、前端约 10 条

---

## 1. 安全高危（[SEC]）

### 1.1 跨租户越权读写删（IDOR）— 直接可利用

**路由已挂在含学生的 jobViewer 组（学生可达）**：

| 文件:行号 | 接口 | 问题 |
|-----------|------|------|
| `handler/scenario_handler.go:111-134` | GET /scene/scenarios/{id} | 无租户校验，学生可读他租户场景详情（含草稿） |
| `handler/course_node_handler.go:116-134` | GET /lesson/nodes/{id} | 无租户校验，学生可读他租户节点全量内容 |
| `handler/ability_handler.go:57-63` | GET /job/abilities/{id} | 无租户校验，学生可读他租户能力点 |
| `handler/knowledge_point_handler.go:55-68` | GET /lesson/knowledge-points/{id} | 同上 |
| `handler/position_certificate_handler.go:33-54` | GET /job/position-certificates | List 无租户过滤，泄露全平台岗位证书 |
| `handler/random_draw_question_handler.go:30-48` | GET /evaluation/random-draw-questions | List TenantScoped=false + SelectColumns 含 answer → 全租户答案泄露 |
| `handler/node_homework_handler.go:53-66` | GET /lesson/nodes/.../homeworks | 无租户校验 |
| `handler/on_site_question_library_handler.go:53-61` | GET /library/on-site-questions/{id} | **完全无鉴权**（未登录可读，含答案） |

**businessUser / 其它角色组（跨租户读写删）**：

| 文件:行号 | 接口 | 问题 |
|-----------|------|------|
| `handler/course_handler.go:202-358` | PUT/DELETE /lesson/courses/{id} | Update/Delete 无租户校验，可跨租户改写/级联删除课程 |
| `handler/exam_handler.go:143-368` | exam 全部写接口 | Update/Delete/AddQuestion/RemoveQuestion/UpdateScore/BulkUpdateScores 全部跨租户 |
| `handler/position_handler.go:172-452` | PUT/DELETE/SaveFull /job/positions/{id} | Update/Delete/SaveFull 无归属校验（Delete 取回 tenantID 仅用于清缓存，从未比对） |
| `handler/question_handler.go:64-179` | GET/PUT/DELETE /evaluation/questions | 全部跨租户（含答案读取） |
| `handler/question_bank_handler.go:119-208` | PUT/DELETE /evaluation/question-banks/{id} | 跨租户改/删题库（级联删题目） |
| `handler/certification_handler.go:104-625` | 认证规则全部接口 | GetRule/UpdateRule/DeleteRule/ConfigItems/ConfigPoints/UpdateItem/DeletePoint/GetFullRule 全链路无租户校验 |
| `handler/learn_road_handler.go:48-113` | learn-roads CRUD | crud 配置未设 CheckOwnership，store 也无租户过滤，双层失守 ✅ 已修复（store GetByID/Update/Delete 补 tenant_id 过滤，handler 经 TenantFn 传租户） |
| `handler/hybrid_module_handler.go:44-86` | hybrid-modules | Upsert（body 可带 id）/Delete 跨租户 |
| `handler/node_quiz_handler.go:93-257` | node-quizzes 全部操作 | 全链路无租户校验 |
| `handler/task_evaluation_handler.go:86-164` | PUT /scene/tasks/{taskId}/evaluation-methods | 跨租户覆写方法行（乐观锁绕过）+ 为他租户任务建临时考试 |
| `handler/course_resource_handler.go:117-160` | Bind/UnbindResource | 可绑定/解绑他租户课程资源，同步污染他租户 course.resource_ids |
| `handler/node_resource_handler.go:160-171` | UnbindResource | 跨租户解绑任意绑定行 |
| `handler/task_resource_handler.go:179-184` | UnbindResource | 同上 |
| `handler/position_ability_handler.go:97-140` | position-ability-bindings | Update/Delete 跨租户 |
| `handler/position_responsibility_handler.go:41-134` | position-responsibilities | 全部跨租户（实体 tenant_id 为 NULL） |
| `handler/scenario_weight_handler.go:44-73` | PUT /scene/weights/{id} | body 带 id 跨租户覆盖 |
| `handler/scenario_grade_handler.go:54-81` | PUT /scene/grade-mappings/{id} | body 带 id 跨租户覆盖；URL id 从未读取 |
| `handler/task_knowledge_ability_handler.go:52-105` | UnbindKnowledge/UnbindAbility | 跨租户删除绑定 |
| `handler/ability_domain_handler.go:94+` | ability-domains | store Get/Update/Delete 无租户（NULL 租户行绕过校验） |
| `handler/appeal_handler.go:47-109` | appeals | Get/Process 跨租户（含个人信息），Process 接受任意状态字符串 |
| `handler/evaluation_method_handler.go:55-75` | Toggle | 跨租户切换测评方式启用状态 |
| `handler/role_handler.go:140-146` | POST /roles/{id}/assign | 不校验 req.UserID 租户归属，可跨租户分配角色（提权面） |
| `handler/job_banner_handler.go:46-101` | banners CRUD | crud 配置无 ownership，store 无租户，跨租户读写删 ✅ 已修复（store Get/Update/Delete 补 tenant_id 过滤；顺带修复 Create 占位符 7 列 vs 8 值错配） |
| `handler/recommend_handler.go:87-125` | recommendations | Update/Delete 跨租户 ✅ 已修复（store Get/Update/Delete/fetchRecommend 补 tenant_id 过滤，handler requireTenant 传租户） |
| `handler/micro_cert_handler.go:85-207` | 证书模板/发放 | Get/Update/DeleteTemplate、IssueCerts 全跨租户（可给他租户用户发证） |
| `handler/workflow_handler.go:58` | GET /workflows/{id} | Get 无归属校验（Update/Delete 有） ✅ 已修复（store Get/Update/Delete 补 tenant_id IS NOT DISTINCT FROM 过滤，兼容 NULL 租户全局流程） |
| `handler/lesson_behavior_handler.go:108-142` | behavior-collection | Aggregate 跨租户读（含学生姓名/考勤/成绩）；Create 信任请求体伪造 |
| `handler/student_portrait_handler.go:85-127` | POST /evaluation/portraits/generate | req.UserID 信任请求体 + store 无租户过滤 → 跨租户聚合学生画像 |
| `handler/approval_handler.go:210-229,168-197` | POST /approvals/{id}/review | `isUserApproverForStep` fail-open（错误即放行）；GetWorkflow 失败时一步点击即 approved + 同步发布 |
| `handler/portal_handler.go:29-35` | GET /portal/workspace/dashboard?role=x | role 参数完全信任前端，学生带 ?role=school_admin 获取全校统计 |
| `handler/job_ability_result_handler.go:237-254` | GET aggregate/status?logId | 汇聚日志按 id 直查无租户 |
| `handler/program_course_import_handler.go:61-98` | POST /import/program-courses/excel | 任意 programId 直接 DELETE 重建，跨租户清空他方案课程 |
| `handler/position_export_handler.go:60-64` | POST /export/positions/excel | 按 ids 导出他租户岗位数据（无租户过滤） |
| `handler/certification_model_handler.go:118` | PutWeights | positionID 归属未校验，可在他租户岗位名下建规则 |
| `handler/exam_result_handler.go:67-72` | POST /evaluation/exam-results | usageID 未校验归属/资格，可引用他租户考试提交判分 |
| `handler/user_relation_handler.go:15-20` | POST /user-relations | initiatorId/targetId 信任请求体 |
| `handler/evaluation_result_handler.go:129-136` | POST /evaluation/results | EvaluatorID 信任请求体可伪造评估人 |
| `handler/student_portrait_handler.go` / `micro_cert` | — | 同源问题 |
| `handler/certification_handler.go:138` | CreateRule | req.CareerPositionID 未校验归属，指向他租户岗位 |
| `handler/alliance_handler.go:105-282,440-564` | 联盟协议/里程碑/权限/字典 | List/Create/Update 跨租户（enterprise/project/milestone/permission/dictionary） |
| `handler/course_node_handler.go:136-188,268-287` | Create/Reorder | CourseID 未校验归属，可挂节点到任意租户课程 |
| `handler/exam_handler.go:235-279` | AddQuestion | FetchExamQuestion 无租户/题库过滤，可快照他租户题目（含答案） |
| `handler/graduation_handler.go:330` | GET /evaluation/graduation/query | `*claims.TenantID` 无 nil 检查直接解引用 → panic |

**store 层（handler 已缓解但 TOCTOU / 签名无隔离，纵深防御缺失）**：
`store/{abilities,courses,questions,question_banks,exams,exam_usages,certifications,micro_cert,node_quizzes,lesson_content,course_nodes,hybrid_modules,recommends,random_draw_questions,on_site_question_library,position_bindings,position_certificates,scenario_configs,banners,student_portraits,graduations,approvals,evaluation_methods,evaluation_results,resource_bindings,landing,alliance_*_store,terms,subscriptions,teaching_plans,organizations,industries,majors,org_types,resource_codes,task_evaluation,user_extension_fields,staff_titles,roles,tenant_admins,users,batches,scheduling,logs}.go` 的 `Get/Update/Delete` 普遍 `WHERE id=$1` 无 tenant 条件（约 60+ 处），其中 handler 已完全缓解的属于纵深缺陷，未缓解的即活漏洞（1.1 节已列）。

**跨租户列表泄露（TenantScoped 配置错误）**：

| 文件:行号 | 问题 |
|-----------|------|
| `store/position_bindings.go:218` ListConfig | TenantScoped=false → 全租户职责列表 |
| `store/random_draw_questions.go:102` ListConfig | TenantScoped=false → 全租户抽题（含答案） |
| `store/organizations.go:52-96` Tree/MemberCounts | tenantID 为空串时返回全库组织树 |
| `store/resource_bindings.go:45-53` List | 同上 |
| `store/user_relations.go:33` List | 同上 |
| `store/portal.go:372-532` 各 List | 经 creator_id 间接过滤而非实体 tenant_id，nil 时全租户 |
| `store/landing.go:33-51` | JOIN exam_usages 未约束 eu.tenant_id |

### 1.2 未鉴权/敏感信息

| 文件:行号 | 问题 |
|-----------|------|
| `router/router.go:121` + `handler/file_handler.go:89-106` | **GET /uploads/{filename} 完全无鉴权**：任何未登录用户可下载任意上传文件（文件名随机 UUID，但 URL 泄露即公开）；同时 Upload 不限制文件类型，可上传 HTML/SVG → 同源存储型 XSS |
| `handler/file_handler.go:42-53` | Upload 未调用 `r.MultipartForm.RemoveAll()` → 每次上传 >32MB 的文件在服务端留下临时文件（磁盘泄漏） |
| `middleware/auth.go:33-51` | JWT 中间件未校验 token 的 `exp` 由前端刷新承担；7 天 token 权限变更延迟生效（设计取舍，建议记录） |
| `cache/middleware.go:75-120` | **限流 IP 可被 X-Forwarded-For 伪造绕过**：router.go:99 启用 chi RealIP 后 `r.RemoteAddr` 被客户端可控头覆盖，登录限流（30/min/IP）可无限绕过，oplog IP 也被污染 |
| `middleware/rbac.go:54-58` | RequireRoleOrMenu 的菜单豁免：任何菜单权限为 true 的用户可 GET 所有该组数据（有意的桥接设计，但需知悉） |
| `handler/tenant_handler.go:447,532,654` | 创建管理员/重置密码把明文密码直接放 JSON 响应 |
| `handler/file_handler.go:146-199` | Preview 调用 libreoffice 转换无超时/大小限制 → 大文档可耗尽 CPU/内存（DoS 面） |
| `router/router.go:104` | CORS `Access-Control-Allow-Origin: *` 全放开（无凭据场景风险低，建议按环境配置白名单） |
| `handler/auth_handler.go:117-137` | 登录接口时间侧信道：用户名不存在时不做 bcrypt → 可枚举用户名 |

### 1.3 前端安全（见 problems-frontend.md 1.1 节，摘要）

- `knowledge-graph-d3-view.tsx:334` tooltip `.html()` 拼接用户数据 → 存储型 XSS
- `resource-preview-modal.tsx:230` `href={resource.url}` 未校验协议 → javascript: 链路
- `scene-card.tsx:44` / `banks/[id]/page.tsx:196` 等 coverImage 直接拼 CSS url() 未转义
- `login/page.tsx:226-231` 硬编码明文测试账号（school/school123 等）随生产发布
- `lesson/landing/[id]/page.tsx:1086` 学生提交附件 URL 未校验协议直接渲染
- `teachers/page.tsx:363` 密码输入框 `type="text"` 明文显示
- `superadmin/page.tsx:153-192` 客户端 atob 裸解 JWT + 绕过 api-client 手写 fetch

---

## 2. 后端功能缺陷（必炸/数据丢失，非安全）

### 2.1 运行时 SQL 错误（必炸）

| 文件:行号 | 问题 |
|-----------|------|
| `store/certifications.go:360-368` | ListFullItems GROUP BY 未分组列 `p.ability_point_id` → 认证编辑页 500 ✅ 已修复 |
| `store/resource_codes.go:34-45` | Create 的 INSERT 列(6) 与 VALUES(7) 数量不匹配 → 资源代码创建必失败 ✅ 已修复 |
| `store/teaching_plans.go:59-79` | FetchProgramCourses 引用不存在的表 `program_courses`（应为 training_program_courses，列名 position_id 非 career_position_id）→ 生成教学计划必炸 ✅ 已修复 |
| `store/scenarios.go:111` | Delete 引用已删除列 `training_program_courses.scenario_id` → 场景删除必炸 ✅ 已修复 |
| `store/node_evaluation_results.go:30` | ExtraFilter 无条件绑定 nodeId，空串绑 uuid 列报错 → 缺 nodeId 参数列表 500 ✅ 已修复 |
| `store/batch_configs.go:52-129` | 各批次 SearchColumns 裸列 `name` 与 JOIN majors 歧义 → 带 search 参数必报 ambiguous ✅ 已修复 |

### 2.2 数据丢失/覆盖

| 文件:行号 | 问题 |
|-----------|------|
| `handler/import_export_handler.go:339` | overwrite 分支参数错位：`courses` updateSQL 为 `SET code=$1, name=$2`，实际传参 code=row.name、name=row.code 互换 |
| `service/scenario.go:104` | `PopulateEvalData(ctx, []domain.ScenarioTask{*t})` 传值副本 → 评估方法摘要永不回写，GetTask 数据缺失 |
| `service/user.go:161-165` | `AttachRoles` 传值副本 → 角色信息不回写，接口响应缺角色 |
| `service/lesson_content.go:449-468` | ensureNodePaperUsage 多试卷时 `rc["usageId"]` 只保留最后一篇 → 其余 usage 变孤儿 |
| `handler/course_import_handler.go:179-191,451-455` | overwrite 先清空课程节点（错误全吞），节点 Sheet 缺失即静默删除全部节点（含作业/测验） |
| `handler/exam_import_handler.go:155-171` | overwrite 先 DELETE exam_questions 再逐条插入，无事务，中途失败考试被清空 |
| `handler/schedule_import_handler.go:155-262` | `overwrite` 参数从未使用：无论是否选择覆盖，只要含课程列表 Sheet 即无条件 DELETE 该学期全部排课 |
| `handler/position_import_handler.go:139-192` | overwrite 4 个 DELETE + 逐条 INSERT 无事务、错误全吞 → 半覆盖状态 |
| `store/course_homeworks.go:77-98,141-162` | Grade 作业的 UPDATE + INSERT 评价双语句无事务 |
| `store/graduations.go:99-127` | ApplyTopic 报名写 archive 与递增计数非事务 |
| `store/question_banks.go:69-94` | Create 题库 INSERT + 知识点绑定无事务 |
| `store/scenarios.go:110-122` | Delete 4 条语句无事务 |
| `handler/training_program_handler.go:193-196` | 任何错误（含 DB 故障）映射为 400"已被引用" |
| `handler/affairs_term_handler.go:134-137` | 同上模式 |
| `handler/scheduling_handler.go:146-149` | DeleteVenue 任意错误 → 400"已被引用" |
| `store/tenants.go:74-94` | Update/UpdateStatus 无 RowsAffected 校验 |

### 2.3 状态机/校验缺陷

| 文件:行号 | 问题 |
|-----------|------|
| `handler/approval_handler.go:168-197,210-229` | Review 在 workflow 加载失败时 fail-open 直接通过并发布 |
| `handler/appeal_handler.go:99-102` | 任意状态字符串可写入（未限制 approved/rejected） |
| `handler/batch_handler.go:162-164` | Create/Update 任意状态字符串直接入库 |
| `handler/exam_usage_handler.go:134-168` | Start/Finish 无状态流转校验 |
| `handler/evaluation_result_handler.go:125-127` | MaxScore==0 静默改写为 100 |
| `handler/scenario_grade_handler.go:48-81` | PUT 的 URL id 从未读取，body 无 ID 时退化为 INSERT |
| `store/evaluation_results.go:77-96` | Submit ON CONFLICT 不更新 evaluator 字段、不清理 graded_at → 重新提交残留旧评分 |
| `handler/certification_model_handler.go:124-127` | rule==nil && err==nil 时 respondServerError 收到 nil err → panic |

### 2.4 迁移工具

| 文件:行号 | 问题 |
|-----------|------|
| `cmd/migrate/main.go:144` | migrateDown `ORDER BY version DESC` 字符串排序：`100_xxx` 会排在 `99_xxx` 之前回滚（up 已用数字排序，down 不一致） |

---

## 3. 后端错误处理（静默吞错）

### 3.1 导出类静默缺行（接口仍 200 成功）

- `handler/course_export_handler.go:63-75`、`handler/granular_course_export_handler.go:55-61,98`、`handler/exam_export_handler.go:94`、`handler/question_export_handler.go:83-85`、`handler/position_export_handler.go:66-95`、`handler/resource_export_handler.go:126-132`、`handler/scenario_export_handler.go:38-145`（fillScenariosData 恒返回 nil，错误分支不可达）、`handler/question_bank_export_handler.go:63-65`

### 3.2 导入类吞错

- `handler/resource_import_handler.go:361-367`：`typeRows, _ :=` 忽略错误后 `typeRows.Next()` 对 nil 调用 → **panic 风险**（同文件 769 行正确检查了 err）
- `handler/template_handler.go:586-596,771-777,823-829,881-887,1080-1086,1171-1178`：6 处 `rows, _ :=` 后直接 `for rows.Next()` → nil rows panic 风险
- `handler/affairs_config_import_handler.go:59-132`：QueryRow/INSERT 错误全吞，计数虚报
- `handler/granular_course_import_handler.go:137-138`：Preview 接口实际写库（findOrCreateKnowledgePoints 在 preview 分支执行 INSERT）
- `handler/question_import_handler.go:121-125`：找不到题目明细 Sheet 仍返回 200 成功
- `handler/import_common.go:400-439`：INSERT 错误忽略，回查失败返回随机 UUID → 下游绑定失败且无感知

### 3.3 service 层吞错

- `service/evaluation.go:47-49` EnsureDraftPool 丢弃 store 错误
- `service/evaluation_exam.go:21-26` BatchFetchExamQuestions 失败返回 200 空列表
- `service/evaluation_result.go:108-152` Grade 后 syncExamResultScore 错误忽略（评分与考试分数不同步）+ is_pass 不重算
- `service/task_evaluation.go:52-58` EnsureExamUsageForMethod 失败仅日志，接口仍成功

### 3.4 handler 层常见模式（回读吞错返回 null + 200）

`crud.go:93,166`、`course_clone_handler.go:43`、`node_homework_handler.go`、`affairs_term_handler.go:78`、`teaching_plan_handler.go:128-130,269`（Generate 回读失败解引用 nil 指针 panic 风险）、`user_management_handler.go:312-314,628-631`（**Get 失败后直接 `user.PasswordHash = ""` 解引用 nil → panic**）、`exam_usage_handler.go:148`、`staff_title_handler.go:187-195`、`subscription_handler.go:79-85`（AdminGet 任何错误 → 200 空订阅）

### 3.5 错误分类不当（内部错误映射为 400/404）

`training_program_handler.go:193`、`affairs_term_handler.go:134`、`scheduling_handler.go:146`、`cert_grade_handler.go:57`、`alliance_crud_handler.go:45-53`、`question_export_handler.go:40-44`、`position_responsibility_handler.go:48-52`、`random_draw_question_handler.go:57-61`、`appeal_handler.go:55-58`、`user_relation_handler.go:87-90`、`position_export_handler.go:66`

---

## 4. 后端性能

### 4.1 N+1 查询

- `handler/position_export_handler.go:55-177`：每岗位 4+ 次查询
- `handler/question_export_handler.go:119-135`：每题每知识点一次 QueryRow
- `handler/course_export_handler.go:140-142`：每节点 3 次查询
- `handler/scenario_export_handler.go:54-205`：每场景 5+ 查询，每 ID 一条 SQL
- `service/affairs.go:220-264`：AutoSchedule O(D×P×V×E×(N+E)) 拷贝
- `store/query.go:97` SearchParam 未使用；`ExecuteListQuery` 不检查 rows.Err()
- `handler/resource_export_handler.go:134-149`：每组织 2 次额外查询 + 逐级 buildOrgPath
- `handler/job_ability_result_handler.go:204-216`：每次请求无条件 go 30 分钟后台汇聚，无并发上限

### 4.2 全表扫描/无 LIMIT

- `store/alliance_*_store.go` 多个 ListPublic* 无 LIMIT
- `store/lesson_behaviors.go:22` 按课程全量返回
- `store/positions.go` / `store/certifications.go` 等 `LIKE '%...%'` 前导通配符
- `handler/node_quiz_handler.go:91` ListQuestions 无分页

### 4.3 内存/资源

- `handler/file_handler.go` Preview 大文档转换无超时
- `handler/common.go:90-96` decodeBody 无 MaxBytesReader 限制
- `handler/random_draw_question_handler.go` 等无请求体大小限制

---

## 5. 后端一致性/健壮性（低危汇总）

- **rows.Err() 未检查**：`store/` 下约 30 个 scan 函数（`ability_domains.go:113`、`alliance_*.go`、`banners.go:112`、`cert_grades.go`、`course_homeworks.go`、`exam_results.go:312`、`graduations.go`、`lesson_behaviors.go`、`logs.go`、`majors.go`、`node_quizzes.go`、`org_types.go`、`positions.go:568`、`question_banks.go:250`、`resource_library.go:258`、`scenarios.go:198`、`staff_titles.go`、`student_portraits.go`、`tenants.go:196`、`user_relations.go:97`、`workflows.go:118`、`scenario_tasks.go`、`course_nodes.go:385`、`teaching_plans.go:355` 等）
- **Scan 错误 continue 吞掉**：`store/scenario_clone.go` 7 处、`store/course_clone.go` 4 处、`store/cert_grades.go` 3 处、`store/graduations.go` 3 处、`store/course_homeworks.go:164`（NULL comment 扫描失败静默丢行）等
- **ErrNoRows 未映射 ErrNotFound**：`store/exam_usages.go:46`、`store/roles.go:43`、`store/industries.go:53`、`store/teaching_plans.go:212`、`store/subscriptions.go` 等
- **JSON 反序列化错误忽略**：`store/questions.go:154-163,205-214`、`store/exams.go:252-258`、`service/task_evaluation.go:147-169` 等
- **非法 UUID 静默转 SHA1 伪 UUID**：`store/certifications.go:586-589`、`store/learn_roads.go:72-82`（脏引用写入）
- **分层违规**：`handler/node_evaluation_result_handler.go:42`、`handler/course_handler.go:156`、`handler/exam_handler.go:114` 直接调 `store.GenerateUniqueEntityCode(..., h.Service.Queryer(), ...)`
- **domain 类型问题**：`evaluation.go:210` JobAbilityResult.EvaluatedAt string 与 DB timestamptz 不一致；`lesson.go:137` LessonBatchStatus 枚举缺 'active'（表 DEFAULT）；`status.go:13-25` 死常量；`unified.go:99/107` Phone 与 ContactPhone 并存；多个 `*string`/string、`JSONSlice`/`[]string` 不统一；`alliance.go:62-75/178-193` 重复类型定义
- **handler 内死代码/弱校验**：`stats_handler.go:23-29` MyStats 硬编码零值；`subscription_handler.go:39-69` Update 无路由注册；`oplog.go:74-82` statusRecorder 不实现 Flusher（导出流式响应场景受限）；`common.go:170,291` 悬空注释

---

## 6. 后端测试问题

- **[严重] `handler/testhelper/setup.go:48-51`**：TEST_DATABASE_URL 未设置时回退 DATABASE_URL（生产库）→ 测试会对生产库执行 migration 与 DELETE 种子数据。缺省必须 `t.Skip`
- **[中] `setup.go:476-485`**：清理表清单不全（缺 lesson_batches、micro_cert、exam_usages、certification_*、appeal_records、users）→ 断言失败时数据跨运行累积
- **[中] `lesson_handler_test.go:574`**：过期的 `t.Skip`（lesson_batches 表已存在），测试未启用
- **[中] `user_management_handler_test.go:57-60,284-293`**：defer 清理注册在断言之后，断言失败即泄漏用户行
- **[中] `portal_handlers_test.go:202-206`**：断言仅"非 500"，404/400 均通过
- **[中] `query_test.go:117-125`**：ExecuteListQuery 成功路径从未执行（fake 恒返回 nil rows）
- **[低] `evaluation_handler_test.go:859-866`**：TestMicroCert 签发记录泄漏
- **[低] `edge_case_test.go:159`**：非法 bcrypt 占位哈希
- **[低] `middleware/auth_test.go`**：缺少过期/篡改/错误密钥 token 用例

---

## 7. 后端修复优先级建议

1. **P0（安全）**：1.1 节全部 IDOR —— 统一方案：store 层 `GetByID/Update/Delete` 补 `AND tenant_id=$n` 或签名强制携带 tenantID（参照 `training_programs.go`、`resource_library_handler.go`）；NULL-tenant 行（scenario_tasks/graduation_topics/scene_evaluation_results 等可空列）一律视为"无归属"拒绝访问
2. **P0（功能）**：2.1 节 6 处必炸 SQL；`file_handler` 上传临时文件泄漏 + /uploads 鉴权 + 文件类型白名单（防 XSS）
3. **P1**：限流 IP 伪造（RealIP 与 clientIP 统一处理或限流改用 X-Forwarded-For 前的连接地址）；approval Review fail-open；`import_export_handler.go:339` 参数错位；portal role 参数信任
4. **P2**：导出类静默缺行统一改为：收集错误 → 响应带 `warnings` 或失败；`rows.Err()` 检查补全；service 层值副本 bug（scenario.go:104 / user.go:161）
5. **P3**：migrateDown 排序、测试库 DSN 回退、err 分类统一
