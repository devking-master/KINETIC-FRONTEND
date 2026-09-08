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
    validate: {
      validator: function(val: number) {
        return val > 0 && val <= 90;
      },
      message: 'Video duration must not exceed 90 seconds (1 minute 30 seconds).'
    }
  },
  creator: { type: Schema.Types.ObjectId, ref: 'User' },
  creatorName: { type: String, required: true },
  creatorHandle: { type: String, required: true },
  creatorAvatar: { type: String, required: true },
  soundId: { type: Schema.Types.ObjectId, ref: 'Track' },
  audioTrackTitle: { type: String, default: 'Original Sound' },
  audioArtist: { type: String, default: 'Kinetic Creator' },
  hashtags: [{ type: String }],
  viewsCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  source: { type: String, enum: ['user', 'api', 'fallback'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

export const Video = mongoose.model<IVideo>('Video', VideoSchema);
