import js from '@eslint/js';
import globals from 'globals';

export default [
   js.configs.recommended,
   { rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
   {
      files: ['scripts/**/*.js'],
      languageOptions: {
         ecmaVersion: 'latest',
         sourceType: 'module',
         globals: {
            ...globals.browser,
            foundry: 'readonly',
            game: 'readonly',
            ui: 'readonly',
            canvas: 'readonly',
            Hooks: 'readonly',
            CONFIG: 'readonly',
            CONST: 'readonly',
            PIXI: 'readonly',
            fromUuidSync: 'readonly'
         }
      }
   },
   {
      files: ['tools/**/*.mjs', 'eslint.config.js'],
      languageOptions: { globals: { ...globals.node, game: 'readonly', CONFIG: 'readonly' } }
   },
   {
      // Code passed to page.evaluate runs in the browser.
      files: ['tools/radial-preview.mjs'],
      languageOptions: { globals: { ...globals.node, ...globals.browser } }
   }
];
