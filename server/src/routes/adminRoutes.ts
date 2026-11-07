import express, { Router, type NextFunction, type Request, type Response } from 'express';
import {
  getAdminActivityHandler, getAdminDashboardHandler, getAdminOnlinePlayersHandler,
  getAdminPlayersHandler, getAdminServerStatus, postAdminBanHandler,
  postAdminTimeoutHandler, postAdminUnbanHandler,
} from '../controllers/adminController.js';
import { requireAdminAuth } from '../middleware/adminAuthMiddleware.js';
import { adminContentRoutes } from './adminContentRoutes.js';

export const adminRoutes = Router();
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

// Applied before authentication/body parsing. Single-process defense in depth;
// the reverse proxy must also enforce rate/body limits in multi-worker deployments.
function adminRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const mutate = !['GET', 'HEAD'].includes(req.method);
  const key = `${req.socket.remoteAddress ?? 'unknown'}:${mutate ? 'mutate' : 'read'}`;
  if (rateBuckets.size > 10_000) {
    for (const [entry, bucket] of rateBuckets) {
      if (bucket.resetAt < now) rateBuckets.delete(entry);
    }
  }
  const current = rateBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + 60_000 } : current;
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > (mutate ? 20 : 120)) {
    res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
    res.status(429).json({ error: 'ADMIN_RATE_LIMITED' });
    return;
  }
  next();
}

adminRoutes.use(adminRateLimit, requireAdminAuth);
adminRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
// Isolated admin parser: 256 KiB max, while the player API remains at 32 KiB.
adminRoutes.use(express.json({ limit: '256kb', strict: true }));

adminRoutes.get('/server', getAdminServerStatus);
adminRoutes.get('/dashboard', getAdminDashboardHandler);
adminRoutes.get('/players', getAdminPlayersHandler);
adminRoutes.get('/players/online', getAdminOnlinePlayersHandler);
adminRoutes.get('/activity', getAdminActivityHandler);
adminRoutes.post('/players/timeout', postAdminTimeoutHandler);
adminRoutes.post('/players/ban', postAdminBanHandler);
adminRoutes.post('/players/unban', postAdminUnbanHandler);

adminRoutes.use('/content', adminContentRoutes);
// Old per-record POSTs wrote directly to the repository and bypassed
// revision validation. They must never be reachable even in legacy mode.
adminRoutes.post('/content/:kind', (req, res, next) => {
  const kind = String(req.params.kind);
  if (!['encounters', 'solutions', 'expansions', 'frames', 'portraits'].includes(kind)) {
    next();
    return;
  }
  res.status(410).json({ error: 'CONTENT_PUBLISH_REQUIRED' });
});

adminRoutes.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const parsed = err as { type?: string; status?: number };
  if (parsed.type === 'entity.too.large' || parsed.status === 413) {
    res.status(413).json({ error: 'ADMIN_PAYLOAD_TOO_LARGE' });
  } else if (parsed.type === 'entity.parse.failed' || parsed.status === 400) {
    res.status(400).json({ error: 'ADMIN_INVALID_JSON' });
  } else {
    console.error('ADMIN_REQUEST_FAILED');
    res.status(503).json({ error: 'ADMIN_UNAVAILABLE' });
  }
});
