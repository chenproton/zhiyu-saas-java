# handler 批次4 审查（24文件，6475行）

## P1
```
backend/internal/handler/program_course_import_handler.go:87 | P1 | 越权 | ImportExcel 按前端传入的 programId 直接 DELETE training_program_courses，未校验该 program 归属调用方租户，可清空/替换他人租户方案课程 | 先按 tenant_id 校验 program 存在且归属当前租户
backend/internal/handler/program_course_import_handler.go:164 | P1 | 越权 | SELECT id FROM career_positions WHERE name=$1 无 tenant_id 过滤，可关联到其他租户同名的岗位 | 增加 tenant_id 条件
backend/internal/handler/program_course_import_handler.go:171 | P1 | 越权 | SELECT id,name FROM courses WHERE name=$1 AND type='system' 无 tenant_id 过滤，跨租户关联体系课 | 增加 tenant_id 条件
backend/internal/handler/question_bank_handler.go:59-72 | P1 | 越权 | Get 使用无租户限定的 GetQuestionBank（store/question_banks.go:50 无 tenant 过滤），任意登录用户可按 id 读取任意租户题库；Update/Delete 均用 GetQuestionBankInTenant，此处明显漏检 | 改用 GetQuestionBankInTenant 或 GetScoped
backend/internal/handler/random_draw_question_handler.go:92-97 | P1 | 越权 | Get/Update/Delete 完全无租户隔离：GetByIDFn 忽略 tenantID，crud 未设置 CheckOwnership/TenantIDFn，store 层 Get/Update/Delete 也无 tenant 过滤（store/random_draw_questions.go:26-66），任意登录用户可跨租户读取（含 Answer 答案）、修改、删除现场问答题 | GetByIDFn 改用租户限定查询，Update/Delete 前校验归属
```

## P2
```
backend/internal/handler/question_bank_handler.go:41-43 | P2 | 写读混淆/性能 | List 每次请求都调用 EnsureDraftPool 写库（GET 触发写 + 无锁并发创建）| 创建后缓存/仅当租户无草稿池时创建
backend/internal/handler/question_handler.go:81-128 | P2 | 越权(关联) | Create 不校验 req.BankID 归属当前租户，service/store 均不校验（service/evaluation_question.go:20），可把题目写入其他租户题库并破坏 question_count | 创建前用 GetQuestionBankInTenant 校验 bankId
backend/internal/handler/question_handler.go:204-249 | P2 | 越权(关联) | BatchCreate 同样不校验 bankID 租户归属（store BatchCreate 仅按入参写入）| 创建前校验 bankId 归属
backend/internal/handler/position_import_handler.go:124-141 | P2 | 数据一致性 | overwrite 更新岗位及关联数据无事务：UPDATE 成功后关联 DELETE/INSERT 的 Exec 错误全部被忽略（138-141 行），失败即产生半清空/孤儿数据 | 用事务包裹 更新+清理+重插，检查并收集错误
backend/internal/handler/resource_import_handler.go:732-736 | P2 | 数据一致性 | createUser 中 user_roles 插入与 roles.user_count 更新错误被忽略：用户创建成功但角色未分配（半成功）| 检查错误并入事务回滚
backend/internal/handler/scenario_import_handler.go:141-156 | P2 | 数据一致性 | overwrite 场景：UPDATE 成功后 DELETE task_evaluation_methods/scenario_tasks 的错误被忽略且无事务，失败产生半清空 | 用事务包裹 更新+清理+重建
```

## P3（摘要）
```
backend/internal/handler/position_import_handler.go:100-105 | P3 | 性能 | 每行对 industries/batches/majors/career_positions 做多次查询（N+1）| 先批量预载 name→id 映射
backend/internal/handler/position_import_handler.go:143-154,179,182,191 | P3 | 错误处理 | 关联行 INSERT/UPDATE 的 Exec 错误均被忽略 | 至少记录错误并计入 result.Failed
backend/internal/handler/position_import_handler.go:29-31 | P3 | 并发 | 每文件新建 positionMap，跨文件职责引用前一文件岗位会被误跳（Skipped+Error）| 跨文件共享映射或提示顺序依赖
backend/internal/handler/position_responsibility_handler.go:72-99 | P3 | 死代码 | ValidateUpdate 强制要求 CareerPositionID，但 store.Update 只更新 name/description/sort_order，忽略该字段 | 去掉 CareerPositionID 必填校验及传参
backend/internal/handler/question_bank_export_handler.go:71 | P3 | 越权(轻度) | evaluation_batches 按 id 查批次名无租户过滤（仅导出名称）| 补充 tenant_id 条件
backend/internal/handler/question_bank_export_handler.go:57-81 | P3 | 性能 | 每个题库 2 次查询，无批量 | 一次 IN 查询联表
backend/internal/handler/question_bank_handler.go:249-259 | P3 | 逻辑 | Archive/Unpublish/Withdraw 未做 isDraftPool 拦截，与 Submit/Publish 不一致，可对草稿池做状态流转 | 统一拦截
backend/internal/handler/question_bank_handler.go:270-281 | P3 | 错误处理 | IsDraftPool 出错时返回 false 继续执行状态流转 | 出错应写 500 中止
backend/internal/handler/question_bank_handler.go:35-37 | P3 | 死代码 | claims 重复获取（tenantClaims 与第 29 行 claims 相同）| 复用
backend/internal/handler/question_bank_import_handler.go:154-156 | P3 | 数据一致性 | overwrite 的 UPDATE 无 tenant_id 条件（依赖前序租户限定查询，竞态窗口内可覆盖他租户记录）| WHERE 中追加 tenant_id
backend/internal/handler/question_export_handler.go:112 | P3 | 性能 | 每题逐知识点查库（N+1）| 批量 IN 查询
backend/internal/handler/question_export_handler.go:91-97 | P3 | 错误处理 | json.Unmarshal 错误被忽略，options/answers 解析失败静默导出空 | 记录日志
backend/internal/handler/question_handler.go:224-242 | P3 | 校验缺失 | BatchCreate 无单条必填校验（空 type/content 项被 store 静默跳过但调用方不知情）| 前置逐条校验并返回无效行
backend/internal/handler/question_handler.go:76-79 | P3 | 错误处理 | marshalJSON 吞掉 marshal 错误 | 返回错误处理
backend/internal/handler/question_import_handler.go:212-215 | P3 | 数据一致性 | overwrite 的 UPDATE questions 无 tenant_id 条件（依赖前序租户限定 SELECT，竞态窗口风险）| WHERE 追加 tenant_id AND bank_id
backend/internal/handler/random_draw_question_handler.go:46-99 | P3 | 一致性 | 列表走 TenantScoped 而详情/更新/删除无租户，行为不一致 | 统一租户策略
backend/internal/handler/resource_export_handler.go:139-156 | P3 | 性能 | fillOrganizations 每行查 org_types + 每组织查 parent 名称（N+1）| 批量查询缓存
backend/internal/handler/resource_export_handler.go:265-315 | P3 | 性能 | 每个学生/教师逐级 buildAncestorChain + 逐 title 查询 | 批量/一次递归 CTE
backend/internal/handler/resource_export_handler.go:52-55 | P3 | 错误处理 | Body JSON 解析失败静默当作"全量导出"，畸形请求会导出全部数据 | 非空 body 解析失败应报 400
backend/internal/handler/resource_import_handler.go:246-252,255-261 | P3 | 计数 | exec 模式下上级行业未找到/自我指向仅 previewRes.Failed++，result.Failed 未增，返回统计失真 | 同步递增 result.Failed
backend/internal/handler/resource_import_handler.go:263 | P3 | 错误处理 | 父级关联 UPDATE 错误被忽略 | 记录错误
backend/internal/handler/resource_import_handler.go:667-673 | P3 | 性能/稳定性 | 教师创建后按 username 再查 uid 再 UPDATE title_ids（多一次查询，且 title_ids 更新无租户条件）| 在 createUser 中直接写入 title_ids
backend/internal/handler/resource_import_handler.go:750-763 | P3 | 逻辑 | 分隔符遍历中 "-" 在 "->" 之前匹配，导致 "->" 永不生效，路径 "学校->学院" 被拆为 ["学校", ">学院"] 解析失败 | 先匹配长分隔符或按优先级排序
backend/internal/handler/resource_import_handler.go:361-369 | P3 | 稳定性 | org_types 行循环后未检查 rows.Err() | 补 rows.Err() 检查
backend/internal/handler/resource_library_handler.go:88-120 | P3 | 权限 | Create 无角色限制，任意登录用户可创建资源；Update/Delete 亦仅限登录+租户 | 若资源上传需管理权限则加 canManagePortal 校验
backend/internal/handler/resource_library_handler.go:122-181 | P3 | 校验缺失 | Update 允许把 Name 更新为空字符串 | 校验非空
backend/internal/handler/role_handler.go:29-42 | P3 | 鉴权一致性 | List 无显式登录检查，仅依赖 ErrMissingTenant（未登录返回 403 而非 401）| 显式检查 CurrentUser
backend/internal/handler/role_handler_test.go:172 | P3 | 死代码 | _ = ctx 冗余 | 删除
backend/internal/handler/scenario_clone_handler.go:44 | P3 | 错误处理 | err.Error() != "EOF" 字符串比较判断空请求体 | 改用 errors.Is
backend/internal/handler/scenario_clone_handler.go:55 | P3 | 错误处理 | err == service.ErrScenarioNotInTenant 直接比较 | 改用 errors.Is
backend/internal/handler/scenario_clone_handler.go:24-29 | P3 | 稳定性 | recover 后可能已写出响应头，respondError 无效且可能二次写 | 先判断是否已写
backend/internal/handler/scenario_export_handler.go:70,75,108,166,181,196,211 | P3 | 越权(轻度) | 关联表按 id 查名称均无 tenant_id 过滤，仅影响导出显示 | 补充租户条件或由外部查询预取
backend/internal/handler/scenario_export_handler.go:136 | P3 | 性能 | 每个任务行一次 task_evaluation_methods 查询 | 批量查询
backend/internal/handler/scenario_export_handler.go:122-153 | P3 | 稳定性 | taskRows 循环后未检查 rows.Err() | 补检查
backend/internal/handler/scenario_grade_handler.go:27-31,48-51 | P3 | 一致性 | 未登录返回 401，其余 handler 均为 403 | 统一 403
backend/internal/handler/scenario_grade_handler.go:75,89 | P3 | 逻辑 | scenarioTenantID 为 nil 时跳过租户校验（空租户场景可跨租户 upsert）| nil 时按无租户实体处理或报错
backend/internal/handler/scenario_handler.go:130-136 | P3 | 越权(轻度) | Get 在 verifyTenantOwnership 之前调用 recordViewAsync，跨租户请求也会对他人场景计数 | 先校验租户再计数
backend/internal/handler/scenario_handler.go:114-139 | P3 | TOCTOU | Get 先无租户读取实体再校验 | GetScoped 限定租户
backend/internal/handler/scenario_import_handler.go:284-288 | P3 | 并发/重复 | generateTaskCode 每文件从 001 重新计数，多文件导入同一场景会产生重复任务 code | 跨文件共享计数器或查库最大序号
```

## 无问题文件
- position_stats_test.go
- position_tenant_isolation_test.go
- recommend_handler.go
- resource_code_handler.go

总行数 6475
