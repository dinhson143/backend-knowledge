# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static Vietnamese study site for System Design / Backend (Hello Interview framework), deployed via GitHub Pages at https://dinhson143.github.io/backend-knowledge/. Plain HTML/CSS/vanilla JS — no build, no package.json, no dependencies.

- Run: open `index.html` in a browser.
- Check all content: `node scripts/check.mjs` (exits 1 and prints `file:path → lỗi`). It loads the same scripts `index.html` loads.

All content and UI text is Vietnamese; keep full diacritics.

**Start here:** `docs/content-system.md` is how content should be organized: one file per topic under `content/topics/<track>/`, explanations next to the text they explain instead of joined by array index, and `scripts/check.mjs` as the gate. It also holds the migration plan (step by step, one commit each) and the working rules (decision log `docs/decisions.md`, handoff files, small commits). New topics and tracks follow it. Until the migration is done, the layout below is what runs, and any edit must keep the index joins aligned.

Rules that hold now and after the migration:
- Ids are a contract (URL `#/t/<id>` and progress `ip.done`): add new ids, never rename old ones.
- Run `node scripts/check.mjs` after every content edit. A new kind of bug found in review → add a check for it.
- Facts come from official docs; put the URL in the content. No prices.

## Architecture (current layout, before the migration)

`index.html` loads classic scripts in a fixed order; each data file assigns a global on `window`, and `app.js` (loaded last) reads them all:

| Global | File | Role |
|---|---|---|
| `GLOSSARY` | `glossary.js` | Abbreviations `[abbr, full, vi, example?]`; `app.js` auto-wraps every occurrence (outside backticks) in a tooltip `<abbr>` |
| `TRACKS`, `ROADMAP`, `MIRO_GAPS` | `data.js` | Topic content (tracks → sections → topics) and learning order (stages listing topic ids) |
| `SIMS` + `window.mountSim` | `diagrams.js` | SVG simulation engine and scenarios |
| `PROBLEMS`, `HI_GAPS` | `problems.js` | System Design problems; each has an inline `hld` sim |
| `WHY`, `PWHY` | `why.js` | "Vì sao" explanations for topics / problems |
| `SIM_DETAIL` | `sim-detail.js` | Per-sim context and per-step "chuyện gì xảy ra" text |

`app.js` is one IIFE: builds indexes (`byId`, `ORDER`, `simById`), a hash router (`#/t/<topicId>`, `#/p/<problemId>`, `#/sim/<simId>`, `#/sims`, `#/problems`, `#/glossary`, `#/search/<q>`), and renders views as template strings into `#main`. Progress and theme persist in `localStorage` (`ip.done`, `ip.theme`).

### Cross-file linkage (the main thing to get right)

- **Ids are the glue.** Topic `id` in `data.js` is referenced by `ROADMAP.topics`, `SIMS[].topics`, `PROBLEMS[].topics`, `WHY[<topicId>]`. Sim `id` is referenced by topic `related`, problem `sims`, and `SIM_DETAIL[<simId>]`. Problem `id` keys `PWHY`. Topics not listed in `ROADMAP` fall into an auto-generated "Khác" stage.
- **Explanations join by array index, not text.** `WHY` entries use `i` (points), `row` (table rows), `s` (sections); `PWHY` uses `i`; `SIM_DETAIL` uses `v` (variant index) and `i` (step index). The `key` field is only a human-readable prefix of the source string. Inserting, deleting or reordering a point/row/step/variant in `data.js`, `problems.js` or `diagrams.js` silently misaligns every later explanation — update the indexes in `why.js` / `sim-detail.js` in the same change.

### Content conventions

- Inline markup in content strings: `**bold**` and `` `code` `` only (rendered by `inline()` in `app.js`).
- `points` prefixes: `"+ "` = added content (badge "Bổ sung"), `"! "` = correction (badge "Đính chính"); plain = from the original Miro board.
- Problem deep dives use bad / good / great answers = junior / mid / senior level.

### Simulations (`diagrams.js`)

Default is a flow sim: `nodes` (`{id, x, y, label, s?}`) plus `steps` (or `variants: [{name, steps, nodes?}]`). Step fields are documented in the header comment of `diagrams.js` (`note`, `msgs` as `[from, to, label, kind]` with kind `req|ok|err|warn`, `{par:[...]}` for parallel, `set`, `bad`/`good`, `cut`/`uncut`, `lesson`). A `custom` field (`arch`, `code`, `stack`, `decide`, `kgroup`, `rplay`, `bucket`, `ring`, `vending`, `binary`) dispatches to a bespoke renderer in `window.mountSim`.
