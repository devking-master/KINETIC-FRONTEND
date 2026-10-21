import 'dotenv/config';
import mongoose from 'mongoose';
import { Like } from '../server/models/Social';
import { Track } from '../server/models/Track';
import { Video } from '../server/models/Video';

const applyChanges = process.argv.includes('--apply');

const run = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kinetic';
  await mongoose.connect(mongoUri);

  const [videoCounts, trackCounts, videos, tracks] = await Promise.all([
    Like.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { targetType: 'video' } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
    ]),
    Like.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
      { $match: { targetType: 'track' } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
    ]),
    Video.find().select('_id likesCount').lean(),
    Track.find().select('_id likesCount').lean(),
  ]);

  const videoCountById = new Map(videoCounts.map(({ _id, count }) => [String(_id), count]));
  const trackCountById = new Map(trackCounts.map(({ _id, count }) => [String(_id), count]));
  const differences = [
    ...videos.map((video) => ({ type: 'video', id: String(video._id), stored: video.likesCount || 0, actual: videoCountById.get(String(video._id)) || 0 })),
    ...tracks.map((track) => ({ type: 'track', id: String(track._id), stored: track.likesCount || 0, actual: trackCountById.get(String(track._id)) || 0 })),
  ].filter((item) => item.stored !== item.actual);

  console.log(`Likes recount ${applyChanges ? '(apply)' : '(dry run)'}: ${differences.length} difference(s).`);
  differences.forEach(({ type, id, stored, actual }) => console.log(`${type} ${id}: stored=${stored}, actual=${actual}`));
  if (applyChanges && differences.length) {
    await Promise.all([
      Video.bulkWrite(differences.filter((item) => item.type === 'video').map((item) => ({ updateOne: { filter: { _id: item.id }, update: { $set: { likesCount: item.actual } } } }))),
      Track.bulkWrite(differences.filter((item) => item.type === 'track').map((item) => ({ updateOne: { filter: { _id: item.id }, update: { $set: { likesCount: item.actual } } } }))),
    ]);
    console.log(`Applied ${differences.length} correction(s).`);
  }
};

run().catch((error: unknown) => {
  console.error('Likes recount failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});