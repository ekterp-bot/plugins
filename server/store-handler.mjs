import { createClient } from '@supabase/supabase-js';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { STORE_ALLOWED_ORIGINS, STORE_MAX_BODY_BYTES, STORE_PRICE_CURRENCIES, getStoreConfig, cookieNames } from './store-config.mjs';

const AUTH_OPTIONS = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_ID = /^[a-z][a-z0-9_-]{0,63}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const INVITE_FIELDS = 'id,product_id,intended_email,expires_at,created_by,created_at,revoked_at,revoked_by,redeemed_at,redeemed_by';
const PUBLIC_RELEASE_FIELDS = 'id,product_id,version,coverage_major,platform,format,channel,artifact_kind,status,file_size,sha256,release_notes,installation_notes,signing_status,approved_for_distribution,created_at';
const PRODUCT_FIELDS = ['id', 'name', 'description', 'status', 'regular_price_minor', 'promotional_price_minor', 'currency', 'checkout_price_id'];
const OPS = new Map([
  ['session', 'GET'], ['auth-start', 'POST'], ['auth-verify', 'POST'], ['logout', 'POST'],
  ['library', 'GET'], ['redeem', 'POST'], ['download', 'POST'], ['admin', 'GET'],
  ['admin-product', 'POST'], ['admin-invite', 'POST'], ['admin-revoke-invite', 'POST'],
  ['admin-release', 'POST'], ['admin-export', 'GET'],
]);

class StoreError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
const invalid = () => new StoreError(400, 'INVALID_REQUEST', 'Check the submitted details and try again.');
const unavailable = () => new StoreError(503, 'STORE_UNAVAILABLE', 'The account service is temporarily unavailable. Please try again.');
const authRequired = () => new StoreError(401, 'AUTH_REQUIRED', 'Sign in with your verified email to continue.');
const fail = (condition) => { if (!condition) throw invalid(); };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const boundedText = (value, max, min = 0) => typeof value === 'string' && value.length >= min && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);

function allowFields(data, names) {
  fail(data && typeof data === 'object' && !Array.isArray(data));
  fail(Object.keys(data).every(key => names.includes(key)));
}
function email(value) {
  fail(typeof value === 'string');
  const normalized = value.trim().toLowerCase();
  fail(normalized.length <= 254 && /^[^\s@\u0000-\u001f]+@[^\s@\u0000-\u001f]+\.[^\s@\u0000-\u001f]+$/.test(normalized));
  return normalized;
}
function uuid(value) { fail(typeof value === 'string' && UUID.test(value)); return value; }
function productId(value) { fail(typeof value === 'string' && PRODUCT_ID.test(value)); return value; }
function exactEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function parseCookies(header) {
  if (!header) return new Map();
  if (header.length > 16384) throw invalid();
  const result = new Map();
  for (const part of header.split(';')) {
    const equals = part.indexOf('=');
    if (equals < 1) continue;
    const key = part.slice(0, equals).trim();
    // Reject ambiguous duplicate authentication cookies rather than trusting order.
    if (result.has(key) && /hex-store-(?:access|refresh|csrf)$/.test(key)) throw invalid();
    result.set(key, part.slice(equals + 1).trim());
  }
  return result;
}
function setCookie(ctx, name, value, age) {
  ctx.headers.append('Set-Cookie', `${name}=${value}; Path=/; Max-Age=${Math.max(0, Math.floor(age))}; HttpOnly; SameSite=Lax${ctx.origin.startsWith('https://') ? '; Secure' : ''}`);
}
function clearSession(ctx) {
  setCookie(ctx, ctx.names.access, '', 0); setCookie(ctx, ctx.names.refresh, '', 0);
}
function saveSession(ctx, session) {
  if (!session?.access_token || !session?.refresh_token) throw unavailable();
  // Keep the expired access cookie so getUser can reject it and the server can
  // refresh using the HttpOnly token. Auth's session limits remain authoritative.
  setCookie(ctx, ctx.names.access, session.access_token, 30 * 86400);
  setCookie(ctx, ctx.names.refresh, session.refresh_token, 30 * 86400);
}
function csrf(ctx, rotate = false) {
  let value = ctx.cookies.get(ctx.names.csrf);
  if (rotate || !TOKEN.test(value || '')) {
    value = randomBytes(32).toString('base64url');
    setCookie(ctx, ctx.names.csrf, value, 86400);
  }
  return value;
}
function respond(ctx, data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: ctx.headers });
}
async function jsonBody(request) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type') || '')) {
    throw new StoreError(415, 'JSON_REQUIRED', 'Submit a JSON request.');
  }
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > STORE_MAX_BODY_BYTES)) {
    throw new StoreError(413, 'REQUEST_TOO_LARGE', 'The request is too large.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw invalid();
  let size = 0; const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > STORE_MAX_BODY_BYTES) {
        await reader.cancel();
        throw new StoreError(413, 'REQUEST_TOO_LARGE', 'The request is too large.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    fail(data && typeof data === 'object' && !Array.isArray(data));
    return data;
  } catch (error) { if (error instanceof StoreError) throw error; throw invalid(); }
}
async function checked(query) {
  const result = await query;
  if (result.error) throw unavailable();
  return result.data;
}
export async function readAllStoreRows(makeQuery, { pageSize = 500, maxRows = 20000 } = {}) {
  const rows = []; let total;
  while (true) {
    const result = await makeQuery(rows.length, Math.min(rows.length + pageSize, maxRows) - 1);
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count < 0) throw unavailable();
    if (result.count > maxRows) throw new StoreError(409, 'EXPORT_REQUIRES_PAGING', 'The record limit was reached. Ask the operator for a paged export.');
    if (total !== undefined && result.count !== total) throw new StoreError(409, 'RECORDS_CHANGED', 'Records changed during this request. Please retry.');
    total = result.count;
    rows.push(...result.data);
    if (rows.length === total) return rows;
    if (!result.data.length || rows.length > total) throw unavailable();
    // Advance by the returned count, not the requested count. This also works
    // when the provider's row cap is configured below our requested page size.
  }
}
function hmac(ctx, namespace, value) {
  return createHmac('sha256', ctx.config.serviceKey).update(`${namespace}\0${value}`).digest('hex');
}
function inviteHash(ctx, code) {
  // Pin INVITE_CODE_PEPPER before inviting testers. With the namespaced service
  // key fallback, service-key rotation invalidates unused invites unless the old
  // derived pepper is preserved. Existing permanent entitlements are unaffected.
  const pepper = ctx.config.invitePepper || hmac(ctx, 'hex-store/invitation-pepper/v1', '');
  return createHmac('sha256', pepper).update(code).digest('hex');
}
async function rate(ctx, namespace, identity, limit, seconds) {
  const data = await checked(ctx.db.rpc('store_rate_limit', {
    p_key: `${namespace}:${hmac(ctx, 'hex-store/rate-limit/v1', identity)}`,
    p_limit: limit, p_window_seconds: seconds,
  }));
  if (!data?.allowed) throw new StoreError(429, 'TOO_MANY_REQUESTS', 'Please wait before trying again.', data?.retry_after_seconds || seconds);
}
async function publicRate(ctx, op, address) {
  // Browser-supplied forwarded IP headers are not trusted. Until the adapter has
  // an authenticated client-IP channel, this intentionally shared bucket can
  // over-throttle a preview; it cannot be bypassed by spoofing an IP header.
  await rate(ctx, `${op}-ip`, 'shared-preview-ingress', op === 'auth-start' ? 20 : 60, 600);
  await rate(ctx, `${op}-email`, address, op === 'auth-start' ? 3 : 10, 600);
}
function verifiedSessionId(token, user) {
  // Called only AFTER the Auth server validates this exact JWT with getUser.
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (claims.sub !== user.id || !UUID.test(claims.session_id || '')) return null;
    return claims.session_id;
  } catch { return null; }
}
async function authenticate(ctx) {
  let accessToken = ctx.cookies.get(ctx.names.access);
  const refreshToken = ctx.cookies.get(ctx.names.refresh);
  if (!accessToken && !refreshToken) return null;
  if ((accessToken?.length || 0) > 8192 || (refreshToken?.length || 0) > 4096) { clearSession(ctx); return null; }
  let result = accessToken ? await ctx.auth.auth.getUser(accessToken) : null;
  if (result?.error && (result.error.status >= 500 || result.error.name === 'AuthRetryableFetchError')) throw unavailable();
  if ((!result || result.error || !result.data?.user) && refreshToken) {
    const refreshed = await ctx.auth.auth.refreshSession({ refresh_token: refreshToken });
    if (refreshed.error && (refreshed.error.status >= 500 || refreshed.error.name === 'AuthRetryableFetchError')) throw unavailable();
    if (refreshed.error || !refreshed.data?.session) { clearSession(ctx); return null; }
    accessToken = refreshed.data.session.access_token;
    result = await ctx.auth.auth.getUser(accessToken);
    if (result.error && (result.error.status >= 500 || result.error.name === 'AuthRetryableFetchError')) throw unavailable();
    if (!result.error && result.data?.user) saveSession(ctx, refreshed.data.session);
  }
  const user = result?.data?.user;
  if (result?.error || !user?.email || !user.email_confirmed_at || user.is_anonymous) { clearSession(ctx); return null; }
  const sessionId = verifiedSessionId(accessToken, user);
  if (!sessionId || !(await checked(ctx.db.rpc('store_session_valid', { p_user_id: user.id, p_session_id: sessionId })))) {
    clearSession(ctx); return null;
  }
  return { id: user.id, email: user.email, accessToken };
}
async function isAdmin(ctx, user) {
  if (!user) return false;
  const data = await checked(ctx.db.from('store_admins').select('user_id').eq('user_id', user.id).maybeSingle());
  return !!data;
}
function safeUser(user) { return user ? { id: user.id, email: user.email } : null; }
async function mutation(ctx, rpc, args, failure = 'The change could not be saved. Check the details and try again.', failureCode = 'CHANGE_UNAVAILABLE', failureStatus = 400) {
  const result = await ctx.db.rpc(rpc, args);
  if (result.error) {
    if (['P0001', '22023', '22P02', '23502', '23503', '23505', '23514', '22007', '22008', '22003'].includes(result.error.code)) {
      throw new StoreError(failureStatus, failureCode, failure);
    }
    if (result.error.code === '42501') throw new StoreError(403, 'ADMIN_REQUIRED', 'Owner access is required.');
    throw unavailable();
  }
  return result.data;
}
async function library(ctx, user) {
  const entitlements = await readAllStoreRows((from, to) => ctx.db.from('store_entitlements').select('*', { count: 'exact' }).eq('user_id', user.id).order('granted_at', { ascending: false }).order('id').range(from, to));
  if (!entitlements.length) return { entitlements: [] };
  const ids = [...new Set(entitlements.map(item => item.product_id))];
  const products = []; const releases = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const group = ids.slice(offset, offset + 50);
    const [productPage, releasePage] = await Promise.all([
      readAllStoreRows((from, to) => ctx.db.from('store_products').select('id,name,description,status', { count: 'exact' }).in('id', group).order('id').range(from, to)),
      readAllStoreRows((from, to) => ctx.db.from('store_releases').select(PUBLIC_RELEASE_FIELDS, { count: 'exact' }).in('product_id', group).eq('status', 'published').eq('approved_for_distribution', true).order('created_at', { ascending: false }).order('id').range(from, to)),
    ]);
    products.push(...productPage); releases.push(...releasePage);
    if (releases.length > 20000) throw new StoreError(409, 'LIBRARY_REQUIRES_PAGING', 'This library needs a paged view. Contact support.');
  }
  const productMap = new Map(products.map(product => [product.id, product]));
  return { entitlements: entitlements.map(grant => ({
    ...grant, grant_type: grant.source, product: productMap.get(grant.product_id),
    releases: releases.filter(release => release.product_id === grant.product_id && release.coverage_major === grant.coverage_major
      && productMap.get(grant.product_id)?.status !== 'unavailable'
      && (release.artifact_kind === 'test' || release.signing_status === 'verified')).map(release => ({ ...release, notes: release.release_notes })),
  })) };
}
async function adminData(ctx) {
  // Fetch all pages for exports; no silent PostgREST 1,000-row truncation.
  const rows = (table, fields, order) => readAllStoreRows((from, to) => ctx.db.from(table).select(fields, { count: 'exact' }).order(order, { ascending: false }).order('id').range(from, to));
  const [products, invitations, entitlements, releases, downloads, audit] = await Promise.all([
    rows('store_products', '*', 'created_at'), rows('store_invites', INVITE_FIELDS, 'created_at'),
    rows('store_entitlements', '*', 'granted_at'), rows('store_releases', '*', 'created_at'),
    rows('store_download_events', '*', 'authorized_at'), rows('store_admin_audit', '*', 'created_at'),
  ]);
  return { products, invitations, entitlements, releases, downloads, audit };
}
async function saveProduct(ctx, user, data) {
  allowFields(data, PRODUCT_FIELDS);
  if (!own(data, 'id')) {
    fail(boundedText(data.name, 120, 1) && data.name.trim());
    let slug = data.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!/^[a-z]/.test(slug)) slug = `plugin-${slug}`;
    data.id = slug.slice(0, 64).replace(/-$/g, '');
    if (await checked(ctx.db.from('store_products').select('id').eq('id', data.id).maybeSingle())) {
      throw new StoreError(409, 'PRODUCT_EXISTS', 'A product with that name already exists. Edit the existing product.');
    }
  }
  productId(data.id);
  if (own(data, 'name')) fail(boundedText(data.name, 120, 1) && data.name.trim());
  if (own(data, 'description')) fail(boundedText(data.description, 8000));
  if (own(data, 'status')) fail(['prelaunch', 'private_beta', 'unavailable'].includes(data.status));
  for (const key of ['regular_price_minor', 'promotional_price_minor']) {
    if (own(data, key)) fail(data[key] === null || (Number.isSafeInteger(data[key]) && data[key] >= 0 && data[key] <= 100000000));
  }
  if (own(data, 'currency')) fail(STORE_PRICE_CURRENCIES.includes(data.currency));
  if (own(data, 'checkout_price_id')) fail(data.checkout_price_id === null || boundedText(data.checkout_price_id, 200, 1));
  return mutation(ctx, 'store_admin_product', { p_actor: user.id, p_data: data });
}
function validateReleaseStatus(data) {
  // Artifact bytes, approval and signing provenance enter through the trusted
  // operator uploader. Browser admins can only change existing availability.
  allowFields(data, ['id', 'status']);
  uuid(data.id);
  fail(['draft', 'published', 'withdrawn'].includes(data.status));
}

export async function handleStoreRequest(request) {
  const ctx = { headers: new Headers({
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
    'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie, Origin',
  }) };
  try {
    const url = new URL(request.url);
    const op = url.searchParams.get('op') || 'session';
    if (!OPS.has(op)) throw new StoreError(404, 'NOT_FOUND', 'That account operation is unavailable.');
    if (url.searchParams.getAll('op').length > 1 || [...url.searchParams.keys()].some(key => key !== 'op')) throw invalid();
    if (request.method !== OPS.get(op)) {
      ctx.headers.set('Allow', OPS.get(op));
      throw new StoreError(405, 'METHOD_NOT_ALLOWED', 'That request method is unavailable.');
    }
    ctx.origin = request.headers.get('Origin') || (request.method === 'GET' ? url.origin : '');
    if (!STORE_ALLOWED_ORIGINS.includes(ctx.origin)) throw new StoreError(403, 'ORIGIN_REJECTED', 'Open the account page on the approved website.');
    const fetchSite = request.headers.get('Sec-Fetch-Site');
    if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) throw new StoreError(403, 'ORIGIN_REJECTED', 'Open the account page on the approved website.');
    ctx.names = cookieNames(ctx.origin); ctx.cookies = parseCookies(request.headers.get('Cookie'));
    if (request.method === 'POST') {
      const submitted = request.headers.get('X-CSRF-Token');
      if (!TOKEN.test(submitted || '') || !exactEqual(submitted, ctx.cookies.get(ctx.names.csrf))) {
        throw new StoreError(403, 'CSRF_REJECTED', 'Refresh the account page and try again.');
      }
    }
    const data = request.method === 'POST' ? await jsonBody(request) : null;
    ctx.config = getStoreConfig();
    // Separate clients: auth calls must never replace the service-role DB token.
    ctx.db = createClient(ctx.config.url, ctx.config.serviceKey, { auth: AUTH_OPTIONS });
    ctx.auth = createClient(ctx.config.url, ctx.config.authKey, { auth: AUTH_OPTIONS });
    if (op === 'auth-start') {
      allowFields(data, ['email']); const address = email(data.email);
      await publicRate(ctx, op, address);
      const result = await ctx.auth.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
      if (result.error && (result.error.status >= 500 || result.error.name === 'AuthRetryableFetchError')) throw unavailable();
      return respond(ctx, { ok: true, message: 'If this address can receive a sign-in code, check its inbox.' }, 202);
    }
    if (op === 'auth-verify') {
      allowFields(data, ['email', 'token']); const address = email(data.email);
      fail(typeof data.token === 'string' && /^\d{6,10}$/.test(data.token));
      await publicRate(ctx, op, address);
      const result = await ctx.auth.auth.verifyOtp({ email: address, token: data.token, type: 'email' });
      if (result.error && (result.error.status >= 500 || result.error.name === 'AuthRetryableFetchError')) throw unavailable();
      if (result.error || !result.data?.session) throw new StoreError(400, 'CODE_UNAVAILABLE', 'That code could not be verified. Request a fresh code and try again.');
      const session = result.data.session;
      ctx.cookies.set(ctx.names.access, session.access_token); ctx.cookies.set(ctx.names.refresh, session.refresh_token);
      const user = await authenticate(ctx);
      if (!user) throw authRequired();
      saveSession(ctx, session);
      return respond(ctx, { user: safeUser(user), isAdmin: await isAdmin(ctx, user), csrfToken: csrf(ctx, true) });
    }
    const user = await authenticate(ctx);
    if (op === 'session') return respond(ctx, { user: safeUser(user), isAdmin: await isAdmin(ctx, user), csrfToken: csrf(ctx) });
    if (op === 'logout') {
      allowFields(data, []);
      if (user) {
        const result = await ctx.db.auth.admin.signOut(user.accessToken, 'local');
        if (result.error) throw unavailable();
      }
      clearSession(ctx);
      return respond(ctx, { ok: true, csrfToken: csrf(ctx, true) });
    }
    if (!user) throw authRequired();
    await rate(ctx, request.method === 'POST' ? 'account-mutation' : 'account-read', user.id, request.method === 'POST' ? 60 : 120, 60);
    if (op === 'library') return respond(ctx, await library(ctx, user));
    if (op === 'redeem') {
      allowFields(data, ['code']);
      await rate(ctx, 'invite-redeem', user.id, 10, 600);
      if (typeof data.code !== 'string' || !/^HEX-[A-Za-z0-9_-]{32}$/.test(data.code.trim())) {
        throw new StoreError(400, 'INVITE_UNAVAILABLE', 'This invitation is unavailable for this account.');
      }
      const result = await mutation(ctx, 'store_redeem', { p_user_id: user.id, p_code_hash: inviteHash(ctx, data.code.trim()) }, 'This invitation is unavailable for this account.', 'INVITE_UNAVAILABLE');
      return respond(ctx, { entitlement: { ...result.entitlement, grant_type: result.entitlement.source }, alreadyRedeemed: result.existing });
    }
    if (op === 'download') {
      allowFields(data, ['release_id']); uuid(data.release_id);
      await rate(ctx, 'download-links', user.id, 30, 60);
      const authorized = await mutation(ctx, 'store_authorize_download', { p_user_id: user.id, p_release_id: data.release_id }, 'This download is unavailable for this account.', 'DOWNLOAD_UNAVAILABLE', 403);
      const seconds = Math.min(60, Math.floor((Date.parse(authorized.expires_at) - Date.now()) / 1000));
      if (seconds < 1) throw unavailable();
      const signed = await ctx.db.storage.from(authorized.bucket).createSignedUrl(authorized.object_key, seconds, { download: true });
      if (signed.error || !signed.data?.signedUrl) throw unavailable();
      return respond(ctx, { url: signed.data.signedUrl, expiresAt: authorized.expires_at });
    }
    if (!(await isAdmin(ctx, user))) throw new StoreError(403, 'ADMIN_REQUIRED', 'Owner access is required.');
    if (op === 'admin' || op === 'admin-export') {
      await rate(ctx, 'admin-read', user.id, 20, 60);
      const snapshot = await adminData(ctx);
      if (op === 'admin-export') {
        const counts = Object.fromEntries(Object.entries(snapshot).map(([key, rows]) => [key, rows.length + (key === 'audit' ? 1 : 0)]));
        if (counts.audit > 20000) throw new StoreError(409, 'EXPORT_REQUIRES_PAGING', 'The record limit was reached. Ask the operator for a paged export.');
        const audit = await mutation(ctx, 'store_record_export', { p_actor: user.id, p_counts: counts });
        snapshot.audit.unshift(audit);
        ctx.headers.set('Content-Disposition', `attachment; filename="hex-store-export-${new Date().toISOString().slice(0, 10)}.json"`);
        return respond(ctx, { exportedAt: new Date().toISOString(), exportAuditId: audit.id, ...snapshot });
      }
      return respond(ctx, snapshot);
    }
    if (op === 'admin-product') return respond(ctx, { product: await saveProduct(ctx, user, data) });
    if (op === 'admin-invite') {
      allowFields(data, ['product_id', 'email', 'expires_at']); productId(data.product_id);
      const address = data.email === null || data.email === undefined || data.email === '' ? null : email(data.email);
      const expiry = data.expires_at === undefined || data.expires_at === null || data.expires_at === ''
        ? Date.now() + 30 * 86400000 : typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : NaN;
      fail(Number.isFinite(expiry) && expiry > Date.now() && expiry <= Date.now() + 366 * 86400000);
      const code = `HEX-${randomBytes(24).toString('base64url')}`;
      const invitation = await mutation(ctx, 'store_create_invite', { p_actor: user.id, p_code_hash: inviteHash(ctx, code), p_product_id: data.product_id, p_email: address, p_expires_at: new Date(expiry).toISOString() });
      return respond(ctx, { invitation, code }, 201);
    }
    if (op === 'admin-revoke-invite') {
      allowFields(data, ['id']); uuid(data.id);
      return respond(ctx, { invitation: await mutation(ctx, 'store_revoke_invite', { p_actor: user.id, p_id: data.id }, 'Only an unused invitation can be revoked.') });
    }
    if (op === 'admin-release') {
      validateReleaseStatus(data);
      return respond(ctx, { release: await mutation(ctx, 'store_admin_release', { p_actor: user.id, p_data: data }) });
    }
    throw new StoreError(404, 'NOT_FOUND', 'That account operation is unavailable.');
  } catch (error) {
    const safe = error instanceof StoreError ? error : unavailable();
    if (safe.retryAfter) ctx.headers.set('Retry-After', String(safe.retryAfter));
    return respond(ctx, { ok: false, code: safe.code, error: safe.message, message: safe.message }, safe.status);
  }
}
