# 认证授权与安全审计

## 核心决策

- **双平台 JWT 认证**：系统通过 `platform` 字段区分两个独立的认证通道，各自持有独立 token：
  - SaaS 平台（商城 + 运营后台）：token 存储键 `zhiyu-token`，登录入口 `/login`，对应 `saas` 平台。
  - Portal 平台（教育管理）：token 存储键 `zhiyu-portal-token`，登录入口 `/portal/login`，对应 `portal` 平台。
- **JWT 结构**：HS256 签名，7 天有效期。Claims 包含 `UserID`、`TenantID`、`InstitutionID`、`RoleCodes`（角色代码数组）、`OrgNodeID`、`Role`、`Platform`、`Username`、`Permissions`（从角色合并的 JSON 权限图）。
- **多租户登录流程**：
  1. 单租户用户：直接验证密码后签发 token。
  2. 多租户用户：先签发 1 分钟有效期的 `preAuthToken`（含 JTI nonce），前端展示租户选择列表，用户选择后调用 `SelectTenant` 接口签发正式 token。
- **RBAC 权限体系**：
  - `RequireRole(codes...)` 检查角色代码。
  - `RequirePermission(module, page, action)` 检查细粒度操作权限。
  - `admin: true` 权限绕过所有 `RequirePermission` 检查。
- **平台隔离**：`RequirePlatform(platform)` 中间件强制 JWT 中的 `Platform` 字段匹配目标平台，拒绝跨平台请求。
- **密码策略**：≥8 字符、≥1 字母、≥1 数字，bcrypt 哈希存储。
- **操作审计**：`OperationLog` 中间件自动记录所有 POST/PUT/DELETE 操作到 `operation_logs` 表，跳过 `/behavior-collection/` 和 `/view` 路径。
- **登录日志**：每次登录记录 IP、设备（UA 截断）、状态。
- **超时保护**：`/api/v1` 路由组全局 30 秒超时。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| JWT 签发与验证 | PASS | `middleware/auth.go` 实现 HS256 签发，`JWT` 中间件统一拦截 |
| 平台隔离 | PASS | `RequirePlatform` 强制区分 saas/portal |
| 多租户选择 | PASS | `SelectTenant` 实现 preAuth→选择→签发完整 token 流程 |
| RBAC 权限校验 | PASS | `RequireRole`/`RequirePermission`/`RequireSystemPermission` 三层检查 |
| 权限合并 | PASS | 登录时合并用户所有角色的 permissions JSON，写入 JWT |
| 密码安全 | PASS | bcrypt 哈希；密码在 API 响应中始终被剥离 |
| 操作审计日志 | PASS | `OperationLog` 中间件记录所有写操作；25+ 模块名中文映射 |
| 登录日志 | PASS | 每次登录记录 IP、设备、状态 |
| 路由权限分层 | PASS | 公开路由 → 认证路由 → 平台管理员 → 系统管理员 → 业务用户 |

## 风险与约束

- **管理员租户控制台未鉴权**：`/api/v1/admin/tenants` 路由组无认证保护（产品决策），仅在前端隐藏入口。若 API 地址暴露，任何人可操作租户数据。—— **高危，需评估是否加鉴权。**
- **跨域 CORS 当前为 `*`**：允许任意来源访问。生产环境需收紧为具体域名。
