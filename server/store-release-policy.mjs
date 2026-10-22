// Mirror store_release_ready for rows validated by the release-ledger schema.
// Evidence references attest to checks performed by trusted tooling and people;
// this function does not inspect bytes, verify signatures, or assess listening.
const hasText = value => typeof value === 'string' && value.trim().length > 0;

export function releaseReadiness(release = {}) {
  const installer = release.artifact_kind === 'installer';
  const packaged = installer && release.package_format === 'zip';
  const gates = {
    checksum: packaged && hasText(release.installer_path) && hasText(release.installer_sha256)
      && release.installer_file_size != null && hasText(release.installer_verification_reference),
    notices: packaged && Array.isArray(release.mandatory_notices) && release.mandatory_notices.length > 0
      && hasText(release.notices_reference),
    playback: installer && hasText(release.fl_playback_reference),
    licensing: installer && hasText(release.licensing_reference),
    owner_approval: release.approved_for_distribution === true && hasText(release.approved_by)
      && hasText(release.approved_at) && hasText(release.approval_reference),
  };
  const signingEligible = release.signing_status === 'verified'
    || (release.signing_status === 'unsigned' && release.channel === 'private_beta');
  return {
    // Availability is deliberately separate: an approved draft is ready to be
    // enabled but still cannot be downloaded. Withdrawal remains terminal.
    ready: gates.owner_approval && (release.artifact_kind === 'test'
      || (installer && signingEligible && Object.values(gates).every(Boolean))),
    gates,
  };
}

export const CUSTOMER_RELEASE_FIELDS = Object.freeze([
  'id', 'product_id', 'version', 'coverage_major', 'platform', 'format', 'channel',
  'artifact_kind', 'status', 'file_size', 'sha256', 'release_notes', 'installation_notes',
  'signing_status', 'approved_for_distribution', 'created_at', 'package_format',
  'installer_path', 'installer_sha256', 'installer_file_size', 'mandatory_notices',
]);

// Selected server-side for eligibility, then excluded by customerRelease().
export const RELEASE_POLICY_FIELDS = Object.freeze([
  'approved_by', 'approved_at', 'approval_reference', 'installer_verification_reference',
  'notices_reference', 'fl_playback_reference', 'licensing_reference',
]);

export function customerRelease(release) {
  const visible = Object.fromEntries(CUSTOMER_RELEASE_FIELDS
    .filter(field => Object.prototype.hasOwnProperty.call(release, field))
    .map(field => [field, release[field]]));
  if (Array.isArray(visible.mandatory_notices)) {
    visible.mandatory_notices = visible.mandatory_notices.map(({ path, sha256, file_size }) => ({ path, sha256, file_size }));
  }
  return { ...visible, notes: release.release_notes };
}

export function adminRelease(release) {
  const { ready, gates } = releaseReadiness(release);
  return { ...release, release_ready: ready, release_gates: gates };
}
