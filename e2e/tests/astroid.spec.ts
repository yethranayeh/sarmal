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

  // Wait for canvas to be present and the sarmal to be initialized
  const canvas = page.locator('#astroid-canvas');
  await canvas.waitFor({ state: 'visible' });

  // Wait for the renderer to initialize (sarmal creates engine and renderer)
  // The canvas will have data-sarmal-initialized attribute after init
  await page.waitForFunction(() => {
    const c = document.getElementById('astroid-canvas');
    // Check if canvas has been processed (seek was called, so ctx should have drawn)
    // We detect this by checking if the canvas width matches DPR-scaled value
    const dpr = window.devicePixelRatio || 1;
    return c && c.width === Math.floor(200 * dpr);
  });

  // Additional frame for render to settle after stop()
  await page.waitForTimeout(100);

  // Compare screenshot to baseline
  await expect(canvas).toHaveScreenshot('astroid.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
