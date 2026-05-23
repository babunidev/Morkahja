import type { NextFunction, Request, Response } from 'express';

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

  if (token !== configuredKey) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  next();
}
