# handler 批次5 审查（23文件，9296行）

## P1
```
backend/internal/handler/teaching_plan_handler.go:128-130 | P1 | 稳定性 | Generate 成功后 GetTeachingPlan/ListTeachingPlanEntries 错误被忽略，TeachingPlan: *plan 对 nil 解引用 panic（Recoverer 兜底但返回空 500）| 检查错误并 500 返回
backend/internal/handler/template_handler.go:774-776, 830-832, 891-893, 1093-1095, 1188-1190 | P1 | 稳定性 | 字典查询失败 return nil，调用方直接 writeExcel(nil) → f.Write(w) 空指针 panic | 返回空文件而非 nil，或调用方判空
```

## P2
```
backend/internal/handler/scenario_task_handler.go:132-192 | P2 | 逻辑bug | Update 复用 Create 请求体但未做必填校验（name/code/taskType 可为空直接覆盖入库，而 Create 在 90-93 有校验），partial 更新可清空必填字段 | 更新前校验 name/code/taskType 非空
backend/internal/handler/schedule_import_handler.go:263-267 | P2 | 数据一致性 | 「课程列表」导入先 DELETE 该学期全部 schedule_entries（含 manual 排课与其他计划条目），再重建；文件未覆盖的排课被静默清除 | 仅删除来源 imported 或先提示覆盖范围
backend/internal/handler/schedule_import_handler.go:279-292 | P2 | 逻辑bug | 教学计划条目仅按 course_name LIMIT 1 匹配（不带班级条件），多班级同名课程/不同条目会全部映射到同一条目，产生错误 plan_entry_id 关联 | 按 课程名+班级+计划 匹配并校验唯一性
backend/internal/handler/schedule_import_handler.go:433-650 | P2 | 数据一致性 | processRows 无事务无 advisory 锁，逐行 autocommit，中途失败部分落库；639-647 计划条目状态同步错误被 _, _= 吞掉 | 包事务或捕获并回滚/重试状态同步
backend/internal/handler/scheduling_handler.go:331-429, 902-924 | P2 | 逻辑bug | validateScheduleRequest 强制要求 ClassNodeID 非空，仅传 classNodeIds 数组（多班级）会被 400 拒绝，多班级排课实际不可建 | 校验改为 classNodeId 或 classNodeIds 至少一个
backend/internal/handler/scheduling_handler.go:622-795 | P2 | 性能/错误处理 | ExportSchedules 全量教师/场地/班级/节次/计划条目装入内存生成 excel；多处 _, _= 吞错误导致静默空 Sheet | 分页/流式导出并处理错误
backend/internal/handler/student_portrait_handler.go:127-136 | P2 | 错误处理 | GetStudentPortraitByUserPosition 出错被吞并伪造空画像返回 200，掩盖真实失败 | 错误应 500
backend/internal/handler/student_portrait_handler.go:161-198 | P2 | 越权 | CreateArchive 未校验 req.UserID 是否属于本租户（Generate 在 113-117 有校验），业务用户可为任意 id 建档；DeleteArchive 仅按档案 tenant 隔离 | 补充 user 租户归属校验
backend/internal/handler/subscription_handler.go:114-135 | P2 | 错误处理 | AdminUpdate 中 GetSubscriptionByTenant 任何错误（含 DB 错误）都落到 Create 分支，掩盖故障可能重复创建 | 区分 ErrNotFound 与其它错误
backend/internal/handler/task_knowledge_ability_handler.go:25-50, 74-99 | P2 | 越权 | BindKnowledge/BindAbility 未做任务归属校验（Unbind 有完整 task→scenario→tenant 校验），跨租户任务可被绑定 | handler 层统一 verifyTaskTenant
backend/internal/handler/task_resource_handler.go:146-171 | P2 | 越权 | BindResource 未做 task 租户归属校验（UnbindResource 173-203 却有完整链路），可向他人任务绑定资源 | 补齐校验
backend/internal/handler/tenant_handler.go:248-511 | P2 | 安全 | 全部 Admin* 方法无 handler 级鉴权（注释为产品决策），生产仅靠路由 platformAdmin 中间件；测试路由 setup.go 93-103 未挂 auth，任一入口脱敏即全开放（含租户删除/重置密码）| 至少保留 isUniqueViolation 外的最小自校验/日志审计
backend/internal/handler/tenant_handler.go:658-660 | P2 | 逻辑bug | PreviewSchoolAdminPassword 竟是 ResetSchoolAdminPassword 别名，会真实改密并作废旧密码，「预览」语义误导且使现密码失效 | 改为只读查询或改名
backend/internal/handler/training_program_handler.go:266-316 | P2 | 越权 | PutCourses 未校验 PositionID/CourseID 归属租户，仅校验方案归属 | service 层校验引用对象租户
backend/internal/handler/user_management_handler.go:486 | P2 | 敏感信息 | BatchCreate 直接返回 store.Create 结果（fetchUser 带 password_hash，见 store/users.go:128,446），未像 Create(251)/Update(323) 那样清空 PasswordHash → 响应泄露 bcrypt 哈希 | 返回前置空 PasswordHash/IDCard/Oauth
backend/internal/handler/user_management_handler.go:129-154 | P2 | 安全 | ChangeMyPassword 免验旧密码且改密后不失效既有会话（注释为设计），会话泄露即被接管 | 至少失效旧 token / 校验旧密码
```

## P3（摘要）
```
backend/internal/handler/scenario_task_handler.go:62-78 | P3 | 越权 | Get 仅当 task.TenantID!=nil 才校验租户，若存在无租户任务则跨租户可读 | 改为必须校验或拒绝 nil tenant
backend/internal/handler/scenario_task_handler.go:221-250 | P3 | 参数校验 | Reorder 未校验 taskIds 非空且未校验任务确实属于该场景租户 | 校验 taskIds 归属后再重排
backend/internal/handler/scenario_task_handler.go:90-93 | P3 | 参数校验 | TaskType 未限制枚举值（training/assessment）| 校验合法枚举
backend/internal/handler/scenario_weight_handler.go:43-101 | P3 | 参数校验 | Weight 无范围校验（可为负/超100）；existing 场景 tenant 为 nil 时跳过归属校验 | 校验 0-100 且租户必校验
backend/internal/handler/schedule_import_handler.go:243-247 | P3 | 逻辑bug | 学期仅从第一行课程推断，多学期文件会整体错排 | 逐行携带学期或全校验
backend/internal/handler/schedule_import_handler.go:319 vs 484 | P3 | 一致性 | 教师匹配漏 login_name（两条导入路径不一致）| 统一三种匹配
backend/internal/handler/schedule_import_handler.go:344 | P3 | 错误处理 | QueryRow 错误忽略（_ =），多行时任意取第一条 | 校验唯一性并处理错误
backend/internal/handler/scheduling_handler.go:427-428, 510-511 | P3 | 错误处理 | fetchScheduleEntry 错误被忽略，返回 201/200 + JSON null | 检查错误并回滚响应
backend/internal/handler/scheduling_handler.go:571 | P3 | 信息泄露 | err.Error() 直接回给客户端（ErrNoPeriodSlots/ErrNoVenues 中文提示，轻微）| 用固定文案
backend/internal/handler/staff_title_handler.go:50 | P3 | 错误处理 | BatchCountUsersByTitle 错误忽略，counts 为 nil 时 UserCount 全为 0 | 失败时降级或 500
backend/internal/handler/staff_title_handler.go:190-193 | P3 | 错误处理 | 更新后 GetByID 错误忽略，用零值 title 回包（TenantID 空串）| 检查错误
backend/internal/handler/stats_handler.go:9-15 | P3 | 死代码 | MyStats 是写死返回 0 的桩，无任何查询 | 实现真实统计或删除路由
backend/internal/handler/student_portrait_handler.go:120-121 | P3 | 稳定性 | 聚合用 context.Background() 而非 r.Context()，客户端断开仍跑满 30min | 透传 r.Context()
backend/internal/handler/subscription_handler.go:72-136 | P3 | 安全 | AdminGet/AdminUpdate 无 handler 级鉴权，仅依赖路由中间件（与 Update 的 canManagePlatform 不一致）| handler 内补充平台管理员校验
backend/internal/handler/task_evaluation_handler.go:162 | P3 | 错误处理 | err == service.ErrMethodVersionConflict 哨兵比较，应用 errors.Is | 改用 errors.Is
backend/internal/handler/task_evaluation_handler.go:207-211, 106-110 | P3 | 错误处理 | 任意错误（含 DB 错误）都映射 404「场景任务不存在/评分模板不存在」| 区分 ErrNotFound 与 500
backend/internal/handler/task_knowledge_ability_handler.go:52-72, 101-121 | P3 | 错误处理 | 绑定查询错误被吞并返回 200（幂等假象），DB 故障也显示成功 | 区分 ErrNoRows 与其它错误
backend/internal/handler/task_resource_handler.go:180-184 | P3 | 错误处理 | BindTargetID 错误吞掉返回 200 | 区分 not found 与其它错误
backend/internal/handler/teaching_plan_handler.go:101-107 | P3 | 逻辑bug | FindTeachingPlanExisting 错误被吞，可能绕过「已有排课不可重生成」保护并孤儿化既有 schedule_entries | 错误时中断
backend/internal/handler/teaching_plan_handler.go:247-250 | P3 | 错误处理 | DeleteEntry 任意错误都映射 400「已被排课引用」，DB 错误误报 | 区分外键与其它错误
backend/internal/handler/teaching_plan_handler.go:265-270 | P3 | 错误处理 | Confirm 后 GetTeachingPlan 错误忽略返回 null 200 | 检查错误
backend/internal/handler/template_handler.go:82-161 | P3 | 错误处理 | queryDicts 循环内 Scan 错误被忽略，无 rows.Err() 检查 | 迭代错误检查
backend/internal/handler/template_handler.go:289-291, 410-411, 530-531 | P3 | 死代码 | DeleteSheet("Sheet1") 重复调用 | 删除冗余行
backend/internal/handler/template_handler.go:1203-1248 | P3 | 稳定性 | queryOrgPaths 递归 buildPath 无环保护，parent_id 成环会无限递归 | 加访问标记
backend/internal/handler/template_handler.go:815 | P3 | 越权 | generateQuestionTemplate 未校验 bankId 租户归属，仅查名称，任何租户可用他人 bankId 下载模板 | 校验 bank 属于当前租户
backend/internal/handler/tenant_handler.go:204, 235, 348, 373 | P3 | 错误处理 | 更新后 Get 错误忽略返回 JSON null 200 | 检查错误
backend/internal/handler/tenant_handler.go:447, 532, 654 | P3 | 敏感信息 | 明文新密码随 HTTP 响应返回（设计如此）| 确认产品设计后保留
backend/internal/handler/training_program_handler.go:224 | P3 | 错误处理 | Publish body 解析错误被吞，默认 published | 校验 decode 错误
backend/internal/handler/training_program_handler.go:105-108, 389 | P3 | 错误处理 | 编码生成/Get 错误被吞 | 检查错误
backend/internal/handler/user_extension_field_handler.go:38 | P3 | 命名/文案 | 错误提示「确保default extension fields失败」为直译残留 | 改为中文正常文案
backend/internal/handler/user_management_handler.go:525 | P3 | 一致性 | BatchGraduate 返回 count=len(userIds) 而非实际更新行数（含已毕业/不存在的用户）| 返回真实计数
backend/internal/handler/user_relation_handler.go:93 | P3 | 错误处理 | Create 任意错误都映射 400「发起者或目标不在租户中」，重复/其它错误被掩盖 | 区分错误类型
backend/internal/handler/workflow_handler.go:83-100 | P3 | 逻辑bug | Create 强制 Status=active，客户端无法创建停用工作流 | 创建时同样支持 inactive
```

## 无问题文件
- scenario_import_resource_type_test.go
- scene_handler_test.go
- tenant_handler_test.go
- user_management_handler_test.go

## 关键结论汇总
- P1（2处，均 panic 风险）：teaching_plan_handler.go:128-130 nil 解引用；template_handler.go 5 处 return nil → writeExcel 空指针。
- 排课并发：手动排课已用 pg_advisory_xact_lock(tenant|term) 串行化（store/scheduling.go:267，经 service CreateScheduleChecked/UpdateScheduleChecked 事务），无竞态；但导入路径（schedule_import_handler processRows）未加锁且非事务，与手动排课并发仍可重复插入。
- 教学计划生成防重复：GeneratePlan 事务内 DELETE+INSERT 原子重建，本身不会重复；但 handler 101-107 的检查是 TOCTOU。
- 评价提交：SaveMethods 带 version 乐观锁 + service 内 temp exam 幂等，无问题。
- 分层：仅 schedule_import_handler.go / template_handler.go 直连 *pgxpool.Pool 与 SQL，属豁免冻结区；其余 handler 均走 service/store，未发现违规。

总行数 9296
