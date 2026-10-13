import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for signup and login endpoints.
 * 5 requests per 15 minutes per IP address.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
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
