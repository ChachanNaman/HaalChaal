# Dashboard visual polish & motion pass

## Context

The `dashboard/` app (Next.js 16 App Router + Tailwind v4 + Recharts) is functionally complete per `HANDOFF.md`: parent list, parent detail page with a mood/coherence trend chart, and an expandable call-history list with transcripts. Visually it's plain dark Tailwind — flat `#0a0a0a` background, thin `white/10` borders, instant show/hide interactions, no motion. `HANDOFF.md` calls this out as "intentionally minimal... a great place to add real design value."

This spec covers a redesign-in-place of the existing four dashboard files using the newly installed `emilkowalski/skill` design/animation skills (`emil-design-eng`, `apple-design`, `animate`) with an Apple-style depth-and-materials direction.

## Goals

- Apply a real design token system (layered dark surfaces, one accent hue, disciplined type scale) in place of ad hoc Tailwind utility classes.
- Add purposeful motion: spring-based expand/collapse on call rows, staggered list entrance, a "materialize" transition for the urgent-call banner.
- Keep every existing page/component boundary and all data-fetching logic unchanged — this is a presentation-layer pass only.

## Non-goals (explicitly out of scope for this pass)

- Chat-bubble transcript rendering (raw `<pre>` transcript stays as-is).
- Trend chart feature changes: no urgent-call marker/annotation, no 2-week/all-time toggle — restyle only (colors/grid/tooltip to match new tokens).
- Mobile responsiveness audit/fixes.
- Auth / password gate.

These are all called out in `HANDOFF.md`'s frontend punch list but were deliberately deferred to separate future passes.

## Design language

- **Surface scale** (dark, layered instead of flat): page `#0a0a0a` → card `#141414` → elevated/hover `#1c1c1c`, expressed as CSS custom properties in `globals.css` rather than hardcoded per-component hex values.
- **Materials**: cards use a translucent background (`rgba` + `backdrop-filter: blur()`) per `apple-design`'s materials guidance — structure without opacity flattening the depth. Never stack two translucent surfaces directly on each other (e.g. an expanded call row's inner content area stays a solid/near-solid surface, not another blur layer).
- **Accent**: single warm amber accent (replacing the current default blue) for links, focus rings, and the trend chart's primary (mood) line. Status colors (red = urgent, amber = warn, green = good, gray = neutral) stay as they are today — this is additive, not a semantic remap.
- **Typography**: tighten letter-spacing on display-size text (the `HaalChaal` h1, parent name headings) with negative tracking; keep body/badge text near `0` tracking; numeric badges (`Mood 4/5`, `Clarity 3/5`) move to tabular numerals for alignment.

## Motion strategy

Hybrid, per both installed skills' own guidance (`apple-design`: springs for gesture/interruptible things; `pick-ui-library`: plain CSS transitions for simple hover/fade, `motion` for springs/layout/enter-exit):

- **CSS transitions** for hover/press/focus feedback — buttons, links, card hover, badge appearance. Respond on pointer-down (scale ~0.98, ~100ms), not on release.
- **`motion` (Framer Motion)** — new dependency, added to `dashboard/package.json` — for:
  - Call-row expand/collapse: animate height/opacity via a critically-damped spring (`damping 1.0`) instead of the current instant conditional render; chevron/indicator rotates in sync.
  - Parent-list entrance: short staggered fade+rise per card (~30ms offset) on initial load.
  - Urgent-call banner: "materialize" transition (blur + scale in, not a plain opacity fade) per `apple-design` §12.
- Global `prefers-reduced-motion` handling: `motion` respects it automatically; the hand-written CSS transition parts get an explicit `@media (prefers-reduced-motion: reduce)` fallback that drops scale/transform to a plain opacity change.

## Component-by-component plan

| File | Change |
|---|---|
| `src/app/globals.css` | Define the surface/accent/radius/shadow token scale as CSS variables; add reduced-motion media query fallback. |
| `src/app/layout.tsx` | No structural change; may pick up a root-level token class if needed for the material background. |
| `src/app/page.tsx` | Parent cards get materialized surfaces + press feedback; staggered entrance animation; empty state restyled (copy/logic unchanged). |
| `src/app/parent/[id]/page.tsx` | Urgent banner gets the materialize-in treatment; section headers get the tightened-tracking type treatment; no data/logic changes. |
| `src/components/CallList.tsx` | Expand/collapse becomes a `motion` spring animation instead of instant conditional render; badge spacing/weight refined; color semantics unchanged. |
| `src/components/TrendChart.tsx` | Restyle grid/tooltip/line colors to new tokens (accent line for mood); no new chart features. |
| `dashboard/package.json` | Add `motion` as a dependency. |

## Testing

No new business logic is introduced (pure presentation-layer + one new UI-only dependency), so this is verified by running the dev server and visually checking each page/interaction (list entrance, card hover/press, call-row expand/collapse, urgent banner, reduced-motion fallback) rather than by unit tests. Existing `npm run lint` / `npm run build` must still pass.
