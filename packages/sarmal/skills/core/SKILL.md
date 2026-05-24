---
name: core
description: Animated curve library for the web. Use when adding animated curves,
  loading indicators, or ambient motion with @sarmal/core — covers createSarmal (canvas),
  createSarmalSVG, createSarmalDotMatrix, terminal renderer, built-in curves,
  lifecycle, animation controls, and auto-init.
license: MIT
---

# @sarmal/core

sarmal renders animated curves as loading indicators, thinking states, or ambient motion. It is a canvas or SVG renderer that animates a moving "head" dot leaving a fading trail along a curve path.

## Type definitions (read these first)

The package ships TypeScript definitions that are the authoritative, always-current API reference. Read them before writing any code:

- `node_modules/@sarmal/core/dist/index.d.ts` — `SarmalInstance`, `SarmalOptions`, `SVGSarmalOptions`, `DotMatrixSarmalOptions`, `RuntimeRenderOptions`, `DotMatrixRuntimeRenderOptions`, `BaseRendererOptions`, `TrailStyle`, `TrailColor`, `Engine`, and all other types
- `node_modules/@sarmal/core/dist/curves/index.d.ts` — `CurveName` union type listing every available built-in curve name; individual curve exports
- `node_modules/@sarmal/core/dist/terminal.d.ts` — `terminalSarmal`, `TerminalSarmalOptions`

Do not rely on training data for option names, defaults, or curve names — read the `.d.ts` files.

## Installation

```bash
npm install @sarmal/core
```

## Entry points

```ts
// Main package — canvas, SVG, dot matrix, utilities
import { createSarmal, createSarmalSVG, createSarmalDotMatrix, curves } from "@sarmal/core";

// Auto-init (no-JS CDN usage)
import "@sarmal/core/auto";

// Terminal renderer (Node.js only)
import { terminalSarmal } from "@sarmal/core/terminal";
```

### Exported functions

| Function                                            | Purpose                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| `createSarmal(canvas, curveDef, options?)`          | Canvas ribbon renderer                             |
| `createSarmalSVG(svg, curveDef, options?)`          | SVG ribbon renderer                                |
| `createSarmalDotMatrix(canvas, curveDef, options?)` | Dot matrix canvas renderer                         |
| `createEngine(curveDef, trailLength?)`              | Math-only engine, no rendering                     |
| `createRenderer(options)`                           | Low-level canvas renderer (advanced)               |
| `createSVGRenderer(options)`                        | Low-level SVG renderer (advanced)                  |
| `drawCurve(points, options?)`                       | Build a `CurveDef` from Catmull-Rom control points |
| `terminalSarmal(stream, curveDef, options?)`        | Braille/ANSI terminal renderer                     |

## Using built-in curves

```ts
// Named import (tree-shakeable):
import { lissajous32 } from "@sarmal/core";
const sarmal = createSarmal(canvas, lissajous32);

// Or look up by name string from the curves namespace:
import { curves } from "@sarmal/core";
const sarmal = createSarmal(canvas, curves["rose5"]);
```

For all available curve names, read the `CurveName` type in `dist/curves/index.d.ts`.

## Coordinate space — most important gotcha

The two ribbon renderers use **different coordinate spaces** for all size values:

| Renderer                | Space               | `headRadius` default |
| ----------------------- | ------------------- | -------------------- |
| `createSarmal` (canvas) | CSS pixels          | `4`                  |
| `createSarmalSVG` (SVG) | 0–100 viewBox units | `0.5`                |

When configuring `headRadius` or any size option for the SVG renderer, use viewBox units (e.g. `1`–`3`), not pixel values. Passing a canvas-appropriate value like `4` to the SVG renderer produces a massive dot.

The same applies to `setRenderOptions` calls on SVG instances.

The dot matrix renderer does not use either coordinate space — it maps the curve onto a grid of dots specified by `cols` and `rows`.

## Lifecycle

```ts
const sarmal = createSarmal(canvas, curveDef, { autoStart: false });

sarmal.play(); // start the animation loop
sarmal.pause(); // pause — preserves animation state
sarmal.destroy(); // REQUIRED: stops the loop and frees resources
```

**Always call `destroy()`** when removing the element or unmounting a component. Omitting it leaks a `requestAnimationFrame` loop.

**`autoStart`** defaults to `true` — the animation begins immediately on creation. Pass `{ autoStart: false }` to start paused.

**`pauseOnHidden`** defaults to `true` — the animation automatically pauses when the browser tab is hidden and resumes when visible. Pass `{ pauseOnHidden: false }` to keep running in background tabs.

**`initialPhase`** — seeks to the given phase before the first frame, so the animation starts mid-curve with a full trail already rendered.

```ts
const sarmal = createSarmal(canvas, curveDef, { initialPhase: Math.PI });
```

## Animation controls

```ts
// Move to a phase position AND rebuild the trail as if the animation arrived naturally
sarmal.seek(Math.PI);

// Instantly teleport the head; trail is left untouched
sarmal.jump(Math.PI);
sarmal.jump(Math.PI, { clearTrail: true }); // or clear it

// Speed (0 = freeze, negative = reverse, no upper bound)
sarmal.setSpeed(2);
sarmal.resetSpeed(); // revert to curve's inherent default
await sarmal.setSpeedOver(0, 400); // smooth transition over 400ms

// Smooth curve transition (default 300ms)
await sarmal.morphTo(rose5);
await sarmal.morphTo(rose5, { duration: 600 });
```

**`seek` vs `jump`:** `seek` reconstructs the trail so it looks like the head arrived naturally — use for initialisation. `jump` moves the head instantly without touching the trail — use during morphs or mid-flight repositioning.

## Runtime style changes

`setRenderOptions` changes visual options on a live instance without recreating it. Validation is fail-atomic — if any field fails, the entire call is rejected and nothing changes.

```ts
sarmal.setRenderOptions({
  trailColor: ["#ff0000", "#0000ff"],
  trailStyle: "gradient-animated",
  trailWidth: 1.5, // multiplier: 1 = default, 2 = double width
  skeletonColor: "transparent", // hides the skeleton
  headColor: null, // null = derive from trail automatically
});
```

For the exact list of accepted fields, read `RuntimeRenderOptions` in `dist/index.d.ts`.

**Dot matrix instances** use `DotMatrixRuntimeRenderOptions` which only supports `trailColor`, `trailStyle`, and `skeletonColor`. Passing `headColor`, `headRadius`, or `trailWidth` to `setRenderOptions` on a dot matrix instance throws.

## Dot matrix renderer

`createSarmalDotMatrix` renders the curve as a grid of rounded dots on a canvas. The head and trail are expressed as brightness on the grid rather than a ribbon path.

```ts
import { createSarmalDotMatrix, rose3 } from "@sarmal/core";

const instance = createSarmalDotMatrix(canvas, rose3, {
  cols: 32, // dot columns (default: 32)
  rows: 32, // dot rows (default: 32)
  roundness: 1, // 0 = square, 1 = full circle (default: 1)
  trailColor: "#2dd4bf",
  trailStyle: "gradient-animated",
});
```

The canvas `width` and `height` HTML attributes (not CSS) determine the rendering area. The dot matrix renderer reads pixel dimensions directly; CSS sizing alone has no effect on the grid.

`trailLength` defaults to `cols * 3`. `DotMatrixSarmalOptions` supports the same lifecycle options as the ribbon renderers (`autoStart`, `pauseOnHidden`, `initialPhase`) but not `headColor`, `headRadius`, or `trailWidth`.

## Built-in palettes

`palettes` is a named collection of multi-stop color arrays ready to pass as `trailColor`:

```ts
import { palettes } from "@sarmal/core";

sarmal.setRenderOptions({
  trailColor: palettes.bard, // ["#a855f7", "#3b82f6", "#14b8a6", "#ec4899"]
  trailStyle: "gradient-animated",
});
```

Available names: `bard`, `carnival`, `ocean`, `sunset`, `ice`, `rocketpop`, `neon`, `vaporwave`, `pastel`, `sakura`. Read `SarmalPalette` in `dist/index.d.ts` for the full union.

## Drawing curves from control points

`drawCurve` builds a `CurveDef` from Catmull-Rom spline control points — no math required:

```ts
import { createSarmal, drawCurve } from "@sarmal/core";

const curve = drawCurve([
  [0, -0.8],
  [0.8, 0],
  [0, 0.8],
  [-0.8, 0],
]);

const sarmal = createSarmal(canvas, curve);
```

Control points are `[x, y]` tuples in `[-1, 1]` space. The spline is closed automatically.

## Terminal renderer

`@sarmal/core/terminal` renders curves in the terminal using braille characters and ANSI colors. Node.js only.

```ts
import { terminalSarmal } from "@sarmal/core/terminal";
import { artemis2 } from "@sarmal/core";

const stop = terminalSarmal(process.stdout, artemis2, {
  size: 16, // braille cell width (default: 16)
  fps: 30,
  speed: 1,
  color: "rgb", // "rgb" | "256" | "mono"
});

// stop() to clean up and restore cursor
```

Or run directly: `npx @sarmal/core` — accepts `--name`, `--fps`, `--speed`, `--size`, `--color`.

## Auto-init (no JS required)

Import the side-effect module or drop in the CDN script:

```ts
import "@sarmal/core/auto";
```

```html
<script src="https://cdn.jsdelivr.net/npm/@sarmal/core/dist/auto-init.js"></script>
```

Then annotate elements with `data-sarmal`:

```html
<!-- canvas ribbon renderer -->
<canvas data-sarmal="lissajous32" width="200" height="200"></canvas>

<!-- SVG ribbon renderer -->
<svg data-sarmal="rose5" style="width:200px; height:200px;"></svg>

<!-- dot matrix renderer — requires data-renderer="dot-matrix" -->
<canvas
  data-sarmal="rose3"
  data-renderer="dot-matrix"
  data-cols="32"
  data-rows="32"
  width="200"
  height="200"
></canvas>
```

`data-renderer` accepts `"dot-matrix"` or `"canvas"` (explicit but redundant). Any other value is an error — the element is skipped and a `console.error` is emitted. Omitting the attribute defaults to the canvas ribbon renderer.

### Supported data attributes

Shared by all three renderers:

| Attribute              | Mirrors option  | Notes                                                   |
| ---------------------- | --------------- | ------------------------------------------------------- |
| `data-sarmal`          | —               | **Required.** Curve name.                               |
| `data-trail-color`     | `trailColor`    | Single color string or JSON array: `'["#f00","#00f"]'`  |
| `data-skeleton-color`  | `skeletonColor` | Pass `"transparent"` to hide.                           |
| `data-trail-style`     | `trailStyle`    | `"default"`, `"gradient-static"`, `"gradient-animated"` |
| `data-trail-length`    | `trailLength`   | Integer.                                                |
| `data-speed`           | —               | Applied via `setSpeed()` after creation.                |
| `data-auto-start`      | `autoStart`     | Set to `"false"` to start paused. Omit to auto-play.    |
| `data-pause-on-hidden` | `pauseOnHidden` | Set to `"false"` to keep running when tab is hidden.    |
| `data-initial-phase`   | `initialPhase`  | Number. `"0"` is valid and seeks to phase 0.            |

Canvas and SVG ribbon renderers only:

| Attribute          | Mirrors option |
| ------------------ | -------------- |
| `data-head-color`  | `headColor`    |
| `data-head-radius` | `headRadius`   |
| `data-trail-width` | `trailWidth`   |

Dot matrix renderer only:

| Attribute        | Mirrors option | Notes                                                                                                                            |
| ---------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `data-renderer`  | —              | `"dot-matrix"` selects this renderer. `"canvas"` is accepted but redundant. Any other value logs an error and skips the element. |
| `data-cols`      | `cols`         |                                                                                                                                  |
| `data-rows`      | `rows`         |                                                                                                                                  |
| `data-roundness` | `roundness`    |                                                                                                                                  |

## CDN usage

ES module:

```html
<script type="module">
  import { createSarmal, lissajous32 } from "https://cdn.jsdelivr.net/npm/@sarmal/core/+esm";
  const sarmal = createSarmal(document.querySelector("canvas"), lissajous32);
</script>
```

Auto-init script (no JS needed):

```html
<script src="https://cdn.jsdelivr.net/npm/@sarmal/core/dist/auto-init.js"></script>
<canvas data-sarmal="rose5" width="200" height="200"></canvas>
```

## Common mistakes

- **Named colors or `hsl()` in `trailColor`** — not supported; accepted formats are `#rrggbb`, `#rgb`, `rgb()`, `rgba()`, and `oklch()`. Named colors (`'red'`) and `hsl()` throw.
- **SVG `headRadius` with pixel values** — SVG space is 0–100 viewBox units; a canvas value of `4` renders as a large dot in SVG. Use `0.5`–`2` for SVG.
- **Dot matrix `setRenderOptions` with canvas-only fields** — `headColor`, `headRadius`, and `trailWidth` throw on dot matrix instances; use `DotMatrixRuntimeRenderOptions` fields only.
- **Dot matrix canvas sizing** — set `width` and `height` HTML attributes, not just CSS. The renderer reads `canvas.width` / `canvas.height` directly; CSS-only sizing produces a mismatched grid.
- **Forgetting `destroy()`** — always clean up in React `useEffect` return, Vue `onUnmounted`, etc.
- **Changing `trailLength` after construction** — not possible; `trailLength` is fixed at creation; create a new instance.
- **Gradient colors without a gradient `trailStyle`** — `string[]` for `trailColor` has no visual effect unless `trailStyle` is `'gradient-static'` or `'gradient-animated'`.
- **Reading trail size from `trail.length`** — when using `createEngine` directly, use `engine.trailCount`; the buffer is pre-allocated and always full-length.
- **`data-initial-phase="0"` ignored** — auto-init uses a `!== undefined` check for this attribute specifically, so `"0"` correctly seeks to phase 0. All other numeric attributes use truthy checks and would ignore `"0"`.
