import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Attaches a request ID to every request and response.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = randomUUID();
  (req as Request & { requestId: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};

/**
 * 404 handler for unknown /api/* routes.
 * Must be mounted AFTER all route definitions.
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ message: 'Route not found' });
};

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  errors?: unknown;
}

/**
 * Central error handler.
 * - 5xx responses return only { message, requestId } — no internal details.
 * - Real errors are logged server-side with the request ID.
 * - Zod and Mongoose validation/cast errors map to 400.
 */
export const errorHandler = (
  err: ErrorWithStatus,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const requestId = (req as Request & { requestId?: string }).requestId || 'unknown';

  // Never log tokens, passwords, cookies, or Mongo URI
  const safeMessage = err.message || 'Unknown error';
  const statusForLog = err.status || err.statusCode || 500;
  if (statusForLog >= 500) {
    console.error(`[Kinetic Error] requestId=${requestId} ${safeMessage}`, {
      name: err.name,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });
  } else {
    console.warn(`[Kinetic] ${statusForLog} requestId=${requestId} ${safeMessage}`);
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({ message: 'Validation error', errors: (err as unknown as { issues: unknown }).issues });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json({ message: 'Validation error' });
    return;
  }

  // Mongoose CastError (bad ObjectId etc.)
  if (err.name === 'CastError') {
    res.status(400).json({ message: 'Invalid ID format' });
    return;
  }

  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    res.status(status).json({ message: 'Something went wrong', requestId });
    return;
  }

  res.status(status).json({ message: safeMessage, requestId });
};
