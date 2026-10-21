import { Response, CookieOptions } from 'express';

export const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Attributes for the refresh-token cookie.
 * - COOKIE_SAMESITE: 'lax' (default), 'strict' or 'none'. Use 'none' while the app (Vercel) and the API
 *   (Render) are on different sites; switch to 'lax' once both share one domain.
 * - COOKIE_DOMAIN: optional, for example ".yourdomain.com".
 * The clear call must use the same attributes as the set call, otherwise browsers ignore it.
 */
export const refreshCookieOptions = (): CookieOptions => {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none';
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
    sameSite,
    path: '/api/auth',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
};

export const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...refreshCookieOptions(), maxAge: REFRESH_COOKIE_MAX_AGE });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
};
