# 0012: A clean white workspace surface for the home canvas

- **Status:** decided
- **Date:** 2026-11-02
- **Decided by:** Renn (PM)
- **Review date:** 2026-11-28, with 0010's canvas sign-off and the next prototype user tests
- **Features:** F-17, F-19; refines the map surface from 0010

## Question

Decision 0010 gave the map a separate neutral canvas (`--canvas-bg`, a cool off-white `#f5f6f8` in light) and explicitly deferred that one colour to the team: "The canvas needs sign-off. Its neutral background (`--canvas-bg`) is the one color outside the five core colors." This record takes that sign-off. The ask in review was to stop the home map reading as AI-generated: drop the superfluous subheads, and make the canvas and the surface behind it one clean colour rather than two competing off-whites (the warm cream ground, the slightly off-white card, and the cool-grey canvas sat side by side).

## Context

0010 had already found that "the warm cream read as 'off-white'" and moved the canvas to a crisp neutral — but the result was three near-identical light tints on one screen (cream `#f7f4ef` ground, `#fcfbf8` cards, `#f5f6f8` canvas), which is itself a tell of machine-generated UI. The map is the product's primary surface (0006, 0010) and the design direction is Figma/Obsidian: a big, calm canvas with light chrome floating on it.

## Options

### Chosen: one clean white workspace surface, cream kept everywhere else

- `--canvas-bg` is the home workspace surface — `#ffffff` in light, a crisp `#1b1d21` in dark — and it backs the whole workspace: the map canvas, the "Needs you" rail, the workspace bar and the filter strip. So the canvas and the background behind it are, by construction, the same colour.
- Every other page keeps the brand cream ground and charcoal. The app frame (header, footer) stays cream, so the workspace reads as a distinct surface you work on, the way Figma's canvas differs from its chrome.
- Elevated cards (map nodes, the detail panel, popovers) keep `--card-bg`, so they still lift off the white with a border and a soft shadow — one paper tone, not three.

### Pruned: keep a separate cool-grey canvas (0010's deferred `#f5f6f8`)

It left the canvas a third off-white next to cream and the card tone — the exact "looks AI-made" effect review wanted gone, and it made the canvas and the surface behind it two different colours.

### Pruned: make the cream ground white app-wide

Cleanest whites, but it discards the brand's cream "paper" on every page — a far larger identity change than the map needed, and out of scope for a map-surface refinement.

## Consequences

- Supersedes the "canvas needs sign-off" line and the "crisp neutral, not cream" canvas choice in 0010; the rest of 0010 stands.
- The home workspace now has two light values (white surface, `--card-bg` paper for elevated cards) instead of three, which also satisfies the design language's "colour through semantic tokens" rule — the surface is still one token (`--canvas-bg`).
- `design-language.md` §3.2's `canvasBg` row is updated to match. The token is still the one neutral outside the five core colours; it is now signed off rather than provisional.

## Outcome

Fill this in on the review date (with 0010): did the clean white workspace read as calmer and less machine-made in user tests, and did keeping cream everywhere else still feel like one product?
