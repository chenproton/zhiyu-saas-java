# 回查验证报告与修复指引

> 本文件是对问题清单（problems-backend.md / problems-frontend.md）的回查验证结果：逐条重新阅读代码确认问题是否存在、校正行号与描述，并为每条（类）问题补充**最佳实践解决方案**。
> 图例：✅ 已确认存在　⚠️ 部分属实（描述已修正）　❌ 误报（已从清单移除）

---

## A. 后端必炸 SQL（全部 ✅ 已逐一打开代码核实）

### A1. `store/certifications.go:360-368` — ListFullItems GROUP BY 错误
确认：SELECT 子查询内引用 `p.ability_point_id`（LEFT JOIN 表的非分组列），`GROUP BY i.id, i.name, i.sort_order` → PG 报 `subquery uses ungrouped column`。认证规则编辑页调此函数必然 500。
**最佳实践**：改用相关子查询（不依赖 GROUP BY）：
```sql
SELECT i.id, i.name, i.sort_order,
       (SELECT name FROM ability_points ap WHERE ap.id = (
           SELECT p.ability_point_id FROM certification_ability_points p
           WHERE p.item_id = i.id ORDER BY p.sort_order LIMIT 1))
FROM certification_ability_items i
WHERE i.rule_id = $1
ORDER BY i.sort_order
```
并补一条单测覆盖该 SQL（当前 store 测试无此用例）。

### A2. `store/resource_codes.go:34-45` — Create 占位符错配
确认：INSERT 6 列（id, tenant_id, code, name, description, type），VALUES 7 个表达式（gen_random_uuid() + $1..$6），实参只传 5 个 → `bind message supplies 5 parameters, but prepared statement requires 6`。
**最佳实践**：删除多余的 `$6` 或列清单补 `updated_at`：
```go
INSERT INTO resource_codes (id, tenant_id, code, name, description, type, updated_at)
VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
```

### A3. `store/teaching_plans.go:59-79` — FetchProgramCourses 引用不存在表
确认：`FROM program_courses pc`，migrations 中只有 `training_program_courses`（092 迁移建表），且 `pc.career_position_id` 在 102 迁移已改名 `position_id`。
**最佳实践**：
```go
SELECT pc.course_id, pc.name, pc.code, pc.position_id, pc.nature, pc.credits, pc.hours
FROM training_program_courses pc
WHERE pc.program_id = $1
ORDER BY pc.sort_order, pc.id
```
另需全局 grep `career_position_id` 确认 training_program_courses 相关其它查询（`store/training_programs.go` PutCourses 已用 position_id 则正常）。

### A4. `store/scenarios.go:110-122` — Delete 引用已删除列
确认：`UPDATE training_program_courses SET scenario_id = NULL WHERE scenario_id = $1`，`scenario_id` 已被 `102_program_course_position.up.sql` DROP 且未加回 → 场景删除必炸。
**最佳实践**：删除该语句（training_program_courses 已不再关联 scenario），或若业务需要反查方案-场景关系，改查 `training_program_courses.position_id → career_positions` 链路。修复后务必实测 `DELETE /scene/scenarios/{id}`。

### A5. `store/node_evaluation_results.go:30` — nodeId 空串绑 uuid 列
确认：`qb.AddCondition("node_id = " + qb.NextArg(p.Values["nodeId"]))` 无判空，缺参/空串时 `invalid input syntax for type uuid` → 列表 500。
**最佳实践**：
```go
if nodeID, ok := p.Values["nodeId"]; ok && nodeID != "" {
    qb.AddCondition("node_id = " + qb.NextArg(nodeID))
}
```
同类模式全库排查（`exam_results.go` ListConfig 的 usageId 等）。

### A6. `store/batch_configs.go:46-134` — 搜索列歧义
确认：`TableName: "batches b LEFT JOIN majors m ..."` + `SearchColumns: []string{"name"}` → `ExecuteListQuery` 生成裸 `name ILIKE $x`，batches 与 majors 均有 name → `column reference "name" is ambiguous`。
**最佳实践**：SearchColumns 用带前缀列名并加入白名单：
```go
SearchColumns: []string{"b.name", "b.code"},
```
需确认 `query.go:321` 的 `allowedListQuerySearchColumns` 白名单允许 `b.name` 形式（`SanitizeIdentifier` 支持 `表.列` 则直接可用；否则在白名单中登记）。

---

## B. 后端顶级 IDOR（✅ 已抽查核实，方案统一）

已逐一打开 `scenario_handler.go`、`position_handler.go`、`course_handler.go`、`exam_handler.go`、`question_handler.go`、`question_bank_handler.go`、`node_quiz_handler.go`、`learn_road_handler.go`、`hybrid_module_handler.go`、`certification_handler.go`、`micro_cert_handler.go`、`position_certificate_handler.go`、`workflow_handler.go`、`recommend_handler.go`、`appeal_handler.go`、`job_banner_handler.go`、`ability_handler.go`、`knowledge_point_handler.go`、`node_homework_handler.go`、`random_draw_question_handler.go`、`on_site_question_library_handler.go`、`position_responsibility_handler.go`、`task_evaluation_handler.go`、`lesson_behavior_handler.go`、`task_knowledge_ability_handler.go`、`scenario_weight_handler.go`、`scenario_grade_handler.go`、`alliance_handler.go`、`program_course_import_handler.go`、`position_export_handler.go`、`student_portrait_handler.go`、`exam_result_handler.go` 等文件的 Get/Update/Delete 路径，全部确认只校验登录、不校验实体租户归属，且对应 store `GetByID/Update/Delete` 均为 `WHERE id=$1` 无 tenant 条件。

**统一最佳实践（三类方案按实体选择）**：

1. **store 层补租户条件（推荐，治本）**：单条读写删签名强制携带 `tenantID`，SQL 统一 `AND tenant_id=$n`。参照范本：`store/training_programs.go`（Get/Update/Delete/UpdateStatus 全部带 tenant）、`store/student_portraits.go:109`（DeleteArchive 带 tenant）、`store/organizations.go`。
2. **handler 层先取实体再校验归属**（实体可空 tenant 时）：`GetByID → if entity.TenantID == nil || *entity.TenantID != *claims.TenantID → 403`。**注意**：`tenant_id` 可空的表（scenario_tasks、graduation_project_topics、scene_evaluation_results、certification_* 等），`entity.TenantID != nil` 的守卫会让 NULL 行绕过校验——**NULL 归属一律拒绝访问**。参照范本：`handler/resource_library_handler.go`、`handler/alliance_crud_handler.go`（GetXByID(id, tenantID) 双参数）。
3. **crud 模板补配置**：`CheckOwnership: true` + `GetOwnership` + `TenantIDFn`（参照 `handler/staff_title_handler.go:72-73`、`handler/exam_usage_handler.go:57-58`），适用 job_banner/learn_road 等走 crud 的 handler。

**特殊处理清单**：

| 位置 | 特殊点 | 修复要点 |
|------|--------|----------|
| `portal_handler.go:29-35` | role 参数信任 | 校验 `role ∈ claims.RoleCodes`，否则 403；或从 claims 取角色，彻底删除 query 参数 |
| `approval_handler.go:210-229` | fail-open | `isUserApproverForStep` 错误路径一律返回 false；`Review` 中 GetWorkflow 失败直接 500 |
| `task_evaluation_handler.go:86-164` | 乐观锁绕过 | 保存前 `verifyTaskOwnership(taskID)`；`SaveTaskMethod` 的 ON CONFLICT 加 `AND tenant_id=EXCLUDED.tenant_id` 守卫或先 SELECT 校验 |
| `position_export_handler.go:60-64` | 导出 ids | 岗位主查询补 `AND tenant_id=$2`（同文件 150 行的 bindings 已有先例） |
| `program_course_import_handler.go:61-98` | 任意 programId DELETE | 校验 program 归属后再 DELETE |
| `lesson_behavior_handler.go:108-142` | course_id 透传 | ListRecords SQL 补 `AND r.course_id IN (SELECT id FROM courses WHERE tenant_id=$2)`；Create 校验学生/课程归属 |
| `student_portrait_handler.go:85-127` | req.UserID | 教师聚合改 `GetStudentPortraitByUserPosition` 补 tenant 参数；学生 self 强制 claims.UserID |
| `role_handler.go:140-146` | 跨租户分配 | `Assign` 的 INSERT 前校验 user 的 tenant_id 与 role 的 tenant_id 一致 |
| `exam_result_handler.go:67-72` | usage 资格 | SubmitExamResult 前校验 usage 的 tenant 与 exam 分配（exam_usages 是否有 target 包含当前 user） |
| `scenario_handler.go:127` | recordViewAsync 先于校验 | 移到归属校验之后 |
| `certification_model_handler.go:118` | PutWeights positionID | 先 `verifyTenantOwnership` 岗位 |
| `file_handler.go` | /uploads 无鉴权 | 方案：路由组挂 JWT（或公开图片走独立域名+随机名目录）；Upload 加扩展名白名单（去 svg/html）；`ParseMultipartForm` 后 `defer r.MultipartForm.RemoveAll()` |
| `cache/middleware.go:91` | 限流 IP 伪造 | RateLimit 用 `r.RemoteAddr` 前先剥离 chi RealIP 改写——方案：限流中间件放到 RealIP 之前，或记录 `X-Real-IP` 仅当信任代理存在；简单方案：限流键改 `clientIP(r)` 读取原始连接地址（在 router 最外层注册限流） |

---

## C. 后端其它关键项回查（✅/⚠️）

| 位置 | 验证 | 最佳实践 |
|------|------|----------|
| `handler/import_export_handler.go:339` 参数错位 | ✅ courses: code/name 互换；exams/question_banks: description 写入生成码 | 传参改为 `h.DB.Exec(ctx, meta.updateSQL, row.name, row.code, existingID)` 按各 updateSQL 占位符顺序构造 `updateArgs(meta, row, existingID)` 帮助函数，并为每个实体写测试断言 updateSQL 与参数顺序匹配 |
| `service/scenario.go:104` PopulateEvalData 值副本 | ✅（无回写，与 AttachRoles 不同） | `t, err := ...; items := []domain.ScenarioTask{*t}; s.st...PopulateEvalData(ctx, items); t = &items[0]` 或让 PopulateEvalData 返回数据 |
| `service/user.go:161-165` AttachRoles | ⚠️ **误报已更正**：`*user = items[0]` 回写存在，功能正常；但 store 查询错误被吞（roles 静默缺失） | 保留调用方式，仅将 `AttachUserRoles` 改为返回 error 并处理 |
| `service/lesson_content.go:449-468` 多试卷 usageId 覆盖 | ✅ 多 paperID 时 rc 只存最后一篇 | 改为 `rc["usageIds"] = []string{...}`（或循环内按 paperID 存数组），并同步前端/消费方读取 |
| `handler/user_management_handler.go:312,628` Get 后解引用 | ✅ `user, _ :=` 失败时 nil 解引用 panic | 改为 `if err != nil || user == nil { respondServerError(...); return }` |
| `handler/certification_model_handler.go:124-127` nil err | ✅ | `if err != nil { respondServerError(...) }`；rule==nil 单独 404 |
| `handler/template_handler.go` 6 处 `rows, _ :=` + Next | ✅ pgx 查询失败返回 nil rows → panic | 所有 `rows, _ :=` 改为检查 err；提供公共 `queryRows(w, r, sql, args...)` 封装 |
| `handler/resource_import_handler.go:361-367` 同上 | ✅ | 同上 |
| `cmd/migrate/main.go:144` down 字符串排序 | ✅ `100_` < `99_` 字符串序 | down 也按数字解析排序（与 up 相同逻辑），或 `ORDER BY to_number(split_part(version,'_',1),'999')` |
| `handler/testhelper/setup.go:48-51` 回退生产 DSN | ✅ | `if dbURL == "" { t.Skip(...) }` 禁止回退 DATABASE_URL |
| `store/course_homeworks.go:164` NULL comment 丢行 | ✅ | comment 列 Scan 到 `*string` 或 `COALESCE(s.comment,'')` |
| `handler/schedule_import_handler.go:155-262` overwrite 失效 | ✅ 形参未用 | 引入 `if !overwrite` 时跳过"课程列表"Sheet 的 DELETE 分支，或改为逐条 upsert |
| `store/scenario_clone.go`/`course_clone.go` Scan continue | ✅ | clone 关键路径改为 `err != nil → return err`（事务回滚），仅富化类容错 |
| `middleware/oplog.go:74-82` statusRecorder 无 Flusher | ✅ | 若需流式导出响应，statusRecorder 需实现 `http.Flusher`（包装底层） |
| `router.go:141-143 vs routes_job.go:9-11` 重复注册 | ✅ 实测 chi 后注册覆盖先注册 → 学生收藏接口实际 403 | 删除 jobViewer 组中重复的 3 条 favorite 路由，仅保留 jobViewer 一份（按业务意图） |
| `routes.go:123 vs routes_lesson.go:6`、`routes.go:126-129 vs routes_library.go` 重复注册 | ✅ 同上 → 学生课程/资源列表实际被 businessUser 覆盖成 403 | 删除 businessUser 组中与 jobViewer 组重复的 GET 注册；全库审计同类重复（`registerContentRoutes` 与 `registerContentReadRoutes` 同挂） |
| `auth_handler.go` preAuthClaims | ✅ HMAC 方法已校验，nonce 防重用；token 无 audience | 可加 `jwt.WithAudience("zhiyu")` 防跨站 token 复用（低优先） |
| `db.go` statement_timeout 15s | ✅ 正常 | 保持 |
| `scheduler.go` 单实例 | ✅ 部署单副本时正常 | 多副本部署时需分布式锁（低优先，记录即可） |

---

## D. 前端严重项回查（✅ 全部确认）

| 位置 | 验证 | 最佳实践 |
|------|------|----------|
| `knowledge-graph-d3-view.tsx:334-336` | ✅ `.html()` 拼接 d.label | 改 `.text(...)` 或 `escapeHtml()` 转义后拼接；或 tooltip 用 DOM 节点 + `textContent` |
| `rich-text-editor.tsx:46,50,57,59` | ✅ toast 是函数无 .error/.success | 改 `toast({ title: '请上传 PDF 文件', variant: 'destructive' })` |
| `system/add/page.tsx:365,653` | ✅ contentCode 硬编码 | 编辑模式从 `existing.contentCode` 取；新建才生成；保存节点时若 code 为空才回填 |
| `system/add/page.tsx:629-632` | ✅ kp-custom 被过滤无创建调用 | 保存前先 `knowledgeApi.create` 换取真实 id 并写入 idMapping 再提交绑定 |
| `hybrid/add/page.tsx:167-494` | ✅ 编辑不回填/节点不持久化/失败仍跳转 | ① existing 加载后 effect 回填 rootForm；② buildCoursePayload 后调 courseNodeApi 保存节点树（参照 system/add 的 saveNodes）；③ handleFinish 中 `const ok = await handleSave(); if (ok) router.push(...)`（handleSave 返回 boolean） |
| `courses-tab.tsx:219-243` | ✅ linkType=none 行被丢 | payload 改为显式三态：无关联行也发 `{positionId: null, courseId: null}`（后端整表 PUT 前先确认 NULL 行语义，或后端改为增量 diff 保存） |
| `achievements/[id]/page.tsx:94` | ✅ kind 复数 vs 枚举单数 | `optionsFor` 的 kind 改用 shared-types `achievementType` 枚举单数 'scene'/'course'，并去掉 as any |
| `experts/[id]/edit/page.tsx:125-132` | ✅ payload 缺 5 字段被全字段 UPDATE 清空 | 表单初始化时从 `allianceExpertApi.get(id)` 全量回填 item（含 photos/rating/expertType/professionalFields/positionDirection），提交原样回传；后端 `UpdateExpert` 改为按需更新（仅更新非零字段）更稳妥 |
| `projects/page.tsx:123,240` 等 onToggleEnabled 空实现 | ✅（brands 各页同） | 实现 `onToggleEnabled` 调 `allianceProjectApi.update(id, {isPublic})`（或后端增专有 toggle 接口）；或删除 Switch 控件避免误导 |
| `teacher-courses-tab.tsx:46-816` | ✅ 全 mock + 假 URL | 接真实 `portalApi.workspaceDashboard` 数据；URL 由课程 id 拼接 |
| `hybrid-grading-dialog.tsx:367-390` | ✅ 无 onClick | 实现评分流程（调后端 grading 接口）或移除按钮 |
| `exams/[id]/page.tsx:222-232` | ✅ 拖拽 PUT 风暴 | onDragEnd 一次性提交；或节流 500ms |
| `resource/package/page.tsx:112-116` | ✅ retry 不请求 | onRetry 中调用真实 load 函数 |
| `question-form-dialog.tsx:212` | ✅ score 硬编码 0 | 表单加"分值"输入；编辑时 `formData.score = question.score` |
| `question-form-dialog.tsx:141-143,580-600` + `question-preview.tsx:32` | ✅ answer 数组 vs 字符串 | 判断题统一 `answer[0] === 'true'` 或后端判断题 answer 改布尔；两处一致化 |
| `schedule-grid.tsx:270-272,378` | ✅ 周视图不随日期变化 | WeekView 事件过滤增加 `date ∈ [weekStart, weekEnd]` 条件 |
| `tasks/page.tsx:507-563,735-791` | ✅ 权重/临时 id/部分失败 | ① clone 后重算全部权重；② 临时任务（task- 前缀）删除走本地状态；③ 保存循环失败中断并提示已成功项；④ 任务级 weight 入 payload（后端补字段或按 evalData 存） |
| `roles/page.tsx:242-259` | ✅ 默认全选菜单 | `perms.menus` 缺失时初始化空对象而非全选；仅显式勾选项入库 |
| `step-ability-modeling.tsx:431-434` | ✅ Escape 执行保存并删职责 | Escape 走 `handleCancelEditResp`；删除职责时同步清理其 abilityBindings |
| `login/page.tsx:226-231` | ✅ 测试账号随生产 | 改为从环境变量 `NEXT_PUBLIC_DEMO_ACCOUNTS` 注入，未配置不渲染 |
| `superadmin/page.tsx:54,153-192` | ✅ 手写 fetch + atob | 改用 `saasLogin`/`saasRequest`；token 解析用 `jwt-decode` 库（或干脆只依赖后端 /auth/me） |
| `teachers/page.tsx:363` | ✅ type="text" | 改 `type="password"` |
| `lesson/landing/[id]/page.tsx:1086` | ✅ 附件 URL 未校验 | 渲染前 `new URL(url)` 校验协议 http/https，否则过滤 |
| `resource-preview-modal.tsx:230` | ✅ href 未校验 | `isSafeUrl(url)` 协议白名单 |
| `d3-view tooltip` / `scene-card coverImage` | ✅ CSS url() 注入 | coverImage 入库时协议白名单 + 渲染时转义引号 |

---

## E. 误报更正（已从问题清单移除或修正）

| 位置 | 原报告 | 回查结论 |
|------|--------|----------|
| `service/user.go:161-165` AttachRoles | "值副本导致角色信息不回写" | ❌ 误报：`*user = items[0]` 有回写，功能正常。降级为低危"store 查询错误被吞" |
| `shared-types/src/index.ts` barrel 同名冲突 | "约 10 组类型在包根不可解析" | ❌ 误报：`job-source.ts` 未从 barrel 导出，`tsc --noEmit` 全包通过。保留低危"job-source/backend/approval/job 重复定义易漂移"（可维护性问题，非编译错误） |
| `api/auth.ts` saasLogin/saasMe 平台错配 | "saasMe 携带 portal token 被 403" | ✅ 确认（运行时问题，编译不报错）：`request()` 默认 `getDefaultPlatform()='portal'`（api-helpers.ts:133），SaaS 登录后 token 存 `TOKEN_KEYS['saas']`，`saasMe` 却读 portal key → 无 token/错误 token → 后端 `meWithPlatform` 403"无效平台" |
| `handler/content_actions.go:71` | "NULL tenant 行状态流转不可用" | ⚠️ 属实但为边缘脏数据，降级为低 |
| `handler/course_handler.go:405-412` Assessments | "verifyTenantOwnership 用自己比自己是空操作" | ✅ 确认：`verifyTenantOwnership(w, r, *claims.TenantID)` 自身比较恒真，属无效调用（课程归属未校验），保留但标注为"空操作调用" |
| `store/roles.go:84-103` Assign | "跨租户 roleID 可插入" | ✅ 确认（handler 校验了 role 归属但未校验 user 归属） |

### 前端全局编译状态（回查补充）

- `pnpm --filter @zhiyu/edu exec tsc --noEmit` **通过（EXIT 0）**：本报告的前端问题均为**运行时/契约/逻辑问题**（编译期无法拦截），这也是 `as any` 泛滥 + DTO 漂移能共存的原因。
- 后端 `go build ./...` 通过（问题清单中的必炸 SQL 均为**运行时**才暴露，编译期无法发现——因此 A1-A6 每一处都必须补执行级测试）。

---

## F. 模式化最佳实践（适用于中低危批量修复）

1. **rows.Err() / Scan 错误**：所有 scan 函数统一收尾 `return items, rows.Err()`；行级容错用 `if err := rows.Scan(...); err != nil { return nil, err }`（关键路径）而非 continue（富化路径可 continue 但需计数）。
2. **错误分类**：区分 `pgx.ErrNoRows → 404`、业务约束 → 400、其它 → `respondServerError`（记录原始 err）。全局统一用 `store.ErrNotFound` 哨兵错误。
3. **handler 回读**：`item, _ :=` 一律改为检查错误；Get 返回 nil 时 respondServerError 而非解引用。
4. **导出/导入**：收集 errors/warnings 数组，随成功响应返回 `{warnings}` 或失败码；禁止"吞错仍 200"。
5. **N+1**：列表页聚合查询用 `WHERE id = ANY($1::uuid[])` 批量回填（参照 `store/course_nodes.go:KnowledgePointsByIDs` 模式）。
6. **前端错误态**：所有 `catch {}` 至少 `reportError` + 页面区分 `error/loading/empty` 三态；列表加载失败不得显示"暂无"。
7. **契约**：前端 DTO 一律从 `@zhiyu/shared-types` 导入；`as any` 收口；后端响应结构变更先改 shared-types。
8. **limit 截断**：前端分页组件化；后端 maxPageSize 截断时响应带 `total` 由前端翻页。
9. **硬编码假数据**：生产路径禁用 mock（footer/社区/收藏/荣誉/统计），数据源缺失时显示"功能建设中"占位组件而非假数字。
10. **测试**：handler 集成测试补越权用例（跨租户 id → 403/404）；`setup.go` 移除 DSN 回退；store 关键 SQL 补执行测试（A1-A6 每处必须有测试钉住）。
