import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication token is missing or invalid' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const jwtSecret = process.env.JWT_SECRET || 'kinetic-super-secret-key-2026';
    const decoded = jwt.verify(token, jwtSecret) as { id: string; email: string; username: string; role: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Token is expired or invalid' });
  }
};
