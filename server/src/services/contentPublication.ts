import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { prepareArtworkForPublication, validateArtworkManifest, type ArtworkManifest } from './contentArtwork.js';

export const CONTENT_FILES = {
  encounters: 'encountersdata.json',
  solutions: 'solutiondata.json',
  expansions: 'expansiondata.json',
  frames: 'frames.json',
  portraits: 'portraits.json',
} as const;
export type ContentKind = keyof typeof CONTENT_FILES;
export type ContentBundle = Record<ContentKind, unknown>;

export interface ContentManifest {
  revision: string;
  previousRevision: string | null;
  publicationId: string;
  createdAt: string;
  operation: 'initial' | 'publish' | 'rollback';
  restoredFrom?: string;
  files: Record<ContentKind, { sha256: string; bytes: number }>;
  /** Managed WebP image names resolved to immutable objects by this revision. */
  assets?: ArtworkManifest;
  /** Exact stage tokens used by a publication for safe retry identification. */
  assetStageIds?: string[];
}

export interface ContentPointer {
  revision: string;
  manifestSha256: string;
}

export interface PublishedContent {
  revision: string;
  manifest: ContentManifest;
  content: ContentBundle;
}

export class ContentPublicationError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
    this.name = 'ContentPublicationError';
  }
}

function fail(code: string): never { throw new ContentPublicationError(code); }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function digest(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex');
}
function parse(text: string): unknown {
  try { return JSON.parse(text) as unknown; } catch { return fail('CONTENT_INVALID_JSON'); }
}
function num(value: unknown, max = 1_000_000_000): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max;
}
function str(value: unknown): boolean {
  return typeof value === 'string' && value.length <= 16_384;
}
function imageName(value: unknown): boolean {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}(?:[.]webp)?$/.test(value);
}
function checked(entry: Record<string, unknown>, numbers: string[], strings: string[], title: string): void {
  for (const key of numbers) if (!num(entry[key])) fail(`CONTENT_INVALID_FIELD:${title}.${key}`);
  for (const key of strings) if (!str(entry[key])) fail(`CONTENT_INVALID_FIELD:${title}.${key}`);
}
function validateMap(
  data: unknown, idField: string, numbers: string[], strings: string[], category: string,
): Record<string, Record<string, unknown>> {
  if (!record(data) || Object.keys(data).length > 20_000) fail(`CONTENT_INVALID_${category}`);
  const ids = new Set<number>();
  for (const [key, value] of Object.entries(data)) {
    if (!/^[0-9]{1,9}$/.test(key) || !record(value)) fail(`CONTENT_INVALID_KEY:${category}`);
    const id = Number(key);
    checked(value, [idField, ...numbers], strings, category);
    if (!num(id) || id === 0 || value[idField] !== id || ids.has(id)) fail(`CONTENT_INVALID_ID:${category}`);
    ids.add(id);
  }
  return data as Record<string, Record<string, unknown>>;
}
function validateIndexed(data: unknown, wrapper: string, idField: string, numbers: string[], strings: string[]): void {
  if (!record(data) || !Array.isArray(data[wrapper])) fail(`CONTENT_INVALID_${wrapper}`);
  const items = data[wrapper] as unknown[];
  if (items.length < 1 || items.length > 10_001 || items[0] !== null) fail(`CONTENT_INVALID_${wrapper}`);
  for (let i = 1; i < items.length; i += 1) {
    if (!(i in items)) fail(`CONTENT_SPARSE_${wrapper}`);
    const item = items[i];
    if (item === null) continue;
    if (!record(item)) fail(`CONTENT_INVALID_${wrapper}`);
    checked(item, [idField, ...numbers], strings, wrapper);
    if (item[idField] !== i) fail(`CONTENT_INVALID_ID:${wrapper}`);
  }
}

/** Explicit validation; retains all existing field names and additional authored fields. */
export function validateContentBundle(input: unknown): asserts input is ContentBundle {
  if (!record(input)) fail('CONTENT_INVALID_BUNDLE');
  for (const kind of Object.keys(CONTENT_FILES) as ContentKind[]) {
    if (!Object.hasOwn(input, kind)) fail(`CONTENT_MISSING:${kind}`);
  }
  const encounters = validateMap(
    input.encounters, 'mEncounterID',
    ['mEncounterDifficulty', 'mEncounterExpansion', 'mEncounterFollow', 'mEncounterRewardAmount',
      'mEncounterRewardType', 'mEncounterSolutiuonA', 'mEncounterSolutiuonB', 'mEncounterSolutiuonC',
      'mEncounterSolutiuonD', 'mEncounterSolutiuonTypeA', 'mEncounterSolutiuonTypeB',
      'mEncounterSolutiuonTypeC', 'mEncounterSolutiuonTypeD', 'mEncounterType'],
    ['mEncounterImageName', 'mEncounterText', 'mEncounterTitle'], 'encounters',
  );
  const solutions = validateMap(
    input.solutions, 'mSolutionID',
    ['mSolutionInventoryType', 'mSolutionRewardType', 'mSolutionType', 'mSolutionUses'],
    ['mSolutionIconName', 'mSolutionName', 'mSolutionText'], 'solutions',
  );
  if (!record(input.expansions)) fail('CONTENT_INVALID_EXPANSIONS');
  const expansions = validateMap(
    input.expansions.expansions, 'mExtensioID',
    ['mExtensioCost', 'mExtensioReward'],
    ['mExtensioCollectionImage', 'mExtensioHeaderImage', 'mExtensioName',
      'mExtensioSummaryText', 'mExtensioText', 'mExtensioUnlockButton'], 'expansions',
  );
  for (const entry of Object.values(expansions)) {
    if (typeof entry.mExtensioActive !== 'boolean' ||
      (entry.mExtensioPriceEurCents !== undefined && !num(entry.mExtensioPriceEurCents))) {
      fail('CONTENT_INVALID_EXPANSION_FIELDS');
    }
  }
  validateIndexed(input.frames, 'Frames', 'frameID', ['frameGem', 'frameRace', 'frameRole', 'frameType'], []);
  validateIndexed(input.portraits, 'Avatar', 'avatarID',
    ['avatarGems', 'avatarGenderID', 'avatarRace', 'avatarRole', 'avatarType'], ['avatarName']);

  const encounterIds = new Set(Object.values(encounters).map(e => e.mEncounterID));
  const expansionIds = new Set(Object.values(expansions).map(e => e.mExtensioID));
  const solutionIds = new Set(Object.values(solutions).map(e => e.mSolutionID));
  for (const encounter of Object.values(encounters)) {
    if (!imageName(encounter.mEncounterImageName)) fail('CONTENT_INVALID_ENCOUNTER_IMAGE');
    if ((encounter.mEncounterFollow as number) > 0 && !encounterIds.has(encounter.mEncounterFollow)) fail('CONTENT_MISSING_FOLLOW');
    if ((encounter.mEncounterExpansion as number) > 0 && !expansionIds.has(encounter.mEncounterExpansion)) fail('CONTENT_MISSING_EXPANSION');
    for (const letter of ['A', 'B', 'C', 'D']) {
      const id = encounter[`mEncounterSolutiuon${letter}`] as number;
      if (id > 0 && !solutionIds.has(id)) fail('CONTENT_MISSING_SOLUTION');
    }
  }
  for (const solution of Object.values(solutions)) {
    if (!imageName(solution.mSolutionIconName)) fail('CONTENT_INVALID_SOLUTION_ICON');
  }
}
/**
 * IDs can already be present in inventories, progression, persisted avatars and
 * active rooms. No deletion or semantic repurposing of those identifiers is
 * allowed, even if a database happens not to contain a matching row today.
 */
function preserveIds(previous: ContentBundle, next: ContentBundle): void {
  const stableFields: Record<string, readonly string[]> = {
    encounters: ['mEncounterID', 'mEncounterType', 'mEncounterExpansion'],
    solutions: ['mSolutionID', 'mSolutionInventoryType', 'mSolutionType'],
    expansions: ['mExtensioID'],
    frames: ['frameID', 'frameRace', 'frameRole', 'frameType'],
    portraits: ['avatarID', 'avatarRace', 'avatarRole', 'avatarGenderID', 'avatarType'],
  };
  const assertStable = (kind: keyof typeof stableFields, before: unknown, after: unknown): void => {
    const original = before as Record<string, unknown>;
    const updated = after as Record<string, unknown>;
    for (const field of stableFields[kind]!) {
      if (original[field] !== updated[field]) fail('CONTENT_IDENTITY_CHANGE_NOT_SUPPORTED');
    }
  };
  for (const kind of ['encounters', 'solutions'] as const) {
    for (const key of Object.keys(previous[kind] as Record<string, unknown>)) {
      if (!Object.hasOwn(next[kind] as object, key)) fail('CONTENT_DELETION_NOT_SUPPORTED');
      const oldItem = (previous[kind] as Record<string, unknown>)[key];
      const newItem = (next[kind] as Record<string, unknown>)[key];
      assertStable(kind, oldItem, newItem);
    }
  }
  for (const [kind, wrapper] of [['expansions', 'expansions'], ['frames', 'Frames'], ['portraits', 'Avatar']] as const) {
    const oldData = (previous[kind] as Record<string, unknown>)[wrapper] as Record<string, unknown> | unknown[];
    const newData = (next[kind] as Record<string, unknown>)[wrapper] as Record<string, unknown> | unknown[];
    for (const key of Object.keys(oldData)) {
      const original = (oldData as Record<string, unknown>)[key];
      const current = (newData as Record<string, unknown>)[key];
      if (original != null && current == null) fail('CONTENT_DELETION_NOT_SUPPORTED');
      if (original != null && current != null) assertStable(kind, original, current);
    }
  }
}
const revisionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const publicationPattern = /^[a-zA-Z0-9_-]{8,100}$/;
function assertRoot(root: string): void {
  if (!isAbsolute(root)) fail('CONTENT_ROOT_MUST_BE_ABSOLUTE');
  if (!existsSync(root) || lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory()) {
    fail('CONTENT_ROOT_NOT_READY');
  }
}
function strictRead(path: string, limit = 8 * 1024 * 1024): string {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) fail('CONTENT_UNSAFE_FILE');
  return readFileSync(path, 'utf8');
}
function syncDirectory(path: string): void {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function durableWrite(path: string, data: string): void {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, data, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
}
function samePointer(a: ContentPointer, b: ContentPointer): boolean {
  return a.revision === b.revision && a.manifestSha256 === b.manifestSha256;
}
export function readContentPointer(root: string): ContentPointer {
  assertRoot(root);
  const pointer = parse(strictRead(join(root, 'current.json'), 4096));
  if (!record(pointer) || typeof pointer.revision !== 'string' || !revisionPattern.test(pointer.revision)
    || typeof pointer.manifestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(pointer.manifestSha256)) {
    fail('CONTENT_INVALID_POINTER');
  }
  return pointer as unknown as ContentPointer;
}
export function readContentRevision(root: string, revision: string): PublishedContent {
  assertRoot(root);
  if (!revisionPattern.test(revision)) fail('CONTENT_INVALID_REVISION');
  const path = join(root, 'revisions', revision);
  const manifestText = strictRead(join(path, 'manifest.json'), 16 * 1024);
  const manifest = parse(manifestText) as ContentManifest;
  if (!record(manifest) || manifest.revision !== revision || !record(manifest.files)) fail('CONTENT_INVALID_MANIFEST');
  const bundle = {} as ContentBundle;
  for (const kind of Object.keys(CONTENT_FILES) as ContentKind[]) {
    const file = manifest.files[kind];
    if (!record(file) || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)
      || !num(file.bytes, 8 * 1024 * 1024)) fail('CONTENT_INVALID_MANIFEST');
    const data = strictRead(join(path, CONTENT_FILES[kind]));
    if (Buffer.byteLength(data) !== file.bytes || digest(data) !== file.sha256) fail('CONTENT_CHECKSUM_MISMATCH');
    bundle[kind] = parse(data);
  }
  validateContentBundle(bundle);
  validateArtworkManifest(root, manifest.assets ?? {});
  return { revision, manifest, content: bundle };
}
/** Read the exact pointer selected by the caller, even if another writer advances current.json. */
export function readPublishedContent(root: string, selectedPointer?: ContentPointer): PublishedContent {
  const pointer = selectedPointer ?? readContentPointer(root);
  const result = readContentRevision(root, pointer.revision);
  const text = strictRead(join(root, 'revisions', pointer.revision, 'manifest.json'), 16 * 1024);
  if (digest(text) !== pointer.manifestSha256) fail('CONTENT_MANIFEST_CHECKSUM_MISMATCH');
  return result;
}
export function listContentRevisions(root: string): ContentManifest[] {
  assertRoot(root);
  const revisionsPath = join(root, 'revisions');
  if (!existsSync(revisionsPath)) return [];
  return readdirSync(revisionsPath).filter(name => revisionPattern.test(name))
    .map(revision => readContentRevision(root, revision).manifest)
    .sort((a,b) => a.createdAt.localeCompare(b.createdAt));
}

export interface PublicationRequest {
  baseRevision: string | null;
  publicationId: string;
  content: unknown;
  operation?: 'publish' | 'rollback';
  restoredFrom?: string;
  assetStages?: string[];
  /** For deterministic failure-injection tests only; never connect to the admin API. */
  beforePointerSwap?: () => void;
}
/** Explicit provisioning only: callers must create the root themselves. */
export function publishContentRevision(root: string, request: PublicationRequest): PublishedContent {
  assertRoot(root);
  if (!publicationPattern.test(request.publicationId)) fail('CONTENT_INVALID_PUBLICATION_ID');
  const lockPath = join(root, '.publication.lock');
  let lock: number;
  try { lock = openSync(lockPath, 'wx', 0o600); }
  catch { return fail('CONTENT_PUBLICATION_LOCKED'); }
  try {
    mkdirSync(join(root, 'revisions'), { recursive: true });
    const current = existsSync(join(root, 'current.json')) ? readPublishedContent(root) : null;
    // Idempotency is bound to exactly the same request, not merely a reused ID.
    const normalized = parse(JSON.stringify(request.content ?? null));
    validateContentBundle(normalized);
    const assetStages = request.assetStages ?? [];
    if (current?.manifest.publicationId === request.publicationId) {
      if (current.manifest.previousRevision !== request.baseRevision ||
          JSON.stringify(current.content) !== JSON.stringify(normalized) ||
          JSON.stringify(current.manifest.assetStageIds ?? []) !== JSON.stringify(assetStages) ||
          (request.operation === 'rollback' &&
            (current.manifest.operation !== 'rollback' ||
             current.manifest.restoredFrom !== request.restoredFrom)) ||
          (request.operation !== 'rollback' && current.manifest.operation === 'rollback')) {
        fail('CONTENT_PUBLICATION_ID_REUSED');
      }
      return current;
    }
    const existing = listContentRevisions(root).find(m => m.publicationId === request.publicationId);
    if (existing) fail('CONTENT_PUBLICATION_ID_REUSED');
    if ((current?.revision ?? null) !== request.baseRevision) fail('CONTENT_REVISION_CONFLICT');
    if (current) preserveIds(current.content, normalized);
    if (request.operation === 'rollback' && !request.restoredFrom) fail('CONTENT_INVALID_ROLLBACK');
    const rollbackAssets = request.operation === 'rollback'
      ? (readContentRevision(root, request.restoredFrom!).manifest.assets ?? {})
      : undefined;
    const assets = prepareArtworkForPublication(root, current, normalized, assetStages, rollbackAssets);

    const revision = randomUUID();
    const revisionDir = join(root, 'revisions', revision);
    const staged = join(root, 'revisions', `.${revision}.stage`);
    mkdirSync(staged, { mode: 0o700 });
    let moved = false;
    try {
      const files = {} as ContentManifest['files'];
      for (const kind of Object.keys(CONTENT_FILES) as ContentKind[]) {
        const data = JSON.stringify(normalized[kind], null, 2) + '\n';
        if (Buffer.byteLength(data) > 8 * 1024 * 1024) fail('CONTENT_FILE_TOO_LARGE');
        files[kind] = { sha256: digest(data), bytes: Buffer.byteLength(data) };
        durableWrite(join(staged, CONTENT_FILES[kind]), data);
      }
      const manifest: ContentManifest = {
        revision, previousRevision: current?.revision ?? null,
        publicationId: request.publicationId, createdAt: new Date().toISOString(),
        operation: current ? (request.operation ?? 'publish') : 'initial', files,
        ...(Object.keys(assets).length ? { assets } : {}),
        ...(assetStages.length ? { assetStageIds: [...assetStages] } : {}),
        ...(request.restoredFrom ? { restoredFrom: request.restoredFrom } : {}),
      };
      const manifestText = JSON.stringify(manifest, null, 2) + '\n';
      durableWrite(join(staged, 'manifest.json'), manifestText);
      syncDirectory(staged);
      renameSync(staged, revisionDir);
      moved = true;
      syncDirectory(join(root, 'revisions'));
      readContentRevision(root, revision); // verify before committing pointer
      request.beforePointerSwap?.();
      const nextPointer: ContentPointer = { revision, manifestSha256: digest(manifestText) };
      const pointerTmp = join(root, `.${revision}.current.tmp`);
      try {
        durableWrite(pointerTmp, JSON.stringify(nextPointer) + '\n');
        renameSync(pointerTmp, join(root, 'current.json'));
        syncDirectory(root);
      } finally { if (existsSync(pointerTmp)) unlinkSync(pointerTmp); }
      if (!samePointer(readContentPointer(root), nextPointer)) fail('CONTENT_POINTER_NOT_COMMITTED');
      return { revision, manifest, content: normalized };
    } finally {
      if (!moved) {
        for (const file of [...Object.values(CONTENT_FILES), 'manifest.json']) {
          const target = join(staged, file);
          if (existsSync(target)) unlinkSync(target);
        }
        if (existsSync(staged)) rmdirSync(staged);
      }
    }
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
export function restoreContentRevision(root: string, baseRevision: string, targetRevision: string, publicationId: string): PublishedContent {
  const old = readContentRevision(root, targetRevision);
  return publishContentRevision(root, {
    baseRevision, publicationId, content: old.content,
    operation: 'rollback', restoredFrom: targetRevision,
  });
}
