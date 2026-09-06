// Cloudflare Worker entry point. This project is a static site (index.html etc,
// served via the [assets] binding configured in wrangler.toml) - this script's
// only job is to intercept the few routes that need real server-side logic and
// fall through to the static assets for everything else. Every route here is
// stateless: nothing is stored between requests (no KV, no Durable Objects) -
// each request is handled independently, using only secrets the browser could
// never safely hold itself.
//
// Required secrets (wrangler secret put <name>, or the Cloudflare dashboard's
// Settings > Variables and Secrets for this Worker) - routes that need one
// degrade to a clear {error:"not configured"} response until it's set:
//   GOOGLE_CLIENT_SECRET - for /api/google/exchange and /api/google/refresh
//   GEMINI_API_KEY        - for /api/chat
//
// (Earlier attempt: a Cloudflare Pages "functions/api/*.js" file. That's a
// Pages-only convention and is never invoked under this project's actual
// deployment model - a Worker with a static-assets binding - so it silently
// 404'd. This is the version that actually runs.)

const GOOGLE_CLIENT_ID = '297437869958-gvh093f0s50ti02t8l7bg4dbo858g38h.apps.googleusercontent.com'; // public, not a secret - kept in sync with index.html's copy
const GEMINI_MODEL = 'gemini-3.6-flash';
// Keep replies short by default. The client instruction also asks for concise
// answers, but a provider-side ceiling prevents an accidental long completion.
const ASSISTANT_MAX_OUTPUT_TOKENS = 256;
// Search-and-plan requests need room for Gemini's internal tool work before the
// short final reply. Ordinary chat stays at the lower cap to control usage.
const ASSISTANT_COMPLEX_OUTPUT_TOKENS = 512;
const MAX_HTML_BYTES = 300000; // the tags we need are always in <head>; no reason to buffer a whole page

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'");
}

function metaContent(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1].trim());
  }
  return null;
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
}

function corsResponse() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  } });
}

async function readJsonBody(request) {
  try { return await request.json(); } catch (e) { return null; }
}

// GET /api/link-preview?url=<encoded> - fetches the target page server-side (the
// browser can't - most sites block cross-origin reads of their HTML) and extracts
// basic Open Graph/meta tags so the trip's "Links" tab can auto-fill a name,
// description and image for a pasted URL. Public, stateless - no secrets involved.
async function handleLinkPreview(request) {
  if (request.method !== 'GET') return jsonResponse({ error: 'method not allowed' }, 405);
  const urlParam = new URL(request.url).searchParams.get('url');
  if (!urlParam) return jsonResponse({ error: 'missing url' }, 400);

  let target;
  try { target = new URL(urlParam); } catch (e) { return jsonResponse({ error: 'invalid url' }, 400); }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return jsonResponse({ error: 'unsupported protocol' }, 400);

  let res;
  try {
    res = await fetch(target.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OrLinkPreview/1.0; +https://or.rlapp.net)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    return jsonResponse({ error: 'fetch failed' });
  }
  if (!res.ok) return jsonResponse({ error: 'fetch failed' });
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('html')) return jsonResponse({ error: 'not html' });

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (received < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
  }
  try { await reader.cancel(); } catch (e) { /* best-effort - we already have what we need */ }
  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  const html = new TextDecoder('utf-8').decode(combined);

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = metaContent(html, 'og:title') || (titleMatch ? decodeEntities(titleMatch[1].trim()) : null);
  const description = metaContent(html, 'og:description') || metaContent(html, 'description');
  let image = metaContent(html, 'og:image');
  if (image) { try { image = new URL(image, target).toString(); } catch (e) { image = null; } }

  if (!title && !description && !image) return jsonResponse({ error: 'not found' });
  return jsonResponse({ title: title || '', description: description || '', image: image || '' });
}

// Shared by /api/google/exchange and /api/google/refresh - both just POST to Google's
// token endpoint with different grant types and return whatever Google returns.
async function googleTokenRequest(params) {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, data: { error: 'token request failed' } };
  }
}

// POST /api/google/exchange {code} - exchanges a one-time authorization code (from
// the client's initCodeClient popup) for an access token + refresh token. Needs
// GOOGLE_CLIENT_SECRET, which is exactly why this can't happen in the browser -
// Google requires it for the code->token exchange. The refresh token goes back to
// the client to store (in localStorage, alongside the rest of this app's data,
// per its no-server-persistence design) so future access tokens can be renewed
// silently via /api/google/refresh instead of a popup every ~hour.
async function handleGoogleExchange(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  if (!env.GOOGLE_CLIENT_SECRET) return jsonResponse({ error: 'not configured' }, 500);
  const body = await readJsonBody(request);
  if (!body || !body.code) return jsonResponse({ error: 'missing code' }, 400);

  const { ok, data } = await googleTokenRequest(new URLSearchParams({
    code: body.code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: 'postmessage', // Google's fixed value for a JS popup code flow - not a real URL
    grant_type: 'authorization_code',
  }));
  if (!ok) return jsonResponse({ error: data.error || 'exchange failed' }, 400);
  return jsonResponse({ access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in });
}

// POST /api/google/refresh {refresh_token} - trades a stored refresh token for a
// fresh access token, silently (no popup). See handleGoogleExchange above for where
// the refresh token first comes from.
async function handleGoogleRefresh(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  if (!env.GOOGLE_CLIENT_SECRET) return jsonResponse({ error: 'not configured' }, 500);
  const body = await readJsonBody(request);
  if (!body || !body.refresh_token) return jsonResponse({ error: 'missing refresh_token' }, 400);

  const { ok, data } = await googleTokenRequest(new URLSearchParams({
    refresh_token: body.refresh_token,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  }));
  if (!ok) return jsonResponse({ error: data.error || 'refresh failed' }, 400);
  return jsonResponse({ access_token: data.access_token, expires_in: data.expires_in });
}

// Best-effort per-isolate rate limit on /api/chat - NOT a hard guarantee (Workers run
// many parallel isolates around the world with no shared memory between them), just a
// cheap deterrent against naive abuse of a route backed by a real, shared API quota.
// For actual protection, add a Cloudflare Rate Limiting Rule (Security > WAF) scoped
// to this path, and a billing budget/alert on the Gemini API project.
const chatHits = new Map(); // ip -> timestamps[]
const CHAT_LIMIT = { windowMs: 60000, max: 15 };
function isRateLimited(ip) {
  const now = Date.now();
  const hits = (chatHits.get(ip) || []).filter(t => now - t < CHAT_LIMIT.windowMs);
  hits.push(now);
  chatHits.set(ip, hits);
  return hits.length > CHAT_LIMIT.max;
}

// POST /api/chat {contents, tools?, systemInstruction?} - a thin, stateless relay to
// the Gemini API (adds the API key server-side, since it can't live in the browser).
// All conversation state and tool-call execution is owned and looped by the client
// (see index.html's askAssistant()) - this route never stores anything between
// requests, so every call is self-contained and scoped only to whoever sent it.
function isUsableAssistantContent(content) {
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  // A tool call is always actionable, even if the provider also included an
  // unnecessary short text part beside it.
  if (parts.some(part => part && part.functionCall)) return true;
  const text = parts.map(part => part && part.text ? String(part.text) : '').join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  // A broken generation can get stuck emitting escaped Markdown punctuation.
  // Reject it rather than letting it fill the chat bubble.
  if (/(?:\\?[_*`]\s*){8,}/.test(text)) return false;
  // A generated answer can occasionally ignore the system prompt and answer
  // with a provider/training disclaimer instead of the traveller's request.
  // Treat it as a failed attempt instead of showing it to the traveller.
  const startsWithModelIdentity = /(?:^|[\s.!?…])(?:אני|I(?:'m| am)?|I’m)\s+(?:מודל(?:\s+שפה)?|(?:an?\s+)?(?:AI|language)\s+model|בוט|chatbot|virtual\s+assistant|עוזר\s+וירטואלי)/i.test(text);
  const providerTrainingIdentity = /(?:Gemini|Google).{0,180}(?:model|training|trained|researchers?|provider|מודל|חוקרים|אומן(?:תי)?|נוצר(?:תי)?|פותח(?:תי)?)/i.test(text)
    || /(?:אומן(?:תי)?|נוצר(?:תי)?|פותח(?:תי)?|trained|created|developed)\s+(?:על[\s-]*ידי|by)\s+(?:חוקרי|researchers?|Google|Gemini)/i.test(text);
  return !startsWithModelIdentity && !providerTrainingIdentity;
}

async function askGeminiAttempt(body, env) {
  const maxOutputTokens = body.googleSearch ? ASSISTANT_COMPLEX_OUTPUT_TOKENS : ASSISTANT_MAX_OUTPUT_TOKENS;
  const payload = { contents: body.contents, generationConfig: { maxOutputTokens } };
  if (Array.isArray(body.tools)) payload.tools = body.tools;
  if (body.googleSearch) {
    payload.tools = [...(payload.tools || []), { googleSearch: {} }];
    payload.toolConfig = { includeServerSideToolInvocations: true };
  }
  if (body.systemInstruction) payload.systemInstruction = { parts: [{ text: String(body.systemInstruction) }] };
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
    });
  } catch (e) { return { error: 'gemini request failed', retryable: true }; }
  let data;
  try { data = await res.json(); } catch (e) { return { error: 'gemini returned an invalid response', retryable: true }; }
  if (!res.ok) return { error: (data.error && data.error.message) || 'gemini error', retryable: res.status >= 500 && res.status < 600 };
  const content = data.candidates && data.candidates[0] && data.candidates[0].content;
  return content && isUsableAssistantContent(content) ? { content } : { error: 'gemini returned an unusable response' };
}

// A one-time retry stays on Gemini and is limited to transport/5xx failures.
// It avoids a transient service error without retrying quota or invalid-key errors.
async function askGemini(body, env) {
  const first = await askGeminiAttempt(body, env);
  return first.retryable ? askGeminiAttempt(body, env) : first;
}

async function handleChat(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);
  if (!env.GEMINI_API_KEY) return jsonResponse({ error: 'not configured' }, 500);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) return jsonResponse({ error: 'rate limited' }, 429);

  const body = await readJsonBody(request);
  if (!body || !Array.isArray(body.contents) || !body.contents.length) return jsonResponse({ error: 'missing contents' }, 400);

  const gemini = await askGemini(body, env);
  if (gemini.content) return jsonResponse({ content: gemini.content, provider: 'gemini' });
  return jsonResponse({ error: `Gemini: ${gemini.error}` }, 500);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/link-preview') return handleLinkPreview(request);
    if (url.pathname === '/api/google/exchange') return handleGoogleExchange(request, env);
    if (url.pathname === '/api/google/refresh') return handleGoogleRefresh(request, env);
    if (url.pathname === '/api/chat') {
      if (request.method === 'OPTIONS') return corsResponse();
      return handleChat(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
