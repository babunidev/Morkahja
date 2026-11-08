import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  publishContentRevision,
  readPublishedContent,
  validateContentBundle,
  type ContentBundle,
} from '../src/services/contentPublication.js';

export const LEGACY_CONTENT_FILES = [
  { kind: 'encounters', name: 'encountersdata.json' },
  { kind: 'solutions', name: 'solutiondata.json' },
  { kind: 'expansions', name: 'expansiondata.json' },
  { kind: 'frames', name: 'frames.json' },
  { kind: 'portraits', name: 'portraits.json' },
] as const;

const BACKUP_FORMAT = 'morkahja-legacy-content-backup-v1';
const MAX_LEGACY_FILE_BYTES = 64 * 1024 * 1024;
const DEFAULT_REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

type LegacyContentKind = typeof LEGACY_CONTENT_FILES[number]['kind'];
type MigrationEnvironment = 'staging' | 'production';

interface LegacyContentFile {
  kind: LegacyContentKind;
  name: string;
  bytes: Buffer;
  sha256: string;
}

interface LegacyBackupFile {
  kind: LegacyContentKind;
  name: string;
  bytes: number;
  sha256: string;
}

interface LegacyBackupManifest {
  format: typeof BACKUP_FORMAT;
  createdAt: string;
  files: LegacyBackupFile[];
}

export interface LegacyContentInspection {
  bundle: ContentBundle;
  files: LegacyContentFile[];
  counts: {
    encounters: number;
    solutions: number;
    expansions: number;
    frames: number;
    portraits: number;
  };
}

export interface InitializeLegacyContentOptions {
  sourceRoot: string;
  contentRoot: string;
  backupRoot: string;
  publicationId: string;
  environment: MigrationEnvironment;
  confirmOffHostBackup: boolean;
  confirmProductionCutover?: boolean;
  requireMountpoint?: boolean;
  repositoryRoot?: string;
  webRoot?: string;
}

export interface InitializeLegacyContentResult {
  backupDirectory: string;
  revision: string;
  counts: LegacyContentInspection['counts'];
  files: LegacyBackupFile[];
}

export class ContentInitializationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ContentInitializationError';
  }
}

function fail(message: string, code: string): never {
  throw new ContentInitializationError(message, code);
}

function sha256(bytes: Buffer | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function realDirectory(value: string, label: string): string {
  const absolute = path.resolve(value);
  let info: ReturnType<typeof lstatSync>;
  try {
    info = lstatSync(absolute);
  } catch {
    return fail(`${label} does not exist.`, 'DIRECTORY_UNAVAILABLE');
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    return fail(`${label} must be a real directory, not a symlink.`, 'UNSAFE_DIRECTORY');
  }
  return realpathSync(absolute);
}

function optionalRealDirectory(value: string, label: string): string {
  const absolute = path.resolve(value);
  if (!existsSync(absolute)) return absolute;
  return realDirectory(absolute, label);
}

function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === ''
    || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function assertDisjoint(first: string, second: string, code: string): void {
  if (isWithin(first, second) || isWithin(second, first)) {
    fail('Migration source, content, backup, repository and web roots must not overlap.', code);
  }
}

function countObject(value: unknown): number {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function inspectLegacyContent(sourceRoot: string): LegacyContentInspection {
  const source = realDirectory(sourceRoot, 'Legacy content source');
  const parsed: Partial<Record<LegacyContentKind, unknown>> = {};
  const files: LegacyContentFile[] = [];

  for (const entry of LEGACY_CONTENT_FILES) {
    const filePath = path.join(source, entry.name);
    let info: ReturnType<typeof lstatSync>;
    try {
      info = lstatSync(filePath);
    } catch {
      return fail(`Legacy dataset is missing: ${entry.name}`, 'SOURCE_FILE_MISSING');
    }
    if (info.isSymbolicLink() || !info.isFile()) {
      return fail(`Legacy dataset must be a regular file: ${entry.name}`, 'UNSAFE_SOURCE_FILE');
    }
    if (info.size > MAX_LEGACY_FILE_BYTES) {
      return fail(`Legacy dataset exceeds the size limit: ${entry.name}`, 'SOURCE_FILE_TOO_LARGE');
    }

    const bytes = readFileSync(filePath);
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString('utf8')) as unknown;
    } catch {
      return fail(`Legacy dataset contains invalid JSON: ${entry.name}`, 'INVALID_SOURCE_JSON');
    }
    parsed[entry.kind] = value;
    files.push({ ...entry, bytes, sha256: sha256(bytes) });
  }

  const bundle = parsed as ContentBundle;
  validateContentBundle(bundle);

  const expansionRoot = bundle.expansions as { expansions?: unknown };
  const frameRoot = bundle.frames as { Frames?: unknown };
  const portraitRoot = bundle.portraits as { Avatar?: unknown };

  return {
    bundle,
    files,
    counts: {
      encounters: countObject(bundle.encounters),
      solutions: countObject(bundle.solutions),
      expansions: countObject(expansionRoot.expansions),
      frames: countArray(frameRoot.Frames),
      portraits: countArray(portraitRoot.Avatar),
    },
  };
}

function validateMigrationTargets(
  options: InitializeLegacyContentOptions,
): { sourceRoot: string; contentRoot: string; backupRoot: string } {
  if (options.confirmOffHostBackup !== true) {
    fail('An explicit off-host backup confirmation is required before initialization.', 'BACKUP_NOT_CONFIRMED');
  }
  if (options.environment !== 'staging' && options.environment !== 'production') {
    fail('Migration environment must be staging or production.', 'INVALID_ENVIRONMENT');
  }
  if (process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING === '1') {
    fail('Admin content publishing must remain disabled during initial import.', 'PUBLISHING_ALREADY_ENABLED');
  }
  if (options.environment === 'production' && options.confirmProductionCutover !== true) {
    fail('Production initialization requires separate cutover approval.', 'PRODUCTION_CUTOVER_NOT_APPROVED');
  }

  const sourceRoot = realDirectory(options.sourceRoot, 'Legacy content source');
  const contentRoot = realDirectory(options.contentRoot, 'Content root');
  const backupRoot = realDirectory(options.backupRoot, 'Off-host backup root');
  const repositoryRoot = realDirectory(options.repositoryRoot ?? DEFAULT_REPOSITORY_ROOT, 'Repository root');
  const webRoot = optionalRealDirectory(
    options.webRoot
      ?? process.env.MORKAHJA_WEB_ROOT
      ?? process.env.MORKAHJA_DEPLOY_WEB_ROOT
      ?? '/var/www/morkahja',
    'Web root',
  );

  assertDisjoint(contentRoot, repositoryRoot, 'CONTENT_ROOT_NOT_EXTERNAL');
  assertDisjoint(contentRoot, webRoot, 'CONTENT_ROOT_IN_WEB_ROOT');
  assertDisjoint(backupRoot, repositoryRoot, 'BACKUP_ROOT_NOT_EXTERNAL');
  assertDisjoint(backupRoot, webRoot, 'BACKUP_ROOT_IN_WEB_ROOT');
  assertDisjoint(sourceRoot, contentRoot, 'SOURCE_CONTENT_ROOT_OVERLAP');
  assertDisjoint(sourceRoot, backupRoot, 'SOURCE_BACKUP_ROOT_OVERLAP');
  assertDisjoint(contentRoot, backupRoot, 'CONTENT_BACKUP_ROOT_OVERLAP');

  if (readdirSync(contentRoot).length !== 0) {
    fail('Initial content root must be empty; refusing to overwrite an existing store.', 'CONTENT_ROOT_NOT_EMPTY');
  }

  if (options.requireMountpoint !== false) {
    try {
      execFileSync('mountpoint', ['-q', backupRoot], { stdio: 'ignore' });
    } catch {
      fail('Backup root is not a mounted filesystem; refusing to write an on-host backup.', 'BACKUP_ROOT_NOT_MOUNTED');
    }
  }

  return { sourceRoot, contentRoot, backupRoot };
}

function syncFile(filePath: string): void {
  const descriptor = openSync(filePath, 'r+');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function syncDirectory(directory: string): void {
  const descriptor = openSync(directory, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function backupRecords(files: LegacyContentFile[]): LegacyBackupFile[] {
  return files.map(({ kind, name, bytes, sha256: digest }) => ({
    kind, name, bytes: bytes.length, sha256: digest,
  }));
}

function verifyLegacyBackup(directory: string, expectedFiles: LegacyBackupFile[]): LegacyBackupManifest {
  const manifestPath = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as LegacyBackupManifest;
  if (manifest.format !== BACKUP_FORMAT || !isDeepStrictEqual(manifest.files, expectedFiles)) {
    fail('Legacy backup manifest does not match the verified source inventory.', 'BACKUP_MANIFEST_MISMATCH');
  }

  const expectedNames = [...expectedFiles.map(file => file.name), 'manifest.json'].sort();
  if (!isDeepStrictEqual(readdirSync(directory).sort(), expectedNames)) {
    fail('Legacy backup contains missing or unexpected files.', 'BACKUP_FILE_SET_MISMATCH');
  }

  for (const expected of expectedFiles) {
    const filePath = path.join(directory, expected.name);
    const info = lstatSync(filePath);
    if (info.isSymbolicLink() || !info.isFile()) {
      fail(`Legacy backup file is not a regular file: ${expected.name}`, 'UNSAFE_BACKUP_FILE');
    }
    const bytes = readFileSync(filePath);
    if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) {
      fail(`Legacy backup checksum verification failed: ${expected.name}`, 'BACKUP_CHECKSUM_MISMATCH');
    }
  }

  return manifest;
}

function createVerifiedLegacyBackup(
  backupRoot: string,
  files: LegacyContentFile[],
): string {
  const backupName = `legacy-content-${Date.now()}-${randomUUID()}`;
  const temporaryDirectory = path.join(backupRoot, `.${backupName}.tmp`);
  const finalDirectory = path.join(backupRoot, backupName);
  const records = backupRecords(files);
  const manifest: LegacyBackupManifest = {
    format: BACKUP_FORMAT,
    createdAt: new Date().toISOString(),
    files: records,
  };

  mkdirSync(temporaryDirectory, { mode: 0o700 });
  try {
    for (const file of files) {
      const filePath = path.join(temporaryDirectory, file.name);
      writeFileSync(filePath, file.bytes, { flag: 'wx', mode: 0o600 });
      syncFile(filePath);
    }

    const manifestPath = path.join(temporaryDirectory, 'manifest.json');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    syncFile(manifestPath);
    syncDirectory(temporaryDirectory);
    verifyLegacyBackup(temporaryDirectory, records);

    renameSync(temporaryDirectory, finalDirectory);
    syncDirectory(backupRoot);
    verifyLegacyBackup(finalDirectory, records);
    return finalDirectory;
  } catch (error) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

export function initializeLegacyContent(
  options: InitializeLegacyContentOptions,
): InitializeLegacyContentResult {
  const inspection = inspectLegacyContent(options.sourceRoot);
  const targets = validateMigrationTargets(options);
  const backupDirectory = createVerifiedLegacyBackup(targets.backupRoot, inspection.files);

  // The verified source backup is durable before the initial content pointer can be written.
  const published = publishContentRevision(targets.contentRoot, {
    baseRevision: null,
    publicationId: options.publicationId,
    content: inspection.bundle,
  });
  const readBack = readPublishedContent(targets.contentRoot);
  if (
    readBack.revision !== published.revision
    || !isDeepStrictEqual(readBack.content, inspection.bundle)
  ) {
    fail('Published initial content does not match the verified legacy source.', 'PUBLISHED_CONTENT_MISMATCH');
  }

  return {
    backupDirectory,
    revision: published.revision,
    counts: inspection.counts,
    files: backupRecords(inspection.files),
  };
}

function parseArguments(argv: string[]): { values: Map<string, string>; flags: Set<string> } {
  const valueOptions = new Set(['--environment', '--source', '--publication-id', '--backup-root']);
  const flagOptions = new Set([
    '--apply',
    '--confirm-off-host-backup',
    '--confirm-production-cutover',
  ]);
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    if (valueOptions.has(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail(`Missing value for ${argument}`, 'INVALID_ARGUMENTS');
      values.set(argument, value);
      index += 1;
    } else if (flagOptions.has(argument)) {
      flags.add(argument);
    } else {
      fail(`Unknown argument: ${argument}`, 'INVALID_ARGUMENTS');
    }
  }

  return { values, flags };
}

async function runCli(): Promise<void> {
  const { values, flags } = parseArguments(process.argv.slice(2));
  const environment = values.get('--environment') as MigrationEnvironment | undefined;
  const sourceRoot = values.get('--source');
  const contentRoot = process.env.MORKAHJA_CONTENT_ROOT;
  const backupRoot = values.get('--backup-root') ?? process.env.MORKAHJA_CONTENT_BACKUP_ROOT;
  const publicationId = values.get('--publication-id');

  if (!environment || !sourceRoot || !contentRoot || !backupRoot || !publicationId) {
    fail(
      'Usage: content:initialize -- --environment staging|production --source <legacy-game-dir> --publication-id <id> [--backup-root <mount>] [--apply --confirm-off-host-backup] [--confirm-production-cutover]',
      'INVALID_ARGUMENTS',
    );
  }

  const apply = flags.has('--apply');
  const common = {
    sourceRoot: path.resolve(sourceRoot),
    contentRoot: path.resolve(contentRoot),
    backupRoot: path.resolve(backupRoot),
    publicationId,
    environment,
    confirmOffHostBackup: flags.has('--confirm-off-host-backup'),
    confirmProductionCutover: flags.has('--confirm-production-cutover'),
  };

  if (!apply) {
    const inspection = inspectLegacyContent(common.sourceRoot);
    validateMigrationTargets({
      ...common,
      confirmOffHostBackup: true,
      requireMountpoint: false,
    });
    process.stdout.write(`${JSON.stringify({
      mode: 'dry-run',
      environment,
      datasets: inspection.files.map(({ kind, name, bytes, sha256: digest }) => ({
        kind, name, bytes: bytes.length, sha256: digest,
      })),
      counts: inspection.counts,
      contentRoot: common.contentRoot,
      backupRoot: common.backupRoot,
      writesPerformed: false,
    }, null, 2)}\n`);
    return;
  }

  const result = initializeLegacyContent({
    ...common,
    confirmOffHostBackup: flags.has('--confirm-off-host-backup'),
    confirmProductionCutover: flags.has('--confirm-production-cutover'),
  });
  process.stdout.write(`${JSON.stringify({
    mode: 'initialized',
    environment,
    revision: result.revision,
    backupDirectory: result.backupDirectory,
    counts: result.counts,
    files: result.files,
  }, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  void runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown content initialization failure.';
    process.stderr.write(`[content:initialize] ${message}\n`);
    process.exitCode = 1;
  });
}
