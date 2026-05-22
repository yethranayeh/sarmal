import { test, expect } from "@playwright/test";

/**
 * Dot matrix drawing approach benchmark.
 *
 * Runs all 5 drawing strategies × 4 grid sizes in a real browser (real canvas, real GPU).
 * Results are written to window.__dotMatrixBenchResults by the page.
 *
 * This is NOT a visual regression test. It passes as long as the benchmark
 * completes without throwing, and prints a summary table to the console.
 *
 * Run against a single browser for consistent numbers:
 *   pnpm test:e2e --grep "dot matrix benchmark" --project chromium-dpr1
 */

type BenchResult = {
  approach: string;
  gridSize: number;
  avgFrameMs: number;
  minFrameMs: number;
  maxFrameMs: number;
  fillCallsPerFrame: number;
};

test("dot matrix benchmark", async ({ page }) => {
  await page.goto("/test/benchmark/dot-matrix/");

  // The page runs synchronously inside a rAF callback and writes results to window.
  // Give it up to 2 minutes — larger grids × 400 frames can take a moment in CI.
  await page.waitForFunction(
    () => (window as unknown as Record<string, unknown>)["__dotMatrixBenchResults"] !== undefined,
    { timeout: 120_000 },
  );

  const results = await page.evaluate(
    () =>
      (window as unknown as Record<string, unknown>)["__dotMatrixBenchResults"] as BenchResult[],
  );

  expect(results.length).toBeGreaterThan(0);

  // Print a readable summary
  console.log("\n── Dot Matrix Benchmark Results ──────────────────────────────");
  console.table(
    results.map((r) => ({
      approach: r.approach,
      size: `${r.gridSize}×${r.gridSize}`,
      "avg (ms)": r.avgFrameMs.toFixed(4),
      "min (ms)": r.minFrameMs.toFixed(4),
      "max (ms)": r.maxFrameMs.toFixed(4),
      "fills/frame": r.fillCallsPerFrame.toFixed(1),
    })),
  );

  // Sanity: every approach at every size should have measured something
  for (const r of results) {
    expect(r.avgFrameMs).toBeGreaterThan(0);
    expect(r.minFrameMs).toBeGreaterThanOrEqual(0);
    expect(r.maxFrameMs).toBeGreaterThanOrEqual(r.avgFrameMs - 0.001); // floating-point tolerance
  }
});
