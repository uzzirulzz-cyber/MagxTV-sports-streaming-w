import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { findUserById, toApiUser } from './repo';
import type { ApiUser, Role } from './types';

export interface AuthedRequest extends Request { user?: ApiUser }

export function signToken(user: ApiUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] });
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) { res.status(401).json({ error: 'Sign in to continue.' }); return; }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    const row = await findUserById(payload.sub);
    if (!row) { res.status(401).json({ error: 'Your session is no longer valid.' }); return; }
    req.user = toApiUser(row);
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired — please sign in again.' });
  }
}

export function requireRole(role: Role) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Sign in to continue.' }); return; }
    if (req.user.role !== role) { res.status(403).json({ error: `This endpoint requires the ${role} role.` }); return; }
    next();
  };
}
