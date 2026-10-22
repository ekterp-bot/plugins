const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../public/portal.js'), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const settle = () => new Promise(resolve => setImmediate(resolve));

function ownerPortal() {
  const requests = []; const elements = new Map(); const listeners = new Map();
  const requested = deferred(); const pending = deferred();
  const element = (dataset = {}) => ({
    dataset, innerHTML: '', textContent: '', hidden: false, disabled: false, attributes: {},
    addEventListener() {}, focus() {}, closest() { return this; }, matches() { return false; },
    setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; },
  });
  const nav = ['overview', 'invitations', 'releases', 'activity'].map(view => element({ view }));
  const root = {
    dataset: { portal: 'admin' },
    querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
    querySelectorAll() { return nav; }, addEventListener(name, listener) { listeners.set(name, listener); },
  };
  vm.runInNewContext(source, {
    document: { querySelector: () => root }, Intl, Date, URL,
    fetch: async url => {
      const op = new URL(url, 'http://localhost').searchParams.get('op'); requests.push(op);
      if (op === 'session') return response({ user: { email: 'owner@example.invalid' }, isAdmin: true, csrfToken: 'fixture' });
      assert.equal(op, 'admin'); requested.resolve(); return pending.promise;
    },
  });
  return {
    requested: requested.promise, resolve: pending.resolve, requests,
    html: () => elements.get('#portal-content').innerHTML,
    click(view) { listeners.get('click')({ target: nav.find(button => button.dataset.view === view) }); },
    selected: view => nav.find(button => button.dataset.view === view).attributes['aria-current'],
  };
}

test('navigation during pending owner data keeps a loading view and remembers the selected destination', async () => {
  const portal = ownerPortal(); await portal.requested;
  for (const view of ['invitations', 'activity', 'releases']) {
    assert.doesNotThrow(() => portal.click(view));
    assert.match(portal.html(), /role="status"/);
    assert.match(portal.html(), /Loading your workspace/);
  }
  portal.resolve(response({ products: [], invitations: [], releases: [], entitlements: [], downloads: [], audit: [] }));
  await settle();
  assert.match(portal.html(), /<h2 tabindex="-1">Releases<\/h2>/);
  assert.match(portal.html(), /No imported releases yet/);
  assert.equal(portal.selected('releases'), 'page');
  assert.deepEqual(portal.requests, ['session', 'admin']);
});

test('an owner-data 403 remains visible when navigating after the failed request', async () => {
  const portal = ownerPortal(); await portal.requested;
  portal.click('releases');
  portal.resolve(response({ message: 'Owner access is required.' }, 403));
  await settle();
  for (const view of ['activity', 'releases']) {
    portal.click(view);
    assert.match(portal.html(), /Owner access is required\./);
    assert.match(portal.html(), /Try again/);
    assert.doesNotMatch(portal.html(), /Loading your workspace|No imported releases yet/);
  }
  assert.deepEqual(portal.requests, ['session', 'admin']);
});
