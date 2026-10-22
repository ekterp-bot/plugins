'use strict';

// Node/Vercel adapter. Credentials remain in the server environment; the shared
// Fetch handler owns authentication, authorization and database mutations.
module.exports = async function store(request, response) {
  const { STORE_ALLOWED_ORIGINS, STORE_MAX_BODY_BYTES } = await import('../server/store-config.mjs');
  const securityHeaders = {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie, Origin',
  };
  for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
  function failure(status, code, message) { response.statusCode = status; response.end(JSON.stringify({ ok: false, code, error: message, message })); }
  try {
    if (!['GET', 'POST'].includes(request.method)) {
      response.setHeader('Allow', 'GET, POST'); return failure(405, 'METHOD_NOT_ALLOWED', 'That request method is unavailable.');
    }
    const host = request.headers?.host;
    // Match exact hosts against the configured origins; never trust forwarded
    // host/protocol headers or accept arbitrary preview domains.
    const siteOrigin = STORE_ALLOWED_ORIGINS.find(origin => new URL(origin).host === host);
    if (!siteOrigin) return failure(403, 'ORIGIN_REJECTED', 'Open the account page on the approved website.');
    const origin = request.headers.origin || (request.method === 'GET' ? siteOrigin : '');
    if (origin !== siteOrigin) return failure(403, 'ORIGIN_REJECTED', 'Open the account page on the approved website.');
    let body;
    if (request.method === 'POST') {
      const declared = request.headers['content-length'];
      if (declared !== undefined && (!/^\d+$/.test(String(declared)) || Number(declared) > STORE_MAX_BODY_BYTES)) return failure(413, 'REQUEST_TOO_LARGE', 'The request is too large.');
      if (request.body !== undefined) {
        body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
      } else {
        const chunks = []; let size = 0;
        for await (const chunk of request) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.length;
          if (size > STORE_MAX_BODY_BYTES) return failure(413, 'REQUEST_TOO_LARGE', 'The request is too large.');
          chunks.push(bytes);
        }
        body = Buffer.concat(chunks);
      }
      if (body.length > STORE_MAX_BODY_BYTES) return failure(413, 'REQUEST_TOO_LARGE', 'The request is too large.');
    }
    const incoming = new URL(request.url, siteOrigin);
    const headers = new Headers({ Origin: origin });
    for (const name of ['cookie', 'content-type', 'x-csrf-token', 'sec-fetch-site']) {
      const value = request.headers[name];
      if (typeof value === 'string') headers.set(name, value);
    }
    const { handleStoreRequest } = await import('../server/store-handler.mjs');
    const result = await handleStoreRequest(new Request(`${siteOrigin}/api/store${incoming.search}`, { method: request.method, headers, body }));
    if (!/^application\/json\b/i.test(result.headers.get('content-type') || '')) return failure(502, 'STORE_UNAVAILABLE', 'The account service is temporarily unavailable.');
    response.statusCode = result.status;
    for (const name of ['content-type', 'cache-control', 'pragma', 'referrer-policy', 'x-content-type-options', 'vary', 'allow', 'retry-after', 'content-disposition']) {
      const value = result.headers.get(name); if (value) response.setHeader(name, value);
    }
    const cookies = result.headers.getSetCookie();
    if (cookies.length) response.setHeader('Set-Cookie', cookies);
    response.end(await result.text());
  } catch {
    return failure(503, 'STORE_UNAVAILABLE', 'The account service is temporarily unavailable. Please try again.');
  }
};
