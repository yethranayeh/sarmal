import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Mid-morph frame (Astroid → Deltoid at alpha=0.5)
 *
 * Covers:
 * - Morph rendering path
 * - Canvas renderer with interpolated curve
 * - DPR scaling
 * - Skeleton rendering during morph
 */
test('morph mid-frame renders correctly', async ({ page }) => {
  await page.goto('/test/visual/morph-mid');

  const canvas = page.locator('#morph-canvas');

  await page.waitForFunction(() => {
    const c = document.getElementById('morph-canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    return c !== null && c.width === Math.floor(200 * dpr);
  });

  await expect(canvas).toHaveScreenshot('morph-mid.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
