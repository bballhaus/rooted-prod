# 0006: The map becomes a full-bleed, draggable decision canvas with a theme toggle

- **Status:** decided
- **Date:** 2026-10-31
- **Decided by:** Renn (PM)
- **Review date:** 2026-11-28, with the next prototype user tests
- **Features:** builds on F-17, F-19; interaction model for the map

## Question

The first map (0005) was a fixed left-to-right timeline on the cream background. The ask was to make it the whole page — a Figma/Obsidian-style canvas you can drag, zoom and customise — default to a graph with a timeline as a toggle, fold history into it, and drop the cream and the filler copy.

## Context

The map is the product's main surface. A read-only timeline didn't let people arrange or trace their own thinking, the warm cream read as "off-white", and the explanatory subtitles read as AI filler. Obsidian and Figma set the expectation: a full-bleed canvas, a collapsible chrome, direct manipulation.

## Options

### Chosen: a full-bleed interactive canvas

- **Full-bleed.** The map fills the content column edge to edge; the rail collapses so it can run full-screen. A floating toolbar, a detail panel that toggles, and a zoom cluster float over it.
- **Draggable, zoomable, customisable.** Pan the background, wheel to zoom, drag nodes to arrange them; custom positions persist per view and scope. A small deterministic force layout gives the graph its organic default.
- **Graph by default, timeline as a toggle.** Graph is the free arrangement; timeline is the chronological, builds-on layered view — which is also "history", so the separate history page is no longer in the nav (its route stays for deep links).
- **Scope, colour, trace, rename.** Switch between your own decisions and a mocked org view; colour-code by status, goal or owner (with a legend); trace a decision's full lineage (ancestors and descendants highlight, the rest dims); rename a node inline.
- **Light/dark toggle.** Theme is driven by `data-theme` on `<html>` (set from a stored preference or the system setting), so the in-app toggle works regardless of the OS. Light is a crisp neutral canvas with a dot grid — not the warm cream, which stays a brand surface on wine/charcoal. Dark is an Obsidian-style canvas. Both keep the brand accents (wine = chosen, sage = alive, berry = exploring).
- **Minimal text.** The map carries labels and the selected node's detail — no standing subtitles or legends-as-prose.

### Pruned: keep the timeline as the only layout

A timeline alone can't be arranged or explored freely, which was the point of the request.

### Pruned: auto-follow the OS theme only

A manual toggle was asked for; relying on `prefers-color-scheme` alone wouldn't let someone pick light-on-a-dark-OS or vice versa.

## Consequences

- `Decision` gains an optional `owner` (unset = the current user; the org mock sets a teammate) so the map can colour by owner. Canvas positions and theme live in their own `localStorage` keys, never in the app store.
- The org view is explicitly mock, synthetic, and labelled "sample data"; it does not imply org-wide access (that is later scope).
- The categorical colour ramp (for goal/owner) extends slightly beyond the five core colours into the same earthy family. Status colouring still uses the semantic tokens.
- Colour-coding, org views and cross-team lineage preview a later-release vision; they are demonstrations on planted data, not working capabilities.

## Outcome

Fill this in on the review date: did people arrange and trace decisions on the canvas, and did the graph/timeline split and the theme toggle feel right?
