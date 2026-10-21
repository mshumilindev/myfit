import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/',
      '**/dist-e2e*/',
      '**/dev-dist/',
      '**/.vite/',
      '**/node_modules/',
      '**/coverage/',
      '**/coverage-patch/',
      'patch-cov/',
      '**/storybook-static/',
      '_sync/',
      '**/_to_delete/',
      'functions/lib/',
      'cloudflare/',
      'docs/design/boards/',
      'client/design-lab/',
      '_shots/',
      '_vb_m89/',
      '_wctx2/',
      '_audit_tmp/',
      '.scratch/',
      'Claude outputs/',
      'sb-*/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: [
      'server/src/**/*.ts',
      'desktop/src/**/*.ts',
      'functions/src/**/*.ts',
      'scripts/**/*.mjs',
      'client/scripts/**/*.mjs',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
