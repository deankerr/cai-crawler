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
      'unused-imports/no-unused-vars': 'warn',
      'ts/no-unsafe-argument': 'off',
      'ts/no-unsafe-assignment': 'off',
      'ts/no-unsafe-call': 'off',
      'ts/no-unsafe-member-access': 'off',
      'ts/no-unsafe-return': 'off',
      'ts/require-await': 'off',
      'ts/no-redeclare': 'off',
      'no-console': 'off',
      'node/prefer-global/process': 'off',
    },
  },
  ignores: ['convex/_generated', '**/*.md'],
})
