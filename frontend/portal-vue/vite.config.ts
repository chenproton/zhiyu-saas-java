import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    base: env.VITE_APP_BASE_PATH || '/',
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: Number(env.VITE_APP_PORT || 5173),
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true
        }
      }
    }
  };
});
