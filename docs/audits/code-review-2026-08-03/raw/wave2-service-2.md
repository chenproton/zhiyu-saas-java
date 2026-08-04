# service 批次2 审查（25文件，1914行）

## P1
```
task_evaluation.go:35-44,50,68-89 | P1 | 并发/锁 | SaveMethods 乐观锁版本检查(36-44)在事务外执行，且 version<=0 时直接跳过检查(36)；两个并发提交读到相同 currentVersion 都通过，store 的 UPSERT(无版本守卫)静默覆盖——双提交/重复提交不被识别，静默丢更新 | 将 MaxMethodVersion 检查移入 WithTx 内（或 UPSERT 加 WHERE version<=$x / 行锁 / advisory lock）
```

## P2
```
task_evaluation.go:52-66 | P2 | 数据一致性 | 临时考试联动（createTempExam/exam_usages/exam_questions）在事务外用 s.st.Q() 执行：后续保存 tx 失败会留下孤儿 exams/usages；且"SELECT 存在性+INSERT"非原子，并发保存会重复建临时考试；EnsureExamUsageForMethod 错误仅 slog 后 continue(60)，resourceConfig 静默丢失 examId/usageId | 将联动移入同一事务，或失败后补偿删除临时考试；存在性检查用 ON CONFLICT
position.go:82-115 | P2 | 数据一致性/错误处理 | SaveFull 的 PrepareAbilityPoint(95)/PrepareCertificate(108) 在 WithTx 之外执行，err 被 continue 静默吞掉(97,110)：DB 故障时该能力点/证书绑定被无声丢弃，且准备动作与后续事务非原子（tx 失败留下孤儿 ability_points/certificate_library 行） | 用 txStore 在同一事务内 prepare，prepare 失败返回错误或至少记录日志
position.go:82-115 | P2 | 性能 | 每个自定义能力点/证书执行 3 条 SQL（SELECT+INSERT+SELECT）逐条循环（N+1），大岗位保存可达数十次串行查询且在事务外 | 合并为批量 upsert（unnest / VALUES 列表）
org.go:93-97 | P2 | 错误分类 | ValidateOrgRefs 将真实 DB 错误（连接失败等）一并归入 ErrOrgParentInvalid→400"上级组织 ID 无效"，掩盖系统故障 | 先 if err != nil { return err } 再单独判断 tenant 归属
org.go:48,68 | P2 | 越权(防御性) | OrgService.Update 无 tenantID 参数，store Update 仅 WHERE id=$5 不限定租户；隔离完全依赖 handler 的 verifyTenantOwnership，服务边界缺防御 | Update 增加 tenantID 并在 store 加 AND tenant_id
tenant_admin.go:64-72 | P2 | 越权(防御性) | ResetPassword 无 tenantID 参数，store ResetPassword(tenant_admins.go:128-138) 仅按 adminID 更新（无 tenant 过滤），与同文件 Update/Delete/Get 均带 tenantID 不一致 | 签名加 tenantID，SQL 加 AND tenant_id=$x
user.go:78-100 | P2 | 越权(防御性) | Update 未校验 existing.TenantID == tenantID：ValidateOrgMajor 用 existing.TenantID(87) 而 RebindUserRole 用调用方传入的 tenantID(94)，二者不一致时角色可绑到错误租户 | 入口断言 *existing.TenantID == tenantID，全部用 existing.TenantID
user.go:53-75 | P2 | 错误处理 | BatchCreate 注释称"跳过重复项"，但 seen 仅覆盖批内重复；库内已存在账号触发唯一约束时 return err 使整个批次回滚失败，与"跳过"语义不符 | 捕获唯一约束错误跳过该条（或提前批量预查去重）
teaching_plan.go:45-56 | P2 | 并发/锁 | FindTeachingPlanExisting 与 GenerateTeachingPlan 分离且非原子：并发双击"生成"时两事务 DELETE 均见 0 行（READ COMMITTED），后到者 INSERT 撞 UNIQUE(program_id,term_id) 报 500；教学计划生成属核心提交 | 生成前用 advisory lock(program_id,term_id) 或 INSERT ... ON CONFLICT DO NOTHING 幂等化
scenario.go:163-164 | P2 | 分层规范 | BatchGetByTable 把未扫描的裸 pgx.Row 上抛至 service/handler，游标/连接句柄泄漏到上层且 Scan 错误处理分散 | service 内完成 Scan，返回具体类型
```

## P3
```
user.go:147-158 | P3 | 越权(防御性) | BindRoles 仅校验 roleIDs 属于 tenant，未校验 userID 属于该租户 | 服务内校验用户归属
position.go:86,100 | P3 | 逻辑 bug | abilityPointMap 以客户端 b.ID 为 key，客户端传重复 ID 时后者覆盖前者导致绑定丢失 | 改用服务端生成的唯一 key
position_clone.go:33 | P3 | 越权 | 源岗位 tenant_id 为 nil（公共岗位）时任意租户可克隆(33-35)，且克隆继承源 BatchID/Collaborators(70,72)——公共模板指向他租户对象的引用被带入 | 克隆时校验/清理跨租户引用
scenario.go:59 | P3 | 越权 | CloneScenario 同样对 nil-tenant 公共场景放行并继承 co_builder_ids 等跨租户引用 | 同 position_clone
org.go:74-81 | P3 | 并发/TOCTOU | Delete 的 SubtreeIDs 在事务外先查、事务内再删，窗口期内新增子节点会残留孤儿 | SubtreeIDs 移入同一事务（或 SELECT FOR UPDATE）
user_relation.go:27-36 | P3 | 并发/TOCTOU | UsersExist 校验与 Create 分离非原子（且 Create 未走事务），极端并发可产生越租户/重复关系 | 校验并入 Create 事务内
user_extension_field.go:22-27 | P3 | 稳定性 | List(GET) 触发 EnsureDefaultSlots 写库（GET 带副作用）| 槽位补齐移到建租户时
teaching_plan.go:64-70,79-80 | P3 | 越权(防御性) | FetchTeachingPlanCourses/FetchPositionScenarios/TeachingPlanScheduledCount 均无 tenantID，服务边界不校验 | 补 tenantID 或在 store 限定租户
training_program.go:40-54 | P3 | 越权(防御性) | ListTrainingProgramCourses/GetTrainingProgramByID 无 tenantID，隔离依赖 handler | 补 tenantID
workspace_stats.go:12-114 | P3 | 错误处理 | 全部统计方法吞错误返回零值，DB 故障时前端呈现"0"而非报错 | 关键入口返回 error 或至少记录日志
scenario.go:89 | P3 | 错误处理 | ListTasks 忽略 PopulateEvalData 的返回 | 确认该方法不需要失败传播
```

## 无问题文件（13个）
node_evaluation_result.go、portal.go、position_config.go、recommend.go、resource.go、resource_binding.go、resource_code.go、scenario_config.go、service.go、subscription.go、tenant.go、term.go、workflow.go

## 汇总要点
- P1（1条）：task_evaluation.go SaveMethods 乐观锁为典型 TOCTOU（版本检查在事务外 + version=0 跳过 + UPSERT 无守卫），重复提交静默覆盖，属"评价提交防重复"失守。
- P2（9条）：跨租户防御性缺口集中在 org.go/tenant_admin.go/user.go（服务边界无 tenantID，store 更新仅按 id）；position.go SaveFull 事务外 prepare + 吞错；teaching_plan.go 生成并发无锁；task_evaluation.go 临时考试联动事务外留孤儿。
- 未见 P0；handler 层大多已用 verifyTenantOwnership 兜底，上述多为服务边界防御纵深缺口。

总行数 1914
