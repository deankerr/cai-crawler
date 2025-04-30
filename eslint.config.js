import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  typescript: {
    overrides: {
      'ts/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      'ts/no-unsafe-argument': 'off',
      'ts/no-unsafe-assignment': 'off',
      'ts/no-unsafe-call': 'off',
      'ts/no-unsafe-member-access': 'off',
      'ts/no-unsafe-return': 'off',
      'ts/require-await': 'off',
      'ts/no-redeclare': 'off',
    },
  },
  rules: {
    'no-console': 'off',
    'unused-imports/no-unused-vars': 'warn',
    'node/prefer-global/process': 'off',
  },
  ignores: ['convex/_generated', '**/*.md'],
})
