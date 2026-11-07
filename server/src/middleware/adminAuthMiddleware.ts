import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Shared operator key: never accept a missing key or compare secrets with plain string equality. */
export function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const configuredKey = process.env.ADMIN_API_KEY?.trim();
  if (!configuredKey) {
    res.status(503).json({ error: 'ADMIN_NOT_CONFIGURED' });
    return;
  }

  const header = req.headers.authorization ?? '';
  const match = /^Bearer ([^\s]+)$/.exec(header);
  const token = match?.[1] ?? '';
  const expected = createHash('sha256').update(configuredKey).digest();
  const supplied = createHash('sha256').update(token).digest();
  if (!token || !timingSafeEqual(expected, supplied)) {
    // Deliberately do not log the token, Authorization header, IP or key.
    console.warn('ADMIN_AUTH_REJECTED');
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  next();
}
