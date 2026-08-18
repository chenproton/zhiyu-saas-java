import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vite 配置：由 Next.js 迁移而来，alias 与 vitest.config.ts 保持一致（更具体的路径在前）。
// base：默认 '/'（Go 栈）；Java 栈构建时注入 VITE_BASE_PATH=/java，产物资产走 /java/ 前缀，
//       与边缘 nginx 剥离前缀后的内部路径对齐（原 NEXT_PUBLIC_BASE_PATH 的等价替换）。
//       兼容读取 NEXT_PUBLIC_BASE_PATH：Java 部署脚本/编排尚未迁移到 VITE_ 命名时的过渡兜底。
const BASE_PATH = process.env.VITE_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || ''

export default defineConfig({
  plugins: [react()],
  // 跳过全部 node_modules 的 esbuild 转换，直接交由 rollup 解析原始 JS/CJS，
  // 显著降低 transform 阶段峰值内存（否则 esbuild 单独吃 2.5GB+ 触发 cgroup OOM）。
  // 安全前提：@zhiyu/* workspace 包与业务代码均经 alias 映射到真实源码路径（非 node_modules），
  // TS/JSX 转换不受影响；node_modules 均为纯 JS/CJS，rollup 可原生解析。
  esbuild: {
    exclude: [/node_modules/],
  },
  base: BASE_PATH ? `${BASE_PATH.replace(/\/?$/, '/')}` : '/',
  server: {
    host: true,
    port: Number(process.env.EDU_PORT || 3020),
    proxy: {
      // 开发期反代：与 next.config.mjs 的 rewrites() 等价（生产由 nginx 承担）
      '/api': {
        target: process.env.API_PROXY_URL || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.API_PROXY_URL || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/templates': {
        target: process.env.API_PROXY_URL || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/kkfileview': {
        target: 'http://127.0.0.1:8012',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: Number(process.env.EDU_PORT || 3020),
  },
  build: {
    // 部署环境（dsh-web.service）cgroup 内存上限 4GB（含 dsh 服务自身 ~1GB，build 可用 ~3GB），
    // esbuild transform 与 rollup 渲染会分别吃 2GB+ 触发 OOM 击杀。
    // 对策：① 关闭压缩（省掉 esbuild 压缩阶段）；② 限制并行文件数，压低峰值内存。
    // 产物不压缩、体积更大，可在高配环境放开 minify 并恢复默认并行。
    minify: false,
    rollupOptions: {
      maxParallelFileOps: 1,
    },
  },
  resolve: {
    alias: [
      // Node 内置 fs/fs/promises → 浏览器空桩（原 next.config.mjs 的 turbopack.resolveAlias）
      { find: /^fs\/promises$/, replacement: path.resolve(__dirname, 'lib/fs-stub.ts') },
      { find: /^fs$/, replacement: path.resolve(__dirname, 'lib/fs-stub.ts') },
      // 与 tsconfig.json paths / vitest.config.ts 保持一致（更具体的路径在前）
      {
        find: /^@\/lib\/types$/,
        replacement: path.resolve(__dirname, '../packages/shared-types/src/index.ts'),
      },
      {
        find: /^@\/lib\/types\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/shared-types/src/$1'),
      },
      {
        find: /^@\/components\/ui\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/ui/src/components/ui/$1'),
      },
      {
        find: /^@\/lib\/utils$/,
        replacement: path.resolve(__dirname, '../packages/ui/src/lib/utils.ts'),
      },
      {
        find: /^@\/lib\/api$/,
        replacement: path.resolve(__dirname, '../packages/api-client/src/index.ts'),
      },
      {
        find: /^@\/lib\/api-factory$/,
        replacement: path.resolve(__dirname, '../packages/api-client/src/api-factory.ts'),
      },
      {
        find: /^@\/hooks\/use-toast$/,
        replacement: path.resolve(__dirname, '../packages/ui/src/hooks/use-toast.ts'),
      },
      {
        find: /^@zhiyu\/ui$/,
        replacement: path.resolve(__dirname, '../packages/ui/src/index.ts'),
      },
      {
        find: /^@zhiyu\/ui\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/ui/src/$1'),
      },
      {
        find: /^@zhiyu\/shared-types$/,
        replacement: path.resolve(__dirname, '../packages/shared-types/src/index.ts'),
      },
      {
        find: /^@zhiyu\/shared-types\/(.*)$/,
        replacement: path.resolve(__dirname, '../packages/shared-types/src/$1'),
      },
      {
        find: /^@\/(.*)$/,
        replacement: path.resolve(__dirname, './$1'),
      },
    ],
  },
})
