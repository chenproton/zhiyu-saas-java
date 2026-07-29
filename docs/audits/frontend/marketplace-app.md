# 商城与运营前台审计

> **⚠️ 已废弃**：`apps/marketplace/` 源码已在 commit `25d0586b` 中移除（"暂时移除 marketplace 商城，后续重新开发"）。本审计文档保留作为历史记录，待商城重新开发后需重新审计。

## 核心决策

- **应用定位**：`@zhiyu/marketplace` 是 SaaS 商城与运营前台，负责教育资源交易、机构入驻、平台运营后台。
- **双端共用**：商城前端与教育管理前端共用 `@zhiyu/api-client`、`@zhiyu/shared-types`、`@zhiyu/ui`，但使用不同的 Next.js 应用入口与 localStorage token 键（`zhiyu-token`）。
- **认证与路由隔离**：
  - 商城使用 `saas` 平台 token，登录入口 `/login`。
  - 登录后根据首要角色分流：`platform_admin` → `/admin`，`school_admin`/`enterprise_mentor` → `/dashboard`，教师/学生被提示去教育管理 Portal 登录。
  - `/admin/*` 布局强制要求 `platform_admin` 角色，非管理员重定向。
- **核心页面**（已移除，仅历史记录）：
  - 商城首页 `/`、`/marketplace`：资源列表与分类浏览。
  - 资源详情 `/resources/[id]`、结算页 `/resources/[id]/checkout`。
  - 我的资源 `/my-resources/*`、订单中心 `/orders`、钱包 `/wallet`。
  - 机构入驻 `/institution/apply`、`/institution`、运营后台 `/admin/*`。
- **API 覆盖**：`resourceApi`、`orderApi`、`institutionApi`、`withdrawalApi`、`statsApi`、`configApi`、`bannerApi` 等已在 `packages/api-client` 中封装（API 客户端保留，待商城重新开发后复用）。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 商城首页与资源浏览 | 已移除 | 源码已删除，待重新开发后重新审查 |
| 资源详情与授权校验 | 已移除 | 同上 |
| 订单创建与模拟支付 | 已移除 | 同上 |
| 我的资源管理 | 已移除 | 同上 |
| 订单中心 | 已移除 | 同上 |
| 钱包与提现 | 已移除 | 同上 |
| 机构入驻与资料维护 | 已移除 | 同上 |
| 机构仪表盘 | 已移除 | 同上 |
| 平台管理员后台 | 已移除 | 同上 |
| 运营配置 | 已移除 | 同上 |
| 双 Token 与角色分流 | 已移除 | 同上 |
| 管理员布局鉴权 | 已移除 | 同上 |

## 风险与约束

- **商城待重新开发**：所有前端页面已移除，后端 API 和 api-client 封装保留，后续重新开发后需进行完整的安全审计与功能回归测试。