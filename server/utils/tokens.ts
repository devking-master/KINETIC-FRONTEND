/**
 * Centralised token helpers.
 * Always signs HS256. Access tokens use JWT_SECRET (1h),
 * refresh tokens use JWT_REFRESH_SECRET (30d).
 */
import jwt from 'jsonwebtoken';

const getSecret = (): string => process.env.JWT_SECRET!;
const getRefreshSecret = (): string => process.env.JWT_REFRESH_SECRET!;

export interface AccessTokenPayload {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, getSecret(), { algorithm: 'HS256', expiresIn: '1h' });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as AccessTokenPayload;

export const signRefreshToken = (payload: RefreshTokenPayload): string =>
  jwt.sign(payload, getRefreshSecret(), { algorithm: 'HS256', expiresIn: '30d' });

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, getRefreshSecret(), { algorithms: ['HS256'] }) as RefreshTokenPayload;
