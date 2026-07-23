# 多租户与组织用户管理审计

## 核心决策

- **多租户隔离**：所有业务数据通过 `tenant_id` 字段隔离。`common.go` 中 `tenantFilter()`/`requireTenant()`/`verifyTenantOwnership()` 三个层级强制所有查询和写入操作绑定当前用户的租户。平台管理员不自动获得跨租户读取权限。
- **租户创建流程**（事务性）：创建租户时自动生成：1 个默认订阅包（5 个模块）、5 个默认组织类型（学校/二级学院/专业/班级/行政职能部门）、4 个默认角色（`school_admin`/`teacher`/`student`/`enterprise_mentor`）、1 个管理员用户（默认密码 `admin123`），并绑定 `school_admin` 角色。
- **组织架构树**：`organizations` 表通过 `parent_id` 实现层级树。`Tree` 接口构建内存树并计算每个节点的累计成员数。更新时通过递归 CTE 防环引用；删除时检查子节点和用户引用。
- **用户管理**：
  - `login_name` 全局唯一性通过 `tenantID + "_" + rawLoginName` 拼接实现。
  - 支持单个创建、批量创建（事务内去重）、批量毕业、批量删除。
  - `BindRoles` 接口原子替换所有角色绑定，至少绑定 1 个角色。
- **角色权限管理**：`RoleHandler` 提供 CRUD + `Assign`（追加绑定）。权限结构为 `{ menus: {}, moduleName: { pageName: { buttons: [] } } }`。
- **用户扩展字段**：最多 20 个自定义扩展字段槽位，通过 `slot_index` 定位。
- **组织类型管理**：`OrgTypeHandler` 实现 CRUD，组织类型分三类（`internal` 内部 / `business` 业务 / `external` 外部），默认类型受保护不可删除，删除时检查是否被 `organizations` 引用。
- **用户关系管理**：`UserRelationHandler` 管理用户间的关联关系（发起人 → 目标，含关系类型），创建时校验双方均属于当前租户，支持按用户名搜索。
- **基础数据**：`majors`（专业）、`industries`（行业两层级树）、`resource_codes`（资源编码）、`staff_titles`（职工职称）均支持租户范围唯一约束。

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
| 用户关系管理 | PASS | CRUD + 租户内校验双方用户存在性；支持按用户名搜索 |

## 风险与约束

- **租户创建时管理员默认密码暴露**：默认密码 `admin123` 在创建响应中以明文返回。—— **高危，需提示用户在获取密码后立即修改。**
- **角色删除无事务包装**：`role_handler.go` 的 `Delete` 方法先删除 `user_roles` 绑定，再删除 `roles`，两次操作独立调用无事务包裹，中间失败可能导致数据不一致。—— **低风险，可接受。**
