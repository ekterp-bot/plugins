const { test } = require('node:test');
const assert = require('node:assert/strict');
const policy = import('../server/store-release-policy.mjs');

// Synthetic metadata exercises policy only. No artifact or listening claim.
const approvedInstaller = () => ({
  id: '00000000-0000-4000-8000-000000000001', product_id: 'nebula', version: '0.1.0',
  artifact_kind: 'installer', channel: 'private_beta', signing_status: 'unsigned',
  status: 'draft', package_format: 'zip', file_size: 150, sha256: 'a'.repeat(64),
  installer_path: 'FixtureSetup.exe', installer_sha256: 'b'.repeat(64), installer_file_size: 100,
  mandatory_notices: [{ path: 'NOTICES.txt', sha256: 'c'.repeat(64), file_size: 25 }],
  approved_for_distribution: true, approved_by: '00000000-0000-4000-8000-000000000002',
  approved_at: '2026-10-22T00:00:00Z', approval_reference: 'Synthetic owner distribution approval',
  installer_verification_reference: 'Synthetic exact installer verification',
  notices_reference: 'Synthetic exact package notices verification',
  fl_playback_reference: 'Synthetic exact-build playback confirmation',
  licensing_reference: 'Synthetic licensing eligibility documentation',
  release_notes: 'Synthetic release notes', installation_notes: 'Synthetic install notes',
});

test('explicitly approved unsigned private beta has five ready gates independent of availability', async () => {
  const { releaseReadiness, adminRelease } = await policy;
  const source = approvedInstaller();
  assert.deepEqual(releaseReadiness(source), {
    ready: true, gates: { checksum: true, notices: true, playback: true, licensing: true, owner_approval: true },
  });
  const projected = adminRelease(source);
  assert.equal(projected.status, 'draft');
  assert.equal(projected.release_ready, true);
  assert.equal(projected.release_gates.playback, true);
  assert.equal(projected.approval_reference, source.approval_reference);
  assert.equal(Object.hasOwn(source, 'release_ready'), false);
});

test('each missing or whitespace-only gate keeps installer downloads ineligible', async () => {
  const { releaseReadiness } = await policy;
  const refs = {
    installer_verification_reference: 'checksum', notices_reference: 'notices',
    fl_playback_reference: 'playback', licensing_reference: 'licensing', approval_reference: 'owner_approval',
  };
  for (const [field, gate] of Object.entries(refs)) {
    for (const value of [undefined, null, '', ' \t\r\n ']) {
      const result = releaseReadiness({ ...approvedInstaller(), [field]: value });
      assert.equal(result.ready, false, field);
      assert.equal(result.gates[gate], false, field);
    }
  }
  for (const change of [{ approved_for_distribution: false }, { approved_by: null }, { approved_at: null }]) {
    const result = releaseReadiness({ ...approvedInstaller(), ...change });
    assert.equal(result.ready, false);
    assert.equal(result.gates.owner_approval, false);
  }
});

test('references cannot substitute for missing ZIP, installer identity, or required notices', async () => {
  const { releaseReadiness } = await policy;
  for (const change of [{ package_format: 'file' }, { installer_path: null }, { installer_sha256: null }, { installer_file_size: null }, { mandatory_notices: [] }, { mandatory_notices: null }]) {
    assert.equal(releaseReadiness({ ...approvedInstaller(), ...change }).ready, false, JSON.stringify(change));
  }
  const noZip = releaseReadiness({ ...approvedInstaller(), package_format: 'file' });
  assert.equal(noZip.gates.checksum, false);
  assert.equal(noZip.gates.notices, false);
  assert.equal(releaseReadiness().ready, false);
});

test('unsigned stable and unrecognized signing remain blocked despite complete approval', async () => {
  const { releaseReadiness } = await policy;
  assert.equal(releaseReadiness({ ...approvedInstaller(), channel: 'stable' }).ready, false);
  assert.equal(releaseReadiness({ ...approvedInstaller(), signing_status: 'not_applicable' }).ready, false);
  assert.equal(releaseReadiness({ ...approvedInstaller(), signing_status: 'verified', channel: 'stable' }).ready, true);
  assert.equal(releaseReadiness({ ...approvedInstaller(), artifact_kind: 'other' }).ready, false);
});

test('existing approved STORE-001 test artifacts do not require installer-only gates', async () => {
  const { releaseReadiness, adminRelease } = await policy;
  const fixture = {
    artifact_kind: 'test', signing_status: 'not_applicable', package_format: 'file', status: 'published',
    approved_for_distribution: true, approved_by: approvedInstaller().approved_by,
    approved_at: approvedInstaller().approved_at, approval_reference: 'Synthetic harmless test approval',
  };
  assert.equal(releaseReadiness(fixture).ready, true);
  assert.equal(adminRelease(fixture).release_ready, true);
  assert.equal(releaseReadiness({ ...fixture, approved_for_distribution: false }).ready, false);
  assert.equal(releaseReadiness({ ...fixture, approval_reference: null }).ready, false);
});

test('customer projection exposes package identity and notices without private operator evidence', async () => {
  const { customerRelease, RELEASE_POLICY_FIELDS } = await policy;
  const source = {
    ...approvedInstaller(), bucket: 'private-bucket', object_key: 'private/object/key',
    unknown_private_evidence: 'Do not expose', release_ready: true,
  };
  source.mandatory_notices[0].private_reference = 'Do not expose nested evidence';
  const result = customerRelease(source);
  assert.equal(result.package_format, 'zip');
  assert.equal(result.sha256, source.sha256);
  assert.equal(result.installer_sha256, source.installer_sha256);
  assert.equal(result.installer_path, source.installer_path);
  assert.equal(result.installer_file_size, source.installer_file_size);
  assert.equal(result.notes, source.release_notes);
  assert.deepEqual(result.mandatory_notices, [{ path: 'NOTICES.txt', sha256: 'c'.repeat(64), file_size: 25 }]);
  for (const field of [...RELEASE_POLICY_FIELDS, 'bucket', 'object_key', 'unknown_private_evidence', 'release_ready']) {
    assert.equal(Object.hasOwn(result, field), false, field);
  }
  assert.ok(source.mandatory_notices[0].private_reference);
});
