import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Astroid canvas at seek(π)
 *
 * Covers:
 * - Canvas renderer
 * - DPR scaling
 * - Skeleton rendering
 * - Trail ribbon
 * - Symmetric curve with cusps
 */
test('astroid renders correctly', async ({ page }) => {
  await page.goto('/test/visual/astroid');

  const canvas = page.locator('#astroid-canvas');

  await page.waitForFunction(() => {
    const c = document.getElementById('astroid-canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    return c !== null && c.width === Math.floor(200 * dpr);
  });

  await expect(canvas).toHaveScreenshot('astroid.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
