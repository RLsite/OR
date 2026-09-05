import { GEMINI_MODEL, NVIDIA_MODEL, corsResponse, geminiToOpenAiMessages, geminiToOpenAiTools, jsonResponse, openAiToGeminiContent, readJsonBody } from '../_lib.js';

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

export function onRequestOptions() {
  return corsResponse();
}

async function askGemini(body, env) {
  const payload = { contents: body.contents };
  if (Array.isArray(body.tools)) payload.tools = body.tools;
  if (body.systemInstruction) payload.systemInstruction = { parts: [{ text: String(body.systemInstruction) }] };
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
    });
  } catch (e) { return { error: 'gemini request failed' }; }
  let data;
  try { data = await res.json(); } catch (e) { return { error: 'gemini returned an invalid response' }; }
  if (!res.ok) return { error: (data.error && data.error.message) || 'gemini error' };
  const content = data.candidates && data.candidates[0] && data.candidates[0].content;
  return content ? { content } : { error: 'empty response' };
}

async function askNvidia(body, env) {
  if (!env.NVIDIA_API_KEY) return { error: 'nvidia not configured' };
  const messages = [];
  if (body.systemInstruction) messages.push({ role: 'system', content: String(body.systemInstruction) });
  messages.push(...geminiToOpenAiMessages(body.contents));
  const payload = { model: env.NVIDIA_MODEL || NVIDIA_MODEL, messages, temperature: 0.2, max_tokens: 2048, stream: false };
  const tools = geminiToOpenAiTools(body.tools);
  if (tools.length) { payload.tools = tools; payload.tool_choice = 'auto'; }
  let res;
  try {
    res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.NVIDIA_API_KEY}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
    });
  } catch (e) { return { error: 'nvidia request failed' }; }
  let data;
  try { data = await res.json(); } catch (e) { return { error: 'nvidia returned an invalid response' }; }
  if (!res.ok) return { error: (data.error && (data.error.message || data.error)) || 'nvidia error' };
  const content = openAiToGeminiContent(data);
  return content ? { content } : { error: 'nvidia returned an empty response' };
}

// POST /api/chat {contents, tools?, systemInstruction?} - a thin, stateless relay
// to the Gemini API (adds the API key server-side, since it can't live in the
// browser). All conversation state and tool-call execution is owned and looped by
// the client (see index.html's askAssistant()) - this route never stores anything
// between requests, so every call is self-contained and scoped only to its sender.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.GEMINI_API_KEY && !env.NVIDIA_API_KEY) return jsonResponse({ error: 'not configured' }, 500);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) return jsonResponse({ error: 'rate limited' }, 429);

  const body = await readJsonBody(request);
  if (!body || !Array.isArray(body.contents) || !body.contents.length) return jsonResponse({ error: 'missing contents' }, 400);

  const gemini = env.GEMINI_API_KEY ? await askGemini(body, env) : { error: 'gemini not configured' };
  if (gemini.content) return jsonResponse({ content: gemini.content, provider: 'gemini' });
  if (env.NVIDIA_API_KEY) {
    const nvidia = await askNvidia(body, env);
    if (nvidia.content) return jsonResponse({ content: nvidia.content, provider: 'nvidia', fallback: 'gemini' });
    return jsonResponse({ error: `Gemini: ${gemini.error}; NVIDIA: ${nvidia.error}` }, 500);
  }
  return jsonResponse({ error: gemini.error, fallback: 'nvidia', nvidiaConfigured: false }, 500);
}
