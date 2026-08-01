import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

const config = [
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
]

export default config
