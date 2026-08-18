import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: {
      // 通用映射：本包 hooks/components 的 @/ 路径均可解析
      '@': path.resolve(__dirname, './src'),
    },
  },
})
