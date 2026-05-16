# @sarmal/svelte

<p align="center">
  <strong>Svelte wrapper for @sarmal/core</strong>
</p>

---

**@sarmal/svelte** gives you `<Sarmal>` and `<SarmalSVG>` components, `useSarmal` and `useSarmalSVG` hooks, and `sarmal` / `sarmalSVG` actions so you can drop curve animations into Svelte 5 apps without the canvas wiring.

## Install

```bash
npm install @sarmal/svelte @sarmal/core
```

## Quick Start

```svelte
<script>
  import { Sarmal } from "@sarmal/svelte";
  import { rose3 } from "@sarmal/core";
</script>

<Sarmal curve={rose3} width={200} height={200} />
```

That's it. The canvas is created, the animation starts, and everything is cleaned up when the component unmounts.

### Canvas sizing

The canvas buffer dimensions must match the display size, otherwise the sarmal will be distorted. Pass `width` and `height` props directly, or wrap the component in a container with explicit dimensions:

```svelte
<Sarmal curve={rose5} width={200} height={200} />

<div style="width: 200px; height: 200px;">
  <Sarmal curve={rose5} />
</div>
```

**Important:** The parent container must have an explicit height. `height: auto` will result in `clientHeight = 0` and a 300x300 fallback canvas with a console warning. `width` and `height` are set during initialization, so changing them after mount destroys and recreates the instance (trail resets).

## Changing the curve

Pass a different `curve` prop and the component will morph to it smoothly. Control the duration with `morphDuration` (ms):

```svelte
<script>
  let curve = $state(rose3);
</script>

<Sarmal curve={curve} morphDuration={600} width={200} height={200} />
```

## Styling

```svelte
<Sarmal
  curve={rose5}
  trailColor="#00ffaa"
  skeletonColor="transparent"
  headColor="#ffffff"
  trailStyle="gradient-animated"
  width={200}
  height={200}
/>
```

`trailColor` accepts a single hex string or an array for gradients:

```svelte
trailColor={["#ff0080", "#7928ca", "#0070f3"]}
```

## Props

See [sarmal.art/docs/frameworks](https://sarmal.art/docs/frameworks/#props-1) for the full props reference.

## SVG output

The `<SarmalSVG>` component and `useSarmalSVG` hook render to SVG instead of canvas. The API mirrors `<Sarmal>` and `useSarmal`, with these differences:

- SVG elements scale naturally with CSS, so no `width`/`height` sizing props needed. A `viewBox="0 0 100 100"` is set automatically.
- `class` and `style` apply to the `<svg>` element.
- `trailLength` and `headRadius` are still available as initialization props.

### `<SarmalSVG>` component

```svelte
<script>
  import { SarmalSVG } from "@sarmal/svelte";
  import { rose3 } from "@sarmal/core";
</script>

<SarmalSVG curve={rose3} style="width: 200px; height: 200px;" />
```

### `useSarmalSVG` hook

```svelte
<script>
  import { useSarmalSVG } from "@sarmal/svelte";
  import { rose5 } from "@sarmal/core";

  let svgEl = $state(null);
  let sarmal = useSarmalSVG(() => svgEl, () => rose5);
</script>

<svg bind:this={svgEl} />

<button onclick={() => sarmal.instance?.pause()}>Pause</button>
<button onclick={() => sarmal.instance?.play()}>Play</button>
```

The hook returns:

- `instance`: a getter for the live `SarmalInstance`

## `useSarmal` hook

If you need direct access to the `SarmalInstance` (to call `play`, `pause`, `seek`, etc.), use the hook:

```svelte
<script>
  import { useSarmal } from "@sarmal/svelte";
  import { rose5 } from "@sarmal/core";

  let canvasEl = $state(null);
  let sarmal = useSarmal(() => canvasEl, () => rose5);
</script>

<canvas bind:this={canvasEl} width={200} height={200} />

<button onclick={() => sarmal.instance?.pause()}>Pause</button>
<button onclick={() => sarmal.instance?.play()}>Play</button>
```

The hook returns:

- `instance`: a getter for the live `SarmalInstance`

## Svelte actions

For a more declarative approach, use the `sarmal` and `sarmalSVG` actions:

```svelte
<script>
  import { sarmal } from "@sarmal/svelte";
  import { rose3 } from "@sarmal/core";
</script>

<canvas use:sarmal={{ curve: rose3, trailColor: "#00ffaa" }} width={200} height={200} />

<svg use:sarmalSVG={{ curve: rose3 }} style="width: 200px; height: 200px;" />
```

Actions respond to option changes reactively and clean up on destroy.

## Documentation

Full API reference and examples are at [sarmal.art/docs](https://sarmal.art/docs)

## License

MIT © [Alper Halil](https://aktasalper.com)

## Links

- [Homepage](https://sarmal.art): See everything Sarmal has to offer
- [Core package](https://www.npmjs.com/package/@sarmal/core): The engine behind this one
- [npm](https://www.npmjs.com/package/@sarmal/svelte): Package registry
