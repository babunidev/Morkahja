import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, constants, existsSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readFileSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  ContentPublicationError, type ContentBundle, type PublishedContent,
} from './contentPublication.js';

/** File-backed, content-addressed WebP store. All locations are outside the deployment. */
export const ARTWORK_KINDS = ['encounters', 'solutions', 'expansions', 'portraits', 'frames'] as const;
export type ArtworkKind = typeof ARTWORK_KINDS[number];
export const WEBP_MAX_BYTES = 4 * 1024 * 1024;
const WEBP_MAX_SIDE = 4096;
const WEBP_MAX_PIXELS = 16 * 1024 * 1024;
const SHA = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STEM = /^[a-zA-Z0-9_-]{1,120}$/;

export interface ArtworkEntry { sha256: string; bytes: number; width: number; height: number }
export type ArtworkManifest = Partial<Record<ArtworkKind, Record<string, ArtworkEntry>>>;
export interface ArtworkStage extends ArtworkEntry {
  id: string;
  kind: ArtworkKind;
  name: string;
  intent: 'create' | 'replace';
  baseRevision: string;
  createdAt: string;
}

function fail(code: string): never { throw new ContentPublicationError(code); }
function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function hash(buffer: Buffer): string { return createHash('sha256').update(buffer).digest('hex'); }
function safeDirectory(path: string, create: boolean): void {
  if (!existsSync(path)) {
    if (!create) fail('CONTENT_ARTWORK_UNAVAILABLE');
    mkdirSync(path, { mode: 0o700 });
  }
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('CONTENT_UNSAFE_ARTWORK_PATH');
}
function dirs(root: string, create = false): { art: string; objects: string; stages: string } {
  safeDirectory(root, false);
  const art = join(root, 'artwork');
  safeDirectory(art, create);
  const objects = join(art, 'objects');
  const stages = join(art, 'staged');
  safeDirectory(objects, create);
  safeDirectory(stages, create);
  return { art, objects, stages };
}
function publishedObjectsDirectory(root: string): string {
  safeDirectory(root, false);
  const art = join(root, 'artwork');
  safeDirectory(art, false);
  const objects = join(art, 'objects');
  safeDirectory(objects, false);
  return objects;
}
function flushDirectory(path: string): void {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeExclusive(path: string, bytes: Buffer): void {
  const fd = openSync(path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
function safeRead(path: string, maxBytes: number): Buffer {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maxBytes) {
    fail('CONTENT_UNSAFE_ARTWORK_FILE');
  }
  // O_NOFOLLOW prevents a symlink substituted after lstat from being opened.
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const bytes = readFileSync(fd);
    if (bytes.length !== stat.size) fail('CONTENT_ARTWORK_CHANGED');
    return bytes;
  } finally { closeSync(fd); }
}
export function artworkName(kind: ArtworkKind, raw: string): string {
  if (!ARTWORK_KINDS.includes(kind) || typeof raw !== 'string') fail('CONTENT_INVALID_ASSET_NAME');
  const name = raw.endsWith('.webp') ? raw.slice(0, -5) : raw;
  if (!STEM.test(name)) fail('CONTENT_INVALID_ASSET_NAME');
  if (kind === 'portraits' && !/^avatar_[1-9][0-9]*$/.test(name)) fail('CONTENT_INVALID_ASSET_NAME');
  if (kind === 'frames' && !/^frame_[1-9][0-9]*$/.test(name)) fail('CONTENT_INVALID_ASSET_NAME');
  return name;
}
/**
 * Validate the RIFF/WebP chunk structure and image dimensions, without
 * decoding pixels. Animated WebP is deliberately unsupported.
 */
export function inspectWebp(bytes: Buffer): { width: number; height: number } {
  if (!Buffer.isBuffer(bytes) || bytes.length < 25 || bytes.length > WEBP_MAX_BYTES ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' ||
      bytes.toString('ascii', 8, 12) !== 'WEBP' ||
      bytes.readUInt32LE(4) + 8 !== bytes.length) fail('CONTENT_INVALID_WEBP');
  let offset = 12;
  let picture: { width: number; height: number } | null = null;
  let extended: { width: number; height: number } | null = null;
  let chunkCount = 0;
  let imageCount = 0;
  while (offset + 8 <= bytes.length && chunkCount++ < 64) {
    const fourcc = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const at = offset + 8;
    const end = at + size;
    if (end > bytes.length || (end + (size % 2)) > bytes.length) fail('CONTENT_INVALID_WEBP');
    if (fourcc === 'ANIM' || fourcc === 'ANMF') fail('CONTENT_ANIMATED_WEBP_UNSUPPORTED');
    if (fourcc === 'VP8X') {
      if (extended || picture || size !== 10 || (bytes[at]! & 0x02)) fail('CONTENT_INVALID_WEBP');
      extended = {
        width: 1 + bytes.readUIntLE(at + 4, 3),
        height: 1 + bytes.readUIntLE(at + 7, 3),
      };
    } else if (fourcc === 'VP8 ') {
      if (++imageCount !== 1 || size < 10 ||
          (bytes[at]! & 1) !== 0 ||
          bytes[at + 3] !== 0x9d || bytes[at + 4] !== 0x01 || bytes[at + 5] !== 0x2a) {
        fail('CONTENT_INVALID_WEBP');
      }
      picture = {
        width: bytes.readUInt16LE(at + 6) & 0x3fff,
        height: bytes.readUInt16LE(at + 8) & 0x3fff,
      };
    } else if (fourcc === 'VP8L') {
      if (++imageCount !== 1 || size < 5 || bytes[at] !== 0x2f ||
          (bytes[at + 4]! >> 5) !== 0) fail('CONTENT_INVALID_WEBP');
      picture = {
        width: 1 + bytes[at + 1]! + ((bytes[at + 2]! & 0x3f) << 8),
        height: 1 + (bytes[at + 2]! >> 6) + (bytes[at + 3]! << 2) +
          ((bytes[at + 4]! & 0x0f) << 10),
      };
    }
    offset = end + (size % 2);
  }
  if (offset !== bytes.length || imageCount !== 1 || !picture ||
      (extended && (extended.width !== picture.width || extended.height !== picture.height))) {
    fail('CONTENT_INVALID_WEBP');
  }
  const { width, height } = picture;
  if (width < 1 || height < 1 || width > WEBP_MAX_SIDE || height > WEBP_MAX_SIDE ||
      width * height > WEBP_MAX_PIXELS) fail('CONTENT_INVALID_WEBP_DIMENSIONS');
  return { width, height };
}
function referencedNames(content: ContentBundle, kind: ArtworkKind): Set<string> {
  const set = new Set<string>();
  if (kind === 'portraits' || kind === 'frames') {
    const values = kind === 'portraits'
      ? (content.portraits as { Avatar: unknown[] }).Avatar
      : (content.frames as { Frames: unknown[] }).Frames;
    values.forEach((value, id) => {
      if (id !== 0 && value !== null && value !== undefined) {
        set.add((kind === 'portraits' ? 'avatar_' : 'frame_') + id);
      }
    });
    return set;
  }
  const rows = kind === 'expansions'
    ? Object.values((content.expansions as { expansions: Record<string, unknown> }).expansions)
    : Object.values(content[kind] as Record<string, unknown>);
  const fields = kind === 'encounters' ? ['mEncounterImageName']
    : kind === 'solutions' ? ['mSolutionIconName']
    : ['mExtensioCollectionImage', 'mExtensioHeaderImage', 'mExtensioUnlockButton'];
  for (const row of rows) {
    if (!plain(row)) continue;
    for (const field of fields) {
      const value = row[field];
      if (typeof value === 'string' && value !== '') set.add(artworkName(kind, value));
    }
  }
  return set;
}
export function readArtworkObject(root: string, entry: ArtworkEntry): Buffer {
  if (!SHA.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) ||
      entry.bytes < 25 || entry.bytes > WEBP_MAX_BYTES) fail('CONTENT_INVALID_ASSET_MANIFEST');
  // Serving published objects must not depend on the transient staged-token directory.
  const objects = publishedObjectsDirectory(root);
  const bytes = safeRead(join(objects, entry.sha256 + '.webp'), WEBP_MAX_BYTES);
  if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) fail('CONTENT_ARTWORK_CHECKSUM_MISMATCH');
  const dims = inspectWebp(bytes);
  if (dims.width !== entry.width || dims.height !== entry.height) fail('CONTENT_ARTWORK_DIMENSIONS_MISMATCH');
  return bytes;
}
export function validateArtworkManifest(root: string, value: unknown): asserts value is ArtworkManifest {
  if (!plain(value)) fail('CONTENT_INVALID_ASSET_MANIFEST');
  let count = 0;
  for (const [kind, entries] of Object.entries(value)) {
    if (!ARTWORK_KINDS.includes(kind as ArtworkKind) || !plain(entries)) {
      fail('CONTENT_INVALID_ASSET_MANIFEST');
    }
    for (const [name, data] of Object.entries(entries)) {
      if (++count > 10_000 || artworkName(kind as ArtworkKind, name) !== name ||
          !plain(data) || !SHA.test(String(data.sha256)) ||
          !Number.isSafeInteger(data.bytes) || !Number.isSafeInteger(data.width) ||
          !Number.isSafeInteger(data.height)) fail('CONTENT_INVALID_ASSET_MANIFEST');
      readArtworkObject(root, data as unknown as ArtworkEntry);
    }
  }
}
function readStage(root: string, id: string): ArtworkStage {
  if (!UUID.test(id)) fail('CONTENT_INVALID_ASSET_STAGE');
  const { stages } = dirs(root);
  const raw = safeRead(join(stages, id + '.json'), 4096);
  let stage: unknown;
  try { stage = JSON.parse(raw.toString('utf8')) as unknown; }
  catch { return fail('CONTENT_INVALID_ASSET_STAGE'); }
  if (!plain(stage) || stage.id !== id ||
      !ARTWORK_KINDS.includes(stage.kind as ArtworkKind) ||
      (stage.intent !== 'create' && stage.intent !== 'replace') ||
      typeof stage.name !== 'string' ||
      artworkName(stage.kind as ArtworkKind, stage.name) !== stage.name ||
      typeof stage.baseRevision !== 'string' || !UUID.test(stage.baseRevision) ||
      typeof stage.createdAt !== 'string' || !Number.isFinite(Date.parse(stage.createdAt)) ||
      !SHA.test(String(stage.sha256))) fail('CONTENT_INVALID_ASSET_STAGE');
  const entry = stage as unknown as ArtworkStage;
  readArtworkObject(root, entry);
  return entry;
}
export function stageWebpArtwork(
  root: string,
  current: PublishedContent,
  request: { kind: ArtworkKind; name: string; intent: 'create' | 'replace'; baseRevision: string; bytes: Buffer },
): ArtworkStage {
  if (request.baseRevision !== current.revision) fail('CONTENT_REVISION_CONFLICT');
  const kind = request.kind;
  const name = artworkName(kind, request.name);
  if (request.intent !== 'create' && request.intent !== 'replace') fail('CONTENT_INVALID_ASSET_INTENT');
  const known = referencedNames(current.content, kind).has(name) ||
    Boolean(current.manifest.assets?.[kind]?.[name]);
  if (request.intent === 'create' && known) fail('CONTENT_ASSET_COLLISION');
  if (request.intent === 'replace' && !known) fail('CONTENT_ASSET_REPLACEMENT_NOT_FOUND');
  const dims = inspectWebp(request.bytes);
  const sha256 = hash(request.bytes);
  const { objects, stages } = dirs(root, true);
  const objectPath = join(objects, sha256 + '.webp');
  if (existsSync(objectPath)) {
    // Deduplication does not grant permission to overwrite or mutate old bytes.
    readArtworkObject(root, { sha256, bytes: request.bytes.length, ...dims });
  } else {
    writeExclusive(objectPath, request.bytes);
    flushDirectory(objects);
  }
  const stage: ArtworkStage = {
    id: randomUUID(), kind, name, intent: request.intent,
    baseRevision: current.revision,
    sha256, bytes: request.bytes.length, width: dims.width, height: dims.height,
    createdAt: new Date().toISOString(),
  };
  writeExclusive(join(stages, stage.id + '.json'), Buffer.from(JSON.stringify(stage) + '\n'));
  flushDirectory(stages);
  return stage;
}
/**
 * Revalidate all staged assets and the entire JSON linkage. Nothing becomes
 * public until the caller atomically commits its JSON revision pointer.
 */
export function prepareArtworkForPublication(
  root: string, current: PublishedContent | null, next: ContentBundle,
  stageIds: string[] = [], rollbackAssets?: ArtworkManifest,
): ArtworkManifest {
  if (!Array.isArray(stageIds) || stageIds.length > 32 ||
      new Set(stageIds).size !== stageIds.length) fail('CONTENT_INVALID_ASSET_STAGES');
  if (rollbackAssets && stageIds.length) fail('CONTENT_INVALID_ASSET_STAGES');
  const result: ArtworkManifest = structuredClone(rollbackAssets ?? current?.manifest.assets ?? {});
  const requestedNames = new Set<string>();
  for (const id of stageIds) {
    const stage = readStage(root, id);
    const key = stage.kind + ':' + stage.name;
    if (requestedNames.has(key)) fail('CONTENT_DUPLICATE_ASSET_NAME');
    requestedNames.add(key);
    if (stage.baseRevision !== current?.revision) fail('CONTENT_ASSET_STAGE_STALE');
    const previous = referencedNames(current!.content, stage.kind).has(stage.name) ||
      Boolean(current?.manifest.assets?.[stage.kind]?.[stage.name]);
    if (stage.intent === 'create' && previous) fail('CONTENT_ASSET_COLLISION');
    if (stage.intent === 'replace' && !previous) fail('CONTENT_ASSET_REPLACEMENT_NOT_FOUND');
    if (!referencedNames(next, stage.kind).has(stage.name)) fail('CONTENT_ORPHAN_ARTWORK');
    const map = result[stage.kind] ?? {};
    if (Object.hasOwn(map, stage.name)) {
      // Replacement is explicit, including for the same exact bytes.
      if (stage.intent !== 'replace') fail('CONTENT_ASSET_COLLISION');
    }
    map[stage.name] = {
      sha256: stage.sha256, bytes: stage.bytes, width: stage.width, height: stage.height,
    };
    result[stage.kind] = map;
  }
  if (current && !rollbackAssets) {
    for (const kind of ARTWORK_KINDS) {
      const original = referencedNames(current.content, kind);
      const updated = referencedNames(next, kind);
      for (const name of updated) {
        if (!original.has(name) && !Object.hasOwn(result[kind] ?? {}, name)) {
          fail('CONTENT_UNSTAGED_ASSET_REFERENCE');
        }
      }
    }
  }
  // Historical rollback assets came from a validated earlier immutable revision.
  validateArtworkManifest(root, result);
  return result;
}
export function artworkUrls(revision: string, assets: ArtworkManifest): Record<string, Record<string, string>> {
  const urls: Record<string, Record<string, string>> = {};
  for (const kind of ARTWORK_KINDS) {
    const entries = assets[kind];
    if (!entries) continue;
    urls[kind] = {};
    for (const name of Object.keys(entries)) {
      urls[kind][name] = '/game-data/media/' + revision + '/' + kind + '/' + name + '.webp';
    }
  }
  return urls;
}
