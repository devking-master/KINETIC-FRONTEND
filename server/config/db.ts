import mongoose from 'mongoose';
import { Track } from '../models/Track';
import { Video } from '../models/Video';

// One-time cleanup: removes any leftover demo/sample tracks & videos that
// don't belong to a real uploader. Real uploads always set `uploadedBy` /
// `creator` (enforced by the authenticated upload routes), so this only
// ever touches old seed data and is a safe no-op once that's gone.
// Gated behind RUN_LEGACY_CLEANUP=true so it never runs automatically.
const removeLegacyDemoContent = async () => {
  if (process.env.RUN_LEGACY_CLEANUP !== 'true') return;
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

export const connectDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kinetic';
  while (true) {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
      console.log('[Kinetic DB] MongoDB connection status: CONNECTED');
      break;
    } catch (error) {
      console.warn(`[Kinetic DB] Connection failed: ${error instanceof Error ? error.message : error}. Retrying in 5 seconds.`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  await removeLegacyDemoContent();
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