import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Mid-morph frame (Astroid → Deltoid at alpha=0.5)
 *
 * Covers:
 * - Morph rendering path
 * - Canvas renderer with interpolated curve
 * - DPR scaling
 * - Skeleton rendering during morph
 * - Trail ribbon during morph
 */
test('morph mid-frame renders correctly', async ({ page }) => {
  await page.goto('/test/visual/morph-mid');

  // Wait for canvas to be present and the sarmal to be initialized
  const canvas = page.locator('#morph-canvas');
  await canvas.waitFor({ state: 'visible' });

  // Wait for the renderer to initialize
  await page.waitForFunction(() => {
    const c = document.getElementById('morph-canvas');
    const dpr = window.devicePixelRatio || 1;
    return c && c.width === Math.floor(200 * dpr);
  });

  // Additional frame for render to settle
  await page.waitForTimeout(100);

  // Compare screenshot to baseline
  await expect(canvas).toHaveScreenshot('morph-mid.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
