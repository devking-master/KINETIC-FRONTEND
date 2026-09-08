import mongoose, { Schema, Document } from 'mongoose';

export interface ITrack extends Document {
  title: string;
  artist: string;
  artistId?: mongoose.Types.ObjectId;
  album: string;
  coverUrl: string;
  audioUrl: string;
  cloudinaryPublicId?: string;
  duration: number; // in seconds
  genre: string;
  bpm?: number;
  uploadedBy?: mongoose.Types.ObjectId;
  source: 'user' | 'api' | 'fallback';
  playsCount: number;
  likesCount: number;
  createdAt: Date;
}

const TrackSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  artist: { type: String, required: true, trim: true },
  artistId: { type: Schema.Types.ObjectId, ref: 'User' },
  album: { type: String, default: 'Single' },
  coverUrl: { type: String, required: true },
  audioUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String },
  duration: { type: Number, required: true },
  genre: { type: String, default: 'Electronic' },
  bpm: { type: Number, default: 120 },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  source: { type: String, enum: ['user', 'api', 'fallback'], default: 'user' },
  playsCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const Track = mongoose.model<ITrack>('Track', TrackSchema);
