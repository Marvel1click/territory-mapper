import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Node.js scripts (use CommonJS)
    "scripts/**",
    // Dependencies
    "node_modules/**",
  ]),
  {
    rules: {
      // Disable overly strict React 19 rules for common patterns
      // These patterns are widely used and safe for initialization
      "react-hooks/set-state-in-effect": "off",
      // Allow unused variables with underscore prefix
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      // Allow any in specific cases (replication layers, etc.)
      "@typescript-eslint/no-explicit-any": "warn"
    }
  }
]);

export default eslintConfig;
