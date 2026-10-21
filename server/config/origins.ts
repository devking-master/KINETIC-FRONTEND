/**
 * Single source of truth for which browser origins may talk to the API.
 * Read lazily so values from .env are picked up even though imports run first.
 */
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

export const normalizeOrigin = (origin: string): string => origin.trim().replace(/\/+$/, '');

// FRONTEND_URL can hold one origin or several, comma separated.
export const getAllowedOrigins = (): string[] => {
  const extra = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  return [...DEV_ORIGINS, ...extra];
};

export const isAllowedOrigin = (origin: string | undefined): boolean =>
  Boolean(origin) && getAllowedOrigins().includes(normalizeOrigin(origin as string));