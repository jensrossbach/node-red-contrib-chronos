const js = require("@eslint/js");
const globals = require("globals");

module.exports =
[
    js.configs.recommended,
    {
        languageOptions:
        {
            ecmaVersion: "latest",
            sourceType:  "commonjs",
            globals:
            {
                ...globals.commonjs,
                ...globals.es6,
                ...globals.node
            }
        },
        ignores: ["test/**"],
        rules:
        {
            "multiline-comment-style": "off",
            "no-trailing-spaces":      "error",
            "no-lonely-if":            "error",
            "no-tabs":                 "error",
            "new-cap":                 "error",
            "space-in-parens":         "error",
            "space-unary-ops":         "error",
            "semi-spacing":            "error",
            "func-call-spacing":       "error",
            "switch-colon-spacing":    "error",
            "arrow-spacing":           "error",
            "camelcase":               "error",
            "indent":
            [
                "error", 4,
                {
                    "SwitchCase": 1,
                    "FunctionDeclaration":
                    {
                        "parameters": "off"
                    },
                    "FunctionExpression":
                    {
                        "parameters": "off"
                    },
                    "CallExpression":
                    {
                        "arguments": "off"
                    },
                    "ObjectExpression": "off",
                    "MemberExpression": "off"
                }
            ],
            "quotes":
            [
                "error",
                "double"
            ],
            "comma-dangle":
            [
                "error",
                "never"
            ],
            "eol-last":
            [
                "error",
                "always"
            ],
            "semi":
            [
                "error",
                "always"
            ],
            "semi-style":
            [
                "error",
                "last"
            ],
            "brace-style":
            [
                "error",
                "allman",
                {
                    "allowSingleLine": true
                }
            ],
            "linebreak-style":
            [
                "error",
                "unix"
            ],
            "spaced-comment":
            [
                "error",
                "always"
            ],
            "space-before-function-paren":
            [
                "error",
                "never"
            ]
        }
    }
];
