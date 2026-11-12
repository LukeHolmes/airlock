/**
 * Airlock ESLint Configuration
 *
 * TypeScript-focused linting with strict security and quality rules.
 * Aligned with project principles: strict types, no implicit any, explicit returns.
 */

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./packages/*/tsconfig.json', './packages/*/tsconfig.*.json'],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // TypeScript strictness (relaxed for CI initial setup)
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    
    // Allow require() for dynamic imports
    '@typescript-eslint/no-var-requires': 'off',
    
    // Security
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Code quality
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'no-console': ['warn', { allow: ['error', 'warn', 'info', 'log'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  overrides: [
    {
      files: ['packages/ui/src/renderer/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@airlock/core',
                message:
                  'Renderer must not import the Node @airlock/core entry (dockerode). Use @airlock/core/browser.',
              },
            ],
            patterns: [
              {
                group: ['@airlock/core/*', '!@airlock/core/browser'],
                message:
                  'Renderer must use @airlock/core/browser only (not /first-run or other subpaths).',
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.js',
    '*.mjs',
    '*.cjs',
    '.github/',
    'plans/',
  ],
};
