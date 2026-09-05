import { CF_ACCOUNT_ID, GEMINI_MODEL, NVIDIA_MODEL, WORKERS_AI_MODEL, corsResponse, geminiToOpenAiMessages, geminiToOpenAiTools, jsonResponse, openAiSchema, openAiToGeminiContent, readJsonBody } from '../_lib.js';

// Best-effort per-isolate rate limit - NOT a hard guarantee (Pages Functions run
// many parallel isolates around the world with no shared memory between them),
// just a cheap deterrent against naive abuse of a route backed by a real, shared
// API quota. For actual protection, add a Cloudflare Rate Limiting Rule (Security
// > WAF) scoped to this path, and a billing budget/alert on the Gemini project.
const chatHits = new Map(); // ip -> timestamps[]
const CHAT_LIMIT = { windowMs: 60000, max: 15 };
// Keep replies short by default. The client instruction also asks for concise
// answers, but a provider-side ceiling prevents an accidental long completion.
const ASSISTANT_MAX_OUTPUT_TOKENS = 256;
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
  // Retry with the next provider rather than letting it fill the chat bubble.
  if (/(?:\\?[_*`]\s*){8,}/.test(text)) return false;
  // Smaller fallback models occasionally ignore the system prompt and answer
  // with a provider/training disclaimer instead of the traveller's request.
  // Treat it as a failed attempt so the next provider gets a chance to answer.
  const startsWithModelIdentity = /(?:^|[\s.!?…])(?:אני|I(?:'m| am)?|I’m)\s+(?:מודל(?:\s+שפה)?|(?:an?\s+)?(?:AI|language)\s+model|בוט|chatbot|virtual\s+assistant|עוזר\s+וירטואלי)/i.test(text);
  const providerTrainingIdentity = /(?:NVIDIA|Gemini|Google|Cloudflare|Workers?\s*AI).{0,180}(?:model|training|trained|researchers?|provider|מודל|חוקרים|אומן(?:תי)?|נוצר(?:תי)?|פותח(?:תי)?)/i.test(text)
    || /(?:אומן(?:תי)?|נוצר(?:תי)?|פותח(?:תי)?|trained|created|developed)\s+(?:על[\s-]*ידי|by)\s+(?:חוקרי|researchers?|NVIDIA|Google|Gemini)/i.test(text);
  return !startsWithModelIdentity && !providerTrainingIdentity;
}

async function askGemini(body, env) {
  const payload = { contents: body.contents, generationConfig: { maxOutputTokens: ASSISTANT_MAX_OUTPUT_TOKENS } };
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
  } catch (e) { return { error: 'gemini request failed' }; }
  let data;
  try { data = await res.json(); } catch (e) { return { error: 'gemini returned an invalid response' }; }
  if (!res.ok) return { error: (data.error && data.error.message) || 'gemini error' };
  const content = data.candidates && data.candidates[0] && data.candidates[0].content;
  return content && isUsableAssistantContent(content) ? { content } : { error: 'gemini returned an unusable response' };
}

async function askNvidia(body, env) {
  if (!env.NVIDIA_API_KEY) return { error: 'nvidia not configured' };
  const messages = [];
  if (body.systemInstruction || body.googleSearch) {
    const systemInstruction = [body.systemInstruction, body.googleSearch ? 'Google Search was unavailable because this is the NVIDIA fallback. Do not claim to have searched the web and do not add an unverified place.' : ''].filter(Boolean).join(' ');
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push(...geminiToOpenAiMessages(body.contents));
  // `extra_body` is a wrapper the OpenAI *Python SDK* uses to merge extra fields
  // into the request when you can't pass them as named kwargs - it isn't a real
  // API field. Calling the HTTP API directly (as this does), those fields belong
  // at the top level of the JSON body instead, or NVIDIA rejects the whole
  // request with "Unsupported parameter(s): `extra_body`".
  const model = env.NVIDIA_MODEL || NVIDIA_MODEL;
  const payload = { model, messages, temperature: 0.2, top_p: 0.95, max_tokens: ASSISTANT_MAX_OUTPUT_TOKENS, stream: false };
  // `chat_template_kwargs` is a Nemotron-specific control. Sending it to
  // gpt-oss is unnecessary and can make an otherwise valid request fail.
  if (model.startsWith('nvidia/nemotron-')) payload.chat_template_kwargs = { enable_thinking: false };
  const tools = geminiToOpenAiTools(body.tools);
  if (tools.length) { payload.tools = tools; payload.tool_choice = 'auto'; }
  let res;
  try {
    res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${env.NVIDIA_API_KEY}` }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000),
    });
  } catch (e) { return { error: e && e.name === 'TimeoutError' ? 'nvidia request timed out' : 'nvidia request failed' }; }
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch (e) { return { error: `nvidia HTTP ${res.status}: ${raw.slice(0, 300) || 'invalid response'}` }; }
  if (!res.ok) return { error: (data.error && (data.error.message || data.error)) || data.detail || data.message || `nvidia HTTP ${res.status}` };
  const content = openAiToGeminiContent(data);
  return content && isUsableAssistantContent(content) ? { content } : { error: 'nvidia returned an unusable response' };
}

// Workers AI's own tool-calling shape is a bit simpler than OpenAI's - tools are
// flat {name, description, parameters} (no {type:'function', function:{...}}
// wrapper), and a returned tool call's arguments come back as an already-parsed
// object rather than a JSON string. These two small adapters exist only for that
// difference; the messages themselves reuse geminiToOpenAiMessages() unchanged.
function geminiToWorkersAiTools(tools) {
  return (tools || []).flatMap(group => (group.functionDeclarations || []).map(fn => ({
    name: fn.name,
    description: fn.description || '',
    parameters: openAiSchema(fn.parameters),
  })));
}
function workersAiToGeminiContent(data) {
  if (!data) return null;
  const parts = [];
  if (data.response) parts.push({ text: String(data.response) });
  for (const call of data.tool_calls || []) {
    if (!call || !call.name) continue;
    parts.push({ functionCall: { name: call.name, args: call.arguments || {} } });
  }
  return parts.length ? { role: 'model', parts } : null;
}
// Cloudflare Workers AI, called over plain HTTPS with the CF_API_TOKEN secret
// rather than a wrangler.toml [ai] binding - see worker.js's secrets comment
// for why. Tried first: fastest, and free up to the account's daily Workers AI
// allowance before any per-token cost.
async function askWorkersAi(body, env) {
  const messages = [];
  if (body.systemInstruction || body.googleSearch) {
    const systemInstruction = [body.systemInstruction, body.googleSearch ? 'Google Search was unavailable on this provider. Do not claim to have searched the web and do not add an unverified place.' : ''].filter(Boolean).join(' ');
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push(...geminiToOpenAiMessages(body.contents));
  const options = { messages, max_tokens: ASSISTANT_MAX_OUTPUT_TOKENS };
  const tools = geminiToWorkersAiTools(body.tools);
  if (tools.length) options.tools = tools;
  let json;
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${WORKERS_AI_MODEL}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
      signal: AbortSignal.timeout(20000),
    });
    json = await res.json();
  } catch (e) { return { error: (e && e.message) || 'workers ai request failed' }; }
  if (!json || !json.success) return { error: (json && json.errors && json.errors[0] && json.errors[0].message) || 'workers ai request failed' };
  const content = workersAiToGeminiContent(json.result);
  return content && isUsableAssistantContent(content) ? { content } : { error: 'workers ai returned an unusable response' };
}

// POST /api/chat {contents, tools?, systemInstruction?} - a thin, stateless relay
// to an LLM (adds any API key server-side, since it can't live in the browser).
// All conversation state and tool-call execution is owned and looped by the
// client (see index.html's askAssistant()) - this route never stores anything
// between requests, so every call is self-contained and scoped only to its sender.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.CF_API_TOKEN && !env.GEMINI_API_KEY && !env.NVIDIA_API_KEY) return jsonResponse({ error: 'not configured' }, 500);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (isRateLimited(ip)) return jsonResponse({ error: 'rate limited' }, 429);

  const body = await readJsonBody(request);
  if (!body || !Array.isArray(body.contents) || !body.contents.length) return jsonResponse({ error: 'missing contents' }, 400);

  // Gemini is the only configured provider with Google Search. A request that
  // requires current recommendations therefore uses Gemini -> NVIDIA. Workers
  // AI is intentionally not used for this fallback: it cannot search the web
  // and its small first-line model can turn a useful search request into a
  // low-quality generic reply. Ordinary chat remains Workers -> Gemini -> NVIDIA.
  if (body.googleSearch) {
    const gemini = env.GEMINI_API_KEY ? await askGemini(body, env) : { error: 'gemini not configured' };
    if (gemini.content) return jsonResponse({ content: gemini.content, provider: 'gemini' });
    const nvidia = env.NVIDIA_API_KEY ? await askNvidia(body, env) : { error: 'nvidia not configured' };
    if (nvidia.content) return jsonResponse({ content: nvidia.content, provider: 'nvidia', fallback: 'gemini' });
    return jsonResponse({ error: `Gemini: ${gemini.error}; NVIDIA: ${nvidia.error}` }, 500);
  }

  let workersAi = { error: 'workers ai not attempted' };
  let gemini = { error: 'gemini not attempted' };

  workersAi = env.CF_API_TOKEN ? await askWorkersAi(body, env) : { error: 'workers ai not configured' };
  if (workersAi.content) return jsonResponse({ content: workersAi.content, provider: 'workers-ai' });

  gemini = env.GEMINI_API_KEY ? await askGemini(body, env) : { error: 'gemini not configured' };
  if (gemini.content) return jsonResponse({ content: gemini.content, provider: 'gemini', fallback: 'workers-ai' });

  if (env.NVIDIA_API_KEY) {
    const nvidia = await askNvidia(body, env);
    if (nvidia.content) return jsonResponse({ content: nvidia.content, provider: 'nvidia', fallback: 'gemini' });
    return jsonResponse({ error: `Workers AI: ${workersAi.error}; Gemini: ${gemini.error}; NVIDIA: ${nvidia.error}` }, 500);
  }
  return jsonResponse({ error: `Workers AI: ${workersAi.error}; Gemini: ${gemini.error}` }, 500);
}
