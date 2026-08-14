import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import importPlugin from "eslint-plugin-import";

export default defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "prettier/prettier": ["error", { singleQuote: false }],
      semi: ["error", "always"],
      "no-multi-spaces": ["error"],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unusedImports/no-unused-imports": "error",
      "unusedImports/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "off",
      "no-console": "warn",
      eqeqeq: ["error", "always"],
      "import/named": 2,
      "import/namespace": 2,
      "import/default": 2,
      "import/export": 2,
      "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
      "@typescript-eslint/consistent-type-imports": "warn",
    },
    plugins: {
      prettier: prettierPlugin,
      unusedImports: unusedImportsPlugin,
      import: importPlugin,
    },
  },
  {
    ignores: ["dist/**", "node_modules/**", "src/generated/**"],
  },
]);
