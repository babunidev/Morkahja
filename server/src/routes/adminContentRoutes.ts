import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  ContentPublicationError, type ContentBundle, listContentRevisions,
  publishContentRevision, readContentRevision, readPublishedContent,
  restoreContentRevision,
} from '../services/contentPublication.js';
import { getConfiguredContentRoot, getPublishedContentSnapshot } from '../services/gameData.js';
import { appendContentAdminAudit, applyContentRecordChanges } from '../services/contentAdminService.js';

export const adminContentRoutes = Router();
const revisionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const publicationPattern = /^[a-zA-Z0-9_-]{8,100}$/;
type AdminOperation = 'validate' | 'publish' | 'rollback';

function error(code: string): never { throw new ContentPublicationError(code); }
function requiredRoot(): string {
  const root = getConfiguredContentRoot();
  if (!root) error('CONTENT_NOT_CONFIGURED');
  return root;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function requestData(req: Request): Record<string, unknown> {
  if (!object(req.body)) error('CONTENT_INVALID_REQUEST');
  return req.body;
}
function requireRevision(value: unknown): string {
  if (typeof value !== 'string' || !revisionPattern.test(value)) error('CONTENT_INVALID_REVISION');
  return value;
}
function requirePublicationId(value: unknown): string {
  if (typeof value !== 'string' || !publicationPattern.test(value)) error('CONTENT_INVALID_PUBLICATION_ID');
  return value;
}
function requirePublishingEnabled(): void {
  if (process.env.MORKAHJA_ENABLE_CONTENT_PUBLISHING !== '1') {
    error('CONTENT_PUBLISHING_DISABLED');
  }
}
function currentContent() {
  const content = getPublishedContentSnapshot();
  if (!content) error('CONTENT_NOT_CONFIGURED');
  return content;
}
function respondError(res: Response, err: unknown): void {
  if (!(err instanceof ContentPublicationError)) {
    console.error('CONTENT_ADMIN_UNEXPECTED_ERROR');
    res.status(503).json({ error: 'CONTENT_UNAVAILABLE' });
    return;
  }
  const code = err.code;
  let status = 422;
  if (code === 'CONTENT_NOT_CONFIGURED' || code === 'CONTENT_PUBLISHING_DISABLED' ||
      code.startsWith('CONTENT_ROOT_') || code.startsWith('CONTENT_UNSAFE_') ||
      code.includes('CHECKSUM') || code === 'CONTENT_INVALID_POINTER' ||
      code === 'CONTENT_INVALID_MANIFEST' || code === 'CONTENT_INVALID_JSON') {
    status = 503;
  } else if (code === 'CONTENT_REVISION_CONFLICT' || code === 'CONTENT_EDIT_CONFLICT' ||
             code === 'CONTENT_PUBLICATION_ID_REUSED' || code === 'CONTENT_PUBLICATION_LOCKED') {
    status = 409;
  } else if (code === 'CONTENT_INVALID_REQUEST' || code === 'CONTENT_INVALID_REVISION' ||
             code === 'CONTENT_INVALID_PUBLICATION_ID' || code === 'CONTENT_INVALID_CHANGES' ||
             code === 'CONTENT_INVALID_CHANGE' || code === 'CONTENT_INVALID_CHANGE_ID') {
    status = 400;
  } else if (code === 'CONTENT_FILE_TOO_LARGE') {
    status = 413;
  }
  res.status(status).json({ error: code });
}
function safe(handler: (req: Request, res: Response) => void, operation?: AdminOperation): RequestHandler {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      if (operation) {
        try {
          const root = getConfiguredContentRoot();
          if (root) {
            const body = object(req.body) ? req.body : {};
            const publicationId = typeof body.publicationId === 'string' &&
              publicationPattern.test(body.publicationId) ? body.publicationId : undefined;
            appendContentAdminAudit(root, {
              action: operation, outcome: 'rejected', publicationId,
              code: err instanceof ContentPublicationError ? err.code : 'CONTENT_UNAVAILABLE',
            });
          }
        } catch {
          console.error('CONTENT_ADMIN_AUDIT_FAILURE');
        }
      }
      respondError(res, err);
    }
  };
}
function prepareChanges(req: Request, allowIdempotentRetry: boolean) {
  const body = requestData(req);
  const baseRevision = requireRevision(body.baseRevision);
  const root = requiredRoot();
  const published = currentContent();
  const publicationId = allowIdempotentRetry ? requirePublicationId(body.publicationId) : null;
  if (published.revision !== baseRevision &&
      !(allowIdempotentRetry && published.manifest.publicationId === publicationId &&
        published.manifest.previousRevision === baseRevision)) {
    error('CONTENT_REVISION_CONFLICT');
  }
  const base = published.revision === baseRevision
    ? published.content : readContentRevision(root, baseRevision).content;
  const next: ContentBundle = applyContentRecordChanges(base, body.changes);
  return { root, body, baseRevision, next, published, publicationId };
}

/** Authenticate before these routes are mounted; all content reads fail closed without a store. */
adminContentRoutes.get('/', safe((_req, res) => {
  const current = currentContent();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ revision: current.revision, manifest: current.manifest, ...current.content });
}));
adminContentRoutes.get('/revisions', safe((_req, res) => {
  const current = currentContent();
  const revisions = listContentRevisions(requiredRoot());
  res.setHeader('Cache-Control', 'no-store');
  res.json({ currentRevision: current.revision, revisions: revisions.slice(-100).reverse() });
}));
adminContentRoutes.get('/revisions/:revision', safe((req, res) => {
  const revision = requireRevision(req.params.revision);
  const result = readContentRevision(requiredRoot(), revision);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ revision: result.revision, manifest: result.manifest, ...result.content });
}));
adminContentRoutes.get('/publications/:publicationId', safe((req, res) => {
  const publicationId = requirePublicationId(req.params.publicationId);
  const current = currentContent();
  const manifest = listContentRevisions(requiredRoot()).find(item => item.publicationId === publicationId);
  if (!manifest) {
    res.status(404).json({ error: 'PUBLICATION_NOT_FOUND' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    publicationId, manifest,
    status: manifest.revision === current.revision ? 'current' : 'historical',
    currentRevision: current.revision,
  });
}));
adminContentRoutes.get('/expansions/:id', safe((req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9]{1,9}$/.test(id)) error('CONTENT_INVALID_REQUEST');
  const current = currentContent();
  const expansion = (current.content.expansions as { expansions: Record<string, unknown> }).expansions[id];
  if (!expansion) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(expansion);
}));
adminContentRoutes.get('/:kind', safe((req, res) => {
  const kind = String(req.params.kind);
  if (!['encounters', 'solutions', 'expansions', 'frames', 'portraits'].includes(kind)) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  const current = currentContent();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Revision', current.revision);
  res.json(current.content[kind as keyof ContentBundle]);
}));

adminContentRoutes.post('/validate', safe((req, res) => {
  const { root, baseRevision, next } = prepareChanges(req, false);
  appendContentAdminAudit(root, { action: 'validate', outcome: 'success', revision: baseRevision });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ valid: true, baseRevision, changesApplied: (requestData(req).changes as unknown[]).length, categories: Object.keys(next) });
}, 'validate'));

adminContentRoutes.post('/publish', safe((req, res) => {
  requirePublishingEnabled();
  const { root, baseRevision, next, publicationId } = prepareChanges(req, true);
  appendContentAdminAudit(root, { action: 'publish', outcome: 'attempt', publicationId: publicationId! });
  const result = publishContentRevision(root, {
    baseRevision, publicationId: publicationId!, content: next,
  });
  // Confirm pointer, checksum and full data after publication before returning 201.
  const verified = readPublishedContent(root);
  if (verified.revision !== result.revision) error('CONTENT_POINTER_NOT_COMMITTED');
  appendContentAdminAudit(root, {
    action: 'publish', outcome: 'success', publicationId: publicationId!, revision: result.revision,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true, publicationId, revision: verified.revision,
    previousRevision: verified.manifest.previousRevision,
    manifest: verified.manifest,
  });
}, 'publish'));

adminContentRoutes.post('/rollback', safe((req, res) => {
  requirePublishingEnabled();
  const body = requestData(req);
  const root = requiredRoot();
  const baseRevision = requireRevision(body.baseRevision);
  const targetRevision = requireRevision(body.targetRevision);
  const publicationId = requirePublicationId(body.publicationId);
  const current = currentContent();
  if (current.revision !== baseRevision &&
      !(current.manifest.publicationId === publicationId &&
        current.manifest.previousRevision === baseRevision)) {
    error('CONTENT_REVISION_CONFLICT');
  }
  appendContentAdminAudit(root, { action: 'rollback', outcome: 'attempt', publicationId });
  const result = restoreContentRevision(root, baseRevision, targetRevision, publicationId);
  const verified = readPublishedContent(root);
  if (verified.revision !== result.revision) error('CONTENT_POINTER_NOT_COMMITTED');
  appendContentAdminAudit(root, { action: 'rollback', outcome: 'success', publicationId, revision: result.revision });
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true, publicationId, revision: verified.revision,
    restoredFrom: verified.manifest.restoredFrom,
    manifest: verified.manifest,
  });
}, 'rollback'));

// Media is deliberately not accepted before the validated managed-WebP pipeline exists.
adminContentRoutes.post('/assets/stage', (_req, res) => {
  res.status(501).json({ error: 'CONTENT_ASSET_UPLOAD_NOT_IMPLEMENTED' });
});
