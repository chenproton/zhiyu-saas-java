# 多租户与组织用户管理审计

## 核心决策

- **多租户隔离**：所有业务数据通过 `tenant_id` 字段隔离。`common.go` 中 `tenantFilter()`/`requireTenant()`/`verifyTenantOwnership()` 三个层级强制所有查询和写入操作绑定当前用户的租户。平台管理员不自动获得跨租户读取权限。
- **租户创建流程**（事务性）：创建租户时自动生成：1 个默认订阅包（5 个模块）、5 个默认组织类型（学校/二级学院/专业/班级/行政职能部门）、4 个默认角色（`school_admin`/`teacher`/`student`/`enterprise_mentor`）、1 个管理员用户（随机生成初始密码，创建响应中一次性返回），并绑定 `school_admin` 角色。
- **组织架构树**：`organizations` 表通过 `parent_id` 实现层级树。`Tree` 接口构建内存树并计算每个节点的累计成员数。更新时通过递归 CTE 防环引用；删除时检查子节点和用户引用。
- **用户管理**：
  - `login_name` 全局唯一性通过 `tenantID + "_" + rawLoginName` 拼接实现。
  - 支持单个创建、批量创建（事务内去重）、批量毕业、批量删除。
  - `BindRoles` 接口原子替换所有角色绑定，至少绑定 1 个角色。
- **角色权限管理**：`RoleHandler` 提供 CRUD + `Assign`（追加绑定）。权限结构为 `{ menus: {}, moduleName: { pageName: { buttons: [] } } }`。
- **用户扩展字段**：最多 20 个自定义扩展字段槽位，通过 `slot_index` 定位。
- **组织类型管理**：`OrgTypeHandler` 实现 CRUD，组织类型分三类（`internal` 内部 / `business` 业务 / `external` 外部），默认类型受保护不可删除，删除时检查是否被 `organizations` 引用。
- **用户关系管理**：`UserRelationHandler` 管理用户间的关联关系（发起人 → 目标，含关系类型），创建时校验双方均属于当前租户且不允许自关联，支持按用户名搜索。当前实现为 List/Create/Delete（未提供 Get/Update）。
- **基础数据**：`majors`（专业）、`industries`（行业两层级树）、`resource_codes`（资源编码）、`staff_titles`（职工职称）均支持租户范围唯一约束。
- **基础数据 Excel 导入/导出/模板下载**：`ResourceImportHandler` 支持行业、专业、组织、学生、教师的 Excel 批量导入与预览；`ResourceExportHandler` 支持组织、学生、教师的 Excel 导出；`TemplateHandler` 提供对应标准模板下载。
- **超管控制台**：`TenantHandler` 提供 `/api/v1/admin/tenants` 路由组，支持跨租户查询、创建、更新、状态变更、删除租户。路由组现受 `auth` + `platformAdmin`（`RequireRole("platform_admin")`）中间件保护。新增 `/api/v1/admin/tenants/{tenantId}/admins` 子路由（含 `reset-password`），支持在 superadmin 控制台对学校管理员进行增删改查及密码重置；新增 `/api/v1/admin/tenants/{tenantId}/subscription` 子路由，支持查看与更新租户订阅套餐。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 租户隔离 | PASS | 所有 handler 通过 `tenantFilter()`/`requireTenant()` 强制租户隔离 |
| 租户创建事务 | PASS | 单事务中创建租户 + 订阅包 + 组织类型 + 角色 + 管理员用户 |
| 组织架构树 | PASS | `Tree` 返回完整树形结构，含累计成员数；递归 CTE 防环引用 |
| 组织删除保护 | PASS | 有子节点或关联用户时拒绝删除 |
| 用户 CRUD | PASS | 单个/批量创建、更新、删除、状态变更、密码重置均已实现 |
| 角色绑定 | PASS | `BindRoles` 原子替换所有绑定；至少 1 角色约束 |
| login_name 唯一性 | PASS | `tenantID + "_" + rawLoginName` 拼接保证跨租户唯一 |
| 批量操作 | PASS | `BatchCreate`（事务内去重）、`BatchGraduate`、`BatchDelete` |
| 基础数据 CRUD | PASS | 专业、行业、资源编码、职工职称、组织类型均支持完整 CRUD |
| 基础数据 Excel 导入导出 | PASS | 行业/专业/组织/学生/教师导入；组织/学生/教师导出；支持预览与错误行统计 |
| 基础数据模板下载 | PASS | `TemplateHandler` 提供专业、行业、组织、学生、教师标准模板 |
| 用户关系管理 | PASS | List/Create/Delete + 租户内校验双方用户存在性；禁止自关联；支持按用户名搜索 |
| 超管控制台 | PASS | `/admin/tenants` 支持跨租户租户列表/创建/更新/状态/删除；新增学校管理员配置及租户订阅管理子路由；路由受 `auth` + `platformAdmin` 保护 |

## 风险与约束

- **管理员密码已不再明文存储**：`users.plain_password` 列已通过 migration 085 删除；`AdminPreviewPassword` 已改为 `AdminResetPassword`（生成新密码 → bcrypt 哈希存储 → 一次性返回明文）。superadmin 控制台仅可重置密码，不可查看历史密码。—— **已修复。**
- **租户创建时管理员初始密码仅创建时返回**：默认管理员密码随机生成，仅在创建响应的 `newPassword` 字段中一次性返回给 superadmin 操作者。
- **角色删除已加事务包装**：`role_handler.go` 的 `Delete` 方法已将删除 `user_roles` 与删除 `roles` 纳入同一事务。
- **超管控制台已鉴权**：`/api/v1/admin/tenants` 及其子路由现受 `auth` + `platformAdmin` 中间件保护，需使用 `platform_admin` 角色账号登录。—— **已修复。**
