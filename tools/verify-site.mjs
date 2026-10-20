import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Dependency-free verification of this generated plain-HTML site. This checks
// document references and local HTTP behavior; it is not browser/layout QA.
const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const expectedRoutes = ['/', '/plugins', '/plugins/project-nebula', '/downloads', '/support', '/about'];
const checks = [];
const pages = new Map();
const localAssets = new Set();
const staticOnly = process.argv.includes('--static-only');
const baseArg = process.argv.find(value => value.startsWith('--base='));
const base = new URL(baseArg?.slice('--base='.length) || 'http://127.0.0.1:4174');
if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) {
  throw new Error('This verifier may only contact an HTTP loopback server.');
}
base.pathname = '/'; base.search = ''; base.hash = '';
const check = (name, pass, details = {}) => checks.push({ name, pass: Boolean(pass), ...details });
const decodeEntities = value => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const routeFile = route => path.join(dist, route, 'index.html');
const normalizeRoute = pathname => pathname === '/' ? '/' : pathname.replace(/\/$/, '');
const exists = async file => { try { return (await stat(file)).isFile(); } catch { return false; } };

function parseTags(html) {
  // Generated HTML contains no inline scripts. Restrict this scanner to tags;
  // comments and raw script/style bodies cannot introduce false references.
  const plain = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<(?:script|style)\b[^>]*>)[\s\S]*?(<\/(?:script|style)>)/gi, '$1$2');
  return [...plain.matchAll(/<([a-z][a-z0-9:-]*)(\s[^<>]*?)?\s*\/?>/gi)].map(match => {
    const attrs = {};
    for (const attr of (match[2] || '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attrs[attr[1].toLowerCase()] = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    return { tag: match[1].toLowerCase(), attrs };
  });
}

function localReference(value, route) {
  if (!value || /^(?:data:|mailto:|tel:)/i.test(value)) return null;
  const url = new URL(value, `http://site.invalid${route === '/' ? '/' : `${route}/`}`);
  if (url.origin !== 'http://site.invalid') return null;
  return { pathname: decodeURIComponent(url.pathname), hash: decodeURIComponent(url.hash.slice(1)) };
}

function forbiddenReleaseLink(value) {
  return /(?:^|[/.])(checkout|stripe|paypal|gumroad|paddle)(?:[/.?]|$)/i.test(value)
    || /\.(?:exe|msi|zip|vst3|dmg|pkg)(?:[?#]|$)/i.test(value)
    || /\/(?:checkout|cart|buy)(?:\/|[?#]|$)/i.test(value);
}

let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(dist, 'build-manifest.json'), 'utf8'));
  check('manifest: six expected routes', Array.isArray(manifest.routes)
    && manifest.routes.length === expectedRoutes.length
    && new Set(manifest.routes).size === expectedRoutes.length
    && expectedRoutes.every(route => manifest.routes.includes(route)), { routes: manifest.routes });
  check('manifest: commerce disabled', manifest.commerceEnabled === false);
  check('manifest: valid build timestamp', Number.isFinite(Date.parse(manifest.builtAt)));
} catch (error) { check('manifest: readable generated manifest', false, { error: error.message }); }

for (const route of [...expectedRoutes, '/404']) {
  const file = route === '/404' ? path.join(dist, '404.html') : routeFile(route);
  try {
    const html = await readFile(file, 'utf8');
    const tags = parseTags(html);
    const ids = tags.filter(t => t.attrs.id).map(t => t.attrs.id);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    pages.set(route, { html, tags, ids: new Set(ids) });
    check(`${route}: one h1`, tags.filter(t => t.tag === 'h1').length === 1);
    check(`${route}: unique IDs`, duplicateIds.length === 0, { duplicateIds });
    check(`${route}: noindex preview`, tags.some(t => t.tag === 'meta' && t.attrs.name === 'robots' && t.attrs.content?.includes('noindex')));
    const missingAriaTargets = [];
    for (const tag of tags) {
      for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant', 'for']) {
        for (const id of (tag.attrs[attr] || '').split(/\s+/).filter(Boolean)) {
          if (!ids.includes(id)) missingAriaTargets.push({ element: tag.tag, attribute: attr, id });
        }
      }
    }
    check(`${route}: accessible ID references resolve`, missingAriaTargets.length === 0, { missingAriaTargets });
    check(`${route}: images declare alternative text`, tags.filter(t => t.tag === 'img').every(t => Object.hasOwn(t.attrs, 'alt')));
  } catch (error) { check(`${route}: generated page exists`, false, { error: error.message }); }
}

for (const [route, page] of pages) {
  const brokenReferences = [];
  const forbiddenLinks = [];
  for (const { tag, attrs } of page.tags) {
    const refs = ['href', 'src', 'poster', 'action'].filter(attr => attrs[attr] !== undefined).map(attr => ({ attr, value: attrs[attr] }));
    if (attrs.srcset) refs.push(...attrs.srcset.split(',').map(candidate => ({ attr: 'srcset', value: candidate.trim().split(/\s+/)[0] })));
    if (Object.hasOwn(attrs, 'download')) forbiddenLinks.push({ tag, attribute: 'download' });
    for (const { attr, value } of refs) {
      if (/^javascript:/i.test(value) || forbiddenReleaseLink(value)) forbiddenLinks.push({ tag, attribute: attr, value });
      let ref;
      try { ref = localReference(value, route); } catch { brokenReferences.push({ value, reason: 'Malformed URL' }); continue; }
      if (!ref) continue;
      const destinationRoute = normalizeRoute(ref.pathname);
      const destination = pages.get(destinationRoute);
      if (destination) {
        if (ref.hash && !destination.ids.has(ref.hash)) brokenReferences.push({ value, reason: `Missing target #${ref.hash}` });
      } else if (attr === 'action' && destinationRoute === '/api/support') {
        // This deliberate disabled transport is exercised over HTTP below.
      } else {
        const target = path.resolve(dist, `.${ref.pathname}`);
        if (!target.startsWith(`${dist}${path.sep}`) || !await exists(target)) brokenReferences.push({ value, reason: 'Missing generated file or route' });
        else localAssets.add(ref.pathname);
      }
    }
  }
  check(`${route}: local links, fragments and assets resolve`, brokenReferences.length === 0, { brokenReferences });
  check(`${route}: no checkout or public installer links`, forbiddenLinks.length === 0, { forbiddenLinks });
}

for (const filename of ['styles.css', 'storefront.css']) {
  const missingAssets = [];
  try {
    const css = await readFile(path.join(dist, filename), 'utf8');
    for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)) {
      const ref = localReference(match[1], '/');
      if (!ref) continue;
      const target = path.resolve(dist, `.${ref.pathname}`);
      if (!target.startsWith(`${dist}${path.sep}`) || !await exists(target)) missingAssets.push(match[1]);
      else localAssets.add(ref.pathname);
    }
    check(`${filename}: all local CSS assets exist`, missingAssets.length === 0, { missingAssets });
  } catch (error) { check(`${filename}: generated CSS exists`, false, { error: error.message }); }
}

try {
  const catalog = JSON.parse(await readFile(path.join(dist, 'catalog.json'), 'utf8'));
  check('catalog: no enabled checkout, trial or download URL', catalog.length > 0
    && catalog.every(p => p.offer && ['checkoutUrl', 'trialUrl', 'downloadUrl'].every(key => p.offer[key] === null)));
  check('catalog: audio remains explicitly unconnected', catalog.every(p => p.demos.every(d => d.original === null && d.processed === null)));
  check('catalog: product routes generated', catalog.every(p => pages.has(`/plugins/${p.slug}`)));
} catch (error) { check('catalog: valid generated JSON', false, { error: error.message }); }

const prohibitedFiles = [];
async function inspectGeneratedFiles(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await inspectGeneratedFiles(file);
    else if (/\.(?:exe|msi|zip|vst3|dmp|pdb|cpp|h|mjs|cjs)$/i.test(item.name) || /^\.env/i.test(item.name)) prohibitedFiles.push(path.relative(dist, file));
  }
}
try { await inspectGeneratedFiles(dist); check('build: no installers, private dumps, server/source files or environment files', prohibitedFiles.length === 0, { prohibitedFiles }); }
catch (error) { check('build: inspect generated file tree', false, { error: error.message }); }

async function request(url, options = {}) {
  // Do not follow a redirect off localhost during verification.
  return fetch(new URL(url, base), { redirect: 'manual', signal: AbortSignal.timeout(5000), ...options });
}

if (!staticOnly) {
  let available = false;
  try { const response = await request('/build-manifest.json'); available = response.status === 200; check('HTTP: generated manifest served', available, { status: response.status }); }
  catch (error) { check('HTTP: loopback preview reachable', false, { error: error.message }); }
  if (available) {
    for (const route of expectedRoutes) {
      try {
        const response = await request(route);
        const html = await response.text();
        check(`HTTP ${route}: 200 and generated document`, response.status === 200 && html === pages.get(route)?.html, { status: response.status });
        check(`HTTP ${route}: HTML MIME and basic security headers`, response.headers.get('content-type')?.startsWith('text/html')
          && response.headers.get('x-content-type-options') === 'nosniff'
          && response.headers.get('content-security-policy')?.includes("default-src 'self'"));
      } catch (error) { check(`HTTP ${route}: request succeeds`, false, { error: error.message }); }
    }
    const response404 = await request('/definitely-not-a-real-page');
    check('HTTP: unknown route returns actual 404 page', response404.status === 404 && await response404.text() === pages.get('/404')?.html, { status: response404.status });
    for (const sourcePath of ['/src/catalog.mjs', '/tools/server.mjs', '/package.json', '/.env', '/.git/config', '/api/support.js']) {
      const response = await request(sourcePath);
      check(`HTTP: source unavailable ${sourcePath}`, [404, 410].includes(response.status), { status: response.status });
    }
    for (const asset of [...localAssets].sort()) {
      const response = await request(asset, { method: 'HEAD' });
      const length = (await stat(path.resolve(dist, `.${asset}`))).size;
      check(`HTTP asset ${asset}: 200 and correct length`, response.status === 200 && Number(response.headers.get('content-length')) === length, { status: response.status, bytes: length });
    }
    const supportResponse = await request('/api/support', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Synthetic Local Verification', email: 'verify@example.invalid', topic: 'Local preview verification', message: 'Synthetic verification only. No email delivery is requested.', companyWebsite: '' }),
    });
    const supportResult = await supportResponse.json();
    check('HTTP: valid support request remains unavailable and unsent', supportResponse.status === 503 && supportResult.ok === false && supportResult.sent === false, { status: supportResponse.status, result: supportResult });
    const legacyResponse = await request('/api/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    check('HTTP: retired intake returns 410', legacyResponse.status === 410, { status: legacyResponse.status });
  }
}

const failures = checks.filter(item => !item.pass);
const report = {
  checkedAt: new Date().toISOString(), scope: 'Generated plain HTML, asset references, disabled commerce and local HTTP. No browser or visual validation.',
  base: staticOnly ? null : base.origin, staticOnly, buildTimestamp: manifest?.builtAt,
  expectedRoutes, pagesChecked: pages.size, assetsChecked: localAssets.size,
  passed: checks.length - failures.length, failed: failures.length, checks,
};
await mkdir(path.join(root, 'artifacts', 'verification'), { recursive: true });
await writeFile(path.join(root, 'artifacts', 'verification', 'static-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Site verification: ${report.passed} passed, ${report.failed} failed. ${staticOnly ? 'HTTP checks skipped (--static-only).' : `Loopback: ${base.origin}`}`);
for (const failure of failures) console.error(`FAIL ${failure.name}: ${JSON.stringify(failure)}`);
process.exitCode = failures.length ? 1 : 0;
