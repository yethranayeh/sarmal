# @sarmal/core

<p align="center">
  <strong>Parametric curve animations for loading/thinking indicators</strong>
</p>

<p align="center">
  <a href="https://sarmal.art" target="_blank">Live Demo at sarmal.art</a>
</p>

---

**@sarmal/core** is a lightweight library for rendering elegant parametric curve animations.

The animations can be used anywhere you want. Use it for loading spinners, progress indicators, or to indicate that your very special AI model is _thinking_, up to you.

In web applications and perhaps also in the terminal maybe if possible!

- **Canvas & SVG renderers**: choose one or the other, but why not both?
- **standard curves**: default cliche curves any LLM can generate in seconds, from classic spirals to custom parametric paths
- **TIME CONTROL**: programmatic time stepping, seeking, and trail effects
- **Zero dependencies**: tiny bundle, quick to get started
- **TypeScript-first**: because who would build anyhing complex in pure JS?!
  - full type safety, but no assurance it will work in runtime!

## Install

```bash
npm install @sarmal/core
```

Or use directly from CDN:

```html
<script type="module">
  import { createSarmal, rose3 } from "https://cdn.jsdelivr.net/npm/@sarmal/core/+esm";
  // your code here
</script>
```

## Quick Start

```javascript
import { createSarmal, rose3 } from "@sarmal/core";

const canvas = document.getElementById("my-canvas");
const sarmal = createSarmal(canvas, rose3, {
  trailLength: 30,
  strokeStyle: "#00ffaa",
  lineWidth: 2,
});

sarmal.start();
```

Or with **auto-init** without having to write any JS:

```html
<script src="https://cdn.jsdelivr.net/npm/@sarmal/core/dist/auto-init.js"></script>
<canvas data-sarmal="rose3" width="200" height="200"></canvas>
```

## Standard Curves

| Name           | Description                                |
| -------------- | ------------------------------------------ |
| `artemis2`     | Artemis II free-return lunar trajectory    |
| `epitrochoid7` | 7-lobed epitrochoid with dynamic variation |
| `astroid`      | 4-cusped astroid                           |
| `deltoid`      | 3-cusped deltoid                           |
| `rose5`        | 5-petal rose curve                         |
| `rose3`        | 3-petal rose curve                         |
| `lissajous32`  | Lissajous 3:2 with live skeleton           |
| `lissajous43`  | Lissajous 4:3 with live skeleton           |
| `epicycloid3`  | 3-cusped epicycloid                        |
| `lame`         | Lamé curve with live skeleton              |

## Documentation

Full API reference, examples, SVG renderer usage, engine time control (`seek`, `seekWithTrail`), custom curve definitions, and framework guides are available at [sarmal.art/docs](https://sarmal.art/docs)

## Inspiration

Inspired by [@bbssppllvv's tweet](https://x.com/bbssppllvv/status/2038718410318659763)

## License

MIT © [Alper Halil](https://aktasalper.com)

## Links

- [Homepage](https://sarmal.art): See all curves in action
- [npm](https://www.npmjs.com/package/@sarmal/core): Package registry
