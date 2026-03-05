import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "out/**", "src/test/**", "testFixture/**"],
  },
  ...tseslint.configs.recommended,
  eslintPluginPrettier,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": [
        "warn",
        { ignoreRestArgs: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { caughtErrors: "none" },
      ],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
