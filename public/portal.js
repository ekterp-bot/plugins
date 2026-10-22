(() => {
  'use strict';
  const root = document.querySelector('[data-portal]');
  if (!root) return;
  const adminMode = root.dataset.portal === 'admin';
  const $ = (selector) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { session:null, csrf:null, view:adminMode?'overview':'library', email:'', library:[], admin:null };
  const date = value => { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
  const bytes = value => Number(value) >= 1048576 ? `${(Number(value)/1048576).toFixed(1)} MB` : Number(value) >= 1024 ? `${(Number(value)/1024).toFixed(1)} KB` : `${Math.max(0,Number(value || 0))} bytes`;
  const label = value => String(value || '').replace(/[_-]/g,' ');
  const badge = (text,kind='') => `<span class="portal-badge ${esc(kind)}">${esc(label(text))}</span>`;
  const minorFactor = (currency='USD') => { try {return 10 ** new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;} catch {return 100;} };
  const money = (value,currency='USD') => { if(value == null)return 'Not set'; try {return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(Number(value)/minorFactor(currency));} catch{return `${value} ${currency} minor units`;} };
  const heading = (kicker,title,text,action='') => `<div class="portal-view-heading"><div><p class="eyebrow">${esc(kicker)}</p><h2 tabindex="-1">${esc(title)}</h2>${text?`<p>${esc(text)}</p>`:''}</div>${action}</div>`;
  const empty = (title,text,action='') => `<div class="portal-empty"><span class="empty-orbit" aria-hidden="true">◇</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
  const button = (text,attrs='',primary=false) => `<button type="button" class="portal-button ${primary?'primary':'secondary'}" ${attrs}>${esc(text)}</button>`;
  const input = (name,title,value='',options='') => `<label>${esc(title)}<input name="${esc(name)}" value="${esc(value)}" ${options}></label>`;
  const select = (name,title,values,value) => `<label>${esc(title)}<select name="${esc(name)}">${values.map(v=>{const [id,text]=Array.isArray(v)?v:[v,label(v)];return `<option value="${esc(id)}"${String(value)===String(id)?' selected':''}>${esc(text)}</option>`;}).join('')}</select></label>`;
  const textarea = (name,title,value='') => `<label>${esc(title)}<textarea name="${esc(name)}" rows="3" maxlength="6000">${esc(value)}</textarea></label>`;
  const products = () => state.admin?.products || [];
  const productName = row => row.product?.name || products().find(p=>p.id===row.product_id)?.name || row.product_id || 'Product';
  const releaseGateLabels = [['checksum','Exact installer checksum','installer_verification_reference'],['notices','Required notices in the ZIP','notices_reference'],['playback','Exact-build FL Studio playback','fl_playback_reference'],['licensing','Documented licensing eligibility','licensing_reference'],['owner_approval','Explicit owner distribution approval','approval_reference']];
  const releaseReady = release => release.release_ready === true;
  const releaseStatus = release => release.status === 'draft' ? 'Draft — downloads disabled' : release.status === 'published' ? 'Downloads enabled' : 'Withdrawn';
  function releaseDisclosure(release) {
    if (release.artifact_kind !== 'installer') return '<p class="test-artifact-note"><strong>Test artifact — not an installer.</strong> This file verifies private delivery. It does not install a plugin.</p>';
    return `${release.signing_status==='unsigned'?`<p class="release-warning"><strong>${release.channel==='private_beta'?'Unsigned private beta.':'Unsigned installer.'}</strong> This installer is not digitally signed. Windows may display security warnings or block installation under some configurations.</p>`:''}${release.package_format==='zip'?'<p class="release-package-note">The ZIP includes the unchanged Windows installer and required third-party software notices. Extract the complete package and read the included notices before installing.</p>':''}`;
  }
  function releaseHashes(release) {
    const packaged = release.artifact_kind === 'installer' && release.package_format === 'zip';
    return `${release.sha256?`<div class="release-hash"><span class="tiny-label">${packaged?'ZIP PACKAGE SHA-256':'FILE SHA-256'}</span><code>${esc(release.sha256)}</code></div>`:''}${packaged?`<div class="release-hash"><span class="tiny-label">INSTALLER SHA-256</span><code>${esc(release.installer_sha256 || 'Not recorded')}</code></div><div class="release-hash"><span class="tiny-label">INSTALLER IN ZIP</span><code>${esc(release.installer_path || 'Not recorded')}</code><span class="form-small">${esc(bytes(release.installer_file_size))}</span></div>`:''}`;
  }
  function releaseNotices(release) {
    const notices = Array.isArray(release.mandatory_notices) ? release.mandatory_notices : [];
    return notices.length ? `<div class="release-notice-files"><span class="tiny-label">REQUIRED NOTICES INCLUDED IN ZIP</span><ul>${notices.map(item=>`<li>${esc(item.path)}</li>`).join('')}</ul></div>` : '';
  }
  function notice(target,message,kind='info') { const el=$(target);el.textContent=message;el.className=`portal-message ${kind}`;el.hidden=!message; }
  async function api(op,body) {
    const headers = {'Accept':'application/json'};
    if(body !== undefined) { headers['Content-Type']='application/json'; headers['X-CSRF-Token']=state.csrf || ''; }
    let response;
    try { response = await fetch(`/api/store?op=${encodeURIComponent(op)}`,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store'}); }
    catch {throw new Error('We couldn’t connect. Check your connection and try again.');}
    const data = await response.json().catch(()=>null);
    if (!response.ok) {
      const fallback = {401:'Your session has ended. Sign in again to continue.',403:'This account does not have access to this action.',429:'Too many attempts. Please wait a moment before trying again.',503:'The account service is not available yet. Please try again later.'};
      const error=new Error(data?.message || data?.error?.message || (typeof data?.error==='string'?data.error:null) || fallback[response.status] || 'This request could not be completed. Please try again.');
      error.status=response.status;throw error;
    }
    if (!data || typeof data !== 'object') throw new Error('The account service returned an unexpected response. Please try again.');
    return data;
  }
  async function run(control,task,target='#workspace-message') {
    const controls = control?.matches('form') ? [...control.querySelectorAll('button,input,select,textarea')] : control?[control]:[];
    const previous = controls.map(el=>el.disabled);
    controls.forEach(el=>el.disabled=true);control?.setAttribute('aria-busy','true');notice(target,'');
    try { await task(); }
    catch(error) {
      if(error.status===401 && state.session?.user) { state.session=null;state.csrf=null;state.admin=null;state.library=[];await bootstrap();notice('#auth-message','Your session has ended. Sign in again to continue.','error'); }
      else notice(target,error.message,'error');
    }
    finally { controls.forEach((el,i)=>el.disabled=previous[i]);control?.removeAttribute('aria-busy'); }
  }
  async function bootstrap() {
    $('#session-loading').hidden=false;$('#session-retry').hidden=true;
    $('#email-form').hidden=true;$('#code-form').hidden=true;
    try {
      const session=await api('session');
      state.session=session;state.csrf=session.csrfToken;
      $('#portal-auth').hidden=!!session.user;
      $('#portal-workspace').hidden=!session.user;
      if (!session.user) { $('#email-form').hidden=false;return; }
      $('#identity-email').textContent=session.user.email;
      $('#identity-avatar').textContent=String(session.user.email || 'H')[0].toUpperCase();
      if ($('#owner-link')) $('#owner-link').hidden=!session.isAdmin;
      if(adminMode && !session.isAdmin) {
        $('#portal-content').innerHTML=heading('OWNER WORKSPACE','Owner access required','You’re signed in, but this account is not approved for the owner workspace.')+empty('Your library is ready for you.','Use your account page to redeem invitations and find eligible releases.','<a class="portal-button primary" href="/account">Open my library ↗</a>');
        root.querySelectorAll('[data-view]').forEach(el=>el.disabled=true);return;
      }
      root.querySelectorAll('[data-view]').forEach(el=>el.disabled=false);
      await loadData();render();
    } catch(error) {
      if (state.session?.user) { $('#portal-content').innerHTML=empty('We couldn’t load your workspace.',error.message,button('Try again','data-action="reload"')); }
      else { $('#portal-auth').hidden=false;$('#portal-workspace').hidden=true;notice('#auth-message',error.message,'error');$('#session-retry').hidden=false; }
    } finally {$('#session-loading').hidden=true;}
  }
  async function loadData() {
    if (adminMode) state.admin=await api('admin');
    else {const result=await api('library');state.library=Array.isArray(result.entitlements)?result.entitlements:[];}
  }
  function setView(view) {state.view=view;notice('#workspace-message','');render();$('#portal-content h2')?.focus({preventScroll:true});}
  function render() {
    root.querySelectorAll('[data-view]').forEach(el=>{if(el.dataset.view===state.view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    const content=$('#portal-content');
    if(adminMode) { if(!state.session?.isAdmin)return; const views={overview:renderOverview,products:renderProducts,invitations:renderInvitations,releases:renderReleases,activity:renderActivity};content.innerHTML=(views[state.view]||renderOverview)(); }
    else {const views={library:renderLibrary,redeem:renderRedeem,profile:renderProfile};content.innerHTML=(views[state.view]||renderLibrary)();}
  }
  function renderLibrary() {
    return heading('YOUR COLLECTION','My library','A home for your tools and the releases included with your access.',button('Redeem invitation','data-go="redeem"')) +
      (state.library.length ? `<div class="library-grid">${state.library.map(ent=>{
        const p=ent.product || {};const releases=Array.isArray(ent.releases)?ent.releases:[];
        return `<article class="library-card"><div class="library-art"><img src="${ent.product_id==='nebula'?'/assets/nebula-mark.svg':'/assets/hex-logo-purple.svg'}" alt="" width="70" height="70"><div><span class="tiny-label">HEX THE ENGINEER</span><strong>${esc(p.name || ent.product_id)}</strong></div><span class="library-art-line" aria-hidden="true"></span></div><div class="library-card-body"><div class="library-title"><h3>${esc(p.name || ent.product_id)}</h3>${badge(ent.expires_at?'Limited access':'Permanent access','cyan')}</div><p>${esc(p.description || 'Considered tools. Intentional sound.')}</p><div class="entitlement-facts"><div><span>ACCESS</span><strong>${ent.expires_at?`Until ${esc(date(ent.expires_at))}`:'No expiry'}</strong></div><div><span>UPDATES</span><strong>${esc(ent.coverage_major ?? 1)}.x maintenance</strong></div><div><span>PERSONAL USE</span><strong>${esc(ent.computer_limit || 2)} computers intended</strong></div></div><div class="release-list">${releases.length?releases.map(releaseCard).join(''):'<div class="release-pending"><span class="status-dot"></span><div><strong>Your access is saved.</strong><p>No eligible release is available yet. It will appear here when ready.</p></div></div>'}</div></div></article>`;
      }).join('')}</div><div class="portal-fine-print"><span>ACCESS THAT STAYS WITH YOU</span><p>Permanent grants have no expiry and include the covered major version’s maintenance releases. Authorized downloads are unlimited. Two personal computers are intended; device activation is not enforced.</p></div>` : empty('Your collection starts here.','Have a private invitation? Redeem it to add a product to this account.',button('Redeem an invitation','data-go="redeem"',true)));
  }
  function releaseCard(release) {
    const test=release.artifact_kind!=='installer';
    const packaged=!test&&release.package_format==='zip';
    return `<div class="release-item"><div class="release-item-top"><div><span class="tiny-label">${esc(label(release.channel || 'private_beta'))}</span><h4>Version ${esc(release.version)}</h4><p>${esc(label(release.platform))} <span>·</span> ${esc(String(release.format || '').toUpperCase())} <span>·</span> ${esc(bytes(release.file_size))}${packaged?' ZIP':''}</p></div>${badge(test?'Test artifact':packaged?'Installer + notices':'Installer',test?'amber':'cyan')}</div>${releaseDisclosure(release)}<div class="release-actions">${button(test?'Download test artifact':packaged?'Download installer + notices (ZIP)':'Download installer',`data-download="${esc(release.id)}"`,true)}<details class="release-details"><summary>Release details <span aria-hidden="true">+</span></summary><div><p>${esc(release.notes || release.release_notes || 'No release notes have been added.')}</p>${release.installation_notes?`<p>${esc(release.installation_notes)}</p>`:''}${releaseHashes(release)}${releaseNotices(release)}</div></details></div></div>`;
  }
  function renderRedeem() {
    return heading('PRIVATE INVITATIONS','Make it part of your collection.','Redeem an invitation once. Your access will be connected to this account.')+`<div class="portal-split"><section class="portal-panel"><span class="panel-symbol" aria-hidden="true">◇</span><h3>Enter your invitation code.</h3><p class="portal-muted">If your invitation was sent to a specific email, use that email to sign in.</p><form id="redeem-form" class="portal-form"><label for="invitation-code">Invitation code</label><input id="invitation-code" name="code" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" required maxlength="180" placeholder="Paste your invitation code"><button class="portal-button primary" type="submit">Redeem invitation <span aria-hidden="true">↗</span></button></form><p class="form-small">Signed in as ${esc(state.session.user.email)}</p></section><aside class="portal-help"><span class="tiny-label">AFTER YOU REDEEM</span><h3>Ready when you are.</h3><ol><li><span>01</span><div><strong>Access is added to your account</strong><p>Redeeming the same invitation again won’t create a duplicate grant.</p></div></li><li><span>02</span><div><strong>Find releases in your library</strong><p>Eligible files appear when they’re ready. An invitation may arrive before a release.</p></div></li><li><span>03</span><div><strong>Come back for updates</strong><p>Sign in with the same email whenever you need an authorized download.</p></div></li></ol></aside></div>`;
  }
  function renderProfile() {
    return heading('YOUR DETAILS','One email. Your collection.','Your product access is connected to the verified email below.')+`<section class="portal-panel account-details"><div class="profile-emblem">${esc(String(state.session.user.email)[0].toUpperCase())}</div><div><span class="tiny-label">VERIFIED EMAIL</span><h3>${esc(state.session.user.email)}</h3><p>Passwordless sign-in with a one-time code.</p></div>${badge('Signed in','cyan')}</section><div class="portal-policy-grid"><article class="portal-panel"><span class="tiny-label">YOUR DOWNLOADS</span><h3>Return whenever you need.</h3><p>Authorized downloads are unlimited. Each request creates a temporary private link; if it expires, request a new one from your library.</p></article><article class="portal-panel"><span class="tiny-label">YOUR ACCESS</span><h3>Clear from the start.</h3><p>Your library shows the expiry and update coverage for each grant. Permanent access has no expiry. Two personal computers are intended, without enforced activation.</p></article></div><a class="portal-text-link" href="/support#contact">Need help with your account? Contact support ↗</a>`;
  }
  function renderOverview() {
    const a=state.admin || {};const metrics=[['Products',a.products?.length || 0,'products'],['Invitations',a.invitations?.length || 0,'invitations'],['Access grants',a.entitlements?.length || 0,'activity'],['Download links issued',a.downloads?.length || 0,'activity']];
    return heading('OWNER WORKSPACE','A clear view of your releases.','Manage access deliberately. Keep private releases in the right hands.',button('Refresh','data-action="reload"'))+`<div class="portal-metrics">${metrics.map(([title,value,view])=>`<button type="button" data-go="${view}"><span>${title}</span><strong>${value}</strong><i aria-hidden="true">↗</i></button>`).join('')}</div><div class="overview-feature"><div><p class="eyebrow">INVITE SOMEONE IN</p><h3>Give access.<br>Keep it personal.</h3><p>Create a single-use invitation, optionally bound to an email. A redeemed invitation becomes a permanent product grant.</p>${button('Manage invitations','data-go="invitations"',true)}</div><div class="overview-orbit" aria-hidden="true"><span>◇</span><i></i><i></i></div></div><div class="portal-policy-grid"><article class="portal-panel"><span class="tiny-label">RELEASE WORKFLOW</span><h3>Draft. Review. Publish.</h3><p>Private files are imported with the trusted release tooling. Review their metadata here before making a release available to authorized accounts.</p>${button('Review releases','data-go="releases"')}</article><article class="portal-panel"><span class="tiny-label">PRICING WORKSPACE</span><h3>Plan the offer.</h3><p>Set regular and promotional prices per product. These are draft values; saving them does not open checkout or charge a customer.</p>${button('Manage products','data-go="products"')}</article></div>`;
  }
  function renderProducts() {
    return heading('CATALOG & PRICING','Products','Manage descriptions, availability and draft pricing.',button('New product','data-action="new-product"',true))+`<div class="admin-stack">${products().length?products().map(p=>`<article class="admin-record"><div class="record-leading"><span class="record-emblem" aria-hidden="true">◇</span><div><h3>${esc(p.name)}</h3><p>${esc(p.description || 'No description added.')}</p></div>${badge(p.status)}</div><div class="record-facts"><div><span>REGULAR PRICE</span><strong>${esc(money(p.regular_price_minor,p.currency))}</strong></div><div><span>PROMOTIONAL PRICE</span><strong>${esc(money(p.promotional_price_minor,p.currency))}</strong></div><div><span>CHECKOUT</span><strong>Not enabled</strong></div>${button('Edit product',`data-edit-product="${esc(p.id)}"`)}</div></article>`).join(''):empty('Build your catalog.','Add a product to create invitations and organize releases.',button('Create product','data-action="new-product"',true))}</div><div id="editor-mount"></div><p class="portal-footnote">All prices remain drafts. Checkout and payments are disabled.</p>`;
  }
  function productEditor(p={}) {
    const factor=minorFactor(p.currency || 'USD');const decimals=Math.log10(factor);
    const form=`<form id="product-form" class="portal-form editor-form"><div class="editor-heading"><div><span class="tiny-label">PRODUCT DETAILS</span><h3>${p.id?'Edit product':'New product'}</h3></div>${button('Cancel','data-action="close-editor"')}</div>${p.id?`<input type="hidden" name="id" value="${esc(p.id)}">`:''}<div class="portal-form-grid">${input('name','Product name',p.name,'required maxlength="120"')}${select('status','Availability',[['prelaunch','Prelaunch'],['private_beta','Private beta'],['unavailable','Unavailable']],p.status || 'prelaunch')}</div>${textarea('description','Description',p.description)}<div class="portal-form-grid three">${input('regular_price','Regular price (optional)',p.regular_price_minor==null?'':(p.regular_price_minor/factor).toFixed(decimals),`type="number" min="0" max="100000" step="${1/factor}"`)}${input('promotional_price','Promotional price (optional)',p.promotional_price_minor==null?'':(p.promotional_price_minor/factor).toFixed(decimals),`type="number" min="0" max="100000" step="${1/factor}"`)}${select('currency','Currency',[...new Set(['USD','EUR','GBP','CAD','AUD',p.currency || 'USD'])],p.currency || 'USD')}</div>${input('checkout_price_id','Checkout price reference (optional)',p.checkout_price_id,'maxlength="180"')}<p class="form-small">Saving draft prices does not enable checkout. Leave the promotional price empty to remove it.</p><button class="portal-button primary" type="submit">Save product</button></form>`;
    mountEditor(form);
  }
  function renderInvitations() {
    const rows=state.admin.invitations || [];
    return heading('PRIVATE ACCESS','Invitations','Unique, single-use invitations. Redemption creates permanent product access.')+`<div class="portal-panel"><div class="editor-heading"><div><span class="tiny-label">CREATE AN INVITATION</span><h3>A place in the collection.</h3></div>${badge('Single use','cyan')}</div>${products().length?`<form id="invite-form" class="portal-form"><div class="portal-form-grid three">${select('product_id','Product',products().map(p=>[p.id,p.name]),products()[0]?.id)}${input('email','Bind to email (optional)','','type="email" autocomplete="off" maxlength="254" placeholder="recipient@studio.com"')}${input('expires_at','Redeem before (optional)','','type="datetime-local"')}</div><p class="form-small">Defaults to a 30-day redemption window when no deadline is entered. The granted license never expires. Empty email allows any signed-in account to redeem it.</p><button class="portal-button primary" type="submit">Create invitation <span aria-hidden="true">↗</span></button></form>`:'<p class="portal-muted">Create a product before creating an invitation.</p>'}</div><div id="created-invitation" hidden></div><div class="portal-section-line"><h3>Invitation history</h3><span>${rows.length} ${rows.length===1?'invitation':'invitations'}</span></div><div class="admin-stack">${rows.length?rows.map(inv=>{
      const redeemed=!!(inv.redeemed_at || inv.redeemed_by);const revoked=!!inv.revoked_at;const expired=inv.expires_at && new Date(inv.expires_at)<new Date();const status=redeemed?'Redeemed':revoked?'Revoked':expired?'Expired':'Available';
      return `<article class="admin-record compact"><div class="record-leading"><div><h3>${esc(productName(inv))}</h3><p>${esc(inv.email || inv.intended_email || inv.bound_email || 'Any verified account')}</p></div>${badge(status,redeemed?'cyan':'')}</div><div class="record-facts"><div><span>CREATED</span><strong>${esc(date(inv.created_at))}</strong></div><div><span>REDEEM BEFORE</span><strong>${inv.expires_at?esc(date(inv.expires_at)):'No deadline'}</strong></div><div><span>REFERENCE</span><code>${esc(inv.id)}</code></div>${!redeemed&&!revoked?button('Revoke invitation',`data-revoke="${esc(inv.id)}"`):''}</div></article>`;
    }).join(''):empty('No invitations yet.','Create your first invitation above. The full code is shown only once.')}</div>`;
  }
  function renderReleases() {
    const rows=state.admin.releases || [];
    return heading('PRIVATE FILE DELIVERY','Releases','Review imported artifacts and release notes. Control availability.')+`<div class="portal-notice"><strong>Files stay private.</strong> Register releases with the trusted release tooling. Staged drafts appear here with downloads disabled. Installer downloads can be enabled only after the checksum, notices, exact-build FL Studio playback, licensing eligibility and explicit owner approval are verified.</div><div class="admin-stack">${rows.length?rows.map(r=>`<article class="admin-record"><div class="record-leading"><span class="record-emblem" aria-hidden="true">↓</span><div><span class="tiny-label">${esc(productName(r))}</span><h3>Version ${esc(r.version)}</h3><p>${esc(label(r.platform))} · ${esc(String(r.format || '').toUpperCase())} · ${esc(label(r.channel))}</p></div><div class="record-badges">${badge(releaseStatus(r),r.status==='published'?'cyan':'')}${badge(r.artifact_kind==='installer'?'Installer + notices':'Test artifact',r.artifact_kind==='installer'?'':'amber')}</div></div><div class="record-facts"><div><span>${r.package_format==='zip'?'ZIP SIZE':'FILE SIZE'}</span><strong>${esc(bytes(r.file_size))}</strong></div><div><span>UPDATE COVERAGE</span><strong>${esc(r.coverage_major || 1)}.x</strong></div><div><span>SIGNING</span><strong>${esc(label(r.signing_status || 'not_applicable'))}</strong></div>${button('Review release',`data-edit-release="${esc(r.id)}"`)}</div></article>`).join(''):empty('No imported releases yet.','Use the release importer to add a private artifact. This workspace will show its verified metadata and draft status.')}</div><div id="editor-mount"></div>`;
  }
  function releaseEditor(r) {
    const installer=r.artifact_kind==='installer';const withdrawn=r.status==='withdrawn';const ready=releaseReady(r);
    const gates=installer?`<section class="release-gates" aria-labelledby="release-gates-title"><h4 id="release-gates-title">External beta release checks</h4><ul>${releaseGateLabels.map(([key,title,reference])=>`<li><div><strong>${esc(title)}</strong><small>${esc(r[reference] || 'Evidence or approval not recorded')}</small></div>${badge(r.release_gates?.[key]===true?'Verified':'Pending',r.release_gates?.[key]===true?'cyan':'amber')}</li>`).join('')}</ul><p>${ready?'All required checks are verified. Availability can be enabled for eligible accounts.':'Keep this release staged. Downloads remain disabled until all five checks are verified through the trusted release tooling.'}</p></section>`:'';
    const statuses=withdrawn?[['withdrawn','Withdrawn — permanently unavailable']]:[['draft','Draft — downloads disabled'],['published',ready?'Enabled — eligible accounts can download':'Enable downloads — release checks incomplete'],['withdrawn','Withdraw — permanently unavailable']];
    const availability=`<label>Availability<select name="status"${withdrawn?' disabled':''}>${statuses.map(([value,title])=>`<option value="${value}"${r.status===value?' selected':''}${value==='published'&&!ready?' disabled':''}>${esc(title)}</option>`).join('')}</select></label>`;
    mountEditor(`<form id="release-form" class="portal-form editor-form"><div class="editor-heading"><div><span class="tiny-label">${esc(productName(r))}</span><h3>Review version ${esc(r.version)}</h3></div>${button('Cancel','data-action="close-editor"')}</div><input type="hidden" name="id" value="${esc(r.id)}"><div class="release-review-metadata"><div><span>ARTIFACT</span><strong>${esc(installer?(r.package_format==='zip'?'ZIP — installer + required notices':'Installer'):'Test artifact — not an installer')}</strong></div><div><span>PRIVATE OBJECT</span><code>${esc(r.object_key)}</code></div>${releaseHashes(r)}${releaseNotices(r)}${!installer?`<div><span>APPROVAL REFERENCE</span><code>${esc(r.approval_reference || 'Not recorded')}</code></div>`:''}</div>${releaseDisclosure(r)}${gates}${availability}<div class="portal-notice"><strong>Imported artifact details are preserved.</strong><p>${esc(r.release_notes || r.notes || 'No release notes added.')}</p>${r.installation_notes?`<p>${esc(r.installation_notes)}</p>`:''}</div><p class="form-small">Artifact identity and file metadata are immutable. Draft disables new download links and preserves approval for later re-enabling. Withdrawal is permanent. Previously issued links may work until their short expiry. Saving availability does not supply missing release evidence or approval.</p>${withdrawn?'<p class="form-small">This release has been withdrawn and cannot be enabled again.</p>':'<label class="portal-check"><input type="checkbox" name="confirmed" required><span>I have reviewed the artifact details and intended availability.</span></label><button class="portal-button primary" type="submit">Save release availability</button>'}</form>`);
  }
  function renderActivity() {
    const a=state.admin;return heading('ACCESS & DELIVERY','Activity','Access grants, download-link issuance and owner actions.',button('Export store data','data-action="export"'))+`<div class="portal-notice">Download activity records a link being issued. It does not confirm that a file was transferred or installed.</div><div class="portal-activity-grid"><section><div class="portal-section-line"><h3>Access grants</h3><span>${(a.entitlements||[]).length}</span></div>${records(a.entitlements||[],e=>({title:productName(e),sub:e.email || e.user?.email || e.user_id,tag:e.expires_at?'Limited':'Permanent',detail:`Granted ${date(e.granted_at || e.created_at)} · ${e.coverage_major || 1}.x maintenance · ${label(e.grant_type || 'invitation')}`}))}</section><section><div class="portal-section-line"><h3>Download links issued</h3><span>${(a.downloads||[]).length}</span></div>${records(a.downloads||[],d=>({title:downloadTitle(d),sub:d.email || d.user?.email || d.user_id,tag:'Link issued',detail:date(d.issued_at || d.authorized_at || d.created_at)}))}</section></div><div class="portal-section-line"><h3>Owner activity</h3><span>${(a.audit||[]).length}</span></div>${records(a.audit||[],r=>({title:label(r.action || r.event || 'Owner action'),sub:r.email || r.actor_email || r.actor_id || r.user_id,tag:date(r.created_at),detail:r.resource_id || r.target_id || r.entity_id || ''}))}<p class="portal-footnote">The export may contain customer emails and access records. Store it privately.</p>`;
  }
  function downloadTitle(download) {const release=download.release || (state.admin?.releases || []).find(r=>r.id===download.release_id);return release?`${productName(release)} · ${release.version}`:download.release_id || 'Download link';}
  function records(rows,convert) {return rows.length?`<div class="activity-list">${rows.map(row=>{const r=convert(row);return `<article><div><h4>${esc(r.title)}</h4><p>${esc(r.sub)}</p><small>${esc(r.detail)}</small></div>${badge(r.tag)}</article>`;}).join('')}</div>`:empty('Nothing to show yet.','New activity will appear here.');}
  function mountEditor(html) {const mount=$('#editor-mount');mount.innerHTML=html;mount.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});mount.querySelector('input:not([type="hidden"]),select,textarea')?.focus({preventScroll:true});}
  async function refresh(message) {await loadData();render();if(message)notice('#workspace-message',message,'success');}

  $('#email-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;const email=new FormData(form).get('email').trim();run(form,async()=>{const result=await api('auth-start',{email});state.email=email;form.hidden=true;$('#code-form').hidden=false;$('#code-recipient').textContent=`Enter the code sent to ${email}.`;notice('#auth-message',result.message || 'If this address can receive sign-in codes, one is on its way.');$('#sign-in-code').focus();},'#auth-message');});
  $('#code-form').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;const token=new FormData(form).get('token').trim();run(form,async()=>{await api('auth-verify',{email:state.email,token});form.reset();notice('#auth-message','');await bootstrap();},'#auth-message');});
  $('#change-email').addEventListener('click',()=>{$('#code-form').hidden=true;$('#code-form').reset();$('#email-form').hidden=false;notice('#auth-message','');$('#sign-in-email').focus();});
  $('#session-retry').addEventListener('click',()=>run($('#session-retry'),bootstrap,'#auth-message'));
  $('#sign-out').addEventListener('click',event=>run(event.currentTarget,async()=>{await api('logout',{});state.session=null;state.csrf=null;state.admin=null;state.library=[];$('#portal-content').replaceChildren();await bootstrap();notice('#auth-message','You’ve signed out.');}));
  root.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.view || target.dataset.go) {setView(target.dataset.view || target.dataset.go);return;}
    if(target.dataset.download) run(target,async()=>{const data=await api('download',{release_id:target.dataset.download});const url=new URL(data.url,location.origin);if(!['http:','https:'].includes(url.protocol) || (url.protocol!=='https:'&&url.origin!==location.origin))throw new Error('The download service returned an invalid link.');const link=document.createElement('a');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';document.body.append(link);link.click();link.remove();notice('#workspace-message','Your private download link is ready. If the download does not start, try again.','success');});
    if(target.dataset.editProduct) productEditor(products().find(p=>p.id===target.dataset.editProduct));
    if(target.dataset.editRelease) {const release=(state.admin.releases||[]).find(r=>r.id===target.dataset.editRelease);if(release)releaseEditor(release);}
    if(target.dataset.revoke) {
      if(target.dataset.confirm!=='yes') {target.dataset.confirm='yes';target.textContent='Confirm revoke';return;}
      run(target,async()=>{await api('admin-revoke-invite',{id:target.dataset.revoke});await refresh('Invitation revoked. It can no longer be redeemed.');});
    }
    if(target.dataset.action==='new-product')productEditor();
    if(target.dataset.action==='close-editor')$('#editor-mount').replaceChildren();
    if(target.dataset.action==='reload')run(target,()=>refresh('Workspace refreshed.'));
    if(target.dataset.action==='export')run(target,async()=>{const data=await api('admin-export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`hex-store-export-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);notice('#workspace-message','Store export prepared. Keep this file private.','success');});
    if(target.dataset.action==='copy-code')run(target,async()=>{await navigator.clipboard.writeText($('#new-invitation-code').textContent);target.textContent='Copied';});
  });
  root.addEventListener('change',event=>{if(event.target.name==='currency' && event.target.closest('#product-form')){event.target.form.querySelectorAll('[name=regular_price],[name=promotional_price]').forEach(input=>input.step=String(1/minorFactor(event.target.value)));}});
  root.addEventListener('submit',event=>{
    const form=event.target;const values=Object.fromEntries(new FormData(form));
    if(!['redeem-form','product-form','invite-form','release-form'].includes(form.id))return;
    event.preventDefault();
    run(form,async()=>{
      if(form.id==='redeem-form') {const result=await api('redeem',{code:values.code.trim()});state.view='library';await refresh(result.alreadyRedeemed?'This invitation was already redeemed on your account. Your access is ready.':'Invitation redeemed. Your product is now in your library.');}
      if(form.id==='product-form') {const payload={name:values.name.trim(),description:values.description.trim(),status:values.status,regular_price_minor:values.regular_price===''?null:Math.round(Number(values.regular_price)*minorFactor(values.currency)),promotional_price_minor:values.promotional_price===''?null:Math.round(Number(values.promotional_price)*minorFactor(values.currency)),currency:values.currency,checkout_price_id:values.checkout_price_id.trim() || null};if(payload.promotional_price_minor!==null && (payload.regular_price_minor===null || payload.promotional_price_minor>payload.regular_price_minor))throw new Error('The promotional price must be no higher than the regular price.');if(values.id)payload.id=values.id;await api('admin-product',payload);await refresh('Product saved. Pricing remains in draft; checkout is disabled.');}
      if(form.id==='invite-form') {const payload={product_id:values.product_id,email:values.email.trim() || null,expires_at:values.expires_at?new Date(values.expires_at).toISOString():null};if(payload.expires_at&&new Date(payload.expires_at)<=new Date())throw new Error('Choose a future invitation deadline.');const result=await api('admin-invite',payload);const code=result.code;if(typeof code!=='string'||!code)throw new Error('The invitation was created without a readable code. Refresh the history before creating another.');if(result.invitation)state.admin.invitations=[result.invitation,...(state.admin.invitations||[])];render();const box=$('#created-invitation');box.hidden=false;box.className='created-invitation';box.innerHTML='<div><span class="tiny-label">COPY THIS CODE NOW</span><h3>Your invitation is ready.</h3><p>This is the only time the complete code is shown. Share it privately with the intended recipient.</p></div><code id="new-invitation-code"></code>'+button('Copy code','data-action="copy-code"',true);$('#new-invitation-code').textContent=code;box.scrollIntoView({block:'center',behavior:'smooth'});}
      if(form.id==='release-form') {const release=(state.admin.releases||[]).find(r=>r.id===values.id);if(!release||release.status==='withdrawn')throw new Error('This release cannot be changed.');if(values.status==='published'&&!releaseReady(release))throw new Error('Complete the required release checks before enabling downloads.');const payload={id:values.id,status:values.status};await api('admin-release',payload);await refresh(values.status==='draft'?'Downloads disabled. The release remains staged.':values.status==='published'?'Downloads enabled for eligible accounts.':'Release withdrawn. It cannot be enabled again.');}
    });
  });
  bootstrap();
})();
