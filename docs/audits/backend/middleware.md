# 中间件层审计

## 核心决策

- **操作日志 `OperationLog`**：`oplog.go` 中间件记录所有 POST/PUT/DELETE 操作到 `operation_logs` 表。跳过两种路径：`/behavior-collection/`（高频行为采集）和 `/view`（资源浏览统计），通过 `strings.Contains` 前缀匹配。仅记录携带有效 `tenantId` 的请求。
- **日志数据捕获**：`tenant_id`、`user_id`、`user_name`（从 DB 查 `users.name` 字段，回退到 JWT `username`）、`module`（URL 第一段，经由 29 项中英文映射表转中文）、`action`（URL 末段匹配 23 项动作映射表，未匹配则按 method 映射为"创建/更新/删除"）、`target_type`（UUID 段之前的路径段）、`target_id`（路径中的 UUID 段）、`detail`（`HTTP_METHOD URL_PATH`，含完整 query string）、`ip`（`RemoteAddr`）、`status`（≥400 为 `failed`，其余为 `success`）。
- **路径解析 `describeOperation`**：以 `/api/v1/` 为前缀剥离 → 按 `/` 切割 → 第一段为 module → 末段为 action 候选 → 扫描 UUID 段提取 targetType/targetID。未匹配到 UUID 或末段已命中动作映射表时，targetID/targetType 为 nil。
- **RBAC 权限体系**：`RequireRole(codes...)` 检查 JWT `RoleCodes` 列表成员；`RequirePermission(module, page, action)` 检查 JSON 权限图的 `permissions[module][page][action]` 或 `permissions[module][page].buttons[]` 包含关系，`admin: true` 权限绕过所有检查；`RequireSystemPermission()` 检查菜单权限 `/portal/apps/system` 前缀 + 角色级 `school_admin`/`platform_admin` 兜底。
- **平台隔离 `RequirePlatform`**：`platform.go` 中间件在 auth 之后检查 JWT `Platform` 字段与路由声明的平台匹配，不匹配返回 403。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 操作日志路径排除 | PASS | `/behavior-collection/` 和 `/view` 被正确跳过，不写入 `operation_logs` |
| 操作日志数据完整性 | PASS | 记录 tenant/user/module/action/targetType/targetId/detail/ip/status 共 10 个字段 |
| 模块名中文映射 | PASS | 29 项映射覆盖租户/组织/用户/岗位/场景/课程/评价/资源/订单等全模块 |
| 动作名映射 | PASS | 23 项映射（status/review/publish/submit/archive 等），未匹配时按 method 映射 |
| UUID 目标自动提取 | PASS | 通过正则匹配 `[0-9a-fA-F]{8}-...` 自动识别 targetID 和 targetType |
| 操作日志写入失败容错 | PASS | DB 写入失败仅 `slog.Warn` 记录，不中断请求 |
| RequireRole 权限校验 | PASS | 遍历 JWT RoleCodes 精确匹配；空参数直接拒绝；nil claims 返回 401 |
| RequirePermission 权限校验 | PASS | 支持 `[]` 和 `{buttons:[]}` 两种权限格式；admin 标志全局豁免 |
| RequireSystemPermission | PASS | school_admin / platform_admin / 空权限对象兼容 + /portal/apps/system 菜单匹配 |
| HasSystemPermission 空权限兼容 | PASS | `permissions` 为空或无 `menus` 键时返回 `true`，向后兼容默认 school_admin 角色 |
| RequirePlatform 平台隔离 | PASS | JWT Platform 字段与路由声明精确匹配，不匹配返回 403 |

## 风险与约束

- **操作日志 detail 含 query string 敏感信息**：`detail` 字段直接写入 `r.URL.Path`（含完整 query string），若请求参数中包含明文密码、token 等敏感字段会被写入 `operation_logs` 的 `detail` 列并以明文形式持久化存储。—— **中危，建议 `detail` 仅写入 path 而不含 query string。**
- **操作日志跳过匹配过于宽松**：使用 `strings.Contains` 前缀匹配 `/behavior-collection/` 和 `/view`，任何路径段中包含这两个字符串的合法操作路径也会被跳过（如 `/api/v1/resource/view-analytics`）。—— **低危，当前业务路径无此冲突，但匹配精度不足。**
- **`admin: true` 绕过所有细粒度权限**：`hasPermission` 函数中 `permissions.admin == true` 跳过所有 module/page/action 匹配，开发者角色若误配 `admin: true` 会获得全局最高权限。—— **中危，建议对 admin 权限也保留 platform 校验层。**
- **`HasSystemPermission` 空权限向后兼容**：权限对象为空时返回 `true`，意味着未配置菜单权限的角色默认拥有系统管理权限。这在灰度迁移期是合理妥协，但长期应要求显式配置。—— **低危。**
- **`RequireRole` 无 allow-list**：中间件本身不做路径级角色白名单校验，路由声明错误可能导致权限过宽。当前由路由层 `r.Group` 统一管理，在 `router.go` 中逐组声明，结构清晰。—— **可接受。**

## 性能约束

- 操作日志每次 POST/PUT/DELETE 产生两次 DB 查询：一次查 `users.name`，一次 `INSERT INTO operation_logs`。高频写操作场景（如批量导入）会产生大量日志写入。—— **P3，可考虑批量写入或异步队列化，参见 `performance-maintainability.md#六`。**
