# Rooted — Design Language

**Copied from** the landing-page repo (`rrsudev/CS177-geckos`, `DESIGN_LANGUAGE.md`) on 2026-10-28. File references below (`src/engine.js`, `src/App.jsx`, `index.html`, `src/styles.css`) point to that repo, not this one. Until this repo has its own token file, the landing repo's code is the source of truth; when it does, update the references here.

> **Product:** Rooted — decision tracing for product teams.
> **Audience:** designers on other teams, and agents generating or extending Rooted surfaces.
> **Scope:** the visual identity, tokens, components, and principles that make everything Rooted ship look like one product.

Rooted helps product teams map every option, prune the weak ones, and trace every
decision back to its root — the evidence, the people, and the day it was made. The
whole brand is built on that one metaphor: **a living tree with visible roots.**
Options grow as branches, weak ones are pruned (not deleted — pruned, with a
reason), and the chosen path is traceable down to the soil. Every design decision
should reinforce *clarity, evidence, and traceability* — never decoration for its
own sake.

This document is the source of truth. The runnable source of truth for color is
`src/engine.js` (`PAL`) and `src/App.jsx` (`tokens()`); for type and layout it is
`index.html` and `src/styles.css`. If this file and the code ever disagree, the
code wins — then fix this file.

---

## 1. Brand personality

| We are | We are not |
|---|---|
| Considered, earned, grown-over-time | Loud, trendy, hype-driven |
| Warm and human (wine, cream, sage — not SaaS blue) | Cold, corporate, generic |
| Precise and evidence-led (numbers, scores, factors) | Vague, vibes-based |
| Calm and spacious | Dense, cluttered, busy |
| Organic (roots, branches, buds, soil) | Mechanical, geometric-for-its-own-sake |

**Tone in one line:** the quiet confidence of a decision you can defend.

---

## 2. Logo & brand mark

The mark is a **sprout**: a single stem rising from a point, splitting into two
branches that each end in a filled bud. It reads as growth *and* as a branching
decision tree — the core metaphor in one glyph.

- **Construction:** `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
  `stroke-width="1.7"`, round caps and joins. The two buds are filled circles
  (`r≈1.7`) in `currentColor`. See `BrandMark` in `src/App.jsx:18`.
- **Color:** inherits `currentColor` so it adapts to any surface. The favicon
  pins it to **wine `#581C32`** on transparent (see `index.html`).
- **Lockup:** mark + wordmark "Rooted", gap `10px`, wordmark at `font-weight:600`,
  `letter-spacing:-0.02em`. Header wordmark ~`21px`; footer ~`17px`; mark sizes
  `24px` / `20px` respectively.
- **Don'ts:** don't recolor the mark outside the core palette, don't add a drop
  shadow or gradient, don't stretch it, don't separate a bud from its stem, don't
  place wine-on-wine (use cream).

When you need a secondary motif, draw from the same vocabulary: **root tendrils**
(thin tapering strokes that fork downward, used in the "how it works" soil
section), **buds** (small filled dots), and the **trace line** (a single hairline
connecting a node back to its root).

---

## 3. Color

### 3.1 Core palette (the five)

These five colors are the entire foundation. Everything else is a mix, tint, or
opacity of these. Defined once in `src/engine.js` as `PAL`.

| Name | Hex | RGB | Role |
|---|---|---|---|
| **Wine** | `#581C32` | `88, 28, 50` | Primary brand color. The "chosen path" / recommendation. Signature deep surfaces. |
| **Berry** | `#8E4056` | `142, 64, 86` | Secondary / accent. Buds, live pulses, pruned-item markers, dusty-rose details. |
| **Cream** | `#F7F4EF` | `247, 244, 239` | Primary light surface and light-on-dark ink. The "paper" of the brand. |
| **Charcoal** | `#25272B` | `37, 39, 43` | Primary ink. Neutral dark surface (hero, footer, end CTA on light theme). |
| **Sage** | `#A4AD96` | `164, 173, 150` | The "alive / healthy" signal — living branches, kept options, the map status dot. |

Mental model: **Cream = paper, Charcoal = ink, Wine = the decision, Berry = the
living accent, Sage = still growing / healthy.**

### 3.2 Semantic tokens

Never hard-code a core color in a component. Reference a **semantic token**, so
light/dark themes and future retints stay centralized. Tokens are defined in
`tokens(dark)` at `src/App.jsx:254`. The names below are the contract; reuse them.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `ground` | `#F7F4EF` cream | `#25272B` charcoal | Default page/surface background |
| `ink` | `#25272B` | `#F7F4EF` | Primary text |
| `ink2` | `#5B5D61` | `#C5C8BC` | Secondary / supporting text |
| `line` | `rgba(37,39,43,.4)` | `rgba(247,244,239,.42)` | Hairline dividers, inactive borders |
| `btnBg` / `btnFg` | wine / cream | cream / charcoal | Primary button |
| `btn2Border` | `rgba(37,39,43,.4)` | `rgba(247,244,239,.45)` | Secondary (outline) button border |
| `tagBg` / `tagFg` / `tagBorder` | cream / charcoal / subtle | charcoal-raised / cream / subtle | Branch labels on the canvas |
| `recBg` / `recFg` | **wine / cream** | berry / cream | The recommendation — always wine-family |
| `aliveDot` | `#A4AD96` sage | `#A4AD96` sage | A kept / living option |
| `prunedFg` / `prDot` | `#8E4056` berry | `#C39AA3` dusty rose | A pruned option (with strike-through) |
| `pathBorder` / `pathDot` | wine | `#C39AA3` | The traced path back to root |
| `cardBg` | `#FCFBF8` | `#2E3034` | Elevated card surface (slightly off-`ground`) |
| `cardBorder` / `cardRule` | `rgba(37,39,43,.12)` / `.08` | `rgba(247,244,239,.12)` / `.08` | Card edge / internal rules |
| `soil` | `#581C32` wine | `#581C32` wine | The "how it works" section — wine in **both** themes |
| `endBg` | `#25272B` | `#581C32` | Final CTA / signup section |
| `chipBg` | `rgba(37,39,43,.06)` | `rgba(247,244,239,.1)` | Neutral chip / banner fill |

Status/log accents (used in the live status line and canvas narration):
`logMap`=sage, `logWeigh`=ink2, `logPrune`=berry/dusty-rose, `logRec`=wine/cream.
Semantic rule: **sage = mapping/alive, berry = pruning, wine = decided.**

### 3.3 Surface hierarchy

Three branded surfaces carry meaning — use them deliberately, not interchangeably:

1. **Cream / Charcoal (`ground`)** — neutral canvas. Most content lives here.
2. **Wine (`soil`)** — the "roots" surface. Reserved for explaining *how Rooted
   works* (depth, foundation, what's underneath a decision). Wine in both themes.
3. **Charcoal / Wine (`endBg`)** — the commitment surface. The final "start with
   one decision" CTA. Darker, quieter, decisive.

Elevation is expressed with a near-invisible lift, not heavy shadow:
`cardShadow` light = `0 1px 2px rgba(37,39,43,.05), 0 30px 60px -30px rgba(88,28,50,.28)`
(note the wine-tinted ambient shadow — shadows carry brand color, they are never
neutral gray). `cardBg` is deliberately offset from `ground` (`#FCFBF8` vs
`#F7F4EF`) so cards read as paper-on-paper.

### 3.4 Organic / canvas palette

The 3D tree derives its colors by **mixing** core palette members (see
`makeColors()` in `src/engine.js`). If you render any organic/illustrative asset,
mix from the same five rather than introducing new hues:

- **Bark** = `mix(charcoal, wine, .4)` (light) / `mix(berry, charcoal, .3)` (dark)
- **Leaves** = three sage/charcoal/cream mixes for depth
- **Bud** = berry; **bud highlight** = `mix(berry, cream, .55)`
- **Recommendation node** = wine with a cream ring
- **Roots (soil section)** = `mix(mix(cream, sage, .22), wine, .12)` on wine

### 3.5 Color rules

- **Do** route every color through a semantic token.
- **Do** keep the recommendation in the **wine family** — it is the single most
  important color signal in the product.
- **Do** tint shadows and glows with wine, never pure black/gray.
- **Don't** introduce blues, greens, or grays outside the five + their mixes.
- **Don't** use berry and wine as if interchangeable: wine = *decided*, berry =
  *alive accent / being pruned*.
- **Contrast:** ink on ground and cream on wine/charcoal all clear WCAG AA for
  body text. Keep `ink2` for supporting text only, never for anything < 13px that
  must be read precisely.

---

## 4. Typography

### 4.1 Typeface

**Bricolage Grotesque** — a single variable font does all the work (loaded in
`index.html`, axes `opsz 12..96`, `wght 300..700`). It is a contemporary grotesque
with warmth and slightly idiosyncratic detailing: expressive at display sizes,
neutral and legible at text sizes. This duality *is* the brand's type voice.

```text
font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', Helvetica, Arial, sans-serif;
-webkit-font-smoothing: antialiased;
```

The fallback stack keeps layout stable if the web font fails. There is **no
separate heading/body font** — one family, differentiated by size, weight, and
tracking.

### 4.2 Weights (restrained — only three)

| Weight | Use |
|---|---|
| **500 (Medium)** | Large display headings. Big type is set *light*, not bold — elegance over shout. |
| **600 (Semibold)** | Subheads (`h3`), buttons, pills, the wordmark, emphasized labels. |
| **400–500** | Body text and UI labels. |

Never use 700+ for display — Rooted headlines get their presence from size and
tight tracking, not heavy weight.

### 4.3 Type scale (fluid)

All display sizes use `clamp(min, vw, max)` so type scales with the viewport.
Representative stops (see `src/styles.css`, `src/App.jsx`):

| Role | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| Hero headline | `clamp(42px, 5.6vw, 96px)` | 500 | `-0.04em` | `0.92` |
| End CTA headline | `clamp(44px, 6.6vw, 112px)` | 500 | `-0.045em` | `0.94` |
| Section heading (`rl-sec-h`) | `clamp(36px, 4.4vw, 64px)` | 500 | `-0.035em` | `0.98` |
| Soil heading | `clamp(36px, 4.6vw, 72px)` | 500 | `-0.035em` | `0.95` |
| Feature `h3` | `clamp(24px, 2.5vw, 38px)` | 600 | `-0.025em` | `1.05` |
| Card question | `clamp(17px, 1.5vw, 20px)` | 600 | `-0.015em` | `1.25` |
| Lead paragraph | `clamp(16px, 1.25vw, 18px)` | 400 | — | `1.45` |
| Body | `15–17px` | 400 | — | `1.5–1.55` |
| Meta / caption | `12–14px` | 400–600 | — | `1.4` |
| Kicker / eyebrow | `12px` | 600 | **`+0.06em`, UPPERCASE** | — |

### 4.4 Typographic rules

- **Negative tracking scales with size.** The bigger the type, the tighter:
  from `-0.015em` on card titles to `-0.045em` on the largest headline. Small
  text and body get `0`. The one positive-tracked, uppercased element is the
  **kicker/eyebrow** (`+0.06em`).
- **Tight leading on display** (`0.92–0.98`) — headlines are compact blocks.
  **Open leading on body** (`1.45–1.55`).
- **Measure:** cap line length. Headings use `max-width` in `em` (`8.5em`–`11em`);
  body uses `max-width: 27em–40em` or `~30ch`. Never let a paragraph run the full
  width of a wide container.
- **Numbers:** use `font-variant-numeric: tabular-nums` for scores and any value
  that updates in place, so digits don't jitter (`rl-row-s`, tag scores).
- **Mixed-alignment headlines:** the hero splits one sentence into a left-aligned
  clause and a right-aligned clause (`rl-head-a` / `rl-head-b`) — a signature
  move. Use sparingly, only for the primary headline of a surface.

---

## 5. Layout & spacing

### 5.1 Structure

- **Max content width:** `1240px`, centered (`margin: 0 auto`).
- **Section horizontal padding:** `clamp(20px, 4vw, 56px)` — the universal gutter.
- **Section vertical rhythm:** generous, fluid — e.g. `clamp(90px, 9vw, 140px)`
  top/bottom for standard sections, more for the soil/CTA sections. Whitespace is
  a feature; let sections breathe.
- **Grids:** CSS Grid for structure. The hero is a 2-col grid with named areas
  (`stage / head / copy / panel`); feature lists and pricing are symmetrical
  multi-column grids. Columns collapse to a single column at the breakpoint.

### 5.2 The one breakpoint

Rooted designs **mobile-adaptive at a single breakpoint: `880px`.** Below it,
multi-column grids become single-column, the trace rail moves to the left edge,
and alignment flips to left. Design desktop-first, then verify the `≤880px`
collapse. Don't invent extra breakpoints without reason — fluid `clamp()` handles
the in-between.

### 5.3 Fluid everything

Spacing, type, and section padding are almost all `clamp()`-based so the page
scales smoothly rather than stepping between fixed layouts. When adding a new
section, reach for `clamp(min, vw, max)` on its padding and major type before
reaching for media queries.

### 5.4 Corner radius scale

Radius encodes component type — keep it consistent:

| Radius | Used for |
|---|---|
| `999px` (full pill) | Buttons, inputs, selects, scenario toggles, billing toggle, chips-as-pills, status pills |
| `16px` | Cards, pricing plans |
| `12px` | Banners, notices |
| `8px` | Evidence chips, small tags |
| `4px` | Canvas branch/root labels (tight, dense) |

**Rule of thumb:** interactive controls are fully rounded pills; content
containers are `16px`; the denser/smaller the element, the smaller the radius.

### 5.5 Touch targets

Interactive controls are never smaller than **44px** tall (buttons, toggles,
icon buttons are `44×44`); primary CTAs and form inputs are **48px**. Honor this
for every new control.

---

## 6. Components

All components below exist in `src/App.jsx` / `src/styles.css`. Reuse them; derive
new components from their patterns.

### 6.1 Buttons

- **Primary** (`btnBg`/`btnFg`): solid pill, `font-weight:600`, `min-height:44–48px`,
  `padding:0 18–24px`, `border-radius:999px`. On light: wine fill, cream text. On
  the wine/charcoal CTA surfaces it inverts to cream fill, dark text.
- **Secondary** (outline): transparent fill, `1px solid btn2Border`, `ink` text,
  `font-weight:500`.
- **Hover:** `transform: translateY(-1px)` with `transition: transform .15s ease`
  (the `.rl-btn` class). A subtle lift — never a color flash or scale pop.
- **Icon buttons:** `44×44` circle, `1px` border, transparent fill, centered line
  icon.

### 6.2 Pills & chips

- **Status pill** (`rl-pill`): full-rounded, `font-size:12px`, `font-weight:600`,
  `min-height:28px`. State-colored — the "Recommendation ready" pill uses
  `recBg`/`recFg` (wine), others use neutral `chipBg`.
- **Evidence chip** (`rl-chip`): `8px` radius, `1px` border, a small line icon +
  label, `min-height:30px`. Used to show the documents behind a decision.
- **Selection toggle** (scenario picker, billing): pill with `aria-pressed`; the
  active one fills with `chipOnBg`/`chipOnFg`, inactive is transparent with a
  `line` border.

### 6.3 Cards

- Surface `cardBg`, `1px solid cardBorder`, `border-radius:16px`, `overflow:hidden`,
  wine-tinted `cardShadow`.
- Internal structure is **stacked sections divided by hairlines** (`cardRule`),
  not boxes-within-boxes: head → recommended → pruned → evidence → footer.
- Each row (`rl-row`) is a 3-col grid: `[8px status dot] [label + reason stack]
  [tabular score]`. The status dot encodes state (filled sage = alive, ringed
  berry = pruned, filled wine = recommended).
- The "popular" pricing plan inverts to a **wine card** (`recBg`) to mark the
  recommended choice — same wine-means-chosen logic as the tree.

### 6.4 Inputs

- `min-height:48px`, `border-radius:999px` (pill inputs), `font:inherit`,
  `padding:0 18px`. Subtle translucent fill (`inputBg`) with a `1px` border
  (`inputBorder`).
- **Focus:** `outline: 2px solid currentColor; outline-offset: 2px`. Error state
  swaps the border to full-contrast `ink` and shows a `role="alert"` message.
- Placeholders use `color: inherit; opacity: .55`.

### 6.5 Canvas tags (branch labels)

Small `4px`-radius labels anchored to tree nodes. A row of: status dot + label +
tabular score, with an optional second line ("Recommended"). State drives color
via the `tag*`/`rec*`/`pruned*` tokens. Pruned labels get `text-decoration:
line-through` and become non-interactive. This is the densest component in the
system — hence the tight `4px` radius and `clamp(11px,.86vw,13px)` type.

### 6.6 Status / live indicator

A dot + head + sub line that narrates what the tree is doing ("Mapping options",
"Pruning", "Recommendation ready"). The dot's fill/ring is color-coded by phase
(`kinds` map in `renderVals`). Uses `aria-live="polite"` so changes are announced.
Reuse this pattern anywhere Rooted narrates live state.

---

## 7. Iconography

- **Style:** thin-stroke line icons, `stroke="currentColor"`, `stroke-width` ~`1.3–1.8`,
  round caps and joins, `fill="none"` (except intentional filled dots/buds).
- **Grid:** small, tight viewBoxes (`12`, `13`, `14`, `24`). Icons sit inline with
  text and inherit color via `currentColor`.
- **Vocabulary:** check (plan features), document (evidence), link (copy link),
  play/pause/regrow (demo controls), target ring (root node), sprout (brand).
- **Rule:** draw new icons in the same hairline, rounded, single-color style.
  Never use filled/duotone icon sets or multi-color icons. Match stroke weight to
  the surrounding text weight.

---

## 8. Motion & interaction

- **Micro-interactions are small and fast:** `transition: transform .15s ease`,
  hover lift of `translateY(-1px)` on buttons and tags. Nothing bounces or
  overshoots in the UI chrome.
- **The hero tree is the expressive exception:** it grows, sways, prunes, and
  traces using eased animation (`easeOut`, `easeInOut`, `easeBack` in
  `engine.js`). Motion there is purposeful — it *demonstrates* the product, it
  isn't ornament.
- **Scroll:** `scroll-behavior: smooth`; anchored sections have
  `scroll-margin-top`. The soil section grows roots as you scroll.
- **Direction of meaning:** things *grow up* (branches, decisions forming) and
  *root down* (evidence, foundations). Respect that axis in any new motion.
- **Reduced motion is a first-class path, not an afterthought:**
  `@media (prefers-reduced-motion: reduce)` disables transitions and smooth
  scroll, and the engine is initialized in a reduced, non-autoplaying mode
  (`FALL_T` shortens, roots start grown). Every animation you add must have a
  reduced-motion fallback.

---

## 9. Accessibility (non-negotiable)

Accessibility is part of the design language, not a compliance checkbox:

- **Visible focus everywhere:** `outline: 2px solid currentColor` with offset on
  every link, button, input, and the canvas tags.
- **Semantic landmarks & labels:** real `<header>`, `<nav aria-label>`, `<section
  aria-labelledby>`, `<footer>`; the canvas has a descriptive `aria-label`; the
  live status line uses `aria-live="polite"`; errors use `role="alert"`.
- **Color is never the only signal:** pruned items also get strike-through and a
  different dot shape; the recommendation also carries a "Recommended" label and a
  pill.
- **Touch targets** ≥ 44px (see §5.5).
- **Keyboard:** everything interactive (including pruning a branch) is a real
  focusable control, not a click handler on a div.
- **Contrast:** verify any new foreground/background pair hits WCAG AA. The token
  pairs already do; new combinations must be checked.

---

## 10. Voice & tone

Design and copy are one system. Rooted's writing is **plain, concrete, and
evidence-led** — it mirrors the visual calm.

- **Short, declarative headlines.** "Every call leaves a record." "Start with one
  decision." "Under every decision."
- **Specific over vague.** Not "powerful insights" but "Lift week-4 retention from
  31% to 36%", "18 customer interviews, 212 feature requests". Numbers earn trust.
- **Honest and low-pressure.** "free and non-committal: no payment, no contract,
  no obligation." Confidence, not hype.
- **The product's own vocabulary:** *map, weigh, prune, trace, root, record,
  evidence, fit score.* Reuse these words; they tie copy to the metaphor.
- **Sentence case** for everything except the uppercase kicker. No Title Case
  Headlines, no ALL CAPS shouting.

---

## 11. Designing new Rooted products consistently

A checklist for any new surface, feature, or sibling product. If you can tick
these, it will look and feel like Rooted.

### Foundations

1. **Pull color from tokens, not hex.** Add to `tokens()` in `App.jsx` if you need
   a new role; never scatter raw hex. Keep new colors as mixes of the five.
2. **One typeface, three weights.** Bricolage Grotesque; 500 for display, 600 for
   subheads/controls, 400 for body. Big type is light, not bold.
3. **Negative tracking that scales with size; tight leading on display, open on
   body.** Cap line length with `em`/`ch` max-widths.
4. **`1240px` max width, `clamp(20px,4vw,56px)` gutters, fluid `clamp()` spacing,
   one `880px` breakpoint.**
5. **Radius by role:** pills for controls, `16px` for cards, `8px`/`4px` for dense
   chips/tags.

### Meaning

6. **Wine = the decision/chosen path.** Keep it the strongest, rarest color signal.
   Sage = alive/mapping, Berry = accent/pruning, Cream/Charcoal = paper/ink.
7. **Use the three branded surfaces for their meaning:** neutral ground for most
   content, **wine** for "how it works / what's underneath", dark for the final
   commitment/CTA.
8. **Lead with evidence and numbers.** Show the factors behind a score; make
   values tabular; let people trace a claim to its source.
9. **Reuse the product vocabulary** (map / weigh / prune / trace / root / record)
   in both UI and copy.

### Craft

10. **Hairline dividers and wine-tinted shadows**, not heavy borders or gray boxes.
    Earn elevation subtly.
11. **Motion is small and fast in chrome** (`.15s`, `-1px` lift); expressive only
    where it demonstrates the product — and always with a reduced-motion fallback.
12. **Accessibility is built in from the first commit:** visible focus, semantic
    markup, labels, ≥44px targets, AA contrast, color-plus-shape for every state.
13. **Whitespace is a feature.** When in doubt, add space and remove ornament.
    Calm and considered beats dense and loud.

### Quick token reference (copy-paste starting point)

```text
Core:    wine #581C32 · berry #8E4056 · cream #F7F4EF · charcoal #25272B · sage #A4AD96
Light:   ground #F7F4EF · ink #25272B · ink2 #5B5D61 · card #FCFBF8 · rec #581C32
Dark:    ground #25272B · ink #F7F4EF · ink2 #C5C8BC · card #2E3034 · rec #8E4056
Type:    Bricolage Grotesque · 500/600/400 · tracking −0.015 → −0.045em on display
Radius:  999px controls · 16px cards · 8px chips · 4px dense tags
Grid:    max 1240px · gutter clamp(20px,4vw,56px) · breakpoint 880px
Motion:  transform .15s ease · translateY(-1px) hover · honor prefers-reduced-motion
```

---

*Living document. Source of truth for color is `src/engine.js` (`PAL`) and
`src/App.jsx` (`tokens()`); for type/layout, `index.html` and `src/styles.css`.
When code and this file diverge, update this file to match the code.*
