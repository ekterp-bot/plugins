import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const runFile = promisify(execFile);
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
const windowsDeviceName = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
export const cleanWindowsEnv = () => Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP', 'USERPROFILE'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
export const safePackagePath = value => typeof value === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,499}$/.test(value)
  && value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..' && !part.endsWith('.') && !windowsDeviceName.test(part));
export const safeNoticePath = value => safePackagePath(value)
  && /(?:\.(?:txt|md|h|hpp|c|cpp|cc|inc|pas|json)|(?:^|\/)(?:LICENSE|NOTICE|COPYING|SHA256SUMS|README|AUTHORS|PATENTS))$/i.test(value);

export async function verifyOrCreateZip(mode, file, entries) {
  if (process.platform !== 'win32') throw new Error('The trusted package workflow requires Windows PowerShell');
  if (!['Create', 'Verify'].includes(mode) || !Array.isArray(entries) || entries.length < 2 || entries.length > 65) throw new Error('Invalid package mode or entry count');
  const seen = new Set();
  let expectedBytes = 0;
  for (const entry of entries) {
    if (!safePackagePath(entry.path) || seen.has(entry.path.toLowerCase())) throw new Error('Unsafe or duplicate archive path');
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256) || !Number.isSafeInteger(entry.file_size) || entry.file_size < 1 || entry.file_size > MAX_ENTRY_BYTES) throw new Error('Invalid archive entry metadata');
    seen.add(entry.path.toLowerCase());
    expectedBytes += entry.file_size;
  }
  if (expectedBytes > MAX_EXPANDED_BYTES) throw new Error('Expanded archive exceeds preview limit');
  const folder = await mkdtemp(join(tmpdir(), 'hex-store-package-'));
  const manifest = join(folder, 'entries.json');
  try {
    await writeFile(manifest, JSON.stringify({ file, entries }));
    const { stdout } = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('./store-zip.ps1', import.meta.url)), '-Mode', mode, '-ManifestPath', manifest], { env: cleanWindowsEnv(), windowsHide: true, timeout: 60000, maxBuffer: 8192 });
    const result = JSON.parse(stdout);
    if (result.verified !== true || result.entries !== entries.length || result.expanded_bytes !== expectedBytes) throw new Error('Package verification failed');
    return result;
  } finally {
    // Delete only the exact unique direct child of the task's temp location.
    const cleanupTarget = resolve(folder);
    if (dirname(cleanupTarget) !== resolve(tmpdir()) || !basename(cleanupTarget).startsWith('hex-store-package-')) throw new Error('Refusing unexpected package cleanup path');
    await rm(cleanupTarget, { recursive: true, force: true });
  }
}
