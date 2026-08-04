import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'lib/**/*.test.ts',
      'components/shared/**/*.test.ts',
      'app/scene/scenarios/[id]/edit/tasks/_components/**/*.test.ts',
      'app/lesson/admin/system/add/_components/**/*.test.ts',
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
        find: /^@\/lib\/utils$/,
        replacement: path.resolve(__dirname, '../../packages/ui/src/lib/utils.ts'),
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
        find: /^@\/(.*)$/,
        replacement: path.resolve(__dirname, './$1'),
      },
    ],
  },
})
