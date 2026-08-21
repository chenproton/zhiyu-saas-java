import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 业务门户（原 frontend/portal-vue）构建配置：与 plus-ui 管理端同工程双构建——
// 共用 package.json / node_modules，独立入口 portal.html、独立产物 dist-portal，运行时仍是两个独立 SPA。
// 保持最小插件链（仅 plugin-vue）：portal 不需要 plus-ui 的 UnoCSS / auto-import / svg-icon 等
// （那些插件的扫描根都是 src/，src-portal 天然不在其内，互不污染）。
// 原 portal 的 .env.* 全部为固定值（base '/'、API '/api/v1'、dev 端口 5173），
// 简单优先直接写死在本配置中，不再维护独立 env 文件（代码内均有同名兜底默认值）。
// envDir: false —— 不加载本工程 .env.*（那些是管理端的变量，同名会串扰门户）；
// 门户需要的 VITE_*（如 VITE_SCENE_PLATFORM_URL）由 deploy.sh 经进程环境注入，vite 会透传进程环境变量。
export default defineConfig({
  base: '/',
  envDir: false,
  publicDir: 'public-portal',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src-portal', import.meta.url))
    }
  },
  plugins: [vue()],
  build: {
    outDir: 'dist-portal',
    // 产物为 dist-portal/portal.html，部署脚本 rsync 后重命名为 index.html（nginx try_files 约定）
    rolldownOptions: {
      input: fileURLToPath(new URL('../portal.html', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
