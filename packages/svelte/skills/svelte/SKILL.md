---
name: svelte
description: Svelte 5 wrapper for @sarmal/core. Use when adding animated loading
  indicators with @sarmal/svelte — covers the Sarmal and SarmalSVG components, sarmal
  and sarmalSVG actions, useSarmal and useSarmalSVG runes, init vs runtime options,
  and instance access via bind:instance.
license: MIT
---

# @sarmal/svelte

Svelte 5 wrapper for `@sarmal/core`. Provides `<Sarmal>` and `<SarmalSVG>` components, `sarmal` and `sarmalSVG` Svelte actions, and `useSarmal` / `useSarmalSVG` runes.

Read `@sarmal/core` SKILL.md first for coordinate spaces, curve names, and shared option semantics.

## Installation

```bash
npm install @sarmal/core @sarmal/svelte
```

**Requires Svelte 5.** Not compatible with Svelte 4.

## Entry points

```ts
// Components
import { Sarmal, SarmalSVG } from "@sarmal/svelte";
// or direct .svelte imports
import Sarmal from "@sarmal/svelte/Sarmal.svelte";
import SarmalSVG from "@sarmal/svelte/SarmalSVG.svelte";

// Actions (idiomatic Svelte)
import { sarmal, sarmalSVG } from "@sarmal/svelte";

// Runes (for programmatic control)
import { useSarmal, useSarmalSVG } from "@sarmal/svelte";
```

## `<Sarmal>` component

```svelte
<script>
  import { Sarmal } from "@sarmal/svelte";
  import { curves } from "@sarmal/core";
</script>

<Sarmal curve={curves.artemis2} />
```

Note: the prop is `class`, not `className` (Svelte convention):

```svelte
<Sarmal curve={curves.rose5} class="spinner" trailColor="#a78bfa" />
```

## `<SarmalSVG>` component

```svelte
<SarmalSVG curve={curves.lissajous32} style="width:200px;height:200px;" />
```

SVG scales with CSS. No `width`/`height` props. Uses 0–100 viewBox units internally.

## Svelte actions — `use:sarmal`

The most idiomatic approach when you already own the canvas/svg element:

```svelte
<script>
  import { sarmal, sarmalSVG } from "@sarmal/svelte";
  import { curves } from "@sarmal/core";

  let curve = $state(curves.rose3);
</script>

<canvas width={200} height={200} use:sarmal={{ curve, trailColor: "#a78bfa" }} />
<svg style="width:200px;height:200px;" use:sarmalSVG={{ curve }} />
```

Actions respond to option changes reactively:

- Init options (`trailLength`, `headRadius`, `autoStart`, `initialPhase`) → destroy + recreate
- `curve` change → `morphTo` (trail is preserved)
- Visual options (`trailColor`, `skeletonColor`, `headColor`, `trailStyle`) → `setRenderOptions` (live, no recreate)

## Init vs runtime options — most important gotcha

Same split as the React wrapper:

| Category    | Options                                                                     | Effect when changed                       |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| **Runtime** | `trailColor`, `skeletonColor`, `headColor`, `trailStyle`                    | Updated live — trail preserved            |
| **Init**    | `trailLength`, `headRadius`, `autoStart`, `initialPhase`, `width`, `height` | Destroys and recreates — **trail resets** |

## Imperative access via `bind:instance`

Bind to the component's `instance` prop to get the live `SarmalInstance`:

```svelte
<script>
  import { Sarmal } from "@sarmal/svelte";
  import { curves } from "@sarmal/core";

  let instance = $state(null);
</script>

<Sarmal curve={curves.astroid} bind:instance />

<button onclick={() => instance?.setSpeed(2)}>Speed up</button>
```

`onready` (lowercase) fires once when the instance is first created:

```svelte
<Sarmal curve={curves.rose3} onready={(inst) => inst.seek(Math.PI)} />
```

## Runes — `useSarmal`

Use when you need a ref-based approach or more control than the action provides:

```svelte
<script>
  import { useSarmal } from "@sarmal/svelte";
  import { curves } from "@sarmal/core";

  const { canvasRef, instance } = useSarmal(() => curves.rose5);
</script>

<canvas bind:this={canvasRef} />
```

`useSarmalSVG` mirrors this for SVG, using `svgRef` instead of `canvasRef`.

## Curve changes → automatic `morphTo`

Changing `curve` (in components or actions) triggers `morphTo` automatically. Set `morphDuration` (milliseconds) to control the transition:

```svelte
<Sarmal curve={activeCurve} morphDuration={500} />
```

## Common mistakes

- **Svelte 4 syntax** — this package requires Svelte 5; `$effect`, `$state`, `$props()` runes are used internally
- **`className` instead of `class`** — Svelte components use `class`, not `className`
- **SVG `headRadius` with pixel values** — SVG space is 0–100 viewBox units, not CSS pixels
- **Changing init options reactively** — each change destroys and recreates the instance; the trail resets visibly
