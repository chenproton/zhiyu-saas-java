# Handler 层复查报告 handler-02（2026-08-08）

范围：`/tmp/opencode/h2-ab` 所列 21 个文件，逐一完整逐行通读。
基线：2026-08-07 全量审查已修复 handler 层 P0/P1（越权/租户隔离、部分更新兜底、回读错误改 500 等）。
原则：简单优先；安全只排高危；分层规范（handler 不拼 SQL、不持 *pgxpool.Pool、500 统一 respondServerError，import/export/template 冻结区豁免）。

统计：P0=0，P1=6，P2=18，P3=20，合计 44。

---

## backend/internal/handler/common.go

- [P3][健壮性] common.go:331-335 — `jsonMapBytes` 静默吞掉 Marshal 错误并返回 `"{}"`，若调用方将其落库，序列化失败会静默写入空对象；最佳实践：无法编码时至少 slog 记录，或返回 `([]byte, error)` 由调用方决定。
- [P3][契约] common.go:291-295 — `listParamsFromRequest` 对同名多值 query 参数只取 `vs[0]`，其余值静默丢弃；最佳实践：明确文档化"仅支持单值参数"，或在 ExtraFilter 内拼接多值。

## backend/internal/handler/content_actions.go

- [P1][错误吞静默失败] content_actions.go:183-184 — `review` 审核成功后 `entity, _ := c.fetch(...)` 忽略回读错误，对 200 响应返回 `null` 实体（写已生效，客户端却拿到空对象）；与上轮"回读错误改 500"标准不符；最佳实践：回读失败改 `respondServerError`。
- [P2][错误误报] content_actions.go:134-138 — `transitionWithHook` 状态流转已提交成功后回读失败返回 404"不存在"，客户端误判失败并重试，第二次流转会得到 400 invalid transition，产生误导；最佳实践：写成功后回读失败返回 500 并提示"已生效，请刷新"。
- [P2][参数校验] content_actions.go:205-208 — `invite` 直接用 `json.NewDecoder(r.Body)` 解析，未走 `decodeBody`（无 10MB 上限）；且 `UserID` 未校验 UUID 格式，非法值触发 PG 22P02 转 500；最佳实践：复用 `decodeBody`，前置 `uuid.Parse` 校验并 400。
- [P2][数据完整性] content_actions.go:209 + store/content_actions.go:160-176 — `Invite` 未校验被邀请用户存在且属于当前租户，任意（含他租户）用户 ID 可写入 collaborator 数组；列表/详情回显姓名（exams.go:299 的 unnest+JOIN users 无租户过滤）会泄露他租户用户名；最佳实践：邀请前 `Users().Get` 校验租户归属（参照 evaluation_result_handler.go:150-156 的做法）。
- [P3][脆弱判断] content_actions.go:125 — 用 `strings.HasPrefix(err.Error(), "invalid transition")` 判断非法流转，依赖错误文案；最佳实践：定义哨兵错误 `store.ErrInvalidTransition` 后用 `errors.Is`。

## backend/internal/handler/community_handler.go

- [P3][一致性] community_handler.go:129,195 — 用 `err == store.ErrNotFound` 直接比较，而 content_actions/crud 等用 `errors.Is`；一旦 service 层包装错误即变 500；最佳实践：统一 `errors.Is(err, store.ErrNotFound)`。
- [P3][契约] community_handler.go:140-161 — `ListReplies` 无分页（limit/offset），一次返回全部回复且 `Total=len(items)`；最佳实践：与 ListTopics 一致加分页，或文档化全量返回。

## backend/internal/handler/course_clone_handler.go

- [P2][健壮性] course_clone_handler.go:43 — 直接 `json.NewDecoder(r.Body)` 无 `MaxBytesReader` 限制；最佳实践：改用 `decodeBody`。
- [P3][脆弱判断] course_clone_handler.go:43 — `err.Error() != "EOF"` 字符串比较判断空体；最佳实践：`err == io.EOF`。
- [P3][边界] course_clone_handler.go:66 — 克隆成功后 `GetCourse(ctx, newID)` 无租户过滤回读；newID 为当前用户新建故风险低，但契约上不应无过滤读；最佳实践：带 tenantID 回读。

## backend/internal/handler/course_handler.go

- [P2][错误误报 404] course_handler.go:111-115（Get）、360-362（Delete 前置）、461-465（SubmitHomework）、579-583（SubmitNodeHomework）— 对"不存在"以外的任意错误（含 DB 故障）统一返回 404"不存在"，上轮"回读错误改 500"未覆盖；最佳实践：`errors.Is(err, store.ErrNotFound)` 分流 404 / respondServerError。
- [P2][性能] course_handler.go:476-516、594-634 — `ListHomeworkSubmissions`/`ListNodeHomeworkSubmissions` 无分页，一次返回全部提交（含 content/attachmentUrls 大字段）；最佳实践：加分页或限制条数。
- [P3][契约] course_handler.go:22-48,230-238 — `Code` 字段在 Create/Update 中均被忽略（服务端生成/不可改），属死输入；Name/Type/Category 非指针，客户端无法用空串清空且空串静默回退旧值，语义不明；最佳实践：文档化或删除死字段。
- [P3][一致性] course_handler.go:340 — `Difficulty` 用 `*int`，传 0 视为有效（可清空），与 `Name` 空串回退不一致；可接受，建议文档化。

## backend/internal/handler/course_import_handler.go（冻结区，低优先级）

- [P2][事务边界] course_import_handler.go:410,419 — `findOrCreateKnowledgePoints`/`findOrCreateResources` 走 `h.DB`（连接池，事务外自动提交），而绑定插入走事务 `q`；导入整体回滚时，本次新建的知识点/资源行残留为孤儿数据，破坏"覆盖导入整体回滚"的原子性承诺；最佳实践：将 findOrCreate 改为接收 `q` 在事务内执行。
- [P3][一致性] course_import_handler.go:183-184 — `lookupMajorID`/`lookupBatchID` 用 `h.DB` 而非事务 `q`（当前引用表未被事务修改，影响有限）；最佳实践：统一传 `q`。
- [P3][契约] course_import_handler.go:271-274 — PreviewExcel 时 `importNodes` 直接 return，预览不报告节点行问题（找不到课程/父节点等），与实际导入结果可能不一致；最佳实践：预览阶段也解析节点行并回显潜在错误。
- [P3][并发] course_import_handler.go:248 — `generateEntityCode("XT")` 无唯一性保障，并发导入可能撞码落入 Failed（可接受，仅提示）。

## backend/internal/handler/course_export_handler.go（冻结区，低优先级）

- [P3][静默跳过] course_export_handler.go:61-68,112-115 — 课程/节点查询错误（含 DB 故障）一律 `continue` 静默跳过，导出文件静默缺行，用户无感知；最佳实践：累计错误并提示导出不完整。
- [P3][静默截断] course_export_handler.go:213-216 — `rows.Scan` 错误被忽略，名称列表静默截断；最佳实践：记录日志。

## backend/internal/handler/course_node_handler.go

- [P1][部分更新兜底遗漏/数据丢失] course_node_handler.go:231-249 — `Update` 将请求体字段原样写库，nil 字段（ParentID/TeachingGoals/Description/EvalData 等）写 NULL、SortOrder 缺省写 0；同文件族 course_handler.go:240-308、exam_handler.go:166-188 均已做"读现有值兜底"，此处上轮未覆盖，客户端省略字段即静默清空数据；最佳实践：Update 前回读现有节点做 nil/零值兜底（参照 course Update），或明确全量 PUT 契约并在文档声明。
- [P1][租户隔离缺失] course_node_handler.go:164-165,224-229 + store/course_nodes.go:127-136,166-175,199-221,223-240 — Create/Update 的 kpIDs/resIDs/SourceID 均未校验属于当前租户，任意（他租户）知识/资源 UUID 可被写入绑定与 original 节点的 source_id；而 enrich 的 `KnowledgePointsByIDs`/`ResourcesByIDs`/`OriginalSourceKnowledgePoints`/`OriginalSourceResources`（course_nodes.go:199-240,278-334）全部无 tenant 过滤，回显他租户知识点的 name/code/description 与资源的 name/URL（原样可访问文件链接）。UUID 不可枚举使利用门槛高，但数据层零防御，一旦 ID 经导出/日志等渠道泄露即成跨租户读取；最佳实践：Create/Update 前校验 kp/res/source 归属（`WHERE id=$1 AND tenant_id=$2`），enrich 查询补 tenant 过滤。
- [P2][错误误报 404] course_node_handler.go:127-131（Get）、210-213（Update 前置）、274-277（Delete 前置）、159-162（Create 课程校验）— 任意错误返回 404"不存在"；最佳实践：`errors.Is(err, store.ErrNotFound)` 分流。
- [P2][边界] course_node_handler.go:307 — `ReorderNodes` 传入的 nodeIDs 不做归属校验：不属于该课程的节点被 store 的 `WHERE id AND course_id` 静默跳过（无提示），部分列表重排导致 sort_order 出现重复/悬空；最佳实践：校验 nodeIDs 均属于该课程并回读校验数量，失败返回 400。
- [P2][数据完整性] course_node_handler.go:167-170 — Create 的 `ParentID` 未校验父节点属于同一课程/租户，可把节点挂到他课程父节点下造成树错乱；最佳实践：前置校验 parent 归属同课程。
- [P3][契约] course_node_handler.go:231-233 — Update 请求体 `CourseID` 实际不写库（store UPDATE 不含 course_id），但接口接受该字段，契约含糊；最佳实践：文档化或移除。

## backend/internal/handler/course_resource_handler.go

- [P2][错误误报 404] course_resource_handler.go:81-85,146-150,177-181 — `CourseTenantID` 对任意错误（含 DB 故障）返回 404"课程不存在"；最佳实践：ErrNotFound 分流 404，其余 respondServerError。
- [P2][错误吞静默失败] course_resource_handler.go:172-176 — `UnbindResource` 中 `BindTargetID` 错误一律返回 200"成功"（意图为幂等，但无法区分"绑定不存在"与 DB 故障）：DB 异常时客户端误以为已解绑，绑定实际仍在；最佳实践：用 `errors.Is(err, store.ErrNotFound)` 区分，DB 错误返回 500。

## backend/internal/handler/crud.go

- [P1][错误吞静默失败] crud.go:100 — `crudCreate` 回读 `GetByIDFn` 错误被 `item, _` 吞掉，创建成功却响应 201 + 零值实体（客户端拿到 id 为空的空对象，误判失败/重复提交）；crud.go:187 `crudUpdate` 同理响应 200 + 零值；与上轮"回读错误改 500"标准不符；最佳实践：回读失败 respondServerError。
- [P2][错误误报 404] crud.go:121-125（crudGet）、155-159（crudUpdate 前置）、214-218（crudDelete 前置）— `GetByIDFn` 任意错误返回 404；最佳实践：ErrNotFound 分流，其余 500。
- [P3][契约] crud.go:60-67 — `crudCheckPermit` 未登录与无权限统一 403，与 course_resource_handler 的 401"未授权"口径不一致；最佳实践：统一鉴权中间件口径。

## backend/internal/handler/evaluation_handler_test.go

- [P3][测试脆弱] evaluation_handler_test.go:811-812 — 使用硬编码 UUID 作为 taskId/sceneId 提交评价结果，测试恰好依赖"handler 不校验任务存在/租户归属"这一行为（见 evaluation_result_handler P2）；若补上校验该测试将失败，应显式断言或构造真实任务。其余用例（CRUD/窗口/清理/租户）有意义。

## backend/internal/handler/evaluation_import_test.go

- [P3][断言缺失] evaluation_import_test.go:43,49,69,89 — `QueryRow(...).Scan` 错误未检查，COUNT 断言依赖未校验的 0 值（查库失败会假通过）；最佳实践：`err != nil` 即 t.Fatalf。

## backend/internal/handler/evaluation_method_handler.go

- [P2][错误误报 404] evaluation_method_handler.go:70-74 — `TenantID` 查询任意错误返回 404"测评方式不存在"；最佳实践：ErrNotFound 分流。
- [P3][冗余] evaluation_method_handler.go:70-81 — `TenantID` + `GetEvaluationMethod` 两次重复读同一行；最佳实践：一次读取复用。

## backend/internal/handler/evaluation_result_handler.go

- [P1][错误吞静默失败] evaluation_result_handler.go:218 — `Grade` 评分已生效后回读错误被 `res, _` 吞掉，200 返回评分前的旧实体（status=pending、无分数），客户端误以为未评分；最佳实践：回读失败 respondServerError。
- [P2][数据完整性] evaluation_result_handler.go:158-171 — `Submit` 未校验 taskId/sceneId 属于当前租户，非学生角色也未校验 evaluateeId 属于当前租户；可写入引用他租户任务/用户的脏结果行（当前列表无 join 不泄露，但一旦列表 join 展示任务信息即构成跨租户信息暴露）；最佳实践：提交前校验 task/scene/evaluatee 归属（参照 evaluator 校验 150-156）。
- [P2][参数校验] evaluation_result_handler.go:183-220,222-258 — `Grade`/`BatchGrade` 均未校验 score 上下界，可写入负数或 >100 的分数（course_handler.go:540 的 0~100 校验在此缺失）；最佳实践：与课程作业批改一致加 0~100 校验。
- [P2][性能] evaluation_result_handler.go:234-250 — `BatchGrade` 对每个 item 逐条 `GetEvaluationResult`（N+1），批量大时放大查询；最佳实践：批量 IN 查询一次取回并校验。
- [P3][边界] evaluation_result_handler.go:126-128 — `MaxScore == 0` 被静默改写为 100，合法 0 分语义被篡改；最佳实践：nil 判定（客户端不传才默认）。
- [P2][错误误报 404] evaluation_result_handler.go:86-90 — `Get` 任意错误返回 404；最佳实践：ErrNotFound 分流。

## backend/internal/handler/exam_export_handler.go（冻结区，低优先级）

- [P3][静默跳过] exam_export_handler.go:59-62,92-95 — 查询/扫描错误静默跳过行，导出文件静默缺数据；最佳实践：累计错误提示导出不完整。

## backend/internal/handler/exam_handler.go

- [P2][错误吞静默失败] exam_handler.go:292（AddQuestion）、317（RemoveQuestion）、362（UpdateQuestionScore）、402（BulkUpdateScores）— 写操作成功后回读错误被 `exam, _` 吞掉，200 返回变更前旧实体；最佳实践：回读失败 respondServerError。
- [P2][错误误报 404] exam_handler.go:67-71（Get）、153-157（Update）、230-234（Delete）— 任意错误返回 404"考试不存在"；最佳实践：ErrNotFound 分流。
- [P3][边界] exam_handler.go:72-75 等 — `exam.TenantID != nil` 才做租户校验，TenantID 为 NULL（数据异常）时跳过校验；可接受，建议在 store 层杜绝 NULL 写入。
- [P3][契约] exam_handler.go:169-171 — Description 空串回退旧值，无法被清空（与 Course 相同模式）；最佳实践：文档化。

## backend/internal/handler/citation_stats_test.go

- [P3][测试脆弱] citation_stats_test.go:104-109,110-115,118-123 — 直接 INSERT system_course_nodes/node_knowledge_point_bindings/question_banks 且省略 tenant_id（依赖列可空），若 schema 收紧为 NOT NULL 测试立即崩溃；最佳实践：显式填 tenant_id 或断言列可空。

## backend/internal/handler/citation_stats_ability_cert_test.go

- [P3][断言缺失] citation_stats_ability_cert_test.go:376,395 — `QueryRow(...).Scan` 错误未检查即断言（查库失败会假通过）；最佳实践：检查 err。

## backend/internal/handler/community_handler_test.go

无问题（含租户隔离、阅读数、回复树断言，用例有意义）。

## backend/internal/handler/course_node_usage_window_test.go

无问题（直接验证服务层生成/同步逻辑，断言充分）。

## backend/internal/handler/edge_case_test.go

- [P3][断言缺失] edge_case_test.go:62-63,96-97,108-109 — `testhelper.Unmarshal` 错误被忽略，若解码失败拿到零值会误导后续断言；最佳实践：检查 err。
