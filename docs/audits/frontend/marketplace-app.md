# 商城与运营前台审计

## 核心决策

- **应用定位**：`@zhiyu/marketplace` 是 SaaS 商城与运营前台，负责教育资源交易、机构入驻、平台运营后台。
- **双端共用**：商城前端与教育管理前端共用 `@zhiyu/api-client`、`@zhiyu/shared-types`、`@zhiyu/ui`，但使用不同的 Next.js 应用入口与 localStorage token 键（`zhiyu-token`）。
- **认证与路由隔离**：
  - 商城使用 `saas` 平台 token，登录入口 `/login`。
  - 登录后根据首要角色分流：`platform_admin` → `/admin`，`school_admin`/`enterprise_mentor` → `/dashboard`，教师/学生被提示去教育管理 Portal 登录。
  - `/admin/*` 布局强制要求 `platform_admin` 角色，非管理员重定向。
- **核心页面**：
  - 商城首页 `/`、`/marketplace`：资源列表与分类浏览。
  - 资源详情 `/resources/[id]`：展示资源信息、卖家机构、销量、浏览量、授权状态。
  - 结算页 `/resources/[id]/checkout`：创建订单并模拟支付，返回授权码。
  - 我的资源 `/my-resources`、`/my-resources/new`、`/my-resources/[id]/edit`：机构卖家发布/编辑/管理资源，含分类、标签、附件、价格、状态（草稿/审核中/已驳回/待发布/已发布/已下架）。
  - 订单中心 `/orders`：买卖双方订单列表与支付。
  - 钱包 `/wallet`：收入统计、提现申请、提现记录。
  - 机构入驻 `/institution/apply`、`/institution`：机构申请、资料维护、机构仪表盘。
  - 运营后台 `/admin`：平台管理员仪表盘、资源审核、订单管理、机构管理、租户列表、轮播图、结算配置、标签字典。
- **API 覆盖**：`resourceApi`、`orderApi`、`institutionApi`、`withdrawalApi`、`statsApi`、`configApi`、`bannerApi` 等已在 `packages/api-client` 中封装。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 商城首页与资源浏览 | PASS | `/`、`/marketplace` 展示资源列表与分类入口 |
| 资源详情与授权校验 | PASS | `/resources/[id]` 展示资源详情、授权状态、下载入口 |
| 订单创建与模拟支付 | PASS | `/resources/[id]/checkout` 调用 `orderApi.create` + `orderApi.pay` |
| 我的资源管理 | PASS | 支持创建、编辑、提交审核、按状态筛选 |
| 订单中心 | PASS | 买卖双方订单列表、状态筛选、支付操作 |
| 钱包与提现 | PASS | 收入/支出统计、提现申请、提现记录 |
| 机构入驻与资料维护 | PASS | `/institution/apply` 多步骤表单、`/institution` 设置页 |
| 机构仪表盘 | PASS | `/dashboard` 展示本机构资源、订单、收入概况 |
| 平台管理员后台 | PASS | `/admin` 仪表盘、`/admin/resources` 审核、`/admin/orders` 订单、`/admin/institutions` 机构管理 |
| 运营配置 | PASS | `/admin/banners` 轮播图、`/admin/settlement` 平台费率、`/admin/dictionary` 标签字典 |
| 双 Token 与角色分流 | PASS | 使用 `saas` token；登录后按角色跳转对应入口 |
| 管理员布局鉴权 | PASS | `/admin/*` 强制 `platform_admin`，否则重定向 |

## 风险与约束

- **标签字典只读**：`admin/dictionary` 页面仅展示前端常量，后端尚未提供字典管理接口，标签变更需发版。
- **教师/学生被引导到 Portal**：商城登录页明确拒绝教师/学生角色，提示去教育管理 Portal 登录，避免角色入口混淆。
