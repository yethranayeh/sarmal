---
name: react
description: React wrapper for @sarmal/core. Use when adding animated loading indicators
  with @sarmal/react — covers the Sarmal, SarmalSVG, and SarmalDotMatrix components,
  their hooks, init vs runtime props, curve morphing, and instance access.
license: MIT
---

# @sarmal/react

React wrapper for `@sarmal/core`. Provides three components and matching lower-level hooks:

| Component           | Hook                 | Renderer                  |
| ------------------- | -------------------- | ------------------------- |
| `<Sarmal>`          | `useSarmal`          | Canvas — continuous trail |
| `<SarmalSVG>`       | `useSarmalSVG`       | SVG — scales with CSS     |
| `<SarmalDotMatrix>` | `useSarmalDotMatrix` | Canvas — dot/pixel grid   |

Read `@sarmal/core` SKILL.md first for coordinate spaces, curve names, and shared option semantics.

## Installation

```bash
npm install @sarmal/core @sarmal/react
```

## Entry points

```ts
import {
  Sarmal,
  SarmalSVG,
  SarmalDotMatrix,
  useSarmal,
  useSarmalSVG,
  useSarmalDotMatrix,
} from "@sarmal/react";
```

## `"use client"` — required in RSC environments

All exports in this package are client-only. Add `"use client"` at the top of any file that imports from `@sarmal/react` when using Next.js App Router, Remix with RSC, or any other RSC-capable framework.

```tsx
"use client";
import { Sarmal } from "@sarmal/react";
```

## `<Sarmal>` component

```tsx
import { Sarmal } from "@sarmal/react";
import { curves } from "@sarmal/core";

<Sarmal curve={curves.artemis2} />;
```

The component renders a `<canvas>` element. Canvas dimensions are auto-detected from the parent container if `width`/`height` are not provided — **the parent must have an explicit height** (`height: auto` reads as 0 and triggers a 300×300 fallback with a console warning).

```tsx
<Sarmal
  curve={curves.rose5}
  width={400}
  height={400}
  trailColor="#a78bfa"
  trailStyle="gradient-animated"
  onReady={(instance) => console.log("ready", instance)}
/>
```

## `<SarmalSVG>` component

```tsx
import { SarmalSVG } from "@sarmal/react";

<SarmalSVG curve={curves.lissajous32} style={{ width: "200px", height: "200px" }} />;
```

SVG scales with CSS — no `width`/`height` props. Uses 0–100 viewBox units internally.

## `<SarmalDotMatrix>` component

Renders the curve trail as a grid of dots on a canvas. Each dot is a rounded rectangle; `roundness` controls the corner radius from `0` (square) to `1` (circle).

```tsx
import { SarmalDotMatrix } from "@sarmal/react";
import { curves } from "@sarmal/core";

<SarmalDotMatrix curve={curves.rose5} cols={40} rows={40} roundness={1} />;
```

Like `<Sarmal>`, canvas dimensions fall back to parent `clientWidth`/`clientHeight` if `width`/`height` are omitted — the parent needs an explicit height.

```tsx
<SarmalDotMatrix
  curve={curves.artemis2}
  cols={32}
  rows={32}
  roundness={0.5}
  trailColor="#a78bfa"
  trailStyle="gradient-animated"
  onReady={(instance) => console.log("ready", instance)}
/>
```

**Props not available on `<SarmalDotMatrix>`:** `headColor`, `headRadius`, `trailWidth`. Those belong to the continuous-trail canvas renderer only.

## Init props vs runtime props — most important gotcha

Props are split into two categories. This applies to all three components.

### `<Sarmal>` and `<SarmalSVG>`

| Category    | Props                                                                                        | Effect when changed                                      |
| ----------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Runtime** | `trailColor`, `skeletonColor`, `headColor`, `trailStyle`, `trailWidth`                       | Updated live via `setRenderOptions` — trail is preserved |
| **Init**    | `trailLength`, `headRadius`, `autoStart`, `initialPhase`, `pauseOnHidden`, `width`, `height` | Destroys and recreates the instance — **trail resets**   |

### `<SarmalDotMatrix>`

| Category    | Props                                                                                                       | Effect when changed                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Runtime** | `trailColor`, `skeletonColor`, `trailStyle`                                                                 | Updated live via `setRenderOptions` — trail is preserved |
| **Init**    | `cols`, `rows`, `roundness`, `trailLength`, `autoStart`, `initialPhase`, `pauseOnHidden`, `width`, `height` | Destroys and recreates the instance — **trail resets**   |

Avoid passing init props as unstable values (inline objects, computed values that change every render). Use `useMemo` or stable references if needed.

## Curve changes → automatic `morphTo`

Changing the `curve` prop on any component triggers `morphTo` automatically — the trail and skeleton crossfade. Control the transition with two props:

- `morphDuration` — duration in milliseconds (default 300ms)
- `morphStrategy` — `"normalized"` (default) or `"raw"`. `"normalized"` maps the current phase proportionally into the new curve's period; use it when curves have different periods. `"raw"` passes the raw phase value through — can produce a jump for mismatched periods.

```tsx
<Sarmal curve={activeCurve} morphDuration={500} morphStrategy="normalized" />
```

## Imperative access via `useSarmal`

Use the hook directly when you need to call `instance.seek()`, `instance.setSpeed()`, or other imperative methods:

```tsx
"use client";
import { useRef } from "react";
import { useSarmal } from "@sarmal/react";
import { curves } from "@sarmal/core";

function Loader() {
  const { canvasRef, instance } = useSarmal(curves.rose3);

  const handleClick = () => instance.current?.setSpeed(2);

  return <canvas ref={canvasRef} onClick={handleClick} />;
}
```

`useSarmalSVG` mirrors this for SVG, returning `svgRef` instead of `canvasRef`.

`useSarmalDotMatrix` mirrors this for the dot matrix, returning `canvasRef`:

```tsx
"use client";
import { useSarmalDotMatrix } from "@sarmal/react";
import { curves } from "@sarmal/core";

function DotLoader() {
  const { canvasRef, instance } = useSarmalDotMatrix(curves.rose3);

  const handleClick = () => instance.current?.setSpeed(2);

  return <canvas ref={canvasRef} onClick={handleClick} />;
}
```

## Common mistakes

- **Missing `"use client"`** — all components and hooks use `useEffect`/`useLayoutEffect`; they will error in RSC
- **Parent container with no explicit height** — canvas auto-sizing reads `clientHeight`; a flex/grid parent with `height: auto` reports 0
- **Changing init props frequently** — each change destroys and recreates the instance; the trail resets visibly
- **SVG `headRadius` with pixel values** — SVG space is 0–100 viewBox units, not CSS pixels
- **Using `headColor`, `headRadius`, or `trailWidth` on `<SarmalDotMatrix>`** — these props only exist on the continuous-trail canvas renderer; they are not available on the dot matrix
