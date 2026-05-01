import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Rose n=3 SVG with gradient-animated trail at seek(π)
 *
 * Covers:
 * - SVG renderer with gradient trails
 * - Animated gradient style ('bard' palette)
 * - DPR scaling (via viewBox)
 * - Skeleton rendering
 * - Trail ribbon (SVG paths) with color
 */
test('rose3 svg gradient renders correctly', async ({ page }) => {
  await page.goto('/test/visual/rose3-svg-gradient');

  const container = page.locator('#svg-container');

  await page.waitForFunction(() => {
    const c = document.getElementById('svg-container');
    return c !== null && c.querySelector('circle[data-sarmal-role="head"]') !== null;
  });

  await expect(container).toHaveScreenshot('rose3-svg-gradient.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
