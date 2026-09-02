# Changelog

All notable changes to Or are logged here, newest first. Version shown matches the number in the app's Help dialog (בדיקת עדכונים).

## 1.23.0 — 2026-09-02

- **Removed** the leftover multi-tool platform scaffolding: the header tool-switcher menu, the Settings "choose tools" tab and its enable/disable-tools logic, a dead code fragment from the already-deleted "projects" tool, and an entire generic ledger-report engine that had been unreachable (it called a `/api/building` endpoint that never existed). Also removed ~46 orphaned category/status translation entries left behind by earlier tool deletions (vaad, projects, home-expense ledger).
- **Added**: per-trip Google Drive document storage — a new "העלאת מסמך (PDF)" button in Settings → Google Drive uploads a chosen PDF (boarding pass, hotel voucher, insurance, etc.) into a Drive folder automatically named after the trip and its start date, with a "מסמכים שמורים" table listing saved documents and an open link for each. The existing Excel backup file is unaffected.
- **Changed**: Or's Google OAuth client now points at a dedicated Google Cloud project, separate from the shared project it used to sit under.
- **Added**: `privacy.html` and `terms.html`, linked from the app's footer — required for Google's OAuth consent screen verification.

## 1.22.1 and earlier

Not tracked in this file — see `git log` for history before this changelog was introduced.
