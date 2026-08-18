# 0009: 前端从 Next.js 迁移为纯 React SPA（Vite + React Router）

- 状态：已接受
- 日期：2026-01-15

## 背景

`frontend/edu`（Go 与 Java 共用前端）当前基于 Next.js 16 App Router 构建，但实测数据显示其**本质已是一个披着 Next 壳的纯客户端 SPA**：

- 189 个 `page.tsx`、20 个 `layout.tsx`；`route.ts`（API 路由）0、`middleware.ts` 0、Server Actions 0、`loading.tsx` 0。
- `'use client'` 文件 427/501（≈85%）；真 RSC async 组件仅 1 个；`server-only`/`cookies()`/`headers()`/`generateStaticParams` 全为 0。
- 数据获取全走客户端 `fetch`（`@zhiyu/api-client`），token 存 `localStorage`，无 SSR 读 cookie、无服务端预取。
- 生产环境 `/api`、`/uploads`、`/kkfileview`、`/java` 反代**已由 nginx 承担**，Next 的 `rewrites()` 仅 dev 期使用。

后端是 **Go（+Java 双栈）**，因此 Next 的核心价值（RSC 直连数据、Server Actions 免写 API、Node BFF 聚合）在本仓库**均不成立**：任何 SSR 数据获取都意味着 Node 进程再跳一次 Go 的 HTTP 接口，多一层而无收益。Next 仅剩的 SSR/SEO 价值对本鉴权型 SaaS 后台也≈0。

继续维持 Next 双运行时（server/client）带来长期心智负担：团队每次写代码都要判断「这行跑在哪」，并维护 22 处 `router.refresh()` 这类 Next 独有语义。详见前置评估（本次会话两轮勘察）。

## 决策

我决定将 `frontend/edu` 迁移为**纯 React SPA**，技术栈为：**Vite 7（构建）+ React Router v7（declarative/library 模式）+ React 19（保持）+ TypeScript + Tailwind 4（保持）+ Vitest（保持）**；数据层 `@zhiyu/api-client` 与全部业务逻辑**零改动**；以「行为不变」的重构定位执行，不改变任何产品可观察行为，不碰后端、不碰 nginx 反代层。

## 备选方案

1. **继续留在 Next.js，仅清理双运行时写法**（把残留 RSC 也 `'use client'` 化）。
   - 否决理由：治标不治本，Next 相对纯 React 在 Go 后端下无净收益，双运行时心智负担与 `refresh()` 语义仍长期存在，构建产物仍需 Node 运行时托管。
2. **迁移到 Vite + 自研极简路由**（不引入 React Router，用 hash 路由或手写 history）。
   - 否决理由：重复造轮子，丢失嵌套路由/`basename`/懒加载/错误边界等成熟能力，长期维护成本反而更高。
3. **迁移到 Remix/React Router 框架模式（framework mode，带服务端）**。
   - 否决理由：framework mode 自带 Node 服务端与 SSR，重蹈「Node 再跳 Go」的覆辙；本项目只需纯静态 SPA。

## 迁移方案（分阶段）

### Phase 0 — 脚手架与依赖
1. 新增 `vite.config.ts`（alias 平移自 `vitest.config.ts`：`@/*`→`./`、`@zhiyu/ui`→源码、`@zhiyu/api-client`→源码；`resolve.alias` 把 `fs`/`fs/promises` 映射到 `lib/fs-stub.ts`；`server.proxy` 平移 Next `rewrites()` 作 dev 代理）。
2. 新增 `index.html`（承载 `<html>`/`<body>`/`<title>`/meta + 3 段防闪烁内联脚本：font-scale/lang/brand-color）。
3. 新增 `src/main.tsx`（Provider 树 + `BrowserRouter basename={getPathPrefix()}` + 根 ErrorBoundary + Suspense）。
4. 改 `package.json`（依赖换 vite/react-router；脚本 `dev/build/start` 换 vite；保留 `prebuild` copy-file-viewer-assets）。
5. 删 `next.config.mjs`、`next-env.d.ts`、`.next/`。

### Phase 1 — 共享层去 Next 化
- `@zhiyu/ui` 的 `PlatformSideNav.tsx`：`next/link`→RR `Link`、`usePathname`→`useLocation`；`package.json` 移除 `next` peerDep、加 `react-router`。
- `theme-provider.tsx`：重写为自研 context（等价 `attribute="class" defaultTheme="system" enableSystem`）。
- `next/dynamic`（1 处）→ `React.lazy` + `Suspense`。

### Phase 2 — 路由表重建
- 新增 `src/routes.tsx`：显式路由树，嵌套 layout 用 RR layout route，每页 `React.lazy` 保持代码分割。
- 20 个 `layout.tsx`：`({children}) => <X>{children}</X>` → `() => <X><Outlet/></X>`；根 `layout.tsx` 拆解（`<html>`/`<head>` 上移 `index.html`，Provider 树上移 `main.tsx`）。
- `error.tsx`→根 `errorElement`；`global-error.tsx`→根 ErrorBoundary；`not-found.tsx`→通配 `*` 路由。
- `redirect()`（3 处）→ `<Navigate>` / `navigate()`。

### Phase 3 — 机械替换
- `next/navigation` → `react-router`：`useRouter`→`useNavigate`（`push`→`navigate`、`replace`→`navigate(...,{replace:true})`、`back`→`navigate(-1)`）；`useParams`/`useSearchParams`/`usePathname` 同名换源。
- `next/link` → `<Link>`（`href`→`to`）；`next/image` → `<img>`（12 文件）；`process.env.NEXT_PUBLIC_*` → `import.meta.env.VITE_*`（8 处）。

### Phase 4 — 语义复核
- 22 处 `router.refresh()`：逐点替换为「重拉对应客户端数据」或 `window.location.reload()` 兜底。
- 1 个 RSC：`await params` → `useParams()`。

### Phase 5 — 工程配置与部署
- `tsconfig.json` 去 Next 插件/`next-env.d.ts`/`.next/types`；`eslint.config.mjs` 换标准 SPA flat config；`vitest.config.ts` 的 exclude 把 `.next` 换 `dist`。
- `Dockerfile`：多阶段构建产出 `dist/` + `nginx:alpine` 托管，`try_files $uri /index.html` 保证 SPA 深链与 `/portal/login` 健康检查。

### Phase 6 — 校验与部署
`pnpm typecheck && pnpm lint && pnpm test` → `spec_check` → 分支 commit（`spec:nochange`）→ `./deploy.sh --branch`。

## 后果

### 正面
- 消灭「双运行时心智分裂」：写任何功能只有一个运行时，无 `'use client'` 边界、无 `refresh()` 语义、无 server/client 调试分叉。
- 数据流回到单一路径：纯客户端 `fetch` + 现有 hooks/context，无服务端缓存概念。
- 部署与故障面收窄：纯静态产物 + nginx，无 Node 运行时进程要维护。
- 单一静态产物同时服务 `/`（Go）与 `/java/`（Java），通过 RR `basename={getPathPrefix()}` 运行时判定，消除 build-time `basePath` 双构建隐患。

### 负面 / 代价
- 失去 SSR：首屏从「有 HTML」变「白屏等 JS」，对本鉴权后台感知弱；若未来需对公网 SEO 的落地页，须另配预渲染（如 `vite-plugin-prerender`）——这是已知欠账。
- 文件约定路由 → 显式路由表：路由树需人工维护（换来 Provider 作用域更清晰）。
- 失去 Next 生态未来升级红利（PPR/ISR/流式 SSR），但此类特性绑定 Node 数据层，在 Go 后端下大概率永不用。

## 回滚
整件事在独立 `git worktree` 分支 `feat/agent-nextjs-to-react-spa` 进行，`master` 不动；任一阶段失败即丢弃分支，零污染。回滚即切回 master 原 Next.js 实现。
