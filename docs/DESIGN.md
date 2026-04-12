# Design System: Editorial Warmth of Ink & Ember

> **Bijin-yokai editorial**: the restraint of Shiseido's three-tone structure, the emotional weight of Visual Kei ink work.
> Crimson as wound, not brand color. Grain as texture, not noise. Negative space as tension, not emptiness.

## Inspiration

**Two layers, one system:**

**Structure**: Shiseido magazine design, 1929–1938 (Taishō/early Shōwa era).
The technical vocabulary:
1. **Three tones only**: not a binary cream-to-black jump. Warm mid-gray lets the crimson pop as a true accent.
2. **One dominant element per section**: the spinner IS that dominant element. Everything else is subordinate and floats lightly.
3. **Scattered organic composition**: multiple small elements floating on cream ground, connected by thin lines. Think botanical diagram, not data table.
4. **The curved line as layout element**: consider SVG curves as decorative elements between sections.

**Spirit**: Bijin-yokai illustration and Visual Kei art.
The emotional vocabulary:
- The crimson is a mark, not a brand color. It appears once per composition.
- Negative space carries weight — it is tension, not emptiness.
- Grain and texture connect the digital surface to ink and paper traditions.
- The curves sarmal draws are brushstrokes. This is not a metaphor — a trail thinning as it lifts is exactly what a brush does.

---

## Colors: Warm Editorial Palette

> **Note:** The light and dark modes are not opposites. They are the same three-tone system (black / white / crimson) in different light.
> Light mode is the Shiseido layer. Dark mode is the bijin-yokai layer.

### Core Palette (Light Mode)

| Token | Hex | Role |
|-------|-----|------|
| `background` | `#fbf9f5` | Page base — warm cream, like quality paper |
| `foreground` | `#1b1c1a` | Primary text — rich dark ink |
| `surface` | `#f5f3ef` | Raised surfaces, cards |
| `surface-raised` | `#ffffff` | Elevated elements |

### Accent Colors

| Token | Hex | Role |
|-------|-----|------|
| `primary` | `#c0143c` | Primary accent — deep editorial red |
| `primary-foreground` | `#ffffff` | Text on primary |
| `accent` | `#97002a` | Deeper red — "Calligrapher's seal" use sparingly |

### Supporting Colors (Light Mode)

| Token | Hex | Role |
|-------|-----|------|
| `border` | `#e4e2de` | Subtle borders, dividers |
| `border-subtle` | `#f0eeea` | Barely-there separation |
| `muted` | `#888888` | Secondary text |
| `muted-foreground` | `#5b4041` | Warm gray for body secondary text |
| `error` | `#ba1a1a` | Error states |

### Dark Mode Palette

Warm blacks with a faint red undertone — like concentrated ink, not a darkened UI. Bone white, never pure white. The crimson glows rather than cuts.

| Token | Hex | Role |
|-------|-----|------|
| `background` | `#0e0808` | Warm black — slight red undertone, like spilled ink |
| `foreground` | `#ede8e0` | Bone white — off-neutral warm, not pure white |
| `surface` | `#1a1010` | Raised surfaces — one step off background |
| `surface-raised` | `#2a1a1a` | Elevated elements |
| `primary` | `#cc001a` | Blood crimson — glows on dark; slightly brighter than light-mode red |
| `accent` | `#8b0010` | Deep ember — shadow/depth effects |
| `border` | `#2a1818` | Barely-there border in dark context |
| `border-subtle` | `#1e1010` | Near-invisible separation |
| `muted` | `#6b5555` | Warm desaturated — secondary text |
| `muted-foreground` | `#a09090` | Slightly lighter warm gray |
| `error` | `#cc001a` | Same as primary in dark mode — red is red |

### Dark Mode Contrast Audit

Contrast ratios against the three dark surfaces (WCAG AA requires 4.5:1 for normal text, 3:1 for large text):

| Text token | `background` | `surface` | `surface-raised` | Usable as text? |
|---|---|---|---|---|
| `foreground` `#ede8e0` | 16.3:1 | 15.3:1 | 13.7:1 | ✓ all surfaces |
| `muted-foreground` `#a09090` | 6.5:1 | 6.1:1 | 5.5:1 | ✓ all surfaces |
| `muted` `#6b5555` | 2.9:1 | 2.7:1 | 2.4:1 | ✗ fails everywhere |
| `primary` `#cc001a` (as text) | 3.4:1 | 3.2:1 | 2.8:1 | ✗ decorative/bg only |
| `accent` `#8b0010` | 2.0:1 | — | — | ✗ depth/shadow only |

**Key findings:**

- `foreground` and `muted-foreground` are the only two tokens that work as readable text. The bone white / warm mid-gray tier is solid.
- `muted` (`#6b5555`) fails as secondary text on every dark surface. It was chosen for warmth, not legibility. When dark mode is implemented, `muted` needs to be lightened to at least `#8a7070` to clear 4.5:1 on `background`, or repurposed as a border/decorative token with `muted-foreground` taking the secondary-text role.
- `primary` red cannot serve as text on dark surfaces (reds are low-luminance by nature). It works as a background — `foreground` text on `primary` clears AA at 4.8:1. Use it decoratively or as a button background, not as colored label text.
- `foreground` on `primary` is 4.8:1 — passes AA but barely. Avoid very small text in this combination.

---

## Typography

### Stack

- **Headings**: `Newsreader` — high-contrast editorial serif, sets the tone
- **Body**: `Manrope` — clean, modern sans-serif, highly readable
- **Mono/Labels**: `Inter` — precision for metadata, timestamps, technical text

### Scale

Headings use generous leading and tight tracking. Body text prioritizes readability. Labels are tracked out (0.05–0.2em) for a catalog/editorial feel.

---

## Component Guidelines

### Borders & Radius

- **Borders**: Use `border` (`#e4e2de`) for component outlines. Subtle, not invisible.
- **Radius**: Small, refined values — `2px` to `8px`. Not zero (that's too stark), not large (that's too casual).

### Cards

- Background: `surface` (`#f5f3ef`)
- Border: `1px solid var(--color-border)`
- Radius: `var(--radius-md)` (4px)
- Shadow: None or very subtle

### Buttons

- **Primary**: `bg-primary text-primary-foreground`, subtle radius
- **Ghost**: No background, text link style with underline on hover

### Inputs

- Bottom-border style: thin `1px` line in `border`, not a full box
- Focus: `border-primary` with subtle color shift

---

## Naming Convention

Follows **Shadcn/radix-vue patterns**:

```
--color-{role}           (background, foreground, primary, border)
--color-{role}-foreground (primary-foreground, muted-foreground)
--color-{role}-{variant} (surface-raised, border-subtle)
--font-{role}           (heading, body, mono)
--radius-{size}          (sm, md, lg)
```

In markup, compose with Tailwind utilities:
```html
<button class="bg-primary text-primary-foreground hover:opacity-90 rounded-md" />
<div class="border border-border rounded-md" />
```

---

## Grain & Texture

Grain is structural, not decorative. It connects the digital surface to the physical tradition of ink, charcoal, and aged print reproduction — and it unifies the three tones into a single material.

### Where to Apply

- Large background panels (headers, section backgrounds, hero areas)
- Borders and separators — grain on a 1px line reads as an ink stroke
- Non-blocking decorative elements (the motifs page is a natural home for this)

### Where Not to Apply

- Interactive elements (buttons, inputs, toggles) — grain muddies affordance signals
- Text — grain must never sit on type

### Implementation Note

A subtle SVG `feTurbulence` filter or a static noise PNG at `opacity: 0.03–0.06` with `blend-mode: multiply` (light) or `blend-mode: overlay` (dark). The effect should be visible up close but not dominant. Test in both modes — grain behaves differently on cream vs. on warm black.

---

## What to Avoid

- **No Material Design token naming** (`primary_container`, `on_primary_container`) — feels too systematic
- **No zero radius everywhere** — small radii feel more refined
- **No heavy borders** — keep them subtle
- **No decoration for decoration's sake** — the parametric curves are the decoration

---

## Feel, Not Rules

This is not a rigid system. The goal is **ink and ember** — the feeling of an illustrated page that has been in a dark room for a long time. Warm, restrained, with one thing that glows. Keep it restrained, keep it refined, let the content breathe. The curves are the decoration.
