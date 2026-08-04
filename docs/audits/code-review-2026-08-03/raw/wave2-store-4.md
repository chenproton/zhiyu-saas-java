# store 批次4 审查（21文件，6531行）

## P1
```
user_relations.go:52-54 | P1 | SQL 错误 | countQuery=SELECT COUNT(*) FROM user_relations r WHERE ... 但 cond 含 init_u.name/tgt_u.name（仅列表查询有 LEFT JOIN）；search 非空时 count 查询引用不存在的别名 → "missing FROM-clause entry"，带搜索的列表接口必 500 | count 查询补 JOIN（或单独按 r 表 + init/tgt 表联查）
scenario_tasks.go:95-110 | P1 | 越权读取 | Update 写入用 WHERE id=$19 AND tenant_id=$20 隔离，但随后 fetchTask(ctx,id)(206-218) 无租户过滤：tenant 不匹配时 UPDATE 0 行不报错、却返回他租户任务完整数据（handler 已拦，但 store 缺纵深防御）| 校验 RowsAffected==1 或 fetch 时带 tenant
```

## P2
```
resource_library.go:147-170 | P2 | 租户隔离 | Update(WHERE id=$8)与 Delete(WHERE id=$1)均无 tenant_id 过滤，Get(117-127)同；注释注明由 handler 校验，但 store 无纵深防御 | Update/Delete 增加 tenant_id 参数与 WHERE 条件
roles.go:91-110 | P2 | 越权 | Assign 的 INSERT INTO user_roles 未校验 role_id/user_id 归属 tenantID（仅 user_count 的 UPDATE 带租户过滤），可把外租户角色绑定给本租户用户 | INSERT 前校验 role 属于 tenant 且 user 属于 tenant
roles.go:72-82 | P2 | 租户隔离 | Delete 仅 WHERE id=$1，无租户过滤，可连带删除他租户角色及其 user_roles | 增加 tenant_id 过滤
scenario_clone.go:104-110,203-208,245-251,292-298,331-336,372-377,422-430,463-473 | P2 | 数据一致性 | 克隆各子表时 Scan 出错一律 continue 静默跳过，导致克隆结果缺失子记录且不报错 | Scan 失败应返回 error 使事务回滚
scenario_configs.go:29-34,117-124 | P2 | 租户隔离 | 两个 Upsert 的 UPDATE 分支均 WHERE id=$X 无租户过滤；且 UPDATE 后若 (scenario_id,task_id) 与他行冲突会直接报唯一约束错 | UPDATE 增加 tenant_id 过滤 + 冲突时按 ON CONFLICT 合并
scenarios.go:91-123 | P2 | 租户隔离 | Update/DELETE 无租户过滤（WHERE id=$12/WHERE id=$1），fetchScenario(162-183) 也无租户条件 | 增加 tenant 过滤
scenario_tasks.go:131-181 | P3 | 稳定性 | PopulateEvalData 吞 Scan 错误（continue）且未检查 rows.Err() | 补 rows.Err() 检查
scheduling.go:743,863 | P2 | 逻辑 bug | class_names 子查询 array_agg(o2.name ORDER BY cid) 按 class id 排序而非数组序号（应为 ORDER BY ord），class_names 与 class_node_ids 顺序错位，前后端展示班级名错配 | 改 ORDER BY ord
scheduling.go:104-114,186-205 | P2 | 稳定性 | ListPeriodSlots 直接返回 ScanPeriodSlotRows(rows)，而 ScanPeriodSlotRows 未检查/返回 rows.Err()，迭代错误被吞 | 补 rows.Err()
student_portraits.go:83-89,160-179 | P2 | 越权 | GetArchive 按 id 查询无租户过滤（DeleteArchive 却有 tenant），可读他租户档案 | GetArchive 增加 tenant 参数
student_portraits.go:274-288 | P2 | 数据一致性 | UpsertPortrait ON CONFLICT 更新 tenant_id=EXCLUDED.tenant_id，冲突时覆盖既有行租户归属 | 冲突分支不更新 tenant_id
task_evaluation.go:45-97 | P2 | 一致性 | GetRubricTemplate/Update/Delete 不过滤 is_deleted=false，与 List 不一致，软删模板仍可读/改/复用 | Get/Update 增加 is_deleted 过滤
task_evaluation.go:138-172 | P2 | 稳定性 | FetchTaskMethods 中评估点/评审步骤查询失败时 return methods, nil 静默吞错返回残缺数据 | 返回 error
task_evaluation.go:374-449 | P2 | 数据一致性 | ensureExamQuestions 只增/改不删除已移除的题目（exam_questions 遗留孤儿行），临时试卷越积越大；且每题一次 SELECT+UPDATE/INSERT（N+1）| 全量重写或删除不在列表中的行
teaching_plans.go:302-324 | P2 | 一致性/事务 | UpdatePlanEntry 的 teaching_plan_entry_classes DELETE+逐条 INSERT 错误全被 _, _= 吞掉且不在同一事务，失败留下部分/过期班级关联 | 用事务并返回错误
teaching_plans.go:128-172 | P2 | 数据一致性 | GeneratePlan 直接 DELETE 旧 teaching_plans 重建；旧计划已 confirm 或已有 schedule_entries 引用其 entries 时，级联删除会清空已排课引用（plan_entry_id FK SET NULL），已排课表丢失计划关联 | 重建前检查计划状态/引用
tenant_admins.go:128-138 | P2 | 安全 | ResetPassword 仅按 adminID 更新密码无租户过滤，handler 若漏校验可重置他租户管理员密码 | 增加 tenant 参数
training_programs.go:145-167 | P2 | 稳定性 | PutCourses 内名称兜底查询（career_positions/courses）错误被 _ = 吞掉，可插入空名课程 | 返回错误或跳过空名行
user_extension_fields.go:52-68 | P2 | 租户隔离 | Update 仅 WHERE id=$5 无租户过滤，可越权改他租户扩展字段 | 补过滤
users.go:187-203 | P2 | 数据一致性 | BatchDelete 删 user_roles+users 但未递减 roles.user_count（对比 Delete/BindRoles 均有递减），批量删除后角色计数漂移 | 删除前按受影响角色递减计数
```

## P3（摘要）
```
resource_library.go:55-58 | P3 | SQL | ILIKE 参数含 %/_ 未转义，用户可控通配符放大匹配范围 | 转义 %/_ 或用 ESCAPE
roles.go:52-62 | P3 | 一致性 | Create 无 (tenant_id,code) 重复校验，重复 code 靠唯一索引报错 | 可选
scenario_clone.go:170-185 | P3 | 竞态 | GenerateUniqueScenarioCode 先查后插且无唯一约束兜底，并发克隆同源 code 可能冲突 | 依赖唯一索引或冲突重试
scenario_clone.go:366-391 | P3 | SQL | cloneSimpleBindings 的 table/targetCol 标识符直接拼接（当前仅常量调用，安全，建议白名单防御）| 白名单校验
scenario_configs.go:223-227 | P3 | SQL | TaskIDOf 中 bindTable 标识符拼接（当前由 handler 传常量，安全）| 白名单校验
scenarios.go:162-183 | P3 | 一致性 | fetchScenario 未扫描 task_count（ListConfig 的 scanScenarioRows 有扫），Get 返回的 TaskCount 恒为 0 | 补齐列或忽略该字段
scenarios.go:202-215 | P3 | 事务/稳定性 | RecordView 两条 INSERT 非事务，view_counters 累加错误被 _, _= 吞掉 | 低危，可接受
scheduling.go:331-344 | P3 | 逻辑 | week_pattern 冲突判定 (se.week_pattern=$6 OR ='all' OR $6='all') 把 odd/even 组合也判冲突（未按奇偶周实际重叠判断），误报冲突 | 细化奇偶重叠判断
scheduling.go:617-630 | P3 | 稳定性 | PublishScheduleEntries 第二查询 Scan 错误被 _ = 忽略 | 处理 Scan 错误
scheduling.go:727-741 | P3 | 稳定性 | ScanScheduleEntryListRows 未检查 rows.Err() | 补 rows.Err()
scheduling.go:808-846 | P3 | 稳定性 | UserOrgNodeID/TimetableVersion 忽略 Scan 错误返回默认值 | 低危
staff_titles.go:38-81 | P3 | 租户隔离 | GetByID/Update/UpdateStatus/Delete 均无租户过滤，依赖 handler | 建议补过滤
store.go:216-226 | P3 | 稳定性 | withTxStore 在 beginner 为 nil（事务模式构造的 store，如 NewWithTx 后 s.beginner=nil）时调用内部开事务的 store 方法会 nil panic | 显式返回 ErrNestedTransaction
subscriptions.go:36-52 | P3 | 一致性 | GetByTenant 取最新包不按 status 过滤，可能返回 inactive 套餐 | 过滤 active
subscriptions.go:69-80 | P3 | 租户隔离 | Update 仅按 id 无租户过滤 | 补过滤
task_evaluation.go:91-97 | P3 | 租户隔离 | DeleteRubricTemplate 无租户过滤 | 补过滤
teaching_plans.go:212-221,235-270,273-299 | P3 | 一致性 | Get 等未将 ErrNoRows 转为 ErrNotFound，handler 可能返回 500 | 统一转换
tenant_admins.go:79-84 | P3 | 一致性 | 绑定 school_admin 用 SELECT ... LIMIT 1，角色不存在时静默不绑定（管理员创建成功但无角色）| 校验插入行数
tenant_admins.go:105-125 | P3 | 一致性 | Delete 对用户"全部角色"递减 user_count（WHERE id IN (SELECT role_id...)），若管理员另绑其他角色计数被误减 | 限定 school_admin
tenants.go:26-45 | P3 | 语义 | TenantStore.List 配置 TenantScoped=true + TenantColumn="id"，按租户 id 过滤后再"列表"语义存疑；平台侧应走 AdminListConfig | 确认调用方
tenants.go:424-432 | P3 | 数据一致性 | DeleteTenant 仅删 users+tenants，其余依赖 FK CASCADE；若有子表漏配级联会留孤儿 | 核对全部子表
terms.go:68-71 | P3 | 一致性 | Delete 不检查引用（CountRefs 独立存在），handler 需自行先查 | 可选
training_programs.go:244-260 | P3 | 一致性 | CloneProgram 复用源 code（无唯一约束），同租户可产生 code 重复克隆方案 | 生成唯一 code
user_extension_fields.go:71-104 | P3 | 稳定性 | EnsureDefaultSlots 迭代后未检查 rows.Err() | 补检查
user_relations.go:88-99 | P3 | 稳定性 | 列表循环后未检查 rows.Err() | 补检查
user_relations.go:112-122 | P3 | 一致性 | Create 无 (initiator,target,type) 唯一约束，可重复建同关系 | 可选
users.go:167-174 | P3 | 一致性 | Delete 递减 user_count 的 UPDATE 错误被 _, _= 忽略且两步无事务 | 返回错误/包事务
users.go:132-142,145-154 | P3 | 租户隔离 | Update/UpdateStatus/UpdateSelfName 等按 id 无租户过滤，依赖 handler | 补过滤
users.go:474-496 | P3 | SQL | ListProfiles u.id = ANY($1) 传 []string，pgx 按 text[] 编码再比较 uuid，非法 uuid 串会报错 | 用 parseUUIDs + $1::uuid[]
users.go:272-294 | P3 | 一致性 | RebindUserRole 多语句依赖调用方传 txStore，若误用池 store 会中途不一致 | 内部包事务或文档化约束
workflows.go:94-103 | P3 | 语义 | ListConfig TenantScoped=true 会把 tenant_id 为 NULL 的全局流程过滤掉（Get/Create/Update 均支持 NULL tenant），租户列表看不到全局模板 | 若需展示全局模板改 IS NOT DISTINCT FROM 条件
```

## 无问题文件
无（全部文件均存在至少一个 P3 级及以上问题）。仅 P3 级问题的文件：subscriptions.go、terms.go、workflows.go、staff_titles.go、store.go。

## 重点结论
- P1（2个，建议优先修复）：user_relations.go:52-54 搜索时 count 查询 SQL 必报错；scenario_tasks.go:95-110 Update 租户不匹配时静默返回他租户数据。
- 批量静默吞错模式在 scenario_clone.go（8 处 continue）、scheduling.go/teaching_plans.go/training_programs.go/task_evaluation.go 多处 _, _=/continue 集中出现，属本批最高频隐患。
- 租户过滤缺口为系统性模式（多数实体 store 依赖 handler 校验），重点集中在 resource_library / roles / scenarios / student_portraits / user_extension_fields / tenant_admins 的写操作。

总行数 6531
