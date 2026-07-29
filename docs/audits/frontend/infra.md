# 前端基础设施审计

## 核心决策

- 采用 **pnpm workspace monorepo**：仓库内包含教育管理 Next.js 应用：
  - `@zhiyu/edu`：教育教学管理后台（Portal、Job、Scene、Lesson、Evaluation、Library），监听端口 `3020`。
  > **历史**：此前仓库包含 `@zhiyu/marketplace`（商城+运营后台，端口 `3010`），源码已移除待重新开发。
- 共享 packages：
  - `@zhiyu/ui`：shadcn/ui 组件、Tailwind 全局样式、`cn` 工具函数。
  - `@zhiyu/api-client`：前端 API 封装、平台判断、双 token 管理。
  - `@zhiyu/shared-types`：前后端共享 TypeScript 类型。
- 前端通过 Next.js `rewrites` 代理 `/api/*` 到后端服务（`http://127.0.0.1:8080`）。
- 鉴权保持双 token：
  - 商城与运营后台使用 `saas` 平台 token，存储键 `zhiyu-token`，登录入口 `/login`。
  - 教育管理使用 `portal` 平台 token，存储键 `zhiyu-portal-token`，登录入口 `/portal/login`。
- 通过 `NEXT_PUBLIC_DEFAULT_PLATFORM` 环境变量为每个应用指定默认平台，避免按路径判断导致 `/job/*`、`/scene/*` 等非 `/portal` 路径误用 saas token。

## 目录结构

```
/root/projects/zhiyu-saas
├── apps/
│   └── edu/                  # 教育管理后台
├── packages/
│   ├── ui/                   # 共享 UI 组件库
│   ├── api-client/           # 共享 API 客户端
│   └── shared-types/         # 共享类型
├── backend/                  # Go 后端
├── deploy.sh                 # Docker Compose 部署脚本
└── deploy/
    └── docker-compose.yml    # Docker Compose 配置
```

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| pnpm-workspace.yaml 配置 | PASS | `apps/*` 与 `packages/*` 均纳入 workspace |
| 共享包类型检查 | PASS | `pnpm -r typecheck` 通过 |
| 应用类型检查 | PASS | `pnpm typecheck` 通过 |
| 应用构建 | PASS | `pnpm build:edu` 通过 |
| 别名映射 | PASS | `@/components/ui/*`、`@/lib/api`、`@/lib/types/*` 指向共享包 |
| 部署脚本 | PASS | `./deploy.sh` 通过 Docker Compose 构建并启动容器，健康检查通过 |
| 健康检查 | PASS | `http://127.0.0.1:3020/portal/login` 可访问 |

## 风险与约束

- 应用与后端共用数据库，安全边界依赖 JWT 中的 `platform` 与 `roleCodes`（角色权限）。身份类型体系已移除，用户身份统一由 `roles`/`user_roles` 管理，页面入口与路由拦截依赖角色的菜单权限（`roles.permissions.menus`），登录后可在顶栏切换当前角色（每次仅以一种角色使用系统）。
- `@zhiyu/ui` 组件库变更需保证教育管理应用可用。
- 静态资源按应用拆分，公共资源建议放后端 CDN 或 `@zhiyu/ui/public`。