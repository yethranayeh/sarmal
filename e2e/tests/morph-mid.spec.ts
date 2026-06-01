import { test, expect } from '@playwright/test';

/**
 * Visual regression test: Astroid → Deltoid morph at alpha=0 (start of morph)
 *
 * Covers:
 * - Canvas renderer initialization with engine already in morph state
 * - Skeleton and trail rendering at morph start (alpha=0)
 * - DPR scaling
 */
test('morph init frame renders correctly', async ({ page }) => {
  await page.goto('/test/visual/morph-mid/');

  const canvas = page.locator('#morph-canvas');

  await page.waitForFunction(() => {
    const c = document.getElementById('morph-canvas') as HTMLCanvasElement;
    return c !== null && c.dataset.sarmalReady === 'true';
  });

  await expect(canvas).toHaveScreenshot('morph-mid.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
