import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/auto-init.ts", "src/curves/**/*.ts", "src/terminal.ts"],
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
  },
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    minify: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
