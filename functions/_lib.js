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

export function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function readJsonBody(request) {
  try { return await request.json(); } catch (e) { return null; }
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
