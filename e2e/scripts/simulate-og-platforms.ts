/**
 * Navigates to /test/og/platform-sim and screenshots each platform section.
 * The Astro page renders the curve OG image in realistic social media mockups.
 *
 * @example npx tsx e2e/scripts/simulate-og-platforms.ts
 * @example npx tsx e2e/scripts/simulate-og-platforms.ts rose3
 */

import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "fs";
import { basename, resolve } from "path";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const BASE_URL = "http://localhost:4321";
const OUTPUT_DIR = resolve(SCRIPT_DIR, "../../docs/public/og/platforms");

const CURVE = process.argv[2] ?? "rose3";
const PAGE_URL = `${BASE_URL}/test/og/platform-sim?curve=${CURVE}`;

const PLATFORM_IDS = [
  { id: "facebook", label: "Facebook Feed", width: 560, height: 750 },
  { id: "linkedin", label: "LinkedIn Feed", width: 560, height: 750 },
  { id: "twitter", label: "X / Twitter Card", width: 560, height: 700 },
  { id: "imessage", label: "iMessage", width: 400, height: 520 },
  { id: "whatsapp", label: "WhatsApp", width: 400, height: 470 },
  { id: "slack", label: "Slack Unfurl", width: 560, height: 550 },
  { id: "square-crop", label: "Square Crop (1:1)", width: 780, height: 560 },
];

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`  Page: ${PAGE_URL}`);

  const browser = await chromium.launch();
  let ok = 0;
  let fail = 0;

  for (const platform of PLATFORM_IDS) {
    const outPath = resolve(OUTPUT_DIR, `${platform.id}.png`);
    console.log(`  ${platform.label} → ${basename(outPath)}`);

    const context = await browser.newContext({
      viewport: { width: platform.width, height: platform.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    try {
      await page.goto(PAGE_URL, { waitUntil: "load", timeout: 15000 });

      // Wait for the OG image inside this platform's section to load
      const sel = `#platform-${platform.id} img`;
      try {
        await page.waitForFunction(
          (s: string) => {
            const img = document.querySelector(s) as HTMLImageElement | null;
            return img !== null && img.complete && img.naturalWidth > 0;
          },
          sel,
          { timeout: 10000 },
        );
      } catch {
        console.warn(`    Image wait timeout, proceeding...`);
      }

      // Screenshot just the platform section element
      const el = await page.$(`#platform-${platform.id}`);
      if (el) {
        await el.screenshot({ path: outPath });
      } else {
        // Fallback: full page
        await page.screenshot({ path: outPath, fullPage: true });
      }
      ok++;
    } catch (err) {
      fail++;
      console.error(
        `    FAILED ${platform.label}:`,
        err instanceof Error ? err.message : err,
      );
    } finally {
      await context.close().catch(() => {});
    }
  }

  await browser.close();

  console.log(`\nDone: ${ok} generated, ${fail} failed → ${OUTPUT_DIR}`);
  if (fail > 0) process.exitCode = 1;
}

main();
