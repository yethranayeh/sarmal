# @sarmal/react

<p align="center">
  <strong>React wrapper for @sarmal/core</strong>
</p>

---

**@sarmal/react** gives you a `<Sarmal>` component and a `useSarmal` hook so you can drop parametric curve animations into React apps without the canvas wiring. SVG output is also supported with `<SarmalSVG>` and `useSarmalSVG`.

## Install

```bash
npm install @sarmal/react @sarmal/core
```

## Quick Start

```jsx
import { Sarmal } from "@sarmal/react";
import { rose3 } from "@sarmal/core";

export function Loader() {
  return <Sarmal curve={rose3} width={200} height={200} />;
}
```

That's it. The canvas is created, the animation starts, and everything is cleaned up when the component unmounts.

### Canvas sizing

The canvas buffer dimensions must match the display size, otherwise the sarmal will distorted. Pass `width` and `height` props directly, or wrap the component in a container with explicit dimensions:

```jsx
// Pass dimensions directly
<Sarmal curve={rose5} width={200} height={200} />

// Or provide a sized parent
<div style={{ width: 200, height: 200 }}>
  <Sarmal curve={rose5} />
</div>
```

**Important:** The parent container must have an explicit height. `height: auto` will result in `clientHeight = 0` and a 300x300 fallback canvas with a console warning. `width` and `height` are set during initialization, so changing them after mount destroys and recreates the instance (trail resets).

## Changing the curve

Pass a different `curve` prop and the component will morph to it smoothly. Control the duration with `morphDuration` (ms):

```jsx
const [curve, setCurve] = useState(rose3);

<Sarmal curve={curve} morphDuration={600} width={200} height={200} />;
```

## Styling

```jsx
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

```jsx
trailColor={["#ff0080", "#7928ca", "#0070f3"]}
```

## Props

| Prop            | Type                                                    | Default     | Description                                                  |
| --------------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| `curve`         | `CurveDef`                                              | required    | The curve to render. Morph-on-change.                        |
| `className`     | `string`                                                | -           | Applied to the `<canvas>` element                            |
| `style`         | `CSSProperties`                                         | -           | Applied to the `<canvas>` element                            |
| `width`         | `number`                                                | -           | Canvas width in CSS pixels. **Init-only.**                   |
| `height`        | `number`                                                | -           | Canvas height in CSS pixels. **Init-only.**                  |
| `autoStart`     | `boolean`                                               | `true`      | Start animation on mount. **Init-only.**                     |
| `initialT`      | `number`                                                | -           | Seek to this position before the first frame. **Init-only.** |
| `trailLength`   | `number`                                                | `120`       | Number of trail points. **Init-only.**                       |
| `trailColor`    | `string \| string[]`                                    | -           | Trail color or gradient stops                                |
| `trailStyle`    | `'default' \| 'gradient-static' \| 'gradient-animated'` | `'default'` | Trail rendering style                                        |
| `skeletonColor` | `string`                                                | -           | Background skeleton color (`'transparent'` to hide)          |
| `headColor`     | `string`                                                | -           | Head dot color (derives from trail if omitted)               |
| `headRadius`    | `number`                                                | `4`         | Head dot size. **Init-only.**                                |
| `morphDuration` | `number`                                                | -           | Duration in ms for curve transitions                         |
| `onReady`       | `(instance: SarmalInstance) => void`                    | -           | Called once the instance is created                          |

## SVG output

The `<SarmalSVG>` component and `useSarmalSVG` hook render to SVG instead of canvas. The API mirrors `<Sarmal>` and `useSarmal`, with these differences:

- SVG elements scale naturally with CSS, so no `width`/`height` sizing props needed. A `viewBox="0 0 100 100"` is set automatically.
- `className` and `style` apply to the `<svg>` element.
- `trailLength` and `headRadius` are still available as init-time props.

### `<SarmalSVG>` component

```jsx
import { SarmalSVG } from "@sarmal/react";
import { rose3 } from "@sarmal/core";

export function Loader() {
  return <SarmalSVG curve={rose3} style={{ width: 200, height: 200 }} />;
}
```

### `useSarmalSVG` hook

```jsx
import { useSarmalSVG } from "@sarmal/react";
import { rose5 } from "@sarmal/core";

function MyComponent() {
  const { svgRef, instance } = useSarmalSVG(rose5);

  return (
    <>
      <svg ref={svgRef} />
      <button onClick={() => instance.current?.pause()}>Pause</button>
      <button onClick={() => instance.current?.play()}>Play</button>
    </>
  );
}
```

The hook returns:

- `svgRef`: attach this to your `<svg>` element
- `instance`: a ref to the live `SarmalInstance`

## `useSarmal` hook

If you need direct access to the `SarmalInstance` (to call `play`, `pause`, `seek`, etc.), use the hook:

```jsx
import { useSarmal } from "@sarmal/react";
import { rose5 } from "@sarmal/core";

function MyComponent() {
  const { canvasRef, instance } = useSarmal(rose5, undefined, { width: 200, height: 200 });

  return (
    <>
      <canvas ref={canvasRef} />
      <button onClick={() => instance.current?.pause()}>Pause</button>
      <button onClick={() => instance.current?.play()}>Play</button>
    </>
  );
}
```

The hook returns:

- `canvasRef`: attach this to your `<canvas>` element
- `instance`: a ref to the live `SarmalInstance`

## Documentation

Full API reference and examples are at [sarmal.art/docs](https://sarmal.art/docs)

## License

MIT © [Alper Halil](https://aktasalper.com)

## Links

- [Homepage](https://sarmal.art): See everything Sarmal has to offer
- [Core package](https://www.npmjs.com/package/@sarmal/core): The engine behind this one
- [npm](https://www.npmjs.com/package/@sarmal/react): Package registry
