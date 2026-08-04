# handler 批次2 审查（24文件，7061行）

## P1
```
backend/internal/handler/import_export_handler.go:256,321 | P1 | 逻辑bug | Preview/Import 先调用 r.ParseMultipartForm 已消费整个请求体，随后 parseImportCSV(r) 再读 r.Body 只会得到 EOF，CSV 导入/预览必然失败返回"CSV 为空或格式无效" | 改为从 FormFile("file") 返回的文件句柄读取 CSV；或移除 ParseMultipartForm 直接读原始 body
backend/internal/handler/file_handler.go:121-211 | P1 | 未鉴权 | Preview 端点无任何认证检查（Upload 有，Preview 无），任何人可调用并触发 libreoffice headless 转换（每请求拉起进程，资源耗尽/DoS），且按文件名(base64)返回 UploadDir 内任意 doc/xlsx 内容，跨租户泄露 | 增加 middleware.CurrentUser 校验；限制转换频率/并发；对文件名做归属校验
backend/internal/handler/granular_course_import_handler.go:137-141,156-158 | P1 | 数据一致性 | findOrCreateKnowledgePoints/findOrCreateResources 在 exists 判断和 preview 分支之前执行，preview 模式也会真实 INSERT knowledge_points/resource_library 污染数据库；exists&&!overwrite 被跳过时同样产生孤儿数据 | 先查重判定再决定是否创建；preview 模式禁止任何写操作
```

## P2
```
backend/internal/handler/crud.go:100,187 | P2 | 错误处理 | 创建/更新后回读 item, _ := cfg.GetByIDFn(...) 忽略错误，回读失败时返回零值结构体仍返回 200/201 | 回读失败应 respondServerError
backend/internal/handler/graduation_handler.go:103-104,146-147 | P2 | 参数校验遗漏 | time.Parse 错误被忽略，空/非法 startDate/endDate 变成零值(公元1年)写入 DB | 解析失败时返回 400
backend/internal/handler/exam_handler.go:169-180 | P2 | 逻辑bug | Update 中 Description/CoverImage/BatchID 空值一律回退到 existing，导致无法清空这三个字段 | 用指针字段区分"未传"与"传空串"
backend/internal/handler/import_common.go:272,291 | P2 | 性能/DoS | parseUploadedExcel/parseUploadedExcels 未用 http.MaxBytesReader 限制，且 200<<20 作为 maxMemory 使单请求可内存驻留高达 200MB | 加 MaxBytesReader 总大小上限，降低 maxMemory
backend/internal/handler/job_ability_result_handler.go:207-243 | P2 | 并发/锁 | aggInFlight 仅以 careerPositionId 为 key（不含 tenant），且为进程内 map：多实例部署或同 id 跨租户会重复汇聚 | key 改为 tenantID+positionID，或改用 DB 层状态位/Redis 锁
backend/internal/handler/file_handler.go:98-119 | P2 | 敏感信息泄露 | Serve 无鉴权且无租户隔离，任何登录用户上传的文件对全网公开（URL 为 UUID 难猜，但泄露即跨租户） | 至少做租户/访问控制或签名 URL
```

## P3
```
backend/internal/handler/exam_result_handler.go:84 | P3 | 错误处理 | err == pgx.ErrNoRows 用 == 而非 errors.Is，服务层若包装错误将 500 而非 404 | 改用 errors.Is
backend/internal/handler/job_ability_result_handler.go:141,268 | P3 | 错误处理 | 同上两处 err == pgx.ErrNoRows 直接比较 | 改用 errors.Is
backend/internal/handler/evaluation_result_handler.go:213 | P3 | 错误处理 | 评分后 res, _ = GetEvaluationResult 忽略错误，失败时返回零值 200 | 处理回读错误
backend/internal/handler/exam_usage_handler.go:152,174 | P3 | 错误处理 | Start/Finish 后 usage, _ = GetExamUsage 忽略错误 | 处理回读错误
backend/internal/handler/exam_handler.go:292,317,362,402 | P3 | 错误处理 | AddQuestion/RemoveQuestion/UpdateQuestionScore/BulkUpdateScores 回读 exam, _ = 忽略错误 | 处理回读错误
backend/internal/handler/crud.go:121-125,214-218 | P3 | 错误处理 | GetByIDFn 任何错误（含 DB 故障）一律映射 404，掩盖内部错误 | 区分 ErrNotFound 与其它错误
backend/internal/handler/file_handler.go:174 | P3 | 死代码 | sort.Slice(images, func(i,j)bool{return i<j}) 是恒假比较的空操作排序 | 删除或按文件名真实排序
backend/internal/handler/file_handler.go:176 | P3 | 错误处理 | respondServerError 传入的是内层 os.ReadFile 作用域的旧 err，此处可能为 nil，日志记 "<nil>" | 传空错误或重查目录
backend/internal/handler/exam_import_handler.go:167 | P3 | 数据一致性 | overwrite 更新后立即 DELETE exam_questions 无事务包裹，与后续题目重插分离，中途失败会留下无题目试卷 | 用事务包裹覆盖流程
backend/internal/handler/granular_course_import_handler.go:200-218 | P3 | 吞错误 | replaceCourseBindings 全部 _, _ 吞错，绑定失败静默导致课程与知识点/资源脱钩 | 记录错误并入 result.Errors
backend/internal/handler/import_export_handler.go:341-343 | P3 | 稳定性 | 用 strings.Count(updateSQL,"$")==3 猜参数个数，SQL 改动即静默错传参 | 显式区分 2 参/3 参映射表
backend/internal/handler/evaluation_method_handler.go:66-77 | P3 | 性能 | Toggle 先 TenantID 查询再 GetEvaluationMethod 全量查询，重复取数（N=2 次查询） | 合并为一次查询或复用结果
backend/internal/handler/exam_export_handler.go:96-111 | P3 | 稳定性 | 题目行循环后 rows.Close() 非 defer，且未检查 rows.Err()；后续 exam 查询失败时此前 rows 已关但错误未汇总 | defer rows.Close() 并检查 rows.Err()
backend/internal/handler/industry_handler.go:28 | P3 | 一致性 | List 无显式 claims 检查（其它 handler 均有），仅靠 executeListQuery 返回 ErrMissingTenant→403，风格不一致 | 入口显式校验 CurrentUser
```

## 无问题文件
- edge_case_test.go
- evaluation_handler_test.go
- evaluation_import_test.go
- granular_course_export_handler.go
- hybrid_module_handler.go
- job_advanced_test.go
- job_banner_handler.go
- job_handler_test.go
- knowledge_point_handler.go

## 分层核查
仅豁免区文件 exam_export/exam_import/granular_course_export/granular_course_import/import_common/import_export 含 *pgxpool.Pool 与裸 SQL，均在豁免范围；其余文件全部走 Service/Store，无分层违规。

总行数 7061
