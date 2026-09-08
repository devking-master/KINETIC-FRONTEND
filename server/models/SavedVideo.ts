import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedVideo extends Document {
  userId: mongoose.Types.ObjectId;
  videoId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SavedVideoSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: Schema.Types.ObjectId, ref: 'Video', required: true },
  createdAt: { type: Date, default: Date.now },
});

SavedVideoSchema.index({ userId: 1, videoId: 1 }, { unique: true });

export const SavedVideo = mongoose.model<ISavedVideo>('SavedVideo', SavedVideoSchema);