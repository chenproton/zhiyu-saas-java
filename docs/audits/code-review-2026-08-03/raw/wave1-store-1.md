# store 批次1 审查（21文件，4250行）

## P1
```
alliance_achievement_store.go:89-104 | P1 | SQL越权 | UpdateAchievement 的 UPDATE 仅 WHERE id=$20，无 tenant_id 过滤，租户A可篡改租户B的成果 | WHERE 增加 AND tenant_id=$21 并传参，与 Delete/Get 保持一致
alliance_agreement_store.go:72-81 | P1 | SQL越权 | UpdateAgreement 仅 WHERE id=$10 无租户过滤 | 补 tenant_id 条件
alliance_brand_store.go:80-93 | P1 | SQL越权 | UpdateBrand 仅 WHERE id=$16 无租户过滤 | 补 tenant_id 条件
alliance_enterprise_store.go:213-230 | P1 | SQL越权 | UpdateEnterprise 仅 WHERE id=$25 无租户过滤 | 补 tenant_id 条件
alliance_enterprise_store.go:317-325 | P1 | SQL越权 | UpdateEnterpriseAgreement 仅 WHERE id=$8 无租户过滤 | 补 tenant_id 条件
alliance_expert_store.go:95-111 | P1 | SQL越权 | UpdateExpert 仅 WHERE id=$27 无租户过滤 | 补 tenant_id 条件
alliance_project_store.go:114-125 | P1 | SQL越权 | UpdateProject 仅 WHERE id=$14 无租户过滤 | 补 tenant_id 条件
certificate_library.go:68-79 | P1 | SQL越权 | Update/Delete 均无 tenant 过滤（方法签名甚至无 tenantID 参数），可跨租户改删证书库条目 | 方法增加 tenantID 并 WHERE id=$x AND tenant_id=$y，与 List(TenantScoped) 对齐
cert_grades.go:47-54 | P1 | 逻辑bug/Scan | last_updated 为 timestamptz，pgx 二进制协议仅支持 TimestamptzScanner，扫描进 *string 必失败（已核实 vendor TimestamptzCodec.PlanScan 不支持 *string）；且 Scan 错误被 continue 吞掉→一旦任一行的 last_updated 非空，该行及后续全部被静默丢弃，ListGrades 恒返回空 | 改为 *time.Time 或 pgtype.Timestamptz，再用 formatDate 转换；且不要 continue 吞错
```

## P2
```
alliance_store.go:71-73 | P2 | 死代码/逻辑bug | nilToEmpty 是恒等函数 return s，注释意图是空串转 nil；UpsertSchoolInfo(65行) 传 nilToEmpty(info.ID)，info.ID 为空串时 INSERT id=COALESCE('', gen_random_uuid())→'' 写入 uuid 列直接报错 | 改为 func nilToEmpty(s string) *string { if s==""{return nil}; return &s }
alliance_store.go:78-86 | P2 | 稳定性/错误吞没 | queryList 中 items,_ := scan(rows) 忽略 scan 错误与 rows.Err()，扫描中途出错时返回残缺数据当成功 | 返回 scan 的 error 并检查 rows.Err()
alliance_store.go:105-118 | P2 | SQL越权 | ListEnterpriseAgreements 仅 WHERE enterprise_id=$1 无租户过滤，传外部企业ID可读他人协议 | 增加 tenantID 参数过滤
alliance_store.go:120-126 | P2 | SQL越权 | ListMilestones 仅 WHERE project_id=$1 无租户过滤 | 增加 tenantID 过滤
ability_domains.go:26-70 | P2 | SQL越权 | Get/Update/Delete 均不按租户过滤，而 List 配置 TenantScoped=true，行为不一致，可跨租户读/改/删能力域 | Get/Update/Delete 增加 tenantID 参数
batches.go:40-53 | P2 | SQL越权 | GetByTable 仅 WHERE id=$1 无租户过滤 | 依赖调用方先 TenantOf，需在文档/注释强制约定或直接加租户条件
batches.go:204-238 | P2 | SQL越权 | UpdateFields/Delete/UpdateStatus 均仅按 id 过滤，无租户条件，任何 handler 忘记 TenantOf 校验即越权写 | 增加 tenantID 入参并在 WHERE 限定
certificate_library.go:40-54 | P2 | SQL越权 | GetByID 无租户过滤，与 ListConfig(TenantScoped) 不一致 | 增加 tenantID 参数
```

## P3
```
abilities.go:108-111 | P3 | 逻辑bug | isPublic 过滤仅当 Values=="true" 时生效，传 "false" 不会过滤出私有项 | 与 banners.go 一致用 != "" 判断
alliance_store.go:26-53 | P3 | 错误处理 | GetSchoolInfo 直接返回 pgx.ErrNoRows，未统一转 ErrNotFound | 参照其他 Get 做 errors.Is 转换
alliance_store.go:377-385 | P3 | 性能/错误吞没 | GetPublicStats 5 个顺序 COUNT 查询且全部忽略 Scan 错误，失败时静默返回全 0 | 可合并为单条子查询；Scan 错误应返回
alliance_dictionary_store.go:25-35 | P3 | 数据一致性 | CreateDictionary 无查重，(tenant_id,dict_type,code) 唯一冲突时直接抛原始 DB 错误 | 捕获 23505 转业务错误
alliance_enterprise_store.go:334-356 | P3 | 数据泄露 | ListPublicEnterprises/GetPublicEnterpriseByID 向公开门户返回 contact_person/contact_phone/contact_email/address 等敏感字段 | 公开接口裁剪字段
approvals.go:86-110 | P3 | 数据一致性 | Create 的 ExistsPending 先查后插存在 TOCTOU，唯一索引兜底但冲突时返回原始 23505 而非 ErrApprovalExists | 捕获唯一冲突映射为 ErrApprovalExists
approvals.go:73-82,185-202 | P3 | SQL越权 | Get/fetchApproval 无租户过滤，依赖调用方校验返回体中的 tenant_id | 与 List 的 TenantScoped 保持一致或注明调用方必须校验
approvals_test.go:18-24 | P3 | 测试缺陷 | fakeApprovalTx.Query/QueryRow 返回 nil，一旦未来测试触发迭代/扫描将空指针 | 返回空实现而非 nil
auth.go:54-56 | P3 | 错误吞没 | FindUsersByUsername Scan 错误 continue 静默跳过，匹配用户被丢弃导致登录异常 | 记录日志并返回错误
auth.go:77-87 | P3 | 错误吞没 | UpdateLastLogin/RecordLoginLog 忽略 Exec 错误且无日志 | 至少 slog.Error 记录
auth.go:139 | P3 | 错误吞没 | GetInstitution 忽略 ListInstitutionTags 错误，标签丢失时静默返回空 | 日志记录
auth.go:154-156 | P3 | 错误吞没 | ListInstitutionTags Scan 错误 continue | 返回错误
auth.go:163-216 | P3 | 错误处理 | GetTenantByID/GetOrganizationByID/GetMajorByID 吞掉全部错误返回 nil，连接级故障与不存在不可区分 | 改为返回 (T, error)
auth.go:219-267 | P3 | 错误吞没 | ListUserRoles/ListUserRoleCodes Scan 错误 continue 且不检查 rows.Err()，返回部分角色列表 | 检查 rows.Err()
batches.go:177-201 | P3 | 稳定性 | CreateFields 未校验 len(extraCols)==len(extraVals)，数量不匹配时产生占位符错位 SQL 错误 | 入参即校验
batches.go:21-37 / batch_configs.go:44-135 | P3 | 重复代码 | SelectColumns/Join 表名在 batch_configs 与 batches.go 白名单重复维护，改动需同步两处 | 单一数据源生成
certifications.go:529-539 | P3 | 错误吞没 | ScanCertificationRuleRows 返回 items,nil 未检查 rows.Err() | 返回 rows.Err()
certifications.go:87-95 | P3 | 逻辑bug | FindRuleByPosition LIMIT 1 无 ORDER BY，岗位存在多条规则时返回任意一条（与 FindRuleIDForPosition 优先 published 不一致） | 补 ORDER BY updated_at DESC 或 status 优先
certifications.go:206-215 | P3 | 数据一致性 | DeleteItem 先删 points 再删 item，两步无事务，第二步失败会留下无点的孤儿 item | 用 withTxStore 包裹
content_actions.go:141-176 | P3 | SQL越权 | Review/Invite 无租户过滤，依赖调用方先调 GetTenantID 校验，约定脆弱 | 在方法内透传 tenant 或注释强约束
```

## 无问题文件
- banners.go
- alliance_permission_store.go

总行数 4250
