import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
  coverUrl?: string;
  bio?: string;
  role: 'listener' | 'creator' | 'admin';
  followersCount: number;
  followingCount: number;
  tokenVersion: number;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80' },
  coverUrl: { type: String, default: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1600&auto=format&fit=crop&q=80' },
  bio: { type: String, default: 'Kinetic Creator & Music Enthusiast' },
  role: { type: String, enum: ['listener', 'creator', 'admin'], default: 'creator' },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  tokenVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
