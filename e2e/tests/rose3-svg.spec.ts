import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Rose n=3 SVG at seek(π)
 *
 * Covers:
 * - SVG renderer
 * - DPR scaling (via viewBox)
 * - Skeleton rendering
 * - Trail ribbon (SVG paths)
 * - Symmetric curve (3-petal rose)
 */
test('rose3 svg renders correctly', async ({ page }) => {
  await page.goto('/test/visual/rose3-svg');

  // Wait for SVG container to be present
  const container = page.locator('#svg-container');
  await container.waitFor({ state: 'visible' });

  // Wait for SVG to be created (sarmal appends SVG to container)
  await page.waitForFunction(() => {
    const c = document.getElementById('svg-container');
    return c && c.querySelector('svg') !== null;
  });

  // Additional frame for render to settle
  await page.waitForTimeout(100);

  // Compare screenshot of the container (includes SVG)
  await expect(container).toHaveScreenshot('rose3-svg.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
