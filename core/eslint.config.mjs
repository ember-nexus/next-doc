import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import compat from 'eslint-plugin-compat';
import _import from 'eslint-plugin-import';
import perfectionist from 'eslint-plugin-perfectionist';
import prettier from 'eslint-plugin-prettier';
import pluginPromise from 'eslint-plugin-promise';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const flatCompat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

const files = ['**/*.ts'];

export default [
    pluginPromise.configs['flat/recommended'],
    compat.configs['flat/recommended'],
    ...flatCompat.plugins('require-extensions'),
    ...flatCompat
        .extends(
            'eslint:recommended',
            'plugin:@typescript-eslint/recommended',
            'plugin:prettier/recommended',
        )
        .map((config) => ({
            ...config,
            files: files,
        })),
    {
        files: files,
        plugins: {
            '@typescript-eslint': typescriptEslint,
            prettier,
            import: fixupPluginRules(_import),
            perfectionist,
        },
        languageOptions: {
            globals: {
                ...Object.fromEntries(
                    Object.entries(globals.browser).map(([key]) => [key, 'off']),
                ),
                ...globals.node,
                ...globals.browser,
            },
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: 'module',
            parserOptions: {
                project: 'tsconfig.test.json',
            },
        },
        settings: {
            'import/resolver': {
                typescript: {
                    project: './tsconfig.test.json',
                },
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            ...tseslint.configs.strict,
            '@typescript-eslint/explicit-function-return-type': 'warn',
            '@typescript-eslint/no-unused-vars': 'error',
            'accessor-pairs': 'error',
            'block-scoped-var': 'error',
            'camelcase': 'error',
            'dot-notation': 'warn',
            'eqeqeq': ['error', 'always'],
            'import/no-unresolved': 'error',
            'import/order': [
                'error',
                {
                    groups: [
                        'builtin',
                        'external',
                        'internal',
                        ['sibling', 'parent'],
                        'index',
                        'unknown',
                    ],
                    'newlines-between': 'always',
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],
            'no-console': 'error',
            'no-eq-null': 'error',
            'no-extra-bind': 'error',
            'no-implicit-coercion': 'error',
            'no-implicit-globals': 'error',
            'no-invalid-this': 'error',
            'no-return-assign': 'error',
            'no-sequences': 'error',
            'no-template-curly-in-string': 'error',
            'no-throw-literal': 'error',
            'no-unused-vars': 'off',
            'no-use-before-define': 'error',
            'no-var': 'error',
            'perfectionist/sort-exports': 'error',
            'perfectionist/sort-named-exports': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-const': 'error',
            'promise/always-return': 'error',
            'promise/avoid-new': 'off',
            'promise/catch-or-return': 'error',
            'promise/no-callback-in-promise': 'warn',
            'promise/no-multiple-resolved': 'error',
            'promise/no-native': 'off',
            'promise/no-nesting': 'warn',
            'promise/no-new-statics': 'error',
            'promise/no-promise-in-callback': 'warn',
            'promise/no-return-in-finally': 'warn',
            'promise/no-return-wrap': 'error',
            'promise/param-names': 'error',
            'promise/valid-params': 'warn',
            'require-atomic-updates': 'warn',
            'require-await': 'error',
            'require-extensions/require-extensions': 'error',
            'require-extensions/require-index': 'error',
            'sort-imports': [
                'error',
                {
                    ignoreCase: false,
                    ignoreDeclarationSort: true,
                    ignoreMemberSort: false,
                    memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
                    allowSeparatedGroups: true,
                },
            ]
        },
    },
];
