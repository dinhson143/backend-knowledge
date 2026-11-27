# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static Vietnamese study site for System Design / Backend (Hello Interview framework), deployed via GitHub Pages at https://dinhson143.github.io/backend-knowledge/. Plain HTML/CSS/vanilla JS — no build, no package.json, no dependencies. Works from `file://`.

- Run: open `index.html` in a browser.
- Check all content: `node scripts/check.mjs` (exits 1 and prints `file:path → lỗi`). It loads exactly what the page loads, via `content/manifest.js`.

All content and UI text is Vietnamese; keep full diacritics.

How content is organized and why: `docs/content-system.md`. Decisions: `docs/decisions.md` (D-numbers; later wins). New topic: copy `content/_TEMPLATE.js`.

Rules:
- Ids are a contract (URL `#/t/<id>` and progress `ip.done`): add new ids, never rename old ones.
- Run `node scripts/check.mjs` after every content edit. A new kind of bug found in review → add a check for it.
- Facts come from official docs; put the URL in the content. No prices.
- Small commits, one change each; don't rewrite `app.js` in the same commit as moving content.

## Layout

```text
index.html          one <script>: content/manifest.js
content/manifest.js BK registry (BK.topic/problem/sim/track/section, throws on duplicate id) + FILES load list
content/glossary.js GLOSSARY — abbreviations, auto-wrapped in tooltips by app.js
content/tracks.js   BK.track / BK.section
content/topics/<track>/<id>.js   one topic per file: text + "vì sao" + diagrams
content/problems/<id>.js         one problem per file, incl. its inline `hld` sim
content/sims/<id>.js             simulation scenarios (shared by topics/problems)
content/svg/<name>.svg           static diagrams, referenced by `diagrams: [{ src, caption, source? }]`
content/roadmap.js  ROADMAP (stage → `parts` → topic ids; the only navigation tree), MIRO_GAPS, HI_GAPS
engine/diagrams.js  window.mountSim — simulation engine, no scenarios
app.js              router + render, no content (loaded last by the manifest); inline URLs render as `[n]` + "Nguồn tham khảo" (D92)
fonts/              self-hosted Be Vietnam Pro + JetBrains Mono (OFL), D91
scripts/check.mjs   content gate
```

Adding a file = create it + add one line to `FILES` in `content/manifest.js` (check fails otherwise). Order of sims/problems in `FILES` is their display order (D6); topic order comes from `roadmap.js`.

## Data shape

- A point (`tldr`, `points`, `tips`, problem `nfr`) is a string, or `{ t, why }` when it has a "Vì sao". A table row is an array of cells, or `{ cells, why }`. Topic `story` = `{ problem, idea, tradeoff }`. Problem: `hldWhy`, `deep[k].why = { bad, good, great }`.
- Roadmap: stage `{ id, title, goal, parallel?, problems?, parts }`, part `{ id: "<stage>.<name>", title, optional?, topics }`. Add a part only together with its first topic. Topic `title` ≤ 40 chars, optional `goal` (≤ 90, starts with a verb) and `needs` (≤ 3 topic ids, no cycles). Placement rules and the full planned tree: `docs/proposals/product-learning-flow.md` §3.1, §7.2.
- Inline markup: `**bold**` and `` `code` `` only (rendered by `inline()` in `app.js`).
- `points` prefixes: `"+ "` = added (badge "Bổ sung"), `"! "` = correction (badge "Đính chính"); plain = from the original Miro board.
- Problem deep dives: bad / good / great = junior / mid / senior.

## Simulations

Flow sim: `nodes` (`{id, x, y, label, s?}`) + `steps` (or `variants: [{name, steps, nodes?}]`), optional `context`. Step fields are documented in the header of `engine/diagrams.js` (`note`, `msgs` as `[from, to, label, kind]`, `{par:[...]}`, `set`, `bad`/`good`, `cut`/`uncut`, `lesson`, `detail`). A `custom` field (`arch`, `code`, `stack`, `decide`, `kgroup`, `rplay`, `bucket`, `ring`, `vending`, `binary`) picks a bespoke renderer; which data lives in the sim file vs the engine is D7.

`app.js` is one IIFE: indexes from `window.BK`, a hash router (`#/t/<id>`, `#/p/<id>`, `#/sim/<id>`, `#/sims`, `#/problems`, `#/glossary`, `#/search/<q>`), views rendered as template strings into `#main`. Progress and theme persist in `localStorage` (`ip.done`, `ip.theme`).
