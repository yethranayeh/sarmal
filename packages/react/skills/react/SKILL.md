---
name: react
description: React wrapper for @sarmal/core. Use when adding animated loading indicators
  with @sarmal/react — covers the Sarmal and SarmalSVG components, useSarmal and
  useSarmalSVG hooks, init vs runtime props, curve morphing, and instance access.
license: MIT
---

# @sarmal/react

React wrapper for `@sarmal/core`. Provides a `<Sarmal>` component, a `<SarmalSVG>` component, and lower-level `useSarmal` / `useSarmalSVG` hooks.

Read `@sarmal/core` SKILL.md first for coordinate spaces, curve names, and shared option semantics.

## Installation

```bash
npm install @sarmal/core @sarmal/react
```

## Entry points

```ts
import { Sarmal, SarmalSVG, useSarmal, useSarmalSVG } from "@sarmal/react";
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

## Init props vs runtime props — most important gotcha

Props are split into two categories:

| Category    | Props                                                                       | Effect when changed                                      |
| ----------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Runtime** | `trailColor`, `skeletonColor`, `headColor`, `trailStyle`                    | Updated live via `setRenderOptions` — trail is preserved |
| **Init**    | `trailLength`, `headRadius`, `autoStart`, `initialPhase`, `width`, `height` | Destroys and recreates the instance — **trail resets**   |

Avoid passing init props as unstable values (inline objects, computed values that change every render). Use `useMemo` or stable references if needed.

## Curve changes → automatic `morphTo`

Changing the `curve` prop triggers `morphTo` automatically — the trail and skeleton crossfade. The default morph duration is 300ms; override with `morphDuration` (milliseconds):

```tsx
<Sarmal curve={activeCurve} morphDuration={500} />
```

## Imperative access via `useSarmal`

Use the hook directly when you need to call `instance.seek()`, `instance.setSpeed()`, or other imperative methods:

```tsx
"use client";
import { useRef } from "react";
import { useSarmal } from "@sarmal/react";
import { curves } from "@sarmal/core";

function Spinner() {
  const { canvasRef, instance } = useSarmal(curves.rose3);

  const handleClick = () => instance.current?.setSpeed(2);

  return <canvas ref={canvasRef} onClick={handleClick} />;
}
```

`useSarmalSVG` mirrors this for SVG, returning `svgRef` instead of `canvasRef`.

## Common mistakes

- **Missing `"use client"`** — both components and hooks use `useEffect`; they will error in RSC
- **Parent container with no explicit height** — canvas auto-sizing reads `clientHeight`; a flex/grid parent with `height: auto` reports 0
- **Changing init props frequently** — each change destroys and recreates the instance; the trail resets visibly
- **SVG `headRadius` with pixel values** — SVG space is 0–100 viewBox units, not CSS pixels
