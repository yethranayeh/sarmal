// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://sarmal.art",
  integrations: [sitemap()],
  vite: {
    // @ts-ignore | can't really be bothered as to why it's giving type errors. It's the literal official way to set it up...
    plugins: [tailwindcss()],
  },
});
