import { GEMINI_MODEL, jsonResponse, readJsonBody } from '../_lib.js';

// Best-effort per-isolate rate limit - NOT a hard guarantee (Pages Functions run
// many parallel isolates around the world with no shared memory between them),
// just a cheap deterrent against naive abuse of a route backed by a real, shared
// API quota. For actual protection, add a Cloudflare Rate Limiting Rule (Security
// > WAF) scoped to this path, and a billing budget/alert on the Gemini project.
const chatHits = new Map(); // ip -> timestamps[]
const CHAT_LIMIT = { windowMs: 60000, max: 15 };
function isRateLimited(ip) {
  const now = Date.now();
  const hits = (chatHits.get(ip) || []).filter(t => now - t < CHAT_LIMIT.windowMs);
  hits.push(now);
  chatHits.set(ip, hits);
  return hits.length > CHAT_LIMIT.max;
}

// POST /api/chat {contents, tools?, systemInstruction?} - a thin, stateless relay
// to the Gemini API (adds the API key server-side, since it can't live in the
// browser). All conversation state and tool-call execution is owned and looped by
// the client (see index.html's askAssistant()) - this route never stores anything
// between requests, so every call is self-contained and scoped only to its sender.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.GEMINI_API_KEY) return jsonResponse({ error: 'not configured' }, 500);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) return jsonResponse({ error: 'rate limited' }, 429);

  const body = await readJsonBody(request);
  if (!body || !Array.isArray(body.contents) || !body.contents.length) return jsonResponse({ error: 'missing contents' }, 400);

  const payload = { contents: body.contents };
  if (Array.isArray(body.tools)) payload.tools = body.tools;
  if (body.systemInstruction) payload.systemInstruction = { parts: [{ text: String(body.systemInstruction) }] };

  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return jsonResponse({ error: 'gemini request failed' }, 502);
  }
  const data = await res.json();
  if (!res.ok) return jsonResponse({ error: (data.error && data.error.message) || 'gemini error' }, 502);
  const content = data.candidates && data.candidates[0] && data.candidates[0].content;
  if (!content) return jsonResponse({ error: 'empty response' }, 502);
  return jsonResponse({ content });
}
