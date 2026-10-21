import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { AuthRequest } from './auth';

/**
 * Strict limiter for signup and login endpoints.
 * 10 failed requests per 15 minutes per IP address.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    message: 'Too many authentication requests from this IP, please try again after 15 minutes.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Lighter limiter for comments, likes, saves, views, and follows.
 * 60 requests per minute per IP address.
 */
export const socialLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    message: 'Too many requests, please slow down and try again shortly.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Upload signature limiter: 30 per hour per authenticated user.
 * Falls back to IP if user is not set.
 */
export const signatureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  keyGenerator: (req: Request): string => {
    const userId = (req as AuthRequest).user?.id;
    return userId ? `user:${userId}` : req.ip || 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    message: 'Upload signature limit reached. You can request up to 30 signatures per hour.',
  },
  validate: { keyGeneratorIpFallback: false },
  skip: () => process.env.NODE_ENV === 'test',
});
