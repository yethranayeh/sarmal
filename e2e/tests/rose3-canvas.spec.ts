import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Rose n=3 canvas at seek(π)
 *
 * Covers:
 * - Canvas renderer
 * - DPR scaling
 * - Skeleton rendering
 * - Trail ribbon
 * - Symmetric curve (3-petal rose)
 */
test('rose3 canvas renders correctly', async ({ page }) => {
  await page.goto('/test/visual/rose3-canvas');

  const canvas = page.locator('#rose3-canvas');

  await page.waitForFunction(() => {
    const c = document.getElementById('rose3-canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    return c !== null && c.width === Math.floor(200 * dpr);
  });

  await expect(canvas).toHaveScreenshot('rose3-canvas.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
