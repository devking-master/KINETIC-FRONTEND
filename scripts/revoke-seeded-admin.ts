/**
 * Checks if the seeded admin account still exists with its original password.
 * DRY RUN by default. Pass --apply to replace the password with an unusable hash
 * and bump tokenVersion.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/revoke-seeded-admin.ts
 *   npx tsx --env-file=.env scripts/revoke-seeded-admin.ts --apply
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const SEED_PASSWORD = process.env.OLD_SEED_PASSWORD || Buffer.from('a2luZXRpYzIwMjY=', 'base64').toString('utf8');
const SEED_EMAIL = 'creator@kinetic.com';
const SEED_USERNAME = 'kinetic_creator';

async function main() {
  const apply = process.argv.includes('--apply');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI env var is required');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  // Lazy import after connect to avoid model registration issues
  const { User } = await import('../server/models/User');

  const user = await User.findOne({
    $or: [{ email: SEED_EMAIL }, { username: SEED_USERNAME }],
  });

  if (!user) {
    console.log('[revoke-seeded-admin] No seeded admin found. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(`[revoke-seeded-admin] Found account:`);
  console.log(`  email:    ${user.email}`);
  console.log(`  username: ${user.username}`);

  const stillHasOldPassword = await bcrypt.compare(SEED_PASSWORD, user.passwordHash);

  if (!stillHasOldPassword) {
    console.log('[revoke-seeded-admin] Password has already been changed. No action needed.');
    await mongoose.disconnect();
    return;
  }

  console.log('[revoke-seeded-admin] Account still has the original seed password.');

  if (!apply) {
    console.log('[revoke-seeded-admin] DRY RUN — pass --apply to replace the password and revoke sessions.');
    await mongoose.disconnect();
    return;
  }

  // Replace with a cryptographically random unusable hash
  const unusableHash = await bcrypt.hash(
    `revoked-${crypto.randomUUID()}-${Date.now()}`,
    12
  );

  await User.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash: unusableHash },
      $inc: { tokenVersion: 1 },
    }
  );

  console.log('[revoke-seeded-admin] ✓ Password replaced and all sessions revoked.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[revoke-seeded-admin] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
