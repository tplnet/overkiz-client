import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default defineConfig([globalIgnores(["**/dist"]), {
    plugins: {
        "@typescript-eslint": tsPlugin,
    },
    extends: [
        tsPlugin.configs["flat/recommended"],
    ],

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2018,
        sourceType: "module",
    },

    rules: {
        quotes: ["warn", "single"],

        indent: ["warn", 4, {
            SwitchCase: 1,
        }],

        semi: ["warn", "always"],
        "comma-dangle": ["warn", "always-multiline"],
        "dot-notation": "off",
        eqeqeq: "warn",
        curly: ["warn", "all"],
        "brace-style": ["warn"],
        "prefer-arrow-callback": ["warn"],
        "max-len": ["warn", 140],
        "no-console": ["warn"],
        "no-non-null-assertion": ["off"],
        "comma-spacing": ["error"],

        "no-multi-spaces": ["warn", {
            ignoreEOLComments: true,
        }],

        "lines-between-class-members": ["warn", "always", {
            exceptAfterSingleLine: true,
        }],

        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
    },
}]);
