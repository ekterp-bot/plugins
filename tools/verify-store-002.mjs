// Focused local HTTP checks against retained, synthetic STORE-001 customers.
// No emails sent; no new administrators, invitations or permanent grants created.
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getStoreConfig } from '../server/store-config.mjs';
const config = getStoreConfig();
const db = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const base = 'http://localhost:4176';
const folder = new URL('../artifacts/store-002/', import.meta.url);
const state = JSON.parse(await readFile(new URL('../artifacts/store-001/test-sessions.json', import.meta.url), 'utf8'));
const checks = [];
function check(ok, name) { checks.push({ name, passed: !!ok }); if (!ok) throw new Error(`Failed: ${name}`); }
async function call(fixture, op, body) {
  fixture.cookies ||= {};
  const headers = { Origin: base, Cookie: Object.entries(fixture.cookies).map(([k,v]) => `${k}=${v}`).join('; ') };
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = fixture.csrf || ''; }
  const r = await fetch(`${base}/api/store?op=${op}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (const item of r.headers.getSetCookie()) { const pair = item.split(';')[0]; const eq = pair.indexOf('='); fixture.cookies[pair.slice(0,eq)] = pair.slice(eq+1); }
  const data = await r.json(); if (data.csrfToken) fixture.csrf = data.csrfToken;
  return { status: r.status, data };
}
async function login(fixture) {
  // Only previously created synthetic addresses are used for generated test OTPs.
  if (!fixture.email.endsWith('@example.invalid')) throw new Error('Synthetic fixture required');
  fixture.cookies = {}; await call(fixture, 'session');
  const generated = await db.auth.admin.generateLink({ type: 'magiclink', email: fixture.email });
  if (generated.error) throw new Error('Fixture OTP generation failed');
  const loggedIn = await call(fixture, 'auth-verify', { email: fixture.email, token: generated.data.properties.email_otp });
  check(loggedIn.status === 200 && loggedIn.data.user.id === fixture.id && !loggedIn.data.isAdmin, 'Existing customer email-code login works without owner access');
}
try {
  const { customer, other } = state.fixtures;
  await login(customer); await login(other);
  const library = await call(customer, 'library');
  const nebula = library.data.entitlements?.find(g => g.product_id === 'nebula');
  check(library.status === 200 && nebula?.expires_at === null && nebula.coverage_major === 1, 'Existing invitation grant remains permanent');
  const fixture = nebula?.releases.find(r => r.artifact_kind === 'test');
  check(!!fixture, 'Approved harmless test release remains visible');
  check(!nebula.releases.some(r => r.artifact_kind === 'installer'), 'Held real installer is absent from customer library');
  check(!JSON.stringify(library.data).includes('approval_reference') && !JSON.stringify(library.data).includes('object_key'), 'Customer projection excludes operator evidence and storage keys');
  for (let i = 0; i < 3; i++) {
    const download = await call(customer, 'download', { release_id: fixture.id });
    check(download.status === 200, `Authorized test download ${i + 1} has no two-download cap`);
    if (i === 0) { const response = await fetch(download.data.url); const bytes = Buffer.from(await response.arrayBuffer()); check(response.ok && createHash('sha256').update(bytes).digest('hex') === fixture.sha256, 'Authorized signed test download bytes match release checksum'); }
  }
  check((await call(other, 'download', { release_id: fixture.id })).status === 403, 'Verified customer without entitlement cannot download');
  check((await call({}, 'download', { release_id: fixture.id })).status !== 200, 'Anonymous download denied');
  check((await call(customer, 'admin')).status === 403, 'Non-owner admin access denied');
  const staged = JSON.parse(await readFile(new URL('staged-release.json', folder), 'utf8'));
  const realDownload = await call(customer, 'download', { release_id: staged.id });
  check(realDownload.status === 403 && !realDownload.data.url, 'Entitled customer cannot authorize held real installer');
  const held = await db.from('store_releases').select('status,approved_for_distribution,fl_playback_reference,approval_reference').eq('id', staged.id).single();
  check(!held.error && held.data.status === 'draft' && !held.data.approved_for_distribution && held.data.fl_playback_reference === null && held.data.approval_reference === null, 'Real installer remains draft with both outstanding approvals absent');
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  await mkdir(folder, { recursive: true });
  await writeFile(new URL('http-checks.json', folder), JSON.stringify({ at: new Date().toISOString(), checks, passed: checks.filter(x => x.passed).length, outbound_email_tested: false }, null, 2));
  // Updated fixture sessions remain private, never stdout or committed evidence.
  await writeFile(new URL('test-sessions.json', folder), JSON.stringify({ customer: state.fixtures.customer, other: state.fixtures.other }));
  console.log(JSON.stringify({ passed: checks.filter(x => x.passed).length, failed: checks.filter(x => !x.passed).length }));
}
