import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/auto-init.ts", "src/curves/**/*.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
});
