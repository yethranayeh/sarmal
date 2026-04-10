// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

import sarmalLight from "./src/themes/sarmal-editorial.json";
import sarmalDark from "./src/themes/sarmal-editorial-dark.json";

// https://astro.build/config
export default defineConfig({
  site: "https://sarmal.art",
  integrations: [sitemap()],
  vite: {
    // @ts-ignore | can't really be bothered as to why it's giving type errors. It's the literal official way to set it up...
    plugins: [tailwindcss()],
  },
  markdown: {
    shikiConfig: {
      themes: {
        // @ts-ignore | Shiki too hard to please
        light: sarmalLight,
        // @ts-ignore | Shiki too hard to please
        dark: sarmalDark,
      },
      wrap: true,
    },
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Newsreader",
      cssVariable: "--font-heading",
      weights: ["200", "300", "400", "500", "600", "700", "800"],
      styles: ["normal", "italic"],
    },
  ],
});
