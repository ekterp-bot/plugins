// Local packaging only. Never modifies the installer or uploads any bytes.
import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyOrCreateZip, safePackagePath, safeNoticePath } from './store-package-utils.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValid = (ok, message) => { if (!ok) throw new Error(message); };
async function descriptor(path, source) {
  requireValid(safePackagePath(path), 'Unsafe package path');
  const info = await stat(source);
  requireValid(info.isFile() && info.size > 0 && info.size <= 50 * 1024 * 1024, 'Invalid package source size');
  const bytes = await readFile(source);
  return { path, source, sha256: hash(bytes), file_size: bytes.length };
}

export async function packageRelease(inputPath) {
  const path = resolve(inputPath);
  const input = JSON.parse(await readFile(path, 'utf8'));
  const local = value => resolve(dirname(path), value);
  const engineering = JSON.parse(await readFile(local(input.engineering_manifest), 'utf8'));
  requireValid(engineering.product_id === 'nebula' && engineering.version === '0.1.0' && engineering.artifact_kind === 'installer', 'Unexpected engineering release');
  const installer = await descriptor(engineering.installer_filename, resolve(dirname(local(input.engineering_manifest)), engineering.installer_filename));
  requireValid(installer.sha256 === engineering.sha256.toLowerCase() && installer.file_size === engineering.file_size, 'Installer differs from engineering manifest');
  const noticeRoot = local(input.notices_directory);
  const indexBytes = await readFile(join(noticeRoot, 'SHA256SUMS.txt'));
  requireValid(hash(indexBytes) === input.notices_index_sha256.toLowerCase(), 'Notice index differs from approved engineering evidence');
  const notices = [];
  const listed = new Set(['SHA256SUMS.txt']);
  for (const line of indexBytes.toString('utf8').trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64})\s{2}(.+)$/i.exec(line);
    requireValid(match && safeNoticePath(match[2]) && !listed.has(match[2]), 'Invalid notice index entry');
    const source = resolve(noticeRoot, match[2]);
    requireValid(source.startsWith(resolve(noticeRoot) + sep), 'Notice path escapes its directory');
    const entry = await descriptor(`third-party-notices/${match[2]}`, source);
    requireValid(entry.sha256 === match[1].toLowerCase(), 'A required notice checksum differs');
    notices.push(entry); listed.add(match[2]);
  }
  const actual = [];
  async function walk(folder, prefix = '') {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      requireValid(!entry.isSymbolicLink(), 'Notice symlinks are not accepted');
      if (entry.isDirectory()) await walk(join(folder, entry.name), `${prefix}${entry.name}/`);
      else { requireValid(entry.isFile(), 'Unexpected notice file type'); actual.push(`${prefix}${entry.name}`); }
    }
  }
  await walk(noticeRoot);
  requireValid(actual.length === listed.size && actual.every(name => listed.has(name)), 'Notice tree differs from its complete checksum index');
  notices.push(await descriptor('third-party-notices/SHA256SUMS.txt', join(noticeRoot, 'SHA256SUMS.txt')));
  for (const [target, source] of Object.entries(input.companions || {})) {
    requireValid(['LICENSE.txt', 'README.txt', 'INSTALLATION.txt', 'RELEASE-NOTES.txt'].includes(target), 'Companions must be the reviewed customer documents');
    notices.push(await descriptor(target, local(source)));
  }
  const entries = [installer, ...notices].sort((a, b) => a.path.localeCompare(b.path));
  requireValid(new Set(entries.map(entry => entry.path.toLowerCase())).size === entries.length, 'Duplicate package entry');
  const output = local(input.output_file);
  await mkdir(dirname(output), { recursive: true });
  await verifyOrCreateZip('Create', output, entries);
  const zip = await descriptor(basename(output), output);
  const stage = {
    file: output, product_id: engineering.product_id, version: engineering.version, actor_id: input.actor_id,
    artifact_kind: 'installer', channel: 'private_beta', coverage_major: 1, package_format: 'zip',
    sha256: zip.sha256, file_size: zip.file_size, signing_status: 'unsigned',
    installer_file: installer.source, installer_path: installer.path, installer_sha256: installer.sha256, installer_file_size: installer.file_size,
    mandatory_notices: notices.map(({ source, ...entry }) => entry),
    installer_verification_reference: `DIST-001 ${engineering.build.id}; exact installer SHA256 ${installer.sha256}`,
    notices_reference: `DIST-002 complete customer notice index SHA256 ${input.notices_index_sha256.toLowerCase()}; all ${listed.size} files bundled`,
    licensing_reference: input.licensing_reference,
    release_notes: input.release_notes || '', installation_notes: input.installation_notes || '',
  };
  await writeFile(local(input.stage_manifest), JSON.stringify(stage, null, 2), { flag: 'wx' });
  return { file: output, sha256: zip.sha256, file_size: zip.file_size, installer_sha256: installer.sha256, entries: entries.length, notices: notices.length, stage_manifest: local(input.stage_manifest), uploaded: false };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await packageRelease(process.argv[2]))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
