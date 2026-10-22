// Dedicated preview integration checks. Secrets/session material are written only
// to ignored artifacts/store-001/test-sessions.json; never to stdout or reports.
// Run: node --env-file=.env.store tools/verify-store-integration.mjs prepare|exercise|expiry|browser-codes
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const base = 'http://localhost:4176';
const project = 'https://pujpznngwcgutujqgmkp.supabase.co';
const folder = new URL('../artifacts/store-001/', import.meta.url);
const statePath = new URL('test-sessions.json', folder);
const reportPath = new URL('http-integration-results.json', folder);
if (process.env.SUPABASE_URL !== project || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Dedicated preview credentials required');
const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const db = createClient(project, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: authOptions });
let state;
try { state = JSON.parse(await readFile(statePath, 'utf8')); }
catch { state = { runId: Date.now().toString(36), fixtures: {}, resources: {}, completed: [], checks: [], startedAt: new Date().toISOString() }; }
await mkdir(folder, { recursive: true });

async function save() {
  await writeFile(statePath, JSON.stringify(state, null, 2));
  await writeFile(reportPath, JSON.stringify({ startedAt: state.startedAt, updatedAt: new Date().toISOString(),
    environment: 'Dedicated Supabase preview + localhost API', projectId: 'pujpznngwcgutujqgmkp',
    checks: state.checks, passed: state.checks.filter(x => x.passed).length, cleanup: state.cleanup || null,
    limitations: ['Auth provider-generated OTPs verified through actual HTTP; no outbound email delivery tested.',
      'Only harmless text artifacts; no installer approval or plugin validation.', state.cleanup?.temporaryAdminMembership === 0
        ? 'Temporary fixture administrator membership removed; permanent fixture grants retained.'
        : 'Fixture ledger retained for recovery; temporary administrator must be removed after browser QA.'] }, null, 2));
}
async function check(ok, name, details = {}) {
  const result = { name, passed: !!ok, ...details };
  const prior = state.checks.findIndex(x => x.name === name);
  if (prior < 0) state.checks.push(result); else state.checks[prior] = result;
  await save();
  if (!ok) throw new Error(`CHECK_FAILED: ${name}`);
}
async function step(name, action) {
  if (state.completed.includes(name)) return;
  await action(); state.completed.push(name); await save();
  console.log(JSON.stringify({ completed: name, passed: state.checks.filter(x => x.passed).length }));
}
function tokenOf(fixture) { return fixture.cookies['hex-store-access']; }
function cookiesOf(fixture) { return Object.entries(fixture.cookies || {}).map(([k,v]) => `${k}=${v}`).join('; '); }
async function call(fixture, op, body, options = {}) {
  fixture.cookies ||= {};
  const headers = { Origin: options.origin || base, Cookie: cookiesOf(fixture) };
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; if (!options.noCsrf) headers['X-CSRF-Token'] = fixture.csrf || ''; }
  const response = await fetch(`${base}/api/store?op=${op}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookies = response.headers.getSetCookie();
  for (const entry of setCookies) {
    const [pair] = entry.split(';'); const equals = pair.indexOf('=');
    const name = pair.slice(0, equals); const value = pair.slice(equals + 1);
    if (/Max-Age=0(?:;|$)/i.test(entry)) delete fixture.cookies[name]; else fixture.cookies[name] = value;
  }
  const data = await response.json();
  if (data.csrfToken) fixture.csrf = data.csrfToken;
  return { status: response.status, data, setCookies,
    cacheControl: response.headers.get('cache-control'), disposition: response.headers.get('content-disposition') };
}
async function okay(fixture, op, body, expected = 200) {
  const result = await call(fixture, op, body);
  if (result.status !== expected) throw new Error(`HTTP_FAILURE: ${op} status=${result.status} code=${result.data?.code || 'none'}`);
  return result;
}
async function sdk(query, name) {
  const { data, error } = await query;
  if (error) throw new Error(`PROVIDER_FAILURE: ${name} code=${error.code || error.status || 'unknown'}`);
  return data;
}
async function invite(label, productId, options = {}) {
  if (!state.resources.invites) state.resources.invites = {};
  if (!state.resources.invites[label]) {
    const r = await okay(state.fixtures.admin, 'admin-invite', { product_id: productId, ...options }, 201);
    state.resources.invites[label] = r.data; await save();
  }
  return state.resources.invites[label];
}
async function prepare() {
  for (const name of ['admin','customer','other','raceA','raceB','revocation']) {
    await step(`login-${name}`, async () => {
      const fixture = state.fixtures[name] ||= { email: `store-validation-${state.runId}-${name.toLowerCase()}@example.invalid`, cookies: {} };
      await okay(fixture, 'session');
      const generated = await sdk(db.auth.admin.generateLink({ type: 'magiclink', email: fixture.email }), 'generate fixture OTP');
      fixture.id = generated.user.id; fixture.otp = generated.properties.email_otp; await save();
      const signedIn = await okay(fixture, 'auth-verify', { email: fixture.email, token: fixture.otp });
      fixture.id = signedIn.data.user.id;
      await check(!!tokenOf(fixture) && signedIn.data.user.email === fixture.email, `actual Auth OTP login ${name}`);
      await check(signedIn.setCookies.filter(x => /hex-store-(access|refresh)=/.test(x)).every(x => /HttpOnly/.test(x) && /SameSite=Lax/.test(x)), `HttpOnly session cookies ${name}`);
    });
  }
  console.log(JSON.stringify({ phase: 'prepared', administratorFixtureId: state.fixtures.admin.id,
    customerFixtureId: state.fixtures.customer.id, fixtureCount: Object.keys(state.fixtures).length,
    next: 'Trusted operator must bootstrap only administratorFixtureId with a temporary validation reason before exercise.' }));
}
async function exercise() {
  const { admin, customer, other, raceA, raceB, revocation } = state.fixtures;
  if (!admin?.id) throw new Error('Run prepare first');
  await step('access-controls', async () => {
    await check((await okay(admin, 'session')).data.isAdmin === true, 'verified temporary fixture administrator recognized');
    await check((await call(other, 'admin')).status === 403, 'customer admin GET denied');
    await check((await call(other, 'admin-product', { id: 'nebula', name: 'forbidden' })).status === 403, 'customer admin mutation denied');
    await check((await call(admin, 'admin-product', { id: 'nebula', name: 'forbidden' }, { noCsrf: true })).status === 403, 'missing CSRF denied');
    await check((await call(admin, 'admin-product', { id: 'nebula', name: 'forbidden' }, { origin: 'https://untrusted.invalid' })).status === 403, 'cross-origin mutation denied');
    await check((await call({}, 'library')).status === 401, 'anonymous library denied');
    const snapshot = await okay(admin, 'admin');
    await check(snapshot.cacheControl.includes('no-store'), 'account responses disable caching');
  });
  await step('products-and-draft-prices', async () => {
    const product = `store-test-${state.runId}`; const raceProduct = `store-race-${state.runId}`;
    state.resources.productId = product; state.resources.raceProductId = raceProduct; await save();
    for (const [id, name] of [[product,'STORE validation text fixture'],[raceProduct,'STORE concurrent invitation fixture']]) {
      await okay(admin, 'admin-product', { id, name: `${name} ${state.runId}`, description: 'Automated validation fixture, not a plugin sale.', status: 'private_beta', regular_price_minor: 9900, promotional_price_minor: 7900, currency: 'USD', checkout_price_id: 'draft-no-checkout' });
    }
    const snapshot = (await okay(admin, 'admin')).data;
    const saved = snapshot.products.find(x => x.id === product);
    await check(saved.regular_price_minor === 9900 && saved.promotional_price_minor === 7900 && saved.commerce_enabled === false, 'draft prices saved without enabling commerce');
    await check(snapshot.audit.some(x => x.action === 'product_saved' && x.target_id === product), 'admin price edits audited');
    await check((await call(admin, 'admin-product', { id: product, promotional_price_minor: 10000 })).status === 400, 'invalid promotional price rejected over HTTP');
  });
  await step('permanent-redemption', async () => {
    const code = await invite('permanent', state.resources.productId, { email: customer.email, expires_at: new Date(Date.now() + 20000).toISOString() });
    const redeemed = (await okay(customer, 'redeem', { code: code.code })).data;
    state.resources.entitlementId = redeemed.entitlement.id;
    await check(redeemed.entitlement.expires_at === null && redeemed.entitlement.coverage_major === 1 && redeemed.entitlement.maintenance_updates && redeemed.entitlement.computer_limit === 2, 'HTTP redemption creates permanent v1 maintenance grant');
    const retry = (await okay(customer, 'redeem', { code: code.code })).data;
    await check(retry.alreadyRedeemed && retry.entitlement.id === redeemed.entitlement.id, 'same-account code retry returns existing grant');
    const otherResult = await call(other, 'redeem', { code: code.code });
    await check(otherResult.status === 400 && otherResult.data.code === 'INVITE_UNAVAILABLE', 'same code denied generically to another account');
    const second = await invite('already-owned', state.resources.productId);
    await check((await call(customer, 'redeem', { code: second.code })).status === 400, 'different code cannot duplicate owned license');
    const untouched = await sdk(db.from('store_invites').select('redeemed_at').eq('id',second.invitation.id).single(), 'check unused invitation');
    await check(untouched.redeemed_at === null, 'duplicate ownership attempt leaves second invite unused');
    const library = (await okay(customer, 'library')).data;
    await check(library.entitlements.length === 1 && !JSON.stringify(library).includes('regular_price_minor'), 'customer library excludes draft prices');
    await check((await okay(other, 'library')).data.entitlements.length === 0, 'customer ownership isolated');
  });
  await step('invitation-denials', async () => {
    const bound = await invite('wrong-email',state.resources.raceProductId,{email:customer.email});
    const revoked = await invite('revoked',state.resources.raceProductId);
    await okay(admin,'admin-revoke-invite',{id:revoked.invitation.id});
    // Allow for clock skew and network latency when creating a deliberately
    // short-lived invitation, then wait past its real stored expiry.
    const expired = await invite('expired',state.resources.raceProductId,{expires_at:new Date(Date.now()+8000).toISOString()});
    await delay(Math.max(0,Date.parse(expired.invitation.expires_at)+2000-Date.now()));
    for (const [name, code] of [['email mismatch',bound.code],['revoked',revoked.code],['expired',expired.code],['unknown','HEX-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA']]) {
      const denied=await call(other,'redeem',{code});
      await check(denied.status===400 && denied.data.code==='INVITE_UNAVAILABLE',`${name} invitation denied generically over HTTP`);
    }
  });
  await step('concurrent-single-use', async () => {
    const invitation=await invite('race',state.resources.raceProductId);
    const results=await Promise.all([call(raceA,'redeem',{code:invitation.code}),call(raceB,'redeem',{code:invitation.code})]);
    await check(results.filter(x=>x.status===200).length===1 && results.filter(x=>x.status===400 && x.data.code==='INVITE_UNAVAILABLE').length===1,'concurrent different accounts yield exactly one winner');
    const winner=results[0].status===200?raceA:raceB;
    state.resources.raceWinnerId=winner.id;
    const retries=await Promise.all([call(winner,'redeem',{code:invitation.code}),call(winner,'redeem',{code:invitation.code})]);
    await check(retries.every(x=>x.status===200 && x.data.alreadyRedeemed),'concurrent winner retries are idempotent');
    const grants=await sdk(db.from('store_entitlements').select('id').eq('product_id',state.resources.raceProductId),'count race grants');
    const uses=await sdk(db.from('store_redemptions').select('id').eq('invite_id',invitation.invitation.id),'count race redemptions');
    await check(grants.length===1 && uses.length===1,'concurrent redemption durable counts remain one');
  });
  await step('private-test-artifact', async () => {
    const bytes=Buffer.from(`STORE-001 harmless text validation fixture ${state.runId}\nNo plugin binary or installer.\n`);
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const objectKey=`${state.resources.productId}/1.0.0/${sha256}/fixture.txt`;
    const upload=await db.storage.from('store-installers').upload(objectKey,bytes,{contentType:'text/plain',upsert:false});
    if(upload.error && String(upload.error.statusCode)!=='409') throw new Error('Private fixture upload failed');
    const stored=await sdk(db.storage.from('store-installers').download(objectKey),'verify private stored fixture');
    const actual=Buffer.from(await stored.arrayBuffer());
    await check(actual.equals(bytes) && createHash('sha256').update(actual).digest('hex')===sha256,'trusted upload verifies actual private bytes and SHA256');
    const meta={product_id:state.resources.productId,version:'1.0.0',coverage_major:1,artifact_kind:'test',status:'published',bucket:'store-installers',object_key:objectKey,file_size:bytes.length,sha256,release_notes:'Harmless automated validation text; not a plugin.',installation_notes:'Do not install. This is a text-only access-control fixture.',signing_status:'not_applicable',approved_for_distribution:true,approval_reference:`STORE-001 automated harmless fixture ${state.runId}`};
    let release=await sdk(db.from('store_releases').select('id').eq('product_id',state.resources.productId).eq('version','1.0.0').maybeSingle(),'find fixture release');
    if(!release) release=await sdk(db.rpc('store_admin_release',{p_actor:admin.id,p_data:meta}),'register verified test fixture');
    state.resources.releaseId=release.id; state.resources.objectKey=objectKey; state.resources.fixtureSha256=sha256; await save();
    const anonPublic=await fetch(`${project}/storage/v1/object/public/store-installers/${objectKey}`);
    await check(!anonPublic.ok,'private artifact cannot be fetched through public storage URL');
    const unauthorized=await call(other,'download',{release_id:release.id});
    await check(unauthorized.status===403 && !unauthorized.data.url,'unentitled customer receives no download URL');
    for(let i=0;i<4;i++) {
      const download=(await okay(customer,'download',{release_id:release.id})).data;
      const received=await fetch(download.url); const receivedBytes=Buffer.from(await received.arrayBuffer());
      await check(received.ok && createHash('sha256').update(receivedBytes).digest('hex')===sha256,`authorized signed download returns matching bytes ${i+1}`);
      if(i===0) {state.resources.expiringUrl=download.url;state.resources.linkExpiresAt=download.expiresAt;await save();}
    }
    await check(true,'four downloads allowed; computer policy is not a download counter');
    const library=(await okay(customer,'library')).data;
    await check(library.entitlements[0].releases.some(x=>x.id===release.id),'eligible approved release appears in customer library');
    await check(!JSON.stringify(library).includes(objectKey) && !JSON.stringify(library).includes('object_key'),'customer library excludes private object locator');
    await okay(admin,'admin-release',{id:release.id,status:'withdrawn'});
    await check((await call(customer,'download',{release_id:release.id})).status===403,'withdrawn release denies new signed links');
    await check((await okay(customer,'library')).data.entitlements[0].expires_at===null,'withdrawal preserves permanent ownership over HTTP');
    // A distinct approved fixture remains available for the browser QA pass.
    const objectKey2=`${state.resources.productId}/1.0.1/${sha256}/fixture.txt`;
    const up2=await db.storage.from('store-installers').upload(objectKey2,bytes,{contentType:'text/plain',upsert:false});
    if(up2.error && String(up2.error.statusCode)!=='409') throw new Error('Second fixture upload failed');
    let current=await sdk(db.from('store_releases').select('id').eq('product_id',state.resources.productId).eq('version','1.0.1').maybeSingle(),'find browser release');
    if(!current) current=await sdk(db.rpc('store_admin_release',{p_actor:admin.id,p_data:{...meta,version:'1.0.1',object_key:objectKey2}}),'register browser fixture');
    state.resources.browserReleaseId=current.id;
  });
  await step('direct-data-api-and-export', async () => {
    const clientKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY;
    if(!clientKey) throw new Error('Publishable/anon key required for direct data API denial checks');
    for(const [kind,token] of [['anonymous',null],['authenticated',tokenOf(customer)]]) {
      for(const table of ['store_invites','store_entitlements','store_admins']) {
        const headers={apikey:clientKey};if(token)headers.Authorization=`Bearer ${token}`;
        const r=await fetch(`${project}/rest/v1/${table}?select=*`,{headers});
        await check([401,403].includes(r.status),`${kind} direct ${table} read denied`);
      }
    }
    const exported=await okay(admin,'admin-export');const text=JSON.stringify(exported.data);
    await check(!text.includes('code_hash') && !Object.values(state.resources.invites).some(x=>text.includes(x.code)),'admin export excludes invite verifiers and raw codes');
    await check(exported.disposition?.includes('attachment') && exported.data.downloads.some(x=>x.user_id===customer.id && x.event_type==='link_authorized'),'admin export includes honest download authorization audit');
  });
  await step('session-revocation-and-logout', async () => {
    const captured=structuredClone(revocation);
    await sdk(db.auth.admin.signOut(tokenOf(revocation),'local'),'revoke real Auth session');
    await check((await call(captured,'library')).status===401,'revoked real Auth session rejected despite unexpired access JWT');
    const logoutReplay=structuredClone(other);
    await okay(other,'logout',{});
    await check(!other.cookies['hex-store-access'] && !other.cookies['hex-store-refresh'],'HTTP logout clears session cookies');
    await check((await call(logoutReplay,'library')).status===401,'logged-out access and refresh cookie replay rejected');
  });
  await step('permanent-after-invite-expiry', async () => {
    const invitation=state.resources.invites.permanent;
    if(Date.now()<=Date.parse(invitation.invitation.expires_at)) throw new Error('Run exercise again after invite expires');
    const library=(await okay(customer,'library')).data;
    await check(library.entitlements.some(x=>x.id===state.resources.entitlementId && x.expires_at===null),'ownership remains permanent after actual invitation expiry');
    await check((await okay(customer,'redeem',{code:invitation.code})).data.alreadyRedeemed,'same successful code remains idempotent after actual expiry');
  });
  console.log(JSON.stringify({phase:'exercise-complete',passed:state.checks.filter(x=>x.passed).length,next:'expiry'}));
}
async function expiry() {
  if(!state.resources.expiringUrl) throw new Error('Run exercise first');
  await step('signed-link-expiry',async()=>{
    const waitMs=Math.max(0,Date.parse(state.resources.linkExpiresAt)+2000-Date.now());
    if(waitMs>60000) throw new Error('Expiry wait would exceed 60 seconds');
    if(waitMs) { console.log(JSON.stringify({waitingForSignedLinkExpirySeconds:Math.ceil(waitMs/1000)})); await delay(waitMs); }
    const expired=await fetch(state.resources.expiringUrl,{cache:'no-store'});
    await check(!expired.ok,'expired signed storage URL denied by actual provider',{status:expired.status});
    const renewed=(await okay(state.fixtures.customer,'download',{release_id:state.resources.browserReleaseId})).data;
    const fresh=await fetch(renewed.url);const actual=Buffer.from(await fresh.arrayBuffer());
    await check(fresh.ok&&createHash('sha256').update(actual).digest('hex')===state.resources.fixtureSha256,'permanent owner can request fresh link after old signed URL expires');
  });
}
async function browserCodes() {
  const names=process.argv[3]?[process.argv[3]]:['admin','customer'];
  if(names.some(name=>!['admin','customer'].includes(name)))throw new Error('Unknown browser fixture');
  const browserPath=new URL('browser-qa-otp.json',folder);
  let browser;
  try{browser=JSON.parse(await readFile(browserPath,'utf8'));}catch{browser={};}
  for(const name of names) {
    const f=state.fixtures[name];
    const generated=await sdk(db.auth.admin.generateLink({type:'magiclink',email:f.email}),'browser fixture OTP');
    f.browserOtp=generated.properties.email_otp;f.browserOtpGeneratedAt=new Date().toISOString();
    browser[name]={email:f.email,otp:generated.properties.email_otp};
  }
  await writeFile(browserPath,JSON.stringify(browser,null,2));
  await save();console.log(JSON.stringify({phase:'browser-codes-ready',fixtures:names}));
}
async function exportAudit() {
  for(const currency of ['JPY','ZZZ']) {
    await check((await call(state.fixtures.admin,'admin-product',{id:state.resources.productId,currency})).status===400,`unsupported draft currency ${currency} rejected`);
  }
  await check((await call(state.fixtures.admin,'admin-product',{id:state.resources.productId,regular_price_minor:99.5})).status===400,'fractional draft minor currency value rejected');
  const before=await sdk(db.from('store_products').select('promotional_price_minor').eq('id',state.resources.productId).single(),'read draft fixture promotion');
  const zero=await okay(state.fixtures.admin,'admin-product',{id:state.resources.productId,promotional_price_minor:0});
  await check(zero.data.product.promotional_price_minor===0&&!zero.data.product.commerce_enabled,'zero draft promotional price accepted without commerce');
  await okay(state.fixtures.admin,'admin-product',{id:state.resources.productId,promotional_price_minor:before.promotional_price_minor});
  const exported=await okay(state.fixtures.admin,'admin-export');
  const event=exported.data.audit.find(x=>x.action==='export_prepared'&&x.actor_id===state.fixtures.admin.id);
  await check(!!event,'HTTP export includes its export-prepared audit event');
  const stored=await sdk(db.from('store_admin_audit').select('id,action,details').eq('id',event.id).single(),'verify HTTP export audit');
  await check(stored.action==='export_prepared'&&JSON.stringify(stored.details)===JSON.stringify(event.details),'HTTP export audit persisted before response');
  const fields=['products','invitations','entitlements','releases','downloads','audit'];
  await check(Object.keys(event.details).length===6&&fields.every(name=>Number.isInteger(event.details[name])&&event.details[name]>=0),'HTTP export audit contains counts only');
  await check(fields.every(name=>event.details[name]===exported.data[name].length)&&exported.data.exportAuditId===event.id,'HTTP export counts match its complete exported snapshot');
  await check((await call(state.fixtures.customer,'admin-export')).status===403,'customer export denied after audit change');
  console.log(JSON.stringify({phase:'export-audit-verified',passed:state.checks.filter(x=>x.passed).length}));
}
async function nebulaFixture() {
  await step('nebula-flagship-fixture',async()=>{
    const invitation=await invite('nebula-flagship','nebula',{email:state.fixtures.customer.email});
    const grant=(await okay(state.fixtures.customer,'redeem',{code:invitation.code})).data.entitlement;
    await check(grant.product_id==='nebula'&&grant.expires_at===null&&grant.coverage_major===1,'flagship Nebula invitation creates permanent ownership through HTTP');
    const version='0.1.0-store001.test';
    const bytes=Buffer.from('ProjectNebula STORE-001 access-control test artifact.\nThis is harmless plain text, not a plugin binary or installer.\nDo not install it. No audio or licensing enforcement is included.\n');
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const objectKey=`nebula/${version}/${sha256}/nebula-store001-test.txt`;
    const uploaded=await db.storage.from('store-installers').upload(objectKey,bytes,{contentType:'text/plain',upsert:false});
    if(uploaded.error&&String(uploaded.error.statusCode)!=='409')throw new Error('Nebula harmless fixture upload failed');
    const stored=await sdk(db.storage.from('store-installers').download(objectKey),'verify Nebula harmless stored fixture');
    const actual=Buffer.from(await stored.arrayBuffer());
    await check(actual.equals(bytes)&&createHash('sha256').update(actual).digest('hex')===sha256,'flagship harmless text storage bytes verified');
    let release=await sdk(db.from('store_releases').select('id').eq('product_id','nebula').eq('version',version).maybeSingle(),'find Nebula fixture release');
    if(!release)release=await sdk(db.rpc('store_admin_release',{p_actor:state.fixtures.admin.id,p_data:{product_id:'nebula',version,coverage_major:1,artifact_kind:'test',status:'published',bucket:'store-installers',object_key:objectKey,file_size:bytes.length,sha256,release_notes:'STORE-001 test file only. This plain text validates private account downloads; no plugin binary or installer is included.',installation_notes:'Do not install. Open as text only. An actual ProjectNebula installer requires separate engineering release approval.',signing_status:'not_applicable',approved_for_distribution:true,approval_reference:'STORE-001 explicitly authorized harmless flagship download fixture; not an installer release approval'}}),'register Nebula harmless fixture');
    state.resources.nebulaReleaseId=release.id;state.resources.nebulaEntitlementId=grant.id;await save();
    const library=(await okay(state.fixtures.customer,'library')).data;
    const nebula=library.entitlements.find(x=>x.product_id==='nebula');
    await check(nebula?.product?.name==='ProjectNebula'&&nebula.releases.some(x=>x.id===release.id&&x.artifact_kind==='test'),'ProjectNebula and explicit test release appear in customer library');
    const download=(await okay(state.fixtures.customer,'download',{release_id:release.id})).data;
    const response=await fetch(download.url);const received=Buffer.from(await response.arrayBuffer());
    await check(response.ok&&createHash('sha256').update(received).digest('hex')===sha256,'flagship authorized text download SHA256 matches');
  });
}
async function cleanupCheck() {
  const admins=await sdk(db.from('store_admins').select('user_id'),'verify temporary admin removal');
  if(admins.some(x=>x.user_id===state.fixtures.admin.id))throw new Error('Temporary administrator still present');
  const denied=await call(state.fixtures.admin,'admin');
  if(denied.status!==403||denied.data.code!=='ADMIN_REQUIRED')throw new Error('Former test administrator was not denied');
  state.cleanup={checkedAt:new Date().toISOString(),temporaryAdminMembership:0,remainingAdministrators:admins.length,formerAdministratorHttpStatus:denied.status,permanentFixtureGrantsRetained:true};
  await save();console.log(JSON.stringify({phase:'cleanup-verified',...state.cleanup}));
}
try {
  const command=process.argv[2];
  if(command==='prepare')await prepare();
  else if(command==='exercise')await exercise();
  else if(command==='expiry')await expiry();
  else if(command==='browser-codes')await browserCodes();
  else if(command==='export-audit')await exportAudit();
  else if(command==='nebula-fixture')await nebulaFixture();
  else if(command==='cleanup-check')await cleanupCheck();
  else throw new Error('Expected prepare, exercise, expiry, browser-codes, export-audit, nebula-fixture, or cleanup-check');
  await save();
} catch(error) {
  await save();console.error(error.message.startsWith('CHECK_FAILED:')||error.message.startsWith('HTTP_FAILURE:')||error.message.startsWith('PROVIDER_FAILURE:')?error.message:'Integration stopped; inspect the script stage and private state without printing credentials.');process.exitCode=1;
}
