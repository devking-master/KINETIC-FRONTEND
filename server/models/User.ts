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
  interests: { genres: string[]; topics: string[] };
  onboardingIntent: 'explore' | 'create' | 'both';
  onboardingCompleted: boolean;
  onboardedAt?: Date;
  tokenVersion: number;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  bio: { type: String, default: '' },
  role: { type: String, enum: ['listener', 'creator', 'admin'], default: 'creator' },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  interests: {
    genres: { type: [String], default: [] },
    topics: { type: [String], default: [] },
  },
  onboardingIntent: { type: String, enum: ['explore', 'create', 'both'], default: 'explore' },
  onboardingCompleted: { type: Boolean, default: true },
  onboardedAt: { type: Date },
  tokenVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
