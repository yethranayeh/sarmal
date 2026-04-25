# @sarmal/react

<p align="center">
  <strong>React wrapper for @sarmal/core</strong>
</p>

---

**@sarmal/react** gives you a `<Sarmal>` component and a `useSarmal` hook so you can drop parametric curve animations into React apps without the canvas wiring.

## Install

```bash
npm install @sarmal/react @sarmal/core
```

## Quick Start

```jsx
import { Sarmal } from "@sarmal/react";
import { curves } from "@sarmal/core";

export function Loader() {
  return <Sarmal curve={curves.rose3} style={{ width: 200, height: 200 }} />;
}
```

That's it. The canvas is created, the animation starts, and everything is cleaned up when the component unmounts.

## Changing the curve

Pass a different `curve` prop and the component will morph to it smoothly. Control the duration with `morphDuration` (ms):

```jsx
const [curve, setCurve] = useState(curves.rose3);

<Sarmal curve={curve} morphDuration={600} style={{ width: 200, height: 200 }} />;
```

## Styling

```jsx
<Sarmal
  curve={curves.rose5}
  trailColor="#00ffaa"
  skeletonColor="transparent"
  headColor="#ffffff"
  trailStyle="gradient-animated"
  style={{ width: 200, height: 200 }}
/>
```

`trailColor` accepts a single hex string or an array for gradients:

```jsx
trailColor={["#ff0080", "#7928ca", "#0070f3"]}
```

## Props

| Prop            | Type                                                    | Default     | Description                                          |
| --------------- | ------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `curve`         | `CurveDef`                                              | required    | The curve to render. Morph-on-change.                |
| `className`     | `string`                                                | -           | Applied to the `<canvas>` element                    |
| `style`         | `CSSProperties`                                         | -           | Applied to the `<canvas>` element                    |
| `autoStart`     | `boolean`                                               | `true`      | Start animation on mount                             |
| `initialT`      | `number`                                                | -           | Seek to this position before the first frame         |
| `trailLength`   | `number`                                                | `120`       | Number of trail points                               |
| `trailColor`    | `string \| string[]`                                    | -           | Trail color or gradient stops                        |
| `trailStyle`    | `'default' \| 'gradient-static' \| 'gradient-animated'` | `'default'` | Trail rendering style                                |
| `skeletonColor` | `string`                                                | -           | Background skeleton color (`'transparent'` to hide)  |
| `headColor`     | `string`                                                | -           | Head dot color (derives from trail if omitted)       |
| `headRadius`    | `number`                                                | `4`         | Head dot size - init-only, cannot change after mount |
| `morphDuration` | `number`                                                | -           | Duration in ms for curve transitions                 |
| `onReady`       | `(instance: SarmalInstance) => void`                    | -           | Called once the instance is created                  |

## `useSarmal` hook

If you need direct access to the `SarmalInstance` (to call `play`, `pause`, `seek`, etc.), use the hook:

```jsx
import { useSarmal } from "@sarmal/react";
import { curves } from "@sarmal/core";

function MyComponent() {
  const { canvasRef, instance } = useSarmal(curves.artemis2);

  return (
    <>
      <canvas ref={canvasRef} width={200} height={200} />
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
