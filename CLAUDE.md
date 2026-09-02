# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Or" (אור) — a Hebrew-first (RTL), 4-language (he/en/ru/ar) vacation-management PWA. The **entire application — HTML, CSS, and JavaScript — lives in one file: `index.html`** (~3400 lines). There is no separate JS/CSS, no framework, no bundler.

## Commands

There is no build step, package manager, linter, or test suite in this repo (no `package.json`). Development is: edit `index.html` directly, then open it in a browser (or preview via a static server) to check the result.

Deployment is via Cloudflare Pages (`wrangler.toml`, `[assets] directory = "./"` — pure static site, no Worker code runs). Pushing to `main` deploys to production at `or.rlapp.net`; other branches get Cloudflare's auto-generated preview URLs (`https://<branch>.<project>.pages.dev`). The app detects a `*.pages.dev` hostname at runtime and shows a visible red staging border so a preview is never mistaken for production.

## Architecture

**Fully client-side, no real backend.** A local `api(url, opts)` function (inside `index.html`) fakes a REST API (`/api/records/:type`, `/api/trip`, `/api/bug`, etc.) but only ever reads/writes a single `localStorage` key (`STORE_KEY = 'or-store-v1'`). There is no server persistence — "saving" means the browser's own storage, an Excel export (SheetJS, loaded from CDN), or the optional Google Drive integration described below.

**Data model — two parallel config objects drive everything:**
- `REC` — the record "shape" per data type (`flights`, `hotels`, `restaurants`, `cars`, `itinerary`, `tripexp`, `triplinks`): field list, which fields are numeric, which are enums, and the Excel sheet/column mapping. Consumed by the `api()` shim and by Excel export/import.
- `TOOLKIT` — the UI config for the same data types (plus a top-level `trip` entry): table columns, field types (`date`/`time`/`select`/`number`/`url`/`image`...), labels, `<select>` options.
- A **generic list-rendering engine** (`fieldHTML`, `listViewHTML`/`listOnlyHTML`, `renderList`, `wireToolView`) reads both objects to render every data type's add/edit/delete form and table. To add a field to an existing data type, edit `REC` + `TOOLKIT` together — don't hand-write new render code. This engine is the app's real reusable core; treat it as load-bearing infrastructure, not boilerplate to simplify away.

**i18n:** one `I18N` dictionary object, keyed by dotted strings (e.g. `'trip.dest.title'`), each entry holding `{ he, en, ru, ar }`. Look up with `t(key, vars)` (supports `{placeholder}` interpolation). `currentLang`/`applyLang()` swap the active language and re-sweep the DOM for `data-i18n` / `data-i18n-html` / `data-i18n-aria` / `data-i18n-ph` / `data-i18n-title` attributes. Every user-facing string must go through this dictionary — never hardcode display text. Dates/times always render via `fmtDate`/`fmtDateTime` (fixed dd/mm/yy, 24h) — deliberately independent of `currentLang` and of the visitor's OS/browser locale.

**Historical note on naming:** the app used to be a multi-tool platform (it had other tools — a building-committee manager, a home-expense ledger, etc. — transplanted from a sibling project) before being reduced to just this one `trip` tool. That's why some identifiers still read as generic multi-tool plumbing (`REC`, `toolData`, `currentTool`, `TOOLKIT.trip`, `showTool(id)`/`loadTool(id)` taking a tool-id parameter) even though `'trip'` is the only value that ever flows through them today. This is intentional, working config — not dead code.

**Google Drive integration** (`GOOGLE_CLIENT_ID`/`GOOGLE_API_KEY` consts, real credentials for a dedicated GCP project): uses Google Identity Services' popup-based token flow (`google.accounts.oauth2.initTokenClient` + `requestAccessToken`) with the narrow `drive.file` scope — the app can only ever see files/folders it creates itself, never the user's other Drive content. No server-redirect OAuth flow, so no redirect URI is configured on the Google Cloud side. The fixed Excel backup (`or-backup.xlsx`) lives at Drive root; user-uploaded PDF documents live in a separate, lazily-created Drive folder named after the trip (`tripFolderName()` / `driveFolderId()` / `driveUploadDocument()` / `driveListDocuments()`) — the two are independent, don't assume one implies the other.

**Changelog convention**: every user-visible change must be logged in `CHANGELOG.md`, paired with a bump to `APP_VERSION` (near the top of the Drive-related consts in `index.html`) and the matching `version` field in `version.json` — these three stay in lockstep. The version number shown in the app's own Help dialog reads `APP_VERSION` directly.

**Standalone pages** `privacy.html` and `terms.html` at the repo root are separate static pages (no JS, no i18n) styled to match `index.html`'s theme, required for Google OAuth consent-screen verification. `index.html`'s footer links to both — Google's branding check crawls the home page for that link, so don't remove it without checking why it's there.
