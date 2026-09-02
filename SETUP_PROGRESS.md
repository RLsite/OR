# Or — Progress Log

Living status file. Updated at every meaningful step (code change, Google Console step, deployment). Branch: `claude/read-file-scan-directory-198b34`.

## Code changes (done, local only — not yet deployed)

- **Multi-tool scaffolding removed** from `index.html`: header tool-switcher menu, Settings "choose tools" tab + enable/disable-tools infra, dead `projcontacts` fragment, an entire unreachable generic "ledger report" engine (called a non-existent `/api/building`), ~46 orphaned category/status i18n entries from deleted tools (vaad/projects/home-expense). 3887 → ~3430 lines.
- **New feature: per-trip Google Drive document folder** — Settings → Google Drive tab now has an "העלאת מסמך (PDF)" button. Uploads go into a Drive folder named `{destination} - {trip start date}` (created on first use), listed in a new "מסמכים שמורים" table with an Open link. Excel backup flow (`or-backup.xlsx`) untouched, still at Drive root. New functions: `tripFolderName()`, `driveFolderId()`, `driveUploadDocument()`, `driveListDocuments()`.
- **New pages**: [privacy.html](privacy.html), [terms.html](terms.html) — required for Google OAuth verification (see below).
- **Footer added to `index.html`**: links to both new pages (Google flagged the home page for not linking to a privacy policy).

## Google Cloud / OAuth setup (in progress, user is doing this directly in console.cloud.google.com)

- Created a **new dedicated GCP project** for Or, separate from whatever older/shared project the app's OAuth credentials used to belong to (that older one may be shared with other rlapp.net tools — deliberately not reused).
- Project name in console: **`OR-vacation`**.
- Enabled: Google Drive API. (Google Picker API status not yet confirmed.)
- **New OAuth Client ID generated and already updated in code**: `297437869958-gvh093f0s50ti02t8l7bg4dbo858g38h.apps.googleusercontent.com` (`index.html` line ~1659).
- **API Key**: still the OLD one (`AIzaSyDHoEebFT_6lKYpF0IDFSpZknBUqeHjf8M`, tied to the old project) — only used for the "pick a file shared by a family member" Picker feature. Not yet regenerated under the new project. Not blocking the core PDF feature.
- **Authorized JavaScript origins**: told to add `https://or.rlapp.net` (confirmed production domain). Any Cloudflare Pages preview origin (`*.pages.dev`) needs to be added separately if used — exact URL not known from code, user needs to check their Cloudflare dashboard.
- **Authorized redirect URIs**: left empty — correct, the app uses the GIS popup token flow (`initTokenClient`), which doesn't need one.
- **OAuth consent screen branding verification**: Google flagged two issues on a review attempt:
  1. Home page didn't link to the privacy policy → **fixed in code** (footer added), not yet live.
  2. `https://or.rlapp.net/privacy.html` was unresponsive → because it doesn't exist on production yet (not deployed). **Will resolve once deployed.**
  - **Do not click "I have fixed the issues" in that Google dialog until after deployment** and confirming both URLs actually work live.
- **Publishing status (Testing vs. In production)**: not yet confirmed by the user for the new project. Still needs checking once the branding verification above is cleared.

## Deployment status: PUSHED, NOT YET LIVE ON PRODUCTION

- Committed (3 commits: index.html changes / privacy+terms pages / CLAUDE.md+this file) and pushed to `origin/claude/read-file-scan-directory-198b34` on 2026-09-02, with explicit user approval.
- This pushes the **branch only** — Cloudflare Pages will likely build a preview from it, but production (`or.rlapp.net`, deployed from `main`) is still on the old code until this branch is merged to `main`.
- Confirmed live on production as of this session: still the old tool-switcher button/menu (screenshot from the user matched the pre-cleanup UI exactly, airplane icon = `TOOL_ICONS.trip` swapped into the old home button - a giveaway it's the old code, not a regression).
- Note: GitHub reported the repo moved to `https://github.com/RLsite/OR.git` (capitalization change) - push succeeded via redirect, not an issue, but worth using the new URL going forward.
- **Next step**: merge this branch to `main` (PR or direct merge) to actually go live on `or.rlapp.net`, then re-verify privacy.html/terms.html resolve live before returning to the Google branding-verification dialog.

## Open items / not yet done

- Regenerate the Picker API key under the new `OR-vacation` project (optional, not blocking).
- Confirm OAuth consent screen Publishing status (Testing vs. Production) for `OR-vacation`.
- Deploy to production.
- End-to-end test of the real Drive folder-creation + PDF upload with a real Google account (only the user can do this).
- Re-check Google branding verification after deployment.
