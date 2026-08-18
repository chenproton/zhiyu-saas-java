import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// eslint-config-next 已移除，但代码库残留大量 `eslint-disable @next/next/no-img-element`
// 注释（迁移前为 <img> 用法禁用该规则）。注册同名空规则（关闭态），使这些 disable 注释合法，
// 避免 "Definition for rule not found" 报错，同时不引入任何 Next 校验。
const nextImgRule = { create: () => ({}) }

export default tseslint.config(
  {
    ignores: ['public/**', 'dist/**', '.next/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@next/next': { rules: { 'no-img-element': nextImgRule } },
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      '@next/next/no-img-element': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      // 以下规则为 tseslint/recommended 与 react-hooks 7.x 的新增项，旧 eslint-config-next 基线不强制，
      // 代码库既有大量 any/相关模式（非本次迁移引入），降级以保持 lint 基线不回归。
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'prefer-const': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
