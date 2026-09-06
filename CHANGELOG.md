# Changelog

All notable changes to Or are logged here, newest first. Version shown matches the number in the app's Help dialog (בדיקת עדכונים).

## 1.36.2 — 2026-09-06

- **Improved**: the assistant now treats the live OR itinerary, restaurants, traveller profile and day-load as a mandatory recommendation inventory. Requests for “more” first exclude existing places, identify gaps, and place verified additions on a sensible less-busy trip day when one was not specified.
- **Improved**: children and family requests explicitly use the saved travel profile, avoid duplicate venues, and add a small verified batch unless the traveller explicitly asks for all suitable options.
- **Improved**: the visible “Thinking…” state now appears immediately, cycles through checking/searching/preparing steps, has a stronger animation, and remains visible long enough to be noticed.
- **Fixed**: Gemini search-and-plan requests receive a bounded larger response allowance for tool work, while regular chat stays short. A transient transport or server failure is retried once on Gemini only, and a completed add/update tool call now returns in Gemini 3's required follow-up format instead of failing with a generic service error.

## 1.36.1 — 2026-09-06

- **Changed**: the trip assistant now uses only Google Gemini. Cloudflare AI, NVIDIA, every provider fallback, and the visible “Switching models…” notice were removed.
- **Simplified**: when Gemini is unavailable, the traveller sees the existing neutral service-unavailable message; the app does not try a different model or expose provider diagnostics.

## 1.36.0 — 2026-09-06

- **Added**: a local **Guide import** tab. Paste a Hebrew or Markdown travel guide, review every extracted restaurant and point of interest, then add only the chosen records to the existing trip tabs.
- **Added**: editable suggestions for trip day, time, map search, cost, and notes. When trip dates are set, recommendations are distributed across the days as a proposal; the traveller controls the final result before saving.
- **Safety**: exact-name recommendations already in the trip are detected and left unchecked. Missing addresses and prices are never guessed, and pasted guide text is processed in the browser rather than sent to an AI provider.

## 1.35.13 — 2026-09-06

- **Fixed**: on a narrow phone screen, the "All days" button sat squeezed above the day cells on its own line. It's now one wide bar below the day-cell row instead.

## 1.35.12 — 2026-09-06

- **Added**: right-click an activity in the Daily Agenda and choose Delete to remove it directly, without switching to its own tab first - same confirmation as every other delete in the app.
- **Added**: every trip record (and the trip's own details) now silently keeps its own last-updated timestamp, laying the groundwork for a smarter, automatic backup that can tell what actually changed instead of only comparing one whole-trip save time.

## 1.35.11 — 2026-09-05

- **Added**: the itinerary/points-of-interest tab now has website and image columns/fields, like the Links tab already did. When the assistant adds an attraction with a source link, its real page image is fetched automatically (the same trusted lookup the Links tab already uses) - never an AI-guessed picture.
- **Improved**: the assistant now puts an attraction's source link in its own website field instead of burying it in notes, only records a cost when a source actually states a price, and is instructed to tell the user plainly which details (such as an exact visit time) it could not find, instead of silently leaving them blank.

## 1.35.10 — 2026-09-05

- **Fixed**: malformed AI output containing raw Markdown escapes or a long run of underscores/asterisks is now rejected server-side and cleaned client-side before it can fill the chat. Assistant replies are capped at 256 output tokens and instructed to use plain text only.
- **Fixed**: pressing “Personalize” again while the questionnaire is already open now returns to the existing question instead of duplicating the introduction and first question in the chat history.

## 1.35.9 — 2026-09-05

- **Improved**: the vacation-style question in the assistant’s personalisation chat now supports multiple selections. For example, travellers can choose both “City & culture” and “Nature & beaches”, then press Continue; old one-choice profiles are migrated safely.
- **Changed**: NVIDIA fallback now defaults to `openai/gpt-oss-20b`, a lighter model with instruction following and tool-use support. The previous Nemotron Lightning default was intended primarily for English and could produce poor Hebrew replies. A configured `NVIDIA_MODEL` variable still overrides this default.

## 1.35.8 — 2026-09-05

- **Fixed**: a request that needs current web information (such as finding child-friendly attractions) now follows Gemini → NVIDIA directly. It no longer falls through to the small Workers AI model, which cannot search the web and could return a weak generic sentence instead of a useful trip response. Ordinary chat still uses Workers AI → Gemini → NVIDIA.

## 1.35.7 — 2026-09-05

- **Added**: a short, optional personalisation questionnaire in the assistant (trip style, travelling party, pace, interests, budget and an optional note). Its answers are saved with the current trip, backed up in Excel, and supplied to every provider on future questions.
- **Improved**: the assistant now follows one concise travel-planning playbook across Workers AI, Gemini and NVIDIA: it checks existing trip data before suggesting places, avoids duplicates, clusters nearby attractions and local food into practical day plans, and defaults to short answers to reduce AI usage costs.
- **Fixed**: a provider response that talks about its model, training or provider identity is now rejected server-side and automatically retried with the next provider instead of being shown to the traveller. If an actual fallback occurs, the UI only says “Switching models…”.
- **Fixed**: requests needing current web recommendations now try Gemini first because it is the provider with Google Search; ordinary chat remains Workers AI → Gemini → NVIDIA. Provider output is capped at 360 tokens to prevent unnecessarily long, costly responses.

## 1.35.6 — 2026-09-05

- **Fixed**: found the real cause behind Workers AI (and any future GET-based `/api/*` route) appearing to silently run stale code after every deploy: Cloudflare's static-assets layer answers a GET request whose path matches no real file *before* worker.js's router ever runs, so it never actually reached the new code - only POST requests (like the assistant's actual chat calls) always reached the Worker regardless. `/api/*` now always runs the Worker first.

## 1.35.5 — 2026-09-05

- **Fixed**: Cloudflare Workers AI, the assistant's first-choice provider, never actually activated in production — every deploy updated the site but silently kept running old code, with no visible error, because of how the `[ai]` binding it depended on interacted with this Worker's deploy pipeline. It's now called over a plain HTTPS request with an API token instead of that binding, the same way the Gemini/NVIDIA fallbacks already work. Requires a new `CF_API_TOKEN` Worker secret (Workers AI read permission) to actually activate.

## 1.35.4 — 2026-09-05

- **Added**: right-click any activity in the Daily Agenda to move it to another day. The picker includes every calendar day in the trip, including days that are currently empty, and moves the underlying flight, hotel event, restaurant, car pickup/return, or point-of-interest date safely.
- **Improved**: when the source day is currently filtered, moving an activity follows it to the selected destination day so the result is immediately visible.

## 1.35.3 — 2026-09-05

- **Added**: the Documents tab can now create and maintain an `or-trip-assistant-brief.md` file inside the existing per-trip Google Drive folder. It keeps user-editable permanent instructions alongside a refreshed, privacy-filtered trip snapshot, and the assistant reads it as user context for each new question without opening a surprise Google sign-in popup.
- **Improved**: the fallback notice is now the neutral “Switching models…” status rather than exposing the active AI provider to the traveller.
- **Fixed**: fallback-model answers that try to disclose or endlessly repeat model/provider/training identity are replaced before display and before they enter chat history; provider/API diagnostic errors are also shown as a neutral availability message.
- **Privacy**: documented the optional Markdown context file and its AI processing in the privacy policy and terms. Booking references and insurance-policy details are intentionally excluded from the Drive snapshot.

## 1.35.2 — 2026-09-05

- **Fixed**: a date field could get stuck with only a 2-digit year (e.g. "0026" instead of "2026") if a date input was saved before all 4 year digits were typed. This showed up two ways: the date displaying with a 2-digit year in tables, and that record silently disappearing when filtering the trip to that specific day (it still showed up fine in the "all days" view). The repair now recognizes this shape too and fixes it automatically on next load; day-view filtering for flights, hotels, restaurants, cars, expenses and itinerary items also no longer relies on the raw stored value being well-formed.

## 1.35.1 — 2026-09-05

- **Changed**: switched Workers AI to Llama 3.2 1B Instruct, the cheapest Workers AI model confirmed to still support tool calling, instead of the 3B version.

## 1.35.0 — 2026-09-05

- **Added**: Cloudflare Workers AI (Llama 3.2 3B Instruct) as the assistant's new first provider, tried before Gemini and NVIDIA. It needs no API key - it runs directly on Cloudflare's own infrastructure - so it can't be affected by a key going missing or invalid.
- **Improved**: the in-chat notice that names the active provider now covers Gemini too, not just NVIDIA, whenever the assistant isn't running on the fast, free Workers AI path.

## 1.34.16 — 2026-09-05

- **Fixed**: the floating chat bubble stayed visible while the assistant panel was open, sitting right below the panel's own Send button and reading as a second, confusing button. It now hides while the panel is open.

## 1.34.15 — 2026-09-05

- **Fixed**: on a narrow phone screen, opening the hamburger menu placed it entirely off the left edge of the screen instead of near the button that opened it.

## 1.34.14 — 2026-09-05

- **Fixed**: hardened the assistant identity instruction so the NVIDIA fallback no longer introduces itself as a model or discusses its training; lowered its response randomness to reduce repeated, off-topic output while preserving the Gemini-first provider order.

## 1.34.13 — 2026-09-05

- **Privacy**: clarified that Google states prompts sent through its Gemini Free Tier may be used to improve its products, so the explicit AI-document description notice now gives users a clear warning before they choose to send readable PDF text.

## 1.34.12 — 2026-09-05

- **Added**: every text-based PDF in the trip Documents tab can now receive a short AI description on explicit request; the description is saved with the file in its existing Google Drive trip folder.
- **Improved**: document actions are grouped together, with Open directly beside Delete.
- **Privacy**: the documents tab now explains before use that readable PDF text is sent to the configured assistant provider only after clicking “AI description”; the privacy policy and terms now reflect this optional processing.

## 1.34.11 — 2026-09-05

- **Fixed**: the NVIDIA fallback always failed with "Unsupported parameter(s): `extra_body`" — that field only means something to the OpenAI Python SDK, not to a direct HTTP call. The affected settings are now sent as plain top-level fields instead.

## 1.34.10 — 2026-09-05

- **Added**: search-intent requests can now use Gemini's Google Search grounding before calling the existing record tools, so the assistant can find a current place and add it to the itinerary.
- **Safety**: if Google Search is unavailable, the assistant is instructed not to invent or add an unverified recommendation.

## 1.34.9 — 2026-09-05

- **Added**: car rentals now support separate pickup and return times, shown in the car tab, Excel backup, and the trip agenda.

## 1.34.8 — 2026-09-05

- **Fixed**: restored the requested provider order: Gemini is always tried first, and NVIDIA is used only when Gemini is unavailable.

## 1.34.7 — 2026-09-05

- **Improved**: NVIDIA is now the primary assistant provider when `NVIDIA_API_KEY` is configured, with Gemini as a secondary fallback.
- **Fixed**: disabled extended reasoning and reduced the NVIDIA response budget to prevent timeout on the full trip/tool context.
- **Improved**: the assistant status notice now clearly identifies NVIDIA as the active provider.

## 1.34.6 — 2026-09-05

- **Security**: restricted Worker static assets to an explicit public allowlist so server source, Git metadata, and internal files cannot be served as website assets.

## 1.34.5 — 2026-09-05

- **Fixed**: switched the NVIDIA fallback to `nvidia/nemotron-3.5-lightning-30b-a3b`, the faster Agent-oriented model shown in the NVIDIA catalog, to reduce full-context timeouts.

## 1.34.4 — 2026-09-05

- **Fixed**: switched the NVIDIA fallback to the available `openai/gpt-oss-20b` endpoint shown in the NVIDIA catalog.
- **Improved**: NVIDIA non-JSON/API failures now include a short provider response for diagnosis.
- **Security**: unknown asset paths now return a real 404 instead of the SPA homepage.

## 1.34.3 — 2026-09-05

- **Security**: excluded Git, worktree, Wrangler, server-source, and internal documentation files from public Worker assets.
- **Security**: removed the temporary environment-diagnostics endpoint from the Worker.

## 1.34.2 — 2026-09-05

- **Fixed**: replaced NVIDIA's retired `meta/llama-3.1-8b-instruct` fallback with the available `nvidia/nemotron-3.5-nano-30b-a3b` model, which supports tool calling and has only 3B active parameters.

## 1.34.1 — 2026-09-05

- **Fixed**: NVIDIA API errors now expose the provider's useful HTTP/detail message so tool-payload incompatibilities can be diagnosed instead of appearing only as `nvidia error`.

## 1.34.0 — 2026-09-05

- **Improved**: the assistant now shows an animated spinner and progress stages while waiting for the AI service or executing trip tools.
- **Fixed**: the NVIDIA fallback now uses the lighter `meta/llama-3.1-8b-instruct` model with a shorter response limit to reduce timeouts on full trip context.

## 1.33.0 — 2026-09-05

- **Added**: NVIDIA API fallback when Gemini is unavailable or its quota is exhausted.
- **Added**: a visible notice tells the user when the assistant switches providers.
- **Configured**: the fallback uses NVIDIA's hosted `openai/gpt-oss-20b` model with native tool-calling support.

## 1.32.4 — 2026-09-05

- **Fixed**: upstream Gemini failures now stay JSON with a client-visible error instead of using HTTP 502, which Cloudflare was replacing with an unhelpful plain-text gateway page.

## 1.32.3 — 2026-09-05

- **Fixed**: the assistant now falls back to the production chat API when the app is opened through an old Pages deployment, and the chat API supports cross-origin preflight/JSON responses so stale preview URLs do not strand the assistant.

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
