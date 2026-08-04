# handler 批次1 审查（24文件，6732行）

## P1
```
backend/internal/handler/approval_handler.go:180-199 | P1 | 逻辑bug | 无 workflow 的审批记录（record.WorkflowID == nil，Create 允许缺省）走 Review 时 workflow 恒为 nil，isStepComplete 对 nil workflow 一律返回 false → 永远落入"仅更新 history"分支，审批永远无法 approved/rejected，卡死。isUserApproverForStep 对 nil workflow 返回 true（本意是"单人即可审"），与 isStepComplete 的 fail-closed 语义矛盾 | 无 workflow 时应视为单步审批直接推进；仅对"有 workflow 但加载失败"才 fail-closed
backend/internal/handler/approval_handler.go:263-287 | P2 | 逻辑bug | isStepComplete 用 entryMap["stepIdx"].(float64) 解析历史步骤，而本请求刚 append 的 entry 是 int（第158行 record.CurrentStepIdx），断言失败后 stepFlt=0，stepIdx>0 时自己的审批票不被计入 → "all"模式（含单审批人）需重复审批 N+1 次才能完成 | 统一以 float64 存 stepIdx，或在类型断言失败时按 int 再取一次
backend/internal/handler/course_handler.go:285-333 | P1 | 数据一致性 | Update 中 batchID := req.BatchID 不向 existing 回退（对比 MajorID 等指针字段均回退），请求未携带 batchId 时 emptyStrToNil(nil)=nil 会把 batch_id 清空 | 缺省时回退 existing.BatchID
backend/internal/handler/course_resource_handler.go:60-115 | P1 | 越权 | Create 未校验 req.CourseID 归属租户（BindResource 校验了，Create 没有），store CreateResource/CourseSyncBind（resource_bindings.go:308-316 无 tenant 过滤）可把资源绑定到任意租户课程并改写其 courses.resource_ids，跨租户写 | Create 前调用 CourseTenantID+verifyTenantOwnership
backend/internal/handler/certification_handler.go:541-565 | P1 | 越权 | CreateTask 未校验 chi.URLParam(r,"pointId") 归属租户，store CreateTask（certifications.go:306-317）直接以任意 certPointID 插入 → 跨租户向他人认证点挂任务 | 先 GetCertificationPointByTenant 校验
```

## P2
```
backend/internal/handler/auth_handler.go:278-311 | P2 | 敏感信息泄露 | Me 返回 domain.User 未清空 Oauth（json tag 为 oauth,omitempty），OAuth 第三方令牌随 /me 下发，与登录路径显式 user.Oauth = nil（259行）的意图相悖 | 响应前清空 Oauth/凭据字段
backend/internal/handler/appeal_handler.go:101-138 | P2 | 越权 | Process 仅校验登录+租户，任意租户内用户均可 approve/reject 申诉，无教师/管理员角色限制 | 增加角色校验
backend/internal/handler/appeal_handler.go:75-99 | P2 | 越权 | Create 直接信任请求体 req.UserID，不校验该用户属于本租户/为可申诉对象，可代任意 userId 建申诉 | 校验 userId 归属租户与角色
backend/internal/handler/appeal_handler.go:27-45 | P3 | 越权 | List 任意租户用户可查看全部申诉记录（无本人/角色过滤） | 按发起人或角色过滤
backend/internal/handler/course_handler.go:414-421 | P2 | 越权 | Assessments 调 verifyTenantOwnership(w, r, *claims.TenantID) 是自比较（恒 true），课程真实租户从未校验，跨租户凭 courseID 可访问该接口 | 改用 Service.GetCourseDetailInTenant 或取课程 tenantID 校验
backend/internal/handler/course_handler.go:477-517,591-631 | P2 | 越权 | ListHomeworkSubmissions/ListNodeHomeworkSubmissions 无角色校验，任意租户用户可查看全班作业提交 | 增加教师/管理员校验
backend/internal/handler/course_handler.go:520-552,634-666 | P2 | 越权 | GradeHomeworkSubmission/GradeNodeHomeworkSubmission 任意租户用户可批改评分 | 增加角色校验
backend/internal/handler/course_export_handler.go:57-162 | P2 | 性能 | N+1：每课程 1+2 次查询、每节点再 3 次查询（knowledge/resource/eval） | 按 courseID 批量取节点再按 nodeID 批量查关联
backend/internal/handler/course_import_handler.go:179-190 | P2 | 数据一致性 | overwrite 模式先 clearCourseNodes 删光课程全部节点再重导，节点 Sheet 缺失/中途失败即整课节点丢失 | 先校验节点数据完整性或事务化
backend/internal/handler/course_import_handler.go:134-218 | P2 | 数据一致性 | 整个导入无事务包裹，中途失败留下部分课程/节点 | 单文件包事务
backend/internal/handler/batch_handler.go:227-233 | P2 | 数据一致性 | UpdateWithStatus=true（仅 lesson_batches）时，更新请求未带 status 会把状态强制重置为 StatusOpen | 仅在显式传 status 时更新
```

## P3（摘要）
```
backend/internal/handler/approval_handler.go:81 | P3 | 越权 | Get 仅当 record.TenantID != nil 才校验归属，nil tenant 记录直接返回给任意登录用户 | nil tenant 时按 404/403 处理
backend/internal/handler/approval_handler.go:191-193 | P3 | 错误处理 | 记录被并发变更时 UpdateApprovalHistory 返回 false 却走 500，应返回 409 | 对 !ok 分支返回 409/400
backend/internal/handler/auth_handler.go:156-158 | P3 | 稳定性 | rand.Read 错误被忽略 | 检查错误
backend/internal/handler/auth_handler.go:205-214 | P3 | 并发 | usedNonces 检查与 Store 非原子（TOCTOU），并发同一 JTI 可双发令牌；且仅内存态，多实例部署下失效 | 改用带过期时间的原子存储（如 Redis）
backend/internal/handler/appeal_handler.go:27-45 | P3 | 越权 | List 任意租户用户可查看全部申诉记录 | 按发起人或角色过滤
backend/internal/handler/course_handler.go:520-552,634-666 | P2 | 越权 | GradeHomeworkSubmission/GradeNodeHomeworkSubmission 任意租户用户可批改评分 | 增加角色校验
backend/internal/handler/course_resource_handler.go:161-166 | P3 | 错误处理 | UnbindResource 绑定不存在时 BindTargetID 出错却返回 200 {"id":id} | 返回 404
backend/internal/handler/course_resource_handler.go:32-35 | P3 | 一致性 | 未登录返回 401，其余 handler 均为 403 | 统一 403
backend/internal/handler/content_actions.go:187-219 | P2 | 越权 | invite 对 req.UserID 不做存在性/租户校验，store Invite 无条件 array_append，可把其他租户用户拉为协作者；非 UUID 的 userID 触发 ::uuid[] 转换错误返回 500 | 校验用户存在且同租户，非法 UUID 返回 400
backend/internal/handler/content_actions.go:142-185 | P2 | 越权 | review 仅登录+租户即可 approve/reject 内容实体，无审核人角色限制 | 增加审核角色校验
backend/internal/handler/content_actions.go:205 | P3 | 稳定性 | invite 用裸 json.NewDecoder(r.Body) 绕过 decodeBody 的 10MB 限制 | 复用 decodeBody
backend/internal/handler/content_actions.go:183 | P3 | 错误处理 | entity, _ := c.fetch 忽略错误可能响应 null | 检查错误
backend/internal/handler/content_actions.go:125-127 | P3 | 错误处理 | 状态流转错误时直接 err.Error() 外抛内部文案 | 返回固定消息
backend/internal/handler/certification_handler.go:149-153 | P3 | 并发 | CreateRule 先查后建存在竞态，并发可重复建规则；已存在时返回 200 而非 201 | 依赖唯一约束并处理 23505→409
backend/internal/handler/certification_handler.go:470 | P3 | 错误处理 | rule, _ := GetCertificationRule 忽略错误可能响应 null | 检查错误
backend/internal/handler/certification_model_handler.go:47-51 | P3 | 错误处理 | 岗位不存在/无规则时 FindPositionRule 报错走 500，应 404 | 区分 ErrNotFound→404
backend/internal/handler/certification_model_handler.go:133-137 | P3 | 错误处理 | 权重已保存成功但回读失败时仍报"保存权重失败"（误导） | 回读失败单独文案
backend/internal/handler/batch_handler.go:102 | P3 | 命名 | "查询"+EntityName+"es失败" 生成 "batches"/"scene batchese" 等错误文案 | 用固定中文文案
backend/internal/handler/batch_handler.go:182 | P3 | 错误处理 | Create 重名触发唯一约束走 500，无 409 分支 | 处理 23505
backend/internal/handler/cert_grade_handler.go:84-123 | P3 | 逻辑bug | result[gradeKey]=dto 以 GradeYear 为 key，同年多期成绩相互覆盖 | 以 grade ID 作 key 或合并展示
backend/internal/handler/certificate_library_handler.go:68-97 | P3 | 参数校验 | Update 无 ValidateUpdate；t.Name 非 nil 但为空串时写入空名称 | 增加非空校验
backend/internal/handler/affairs_term_handler.go:90-96 | P3 | 死代码 | 定义了 GetByIDFn 但未暴露 Get handler，学期无详情接口 | 补 Get 或删除冗余配置
backend/internal/handler/common.go:104-111 | P3 | 稳定性 | decodeBody 不拒绝尾部多余 JSON（第二个对象静默忽略） | Decode 后再查 Decode(&struct{}{}) 判 EOF
backend/internal/handler/course_clone_handler.go:43 | P3 | 代码质量 | 用 err.Error() != "EOF" 字符串比较判断空 body，脆弱 | 用 errors.Is(err, io.EOF)
backend/internal/handler/course_node_handler.go:140-197,199-261 | P3 | 数据一致性 | ParentID 未校验属于同一课程/租户，可把节点挂到他人课程的父节点下 | 校验父节点 course_id/tenant_id
backend/internal/handler/course_export_handler.go:71,76,179-187 | P3 | 错误处理 | major/batch/knowledge 查询 Scan 错误被忽略 | 记录日志或回退
backend/internal/handler/course_import_handler.go:451-455 | P3 | 数据一致性 | clearCourseNodes 删除节点但未清理 node_knowledge_point_bindings/node_resource_bindings，留下孤儿绑定；错误全忽略 | 补删绑定并检查错误
backend/internal/handler/course_import_handler.go:512-520 | P3 | 死代码 | generateSystemCourseCode 定义后无人调用 | 删除
backend/internal/handler/affairs_config_import_handler.go:64,96,132 | P3 | 错误处理 | INSERT Exec 错误被忽略，created++ 计数失准且失败静默 | 检查错误并计入 failed
backend/internal/handler/affairs_config_import_handler.go:59,91,127 | P3 | 错误处理 | 存在性 QueryRow Scan 错误被吞，非 no-rows 错误会被误判为"不存在"致重复插入 | 区分 pgx.ErrNoRows 与其他错误
backend/internal/handler/affairs_config_import_handler.go:19-141 | P3 | 数据一致性 | 三 Sheet 导入无事务，中途失败留下部分数据 | 事务化
backend/internal/handler/alliance_handler.go:66 | P3 | 错误处理 | updated, _ := GetSchoolInfo 忽略错误，失败时响应 null | 检查错误
backend/internal/handler/alliance_handler.go:151,187 | P3 | 错误处理 | 创建/更新协议后回读 GetEnterpriseAgreementByID 错误被忽略 | 检查错误
backend/internal/handler/alliance_handler.go:712-721 | P3 | 性能 | GetPublicStats 串行 5 个 COUNT 查询 | 合并或并行
backend/internal/handler/ability_domain_handler.go:102-107 | P3 | 逻辑bug | TenantIDFn 对 tenant_id 为 NULL 的脏数据返回空串导致归属校验 403；List 未登录返回 403 而非 401 | 脏数据兜底
```

## 无问题文件
- backend/internal/handler/ability_handler.go
- backend/internal/handler/alliance_crud_handler.go
- backend/internal/handler/auth_handler_test.go
- backend/internal/handler/batch_configs.go

## 分层核查
- 豁免区外全部 21 个 handler 均无 SELECT/INSERT/UPDATE/DELETE 字符串、无 db.Query/QueryRow/Exec 直接调用、无 *pgxpool.Pool 字段，分层合规。
- *pgxpool.Pool 字段仅存在于豁免文件：affairs_config_import_handler.go:15、course_export_handler.go:16、course_import_handler.go:19。

总行数 6732；问题合计 P1×5、P2×12、P3×30
