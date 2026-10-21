/**
 * Validates required environment variables at startup.
 * Call this BEFORE any other imports that use env vars.
 * Logs which variable is invalid (never the value) then exits.
 */
import { randomBytes } from 'crypto';

export function validateEnv(): void {
  const errors: string[] = [];

  // Test runs get throw-away random secrets so `npm run test:server` works without a real .env.
  if (process.env.NODE_ENV === 'test') {
    const random = () => randomBytes(32).toString('hex');
    process.env.JWT_SECRET = process.env.JWT_SECRET || random();
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || random();
  }

  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    errors.push('JWT_SECRET: required, must be at least 32 characters');
  }
  if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET: required, must be at least 32 characters');
  }
  if (jwtSecret && jwtRefreshSecret && jwtSecret === jwtRefreshSecret) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  if (errors.length > 0) {
    console.error('[Kinetic] Invalid or missing environment variables:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    console.error('[Kinetic] Server cannot start without valid secrets. Exiting.');
    process.exit(1);
  }
}
