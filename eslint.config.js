// 2025 ESLint Flat Config - Modern Best Practices
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'build/',
      'temp-dist/',
      '**/*.d.ts',
      'archive/',
      'tests/__mocks__/',
    ],
  },

  // Base configuration for all files
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },

  // JavaScript files
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      ...eslint.configs.recommended.rules,
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
    },
  },

  // TypeScript files - 2025 Enterprise Standards
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        // Use a dedicated config so ESLint includes all src files without conflicting excludes
        project: './tsconfig.eslint.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,

      // 2025 TypeScript Best Practices - Production Readiness
      '@typescript-eslint/no-explicit-any': 'error', // Upgraded to error for production
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error', // Production safety
      '@typescript-eslint/prefer-nullish-coalescing': 'warn', // Enable for better null handling
      '@typescript-eslint/prefer-optional-chain': 'error',

      // Promise Safety - Critical for async operations
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-array-sort-compare': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn', // Enable for type safety
      '@typescript-eslint/restrict-template-expressions': 'warn', // Enable with warnings
      '@typescript-eslint/unbound-method': 'error',

      // Additional Production Rules
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-member-accessibility': ['warn', { accessibility: 'explicit' }],
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-duplicate-type-constituents': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/no-mixed-enums': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/prefer-reduce-type-parameter': 'error',
      '@typescript-eslint/prefer-return-this-type': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // Security Rules
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-throw-literal': 'error',

      // Performance Rules
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-readonly-parameter-types': 'warn',

      // Security & Best Practices - Enhanced Production Rules
      'no-eval': 'error',
      'no-implied-eval': 'off', // Handled by TypeScript version
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-proto': 'error',
      'no-extend-native': 'error',
      'no-global-assign': 'error',
      'no-implicit-globals': 'error',
      'no-caller': 'error',
      'no-iterator': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-loop-func': 'error',
      'no-new': 'error',
      'no-new-wrappers': 'error',
      'no-octal': 'error',
      'no-octal-escape': 'error',
      'no-return-assign': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unused-expressions': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-void': 'error',
      'no-with': 'error',
      radix: 'error',
      'wrap-iife': ['error', 'outside'],
      yoda: 'error',

      // Error Prevention
      'array-callback-return': 'error',
      'consistent-return': 'error',
      'default-case': 'error',
      'default-case-last': 'error',
      'dot-notation': 'error',
      eqeqeq: ['error', 'always'],
      'guard-for-in': 'error',
      'no-case-declarations': 'error',
      'no-empty': 'error',
      'no-empty-pattern': 'error',
      'no-fallthrough': 'error',
      'no-irregular-whitespace': 'error',
      'no-multi-spaces': 'error',
      'no-multi-str': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',

      // Modern JavaScript/TypeScript - Enhanced
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: true,
          object: true,
        },
        {
          enforceForRenamedProperties: false,
        },
      ],
      'prefer-object-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'object-shorthand': 'error',
      'quote-props': ['error', 'as-needed'],

      // Performance Rules
      'no-inner-declarations': 'error',
      'no-regex-spaces': 'error',
      'no-sparse-arrays': 'error',
      'no-template-curly-in-string': 'error',

      // Import/Export Rules
      'no-duplicate-imports': 'error',
      'no-useless-rename': 'error',

      // Enforce .js extensions for relative imports (ESM compliance)
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'always',
          ts: 'never',
        },
      ],
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/no-relative-parent-imports': 'off', // Allow relative imports

      // Clean Architecture Enforcement Rules
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../../domain/services/**',
              message: 'Infrastructure layer cannot import domain services directly. Use dependency injection with domain interfaces instead.',
              allowTypeImports: false,
            },
            {
              name: '../../../infrastructure/**',
              message: 'Domain layer cannot import infrastructure. Domain must remain pure and infrastructure-agnostic.',
              allowTypeImports: false,
            },
          ],
          patterns: [
            {
              group: ['**/infrastructure/**'],
              importNames: ['*'],
              message: 'Domain layer cannot import from infrastructure layer. Use interfaces and dependency injection.',
              allowTypeImports: false,
            },
            {
              group: ['**/domain/services/**'],
              importNames: ['*'],
              message: 'Infrastructure should not import domain services directly. Use interfaces with dependency injection.',
              allowTypeImports: false,
            },
          ],
        },
      ],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          disallowTypeAnnotations: false,
        },
      ],

      'sort-imports': [
        'error',
        {
          ignoreCase: false,
          ignoreDeclarationSort: true, // Let import/order handle declaration sorting
          ignoreMemberSort: false,
          memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
          allowSeparatedGroups: false,
        },
      ],

      // Code Quality - CLI Application Specific
      'no-console': 'off', // Allow console statements in CLI application
      'no-debugger': 'error',
      'no-alert': 'error',

      // Disable base ESLint rules that are covered by TypeScript equivalents
      'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
      'no-redeclare': 'off', // TypeScript handles this
      'no-undef': 'off', // TypeScript handles this
    },
  },

  // Test files - More lenient rules for testing patterns
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions in tests
      '@typescript-eslint/no-unused-vars': 'off', // Test variables often used for setup
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off', // Tests often have fire-and-forget promises
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      'no-console': 'off', // Allow console in tests for debugging
      'prefer-const': 'off', // Allow let in tests for readability
      'consistent-return': 'off', // Tests don't always need consistent returns
      'no-empty': 'off', // Allow empty blocks in tests
      'no-unused-expressions': 'off', // Allow unused expressions for test assertions
      'prefer-arrow-callback': 'off', // Allow regular functions in test callbacks
    },
  },

  // Configuration files
  {
    files: ['*.config.js', '*.config.ts', '*.config.mjs'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
];
