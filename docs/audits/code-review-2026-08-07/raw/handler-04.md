# handler 审查（第 4 批，20 个文件）— 2026-08-07

审查范围：job_ability_result_handler_test.go / job_advanced_test.go / job_banner_handler.go / job_handler_test.go / knowledge_point_handler.go / landing_handler.go / landing_handler_test.go / learn_road_handler.go / lesson_batch_test.go / lesson_behavior_handler.go / lesson_handler_test.go / log_handler.go / major_handler.go / micro_cert_handler.go / node_evaluation_result_handler.go / node_homework_handler.go / node_quiz_handler.go / node_resource_handler.go / on_site_question_library_handler.go / on_site_question_library_handler_test.go

已核对框架：crud.go（crudGet/crudCreate/crudUpdate/crudDelete 流程）、common.go（listParamsFromRequest/requireTenant/verifyTenantOwnership/coalesceStringSlice）、store（micro_cert.go/resource_bindings.go/learn_roads.go）、router（routes.go/routes_evaluation.go 路由门禁）。

结论：无 P0；1 个 P1；10 个 P2；若干 P3。

---

## backend/internal/handler/job_ability_result_handler_test.go

- [P2][逻辑] job_ability_result_handler_test.go:91 — `wantComp := ((85-70)/70*0.6 + 0) * 100` 中 `(85-70)/70` 为整数除法（15/70=0），wantComp 恒为 0，与注释"存量行胜任度应回退实时计算"矛盾，且与 99 行 V2 公式（浮点 `(100+(4.5-3)*50)*0.6`）不一致；若实现按浮点计算（≈12.857）该断言必然失败，若实现同样截断则断言毫无意义。最佳实践：改为 `((85.0-70)/70*0.6 + 0) * 100`，期望值应为 12.857。

## backend/internal/handler/job_advanced_test.go

- 无问题。

## backend/internal/handler/job_banner_handler.go

- [P2][字段清空] job_banner_handler.go:18-24,83-91 — 请求体 `IsEnabled bool` 非指针（LinkURL 用 `*string` 可区分"未传"），crudUpdate 全量覆盖时前端未传 `isEnabled` 会隐式清零为 false，导致更新任意字段（如仅改标题）后轮播图被禁用。最佳实践：`IsEnabled *bool`，UpdateFn 中 nil 时回填现有值（参照 learn_road_handler.go 的部分更新回填模式）。
- [P3][错误处理] job_banner_handler.go:37-42,96-102 — Create 成功后回读 `h.Service.GetBanner` 错误在 crud 框架（crud.go:100 `item, _ := cfg.GetByIDFn(...)`）被吞，回读失败仍返回 201 空结构体（静默失败）。最佳实践：框架层回读失败应记日志并返回 500。

## backend/internal/handler/job_handler_test.go

- [P2][测试必红] job_handler_test.go:1054-1070 — TestLearnRoad_CRUD 的 Create 请求 `"positionIds": ["pos-1"]` 非合法 UUID，store 层 `normalizePositionIDs`（store/learn_roads.go:82-91）会丢弃非法 ID 后落库 `position_ids=[]`，随后断言 `len(r.PositionIDs) != 1`（1068 行）必然失败（Update 的 `["pos-1","pos-2"]` 同样被过滤）。最佳实践：测试数据改用 `uuid.NewString()`，或断言空列表。

## backend/internal/handler/knowledge_point_handler.go

- [P3][错误处理] knowledge_point_handler.go:71-86 — Create 回读错误经 crud 框架（crud.go:100）吞掉，回读失败返回 201 空对象。最佳实践：框架层回读失败应返回 500。

## backend/internal/handler/landing_handler.go

- [P3][契约] landing_handler.go:54-55 — `Type: "在线测评"` 硬编码、`TargetAudience: ""` 恒为空串占位；若前端落地页展示这些字段，输出无实际语义。最佳实践：从 service 返回真实类型/受众字段或删除多余字段。

## backend/internal/handler/landing_handler_test.go

- 无问题。

## backend/internal/handler/learn_road_handler.go

- [P3][错误处理] learn_road_handler.go:73-81 — Create 回读错误经 crud 框架（crud.go:100）吞掉，回读失败返回 201 空对象。最佳实践：框架层回读失败应返回 500。

## backend/internal/handler/lesson_batch_test.go

- 无问题。

## backend/internal/handler/lesson_behavior_handler.go

- [P2][契约/顺序] lesson_behavior_handler.go:176-178,257-259,309-315,317-333 — SignInDaily/AttendanceRateData/StudentDetails 均由 map（dailyMap/rateMap/studentMap）遍历拼装，Go map 迭代顺序随机：无日期排序、无学生排序，前端趋势图/表格每次刷新顺序不定（与展示契约不一致）。最佳实践：按日期/名字排序后输出。
- [P3][逻辑] lesson_behavior_handler.go:358-366 — orderStudentsByRush 冒泡排序仅比较 rushCorrect，并列时顺序依赖 map 随机性，且未比较 avgTime 决胜；抢答榜并列名次不稳定。最佳实践：增加 AvgTime 次级排序。
- [P3][风格] lesson_behavior_handler.go:376-388 — `intPtr`/`countIntPtr` 命名反直觉（countIntPtr 语义是"非 nil 记 1 次"），且与 239-240 行配对使用易误读。最佳实践：改名 `ptrIntOrZero`/`ptrCount` 或直接内联判空。
- [P3][逻辑] lesson_behavior_handler.go:261-273 — 随堂测验 passRate 阈值 60 硬编码；263 行 `if quizCount > 0` 与 261 行外层判空重复嵌套。
- [P3][校验] lesson_behavior_handler.go:82,156-160 — Create 未校验 attendance 枚举值（present/late/absent 之外的值会被统计进 Total 但不算任何分类，拉低出勤率分母）。最佳实践：400 校验合法枚举。

## backend/internal/handler/lesson_handler_test.go

- [P3][测试无意义] lesson_handler_test.go:579-581 — TestCourseBatch_CRUD 为空函数体（仅有注释），不执行任何断言。最佳实践：删除或补充真实用例（lesson_batch_test.go 已有覆盖）。

## backend/internal/handler/log_handler.go

- [P3][风格] log_handler.go:16-33,35-52 — LoginLogs/OperationLogs 无 `middleware.CurrentUser(r) == nil` 预检（同批其他 handler 均有），匿名请求会落入"缺少租户信息"403 而非"权限不足"403；行为安全但错误文案不准确、风格不一致。最佳实践：与其余 handler 一致先做登录预检。

## backend/internal/handler/major_handler.go

- [P3][防御深度] major_handler.go:78-91 — UpdateFn/DeleteFn/GetByIDFn 调用 `h.Store.Update/Delete/GetByID` 均无租户过滤（SQL 无 tenant 条件），当前安全性完全依赖 crud 框架前置的 GetByID+verifyTenantOwnership（crud.go:160,219）校验；若有人绕过框架直接调用 store 或未来调整框架顺序即越权。最佳实践：store 层 Update/Delete 增加 tenant_id 条件（参照 learn_roads.go 覆盖式实现）。
- [P3][错误处理] major_handler.go:69-77 — Create 回读错误经 crud 框架（crud.go:100）吞掉，回读失败返回 201 空对象。

## backend/internal/handler/micro_cert_handler.go

- [P1][越权/租户隔离缺失] micro_cert_handler.go:215-245 — IssueCerts 仅校验模板归属，未校验 `req.UserIDs` 中每个用户属于当前租户；store.IssueCerts（store/micro_cert.go:118-139）同样无过滤，直接以本租户 tenant_id 为任意 user_id 插入 cert_issuance_records。业务用户（教师/企业导师，见 routes.go businessUser 组）可对已知他租户 user_id 颁发本租户证书，发放历史 join 用户后可能展示/关联他租户学生信息；对不存在的 user_id 则触发 FK 错误 500。最佳实践：store 内加 `SELECT ... FROM users WHERE id = ANY($1) AND tenant_id = $2` 数量校验，或 handler 逐个 Users().Get 校验后剔除。
- [P2][错误吞掉] micro_cert_handler.go:136,182 — CreateTemplate/UpdateTemplate 回读 `template, _ := h.Store.GetTemplate(...)` 忽略错误，插入/更新成功后回读失败仍返回 201/200 空结构体（静默失败）。最佳实践：错误时 respondServerError 并记录日志。
- [P2][字段清空] micro_cert_handler.go:162-180 — UpdateTemplate 的 `CertTypeID string` 非指针，请求未传 certTypeId 时 `normalizeCertTypeID("")=""` 直接覆盖既有 cert_type_id 为空（同文件 coverImage 用 `*string` 可区分未传，语义不一致）；前端若部分更新模板即清空证书类型。最佳实践：CertTypeID 改 `*string`，nil 时回填现有值。
- [P2][数据丢失] micro_cert_handler.go:186-213 + store/micro_cert.go:110-116 — DeleteTemplate 连带 `DELETE FROM cert_issuance_records WHERE template_id = $1` 永久删除全部证书发放记录（历史凭证），handler 无任何提示/确认。最佳实践：删除模板时提示将级联删除发放记录，或软删除/保留记录。
- [P3][碰撞风险] micro_cert_handler.go:65-73 — normalizeCertTypeID 对非 UUID 字符串用 SHA1(名字空间+字符串) 生成伪 UUID，不含租户前缀：不同租户传入相同 certTypeId 字符串会得到相同 UUID，跨租户引用语义混淆。最佳实践：租户+字符串做命名空间，或仅接受合法 UUID。

## backend/internal/handler/node_evaluation_result_handler.go

- [P2][错误吞掉] node_evaluation_result_handler.go:42-46 — Get 对 Service.GetByID 的任何错误（含 DB 故障）统一 404"评价结果不存在"，真实故障被伪装成资源不存在，排障困难。最佳实践：`errors.Is(err, store.ErrNotFound)` 才返回 404，其余 respondServerError。
- [P2][契约] node_evaluation_result_handler.go:104-107 — Grade 对 ErrNotFound 返回 409 Conflict"已评分或不存在"，将"已评分"(409) 与"不存在"(404) 合并且状态码语义不当，前端无法区分重试路径。最佳实践：ErrNotFound 区分 NotFound/已评分两种响应。
- [P3][边界] node_evaluation_result_handler.go:173-175 — Submit 中 `MaxScore == 0` 一律默认 100，若存在 0 分制测评方法（maxScore 合法为 0）则被篡改。最佳实践：用 `*float64` 区分未传与 0。

## backend/internal/handler/node_homework_handler.go

- 无问题。

## backend/internal/handler/node_quiz_handler.go

- [P3][边界] node_quiz_handler.go:169-174 — ListQuestions 默认 limit=500，与全局 MaxPageSize=200（common.go:125）不一致；大量题目场景下单次拉取 500 条。最佳实践：统一走 parsePageLimit 默认 200。

## backend/internal/handler/node_resource_handler.go

- [P2][越权边界] node_resource_handler.go:82-131,133-158 — Create/BindResource 未校验 `nodeID` 对应节点是否存在及归属租户，store.CreateResource/Bind（store/resource_bindings.go:108-147）直接 INSERT 绑定行（node_id 无校验）：可对任意/不存在节点创建孤儿绑定行、可向其他租户节点绑定本租户资源（列表侧 store.List 以 rl.tenant_id 过滤资源本身，泄露受限，但 Unbind 的节点租户校验形同虚设）。最佳实践：创建/绑定时校验节点存在且属于当前租户（参照 UnbindResource 的 NodeCourseID+CourseTenantID 链路）。
- [P3][契约] node_resource_handler.go:50-57,66-67 — ListResources 未传 nodeId 时 bind=nil 列出全部租户资源且响应 NodeID 恒为空串，前端按节点过滤与全量列表语义混用。最佳实践：nodeId 必填或响应区分列表类型。

## backend/internal/handler/on_site_question_library_handler.go

- [P2][功能受限] on_site_question_library_handler.go:102-145 — Update 部分更新语义下无法清空字段：`Answer`/`QuestionText` 传 null 保持旧值；`KnowledgePointIDs`/`Tags` 因 coalesceStringSlice（common.go:31-36）+ `len(kps)==0` 回填逻辑，显式传 `[]` 也会回填旧值，前端"清空知识点/标签"操作静默失效。最佳实践：用 `*[]string` 区分未传与显式空数组。
- [P3][重复代码] on_site_question_library_handler.go:157-174 — Get 手工复刻 crudGet 流程（permit→GetByIDFn→ownership→响应），与框架 crudGet 重复且漏掉 AfterLoad；可改用 `cfg` 的 Get 路径或直接调 crudGet。
- [P3][错误处理] on_site_question_library_handler.go:81-101 — Create 回读错误经 crud 框架（crud.go:100）吞掉，回读失败返回 201 空对象。

## backend/internal/handler/on_site_question_library_handler_test.go

- 无问题。

---

## 汇总

- 审查文件数：20（其中测试 8、handler 12）
- 总问题数：23（P0:0，P1:1，P2:10，P3:12）
- P1：
  - micro_cert_handler.go:215-245 IssueCerts 未校验 userIds 租户归属，可对他租户/不存在用户颁发证书
- P2 摘要：
  1. job_ability_result_handler_test.go:91 整数除法致断言恒 0
  2. job_banner_handler.go:23,83-91 isEnabled 非指针，部分更新被清零
  3. job_handler_test.go:1054-1068 学习路径测试用非法 UUID，断言必红
  4. lesson_behavior_handler.go:257-333 map 遍历输出顺序随机，前端契约不稳
  5. micro_cert_handler.go:136,182 回读错误吞掉返回空结构体
  6. micro_cert_handler.go:162-180 更新未传 certTypeId 清空字段
  7. micro_cert_handler.go:186-213 删除模板级联删除全部发放记录
  8. node_evaluation_result_handler.go:42-46 Get 任意错误伪装 404
  9. node_evaluation_result_handler.go:104-107 Grade 不存在返回 409
  10. node_resource_handler.go:82-158 创建/绑定不校验节点存在与归属
  11. on_site_question_library_handler.go:102-145 无法清空答案/知识点/标签
