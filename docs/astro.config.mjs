// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import { rehypeHeadingIds } from "@astrojs/markdown-remark";

import sarmalLight from "./src/themes/sarmal-editorial.json";
import sarmalDark from "./src/themes/sarmal-editorial-dark.json";
import rehypeWrapTables from "./src/plugins/rehype-wrap-tables.mjs";
import rehypeHeadingAnchors from "./src/plugins/rehype-heading-anchors.mjs";
import rehypeWrapSections from "./src/plugins/rehype-wrap-sections.mjs";

import svelte from "@astrojs/svelte";

// https://astro.build/config
export default defineConfig({
  site: "https://sarmal.art",
  integrations: [
    sitemap(),
    mdx({
      rehypePlugins: [rehypeWrapTables, rehypeHeadingIds, rehypeHeadingAnchors, rehypeWrapSections],
    }),
    svelte(),
  ],
  markdown: {
    rehypePlugins: [rehypeWrapTables],
    shikiConfig: {
      themes: {
        // @ts-ignore | Shiki too hard to please
        light: sarmalLight,
        // @ts-ignore | Shiki too hard to please
        dark: sarmalDark,
      },
      defaultColor: false,
      wrap: true,
    },
  },
  vite: {
    // @ts-ignore | can't really be bothered as to why it's giving type errors. It's the literal official way to set it up...
    plugins: [tailwindcss()],
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
