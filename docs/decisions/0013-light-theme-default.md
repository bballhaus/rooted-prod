# 0013: Light is the default theme, not the OS setting

- **Status:** decided
- **Date:** 2026-11-02
- **Decided by:** Renn (PM)
- **Review date:** 2026-11-28, with 0010's canvas sign-off and the next prototype user tests
- **Features:** F-17, F-19; refines the theme behaviour from 0010

## Question

Decision 0010 set the theme to start "from the system setting" on first run, with a manual light/dark toggle. The ask in review was to make **light the default** — the prototype should open light regardless of the viewer's OS preference, so first impressions and screenshots are consistent, and the default workspace reads as the clean white surface from 0012.

## Context

0010 kept `prefers-color-scheme` as the first-run default (and pruned "auto-follow the OS theme only" because a manual toggle was also wanted). In practice, a reviewer on a dark-mode OS opened straight into dark, which hid the white-canvas work from 0012 and made the default look inconsistent across machines. The manual toggle (and its persistence in `localStorage`) is unchanged; only the first-run default moves.

## Options

### Chosen: light by default, remember the user's choice

`storedTheme()` returns `'light'` when nothing is stored; once the user toggles, that choice persists (`rooted-theme`) and both toggles stay in sync. `prefers-color-scheme` is no longer read for the initial value, so `systemTheme()` is removed.

### Pruned: keep starting from the OS setting (0010)

Consistent with 0010, but gave an inconsistent first impression across machines and could open into dark over the new white canvas before the user chose anything.

## Consequences

- Supersedes the "starting from the system setting" / "set from a stored preference or the system setting" default in 0010; the manual toggle, its persistence, and the rest of 0010 stand.
- `design-language.md` §3.2 ("Theme in the app") and the comment atop `src/styles/global.css` are updated to say light is the default.
- Someone on a dark-mode OS now has one extra click to reach dark on first run; the choice is then remembered.

## Outcome

Fill this in on the review date (with 0010 and 0012): did a consistent light default help first impressions in user tests, or did people expect the app to follow their OS?
