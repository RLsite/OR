import { GOOGLE_CLIENT_ID, jsonResponse, readJsonBody, googleTokenRequest } from '../../_lib.js';

// POST /api/google/exchange {code} - exchanges a one-time authorization code (from
// the client's initCodeClient popup) for an access token + refresh token. Needs
// GOOGLE_CLIENT_SECRET, which is exactly why this runs server-side at all - Google
// requires it for the code->token exchange and the browser can't hold it. The
// refresh token goes back to the client to store (in localStorage, alongside the
// rest of this app's data, per its no-server-persistence design) so future access
// tokens can be renewed silently via /api/google/refresh instead of a popup.
export async function onRequestPost(context) {
  const { request, env } = context;
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
