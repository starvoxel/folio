// ------------------------------
// eslint.config.js
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import folio from './tools/eslint/folio-plugin.js';

const sourceFiles = ['**/*.{ts,tsx,js,mjs,cjs}'];
const testFiles = ['**/*.test.{ts,tsx}', '**/*.e2e.ts', 'tests/**/*.ts'];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/release/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'design/**',
      '.claude/**',
      'tests/architecture/fixtures/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: sourceFiles,
    plugins: { folio },
    rules: {
      'folio/file-header': 'error',

      // javascript_base: declarations, equality, strings, functions, objects.
      'no-var': 'error',
      'prefer-const': 'error',
      'one-var': ['error', 'never'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      quotes: 'off', // Prettier owns quote style.
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-object-spread': 'error',
      'object-shorthand': 'error',
      'no-param-reassign': ['error', { props: true }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': 'error',
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='then']",
          message: 'Use async/await instead of .then() chains.',
        },
        {
          selector:
            "PropertyDefinition[accessibility='private'], MethodDefinition[accessibility='private']",
          message: 'Use a #private field or method instead of the TypeScript private keyword.',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        {
          selector: ['objectLiteralProperty', 'typeProperty', 'objectLiteralMethod'],
          format: null,
        },
        { selector: 'import', format: null },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // AD-7: the domain has no Date and no float parsing. Time comes from the injected Clock; the one
    // place that reads the system clock is allowed below.
    files: ['packages/core/src/**/*.ts'],
    ignores: [
      'packages/core/src/domain/system-clock.ts',
      'packages/core/src/domain/system-clock.test.ts',
    ],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Use the injected Clock and the LocalDate helpers (AD-7).' },
        {
          name: 'parseFloat',
          message: 'Money is parsed from decimal strings without floats (AD-7).',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Number',
          property: 'parseFloat',
          message: 'Money is parsed from decimal strings without floats (AD-7).',
        },
      ],
    },
  },
  {
    // JSDoc on exported functions, classes and types, with every parameter and return documented
    // (javascript_base). The types come from the signatures, so the tags carry no types.
    files: ['**/*.{ts,tsx}'],
    ignores: testFiles,
    extends: [jsdoc.configs['flat/recommended-typescript-error']],
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration'],
        },
      ],
      'jsdoc/require-param': ['error', { checkDestructured: false }],
      'jsdoc/require-returns': 'error',
      'jsdoc/require-throws': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/tag-lines': 'off',
      'jsdoc/check-tag-names': ['error', { definedTags: ['internal'] }],
    },
  },
  {
    // Tests: the three-level describe/describe/it shape is checked by the architecture tests.
    files: testFiles,
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/naming-convention': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Tool configuration files need a default export.
    files: ['**/*.config.{js,ts,mjs,cjs}', 'tools/eslint/folio-plugin.js'],
    rules: { 'no-restricted-exports': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'tools/**/*.js'],
    rules: { 'no-console': 'off' },
  },
  {
    // Plain JavaScript files (configuration and scripts) are not part of any TypeScript project.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
  prettier,
);
