import { GEMINI_MODEL, corsResponse, jsonResponse, readJsonBody } from '../_lib.js';

// Best-effort per-isolate rate limit - NOT a hard guarantee (Pages Functions run
// many parallel isolates around the world with no shared memory between them),
// just a cheap deterrent against naive abuse of a route backed by a real, shared
// API quota. For actual protection, add a Cloudflare Rate Limiting Rule (Security
// > WAF) scoped to this path, and a billing budget/alert on the Gemini project.
const chatHits = new Map(); // ip -> timestamps[]
const CHAT_LIMIT = { windowMs: 60000, max: 15 };
// Keep replies short by default. The client instruction also asks for concise
// answers, but a provider-side ceiling prevents an accidental long completion.
// gemini-3.6-flash is a thinking model: its internal reasoning tokens are
// drawn from this same maxOutputTokens budget and aren't shown in the
// response, so a cap sized only for the visible reply left nothing for the
// actual answer once thinking used most of it - the traveller would see a
// few truncated words (sometimes ones that echo the system instruction,
// since the model was mid-reasoning about its own rules) instead of a real
// reply. thinkingConfig below bounds that reasoning explicitly so the rest
// of the budget reliably reaches the visible text.
const ASSISTANT_MAX_OUTPUT_TOKENS = 1024;
const ASSISTANT_THINKING_BUDGET = 512;
// Search-and-plan requests need room for both Gemini's internal tool work and
// a fuller multi-day answer. Ordinary chat stays at the lower cap above to
// control usage.
const ASSISTANT_COMPLEX_OUTPUT_TOKENS = 2048;
const ASSISTANT_COMPLEX_THINKING_BUDGET = 1024;
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
  const complex = !!body.googleSearch;
  const maxOutputTokens = complex ? ASSISTANT_COMPLEX_OUTPUT_TOKENS : ASSISTANT_MAX_OUTPUT_TOKENS;
  const thinkingBudget = complex ? ASSISTANT_COMPLEX_THINKING_BUDGET : ASSISTANT_THINKING_BUDGET;
  const payload = { contents: body.contents, generationConfig: { maxOutputTokens, thinkingConfig: { thinkingBudget } } };
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
  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content;
  if (candidate && candidate.finishReason === 'MAX_TOKENS') return { error: 'gemini response was truncated', retryable: true };
  return content && isUsableAssistantContent(content) ? { content } : { error: 'gemini returned an unusable response' };
}

// A one-time retry stays on Gemini and is limited to transport/5xx failures.
// It avoids a transient service error without retrying quota or invalid-key errors.
async function askGemini(body, env) {
  const first = await askGeminiAttempt(body, env);
  return first.retryable ? askGeminiAttempt(body, env) : first;
}

// POST /api/chat {contents, tools?, systemInstruction?} - a thin, stateless relay
// to Gemini (adds the API key server-side, since it can't live in the browser).
// All conversation state and tool-call execution is owned and looped by the
// client (see index.html's askAssistant()) - this route never stores anything
// between requests, so every call is self-contained and scoped only to its sender.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.GEMINI_API_KEY) return jsonResponse({ error: 'not configured' }, 500);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) return jsonResponse({ error: 'rate limited' }, 429);

  const body = await readJsonBody(request);
  if (!body || !Array.isArray(body.contents) || !body.contents.length) return jsonResponse({ error: 'missing contents' }, 400);

  const gemini = await askGemini(body, env);
  if (gemini.content) return jsonResponse({ content: gemini.content, provider: 'gemini' });
  return jsonResponse({ error: `Gemini: ${gemini.error}` }, 500);
}
