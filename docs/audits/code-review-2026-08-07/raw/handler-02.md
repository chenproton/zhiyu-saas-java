# Code Review — handler 层（第 2 批：aa–ab）

审查范围：backend/internal/handler 下 21 个文件（含 8 个测试文件）。
审查方式：全量逐行通读，交叉核对 service/store 层实现与数据库 schema。
约定：P0=运行时必错；P1=越权/数据泄露/数据丢失/明显逻辑 bug；P2=边界/错误处理/性能/契约；P3=死代码/风格/测试瑕疵。
冻结区豁免：course_import/export、exam_export handler 为豁免冻结区，其 SQL 直写不按分层规范判定，但其余问题照记。

---

## backend/internal/handler/common.go
- [P3][风格] common.go:97-109 — respondServerError 将 err.Error() 原样写入 slog 日志；若 store 层错误信息携带用户输入（如题目内容）存在敏感信息进日志的风险。最佳实践：仅记录错误类型与截断后的错误信息。
- [P3][边界] common.go:286-314 — listParamsFromRequest 对 limit/offset 解析失败静默忽略（回退默认值），非法值如 "limit=abc" 不报 400；与 parsePageLimit 行为不一致。最佳实践：解析失败时写入 400。

## backend/internal/handler/community_handler.go
- [P1][越权] community_handler.go:140-157 — ListReplies 未传 tenantID（对照 GetTopic:127 / CreateReply:189 均传租户），service.CommunityService.ListReplies（service/community.go:98-99）与 store.ListReplies 仅按 topicID 查询、不校验 topic 归属租户；任何租户用户凭 topicID 可读取其他租户帖子的回复列表（越权读，且 TestCommunity_TenantIsolation 仅覆盖 GetTopic 未覆盖回复列表）。最佳实践：ListReplies 增加 tenantID 参数，store 层先按 (topicID, tenantID) 校验话题归属或直接联表过滤。
- [P3][边界] community_handler.go:156 — ListReplies 对不存在的话题返回 200 空列表（未校验话题存在），与 GetTopic 404 语义不一致。最佳实践：查询前校验话题存在性。

## backend/internal/handler/community_handler_test.go
- [P3][测试] community_handler_test.go:16,27-28,99,129-130,214,231,239 — defer env.DB.Exec 清理错误全部忽略（`defer env.DB.Exec(...)` 无返回值检查）。最佳实践：清理失败时 t.Errorf 提示。

## backend/internal/handler/content_actions.go
- [P2][错误处理] content_actions.go:134-139 — transition 成功写入后回读 fetch 失败即响应 404"不存在"：状态已变更但前端收到"不存在"，且把 DB 故障伪装成资源缺失。最佳实践：fetch 错误区分 ErrNotFound 与内部错误，内部错误用 respondServerError。
- [P2][错误处理] content_actions.go:183-184 — review 回读 fetch 错误被丢弃（`entity, _ :=`），失败时返回 200 + "null" 响应体。最佳实践：回读失败记录并返回 500（respondServerError）。
- [P3][风格] content_actions.go:125 — 状态流转错误判定混用类型断言 `err.(interface{ Transition() })` 与错误字符串前缀 `strings.HasPrefix(err.Error(), "invalid transition")`，字符串匹配脆弱。最佳实践：统一定义 sentinel 错误类型。
- [P3][边界] content_actions.go:205 — invite 用裸 `json.NewDecoder(r.Body)` 解码，绕过 decodeBody 的 10MB MaxBytesReader 上限（请求体无大小限制）。最佳实践：改用 decodeBody。

## backend/internal/handler/citation_stats_ability_cert_test.go
- [P3][测试] citation_stats_ability_cert_test.go:66,155,247,304 — t.Cleanup 中 env.DB.Exec 清理错误忽略，失败时遗留脏数据。最佳实践：清理错误经 t.Errorf 报告。
- [P3][测试] citation_stats_ability_cert_test.go:355-387 — TestAbilityAndCertificateUncitedDelete 只断言 DELETE 返回 200，未验证数据库行确实被删除（若删除是软删/静默失败该测试仍通过）。最佳实践：删除后断言对应行不存在。
- [P3][测试] citation_stats_ability_cert_test.go:29-37 — cleanup 中 certification_rules/position_responsibilities 仅按"created_by 岗位"间接清理；若历史数据存在 created_by 非操作员的同名岗位，规则清理不完整，统计断言可能受污染。最佳实践：按 tenant_id 全量清理。

## backend/internal/handler/citation_stats_test.go
- [P3][测试] citation_stats_test.go:84,179 — t.Cleanup 清理错误忽略。最佳实践：清理错误经 t.Errorf 报告。

## backend/internal/handler/course_clone_handler.go
- [P3][风格] course_clone_handler.go:43 — 空体判断用 `err.Error() != "EOF"` 字符串比较，依赖 encoding/json 错误文案，脆弱。最佳实践：`errors.Is(err, io.EOF)`。
## backend/internal/handler/course_export_handler.go
- [P2][性能] course_export_handler.go:171-189 — lookupCourseAbilityPointNames 对每个能力点 ID 单独执行一条 QueryRow（N+1）；叠加 fillCoursesData 每课程 2 条额外查询（majors/lesson_batches:72-78）+ 每节点 3 条查询（148-150），大规模导出（数百课程/节点）时产生数百至数千次往返。最佳实践：能力点名称批量 `WHERE id = ANY($1::uuid[])` 一次查询。
- [P3][错误处理] course_export_handler.go:41 — 500 文案"填充export data失败"中英混杂；fillCoursesData 错误未记录原始错误（未用 respondServerError）。最佳实践：改 respondServerError 统一记录。
- [P3][错误处理] course_export_handler.go:72,77,183 — QueryRow Scan 错误全部忽略（静默得空名）；导出场景可容忍，但建议至少 Warn 日志。

## backend/internal/handler/course_handler.go
- [P1][越权] course_handler.go:417-424 — Assessments 的归属校验形同虚设：fetchCourse 无租户过滤取出课程后，调用 `verifyTenantOwnership(w, r, *claims.TenantID)`，传入的是**调用者自身租户**，与自己比对恒为 true（应为取回课程的 tenant_id 与之比对）。任何租户用户凭 courseID 可绕过归属校验探测任意课程存在性（404/200 差异），并获得对该课程考试安排/作业的 200 空结果响应。最佳实践：将 fetchCourse 返回实体的租户 ID 传入 verifyTenantOwnership，或改用 GetCourseDetailInTenant(id, tenantID) 一步完成存在性与归属校验。
- [P2][错误处理] course_handler.go:465-469 — SubmitHomework：`exists, err := ...; if err != nil || !exists` 将 DB 内部错误与"不存在"同等对待，DB 故障静默返回 404"作业不存在"。最佳实践：err != nil 时走 respondServerError。
- [P2][错误处理] course_handler.go:583-587 — SubmitNodeHomework 同上（err != nil || !exists → 404）。最佳实践：区分 DB 错误与不存在。
- [P2][契约] course_handler.go:498-520,616-637 — ListHomeworkSubmissions/ListNodeHomeworkSubmissions 响应仅含 items 无 total 且 items 为 map[string]any 手拼，缺少 total 字段与 ListResponse 通用结构不一致。最佳实践：与前端确认契约后统一为 ListResponse。
- [P3][边界] course_handler.go:130-133,230-238 — Create/Update 对 req.Type/Category 不做枚举校验，任意字符串入库；Create 中 req.Code 被忽略（服务端生成），字段语义需与前端对齐。

## backend/internal/handler/course_import_handler.go
- [P3][死代码] course_import_handler.go:554-562 — generateSystemCourseCode 定义后无任何调用（实际使用 generateEntityCode("XT")）。最佳实践：删除。
- [P3][死代码] course_import_handler.go:441-452 — toStringSlice 定义后无任何调用。最佳实践：删除。
- [P3][错误处理] course_import_handler.go:384-405 — 节点知识点/资源绑定 INSERT 与 knowledge_point_ids 回写 UPDATE 错误全部 `_, _ =` 静默丢弃，部分绑定失败时数据不一致无感知。最佳实践：至少记录错误日志。
- [P2][数据丢失] course_import_handler.go:186-204 — overwrite 模式下对已存在课程 UPDATE 后立即 clearCourseNodes 删除全部节点/测评（201-202行），若后续同名课程节点导入因 Excel 错误中断，原课程节点数据已不可恢复（非事务）。最佳实践：overwrite 导入整体放入事务，失败回滚。

## backend/internal/handler/course_node_handler.go
- [P2][错误处理] course_node_handler.go:127-131,210-213,274-277 — Get/Update/Delete 对 GetNodeBase 的**任何**错误（含 DB 故障）统一响应 404"课程节点不存在"，内部错误被吞并误导。最佳实践：ErrNotFound → 404，其余 respondServerError。
- [P2][性能] course_node_handler.go:315-454 — enrichCourseNodes 每次 List/Get 对知识/资源/测验/作业/继承源做 5 组批量查询，正确避免 N+1，但 List 场景无分页（ListConfig NoPagination），全量节点逐批富化，数据量大时响应延迟。最佳实践：评估前端列表是否需要全量节点，必要时分页。属于可接受权衡，仅提示。

## backend/internal/handler/course_node_usage_window_test.go
- [P3][测试] course_node_usage_window_test.go:29,36,57,108 — defer env.DB.Exec 清理错误忽略。最佳实践：清理失败 t.Errorf。

## backend/internal/handler/course_resource_handler.go
- [P2][错误处理] course_resource_handler.go:172-176 — UnbindResource：BindTargetID 查询失败（含 DB 内部错误与绑定不存在）时**响应 200 OK**，错误被吞、解绑静默"成功"。最佳实践：ErrNotFound 时也明确语义（如幂等 200 可接受但需区分 DB 错误），DB 错误走 respondServerError。
- [P2][契约] course_resource_handler.go:97-124 — Create 响应手拼 domain.NodeResource 且仅含部分字段（无 total 等），与 ListResources 的 ListResponse 结构不一致。最佳实践：统一响应结构。

## backend/internal/handler/crud.go
- [P2][错误处理] crud.go:100 — crudCreate 回读 `item, _ := cfg.GetByIDFn(...)` 错误丢弃：创建成功但回读失败时返回 201 + 零值对象（前端拿到空壳数据）。最佳实践：回读失败走 respondServerError。
- [P2][错误处理] crud.go:187 — crudUpdate 回读错误同样丢弃（`item, _ :=`），返回 200 + 零值对象。最佳实践：同上。
- [P2][错误处理] crud.go:121-125,155-159,214-218 — crudGet/crudUpdate/crudDelete 对 GetByIDFn 的任何错误（含 DB 故障）统一 404 NotFoundMsg，内部错误被吞。最佳实践：区分 ErrNotFound 与内部错误。

## backend/internal/handler/edge_case_test.go
- [P3][测试] edge_case_test.go:51,63,97,109,163 — defer env.DB.Exec 清理错误忽略。最佳实践：清理失败 t.Errorf。

## backend/internal/handler/evaluation_handler_test.go
- [P3][测试] evaluation_handler_test.go:44,98,116,225,242,256,270,377,401,415,426,445,531,545,556,574,595,615,632,695,698,700,719,722,725,745,755,756,877,890,932,942,954,973,997,1013,1044,1074,1099,1144,1169,1196,1251 — 大量 defer 清理与 QueryRow Scan 错误忽略（清理失败遗留脏数据、断言前提不可靠）。最佳实践：清理统一封装为可报错 helper。

## backend/internal/handler/evaluation_import_test.go
- [P3][测试] evaluation_import_test.go:43,49,69,89 — QueryRow Scan 错误忽略（断言基于可能为空的扫描结果）。最佳实践：Scan 失败时 t.Fatalf。
- [P3][测试] evaluation_import_test.go:117 — fw.Write(fileData) 错误忽略。最佳实践：检查写入错误。

## backend/internal/handler/evaluation_method_handler.go
- 无问题（Toggle 具备租户归属校验；列表租户过滤齐全）。

## backend/internal/handler/evaluation_result_handler.go
- [P2][错误处理] evaluation_result_handler.go:214 — Grade 评分成功后回读 `res, _ = h.Service.GetEvaluationResult(...)` 错误丢弃：DB 故障时返回 200 + "null" 响应体（此前 Get 已返回过完整实体，回读失败会清空响应）。最佳实践：回读失败 respondServerError。
- [P2][性能] evaluation_result_handler.go:230-246 — BatchGrade 对每个 item 串行 GetEvaluationResult + 租户校验（N+1 到数据库），大批量评分时延迟累积。最佳实践：批量查询或保留（评分批次通常小），仅提示。
- [P2][契约] evaluation_result_handler.go:66-70 — List 中学生强制 ownOnly 覆盖其余过滤参数（忽略 page/类型等），前端学生端若传其他参数静默失效。最佳实践：与前端确认契约（当前实现有注释说明，属设计取舍，仅提示）。

## backend/internal/handler/exam_export_handler.go
- [P3][错误处理] exam_export_handler.go:96-111 — 题目导出循环内 Scan 错误仅 Warn 后继续、循环结束未检查 rows.Err()，部分题目静默缺失。最佳实践：循环后检查 rows.Err()。
- [P3][错误处理] exam_export_handler.go:40 — 500 文案"填充export data失败"中英混杂且未记录原始错误。最佳实践：改用 respondServerError。

## backend/internal/handler/exam_handler.go
- [P2][边界] exam_handler.go:206 vs 129 — Update 传入的 BatchID 未像 Create（emptyStrToNil:129）做空串归一化：客户端传 `"batchId": ""` 时 batch_id 写入空串到 uuid 列触发 22P02 → 500；且由于 178-180 行 nil 才回退 existing，空串既不能清空 batchId 也不报 400。最佳实践：Update 同样 emptyStrToNil，或校验后 400。
- [P2][错误处理] exam_handler.go:292,317,362,402 — AddQuestion/RemoveQuestion/UpdateQuestionScore/BulkUpdateScores 写操作成功后 `exam, _ = h.Service.GetExam(...)` 回读错误丢弃：DB 故障返回 200 + "null" 响应体。最佳实践：回读失败 respondServerError。
- [P2][错误处理] exam_handler.go:67-71,153-157,259-263,305-309,344-348,390-394 — GetExam 的任何错误（含 DB 故障）统一 404"考试不存在"，内部错误被吞。最佳实践：区分 ErrNotFound 与内部错误。
- [P3][边界] exam_handler.go:166-180 — Update 合并语义：Name/Description/CoverImage 为空串均回退 existing，前端无法清空 coverImage/description；非空与"清空"两种意图无法区分。最佳实践：与前端确认清空语义（使用指针 + omitempty 或显式 clear 标记）。

## 汇总
- 审查文件数：21
- 总问题数：47
- P0：0
- P1：2
  - community_handler.go:140-157 — ListReplies 无租户过滤，跨租户读取帖子回复（越权读）
  - course_handler.go:417-424 — Assessments 租户归属校验传参错误（与自身租户比对恒真），校验失效 + 跨租户存在性探测
- P2：20；P3：25
