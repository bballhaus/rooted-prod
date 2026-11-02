# 0014: The top app bar is a wine surface

- **Status:** decided
- **Date:** 2026-11-02
- **Decided by:** Renn (PM)
- **Review date:** 2026-11-28, with the canvas and theme sign-off (0012, 0013)
- **Features:** F-17, F-19; app shell

## Question

Make the top navigation bar the brand's wine (dark red) instead of the cream ground, and make its right-hand cluster (new decision, inbox, profile) read as intentionally anchored rather than floating in empty space.

## Context

On the cream ground the header blended into the page, and because the search box is width-capped, the right-hand actions sat far off to the side with a wide void before them, reading as "floating." A solid wine bar gives the whole header one surface the actions clearly sit on. The design language already treats wine as a branded surface (§3.3) and already specifies that the primary button "inverts to cream fill, dark text" on wine/charcoal surfaces (§6.1), so the controls have a defined treatment on it.

## Options

### Chosen: a wine app bar, cream contents, three balanced zones

- `--header-bg` is wine in both themes (built from the core `--wine`), with cream ink (`--header-fg`) and a cream-translucent search field. The primary button inverts to cream-on-wine; the inbox/profile icons and the demo/setup pills go cream; the profile avatar and the due-count badge become cream-on-wine so they stay legible (red-on-wine would vanish — the same badge keeps its alert red on the canvas).
- The header is three flex zones — wordmark left, search centred, actions right — so the right cluster is anchored by layout, not pushed out by a margin.

### Pruned: keep the cream header, just close the gap

Reducing the void (e.g. widening or centring the search) would help the "floating" read, but the user asked specifically for the wine bar, and the cream header never separated from the cream page.

### Pruned: tint the bar wine only in light, keep charcoal in dark

Two different bars to maintain and reason about; wine is a both-theme brand surface already (§3.3), so one wine bar is simpler and more on-brand.

## Consequences

- Extends §3.3's branded wine surfaces to the app bar, and adds a new use of wine beyond "the chosen path." Wine still marks the chosen option everywhere in content; the bar is chrome, not content, so the "wine = decided" signal inside the map/records is unaffected. `design-language.md` §3.3 is updated to list the app bar as a wine surface.
- New `--header-*` tokens centralise the on-wine treatment; components reference them, no raw hex.
- The wine bar sits above the clean white workspace (0012) in light and the dark workspace in dark; both are intentional, high-contrast transitions.

## Outcome

Fill this in on the review date: did the wine bar strengthen the brand without diluting "wine = the decision" in the content, and did the anchored right cluster read as intentional?
