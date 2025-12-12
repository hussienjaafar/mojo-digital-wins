import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],

      // Design System Token Enforcement
      // Warns when raw color values are detected instead of design tokens
      // Allowed: hsl(var(--...)), cssVar(...), getChartColors()
      // Disallowed: #hex, hsl(123, ...), rgb(...), rgba(...)
      "no-restricted-syntax": ["warn",
        {
          // Detect raw hex colors in strings (e.g., "#0EA5E9")
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Use design tokens (cssVar, getChartColors) instead of raw hex colors. See src/lib/design-tokens.ts"
        },
        {
          // Detect raw hsl() in template literals (not followed by 'var')
          selector: "TemplateLiteral[quasis.0.value.raw=/hsl\\(\\d/]",
          message: "Use cssVar(colors.xxx) instead of raw hsl() values. See src/lib/design-tokens.ts"
        },
      ],
    },
  },
  // Disable token rules for design system file itself
  {
    files: ["**/design-tokens.ts", "**/chart.tsx", "**/globals.css"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
);
