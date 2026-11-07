import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CONTENT_FILES, listContentRevisions, readContentPointer, readContentRevision,
  readPublishedContent,
} from '../server/src/services/contentPublication.js';
import { readArtworkObject, type ArtworkEntry } from '../server/src/services/contentArtwork.js';

const FORMAT = 'morkahja-content-backup-v1';
const MAX_BACKUP_MANIFEST_BYTES = 32 * 1024 * 1024;
const MAX_AUDIT_BYTES = 256 * 1024 * 1024;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, '..');

interface BackupFile {
  path: string;
  bytes: number;
  sha256: string;
}
export interface ContentBackupManifest {
  format: typeof FORMAT;
  createdAt: string;
  currentRevision: string;
  currentManifestSha256: string;
  revisions: string[];
  files: BackupFile[];
}
export class ContentBackupError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ContentBackupError';
  }
}
function fail(code: string): never { throw new ContentBackupError(code); }
function digest(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}
function inside(parent: string, candidate: string): boolean {
  const rel = relative(parent, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
}
function overlaps(a: string, b: string): boolean {
  return inside(a, b) || inside(b, a);
}
function realDirectory(path: string, code: string): string {
  let info;
  try { info = lstatSync(path); } catch { return fail(code); }
  if (info.isSymbolicLink() || !info.isDirectory()) fail(code);
  return realpathSync(path);
}
function assertStorePaths(source: string, destination: string, repo = repositoryRoot): void {
  const sourcePath = realDirectory(source, 'CONTENT_BACKUP_SOURCE_UNAVAILABLE');
  const destinationPath = realDirectory(destination, 'CONTENT_BACKUP_DESTINATION_UNAVAILABLE');
  const repoPath = realpathSync(repo);
  if (overlaps(sourcePath, repoPath)) fail('CONTENT_ROOT_MUST_BE_OUTSIDE_APPLICATION');
  if (overlaps(destinationPath, repoPath)) fail('CONTENT_BACKUP_MUST_BE_OUTSIDE_APPLICATION');
  if (overlaps(sourcePath, destinationPath)) fail('CONTENT_BACKUP_PATH_OVERLAP');
  const webRoot = process.env.MORKAHJA_DEPLOY_WEB_ROOT;
  if (webRoot) {
    const webPath = realDirectory(webRoot, 'CONTENT_WEB_ROOT_UNAVAILABLE');
    if (overlaps(sourcePath, webPath) || overlaps(destinationPath, webPath)) {
      fail('CONTENT_BACKUP_MUST_BE_OUTSIDE_WEB_ROOT');
    }
  }
}
function writeDurable(path: string, bytes: Buffer): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
function readSafe(path: string, maxBytes = Number.MAX_SAFE_INTEGER): Buffer {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes) fail('CONTENT_BACKUP_UNSAFE_FILE');
  const bytes = readFileSync(path);
  if (bytes.length !== info.size) fail('CONTENT_BACKUP_FILE_CHANGED');
  return bytes;
}
function addFile(root: string, relativePath: string, bytes: Buffer, files: BackupFile[]): void {
  const output = join(root, ...relativePath.split('/'));
  writeDurable(output, bytes);
  files.push({ path: relativePath, bytes: bytes.length, sha256: digest(bytes) });
}
function safeRelativePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('/') ||
      value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) return false;
  return value === 'current.json' || value === 'admin-audit.jsonl' ||
    /^revisions\/[0-9a-f-]{36}\/(manifest\.json|encountersdata\.json|solutiondata\.json|expansiondata\.json|frames\.json|portraits\.json)$/.test(value) ||
    /^artwork\/objects\/[0-9a-f]{64}\.webp$/.test(value);
}
function allFiles(root: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const name of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? prefix + '/' + name.name : name.name;
    const full = join(root, ...rel.split('/'));
    const info = lstatSync(full);
    if (info.isSymbolicLink()) fail('CONTENT_BACKUP_UNSAFE_FILE');
    if (info.isDirectory()) found.push(...allFiles(root, rel));
    else if (info.isFile()) found.push(rel);
    else fail('CONTENT_BACKUP_UNSAFE_FILE');
  }
  return found.sort();
}
function writeBackupManifest(root: string, manifest: ContentBackupManifest): void {
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  writeDurable(join(root, 'backup.json'), bytes);
}
function validateBackupManifest(value: unknown): ContentBackupManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('CONTENT_BACKUP_INVALID_MANIFEST');
  const item = value as Record<string, unknown>;
  if (item.format !== FORMAT || typeof item.createdAt !== 'string' ||
      typeof item.currentRevision !== 'string' ||
      typeof item.currentManifestSha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(item.currentManifestSha256) ||
      !Array.isArray(item.revisions) || !Array.isArray(item.files)) {
    fail('CONTENT_BACKUP_INVALID_MANIFEST');
  }
  const files: BackupFile[] = [];
  const seen = new Set<string>();
  for (const entry of item.files) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('CONTENT_BACKUP_INVALID_MANIFEST');
    const file = entry as Record<string, unknown>;
    if (!safeRelativePath(file.path) || seen.has(file.path) ||
        !Number.isSafeInteger(file.bytes) || Number(file.bytes) < 0 ||
        typeof file.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      fail('CONTENT_BACKUP_INVALID_MANIFEST');
    }
    seen.add(file.path);
    files.push({ path: file.path, bytes: Number(file.bytes), sha256: file.sha256 });
  }
  const revisions = item.revisions.map(value => {
    if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) fail('CONTENT_BACKUP_INVALID_MANIFEST');
    return value;
  });
  return {
    format: FORMAT, createdAt: item.createdAt, currentRevision: item.currentRevision,
    currentManifestSha256: item.currentManifestSha256, revisions, files,
  };
}
export function verifyContentBackup(backupRoot: string): ContentBackupManifest {
  const root = realDirectory(resolve(backupRoot), 'CONTENT_BACKUP_UNAVAILABLE');
  const backupBytes = readSafe(join(root, 'backup.json'), MAX_BACKUP_MANIFEST_BYTES);
  let parsed: unknown;
  try { parsed = JSON.parse(backupBytes.toString('utf8')); }
  catch { return fail('CONTENT_BACKUP_INVALID_MANIFEST'); }
  const manifest = validateBackupManifest(parsed);
  for (const file of manifest.files) {
    const bytes = readSafe(join(root, ...file.path.split('/')));
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) fail('CONTENT_BACKUP_CHECKSUM_MISMATCH');
  }
  const expected = [...manifest.files.map(file => file.path), 'backup.json'].sort();
  if (JSON.stringify(allFiles(root)) !== JSON.stringify(expected)) fail('CONTENT_BACKUP_FILE_SET_MISMATCH');

  const pointer = readContentPointer(root);
  const current = readPublishedContent(root, pointer);
  const revisions = listContentRevisions(root).map(item => item.revision).sort();
  if (pointer.revision !== manifest.currentRevision ||
      digest(readSafe(join(root, 'revisions', pointer.revision, 'manifest.json'))) !== manifest.currentManifestSha256 ||
      JSON.stringify(revisions) !== JSON.stringify([...manifest.revisions].sort()) ||
      !revisions.includes(current.revision)) {
    fail('CONTENT_BACKUP_REVISION_MISMATCH');
  }
  return manifest;
}
export function createContentBackup(
  sourceRoot: string,
  destinationRoot: string,
  options: { confirmOffHost: boolean; repoRoot?: string } = { confirmOffHost: false },
): string {
  if (!options.confirmOffHost) fail('CONTENT_BACKUP_OFF_HOST_CONFIRMATION_REQUIRED');
  assertStorePaths(resolve(sourceRoot), resolve(destinationRoot), options.repoRoot ?? repositoryRoot);
  const source = realDirectory(resolve(sourceRoot), 'CONTENT_BACKUP_SOURCE_UNAVAILABLE');
  const destination = realDirectory(resolve(destinationRoot), 'CONTENT_BACKUP_DESTINATION_UNAVAILABLE');
  const lockPath = join(source, '.publication.lock');
  let lockFd: number;
  try { lockFd = openSync(lockPath, 'wx', 0o600); }
  catch { return fail('CONTENT_PUBLICATION_LOCKED'); }

  const temporaryName = '.morkahja-content-' + Date.now() + '-' + randomUUID() + '.tmp';
  const temporaryPath = join(destination, temporaryName);
  let finalPath = '';
  try {
    writeFileSync(lockFd, 'content-backup ' + new Date().toISOString() + '\n');
    fsyncSync(lockFd);
    const pointer = readContentPointer(source);
    const current = readPublishedContent(source, pointer);
    const revisions = listContentRevisions(source);
    if (!revisions.some(item => item.revision === current.revision)) fail('CONTENT_BACKUP_REVISION_MISMATCH');

    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const backupName = 'morkahja-content-' + stamp + '-' + pointer.revision;
    finalPath = join(destination, backupName);
    if (existsSync(finalPath)) fail('CONTENT_BACKUP_ALREADY_EXISTS');
    mkdirSync(temporaryPath, { mode: 0o700 });

    const files: BackupFile[] = [];
    addFile(temporaryPath, 'current.json', readSafe(join(source, 'current.json'), 4096), files);
    const objectEntries = new Map<string, ArtworkEntry>();
    for (const manifest of revisions) {
      const published = readContentRevision(source, manifest.revision);
      const revisionDirectory = join(source, 'revisions', manifest.revision);
      addFile(temporaryPath, 'revisions/' + manifest.revision + '/manifest.json',
        readSafe(join(revisionDirectory, 'manifest.json'), 16 * 1024), files);
      for (const kind of Object.keys(CONTENT_FILES) as (keyof typeof CONTENT_FILES)[]) {
        addFile(temporaryPath, 'revisions/' + manifest.revision + '/' + CONTENT_FILES[kind],
          readSafe(join(revisionDirectory, CONTENT_FILES[kind]), 8 * 1024 * 1024), files);
      }
      for (const entries of Object.values(published.manifest.assets ?? {})) {
        for (const entry of Object.values(entries ?? {})) {
          const existing = objectEntries.get(entry.sha256);
          if (existing && (existing.bytes !== entry.bytes || existing.width !== entry.width || existing.height !== entry.height)) {
            fail('CONTENT_BACKUP_ARTWORK_COLLISION');
          }
          objectEntries.set(entry.sha256, entry);
        }
      }
    }
    for (const [sha, entry] of [...objectEntries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      addFile(temporaryPath, 'artwork/objects/' + sha + '.webp', readArtworkObject(source, entry), files);
    }
    const auditPath = join(source, 'admin-audit.jsonl');
    if (existsSync(auditPath)) {
      addFile(temporaryPath, 'admin-audit.jsonl', readSafe(auditPath, MAX_AUDIT_BYTES), files);
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    const rawManifest = readSafe(join(source, 'revisions', pointer.revision, 'manifest.json'), 16 * 1024);
    const backupManifest: ContentBackupManifest = {
      format: FORMAT, createdAt: new Date().toISOString(),
      currentRevision: pointer.revision, currentManifestSha256: digest(rawManifest),
      revisions: revisions.map(item => item.revision).sort(), files,
    };
    writeBackupManifest(temporaryPath, backupManifest);
    verifyContentBackup(temporaryPath);
    renameSync(temporaryPath, finalPath);
    const directoryFd = openSync(destination, 'r');
    try { fsyncSync(directoryFd); } finally { closeSync(directoryFd); }
    return finalPath;
  } catch (error) {
    rmSync(temporaryPath, { recursive: true, force: true });
    throw error;
  } finally {
    closeSync(lockFd);
    unlinkSync(lockPath);
  }
}
export function restoreContentBackup(
  backupRoot: string,
  destinationRoot: string,
  options: { repoRoot?: string } = {},
): { destination: string; revision: string } {
  const backup = realDirectory(resolve(backupRoot), 'CONTENT_BACKUP_UNAVAILABLE');
  const manifest = verifyContentBackup(backup);
  const requestedDestination = resolve(destinationRoot);
  const parent = realDirectory(dirname(requestedDestination), 'CONTENT_RESTORE_PARENT_UNAVAILABLE');
  const destination = join(parent, basename(requestedDestination));
  if (existsSync(destination)) fail('CONTENT_RESTORE_DESTINATION_EXISTS');
  try { lstatSync(destination); fail('CONTENT_RESTORE_DESTINATION_EXISTS'); }
  catch (error) {
    if (error instanceof ContentBackupError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const repo = realpathSync(options.repoRoot ?? repositoryRoot);
  if (overlaps(destination, repo) || overlaps(destination, backup)) fail('CONTENT_RESTORE_PATH_OVERLAP');
  const activeRoot = process.env.MORKAHJA_CONTENT_ROOT;
  if (activeRoot && overlaps(destination, resolve(activeRoot))) fail('CONTENT_RESTORE_PATH_OVERLAP');
  const webRoot = process.env.MORKAHJA_DEPLOY_WEB_ROOT;
  if (webRoot && overlaps(destination, realDirectory(webRoot, 'CONTENT_WEB_ROOT_UNAVAILABLE'))) {
    fail('CONTENT_RESTORE_PATH_OVERLAP');
  }

  mkdirSync(destination, { mode: 0o700 });
  try {
    for (const file of manifest.files) {
      const bytes = readSafe(join(backup, ...file.path.split('/')));
      writeDurable(join(destination, ...file.path.split('/')), bytes);
    }
    const pointer = readContentPointer(destination);
    const restored = readPublishedContent(destination, pointer);
    const revisions = listContentRevisions(destination).map(item => item.revision).sort();
    if (restored.revision !== manifest.currentRevision ||
        JSON.stringify(revisions) !== JSON.stringify([...manifest.revisions].sort())) {
      fail('CONTENT_RESTORE_VERIFICATION_FAILED');
    }
    return { destination, revision: restored.revision };
  } catch (error) {
    rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}
function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const destination = option(process.argv.slice(2), '--destination');
    const source = process.env.MORKAHJA_CONTENT_ROOT;
    const confirmOffHost = process.argv.includes('--confirm-off-host');
    if (!source || !isAbsolute(source)) fail('MORKAHJA_CONTENT_ROOT_MUST_BE_ABSOLUTE');
    if (!destination || !isAbsolute(destination)) fail('CONTENT_BACKUP_DESTINATION_MUST_BE_ABSOLUTE');
    const created = createContentBackup(source, destination, { confirmOffHost });
    const verified = verifyContentBackup(created);
    process.stdout.write('Verified content backup: ' + created + '\nRevision: ' + verified.currentRevision + '\n');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CONTENT_BACKUP_FAILED';
    process.stderr.write(code + '\n');
    process.exitCode = 1;
  }
}
