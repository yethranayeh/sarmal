# Design System: Editorial Warmth

## Inspiration

Visual reference: **Shiseido magazine design from 1929–1938** (Taishō/early Shōwa era). The key principles:

1. **Three tones** — not a binary cream-to-black jump. Warm mid-gray lets the crimson pop as a true accent.
2. **One dominant element per section** — the spinner IS that dominant element. Everything else is subordinate and floats lightly.
3. **Scattered organic composition** — multiple small elements floating on cream ground, connected by thin lines. Think botanical diagram, not data table.
4. **The curved line as layout element** — consider SVG curves as decorative elements between sections.

---

## Colors: Warm Editorial Palette

### Core Palette

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

### Supporting Colors

| Token | Hex | Role |
|-------|-----|------|
| `border` | `#e4e2de` | Subtle borders, dividers |
| `border-subtle` | `#f0eeea` | Barely-there separation |
| `muted` | `#888888` | Secondary text |
| `muted-foreground` | `#5b4041` | Warm gray for body secondary text |
| `error` | `#ba1a1a` | Error states |

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

## What to Avoid

- **No Material Design token naming** (`primary_container`, `on_primary_container`) — feels too systematic
- **No zero radius everywhere** — small radii feel more refined
- **No heavy borders** — keep them subtle
- **No decoration for decoration's sake** — the parametric curves are the decoration

---

## Feel, Not Rules

This is not a rigid system. The goal is **warmth and elegance** — the feeling of opening a well-designed book or magazine. Keep it restrained, keep it refined, let the content breathe.
