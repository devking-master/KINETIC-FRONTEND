/**
 * Creates a new admin account interactively.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/create-admin.ts --email admin@example.com --username adminuser
 *
 * Password is read from ADMIN_PASSWORD env var or prompted interactively.
 * Password must be 12+ characters. It is never printed.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function promptPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;
  // readline echoes typed characters by default; stop echoing once the prompt itself is printed.
  (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = (text: string) => {
    if (!muted) process.stdout.write(text);
  };
  return new Promise((resolve) => {
    rl.question('Admin password (min 12 chars, not echoed): ', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const email = getArg('--email');
  const username = getArg('--username');

  if (!email || !username) {
    console.error('Usage: create-admin.ts --email <email> --username <username>');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI env var is required');
    process.exit(1);
  }

  const password = await promptPassword();
  if (!password || password.length < 12) {
    console.error('Password must be at least 12 characters');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const { User } = await import('../server/models/User');

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    console.error(`[create-admin] A user with that email or username already exists.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  await User.create({
    name: username,
    username,
    email,
    passwordHash,
    role: 'admin',
    avatarUrl: '',
    onboardingCompleted: true,
  });

  console.log(`[create-admin] ✓ Admin account created for ${username} <${email}>`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[create-admin] Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
