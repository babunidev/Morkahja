import { closeSync, constants, existsSync, fsyncSync, lstatSync, openSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import {
  ContentPublicationError, type ContentBundle, type ContentKind,
  validateContentBundle,
} from './contentPublication.js';

type EditOperation = 'create' | 'update';
export interface ContentRecordChange {
  kind: ContentKind;
  key: string;
  operation: EditOperation;
  data: Record<string, unknown>;
}
const KINDS = ['encounters', 'solutions', 'expansions', 'frames', 'portraits'] as const;
const ID_FIELDS: Record<ContentKind, string> = {
  encounters: 'mEncounterID', solutions: 'mSolutionID', expansions: 'mExtensioID',
  frames: 'frameID', portraits: 'avatarID',
};
const IMAGE_FIELDS: Record<ContentKind, readonly string[]> = {
  encounters: ['mEncounterImageName'],
  solutions: ['mSolutionIconName'],
  expansions: ['mExtensioCollectionImage', 'mExtensioHeaderImage', 'mExtensioUnlockButton'],
  frames: [], portraits: [],
};
function fail(code: string): never { throw new ContentPublicationError(code); }
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function entries(bundle: ContentBundle, kind: ContentKind): Record<string, unknown> | unknown[] {
  if (kind === 'expansions') return (bundle.expansions as { expansions: Record<string, unknown> }).expansions;
  if (kind === 'frames') return (bundle.frames as { Frames: unknown[] }).Frames;
  if (kind === 'portraits') return (bundle.portraits as { Avatar: unknown[] }).Avatar;
  return bundle[kind] as Record<string, unknown>;
}
function assertExistingAssetReferences(previous: ContentBundle, next: ContentBundle): void {
  // Until the managed WebP publisher is ready, existing artwork identifiers are
  // the only allowed references. This is NOT a check that files exist on disk.
  for (const kind of KINDS) {
    const fields = IMAGE_FIELDS[kind];
    if (!fields.length) continue;
    const oldRecords = Object.values(entries(previous, kind));
    const nextRecords = Object.values(entries(next, kind));
    for (const field of fields) {
      const known = new Set(oldRecords.filter(object).map(value => value[field]));
      for (const value of nextRecords) {
        if (!object(value) || !known.has(value[field])) {
          fail('CONTENT_UNSTAGED_ASSET_REFERENCE');
        }
      }
    }
  }
}
/**
 * Stateless record editor. Never write in-place: apply changes to a cloned
 * revision and validate the complete resulting bundle before publication.
 */
export function applyContentRecordChanges(base: ContentBundle, changes: unknown): ContentBundle {
  validateContentBundle(base);
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 100) {
    fail('CONTENT_INVALID_CHANGES');
  }
  const next = structuredClone(base) as ContentBundle;
  const changed = new Set<string>();
  for (const raw of changes as unknown[]) {
    if (!object(raw) || !KINDS.includes(raw.kind as ContentKind) ||
        (raw.operation !== 'create' && raw.operation !== 'update') ||
        typeof raw.key !== 'string' || !/^[0-9]{1,9}$/.test(raw.key) ||
        !object(raw.data)) fail('CONTENT_INVALID_CHANGE');
    const kind = raw.kind as ContentKind;
    const key = raw.key as string;
    const operation = raw.operation as EditOperation;
    const id = Number(key);
    if (!Number.isSafeInteger(id) || id <= 0 || raw.data[ID_FIELDS[kind]] !== id) {
      fail('CONTENT_INVALID_CHANGE_ID');
    }
    if (changed.has(`${kind}:${key}`)) fail('CONTENT_DUPLICATE_CHANGE');
    changed.add(`${kind}:${key}`);
    const target = entries(next, kind);
    if (Array.isArray(target)) {
      if (id > 10_000 || String(id) !== key) fail('CONTENT_INVALID_CHANGE_ID');
      const exists = target[id] !== null && target[id] !== undefined;
      if ((operation === 'create' && exists) || (operation === 'update' && !exists)) {
        fail('CONTENT_EDIT_CONFLICT');
      }
      // New indexed records may leave null holes, but never sparse array holes.
      while (target.length <= id) target.push(null);
      target[id] = raw.data;
    } else {
      const exists = Object.hasOwn(target, key);
      if ((operation === 'create' && exists) || (operation === 'update' && !exists)) {
        fail('CONTENT_EDIT_CONFLICT');
      }
      target[key] = raw.data;
    }
  }
  validateContentBundle(next);
  assertExistingAssetReferences(base, next);
  return next;
}

export interface ContentAdminAudit {
  action: 'validate' | 'publish' | 'rollback';
  outcome: 'attempt' | 'success' | 'rejected';
  publicationId?: string;
  revision?: string;
  code?: string;
}
/** Private, durable and intentionally anonymous: never store tokens, player data or IPs. */
export function appendContentAdminAudit(root: string, event: ContentAdminAudit): void {
  const path = join(root, 'admin-audit.jsonl');
  if (existsSync(path)) {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink()) fail('CONTENT_UNSAFE_AUDIT');
  }
  const fd = openSync(path,
    constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
  try {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(), actor: 'admin-api-key',
      ...event,
    }) + '\n';
    writeSync(fd, line, undefined, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
