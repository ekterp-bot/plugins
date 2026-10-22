const { test } = require('node:test');
const assert = require('node:assert/strict');
const importer = import('../tools/store-import-release.mjs');
const valid = () => ({ file: 'release.zip', product_id: 'nebula', version: '0.1.0', actor_id: '00000000-0000-4000-8000-000000000001',
  artifact_kind: 'installer', channel: 'private_beta', package_format: 'zip', sha256: 'a'.repeat(64), file_size: 1000,
  signing_status: 'unsigned', installer_file: 'sealed.exe', installer_path: 'sealed.exe', installer_sha256: 'b'.repeat(64), installer_file_size: 900,
  mandatory_notices: [{ path: 'third-party-notices/LICENSE.txt', sha256: 'c'.repeat(64), file_size: 100 }],
  installer_verification_reference: 'Exact sealed checksum evidence', notices_reference: 'Complete engineering notice index', licensing_reference: 'Documented eligibility' });

test('installer staging accepts unsigned private beta without granting approval', async () => {
  const { validateManifest } = await importer;
  assert.equal(validateManifest(valid()), 1);
  for (const change of [{ channel: 'stable' }, { approval_reference: 'approve on upload' }, { mandatory_notices: [] },
    { notices_reference: '\t\n ' }, { installer_verification_reference: '' }, { sha256: 'broken' }, { signing_status: 'not_applicable' }]) {
    assert.throws(() => validateManifest({ ...valid(), ...change }));
  }
});
test('notice metadata rejects aliases, duplicate installer payloads and runnable extras', async () => {
  const { validateManifest } = await importer;
  for (const path of ['sealed.exe', 'setup.exe.', 'folder/NUL.txt', '../LICENSE.txt', 'folder//LICENSE.txt', 'install.ps1', 'helper.dll', 'file.txt:stream']) {
    const value = valid(); value.mandatory_notices[0].path = path;
    assert.throws(() => validateManifest(value), path);
  }
  for (const path of ['Inno-Setup/covered-source/decoder.pas', 'JUCE/JUCE.spdx.json', 'PreSonus/header.h', 'IJG/README']) {
    const value = valid(); value.mandatory_notices[0].path = path;
    assert.equal(validateManifest(value), 1, path);
  }
});
test('actual package bytes must match approved hash and size', async () => {
  const { validateArtifactBytes } = await importer;
  assert.throws(() => validateArtifactBytes(valid(), Buffer.from('tampered'), 'release.zip'), /hash/);
});
test('operator approval requires explicit playback and owner evidence, with no publish field', async () => {
  const { validateApproval } = await import('../tools/store-approve-release.mjs');
  const input = { release_id: valid().actor_id, stage_manifest: 'stage.json', fl_playback_reference: 'Core Engineering exact-build report', approval_reference: 'Owner exact-build approval' };
  assert.equal(validateApproval(input), input);
  for (const change of [{ fl_playback_reference: ' ' }, { approval_reference: '' }, { status: 'published' }, { release_id: 'wrong' }]) assert.throws(() => validateApproval({ ...input, ...change }));
});
