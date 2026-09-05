// Shared helpers for the Pages Functions in this directory. The leading
// underscore keeps this file out of Pages' own routing - it's imported, never
// served as a route.
//
// Every route here is stateless: nothing is stored between requests, each one is
// handled independently, using only secrets the browser could never safely hold.
//
// Required secrets (Pages project → Settings → Environment variables, Production):
//   GOOGLE_CLIENT_SECRET - for /api/google/exchange and /api/google/refresh
//   GEMINI_API_KEY       - for /api/chat
// Routes that need one degrade to a clear {error:"not configured"} until it's set.

export const GOOGLE_CLIENT_ID = '297437869958-gvh093f0s50ti02t8l7bg4dbo858g38h.apps.googleusercontent.com'; // public, not a secret - kept in sync with index.html's copy
export const GEMINI_MODEL = 'gemini-3.6-flash';
export const NVIDIA_MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';

export function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
}

export function corsResponse() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  } });
}

export async function readJsonBody(request) {
  try { return await request.json(); } catch (e) { return null; }
}

// NVIDIA's hosted endpoint is OpenAI-compatible, while the browser keeps its
// conversation in Gemini's format. These adapters keep the provider switch
// server-side and preserve the assistant's existing tool-calling contract.
function openAiSchema(schema) {
  schema = schema || {};
  const out = {};
  if (schema.type) out.type = String(schema.type).toLowerCase();
  if (schema.description) out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (schema.properties) {
    out.properties = {};
    Object.keys(schema.properties).forEach(k => { out.properties[k] = openAiSchema(schema.properties[k]); });
  }
  if (Array.isArray(schema.required)) out.required = schema.required;
  if (schema.items) out.items = openAiSchema(schema.items);
  return out;
}

export function geminiToOpenAiMessages(contents) {
  const messages = [];
  const pendingCalls = new Map();
  let callNumber = 0;
  for (const turn of contents || []) {
    const parts = Array.isArray(turn.parts) ? turn.parts : [];
    const responses = parts.filter(p => p && p.functionResponse).map(p => p.functionResponse);
    if (responses.length) {
      for (const response of responses) {
        const name = response.name || 'tool';
        const queue = pendingCalls.get(name) || [];
        const id = queue.shift() || `call_${++callNumber}`;
        pendingCalls.set(name, queue);
        messages.push({ role: 'tool', tool_call_id: id, content: JSON.stringify(response.response || {}) });
      }
      continue;
    }
    const role = turn.role === 'model' ? 'assistant' : 'user';
    const text = parts.filter(p => p && p.text).map(p => String(p.text)).join('\n');
    const toolCalls = [];
    for (const part of parts) {
      if (!part || !part.functionCall || !part.functionCall.name) continue;
      const name = part.functionCall.name;
      const id = `call_${++callNumber}`;
      const queue = pendingCalls.get(name) || [];
      queue.push(id);
      pendingCalls.set(name, queue);
      toolCalls.push({ id, type: 'function', function: { name, arguments: JSON.stringify(part.functionCall.args || {}) } });
    }
    if (text || toolCalls.length) {
      const message = { role, content: text || null };
      if (toolCalls.length) message.tool_calls = toolCalls;
      messages.push(message);
    }
  }
  return messages;
}

export function geminiToOpenAiTools(tools) {
  return (tools || []).flatMap(group => (group.functionDeclarations || []).map(fn => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description || '',
      parameters: openAiSchema(fn.parameters),
    },
  })));
}

export function openAiToGeminiContent(data) {
  const message = data && data.choices && data.choices[0] && data.choices[0].message;
  if (!message) return null;
  const parts = [];
  if (message.content) parts.push({ text: String(message.content) });
  for (const call of message.tool_calls || []) {
    if (!call.function || !call.function.name) continue;
    let args = {};
    try { args = JSON.parse(call.function.arguments || '{}'); } catch (e) { args = {}; }
    parts.push({ functionCall: { name: call.function.name, args } });
  }
  return parts.length ? { role: 'model', parts } : null;
}

// Shared by /api/google/exchange and /api/google/refresh - both just POST to
// Google's token endpoint with different grant types and return what Google says.
export async function googleTokenRequest(params) {
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
