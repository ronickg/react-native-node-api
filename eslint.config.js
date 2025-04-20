// @ts-check

import globals from "globals";
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: [
      "apps/test-app/*.js"
    ],
    languageOptions: {
      parserOptions: {
        sourceType: "commonjs",
      },
      globals: {
        ...globals.commonjs,
      },
    },
    rules: {
      // We're using CommonJS here for Node.js backwards compatibility
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: [
      "packages/react-native-node-api-modules/bin/*.mjs",
      "packages/react-native-node-api-modules/scripts/*.mjs"
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
);
