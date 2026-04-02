// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
	vite: {
		// @ts-ignore | can't really be bothered as to why it's giving type errors. It's the literal official way to set it up...
		plugins: [tailwindcss()]
	}
});
