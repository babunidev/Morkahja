import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Compares in constant time, so the response time does not reveal how much of the key matched. */
function sameKey(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

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
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token || !sameKey(token, configuredKey)) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  next();
}
