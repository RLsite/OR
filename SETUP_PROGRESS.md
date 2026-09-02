# Or — Progress Log

Living status file. Updated at every meaningful step. Full version-by-version change history: [CHANGELOG.md](CHANGELOG.md).

## Deployment status: LIVE on production

- `https://or.rlapp.net` confirmed running **v1.26.0** (latest), matching `main` on GitHub.
- Claude now has a standing permission (`Bash(git push origin *)` in `.claude/settings.local.json`) to push directly to `main` — no more manual merge step needed each time.
- GitHub reported the repo moved to `https://github.com/RLsite/OR.git` (capitalization change) — pushes still succeed via redirect.

## Google Cloud / OAuth setup

- Dedicated GCP project: **`OR-vacation`**. Client ID in code: `297437869958-gvh093f0s50ti02t8l7bg4dbo858g38h.apps.googleusercontent.com`.
- **API Key still old** (`AIzaSyDHoEebFT_6lKYpF0IDFSpZknBUqeHjf8M`, tied to the previous shared project) — only affects the "pick a shared file" Picker feature, not blocking.
- Google's OAuth branding verification issues (missing privacy-policy link, unresponsive privacy.html) were fixed and are live.
- **Still open**: OAuth consent screen Publishing status (Testing vs. In production) for `OR-vacation` — not yet confirmed by the user. If still Testing, only ≤100 allow-listed emails can sign in.

## Open items / not yet done

- Confirm/fix OAuth consent screen Publishing status.
- Regenerate the Picker API key under `OR-vacation` (optional).
- End-to-end test of the real Drive folder-creation + PDF upload with a real Google account (only the user can do this).
