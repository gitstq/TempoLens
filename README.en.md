# 🎵 TempoLens

> **Zero-dependency · Offline-first · Local-first** browser metronome & practice studio
> 零依赖、可离线、本地优先的浏览器节拍器与练习工作室

**🌐 Language / 语言 / 語言：** [简体中文](README.md) · [繁體中文](README.zh-TW.md) · **English**

[![CI](https://github.com/gitstq/TempoLens/actions/workflows/ci.yml/badge.svg)](https://github.com/gitstq/TempoLens/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c9eff.svg)](LICENSE)
[![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-43d9a3.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18.17-43d9a3.svg)](package.json)

---

## 🎉 Introduction

**TempoLens** is a metronome and music practice studio that runs entirely in your browser:
open the page and practice — no installation, no network requests, no user tracking.
Every click is synthesized in real time with Web Audio, and every line of code is an
independent, from-scratch implementation.

**Real pain points it solves:**

- 🎸 **Online metronomes need the internet** — a flaky connection breaks your practice.
  TempoLens works forever after the first load;
- 🥁 **Most metronomes are too simple** — just tempo and meter, with no polyrhythm,
  swing, or tempo ladders for serious practice;
- 🔐 **Privacy concerns** — "cloud-synced" practice tools demand accounts and expose
  your practice data to third parties;
- 📦 **Bloated complexity** — multi-megabyte framework dependencies. TempoLens ships
  under 200 KB of source and distributes as a single file.

**Inspiration & differentiation:**
Inspired by the "terminal-native / single-file / local-first" movement trending on GitHub,
TempoLens is built from scratch for daily music practice: a **Web Audio look-ahead
scheduling engine** (clicks planned 120 ms ahead — no `setInterval` jitter) combined with
**polyrhythm mode, smart tap tempo, tempo ladders, practice routines and a streak
heatmap**, all wrapped in a complete trilingual UI.

**Tech stack:** vanilla HTML + CSS + JavaScript (ES5-compatible UMD modules), zero
runtime dependencies. Node.js (≥18.17) is used only for dev-time syntax checks,
unit tests and single-file bundling.

---

## ✨ Key Features

- ⏱️ **Precise beat engine** — Web Audio look-ahead scheduling fires clicks on the
  `AudioContext.currentTime` timeline, immune to frame-rate hiccups; backlogs are
  dropped automatically when a background tab gets throttled;
- 🥁 **Polyrhythm mode** — stack any two voices (2:3, 3:4, 4:5 …); the cycle length is
  derived from the least common multiple automatically;
- 🎚️ **Swing** — 0–100% continuously adjustable; at 100% the off-beat lands exactly on
  the triplet position (2/3 of a beat);
- 🎯 **Smart tap tempo** — median-based outlier rejection with gap reset; four taps are
  enough for a stable estimate;
- 📈 **Tempo ladders** — generate "60 → 120, +5 per step, 4 bars per step" practice
  ramps in one click;
- 📋 **Practice routines** — multi-step sequences that switch tempo/meter/subdivision
  automatically, with JSON import/export and local saving;
- 🔥 **Practice stats** — bars, duration, weighted average tempo, streak days and a
  17-week heatmap, stored only in your own browser;
- 🎨 **Trilingual UI** — full 简体中文 / 繁體中文 / English translations, auto-detected
  from the browser language;
- 🌗 **Dark & light themes** — follow the system or switch manually; respectful of
  `prefers-reduced-motion`;
- 🔗 **Shareable settings** — every setting is encoded into the URL hash; one link
  reproduces your exact setup;
- 📴 **Fully offline** — zero network requests after the first load; runs from `file://`;
- 🧩 **Zero dependencies, zero build** — no `node_modules`, no bundler, no CDN.

---

## 🚀 Quick Start

### Option 1: Just open it (zero install)

Open `src/index.html` in any modern browser — double-click the file or drag it into a
browser window. The `file://` protocol is fully supported.

### Option 2: Local dev server (optional)

```bash
# Requires Node.js >= 18.17 (dev-time only; the app itself has zero dependencies)
node scripts/serve.mjs --port 8080
# Then open http://localhost:8080/
```

### Option 3: Single-file portable build

```bash
node scripts/build.mjs        # produces dist/tempolens.html (~130 KB)
```

`dist/tempolens.html` is a **single-file app** with all styles and scripts inlined —
copy it, email it, put it on a USB stick; double-click to run.

### Dev-time verification (all zero-dependency)

```bash
npm run check     # syntax check: node --check across the whole codebase
npm test          # unit tests: node --test (full core-engine coverage)
npm run build     # single-file bundle
npm run smoke     # smoke test: in-process static server assertions
npm run verify    # runs all of the above
```

---

## 📖 Detailed Usage Guide

### 🎛️ Basic playback

| Action | How |
|---|---|
| Start / stop | Click **▶ Play**, or press <kbd>Space</kbd> |
| Change tempo | Drag the slider, type a number, or <kbd>↑</kbd>/<kbd>↓</kbd> (<kbd>Shift</kbd> for ±10) |
| Tap tempo | Click **👋 Tap tempo** or press <kbd>T</kbd>; tap along 4+ times |
| Quick mute | <kbd>M</kbd> |
| Switch subdivision | <kbd>1</kbd>–<kbd>4</kbd> for quarter/eighth/triplet/sixteenth |

### 🧭 Meter & subdivision

- **Beats per bar**: anything from 1 to 16 (including odd meters like 5 and 7);
- **Subdivisions**: quarter / eighth / triplet / sixteenth, with counting syllables
  (`1` `e` `&` `a`) shown on the visualizer;
- **Accent modes**: accent bar 1 / accent every beat / no accent;
- **Count-in**: play 1–2 counting bars before the take; stats start after the count-in.

### 🥁 Polyrhythm training (signature feature)

1. Check **Enable polyrhythm**;
2. Enter a ratio such as `3:2` (three against two);
3. Set an independent base tempo, or leave it empty to follow the main tempo;
4. The panel shows the cycle length (e.g. `6 beats · 3000 ms`); the two voices use
   different pitches.

> 💡 **Practice tip**: start slow with `2:3`, then move on to `3:4` and `4:5`.

### 📈 Tempo ladders & practice routines

In the **Practice Routine** card:

1. Expand **Build tempo ladder**, fill in from/to/step/bars-per-step, and generate;
2. Or click **Add step** to compose steps manually — each step has its own tempo,
   bar count and subdivision;
3. Click **Play routine**; steps advance automatically and the panel shows `Step 2/6`;
4. **Export routine** (JSON) and **Import routine** make backup and sharing easy.

### 🔥 Practice stats & streaks

- Every session records bars, duration and weighted average tempo;
- The 17-week heatmap reveals your practice patterns; the streak counter keeps you
  coming back daily;
- Data lives in the browser's `localStorage` — **never uploaded, never synced,
  always clearable**.

### 🔗 Settings sharing

Click **Copy share link** to encode every current setting (tempo, meter, subdivision,
swing, sound, polyrhythm …) into the URL hash; opening the link restores the exact
same configuration.

### 🖼️ Interface Preview

| Stage | Stats |
|---|---|
| ![Stage](docs/images/overview.svg) | ![Stats](docs/images/stats.svg) |

> Demo GIFs and additional screenshots are placeholders to be added in a future release.

---

## 💡 Design Notes & Roadmap

### Design philosophy

- **Look-ahead beats timers**: `setInterval` suffers from event-loop delays and tab
  throttling with errors up to tens of milliseconds. TempoLens plans the next 120 ms of
  clicks every frame and hands them to the audio layer for sample-accurate playback;
  the visual layer consumes the same event queue, so what you see is what you hear;
- **Pure core + thin shell**: all beat math (`core/`) is side-effect free and unit
  tested under Node; DOM and audio are thin adapters;
- **Zero dependencies is a feature**: no framework lock-in, auditable source, built to
  last;
- **Privacy first**: no accounts, no backend, no telemetry — your practice data is yours.

### Why these choices

| Choice | Reason |
|---|---|
| Vanilla JS + UMD | Works as browser globals and Node modules; no bundler needed |
| Web Audio synthesis | Zero audio assets; three timbres generated at runtime |
| `localStorage` | Stats and routine persistence with zero backend |
| CSS custom properties | Dark/light themes at zero JS cost |
| `node --test` | Zero-dependency test runner; CI needs no `npm install` |

### Roadmap

- [ ] Additive meters (e.g. 3+3+2) and custom accent patterns
- [ ] Shuffle/random mode for routines
- [ ] Recording comparison (record your take and play it back aligned to the beat)
- [ ] PWA support (Service Worker for full offline caching)
- [ ] More timbres and envelope customization
- [ ] Practice data import/export (JSON backup)

### Where to contribute

See [CONTRIBUTING.md](CONTRIBUTING.md): new translations, more test cases, Roadmap
features and accessibility improvements are all great starting points.

---

## 📦 Build & Deployment Guide

### Local build

```bash
node scripts/build.mjs
# Output: dist/tempolens.html (single file with all styles and scripts inlined)
```

### Deployment

TempoLens is a **pure static app** — any static host works:

| Platform | How |
|---|---|
| GitHub Pages | Push `src/` (or the `dist/` single file) to a `gh-pages` branch, enable Pages in Settings |
| Vercel / Netlify | Drag and drop the `src/` folder — no build command needed |
| Any web server | Point Nginx/Apache at `src/` |
| Offline distribution | Just send `dist/tempolens.html` |

### Compatibility

- **Browsers**: any recent Chrome / Edge / Firefox / Safari (Web Audio required; falls
  back to visual-only mode when unavailable);
- **Desktop**: Windows 10+ / macOS 11+ / Linux (any modern distro);
- **Mobile**: iOS Safari 15+ / Android Chrome (responsive layout, touch-friendly);
- **Dev tooling**: Node.js ≥ 18.17 (only for syntax checks, tests and bundling).

### CI quality gates

Every push and PR runs on GitHub Actions (Ubuntu / Windows / macOS × Node 20/22 matrix):

1. `node scripts/check-syntax.mjs` — full syntax check;
2. `node --test` — unit tests;
3. `node scripts/build.mjs` — single-file bundle;
4. `node scripts/smoke.mjs` — static server smoke test.

---

## 🤝 Contributing

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue; include reproduction
  steps and environment details for bugs;
- PRs must follow the **Angular commit convention** (`feat:` / `fix:` / `docs:` /
  `refactor:` …);
- Run `npm run verify` locally before submitting;
- New UI strings must be added to all three languages (zh-CN / zh-TW / en);
- Runtime dependencies are strictly forbidden — that is the project's core constraint.

---

## 📄 License

Released under the [MIT](LICENSE) License:

- ✅ Free to use, copy, modify, merge, publish and distribute, including commercially;
- ✅ The only requirement: keep the original copyright and license notice in copies
  or substantial portions of the software;
- ❌ Provided "AS IS" without warranty of any kind.

Copyright © 2026 TempoLens contributors.
