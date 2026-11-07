import { Router } from 'express';
import { getPublishedContentSnapshot } from '../services/gameData.js';

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
      // Reserved for the later revision-aware WebP asset publication stage.
      assets: {},
    });
  } catch {
    // Do not expose configured paths, parser errors or partial records.
    res.status(503).json({ error: 'CONTENT_UNAVAILABLE' });
  }
});
