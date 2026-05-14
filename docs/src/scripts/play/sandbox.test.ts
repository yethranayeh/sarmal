import { describe, it, expect, vi } from "vitest"
import { createLookupFn, workersSupported, createSandboxWorker, createEvalLoop } from "./sandbox"
import type { Point } from "@sarmal/core"

describe("createLookupFn", () => {
  const TWO_PI = Math.PI * 2

  it("returns exact sample points at sample phases", () => {
    const samples: Array<Point> = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]
    const fn = createLookupFn(samples, TWO_PI)
    const period = TWO_PI

    // For i < n-1, sample phases map exactly to samples
    for (let i = 0; i < samples.length - 1; i++) {
      const phase = (i / (samples.length - 1)) * period
      const result = fn(phase, 0, {})
      expect(result.x).toBeCloseTo(samples[i].x, 10)
      expect(result.y).toBeCloseTo(samples[i].y, 10)
    }

    // At exact period, phase wraps to 0 — returns samples[0]
    const atPeriod = fn(TWO_PI, 0, {})
    expect(atPeriod.x).toBeCloseTo(samples[0].x, 10)
    expect(atPeriod.y).toBeCloseTo(samples[0].y, 10)
  })

  it("wraps phase=period to phase=0 (first sample)", () => {
    const samples: Array<Point> = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]
    const fn = createLookupFn(samples, TWO_PI)

    // phase = period wraps to 0 via modulo — returns first sample
    const atPeriod = fn(TWO_PI, 0, {})
    expect(atPeriod.x).toBeCloseTo(samples[0].x, 10)
    expect(atPeriod.y).toBeCloseTo(samples[0].y, 10)

    // phase = 4π also wraps to 0
    const atDouble = fn(TWO_PI * 2, 0, {})
    expect(atDouble.x).toBeCloseTo(samples[0].x, 10)
    expect(atDouble.y).toBeCloseTo(samples[0].y, 10)
  })

  it("handles negative phases by wrapping", () => {
    const samples: Array<Point> = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]
    const fn = createLookupFn(samples, TWO_PI)

    // With 4 samples (spaced at 0, 2π/3, 4π/3, 2π):
    // phase = -π/2 wraps to 3π/2, which is between samples[2](-1,0) and samples[3](0,-1)
    const negPhase = fn(-Math.PI / 2, 0, {})
    // Interpolated: x = -1 + (0-(-1)) * 0.25 = -0.75, y = 0 + (-1-0) * 0.25 = -0.25
    expect(negPhase.x).toBeCloseTo(-0.75, 10)
    expect(negPhase.y).toBeCloseTo(-0.25, 10)
  })

  it("ignores elapsed and params arguments", () => {
    const samples: Array<Point> = [{ x: 1, y: 0 }, { x: 0, y: 1 }]
    const fn = createLookupFn(samples, TWO_PI)

    // Same phase with different elapsed/params should give same result
    const a = fn(0, 0, {})
    const b = fn(0, 100, { foo: 42 })
    expect(a.x).toBe(b.x)
    expect(a.y).toBe(b.y)
  })

  it("interpolates between samples", () => {
    const samples: Array<Point> = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]
    const fn = createLookupFn(samples, TWO_PI)

    // Midway should be halfway between (closer to index 1 for 3 samples)
    // There are 2 samples, so phase=0 → index 0, phase=2π → index 1
    // phase=π → interpolated halfway
    const mid = fn(Math.PI, 0, {})
    expect(mid.x).toBeCloseTo(5, 10)
    expect(mid.y).toBeCloseTo(0, 10)
  })

  it("custom period shifts where samples map to phase values", () => {
    const period = 4
    const samples: Array<Point> = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ]
    const fn = createLookupFn(samples, period)

    // phase=2 (halfway through a period=4 curve) → interpolated halfway
    const mid = fn(2, 0, {})
    expect(mid.x).toBeCloseTo(4, 10)
  })

  it("returns correct type (numbers, not strings)", () => {
    const samples: Array<Point> = [{ x: 1, y: 0 }, { x: 0, y: 1 }]
    const fn = createLookupFn(samples, TWO_PI)
    const result = fn(0, 0, {})

    expect(typeof result.x).toBe("number")
    expect(typeof result.y).toBe("number")
    expect(Number.isFinite(result.x)).toBe(true)
    expect(Number.isFinite(result.y)).toBe(true)
  })

  it("periodic continuity: phase=period wraps to first sample", () => {
    // 5 samples forming a circle
    const samples = Array.from({ length: 5 }, (_, i) => {
      const angle = (i / 5) * TWO_PI
      return { x: Math.cos(angle), y: Math.sin(angle) }
    })
    const fn = createLookupFn(samples, TWO_PI)

    // At exactly the period, phase wraps to 0 → returns first sample
    const atPeriod = fn(TWO_PI, 0, {})
    expect(atPeriod.x).toBeCloseTo(samples[0].x, 10)
    expect(atPeriod.y).toBeCloseTo(samples[0].y, 10)
  })
})

describe("workersSupported", () => {
  it("returns a boolean", () => {
    const result = workersSupported()
    expect(typeof result).toBe("boolean")
  })
})

describe("createSandboxWorker", () => {
  it("returns null in Node environment (Worker unavailable)", () => {
    // In Node (vitest environment), Worker is not available
    // unless jsdom was configured with worker support
    const worker = createSandboxWorker()
    expect(worker).toBeNull()
  })
})

describe("createEvalLoop", () => {
  const TWO_PI = Math.PI * 2

  function stubWorker(): Worker {
    return {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onmessageerror: null,
      onerror: null,
      dispatchEvent: vi.fn(),
      removeAllEventListeners: vi.fn(),
    } as unknown as Worker
  }

  it("uses skeleton lookup table when elapsed === 0", () => {
    const skeleton: Point[] = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
    ]
    const worker = stubWorker()
    const loop = createEvalLoop(worker, skeleton, TWO_PI)

    // At elapsed=0, returns the lookup table result (not {0,0})
    const result = loop.proxyFn(0, 0, {})
    expect(result.x).toBeCloseTo(1, 10)
    expect(result.y).toBeCloseTo(0, 10)

    loop.dispose()
  })

  it("fires postMessage and returns cached value when elapsed > 0", () => {
    const skeleton: Point[] = [
      { x: 5, y: 0 },
      { x: 0, y: 5 },
    ]
    const worker = stubWorker()
    const loop = createEvalLoop(worker, skeleton, TWO_PI)

    // First call at elapsed=1 — returns first skeleton point (initial cache)
    const result = loop.proxyFn(0, 1, {})
    expect(result.x).toBeCloseTo(5, 10)
    expect(result.y).toBeCloseTo(0, 10)
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "eval",
      phase: 0,
      elapsed: 1,
    }))

    loop.dispose()
  })

  it("cached value updates when Worker eval-result arrives with matching id", () => {
    const skeleton: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const worker = stubWorker()
    const loop = createEvalLoop(worker, skeleton, TWO_PI)

    // Trigger a postMessage to set lastSentId
    loop.proxyFn(Math.PI, 1, {})

    // Simulate Worker response: find the registered handler
    const addCall = (worker.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === "message"
    )!
    expect(addCall).toBeDefined()
    const handler = addCall[1] as (e: MessageEvent) => void

    // Send a response with the correct id (1)
    handler({ data: { type: "eval-result", id: 1, ok: true, x: 42, y: 7 } } as MessageEvent)

    // Next proxy call returns updated cached value
    const result = loop.proxyFn(Math.PI, 2, {})
    expect(result.x).toBe(42)
    expect(result.y).toBe(7)

    loop.dispose()
  })

  it("ignores Worker responses with stale id", () => {
    const skeleton: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const worker = stubWorker()
    const loop = createEvalLoop(worker, skeleton, TWO_PI)

    // Fire two eval requests (id 1 and id 2)
    loop.proxyFn(0, 1, {})
    loop.proxyFn(0, 2, {})

    const addCall = (worker.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === "message"
    )!
    const handler = addCall[1] as (e: MessageEvent) => void

    // Stale response (id 1) — should be ignored
    handler({ data: { type: "eval-result", id: 1, ok: true, x: 99, y: 99 } } as MessageEvent)

    // Fresh response (id 2) — should update cache
    handler({ data: { type: "eval-result", id: 2, ok: true, x: 42, y: 7 } } as MessageEvent)

    const result = loop.proxyFn(0, 3, {})
    expect(result.x).toBe(42)
    expect(result.y).toBe(7)

    loop.dispose()
  })

  it("ignores non-eval-result messages", () => {
    const skeleton: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const worker = stubWorker()
    const loop = createEvalLoop(worker, skeleton, TWO_PI)

    loop.proxyFn(0, 1, {})

    const addCall = (worker.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => c[0] === "message"
    )!
    const handler = addCall[1] as (e: MessageEvent) => void

    // Non-eval message — should be ignored
    handler({ data: { type: "compile-result", id: 1, ok: true } } as MessageEvent)

    // Cache is still first skeleton point
    const result = loop.proxyFn(0, 2, {})
    expect(result.x).toBe(skeleton[0].x)
    expect(result.y).toBe(skeleton[0].y)

    loop.dispose()
  })

  it("dispose removes the message listener", () => {
    const skeleton: Point[] = [{ x: 0, y: 0 }]
    const worker = stubWorker()
    const loop = createEvalLoop(worker, skeleton, TWO_PI)

    loop.dispose()

    expect(worker.removeEventListener).toHaveBeenCalledWith("message", expect.any(Function))
  })
})
