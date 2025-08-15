import eslint from "@eslint/js";
import tselint from "typescript-eslint";
import eslintPluginPrettierRecommend from "eslint-plugin-prettier/recommended";
import { rules } from "eslint-plugin-prettier";

export default tselint.config(
  {
    ignores: ["eslint.config.mjs"],
  },
  eslint.configs.recommended,
  ...tselint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommend,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
