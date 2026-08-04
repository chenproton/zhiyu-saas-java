# store 批次3 审查（21文件，5344行）

## P2
```
organizations.go:265-278 | P2 | 逻辑 bug | scanOrgRows 返回 items, nil 而非 rows.Err()，遍历中的连接/扫描错误被静默吞掉 | 改为 return items, rows.Err()
organizations.go:75-99 | P2 | 越权 | MemberCounts 在 tenantID 为空时无兜底（Tree 用 1=0，此处直接返回全租户各组织人数）| 空租户时加 AND 1=0 或返回空 map
portal.go:558-589 | P2 | 稳定性 | ListClassPlans 第573行无条件解引用 *tenantID，与同文件其它方法不一致，tenantID 为 nil 即 panic（当前唯一调用方 handler 有前置 guard，属潜伏风险）| 补 nil 判断或用 ($2::uuid IS NULL OR ...)
micro_cert.go:110-116 | P2 | 越权 | DeleteTemplate 无租户参数、DELETE 无 tenant_id 过滤，可删除任意租户模板及其发放记录 | 增加 tenantID 参数并加 WHERE tenant_id 过滤
random_draw_questions.go:49-66 | P2 | 越权 | Update/Delete 无 tenantID 参数、无 tenant 过滤，可跨租户改删 | 增加 tenantID 参数 + WHERE tenant_id
resource_codes.go:48-65 | P2 | 越权 | Update/Delete 无 tenantID 参数、无 tenant 过滤 | 增加租户参数与过滤
majors.go:64-81 | P2 | 越权 | Update/Delete 仅按 id 过滤、无 tenant_id | 增加租户过滤
org_types.go:62-73 | P2 | 越权 | Update/Delete 无租户过滤 | 增加租户过滤
on_site_question_library.go:76-87 | P2 | 越权 | Update/Delete 无租户过滤 | 增加租户过滤
position_bindings.go:56-77,193-211 | P2 | 越权 | PositionAbilityStore/PositionResponsibilityStore 的 Update/Delete 无租户过滤 | 加租户校验
position_certificates.go:23-66 | P2 | 越权 | List 无租户过滤（仅按 career_position_id），可跨租户读取岗位证书 | 增加 tenantID 过滤
positions.go:463-494 | P2 | 数据一致性 | ToggleFavorite 非事务：先查再删/插 + favorite_counters 另条语句，并发下计数漂移；counter 更新错误被 _, _= 吞掉 | 事务包裹或用单条 SQL 原子更新
question_banks.go:154-166 | P2 | 数据一致性 | Delete 非事务执行 3 条 DELETE（kp/questions/bank），中途失败留孤儿数据 | 用 withTxStore 包裹
```

## P3（摘要）
```
org_types.go:102-109 | P3 | 逻辑 | ListConfig ExtraFilter 再拼 tenant_id 与 TenantScoped 重复（同时传值生成两个租户条件）| 去掉 ExtraFilter 中的 tenantId
position_certificates.go:148-164 | P3 | 数据一致性 | findOrCreateLibrary 未区分 SELECT 错误类型（非 ErrNoRows 也继续 INSERT），且无 ON CONFLICT，并发可撞唯一约束 | 用 errors.Is(err, pgx.ErrNoRows) 判断 + ON CONFLICT DO NOTHING
positions.go:314-323 | P3 | 死代码 | SaveFull 遍历 certificateMap 时 _ = name 无用变量 | 用 for _, libID := range certificateMap
positions.go:395-418,421-441 | P3 | 逻辑 | PrepareAbilityPoint/PrepareCertificate 首条 SELECT 遇非 ErrNoRows 错误也继续 INSERT（掩盖连接错误）| 先判断错误类型
question_banks.go:169-191 | P3 | 并发 | EnsureDraftPool 先 COUNT 后 INSERT，无 ON CONFLICT/唯一约束，并发会重复创建草稿池 | ON CONFLICT DO NOTHING 幂等 upsert
question_banks.go:218-283 | P3 | 重复代码 | fetchBank 与 fetchBankScoped 两段大 SQL 完全重复 | 抽取公共私有方法
question_banks.go:81-112 | P3 | 稳定性 | Create 未检查 s.beginner 为 nil 就调 withTxStore（Update 有检查）| 与 Update 一致补 nil 检查
node_quizzes.go:120-130 | P3 | 数据一致性 | AddQuestion 不校验 quiz 归属，tenant_id 由调用方传入，传错会把题目写入错误租户 | 插入前校验 quiz 属于该租户
node_evaluation_results.go:33-36 | P3 | 逻辑 | isStudent 分支 studentUserId 为空时仍拼 evaluatee_id = $N（空串），返回空结果语义含糊 | 为空时跳过过滤
resource_bindings.go:108-128,132-147 | P2 | SQL 注入面/稳定性 | bindTable/bindCol 直接字符串拼接进 SQL、无白名单校验（依赖调用方传固定值）；绑定插入与 afterBind 错误全部 _, _=/_ = 忽略 | 对 bindTable/bindCol 做白名单校验并处理错误
resource_bindings.go:231-305 | P2 | 性能 | ListCourseResources 的 limit 未钳制到 maxPageSize（默认 200、可无限大）| 加 if limit > maxPageSize { limit = maxPageSize }
resource_bindings.go:151-164,167-171 | P3 | 越权 | Unbind/BindTargetID 按绑定 id 操作且无租户校验 | 加租户过滤
resource_bindings.go:308-316 | P3 | 逻辑 | CourseSyncBind 当 resource_ids 为 NULL 时 NOT ($2 = ANY(NULL)) 为 NULL，UPDATE 静默失败 | 用 COALESCE(resource_ids,'{}')
position_clone.go:147-153,187-194,234-240,270-276 | P2 | 数据一致性 | 各 clone 函数 rows.Scan 出错仅 continue，克隆数据静默缺失、事务仍提交 | 扫描错误应返回 err
query.go:27-38,131,163,255 | P3 | 维护性 | 表串/SelectColumns 白名单与各 store 中 Table/SelectColumns/OrderBy 常量存在两份完全相同的拷贝，任一处改动不一致即线上 500 | 改为从常量生成白名单或在单测中比对一致性
```

## 无问题文件
- backend/internal/store/query_normal_test.go
- backend/internal/store/query_test.go
- backend/internal/store/recommends.go
- backend/internal/store/questions.go

## 重点结论
scanOrgRows 漏 rows.Err()、ListClassPlans 的 *tenantID 解引用、QuestionBankStore.Delete 非事务三连删、ToggleFavorite 计数漂移为本批最值得优先修复的 4 处。UPDATE/DELETE 无租户过滤在多数文件中属 handler 层校验的既有模式，但方法签名未携带 tenantID 的建议补齐防御。

总行数 5344
