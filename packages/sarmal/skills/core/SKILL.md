---
name: core
description: Parametric curve loading indicators for the web. Use when adding animated
  spinners or loading indicators with @sarmal/core — covers createSarmal (canvas),
  createSarmalSVG, built-in curves, lifecycle, and animation controls.
license: MIT
---

# @sarmal/core

sarmal renders parametric math curves as animated loading/thinking indicators. It is not a CSS spinner — it is a canvas or SVG renderer that animates a moving "head" dot leaving a fading trail along a curve path.

## Type definitions (read these first)

The package ships TypeScript definitions that are the authoritative, always-current API reference. Read them before writing any code:

- `node_modules/@sarmal/core/dist/index.d.ts` — `SarmalInstance`, `SarmalOptions`, `createSarmal`, `createSarmalSVG`, `RuntimeRenderOptions`, `TrailStyle`, `TrailColor`, and all other types
- `node_modules/@sarmal/core/dist/curves/index.d.ts` — `CurveName` union type listing every available built-in curve name; individual curve exports

Do not rely on training data for option names, defaults, or curve names — read the `.d.ts` files.

## Installation

```bash
npm install @sarmal/core
```

## Entry points

```ts
import { createSarmal, createSarmalSVG, curves } from "@sarmal/core";
```

**`createSarmal(canvas, curveDef, options?): SarmalInstance`** — canvas renderer  
**`createSarmalSVG(svg, curveDef, options?): SarmalInstance`** — SVG renderer

Both accept the same options and return the same `SarmalInstance` interface.

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

The two renderers use **different coordinate spaces** for all size values:

| Renderer                | Space               | `headRadius` default |
| ----------------------- | ------------------- | -------------------- |
| `createSarmal` (canvas) | CSS pixels          | `4`                  |
| `createSarmalSVG` (SVG) | 0–100 viewBox units | `0.5`                |

When configuring `headRadius` or any size option for the SVG renderer, use viewBox units (e.g. `1`–`3`), not pixel values. Passing a canvas-appropriate value like `4` to the SVG renderer produces a massive dot.

The same applies to `setRenderOptions` calls on SVG instances.

## Lifecycle

```ts
const sarmal = createSarmal(canvas, curveDef, { autoStart: false });

sarmal.play(); // start the animation loop
sarmal.pause(); // pause — preserves animation state
sarmal.destroy(); // REQUIRED: stops the loop and frees resources
```

**Always call `destroy()`** when removing the element or unmounting a component. Omitting it leaks a `requestAnimationFrame` loop.

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

A subset of options can be changed on a live instance via `setRenderOptions`. For the exact list, read `RuntimeRenderOptions` in `dist/index.d.ts`. Validation is strict — if any field fails, the entire call is rejected.

```ts
sarmal.setRenderOptions({
  trailColor: ["#ff0000", "#0000ff"],
  trailStyle: "gradient-animated",
  skeletonColor: "transparent", // hides the skeleton
  headColor: null, // null = derive from trail automatically
});
```

## Auto-init (no JS required)

```ts
import "@sarmal/core/auto";
```

```html
<canvas data-sarmal="lissajous32" width="200" height="200"></canvas>
<svg data-sarmal="rose5" width="200" height="200"></svg>
```

Data attributes mirror the option names in kebab-case: `data-trail-color`, `data-trail-length`, `data-trail-style`, `data-skeleton-color`, `data-head-color`, `data-head-radius`.

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

- **`trailColor` with named colors or `rgb()`** — only 6-digit hex strings are supported; `'red'` and `'#f00'` are not valid
- **SVG `headRadius` with pixel values** — SVG space is 0–100 viewBox units; a canvas value of `4` renders as a large dot in SVG
- **Forgetting `destroy()`** — always clean up in React `useEffect` return, Vue `onUnmounted`, etc.
- **Changing `trailLength` after construction** — not possible; `trailLength` is fixed at creation; create a new instance
- **Gradient colors without a gradient `trailStyle`** — `string[]` for `trailColor` has no visual effect unless `trailStyle` is `'gradient-static'` or `'gradient-animated'`
- **Reading trail length from `trail.length`** — when using the engine directly, use `engine.trailCount`; the buffer is pre-allocated and always full-length
