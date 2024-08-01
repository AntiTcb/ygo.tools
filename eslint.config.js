import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

/** @type {import('typescript-eslint').Linter.FlatConfig[]} */
export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,
  ...ts.configs.stylisticTypeChecked,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      parserOptions: {
        projectService: './tsconfig.json',
        programs: false,
        extraFileExtensions: ['.svelte'],
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
        svelteFeatures: {
          experimentalGenerics: true
        }
      }
    }
  },
  {
    files: ['**/*.config.*'],
    extends: [ts.configs.disableTypeChecked]
  },
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      'dist/',
      '.vercel/',
      '$houdini/',
      'src/lib/graphql/schema.graphql',
      'vite.config.ts.timestamp-*',
      'vitest.config.ts.timestamp-*',
      'setupTest.ts',
      'setupPlaywright.ts',
      '*.config.js',
      '*.config.ts',
      'static/scripts/librespeed/speedtest_worker.js'
    ]
  },
  {
    rules: {
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      // Type-aware
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      // '@typescript-eslint/no-misused-promises': ['warn', { checksVoidReturn: false }],
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      // Stylistic
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      // Other
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'default',
          format: ['camelCase', 'snake_case'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow'
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow'
        },
        {
          selector: 'variable',
          modifiers: ['exported'],
          format: ['camelCase', 'PascalCase']
        },
        {
          selector: 'typeLike',
          format: ['PascalCase']
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase']
        },
        {
          selector: 'enumMember',
          format: null
        },
        {
          selector: ['objectLiteralProperty', 'objectLiteralMethod'],
          format: null
        }
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'eol-last': 'warn',
      'no-trailing-spaces': 'warn',
      'no-tabs': 'error',
      'prefer-template': 'warn',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-const-assign': 'error',
      'no-irregular-whitespace': 'warn',
      quotes: ['warn', 'single', { avoidEscape: true }],
      curly: ['warn', 'multi-line'],
      'no-debugger': 'warn',
      'func-style': ['warn', 'expression', { allowArrowFunctions: true }],
      'svelte/no-at-html-tags': 'off'
    }
  }
);
