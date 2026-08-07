# Code Review 2026-08-07 — handler 审查批次 03

审查范围：exam_import / exam_result / exam_usage / favorites / file / graduation / granular_course / hybrid / import / industry / job_ability 等 21 个 handler 文件。
约束提醒：exam_import_handler、granular_course_*、import_common、import_export 属于豁免冻结区（import/export/template），直接持有 DB 不算违规；其余 handler 按分层规范审查。

---

## backend/internal/handler/exam_import_handler.go
- [P2][数据一致性] exam_import_handler.go:176 — 覆盖模式 `DELETE FROM exam_questions WHERE exam_id=$1` 错误被 `_, _ =` 完全吞掉。若删除失败（锁/连接抖动），旧题目残留、新题目以 sort_order 从 1 重新插入，出现重复题目/排序错乱，且无任何日志与错误提示；最佳实践：检查错误并记日志（或计入 result.Errors 让用户感知），同时建议删除与新写入放同一事务。
- [P2][数据一致性] exam_import_handler.go:160-176 — 覆盖模式的 DELETE 与后续 importExamQuestions 写入分属两条独立连接流程（非事务）。若中途失败，试卷处于"题目被清空但新题目未写完"的中间态；最佳实践：overwrite 的更新+清题+写题包在一个事务内。
- [P2][逻辑] exam_import_handler.go:240 — 题目分值 `parseFloatDefault(col(row,2), 0)`，非数字/空值静默记 0 分，导致试卷总分会失真且用户无感知；最佳实践：非空但非法分值应计入 Errors 提示。
- [P3][逻辑] exam_import_handler.go:180 — 覆盖更新成功也计入 `Created++`，语义上应为 Updated 或单独计数，前端可能误解"created"。
- [P3][边界] exam_import_handler.go:126-137 — `seen` 去重 map 按文件重置（mfu.ForEach 每个文件新起），跨文件重名试卷不会在预览中提示为重复；最佳实践：seen 提升到 ForEach 外层。
- [P3][细节] exam_import_handler.go:141 — `Scan(&existingCollaborators)` 直接扫描 uuid[] 到 []string，若该行 collaborator_ids 为 NULL 会 Scan 失败从而 exists 判定为 false，重名试卷会走新建分支；最佳实践：用 COALESCE(collaborator_ids,'{}')。

## backend/internal/handler/exam_result_handler.go
- [P1][越权] exam_result_handler.go:151+164 — Grade 先执行写入再校验租户：`Service.GradeExamResult(ctx, id, userID, ...)` 不传 tenantID，service 层（service/evaluation_result.go:158-218）按 id 直接 Get+重算+`Grade()` 落库，全程无租户过滤；handler 在写入完成后才在第 164-167 行比对 `result.TenantID != *claims.TenantID` 并返回 404。跨租户用户只要知道 result id，就能**修改他租户的考试结果分数/评分状态**（响应虽 404，数据已被改）。最佳实践：评分前先按 id+tenant 校验归属（仿 Create 第 75-83 行先查后比），或给 service 传入 tenantID 在 store 层过滤。
- [P2][越权] exam_result_handler.go:133-136、164-167 — Get/Grade 的租户校验条件是 `result.TenantID != nil && claims.TenantID != nil && *result.TenantID != *claims.TenantID`：任一为 nil 即跳过校验。claims.TenantID 为 nil 的用户（如部分平台角色）可绕过租户隔离读取/评分他人结果；最佳实践：nil 视为不匹配（拒绝），或改在 store 层带 tenant 过滤。
- [P2][契约] exam_result_handler.go:118-137 — Get 无"结果归属学生"校验：同租户内任意学生可凭 id 读取其他学生的考试结果详情（Create/List 均按本人/班级限制，此处不一致）；最佳实践：学生角色强制 `result.UserID == claims.UserID`。
- [P3][细节] exam_result_handler.go:107-110 — `err == pgx.ErrNoRows` 用相等比较而非 errors.Is，service 一旦包装错误即落到 500；与同文件 87-106 行的 errors.Is 风格不一致。
- [P3][命名] exam_result_handler.go:19 — SubmitExamResultRequest 用于提交，命名与语义（submit）匹配，但 Create 方法名与"提交"不一致，纯风格问题，可不处理。

## backend/internal/handler/exam_retake_policy_test.go
- [P3][测试] exam_retake_policy_test.go:85,138,222 — 学生 token 使用 `domain.UserRoleOperator` 角色（而非 RoleStudent），仅靠 platform="student" 区分，与 exam_usage_flow_test.go:169-170 使用 `domain.RoleStudent` 不一致；若被测逻辑依赖 RoleCodes 而非 platform，该用例将不具代表性，建议统一为 RoleStudent。
- 无 P0/P1/P2 问题；其余断言（重交 409、窗口 409、节点评分回写 90 分）均有意义。

## backend/internal/handler/exam_usage_flow_test.go
- [P3][测试] exam_usage_flow_test.go:167 — `DELETE FROM users WHERE id = ANY($1::uuid[])` 传入 []string，依赖 pgx 对 uuid[] 数组的字符串编码，可用但脆弱；无实际问题。
- 无 P0/P1/P2 问题；流程断言完整（发布/班级隔离 403/评分 70 分/重交 409/结束 finished）。

## backend/internal/handler/exam_usage_handler.go
- [P2][逻辑] exam_usage_handler.go:159 — manualOnly 仅当 `usage.TargetType != nil` 才校验手动类型：TargetType 为 NULL 的考试安排（异常数据/旧数据）可被任意编辑删除，绕过"自动创建不可改"约束；最佳实践：nil 视同非手动类型拒绝。
- [P3][错误处理] exam_usage_handler.go:194、217 — 状态更新后 `usage, _ = h.Service.GetExamUsage(...)` 吞掉错误，失败时返回 "null" 200；最佳实践：二次查询失败按 500 处理或直接返回状态码。
- [P3][边界] exam_usage_handler.go:186-189 — Finish 允许 from "in_progress"，但 Publish 只允许 from "draft"/"pending"，两条路径状态机不对称（in_progress 状态从何而来未见出处）；如无 in_progress 来源可简化。

## backend/internal/handler/exam_usage_visibility_test.go
- 无问题；覆盖了手动/自动安排在不同入口的可见性，断言具体（gotIDs/eventIDs/upcomingCount=1）。

## backend/internal/handler/favorites_handler.go
- [P2][租户] favorites_handler.go:39,61 — GetFavorite/ToggleFavorite 只按 `claims.UserID` 操作收藏，对 targetId 所属租户无任何校验：用户可对**他租户**的 scene/course/question_bank/exam 收藏/取消收藏（favorites 表本身按 user 隔离，不构成写他人数据，但租户语义错乱、产生跨租户脏收藏）；最佳实践：收藏前校验 target 归属租户（或 store 层 JOIN 目标表过滤 tenant）。
- [P2][信息泄露] favorites_handler.go:44,66 — `FavoriteCount(targetType, id)` 为全租户全局计数（favorites 表按 target_id 聚合、无租户维度），响应把其他租户对同一 target 的收藏数泄露给本租户用户；最佳实践：计数限定在 target 所属租户内，或目标归属校验通过后再计。
- [P3][错误处理] favorites_handler.go:44,66 — FavoriteCount 错误被忽略，失败时返回 0 收藏数（静默降级）；可接受但建议记日志。

## backend/internal/handler/favorites_handler_test.go
- [P3][测试] favorites_handler_test.go:23-24 — 使用固定学生 ID `cccccccc-cccc-cccc-cccc-cccccccccc02`，依赖种子数据中存在该用户；若种子变更用例失效，建议测试内自建用户。其余断言（toggle/列表/取消/400/401）有意义。

## backend/internal/handler/file_handler.go
- [P2][安全] file_handler.go:91-133,141-166 — allowedServeExts 白名单包含 `.js`/`.bat`/`.cmd`/`.sh` 等可执行文本类型，而 CSP sandbox 仅作用于 xssRiskyExts（html/htm/svg/xml/xbrl）。同源 `/uploads/*.js` 以 text/javascript 直出（无 Content-Disposition: attachment），若应用内存在任何可控 `<script src="/uploads/..">` 注入点即成存储型 XSS 载体；最佳实践：对非白名单可执行类型统一附加 `Content-Disposition: attachment` 或对代码类扩展也加 sandbox+CSP。
- [P2][逻辑] file_handler.go:225 — `sort.Slice(images, func(i, j int) bool { return i < j })` 是空操作排序（恒真比较索引），多页 PPT 转 png 后图片顺序与页码无关，翻页预览顺序错误；最佳实践：按 `e.Name()` 解析页码排序（如 slide1.png → 1）。
- [P3][错误处理] file_handler.go:226-228 — `respondServerError(w, r, err, "未生成幻灯片")` 中 err 恒为 nil（循环内 err 为局部变量），日志无原始错误；最佳实践：循环内记录读取失败的原始错误。
- [P3][资源] file_handler.go:200-243 — 每次预览都起 libreoffice headless 子进程且无超时/并发上限，可被并发请求拖垮资源；预览为低频操作可容忍，建议至少加超时。
- [P3][越权] file_handler.go:168-172 — Preview 仅校验登录，不校验文件归属/租户；文件名是 uuid 随机串难以枚举，风险低，但上传目录是全租户共享的，严格场景应按用户/租户分目录。

## backend/internal/handler/file_handler_test.go
- 无问题；白名单正向/反向/XSS 头断言均有效。

## backend/internal/handler/graduation_handler.go
- [P2][边界] graduation_handler.go:103-104,146-147 — `time.Parse(time.RFC3339, req.StartDate)` 错误被忽略：非法日期静默变为 0001-01-01T00:00:00Z 落库，后续查询/排序出现"零日期"记录；最佳实践：解析失败返回 400，并校验 startDate < endDate。
- [P2][并发] graduation_handler.go:203-211 — ApplyTopic 先在 handler 层 `AppliedCount >= Capacity` 预检，随后 service 才落库，两次并发申请可同时通过预检导致超容量；属于"核心业务加锁防重复"范畴；最佳实践：容量校验+自增放同一事务（store 层条件 UPDATE 原子判断）。
- [P3][错误处理] graduation_handler.go:224 — `topic, _ = h.Service.GetGraduationTopic(...)` 吞错误，失败返回 "null" 200；最佳实践：查询失败按 500 处理。
- [P3][越权] graduation_handler.go:79,135,178,200 — `topic.TenantID != nil` 才做租户校验，TenantID 为 NULL 的记录跨租户可见/可改；DB 正常不会产生 NULL，风险低。
- [P3][细节] graduation_handler.go:103 — CreateTopic 未校验 Capacity >= 0，负数容量使 ApplyTopic 永远"已满员"。

## backend/internal/handler/granular_course_export_handler.go
- [P3][错误处理] granular_course_export_handler.go:41-43 — 导出失败返回 500 且文案 "填充export data失败" 中英混杂；建议统一文案。
- [P3][细节] granular_course_export_handler.go:67,74 — majors/lesson_batches 查询无租户过滤，仅依赖外键来源（course 已 tenant 过滤），当前安全但依赖隐含前提。
- 无 P0/P1/P2 问题。

## backend/internal/handler/granular_course_import_handler.go
- [P2][副作用] granular_course_import_handler.go:162-169 — overwrite 模式下 `findOrCreateKnowledgePoints`/`findOrCreateResources` 在**权限校验（PermissionSkipped）之前**执行：无权限用户覆盖导入时会先落库创建知识点/资源（写副作用），尽管课程本身被跳过；最佳实践：把权限校验提前到 findOrCreate 之前。
- [P3][错误处理] granular_course_import_handler.go:218-237 — replaceCourseBindings 全部 `_, _ =` 吞错：绑定删除/插入失败无日志无提示，可能留下残留绑定或空绑定（课程存在但知识点/资源为空）；最佳实践：至少记日志或计入 Errors。
- [P3][逻辑] granular_course_import_handler.go:146-154 — preview 模式对已存在课程 `Skipped++` 且只记前 100 条 DuplicateItems，但 Skipped 计数不限量；与 exam_import 的 preview 行为（Duplicates 统计）不一致，属计数口径差异。
- 无 P0/P1 问题（豁免区，DB 直用合规）。

## backend/internal/handler/hybrid_grading_writeback_test.go
- 无问题；回写断言（85 分、状态 evaluated）清晰有效。

## backend/internal/handler/hybrid_module_handler.go
- [P2][契约] hybrid_module_handler.go:61-63 — UpsertModule 的 NodeID 完全由客户端提供，未校验 node 是否属于当前租户（仅 service 侧依赖存储层过滤与否，未见显式归属校验）；若 service 未校验，可跨租户在他人节点下写入模块；最佳实践：Upsert 前校验 node 归属（同 DeleteModule 的 Get 前置校验）。
- [P3][边界] hybrid_module_handler.go:126-133 — BatchSave 对 modules 内条目不校验 ModuleKey/Mode 非空，空键条目可被写入；建议与 UpsertModule 校验一致。

## backend/internal/handler/import_common.go
- [P3][资源] import_common.go:383-396 — parseUploadedExcels 循环解析中途失败时，已打开的 xlsx 未关闭（err 分支直接 return nil），文件句柄泄漏直至 GC；最佳实践：失败路径统一 Close 已打开文件。
- [P3][细节] import_common.go:522 — `$4::resource_type` 传入 Go string，依赖 pgx 枚举文本编码，正常可用但建议显式 domain 类型转换保证一致性。
- 无 P0/P1/P2 问题（豁免区公共导入工具，表名白名单+租户过滤到位）。

## backend/internal/handler/import_common_test.go
- 无问题；resourceTypeByExt 表驱动用例完整，与前端常量映射断言有效。

## backend/internal/handler/import_export_handler.go
- [P2][越权] import_export_handler.go:341-355 — 通用实体覆盖导入（overwrite=true）**无创建者权限校验**（对比 exam/granular 导入的 canOverwriteContent）：任意用户可覆盖更新租户内他人创建的题库/试卷/课程/岗位/场景（仅按 name/code 匹配）；最佳实践：查重时一并取 creator 并按 canOverwriteContent 校验，无权限计入 PermissionSkipped。
- [P2][安全] import_export_handler.go:139-154 — CSV 导出未做公式注入防护：单元格以 `=`、`+`、`-`、`@` 开头时，Excel/WPS 打开后作为公式执行（CSV injection）；数据源是用户可控的名称；最佳实践：导出前对这类前缀加 `'` 前缀或制表符转义。
- [P3][脆弱] import_export_handler.go:344-347 — `strings.Count(meta.updateSQL, "$") == 3` 用占位符计数推断参数个数，SQL 一旦调整即错位；最佳实践：updateSQL 直接定义参数个数（如结构体字段），或统一为 3 参模板。
- [P3][错误处理] import_export_handler.go:147-148 — 导出行 Scan 失败静默 continue，坏行无声丢失；建议累计并在日志提示。
- 无 P0/P1 问题（豁免区）。

## backend/internal/handler/import_rename_test.go
- 无问题；rename/覆盖权限两条路径断言有效（2 条记录、permissionSkipped=1、本人覆盖成功）。

## backend/internal/handler/industry_handler.go
- [P3][分层] industry_handler.go:28 — List 直接走 `executeListQuery(h.Store.Q(), ...)` 绕过 service 层（虽无 SQL、无 DB 直用，未违反硬约束）；与项目"handler→service→store"目标架构不符，建议后续迁移。
- 无 P0/P1/P2 问题；CreateTenantFn 用 verifyRequestTenant 校验客户端 tenantId 与 claims 一致，写入权限 canManagePortal 限定，删除有子行业检查，租户隔离到位。

## backend/internal/handler/job_ability_result_handler.go
- [P1][越权] job_ability_result_handler.go:268-305 — Get 详情接口无学生归属校验：List（第 229-231 行）明确强制学生只看本人，而 Get 仅校验登录+租户，同租户学生凭他人 result id 可读取该学生的能力点明细/历史评级/学号/班级等敏感数据（uuid 不可枚举但可从前端缓存/截图/泄露途径获得）；最佳实践：学生角色强制 `row.UserID == claims.UserID`。
- [P2][错误处理] job_ability_result_handler.go:280,454 — `err == pgx.ErrNoRows` 相等比较而非 errors.Is，service 包装错误时误走 500 而非 404。
- [P3][边界] job_ability_result_handler.go:375-429 — Aggregate 仅校验登录，任何租户内普通角色都可触发 30 分钟的全局汇聚任务（且每次请求起 goroutine 无并发上限，仅按 position 去重）；最佳实践：汇聚入口限管理员/教师角色（若路由层已限定则忽略）。
- [P3][细节] job_ability_result_handler.go:72-84 — storedIndicators 中 details 为空时 computeAbilityIndicators 返回 (0,0)，旧数据无明细行时胜任度显示 0%，语义可接受但建议区分"无数据"与"0 分"。
