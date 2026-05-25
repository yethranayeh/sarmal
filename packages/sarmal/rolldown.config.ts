import { defineConfig } from "rolldown";

export default defineConfig([
  // Library build: preserveModules preserves the module graph so bundlers can
  //  tree-shake at the file level (e.g. excluding catmull-rom when only rose3 is used).
  {
    input: ["src/index.ts", "src/terminal.ts"],
    output: [
      {
        format: "esm",
        dir: "dist",
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        sourcemap: true,
      },
      {
        format: "cjs",
        dir: "dist",
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].cjs",
        chunkFileNames: "[name].cjs",
        sourcemap: true,
      },
    ],
  },
  // auto-init: intentional flat bundle for CDN / <script type="module"> usage.
  // Includes everything so the user is one script tag away from a working animation.
  {
    input: "src/auto-init.ts",
    output: [
      { format: "esm", file: "dist/auto-init.js", sourcemap: true },
      { format: "cjs", file: "dist/auto-init.cjs", sourcemap: true },
    ],
  },
  // CLI: flat bundle, Node-only, shebang required for `npx sarmal` / `sarmal` invocation.
  {
    input: "src/cli.ts",
    output: {
      format: "esm",
      file: "dist/cli.js",
      sourcemap: true,
      banner: "#!/usr/bin/env node",
    },
  },
]);
