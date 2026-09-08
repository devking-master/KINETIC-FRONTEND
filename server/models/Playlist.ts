import mongoose, { Schema, Document } from 'mongoose';

export interface IPlaylist extends Document {
  title: string;
  description?: string;
  coverUrl: string;
  owner: mongoose.Types.ObjectId;
  tracks: mongoose.Types.ObjectId[];
  isPublic: boolean;
  createdAt: Date;
}

const PlaylistSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  coverUrl: { type: String, default: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80' },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tracks: [{ type: Schema.Types.ObjectId, ref: 'Track' }],
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const Playlist = mongoose.model<IPlaylist>('Playlist', PlaylistSchema);
