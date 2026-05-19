import type { NextFunction, Request, Response } from 'express';

import { authenticateAccessToken, SessionError } from '../services/sessionService.js';
import type { SessionDocument } from '../types/session.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      deviceId: string;
      playerId: string;
      session: SessionDocument;
    };
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim() || null;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = bearerToken(req);

  if (!token) {
    res.status(401).json({ error: 'SESSION_INVALID' });
    return;
  }

  try {
    const auth = await authenticateAccessToken(token);
    req.auth = {
      deviceId: auth.deviceId,
      playerId: auth.playerId,
      session: auth.session,
    };
    next();
  } catch (error) {
    if (error instanceof SessionError) {
      res.status(error.statusCode).json({ error: 'SESSION_INVALID' });
      return;
    }

    next(error);
  }
}

export function requireAuth(req: Request): NonNullable<Request['auth']> {
  if (!req.auth) {
    throw new SessionError();
  }

  return req.auth;
}
