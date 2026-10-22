const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const backend = import('../server/store-handler.mjs');
const importer = import('../tools/store-import-release.mjs');
const manifest = () => ({ file: 'fixture.txt', product_id: 'nebula', version: '0.1.0-test', actor_id: '00000000-0000-4000-8000-000000000001', artifact_kind: 'test', approval_reference: 'Harmless test fixture approval' });

test('pagination crosses the 1,000-row provider default and a lower configured cap', async () => {
  const { readAllStoreRows } = await backend;
  const source = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const rows = await readAllStoreRows(async (from, to) => ({ data: source.slice(from, Math.min(to + 1, from + 100)), count: source.length, error: null }));
  assert.deepEqual(rows, source);
});

test('pagination returns the exact cap and rejects excess or changing totals explicitly', async () => {
  const { readAllStoreRows } = await backend;
  const source = Array.from({ length: 10 }, (_, id) => ({ id }));
  assert.equal((await readAllStoreRows(async (from, to) => ({ data: source.slice(from, to + 1), count: 10 }), { maxRows: 10, pageSize: 5 })).length, 10);
  await assert.rejects(readAllStoreRows(async () => ({ data: [], count: 11 }), { maxRows: 10 }), error => error.code === 'EXPORT_REQUIRES_PAGING');
  let calls = 0;
  await assert.rejects(readAllStoreRows(async () => ({ data: [{ id: calls++ }], count: calls === 1 ? 3 : 4 })), error => error.code === 'RECORDS_CHANGED');
});

test('pagination fails closed on missing counts, provider errors and premature empty pages', async () => {
  const { readAllStoreRows } = await backend;
  for (const result of [{ data: [] }, { data: [], count: 1 }, { data: [], count: 0, error: { message: 'private failure' } }]) {
    await assert.rejects(readAllStoreRows(async () => result), error => error.code === 'STORE_UNAVAILABLE' && !error.message.includes('private failure'));
  }
});

test('manifest rejects invalid path components, relabeled major coverage and unsupported signing claims', async () => {
  const { validateManifest } = await importer;
  assert.equal(validateManifest(manifest()), 1);
  for (const change of [{ product_id: '../nebula' }, { version: '../1.0.0' }, { version: '2.0.0', coverage_major: 1 }, { artifact_kind: 'test', signing_status: 'verified' }, { approval_reference: '' }, { actor_id: 'user-controlled-admin' }]) {
    assert.throws(() => validateManifest({ ...manifest(), ...change }));
  }
  assert.throws(() => validateManifest({ ...manifest(), artifact_kind: 'installer', signing_status: 'verified', signing_evidence: true }));
});

test('test artifacts require actual UTF-8 text or parseable JSON and matching approved bytes', async () => {
  const { validateArtifactBytes } = await importer;
  const bytes = Buffer.from('Distribution test only. Not an installer.\n');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  assert.equal(validateArtifactBytes({ ...manifest(), sha256, file_size: bytes.length }, bytes, 'fixture.txt'), sha256);
  for (const [content, filename] of [[Buffer.from([0xff]), 'fixture.txt'], [Buffer.from([0x4d, 0x5a, 0]), 'fixture.txt'], [Buffer.from('{broken'), 'fixture.json'], [bytes, 'fixture.exe'], [Buffer.alloc(65537, 65), 'fixture.txt']]) {
    assert.throws(() => validateArtifactBytes(manifest(), content, filename));
  }
  assert.throws(() => validateArtifactBytes({ ...manifest(), sha256: '0'.repeat(64) }, bytes, 'fixture.txt'));
  assert.throws(() => validateArtifactBytes({ ...manifest(), file_size: bytes.length + 1 }, bytes, 'fixture.txt'));
});
