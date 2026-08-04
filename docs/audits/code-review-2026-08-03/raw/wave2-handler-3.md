# handler 批次3 审查（24文件，5394行）

## P1
```
backend/internal/handler/on_site_question_library_handler.go:28-40 | P1 | 安全（答案下发/越权） | 题库 item 的 answer 字段随 List/Get 直接下发；且 GET /library/on-site-questions 被同时注册在 jobViewer（含学生，routes.go:130-131）与 businessUser（routes_library.go:12-13）两组，后注册者静默覆盖前者（chi setEndpoint 覆盖语义），学生是否可读完全取决于注册顺序，一旦调整学生即可读到题目答案 | 只读接口裁剪掉 answer/score 等敏感字段，或移除重复路由注册并明确角色门禁
backend/internal/handler/on_site_question_library_handler.go:30 | P1 | 安全（未鉴权/答案） | List 在无任何 claims 校验下执行，仅依赖 tenant-scoped 兜底（executeListQuery 缺租户时 403）；配合上面重复注册，未登录+jobViewer 顺序优先时可绕过读取 | 在入口统一校验登录态并确认唯一路由归属
backend/internal/handler/position_certificate_handler.go:51-112 | P1 | 越权（tenant 隔离遗漏） | crudConfig 未设置 CheckOwnership/GetOwnership，Get/Update/Delete 无租户归属校验；store 层 Get/Update/Delete 的 WHERE 也仅按 id 过滤（store/position_certificates.go:69-125），List(26-47) 仅按 careerPositionId 过滤。任何业务角色可跨租户读/改/删他租户岗位证书。文件注释声明"维持原行为"，但属明确越权 | Get/Update/Delete 前按证书所属岗位的 tenant 校验，List 带 tenant 过滤
backend/internal/handler/position_export_handler.go:60-64,72-75,78-91,94-107,161-163 | P1 | 越权（跨租户导出） | fillPositionsData 对 career_positions/majors/证书的查询均无 tenant_id 过滤（仅绑定查询第170行带 tenant），租户 A 用户传租户 B 的岗位 ID 即可导出他人岗位、专业、证书数据 | 所有查询追加 tenant_id= 条件（如绑定查询那样）
```

## P2
```
backend/internal/handler/position_export_handler.go:60-131,158-201 | P2 | 性能（N+1） | 每个岗位逐一 QueryRow 岗位名/行业名/批次名 + 逐一 Query 专业/证书/能力绑定，导出 N 个岗位产生 ~5N 次 DB 往返 | 按 ID 批量 = ANY($1) 一次查回再内存分组
backend/internal/handler/position_handler.go:223-226 | P2 | 参数校验 | Update 的 IndustryID 若客户端传空字符串（非 null 的 &""），直接以 industry_id='' 写入触发 PG uuid 解析错误 → 500；common.go 已有 emptyStrToNil 但此处未用 | 空串指针转 nil 后再入库
backend/internal/handler/portal_handler.go:55-57,83-85 | P2 | 性能 | WorkspaceDashboard 在构造 dash 时同步执行 listAnnouncements/listTodos/listSchedule（55-57），随后又在 goroutine 中重复执行并覆盖（83-85）；admin 分支同样重复计算 Todos(74) 并丢弃 Schedule(76)。每条请求多出 3-6 次重复 DB 查询 | 只保留一处计算
backend/internal/handler/org_handler.go:216-223 | P2 | 逻辑 | buildOrgTree 中 ParentID 指向不存在节点（孤儿）时，节点既不挂 root 也不挂载，直接丢失不显示 | 孤儿节点按 root 处理或返回错误
backend/internal/handler/position_ability_handler.go:73-83 | P2 | 数据一致性 | CreateBinding 未校验 CareerPositionID 归属当前租户，store Create(store/position_bindings.go:40-53) 也无校验，可写入指向他租户岗位的绑定；ResponsibilityID/AbilityPointID 引用也未校验 | Create 前先按岗位校验租户并校验引用存在
backend/internal/handler/node_resource_handler.go:166-171 | P2 | 错误处理 | UnbindResource 在 BindTargetID 失败（绑定不存在）时返回 200 OK + {"id":id}，看似幂等成功实际未做任何删除 | 返回 404
backend/internal/handler/micro_cert_handler.go:215-245 | P2 | 数据一致性 | IssueCerts 未校验 UserIDs 是否属于当前租户/是否有效用户，可为任意（含他租户）用户 ID 生成证书记录（tenant_id 记为本租户），产生脏数据；store 的 ON CONFLICT 只保证同租户去重 | 先按 user_ids 批量校验租户归属
backend/internal/handler/position_clone_handler.go:43 | P2 | 稳定性 | 用 json.NewDecoder 直读 r.Body，未走 decodeBody 的 10MB MaxBytesReader 上限，超大 body 可耗尽内存 | 改用 decodeBody
backend/internal/handler/node_evaluation_result_handler.go:38-41 | P2 | 越权/隐私 | isStudent/studentUserId 由客户端参数驱动，非学生角色（教师/企业导师）可传 isStudent=true 指定任意 studentUserId 查询该生测评结果（租户内）；学生本人被强制覆盖参数，但教师侧无服务端角色约束 | 服务端按角色校验查询目标
```

## P3（摘要）
```
backend/internal/handler/position_export_handler.go:66-68,80,96 | P3 | 错误处理 | 岗位主查询失败仅 slog.Warn + continue，导出"成功"但静默缺行；全部失败时也返回 200 | 记录缺行比例，全部失败返回 500
backend/internal/handler/position_handler.go:485 | P3 | 错误处理 | SaveFull 后 pos, _ := h.Service.Get(...) 忽略错误，Get 失败时返回零值岗位 + 200 | 处理错误并返回 500
backend/internal/handler/position_handler.go:40-62 | P3 | 死代码 | List 的 publicOnly(claims==nil) 分支不可达（/job/positions 路由均在认证组）；且 PublicListConfig TenantScoped，匿名时 tenant 为空会查空集 | 删除该分支或显式移除匿名路径
backend/internal/handler/position_handler.go:208-210,252-266 | P3 | 逻辑 | Update 无法清空 ShortName/IndustryID（空串回填 existing），BatchID 固定取 existing，字段不可置空/变更 | 若需要支持置空，改用指针三态或显式语义
backend/internal/handler/portal_handler.go:107,145,170,192,241,255,279,301,324,351,378 | P3 | 错误处理 | 大量 rows, _ := h.Service.XXX(...) 吞错，失败时前端拿到空数组无法区分原因 | 至少记录日志或聚合首错误
backend/internal/handler/org_handler.go:165-172 | P3 | 错误处理 | err == service.ErrOrgSelfParent/ErrOrgDescendantParent/ErrOrgTypeInvalid 直接比较（应 errors.Is） | 改用 errors.Is
backend/internal/handler/micro_cert_handler.go:136,182 | P3 | 错误处理 | Create/UpdateTemplate 后 template, _ := h.Store.GetTemplate 忽略错误，回读失败时返回零值模板 + 201/200 | 回读失败返回 500
backend/internal/handler/micro_cert_handler.go:51-63 | P3 | 一致性 | ListHistory 缺少 CurrentUser(r)==nil 前置检查（ListTemplates 有），仅靠 tenant-scoped 兜底 | 统一先校验登录
backend/internal/handler/position_clone_handler.go:43,54 | P3 | 错误处理 | err.Error() != "EOF" 字符串比较（应 errors.Is(err, io.EOF)）；err == service.ErrPositionNotInTenant 直接比较 | 改用 errors.Is
backend/internal/handler/node_quiz_handler.go:169-174 | P3 | 性能 | ListQuestions 允许 limit 上限 1000，绕过全局 MaxPageSize=200，响应体可能过大 | 钳制到 MaxPageSize
backend/internal/handler/node_quiz_handler.go:210-213,250-253 | P3 | 参数校验 | 题目 Score 可为负/任意值，SortOrder 无范围校验 | 加基本范围校验
backend/internal/handler/lesson_behavior_handler.go:195-200,242-251 | P3 | 逻辑 | dailyMap/rateMap 以 "MM-DD" 为 key，跨年记录会被合并统计 | key 含年份
backend/internal/handler/lesson_behavior_handler.go:136-139 | P3 | 参数校验 | Create 未校验 RecordDate 格式与 Attendance 枚举，非法值可落库但不计入任何统计 | 增加枚举/格式校验
backend/internal/handler/node_evaluation_result_handler.go:48 | P3 | 一致性 | 响应用 map[string]interface{}{"items":...,"total":...}，与其它列表接口的 ListResponse 不一致 | 统一为 ListResponse
backend/internal/handler/node_resource_handler.go:66 | P3 | 逻辑 | 未传 nodeId 时 List 返回全部租户资源，但每条 res.NodeID 被置为 ""（无归属信息） | 由行数据回填或明确语义
backend/internal/handler/lesson_handler_test.go:574-576 | P3 | 死代码 | TestCourseBatch_CRUD 为空壳（仅注释，无任何断言），被 lesson_batch_test.go 覆盖 | 删除或补全
backend/internal/handler/lesson_handler_test.go:107,115,126,136,255,378,390,493,505,592,604 | P3 | 质量 | 多处 testhelper.Unmarshal(...) 忽略 error，解析失败时后续断言基于零值不可诊断 | 处理 error
backend/internal/handler/org_handler_test.go:296 | P3 | 风格 | _ = ctx 无意义占位 | 删除
```

## 无问题文件
- landing_handler.go
- learn_road_handler.go
- log_handler.go
- major_handler.go
- org_type_handler.go
- node_homework_handler.go
- lesson_batch_test.go
- portal_handlers_test.go
- portal_workspace_test.go

## 分层核验
本批除豁免区 position_export_handler.go 外，无任何 handler 出现 SELECT/INSERT/UPDATE/DELETE 字符串或 db.Query/QueryRow/Exec 直调或持有 *pgxpool.Pool 字段——分层规范通过。

总行数 5394
