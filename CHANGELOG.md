# Changelog

All notable changes to Or are logged here, newest first. Version shown matches the number in the app's Help dialog (בדיקת עדכונים).

## 1.32.2 — 2026-09-05

- **Fixed**: assistant requests now bypass browser and edge caching with a timestamped, `no-store` API request, preventing an old HTML response from being reused for chat.

## 1.32.1 — 2026-09-05

- **Fixed**: chat API failures now remain JSON responses, including when Gemini returns an invalid upstream response, preventing the browser from receiving an HTML error page and showing the misleading `Unexpected token '<'` message.

## 1.32.0 — 2026-09-05

- **Added**: the AI assistant can now list and read text from PDF documents in the current trip's Google Drive folder after the user connects Drive and asks about a document.
- **Security**: document access stays limited to Or's own trip folder and selected PDFs; the assistant never receives a Google Drive token or general Drive access.
- **Improved**: HTML responses from a misrouted chat endpoint now show a clear service-availability message instead of the raw `Unexpected token '<'` parsing error.

## 1.31.0 — 2026-09-05

- **Added**: full responsive mobile layout for the trip dashboard, forms, dialogs, tabs, tables, reports and floating assistant, including safe-area spacing and touch-friendly controls.
- **Fixed**: connecting Google Drive from a new or empty device now checks the existing Drive backup first and opens the sync choice instead of silently overwriting it with empty local data.

## 1.30.1 — 2026-09-05

- **Fixed**: the AI trip assistant now uses the available Gemini 3.6 Flash model instead of the retired Gemini 2.5 Flash model.

## 1.30.0 — 2026-09-05

- **Fixed**: a date saved with a 2-digit year (e.g. a hotel check-in stored as `26-09-11` instead of `2026-09-11`) showed up as its own separate day in the daily agenda, splitting one real day into two — with one of them displaying the year as `26`. Such dates are now read as the year 2000-something everywhere, and repaired in place the next time the app loads.
- **Added**: an agenda item can now be dragged onto a *different* day, not just reordered within its own. Dropping it in another day actually changes that item's date (the check-in date, the flight date, and so on) rather than just moving it on screen.
- **Fixed**: the header's Drive icon could show a green "connected" dot while every backup attempt was actually failing. A failed connection now clears that state instead of leaving a status that isn't true.

## 1.29.1 — 2026-09-02

- **Fixed**: a Google sign-in popup could appear on every page load/refresh for anyone with Drive connected - the trip's Documents tab was silently asking Drive for the file list as a side effect of the page just loading, not only when that tab was actually opened. It now only asks when you actually open the Documents tab (or connect from within it).
- **Fixed**: the "Vacation with Or" chat window didn't close when clicking ✕ - its own layout style was overriding the browser's normal hide behavior.
- **Fixed**: the daily agenda's drag handle was smaller than a comfortable tap target on a phone, which could make a drag not register at all despite looking like something moved. Enlarged it to a proper touch-sized target.
- **Changed**: renamed the AI chat from "עוזר הטיול" to "חופשה עם אור".

## 1.29.0 — 2026-09-02

- **Added**: an AI trip assistant (chat bubble, bottom corner) that can answer questions about the trip and add, update, or delete flights, hotels, restaurants, car rentals, itinerary points, expenses, and links on request. Needs `GEMINI_API_KEY` set on the server to actually respond — shows a clear message if it isn't set yet. Deleting is always confirmed before it happens.
- **Changed**: connecting Google Drive now also gets a refresh token, so the access token renews itself silently in the background — no more reconnect popup every ~hour. (Needs `GOOGLE_CLIENT_SECRET` set on the server; falls back to the old reconnect-popup behavior until it is.)

## 1.28.0 — 2026-09-02

- **Fixed**: a date field's own browser-native text could still show through (in the device's regional format, e.g. `mm/dd/yyyy`) while the field was focused, instead of the app's own `dd.mm.yyyy` overlay — most visible right after opening an "add" dialog and clicking straight into a date field.
- **Fixed**: the daily agenda ("סדר יום") could list a hotel check-in or car pickup *before* the flight that lands you there on the same day — items without a specific time now always fall after timed ones, and among themselves follow flight → car → hotel, matching how an arrival day actually unfolds.
- **Added**: the daily agenda can now be manually reordered by dragging items (via the handle on each row) — useful once the automatic time-based order isn't quite right for a given day. The custom order is remembered per day.
- **Added**: a copy button next to each saved link in the Links tab, and long links are now shortened (with the full address still one click away) instead of stretching the table.
- **Fixed**: pasting a link in the Links tab was always failing to auto-fill its name/description/image — the feature was wired up on the app's side but the small server-side piece it depended on (to fetch the page's info) had never actually been built.

## 1.28.1 — 2026-09-02

- **Fixed**: the previous version's link-preview fix didn't actually go live — it shipped as a Cloudflare Pages Function, but this project deploys as a Cloudflare Worker (a different Cloudflare product with a different way of adding server-side code), so the route silently 404'd in production. Rebuilt as `worker.js` to match how this project is actually hosted; confirmed working against the live site.

## 1.27.0 — 2026-09-02

- **Changed**: time fields (flight departure/arrival, etc.) no longer use the browser's native time picker, which could show AM/PM depending on the device's own regional settings — replaced with a plain masked field that's always 24-hour HH:MM, with no way for it to show anything else.
- **Added**: a delete button for each saved document in the Documents tab.
- **Fixed**: uploading a PDF with the same name as an already-saved document is now blocked (with a toast naming the skipped file) instead of creating a second same-named copy; the saved-documents list also de-duplicates by name as a safety net for any duplicates already sitting in Drive from before this fix.

## 1.26.0 — 2026-09-02

- **Changed**: dates throughout the app now display as `dd.mm.yyyy` (was `dd/mm/yy`) — this is the shared, non-locale-dependent format used everywhere (tables, agenda, reports, date inputs).
- **Changed**: every "add" form in the trip (flights, hotels, restaurants, cars, itinerary points of interest, expenses, links) is now a popup dialog opened via a "+" button, instead of always sitting inline above the table — editing an existing row opens the same dialog pre-filled. Each tab now shows just its list by default.
- **Added**: uploading documents in the Documents tab now supports selecting multiple PDFs at once, and an optional description (Drive's own file-description field) applied to the files in that upload.

## 1.25.0 — 2026-09-02

- **Added**: a new "מסמכים" (Documents) tab in the trip's own tab bar, after "קישורים" (Links) — surfaces the Google Drive PDF upload button and saved-documents list directly in the main navigation instead of only inside Settings. Shows a "connect to Drive" prompt first if not yet connected.
- **Changed**: Settings → Google Drive no longer duplicates the document upload/list UI — it points to the new Documents tab instead.

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
