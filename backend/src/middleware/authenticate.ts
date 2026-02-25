import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import logger from '../config/logger';

export interface JWTPayload {
  sub: number;
  email: string;
  role: string;
  siteIds: number[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret) as unknown as JWTPayload;
    req.user = payload;
    next();
  } catch (err) {
    logger.warn('Invalid JWT token attempt');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
