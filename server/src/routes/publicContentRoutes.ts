import { Router } from 'express';
import { getPublishedContentSnapshot, getConfiguredContentRoot } from '../services/gameData.js';
import { readContentRevision } from '../services/contentPublication.js';
import { artworkName, artworkUrls, ARTWORK_KINDS, readArtworkObject, type ArtworkKind } from '../services/contentArtwork.js';

/**
 * Public, read-only view of one complete content publication.
 *
 * When published mode is not configured (or is invalid), this route deliberately
 * does not return repository fixtures. Legacy routes continue to work until
 * the separately approved deployment cutover.
 */
export const publicContentRoutes = Router();

publicContentRoutes.get('/content', (req, res) => {
  // /content is the "current" pointer, never an immutable cache target.
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const publication = getPublishedContentSnapshot();
    if (!publication) {
      res.status(503).json({ error: 'CONTENT_NOT_CONFIGURED' });
      return;
    }

    const etag = `"${publication.revision}"`;
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match']?.split(',').map(value => value.trim()).includes(etag)) {
      res.status(304).end();
      return;
    }

    // This is a single published revision; never assemble these fields by
    // calling five independent gameData getters.
    res.status(200).json({
      revision: publication.revision,
      encounters: publication.content.encounters,
      solutions: publication.content.solutions,
      expansions: publication.content.expansions,
      frames: publication.content.frames,
      portraits: publication.content.portraits,
      assets: artworkUrls(publication.revision, publication.manifest.assets ?? {}),
    });
  } catch {
    // Do not expose configured paths, parser errors or partial records.
    res.status(503).json({ error: 'CONTENT_UNAVAILABLE' });
  }
});


/**
 * Version-specific URLs are immutable. No process restart or client cache
 * invalidation is needed when a newer revision replaces the same logical name.
 */
publicContentRoutes.get('/media/:revision/:kind/:filename', (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const root = getConfiguredContentRoot();
    if (!root) {
      res.status(503).json({ error: 'CONTENT_NOT_CONFIGURED' });
      return;
    }
    const revision = String(req.params.revision);
    const kind = String(req.params.kind) as ArtworkKind;
    const filename = String(req.params.filename);
    if (!ARTWORK_KINDS.includes(kind) || !/^[a-zA-Z0-9_-]{1,120}[.]webp$/.test(filename)) {
      res.status(404).end();
      return;
    }
    const name = artworkName(kind, filename);
    const published = readContentRevision(root, revision);
    const descriptor = published.manifest.assets?.[kind]?.[name];
    if (!descriptor) {
      res.status(404).end();
      return;
    }
    const bytes = readArtworkObject(root, descriptor);
    const etag = '"' + descriptor.sha256 + '"';
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match']?.split(',').map(v => v.trim()).includes(etag)) {
      res.status(304).end();
      return;
    }
    res.status(200).send(bytes);
  } catch {
    // Malformed historical revisions and absent/corrupt stored objects fail
    // without revealing directory paths or trying legacy public assets.
    res.status(503).json({ error: 'CONTENT_MEDIA_UNAVAILABLE' });
  }
});
