import { Track } from '../types';
import { authApi } from './authApi';
import { fetchWithRetry } from './fetchWithRetry';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type ApiTrack = Track & { _id?: string; createdAt?: string; playsCount?: number; likesCount?: number };
const TRACK_CACHE_TTL_MS = 5 * 60 * 1000;
const trackRequestCache = new Map<string, { value: unknown; expiresAt: number }>();
const inFlightTrackRequests = new Map<string, Promise<unknown>>();
let trackCacheGeneration = 0;

export const clearTrackCache = () => {
  trackCacheGeneration += 1;
  trackRequestCache.clear();
  inFlightTrackRequests.clear();
};

const hasApiTracks = (value: unknown): boolean => {
  const tracks = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && 'tracks' in value
      ? (value as { tracks?: unknown }).tracks
      : undefined;
  return Array.isArray(tracks) && tracks.some((track) =>
    typeof track === 'object' && track !== null && 'source' in track && track.source === 'api'
  );
};

const cachedTrackRequest = <T>(key: string, request: () => Promise<T>): Promise<T> => {
  const cached = trackRequestCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value as T);

  const inFlight = inFlightTrackRequests.get(key);
  if (inFlight) return inFlight as Promise<T>;

  const generation = trackCacheGeneration;
  let pending: Promise<T>;
  pending = request().then((value) => {
    if (generation === trackCacheGeneration && hasApiTracks(value)) {
      trackRequestCache.set(key, { value, expiresAt: Date.now() + TRACK_CACHE_TTL_MS });
    }
    return value;
  }).finally(() => {
    if (inFlightTrackRequests.get(key) === pending) inFlightTrackRequests.delete(key);
  });
  inFlightTrackRequests.set(key, pending);
  return pending;
};

const LEGACY_TRACK_COVER = 'images.unsplash.com/photo-1511671782779-c97d3d27a1d4';

const getTrackCover = (track: ApiTrack) => track.coverUrl?.includes(LEGACY_TRACK_COVER)
  ? `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(`${track.title}-${track.artist}`)}&backgroundColor=111827,312e81,164e63`
  : track.coverUrl;

const normalizeTrack = (track: ApiTrack, sourceFallback: Track['source'] = 'user'): Track => ({
  ...track,
  id: track.id || track._id || `track-${track.title}-${track.artist}`,
  coverUrl: getTrackCover(track),
  isLiked: track.isLiked ?? false,
  source: track.source || sourceFallback,
});

export const musicApi = {
  async setLike(id: string, liked: boolean): Promise<{ liked: boolean; likesCount: number }> {
    const token = await authApi.getValidToken();
    if (!token) throw new Error('Sign in to like tracks.');
    const res = await fetch(`${API_BASE}/music/${encodeURIComponent(id)}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ liked }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Unable to update like');
    return body;
  },

  async getTrendingTracks(): Promise<Track[]> {
    const token = authApi.getToken();
    return cachedTrackRequest(`trending:${token || 'anonymous'}`, async () => {
      const res = await fetchWithRetry(`${API_BASE}/music/trending`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to fetch trending tracks');
      const data = await res.json();
      return (data.tracks || []).map((track: ApiTrack) => normalizeTrack(track));
    });
  },

  async getAllTracks(): Promise<Track[]> {
    const token = authApi.getToken();
    return cachedTrackRequest(`all-tracks:${token || 'anonymous'}`, async () => {
      const res = await fetchWithRetry(`${API_BASE}/music`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Failed to fetch tracks');
      const data = await res.json();
      return (data.tracks || []).map((track: ApiTrack) => normalizeTrack(track));
    });
  },

  async getMyTracks(): Promise<(Track & { createdAt?: string; playsCount?: number; likesCount?: number })[]> {
    const token = authApi.getToken();
    const res = await fetchWithRetry(`${API_BASE}/music/mine`, {
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
      const token = authApi.getToken();
      const res = await fetchWithRetry(`${API_BASE}/music/search?q=${encodeURIComponent(query)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
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
    return { tracks: [], videos: [] };
  },

  async getRecommended(): Promise<{ tracks: Track[]; videos: unknown[]; personalized: boolean }> {
    try {
      const token = authApi.getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return await cachedTrackRequest(`recommended:${token || 'anonymous'}`, async () => {
        const res = await fetchWithRetry(`${API_BASE}/discover/recommended`, { headers });
        if (!res.ok) throw new Error('Failed to fetch recommendations');
        const data = await res.json();
        return {
          tracks: (data.tracks || []).map((track: ApiTrack) => normalizeTrack(track)),
          videos: data.videos || [],
          personalized: data.personalized ?? false,
        };
      });
    } catch {
      throw new Error('Failed to fetch recommendations');
    }
  },
};
