import next from 'eslint-config-next'

const config = [
  {
    ignores: ['public/**'],
  },
  ...next,
  {
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
]

export default config
