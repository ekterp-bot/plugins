// Trusted operator tool. Never bundle this file or its environment into the browser.
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { getStoreConfig } from '../server/store-config.mjs';

const runFile = promisify(execFile);
const allowedFields = new Set(['file', 'product_id', 'version', 'actor_id', 'artifact_kind', 'approval_reference', 'sha256', 'file_size', 'signing_status', 'signing_evidence', 'coverage_major', 'channel', 'release_notes', 'installation_notes']);
const shaPattern = /^[a-f0-9]{64}$/i;
const text = (value, max, min = 0) => typeof value === 'string' && value.length >= min && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const requireValid = (condition, message) => { if (!condition) throw new Error(message); };

export function validateManifest(manifest) {
  requireValid(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Manifest must be a JSON object');
  requireValid(Object.keys(manifest).every(key => allowedFields.has(key)), 'Unknown manifest field');
  requireValid(text(manifest.file, 32767, 1), 'A local artifact file is required');
  requireValid(typeof manifest.product_id === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(manifest.product_id), 'Invalid product ID');
  requireValid(typeof manifest.version === 'string' && manifest.version.length <= 100 && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.test(manifest.version), 'Invalid version');
  const coverage = Math.max(Number(manifest.version.split('.')[0]), 1);
  requireValid(coverage <= 999 && (manifest.coverage_major === undefined || manifest.coverage_major === coverage), 'Coverage must match the version major (private beta 0.x covers v1)');
  requireValid(typeof manifest.actor_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(manifest.actor_id), 'Invalid approving administrator ID');
  requireValid(['test', 'installer'].includes(manifest.artifact_kind), 'Invalid artifact kind');
  requireValid(text(manifest.approval_reference, 2000, 1) && manifest.approval_reference.trim(), 'An explicit distribution approval reference is required');
  requireValid(manifest.channel === undefined || ['private_beta', 'stable'].includes(manifest.channel), 'Invalid release channel');
  for (const key of ['release_notes', 'installation_notes']) requireValid(manifest[key] === undefined || text(manifest[key], 20000), `Invalid ${key}`);
  requireValid(manifest.sha256 === undefined || (typeof manifest.sha256 === 'string' && shaPattern.test(manifest.sha256)), 'Invalid approved SHA256');
  requireValid(manifest.file_size === undefined || (Number.isSafeInteger(manifest.file_size) && manifest.file_size > 0 && manifest.file_size <= 2147483648), 'Invalid approved byte size');
  if (manifest.artifact_kind === 'installer') {
    requireValid(!!manifest.sha256 && !!manifest.file_size && manifest.signing_status === 'verified' && text(manifest.signing_evidence, 32767, 1), 'Installer import requires approved SHA256/size and a local signing-evidence JSON file');
  } else requireValid(manifest.signing_status === undefined || manifest.signing_status === 'not_applicable', 'Test artifacts must not claim Windows signing');
  return coverage;
}

export function validateArtifactBytes(manifest, bytes, filename) {
  requireValid(bytes.length > 0 && bytes.length <= 2147483648, 'Artifact size is outside the supported range');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  requireValid(!manifest.sha256 || manifest.sha256.toLowerCase() === sha256, 'Approved artifact hash does not match');
  requireValid(manifest.file_size === undefined || manifest.file_size === bytes.length, 'Approved artifact size does not match');
  requireValid(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(filename), 'Unsafe filename');
  if (manifest.artifact_kind === 'test') {
    requireValid(/\.(txt|json)$/.test(filename) && bytes.length <= 65536, 'Test artifacts must be small UTF-8 text/JSON files');
    let decoded;
    try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new Error('Test artifact is not valid UTF-8 text'); }
    requireValid(text(decoded, 65536, 1), 'Test artifact contains binary control bytes');
    if (filename.endsWith('.json')) {
      try { JSON.parse(decoded); } catch { throw new Error('Test JSON is invalid'); }
    }
  } else requireValid(filename.toLowerCase().endsWith('.exe'), 'This handoff accepts a Windows executable installer');
  return sha256;
}

async function verifyInstallerSigning(file, evidenceFile, sha256) {
  requireValid(process.platform === 'win32', 'Installer Authenticode verification requires Windows');
  let evidence;
  try { evidence = JSON.parse(await readFile(evidenceFile, 'utf8')); }
  catch { throw new Error('Cannot read the approved signing-evidence JSON'); }
  requireValid(evidence && typeof evidence.sha256 === 'string' && evidence.sha256.toLowerCase() === sha256 && typeof evidence.signer_thumbprint === 'string' && /^[a-f0-9]{40}$/i.test(evidence.signer_thumbprint), 'Signing evidence must bind this SHA256 to the approved signer thumbprint');
  // Pass the literal path through an environment value, never shell interpolation.
  // Do not inherit Supabase credentials into the Windows verifier process.
  const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  env.HEX_STORE_IMPORT_PATH = file;
  const script = "$ErrorActionPreference='Stop'; $before=(Get-FileHash -LiteralPath $env:HEX_STORE_IMPORT_PATH -Algorithm SHA256).Hash; $signature=Get-AuthenticodeSignature -LiteralPath $env:HEX_STORE_IMPORT_PATH; $after=(Get-FileHash -LiteralPath $env:HEX_STORE_IMPORT_PATH -Algorithm SHA256).Hash; [pscustomobject]@{status=[string]$signature.Status; signer=[string]$signature.SignerCertificate.Thumbprint; timestamp=[string]$signature.TimeStamperCertificate.Thumbprint; before=$before; after=$after} | ConvertTo-Json -Compress";
  let result;
  try {
    const { stdout } = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env, windowsHide: true, timeout: 30000, maxBuffer: 8192 });
    result = JSON.parse(stdout);
  } catch { throw new Error('Windows signature verification failed; no artifact was uploaded'); }
  requireValid(result.status === 'Valid' && result.signer.toLowerCase() === evidence.signer_thumbprint.toLowerCase() && result.timestamp
    && result.before.toLowerCase() === sha256 && result.after.toLowerCase() === sha256, 'The actual installer signature, timestamp or approved signer does not match');
}

export async function importRelease(manifestPath) {
  const config = getStoreConfig(); // Pins the dedicated preview project.
  const path = resolve(manifestPath);
  let manifest;
  try { manifest = JSON.parse(await readFile(path, 'utf8')); }
  catch { throw new Error('Cannot read a valid release manifest JSON'); }
  const coverage = validateManifest(manifest);
  const file = resolve(dirname(path), manifest.file);
  const info = await stat(file);
  requireValid(info.isFile() && info.size > 0 && info.size <= (manifest.artifact_kind === 'test' ? 65536 : 2147483648), 'Artifact is not a supported regular file');
  const bytes = await readFile(file);
  const filename = basename(file);
  const sha256 = validateArtifactBytes(manifest, bytes, filename);
  if (manifest.artifact_kind === 'installer') await verifyInstallerSigning(file, resolve(dirname(path), manifest.signing_evidence), sha256);
  const db = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error: adminError } = await db.rpc('store_require_admin', { p_actor: manifest.actor_id });
  requireValid(!adminError, 'The approved actor is not an available verified owner administrator');
  const { data: bucket, error: bucketError } = await db.storage.getBucket('store-installers');
  requireValid(!bucketError && bucket?.public === false, 'The installer bucket must exist and remain private');
  const objectKey = `${manifest.product_id}/${manifest.version.replace(/\+/g, '_')}/${sha256}/${filename}`;
  const data = {
    product_id: manifest.product_id, version: manifest.version, coverage_major: coverage,
    platform: 'windows-x64', format: 'vst3', channel: manifest.channel || 'private_beta',
    artifact_kind: manifest.artifact_kind, status: 'published', bucket: 'store-installers', object_key: objectKey,
    file_size: bytes.length, sha256, release_notes: manifest.release_notes || '', installation_notes: manifest.installation_notes || '',
    signing_status: manifest.artifact_kind === 'test' ? 'not_applicable' : 'verified',
    approved_for_distribution: true, approval_reference: manifest.approval_reference,
  };
  const { data: existing, error: existingError } = await db.from('store_releases').select('*').eq('product_id', data.product_id).eq('version', data.version).eq('platform', data.platform).eq('format', data.format).eq('channel', data.channel).eq('artifact_kind', data.artifact_kind).maybeSingle();
  requireValid(!existingError, 'Could not check existing release metadata');
  if (existing) requireValid(Object.entries(data).every(([key, value]) => existing[key] === value), 'This release already exists with different metadata or availability; it was not overwritten');
  const { error: uploadError } = await db.storage.from('store-installers').upload(objectKey, bytes, { upsert: false, contentType: manifest.artifact_kind === 'test' ? (filename.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8') : 'application/octet-stream' });
  requireValid(!uploadError || String(uploadError.statusCode) === '409', 'Private upload failed; inspect provider status without logging secrets');
  const { data: stored, error: downloadError } = await db.storage.from('store-installers').download(objectKey);
  requireValid(!downloadError && stored, 'Cannot verify the stored object');
  const storedBytes = Buffer.from(await stored.arrayBuffer());
  requireValid(storedBytes.length === bytes.length && createHash('sha256').update(storedBytes).digest('hex') === sha256, 'Stored bytes differ from the approved artifact');
  let release = existing;
  if (!release) {
    const registered = await db.rpc('store_admin_release', { p_actor: manifest.actor_id, p_data: data });
    requireValid(!registered.error, 'Release registration failed; private artifact retained for recovery');
    release = registered.data;
  }
  return { id: release.id, version: release.version, artifact_kind: release.artifact_kind, file_size: bytes.length, sha256, status: release.status, alreadyImported: !!existing };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [manifestPath] = process.argv.slice(2);
  if (!manifestPath) throw new Error('Usage: node --env-file=.env.store tools/store-import-release.mjs <approved-manifest.json>');
  try { console.log(JSON.stringify(await importRelease(manifestPath))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
