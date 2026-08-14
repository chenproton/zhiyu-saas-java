import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // 默认全量收集 *.test.ts（不再白名单，避免新增测试被漏跑）；
    // 排除 node_modules/.next/dist/public/image-editor（符号链接）等非源码目录。
    exclude: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'public/image-editor/**',
      '**/node_modules/**',
    ],
  },
  resolve: {
    alias: [
      // 与 tsconfig.json paths 保持一致（更具体的路径在前，否则会被 @/ 前缀吞掉）
      {
        find: /^@\/lib\/types$/,
        replacement: path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      },
      {
        find: /^@\/lib\/types\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/shared-types/src/$1'),
      },
      {
        find: /^@\/components\/ui\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/components/ui/$1'),
      },
      {
        find: /^@\/lib\/utils$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/lib/utils.ts'),
      },
      {
        find: /^@\/lib\/api$/,
        replacement: path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
      },
      {
        find: /^@\/lib\/api-factory$/,
        replacement: path.resolve(__dirname, '../../packages/api-client/src/api-factory.ts'),
      },
      {
        find: /^@\/hooks\/use-toast$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/hooks/use-toast.ts'),
      },
      {
        find: /^@zhiyu\/ui$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      },
      {
        find: /^@zhiyu\/ui\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/$1'),
      },
      {
        find: /^@zhiyu\/shared-types$/,
        replacement: path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      },
      {
        find: /^@zhiyu\/shared-types\/(.*)$/,
        replacement: path.resolve(__dirname, '../../packages/shared-types/src/$1'),
      },
      {
        find: /^@\/(.*)$/,
        replacement: path.resolve(__dirname, './$1'),
      },
    ],
  },
})
