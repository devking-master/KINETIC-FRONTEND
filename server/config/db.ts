import mongoose from 'mongoose';
import { Track } from '../models/Track';
import { Video } from '../models/Video';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';

// One-time cleanup: removes any leftover demo/sample tracks & videos that
// don't belong to a real uploader. Real uploads always set `uploadedBy` /
// `creator` (enforced by the authenticated upload routes), so this only
// ever touches old seed data and is a safe no-op once that's gone.
const removeLegacyDemoContent = async () => {
  try {
    const demoTrackResult = await Track.deleteMany({ uploadedBy: { $exists: false } });
    const demoVideoResult = await Video.deleteMany({ creator: { $exists: false } });
    if (demoTrackResult.deletedCount || demoVideoResult.deletedCount) {
      console.log(
        `[Kinetic DB] Removed ${demoTrackResult.deletedCount} demo track(s) and ${demoVideoResult.deletedCount} demo video(s).`
      );
    }
  } catch (err) {
    console.warn('[Kinetic DB Cleanup Note]:', err instanceof Error ? err.message : err);
  }
};

const seedAdminAccountIfMissing = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Kinetic DB] Seeding default admin creator account...');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('kinetic2026', salt);
      await User.create({
        name: 'Kinetic Creator',
        username: 'kinetic_creator',
        email: 'creator@kinetic.com',
        passwordHash,
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kinetic_creator',
        bio: 'Official Kinetic Pioneer Creator',
        role: 'creator',
        followersCount: 1240,
        followingCount: 84,
      });
    }
  } catch (err) {
    console.warn('[Kinetic DB Seed Note]:', err instanceof Error ? err.message : err);
  }
};

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kinetic';
    await mongoose.connect(mongoUri);
    console.log('[Kinetic DB] MongoDB connection status: CONNECTED');
    await removeLegacyDemoContent();
    await seedAdminAccountIfMissing();
  } catch (error) {
    console.warn(`[Kinetic DB] Local MongoDB connection note: ${error instanceof Error ? error.message : error}. Running in resilient offline/fallback state mode.`);
  }
};

export const getDatabaseStatus = () => {
  const states: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const state = states[mongoose.connection.readyState] || 'unknown';

  return {
    connected: mongoose.connection.readyState === 1,
    state,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};
