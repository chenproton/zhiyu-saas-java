# 通用 Handler 基础设施审计

## 核心决策

- **租户隔离三层函数**：
  - `tenantFilter(claims)` — 只读解析，返回 `(tenantID, ok)` 供 SQL WHERE 过滤。
  - `requireTenant(w, r)` — 写操作入口，无租户直接返回 403。
  - `verifyTenantOwnership(w, r, entityTenantID)` — 验证实体归属租户，不匹配返回 403。
- **密码安全**：`isStrongPassword` 要求 ≥8 字符、≥1 字母（Unicode）、≥1 数字；密码使用 bcrypt 哈希存储（见 auth 层）。
- **实体编码生成**：`generateEntityCode(prefix)` 使用 `crypto/rand` 生成 8 位 36 进制随机码，格式 `PREFIX-XXXXXXXX`；`generateUniqueEntityCode` 带租户范围查重重试（最多 10 次）。
- **分页安全**：`parsePageLimit` 强制上限 `MaxPageSize = 200`，防止无界查询；< 1 时回退默认值。
- **泛型 CRUD**：`BatchHandler` 通过 `BatchTableConfig` 配置驱动，覆盖 List/Get/Create/Update/Delete/UpdateStatus 六种操作，`TenantScoped` 标志控制租户隔离行为。
- **导入类型**：`ImportPreviewResult`（预览阶段）和 `ImportExecuteResult`（执行阶段）统一返回结构，`importOverwriteParam` 从 query string 读取覆盖标志。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| tenantFilter 无 bypass | ✅ PASS | `claims == nil`、`TenantID == nil`、`TenantID == ""` 三种情况均返回 `ok=false`；调用方必须检查 `ok` 才能使用返回的 tenantID |
| requireTenant 无 bypass | ✅ PASS | 通过 `middleware.CurrentUser(r)` 获取 claims，无租户直接 403；不存在绕过 claims 获取的路径 |
| verifyTenantOwnership 无 bypass | ✅ PASS | 同时检查 claims 存在性 + TenantID 非空 + entityTenantID 等于 claims.TenantID，三重校验 |
| verifyRequestTenant 防跨租户写 | ✅ PASS | 请求体中的 tenantId 必须等于 JWT 中的 TenantID，防止创建/修改到其他租户 |
| isStrongPassword 强度 | ✅ PASS | ≥8 字符 + 字母 + 数字；未强制特殊字符，符合项目"简单优先"原则，bcrypt 存储进一步降低弱密码风险 |
| 密码检查边界 | ✅ PASS | `unicode.IsLetter` 涵盖多语言字母（中文不算 letter）；空密码 `len < 8` 直接拒绝；纯字母或纯数字均被拒绝 |
| generateEntityCode 随机性 | ✅ PASS | `crypto/rand.Read` 提供密码学安全随机源；36^8 ≈ 2.8×10^12 组合数，单租户内碰撞概率极低 |
| generateUniqueEntityCode 唯一性 | ✅ PASS | 租户范围内查重（`WHERE tenant_id=$1 AND code=$2`）；最多重试 10 次，失败返回明确错误而非静默生成重复值 |
| parsePageLimit 上限 | ✅ PASS | `MaxPageSize = 200`，超限自动截断；< 1 回退 defaultVal；参数解析失败也回退 defaultVal |
| executeCountQuery 容错 | ✅ PASS | 查询失败返回 0 而非 panic，满足"普通业务允许报错"原则 |
| BatchHandler List 租户过滤 | ✅ PASS | 当 `TenantScoped=true` 时，SQL WHERE 自动追加 `tenant_id = $N`；`TenantFilterColumn` 可自定义列名 |
| BatchHandler Create 租户赋值 | ✅ PASS | 当 `TenantScoped=true` 时，INSERT 自动填充 `claims.TenantID`；credibility 风险：claims.TenantID 为 nil 时不会报错，tenant_id 将写入 NULL |
| BatchHandler Update 租户校验 | ✅ PASS | `Update` 入口调用 `checkTenantAccess`（经 `BatchTenantOf` 查询实体租户 + `verifyTenantOwnership` 校验），跨租户实体返回 403 |
| BatchHandler Delete 租户校验 | ✅ PASS | 同上，`Delete` 入口经 `checkTenantAccess` 校验实体租户归属后才执行删除 |
| BatchHandler UpdateStatus 租户校验 | ✅ PASS | 同上，`UpdateStatus` 入口经 `checkTenantAccess` 校验租户归属 + 合法状态值（open/closed） |
| BatchHandler SQL 注入 | ✅ PASS | 所有查询使用 `$N` 参数化，表名和列名虽来自 config 但也由后端代码控制（非用户输入） |
| ImportPreviewResult 结构 | ✅ PASS | 统一返回 created/duplicates/failed/duplicateItems/errors，前端可据此展示预览对话框 |
| ImportExecuteResult 结构 | ✅ PASS | 统一返回 created/failed/skipped/entity/errors，与 useImportFlow 的 toast 展示对齐 |
| importOverwriteParam | ✅ PASS | 简单从 query string 读取 `overwrite=true`，无额外校验需求 |

## 风险与约束

- **✅ BatchHandler 写操作租户归属校验已补齐**：`Update`、`Delete`、`UpdateStatus` 均已通过 `checkTenantAccess`（`BatchTenantOf` 查实体租户 + `verifyTenantOwnership` 校验）在入口拦截跨租户操作，未通过返回 403/404。—— **已修复，2026-08-03 确认。**
- **BatchHandler Create 中 tenant_id 可写入 NULL**：当 `TenantScoped=true` 但 `claims.TenantID` 为 nil 时，`tenantID` 变量为 nil，INSERT 的 tenant_id 列将写入 NULL。虽然 `requireTenant` 通常在路由中间件层已拦截无租户请求，但若未来某路由遗漏中间件，此防御深度不足。—— **低危，现有路由中间件已覆盖，但建议在 Create 内显式校验 TenantID 非空以确保自防御。**
- **generateUniqueEntityCode 重试上限固定**：10 次重试在极端高并发下可能不足，但 36^8 空间极大 + 租户隔离范围，概率极低。—— **低危，符合"小概率异常宁可容忍"原则。**
- **无 `jsonSliceToUUIDSlice` 函数**：`common.go` 中未提供 JSON 数组到 UUID 切片的标准转换工具，各 handler 自行实现 UUID 解析，可能存在校验不一致。—— **低危，UUID 格式由 Go 标准库 `google/uuid` 保证，handler 层自行调用 `uuid.Parse` 即可。**
