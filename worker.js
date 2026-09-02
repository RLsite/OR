// Cloudflare Worker entry point. This project is a static site (index.html etc,
// served via the [assets] binding configured in wrangler.toml) - this script's
// only job is to intercept the one route that needs real server-side logic and
// fall through to the static assets for everything else.
//
// (Earlier attempt: a Cloudflare Pages "functions/api/*.js" file. That's a
// Pages-only convention and is never invoked under this project's actual
// deployment model - a Worker with a static-assets binding, configured via
// wrangler.toml's [assets] block - so it silently 404'd. This is the version
// that actually runs.)

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
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/link-preview') return handleLinkPreview(request);
    return env.ASSETS.fetch(request);
  },
};
