# 0008: 权限模型演进——菜单驱动的 API 授权（Menu-Driven RBAC）

- 状态：已接受
- 日期：2026-08-17

## 背景

原权限模型是「双轨制」：

- **前端页面可见性**：`roles.permissions.menus`（roles 配置页勾选）→ `checkMenuPermission` fail-closed 渲染控制；
- **后端 API 授权**：角色 code 硬编码（`RequireRole` / `RequireSystemPermission` / `RequireAllianceManager` / `RequireUserRead` / `RequireRoleOrMenu` + handler 层 `canManagePortal`/`canManageAlliance` 等 113 处调用点）。

双轨制导致「菜单勾了但 API 403」的配置与代码不一致问题（实例：教师菜单含学校信息页 `/portal/apps/alliance/school`，但 `PUT /tenants/{id}` 仅认 school_admin，教师访问 403「权限不足」）。同时自定义角色（ROLE001 等）只有菜单可见性、后端不认，无法真正获得业务写权限。

决策方向（产品拍板，四轮澄清确认）：

1. **角色 = 菜单权限集合**：所有角色的页面与 API 访问权限均由 `/portal/apps/system/org-user/roles` 的菜单配置驱动；学校管理员/教师区别仅在于菜单配置不同，配置一致则权限一致。
2. **写操作授权**：勾选一个菜单即授予该页面对应全部 CRUD/审批写操作（含删除/审批/发布）。
3. **保留少量角色特判**：关键写操作（密码/租户状态/有效期/审批终审）仍限 school_admin 作纵深防御（ADR-0003 语义）；服务台/工作台/登录跳转按角色聚合（PRD P-1）；平台隔离（RequirePlatform）与租户归属校验不变。
4. **学生走纯菜单**：默认种子只给落地页+服务台菜单，落地页菜单隐含映射其只读 API 面。
5. **B13 配置化**：enterprise_mentor 无联盟管理由「默认种子不勾联盟菜单」保证，配置者可覆盖（原代码级收窄取消）。
6. **school_admin 保留「无 menus = 全量」隐式语义**（与 roles 页回显全选一致）。
7. **平台管理员（platform_admin/saas 超管）不动**：`/superadmin` 与 `/api/v1/admin/*` 仍按 `RequirePlatform(saas)` + `RequireRole(platform_admin)`。

## 决策

我决定：**后端 API 授权改为「菜单路径 → API 端点」声明映射驱动**——新增静态映射表（代码内声明，无需 DB migration），统一授权中间件按「用户已勾选菜单 ∩ 请求端点归属菜单」判定放行；关键写操作叠加 school_admin 白名单；用户菜单集合经「查库 + Redis 短缓存」获取，不膨胀 JWT。

## 备选方案

1. **前端页面改用 auth 上下文数据、后端不动**（针对单页 403 的最小修复）：只能修单页，双轨不一致问题整体仍在，自定义角色写权限仍无解。否决。
2. **JWT 携带全量已授权菜单路径**：菜单树 ~100 路径 ≈ 4KB，逼近 Authorization header 上限（8KB），且权限变更须重新登录、角色切换不即时。否决，改为查库 + Redis 60s 缓存（权限变更秒级生效，与 `RequireActiveUser` 查库模式一致）。

## 后果

### 正面

- 单一授权模型：配置即生效，双轨不一致（菜单勾了 API 403）根治；
- 自定义角色真正可用：ROLExxx 配什么菜单得什么 API 权限（含写）；
- 种子角色维护量下降（teacher/school_admin 菜单集合对齐）；
- 新增「角色差异」不再需要改后端代码，只需配菜单。

### 负面 / 代价

- **安全边界从代码强制变为配置依赖**：配置错误（如给角色误勾系统管理菜单）会放大权限；靠「关键写 school_admin 白名单」+ 菜单分级兜底，需在 roles 配置页对系统管理组保持 school_admin 门禁；
- 改动面大：router 20 处中间件挂载 + handler 113 处角色判断调用点需迁移清理，回归风险高，须全量测试；
- 映射表需与菜单树/路由演进同步维护（新增菜单/API 必须登记，fail-closed：未登记 API 默认拒绝业务角色）；
- B13（企业导师无联盟管理）从代码级收窄变为配置级，需在种子权限中固化「默认不勾」并文档化。
