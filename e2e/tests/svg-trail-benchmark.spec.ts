import { test, expect } from '@playwright/test';

/**
 * SVG trail pool performance benchmark
 *
 * Measures actual render callback execution time (not rAF interval)
 * at increasing trail lengths to determine a data-driven warning threshold.
 *
 * The fixture page monkey-patches requestAnimationFrame to record
 * how long each callback takes to execute. This measures CPU time,
 * not the display refresh interval.
 *
 * This is a measurement tool, not a pass/fail test. No snapshot assertions.
 */

test('svg trail benchmark', async ({ page, browserName }) => {
  // Only run in Chromium for consistent baseline measurement
  test.skip(browserName !== 'chromium', 'Benchmark only runs in Chromium');

  const trailLengths = [100, 500, 1000, 2000, 3000, 5000, 7500, 10000];
  const frameCount = 60;
  const results: Array<{
    trailLength: number;
    avgMs: number;
    p95Ms: number;
    minMs: number;
    maxMs: number;
  }> = [];

  for (const trailLength of trailLengths) {
    await page.goto(`/test/svg-trail-benchmark?trail=${trailLength}`);

    // Wait for the SVG to be mounted
    await page.waitForFunction(() => {
      const container = document.getElementById('container');
      return container !== null && container.querySelector('svg') !== null;
    });

    // Let the animation warm up
    await page.waitForTimeout(500);

    // Wait for enough frames to be collected by the fixture's instrumentation
    await page.waitForFunction(
      (count) => {
        const data = (window as any).__sarmalBenchmark?.frameDurations;
        return Array.isArray(data) && data.length >= count;
      },
      frameCount,
    );

    // Read the execution times from the fixture page
    const durations: number[] = await page.evaluate(() => {
      const data = (window as any).__sarmalBenchmark?.frameDurations;
      // Skip the first frame (includes setup cost)
      return data.slice(1, 61);
    });

    // Compute statistics
    durations.sort((a, b) => a - b);
    const avg = durations.reduce((s, v) => s + v, 0) / durations.length;
    const p95Idx = Math.ceil(durations.length * 0.95) - 1;
    const p95 = durations[Math.max(0, p95Idx)] ?? 0;

    results.push({
      trailLength,
      avgMs: Math.round(avg * 100) / 100,
      p95Ms: Math.round(p95 * 100) / 100,
      minMs: Math.round(durations[0]! * 100) / 100,
      maxMs: Math.round(durations[durations.length - 1]! * 100) / 100,
    });
  }

  // Log results as a table
  console.log('\n┌─────────────┬─────────┬─────────┬─────────┬─────────┐');
  console.log('│ trailLength │  avg ms │  p95 ms │  min ms │  max ms │');
  console.log('├─────────────┼─────────┼─────────┼─────────┼─────────┤');
  for (const r of results) {
    console.log(
      `│ ${String(r.trailLength).padStart(11)} │ ${String(r.avgMs).padStart(7)} │ ${String(r.p95Ms).padStart(7)} │ ${String(r.minMs).padStart(7)} │ ${String(r.maxMs).padStart(7)} │`,
    );
  }
  console.log('└─────────────┴─────────┴─────────┴─────────┴─────────┘');

  // Mark the test as passing regardless — it's a benchmark, not a gate
  expect(true).toBe(true);
});
