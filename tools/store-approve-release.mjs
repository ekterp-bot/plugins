// Trusted operator records explicit evidence. This command never enables downloads.
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { inspectRelease } from './store-import-release.mjs';
import { getStoreConfig } from '../server/store-config.mjs';

const requireValid = (ok, message) => { if (!ok) throw new Error(message); };
export function validateApproval(input) {
  requireValid(input && typeof input === 'object' && !Array.isArray(input)
    && Object.keys(input).sort().join(',') === 'approval_reference,fl_playback_reference,release_id,stage_manifest', 'Approval requires exactly the documented fields');
  requireValid(typeof input.stage_manifest === 'string' && input.stage_manifest.length > 0 && input.stage_manifest.length <= 32767, 'Stage manifest path is required');
  requireValid(typeof input.release_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.release_id), 'Release ID is required');
  for (const key of ['fl_playback_reference', 'approval_reference']) {
    requireValid(typeof input[key] === 'string' && input[key].trim().length > 0 && input[key].length <= 2000
      && !/[\u0000-\u001f\u007f]/.test(input[key]), `An explicit ${key} is required`);
  }
  return input;
}
export async function approveRelease(inputPath) {
  const path = resolve(inputPath);
  const input = validateApproval(JSON.parse(await readFile(path, 'utf8')));
  const config = getStoreConfig();
  const { manifest, sha256, bytes } = await inspectRelease(resolve(dirname(path), input.stage_manifest));
  requireValid(manifest.artifact_kind === 'installer' && manifest.licensing_reference?.trim(), 'Installer staging and documented licensing are required');
  const db = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: adminError } = await db.rpc('store_require_admin', { p_actor: manifest.actor_id });
  requireValid(!adminError, 'A verified owner administrator is required');
  const { data: release, error } = await db.from('store_releases').select('*').eq('id', input.release_id).single();
  requireValid(!error && release.status === 'draft' && release.artifact_kind === 'installer', 'Only the staged draft installer can be approved');
  for (const key of ['product_id', 'version', 'sha256', 'file_size', 'package_format', 'signing_status', 'installer_path', 'installer_sha256', 'installer_file_size', 'mandatory_notices', 'installer_verification_reference', 'notices_reference', 'licensing_reference']) {
    requireValid(isDeepStrictEqual(release[key], manifest[key]), `Staged ${key} differs from verified evidence`);
  }
  requireValid(release.channel === (manifest.channel || 'private_beta'), 'Staged channel differs');
  const { data: bucket, error: bucketError } = await db.storage.getBucket(release.bucket);
  requireValid(!bucketError && bucket?.public === false, 'Release storage must remain private');
  const stored = await db.storage.from(release.bucket).download(release.object_key);
  requireValid(!stored.error && stored.data, 'Stored package could not be verified');
  const storedBytes = Buffer.from(await stored.data.arrayBuffer());
  requireValid(storedBytes.length === bytes.length && createHash('sha256').update(storedBytes).digest('hex') === sha256, 'Stored package differs from verified local evidence');
  // These references must point to real Core Engineering confirmation and the
  // owner's explicit exact-build approval. A populated string is not signoff.
  const result = await db.rpc('store_admin_release', { p_actor: manifest.actor_id, p_data: {
    id: release.id, status: 'draft', fl_playback_reference: input.fl_playback_reference,
    approval_reference: input.approval_reference, approved_for_distribution: true,
  } });
  requireValid(!result.error, 'Approval was rejected; inspect the evidence and existing immutable approval');
  return { id: result.data.id, status: result.data.status, approved_for_distribution: result.data.approved_for_distribution, downloads_enabled: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await approveRelease(process.argv[2]))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
