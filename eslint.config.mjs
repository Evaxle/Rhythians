import nextConfig from "eslint-config-next";
import tseslint from "typescript-eslint";

export default [
  ...nextConfig,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
