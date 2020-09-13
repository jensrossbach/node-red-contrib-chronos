module.exports =
{
    "env":
    {
        "commonjs": true,
        "es6":      true,
        "node":     true
    },
    "extends": "eslint:recommended",
    "globals":
    {
        "Atomics":           "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions":
    {
        "ecmaVersion": 2018
    },
    "rules":
    {
        "indent":                      ["error", 4, {"SwitchCase":           1,
                                                     "FunctionDeclaration": {"parameters": "off"},
                                                     "FunctionExpression":  {"parameters": "off"},
                                                     "CallExpression":      {"arguments": "off"},
                                                     "ObjectExpression":     "off",
                                                     "MemberExpression":     "off"}],
        "quotes":                      ["error", "double"],
        "camelcase":                    "error",
        "comma-dangle":                ["error", "never"],
        "eol-last":                    ["error", "always"],
        "no-trailing-spaces":           "error",
        "no-lonely-if":                 "error",
        "no-tabs":                      "error",
        "new-cap":                      "error",
        "semi":                        ["error", "always"],
        "semi-style":                  ["error", "last"],
        "brace-style":                 ["error", "allman", {"allowSingleLine": true}],
        "linebreak-style":             ["error", "unix"],
        "multiline-comment-style":     ["error", "starred-block"],
        "spaced-comment":              ["error", "always"],
        "space-before-function-paren": ["error", "never"],
        "space-in-parens":              "error",
        "space-unary-ops":              "error",
        "semi-spacing":                 "error",
        "func-call-spacing":            "error",
        "switch-colon-spacing":         "error",
        "arrow-spacing":                "error"
    }
};
