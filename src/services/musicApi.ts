import { Track } from '../types';
import { authApi } from './authApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type ApiTrack = Track & { _id?: string; createdAt?: string; playsCount?: number; likesCount?: number };

const LEGACY_TRACK_COVER = 'images.unsplash.com/photo-1511671782779-c97d3d27a1d4';

const getTrackCover = (track: ApiTrack) => track.coverUrl?.includes(LEGACY_TRACK_COVER)
  ? `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(`${track.title}-${track.artist}`)}&backgroundColor=111827,312e81,164e63`
  : track.coverUrl;

const normalizeTrack = (track: ApiTrack, sourceFallback: Track['source'] = 'user'): Track => ({
  ...track,
  id: track.id || track._id || `track-${track.title}-${track.artist}`,
  coverUrl: getTrackCover(track),
  source: track.source || sourceFallback,
});

export const musicApi = {
  async getTrendingTracks(): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/music/trending`);
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          return data.tracks.map((t: ApiTrack) => normalizeTrack(t));
        }
      }
    } catch {
      return [];
    }
    return [];
  },

  async getAllTracks(): Promise<Track[]> {
    try {
      const res = await fetch(`${API_BASE}/music`);
      if (res.ok) {
        const data = await res.json();
        if (data.tracks && data.tracks.length > 0) {
          const userTracks = data.tracks.map((t: ApiTrack) => normalizeTrack(t));
          return userTracks;
        }
      }
    } catch {
      return [];
    }
    return [];
  },

  async getMyTracks(): Promise<(Track & { createdAt?: string; playsCount?: number; likesCount?: number })[]> {
    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/music/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch your tracks');
    }
    const data = await res.json();
    return (data.tracks || []).map((track: ApiTrack) => normalizeTrack(track));
  },

  async searchMusic(query: string): Promise<{ tracks: Track[]; videos: unknown[] }> {
    try {
      const res = await fetch(`${API_BASE}/music/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          ...data,
          tracks: (data.tracks || []).map((t: ApiTrack) => normalizeTrack(t)),
        };
      }
    } catch {
      return { tracks: [], videos: [] };
    }
  },
};
