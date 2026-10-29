import mongoose, { Schema, Document } from 'mongoose';

export interface IVideo extends Document {
  caption: string;
  videoUrl: string;
  thumbnailUrl: string;
  cloudinaryPublicId?: string;
  duration: number; // in seconds (max 90 seconds)
  creator: mongoose.Types.ObjectId;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string;
  soundId?: mongoose.Types.ObjectId;
  audioTrackTitle: string;
  audioArtist: string;
  hashtags: string[];
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  source: 'user' | 'api' | 'fallback';
  isReported: boolean;
  reportCount: number;
  reportReasons: string[];
  createdAt: Date;
}

const VideoSchema: Schema = new Schema({
  caption: { type: String, required: true, trim: true },
  videoUrl: { type: String, required: true },
  thumbnailUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String },
  duration: {
    type: Number,
    required: true,
    min: [1, 'The video length could not be read (it must be at least 1 second).'],
    max: [90, 'Video duration must not exceed 90 seconds (1 minute 30 seconds).'],
  },
  creator: { type: Schema.Types.ObjectId, ref: 'User' },
  creatorName: { type: String, required: true },
  creatorHandle: { type: String, required: true },
  creatorAvatar: { type: String, default: '' },
  soundId: { type: Schema.Types.ObjectId, ref: 'Track' },
  audioTrackTitle: { type: String, default: 'Original Sound' },
  audioArtist: { type: String, default: 'Kinetic Creator' },
  hashtags: [{ type: String }],
  viewsCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  source: { type: String, enum: ['user', 'api', 'fallback'], default: 'user' },
  isReported: { type: Boolean, default: false },
  reportCount: { type: Number, default: 0 },
  reportReasons: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

VideoSchema.index({ createdAt: -1 });
VideoSchema.index({ creator: 1, createdAt: -1 });
VideoSchema.index({ caption: 1 });
VideoSchema.index({ creatorName: 1 });
VideoSchema.index({ audioTrackTitle: 1 });
VideoSchema.index({ hashtags: 1 });
VideoSchema.index({ caption: 'text', creatorName: 'text', audioTrackTitle: 'text' });
VideoSchema.index({ cloudinaryPublicId: 1 }, { unique: true, sparse: true });

export const Video = mongoose.model<IVideo>('Video', VideoSchema);
