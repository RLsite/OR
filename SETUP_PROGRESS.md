# Or — Progress Log

Living status file. Updated at every meaningful step (code change, Google Console step, deployment). Branch: `claude/read-file-scan-directory-198b34`. Full change history with version numbers: [CHANGELOG.md](CHANGELOG.md).

## Deployment status: LIVE on production (as of v1.23.0)

- `main` was merged (fast-forward, by the user directly — a direct push to `main` from this session is blocked by an auto-mode permission classifier) and confirmed live on `https://or.rlapp.net`: new version number, new OAuth Client ID, old tool-switcher gone, `privacy.html` resolving.
- Since that merge, **3 more commits were made and pushed to the branch but NOT yet merged to `main`**: the hamburger-menu/save-icon rework (1.24.0) and the Documents tab (1.25.0). `main` is currently one version behind the branch (at 1.23.0; branch is at 1.25.0) — needs another merge to go live.
- GitHub reported the repo moved to `https://github.com/RLsite/OR.git` (capitalization change) — pushes still succeed via redirect.

## Code changes this session, newest first (see CHANGELOG.md for full detail)

- **v1.25.0** — new "מסמכים" (Documents) tab in the trip's tab bar (after Links): Drive PDF upload + saved-documents list moved here from Settings, with a connect-to-Drive prompt if not yet connected.
- **v1.24.0** — header consolidated to 2 icons (save/backup + hamburger ☰); everything else (Report Center, Settings, Theme, language, RLAPP.net link, Help) moved into the hamburger menu. The save/backup icon now connects+backs up to Drive directly on click (mirrors Alon's equivalent icon — researched via its source at `D:\harel\RLAPP ON RL\ALON`), with a small connected/disconnected status dot. Fixed a stray `?_=<timestamp>` left in the address bar after the cache-busting auto-update reload.
- **v1.23.0** — removed all leftover multi-tool-platform scaffolding (tool-switcher menu, "choose tools" settings tab, a dead ledger-report engine, ~46 orphaned i18n entries). Added the original per-trip Drive document folder feature, moved Or's OAuth to its own dedicated GCP project, added `privacy.html`/`terms.html` + footer links (for Google's OAuth branding verification).

## Google Cloud / OAuth setup

- Dedicated GCP project: **`OR-vacation`**. Client ID already updated in code: `297437869958-gvh093f0s50ti02t8l7bg4dbo858g38h.apps.googleusercontent.com`.
- **API Key still old** (`AIzaSyDHoEebFT_6lKYpF0IDFSpZknBUqeHjf8M`, tied to the previous shared project) — only affects the "pick a shared file" Picker feature, not blocking.
- Google's branding verification flagged missing privacy-policy link + unresponsive privacy.html — both fixed and now live (see above).
- **Still open**: OAuth consent screen Publishing status (Testing vs. In production) for `OR-vacation` — not yet confirmed by the user. If still Testing, only ≤100 allow-listed emails can sign in.

## Open items / not yet done

- Merge the branch's latest 2 commits (1.24.0, 1.25.0) to `main` to go live.
- Confirm/fix OAuth consent screen Publishing status.
- Regenerate the Picker API key under `OR-vacation` (optional).
- End-to-end test of real Drive folder-creation + PDF upload with a real Google account (only the user can do this — not testable from this session).
