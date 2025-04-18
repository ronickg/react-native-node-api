// @ts-check
import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: [
      "**/babel.config.js",
      "**/metro.config.js",
      "**/metro-config.js",
      "**/react-native.config.js",
      "packages/example-cpp-node-api-addon/*.js",
      "packages/react-native-node-api-modules/bin/*.js",
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
      "packages/react-native-node-api-host/copy-node-api-headers.mjs",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);
