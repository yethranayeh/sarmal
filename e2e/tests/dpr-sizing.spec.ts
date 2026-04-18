import { test, expect } from '@playwright/test';

/**
 * DPR Sizing Verification Test
 *
 * This test catches the "canvas element doubling" bug that visual snapshot
 * tests cannot detect. The bug occurs when applyDprSizing() sets canvas.width
 * to logicalWidth * DPR but forgets to pin canvas.style.width/height.
 *
 * Without style pinning, the canvas element visually expands to match its
 * intrinsic buffer size (e.g., 400px at DPR=2 instead of 200px).
 *
 * The fixture page has NO CSS sizing on the canvas element itself — only on
 * the container. This forces applyDprSizing to correctly set inline styles.
 */
test('canvas element display size stays at logical dimensions despite DPR scaling', async ({ page }) => {
  await page.goto('/test/visual/dpr-sizing');

  const canvas = page.locator('#dpr-test-canvas');

  await page.waitForFunction(() => {
    const c = document.getElementById('dpr-test-canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    return c !== null && c.width === Math.floor(200 * dpr);
  });

  // Get the rendered element bounds (display size, not buffer size)
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // CRITICAL: Display size must remain at logical 200×200
  // If applyDprSizing forgets to set style.width/height, this would be 400×400 at DPR=2
  expect(box!.width).toBe(200);
  expect(box!.height).toBe(200);

  // Verify the buffer IS scaled by DPR (different from display size)
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const canvasWidth = await canvas.evaluate(el => el.width);
  const canvasHeight = await canvas.evaluate(el => el.height);

  expect(canvasWidth).toBe(Math.floor(200 * dpr));
  expect(canvasHeight).toBe(Math.floor(200 * dpr));

  // Verify inline styles were set (the fix for the doubling bug)
  const styleWidth = await canvas.evaluate(el => el.style.width);
  const styleHeight = await canvas.evaluate(el => el.style.height);

  expect(styleWidth).toBe('200px');
  expect(styleHeight).toBe('200px');
});

test('canvas renders correctly at all DPR levels', async ({ page }) => {
  await page.goto('/test/visual/dpr-sizing');

  const canvas = page.locator('#dpr-test-canvas');

  await page.waitForFunction(() => {
    const c = document.getElementById('dpr-test-canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    return c !== null && c.width === Math.floor(200 * dpr);
  });

  await expect(canvas).toHaveScreenshot('dpr-sizing.png', {
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
});
