import { GOOGLE_CLIENT_ID, jsonResponse, readJsonBody, googleTokenRequest } from '../../_lib.js';

// POST /api/google/refresh {refresh_token} - trades a stored refresh token for a
// fresh access token, silently (no popup). See exchange.js for where the refresh
// token first comes from.
export async function onRequestPost(context) {
  const { request, env } = context;
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
