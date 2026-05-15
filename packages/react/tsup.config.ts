import { defineConfig } from "tsup";
import { readFile, writeFile } from "node:fs/promises";

const USE_CLIENT = '"use client";\n';

async function injectUseClient(files: string[]) {
  await Promise.all(
    files.map(async (file) => {
      const content = await readFile(file, "utf-8");
      if (!content.startsWith(USE_CLIENT)) {
        await writeFile(file, USE_CLIENT + content);
      }
    }),
  );
}

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["react", "react-dom", "@sarmal/core"],
  async onSuccess() {
    await injectUseClient(["dist/index.js", "dist/index.cjs"]);
  },
});
