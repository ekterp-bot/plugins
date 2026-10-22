const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve, dirname } = require('node:path');
const { createHash } = require('node:crypto');
const { deflateRawSync } = require('node:zlib');

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const windowsOnly = { skip: process.platform !== 'win32' };

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'hex-store-zip-test-'));
  t.after(async () => {
    // Delete only this test's unique, verified direct child of the temp folder.
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(tmpdir(), 'hex-store-zip-test-')));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

// Produce a real deflated ZIP whose central directory can lie about expanded
// size. No extraction or large allocation is needed by the verifier under test.
function zipWithDeclaredSizes(entries) {
  const records = [], central = [];
  let offset = 0;
  for (const { path, bytes, declaredSize = bytes.length } of entries) {
    const name = Buffer.from(path);
    const compressed = deflateRawSync(bytes);
    const crc = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    records.push(local, name, compressed);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(8, 10);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(declaredSize, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...records, directory, end]);
}

test('archive names reject Windows aliases and notices allow required text/source only', async () => {
  const { safePackagePath, safeNoticePath } = await import('../tools/store-package-utils.mjs');
  for (const path of ['installer.exe.', 'dir./LICENSE', 'NUL', 'con.txt', 'dir/COM1.log', 'LPT9/LICENSE', '../LICENSE', 'dir//LICENSE', 'dir/../LICENSE', 'dir\\LICENSE', 'C:/LICENSE']) {
    assert.equal(safePackagePath(path), false, path);
  }
  for (const path of ['third-party-notices/LICENSE', 'README', 'AUTHORS', 'PATENTS', 'COPYING', 'NOTICE', 'SHA256SUMS', 'SHA256SUMS.txt', 'source/header.hpp', 'source/implementation.cpp', 'source/setup.pas', 'juce.spdx.json', 'notices.md']) {
    assert.equal(safeNoticePath(path), true, path);
  }
  for (const path of ['secret.env', 'run.ps1', 'run.cmd', 'run.bat', 'run.js', 'run.vbs', 'file.dll', 'file.exe', 'file.com', 'file.exe.', 'file.txt.exe', 'source.a']) {
    assert.equal(safeNoticePath(path), false, path);
  }
});

test('ZIP round trip verifies exact bytes and never overwrites an existing package', windowsOnly, async t => {
  const { verifyOrCreateZip } = await import('../tools/store-package-utils.mjs');
  const directory = await temporaryDirectory(t);
  const payloads = [['installer.exe', Buffer.from('synthetic non-executable installer fixture')], ['third-party-notices/NOTICE.txt', Buffer.from('Synthetic notice fixture.\n')]];
  const entries = [];
  for (const [path, bytes] of payloads) {
    const source = join(directory, `source-${entries.length}`);
    await writeFile(source, bytes);
    entries.push({ path, source, sha256: digest(bytes), file_size: bytes.length });
  }
  const file = join(directory, 'fixture.zip');
  const result = await verifyOrCreateZip('Create', file, entries);
  assert.equal(result.expanded_bytes, payloads.reduce((total, [, bytes]) => total + bytes.length, 0));
  assert.equal((await verifyOrCreateZip('Verify', file, entries)).verified, true);
  const original = await readFile(file);
  await assert.rejects(verifyOrCreateZip('Create', file, entries));
  assert.deepEqual(await readFile(file), original);
});

test('ZIP verifier rejects forged expanded sizes even when the expanded hash is correct', windowsOnly, async t => {
  const { verifyOrCreateZip } = await import('../tools/store-package-utils.mjs');
  const directory = await temporaryDirectory(t);
  const payload = Buffer.alloc(2 * 1024 * 1024, 65);
  const notice = Buffer.from('x');
  const file = join(directory, 'forged-size.zip');
  await writeFile(file, zipWithDeclaredSizes([
    { path: 'installer.exe', bytes: payload, declaredSize: 1 },
    { path: 'NOTICE.txt', bytes: notice },
  ]));
  await assert.rejects(verifyOrCreateZip('Verify', file, [
    { path: 'installer.exe', file_size: 1, sha256: digest(payload) },
    { path: 'NOTICE.txt', file_size: 1, sha256: digest(notice) },
  ]), /Stream expanded bytes exceed declared entry size/);
});

test('ZIP creation rejects a source whose stat size differs from approved metadata', windowsOnly, async t => {
  const { verifyOrCreateZip } = await import('../tools/store-package-utils.mjs');
  const directory = await temporaryDirectory(t);
  const bytes = Buffer.from('longer than its declared length');
  const source = join(directory, 'source.txt');
  await writeFile(source, bytes);
  await assert.rejects(verifyOrCreateZip('Create', join(directory, 'wrong-size.zip'), [
    { path: 'installer.exe', source, file_size: 1, sha256: digest(bytes) },
    { path: 'NOTICE.txt', source, file_size: bytes.length, sha256: digest(bytes) },
  ]), /Source file type or size does not match package manifest/);
});

test('ZIP verifier rejects truncated expansion and unlisted entries', windowsOnly, async t => {
  const { verifyOrCreateZip } = await import('../tools/store-package-utils.mjs');
  const directory = await temporaryDirectory(t);
  const bytes = Buffer.from('x');
  const file = join(directory, 'short-entry.zip');
  await writeFile(file, zipWithDeclaredSizes([
    { path: 'installer.exe', bytes, declaredSize: 2 },
    { path: 'NOTICE.txt', bytes },
  ]));
  const entries = [
    { path: 'installer.exe', file_size: 2, sha256: digest(bytes) },
    { path: 'NOTICE.txt', file_size: 1, sha256: digest(bytes) },
  ];
  await assert.rejects(verifyOrCreateZip('Verify', file, entries), /Stream expanded bytes differ from declared entry size/);
  await writeFile(file, zipWithDeclaredSizes([
    { path: 'installer.exe', bytes },
    { path: 'NOTICE.txt', bytes },
    { path: 'extra.ps1', bytes },
  ]));
  entries[0].file_size = 1;
  await assert.rejects(verifyOrCreateZip('Verify', file, entries), /ZIP has missing or unexpected entries/);
});

test('ZIP helper rejects more than 64 notices plus installer and invalid byte budgets', windowsOnly, async () => {
  const { verifyOrCreateZip } = await import('../tools/store-package-utils.mjs');
  const entries = Array.from({ length: 66 }, (_, index) => ({ path: `notice-${index}.txt`, file_size: 1, sha256: 'a'.repeat(64) }));
  await assert.rejects(verifyOrCreateZip('Verify', 'unused.zip', entries), /entry count/);
  await assert.rejects(verifyOrCreateZip('Verify', 'unused.zip', [
    { ...entries[0], file_size: 50 * 1024 * 1024 },
    { ...entries[1], file_size: 15 * 1024 * 1024 },
  ]), /Expanded archive exceeds preview limit/);
  await assert.rejects(verifyOrCreateZip('Verify', 'unused.zip', [
    { ...entries[0], file_size: 1.5 }, entries[1],
  ]), /Invalid archive entry metadata/);
});
