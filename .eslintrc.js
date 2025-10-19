module.exports = {
   env: {
      node: true,
      es2021: true,
   },
   extends: ["eslint:recommended", "prettier"],
   parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
   },
   overrides: [
      {
         files: ["benchmarks/k6-scripts/**/*.js"],
         globals: {
            __ENV: "readonly",
            __VU: "readonly",
            __ITER: "readonly",
         },
      },
   ],
   rules: {
      // Require semicolons
      semi: ["error", "always"],
      "semi-spacing": ["error", { before: false, after: true }],
      "semi-style": ["error", "last"],
      "no-extra-semi": "error",
      "no-unexpected-multiline": "error",

      // Other useful rules
      quotes: ["error", "double", { avoidEscape: true }],
      //  "comma-dangle": ["error", "always-multiline"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
   },
   ignorePatterns: [
      "node_modules/",
      "dist/",
      "build/",
      "coverage/",
      "*.min.js",
      "315046.0x/",
      "benchmarks/jmeter/**/*",
      "benchmarks/results/**/*",
      "client/**/*",
   ],
};
