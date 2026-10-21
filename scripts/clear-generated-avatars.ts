import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../server/models/User';

const applyChanges = process.argv.includes('--apply');
const oldDefaultAvatar = 'photo-1534528741775-53994a69daeb';

const run = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kinetic';
  await mongoose.connect(mongoUri);
  const filter = { avatarUrl: { $regex: `dicebear|${oldDefaultAvatar}`, $options: 'i' } };
  const matchingUsers = await User.find(filter).select('_id username avatarUrl').lean();
  console.log(`Avatar cleanup ${applyChanges ? '(apply)' : '(dry run)'}: ${matchingUsers.length} matching user(s).`);
  matchingUsers.forEach((user) => console.log(`${user.username} ${user._id}: ${user.avatarUrl}`));
  if (applyChanges && matchingUsers.length) {
    const result = await User.updateMany(filter, { $set: { avatarUrl: '' } });
    console.log(`Cleared ${result.modifiedCount} generated avatar(s).`);
  }
};

run().catch((error: unknown) => {
  console.error('Avatar cleanup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await mongoose.disconnect();
});