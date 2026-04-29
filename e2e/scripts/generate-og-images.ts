/**
 * Uses Playwright to take deterministic screenshots of a dedicated template page for each curve.
 * Saves 1200×630 PNGs to docs/public/og/curves/.
 *
 * @example npx tsx e2e/scripts/generate-og-images.ts
 */

import { chromium } from "@playwright/test";
import { curves } from "@sarmal/core";
import { existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:4321";
const VIEWPORT = { width: 1200, height: 630 };
const DEVICE_SCALE_FACTOR = 2;
const OUTPUT_DIR = resolve(SCRIPT_DIR, "../../docs/public/og/curves");

const CURVE_IDS = Object.keys(curves);

async function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
  });
  const page = await context.newPage();

  let ok = 0;
  let fail = 0;

  for (const id of CURVE_IDS) {
    const url = `${BASE_URL}/test/og-curve/${id}`;
    const outPath = resolve(OUTPUT_DIR, `${id}.png`);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 5000 });

      await page.waitForFunction(() => {
        const c = document.getElementById("og-curve") as HTMLCanvasElement | null;
        return c !== null && c.width > 0 && c.height > 0;
      });

      await page.screenshot({ path: outPath, fullPage: false });
      ok++;
      console.log(`  ${id}.png`);
    } catch (err) {
      fail++;
      console.error(`  FAILED ${id}:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();

  console.log(`\nDone: ${ok} generated, ${fail} failed → ${OUTPUT_DIR}`);

  if (fail > 0) {
    process.exitCode = 1;
  }
}

main();
