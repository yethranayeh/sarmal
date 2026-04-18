import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Rose n=3 canvas with gradient-animated trail at seek(π)
 *
 * Covers:
 * - Canvas renderer with gradient trails
 * - Animated gradient style ('bard' palette)
 * - DPR scaling
 * - Skeleton rendering
 * - Trail ribbon with color
 */
test('rose3 canvas gradient renders correctly', async ({ page }) => {
  await page.goto('/test/visual/rose3-canvas-gradient');

  const canvas = page.locator('#rose3-canvas-gradient');

  await page.waitForFunction(() => {
    const c = document.getElementById('rose3-canvas-gradient') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    return c !== null && c.width === Math.floor(200 * dpr);
  });

  await expect(canvas).toHaveScreenshot('rose3-canvas-gradient.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
