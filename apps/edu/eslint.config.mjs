import next from 'eslint-config-next'

const config = [
  ...next,
  {
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
]

export default config
