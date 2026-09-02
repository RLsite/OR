# Changelog

All notable changes to Or are logged here, newest first. Version shown matches the number in the app's Help dialog (בדיקת עדכונים).

## 1.24.0 — 2026-09-02

- **Changed**: the header now shows only two icons — the save/backup icon and a hamburger (☰) menu. Report Center, Settings, Theme toggle, language switcher, the RLAPP.net link, and Help all moved inside the hamburger menu.
- **Changed**: clicking the header save/backup icon now backs up to Google Drive immediately — connects first if not already connected, then uploads right away — instead of just opening Settings (matches the equivalent icon's behavior in the sibling Alon app). Added a small status dot on the icon showing whether Drive is currently connected.
- **Fixed**: the address bar no longer keeps a stray `?_=<timestamp>` after the app's cache-busting auto-update reload — it's cleaned up right after the fresh page loads.

## 1.23.0 — 2026-09-02

- **Removed** the leftover multi-tool platform scaffolding: the header tool-switcher menu, the Settings "choose tools" tab and its enable/disable-tools logic, a dead code fragment from the already-deleted "projects" tool, and an entire generic ledger-report engine that had been unreachable (it called a `/api/building` endpoint that never existed). Also removed ~46 orphaned category/status translation entries left behind by earlier tool deletions (vaad, projects, home-expense ledger).
- **Added**: per-trip Google Drive document storage — a new "העלאת מסמך (PDF)" button in Settings → Google Drive uploads a chosen PDF (boarding pass, hotel voucher, insurance, etc.) into a Drive folder automatically named after the trip and its start date, with a "מסמכים שמורים" table listing saved documents and an open link for each. The existing Excel backup file is unaffected.
- **Changed**: Or's Google OAuth client now points at a dedicated Google Cloud project, separate from the shared project it used to sit under.
- **Added**: `privacy.html` and `terms.html`, linked from the app's footer — required for Google's OAuth consent screen verification.

## 1.22.1 and earlier

Not tracked in this file — see `git log` for history before this changelog was introduced.
