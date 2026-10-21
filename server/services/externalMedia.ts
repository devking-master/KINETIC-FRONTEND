import type { ITrack } from '../models/Track';
import type { IVideo } from '../models/Video';

const JAMENDO_API_URL = 'https://api.jamendo.com/v3.0';
const PEXELS_API_URL = 'https://api.pexels.com/videos';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

export const logMissingProviderKeys = () => {
  if (!process.env.JAMENDO_CLIENT_ID) {
    console.warn('[Kinetic] JAMENDO_CLIENT_ID is not set - online music is disabled');
  }
  if (!process.env.PEXELS_API_KEY) {
    console.warn('[Kinetic] PEXELS_API_KEY is not set - online videos are disabled');
  }
};

type CacheEntry<T> = { value: T; expiresAt: number };
const jamendoCache = new Map<string, CacheEntry<Partial<ITrack>[]>>();
const pexelsCache = new Map<string, CacheEntry<Partial<IVideo>[]>>();
const jamendoInFlight = new Map<string, Promise<Partial<ITrack>[]>>();
const pexelsInFlight = new Map<string, Promise<Partial<IVideo>[]>>();

type JamendoTrack = {
  id: number;
  name: string;
  artist_name: string;
  album_name?: string;
  album_image?: string;
  image?: string;
  audio?: string;
  duration?: number;
  genre?: string;
};

type PexelsVideo = {
  id: number;
  url: string;
  image: string;
  user?: { name?: string; url?: string };
  duration: number;
  video_files?: Array<{ link: string; width?: number; height?: number; quality?: string }>;
};

const fetchJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    throw new Error(`Provider request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const getCachedOrFetch = async <T>(
  cache: Map<string, CacheEntry<T>>,
  inFlight: Map<string, Promise<T>>,
  key: string,
  fetchValue: () => Promise<T>,
): Promise<T> => {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const value = await fetchValue();
      if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) cache.delete(oldestKey);
      }
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    } catch (error) {
      if (cached) return cached.value;
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, request);
  return request;
};

const formatDuration = (duration: number) => {
  const minutes = Math.floor(duration / 60);
  const seconds = String(Math.floor(duration % 60)).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

const getJamendoClientId = () => process.env.JAMENDO_CLIENT_ID;

export const getJamendoTracks = async (query?: string): Promise<Partial<ITrack>[]> => {
  const clientId = getJamendoClientId();
  if (!clientId) return [];

  return getCachedOrFetch(jamendoCache, jamendoInFlight, (query || '').trim().toLowerCase(), async () => {
    const params = new URLSearchParams({
      client_id: clientId,
      format: 'json',
      limit: '20',
      audioformat: 'mp32',
      imagesize: '500',
      order: 'popularity_total',
    });
    if (query) params.set('search', query);

    const data = await fetchJson<{ results?: JamendoTrack[] }>(`${JAMENDO_API_URL}/tracks/?${params}`);
    return (data.results || []).filter((track) => track.audio).map((track) => ({
      id: `jamendo-${track.id}`,
      title: track.name,
      artist: track.artist_name,
      album: track.album_name || 'Jamendo Discovery',
      coverUrl: track.album_image || track.image || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=500',
      audioUrl: track.audio,
      duration: track.duration || 0,
      durationFormatted: formatDuration(track.duration || 0),
      genre: track.genre || 'Electronic',
      source: 'api' as const,
      playsCount: 0,
      likesCount: 0,
    }));
  });
};

const chooseVideoFile = (files: PexelsVideo['video_files'] = []) => {
  const portrait = files
    .filter((file) => (file.height || 0) > (file.width || 0))
    .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  return portrait?.link || files.find((file) => file.quality === 'hd')?.link || files[0]?.link;
};

export const getPexelsVideos = async (query?: string): Promise<Partial<IVideo>[]> => {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];

  return getCachedOrFetch(pexelsCache, pexelsInFlight, (query || '').trim().toLowerCase(), async () => {
    const endpoint = query
      ? `${PEXELS_API_URL}/search?query=${encodeURIComponent(query)}&per_page=20`
      : `${PEXELS_API_URL}/popular?per_page=20`;

    const data = await fetchJson<{ videos?: PexelsVideo[] }>(endpoint, {
      headers: { Authorization: apiKey },
    });

    return (data.videos || []).map((video) => ({
      id: `pexels-${video.id}`,
      caption: `A live visual from ${video.user?.name || 'Pexels'} #kinetic #visuals`,
      videoUrl: chooseVideoFile(video.video_files),
      thumbnailUrl: video.image,
      duration: Math.min(video.duration || 15, 90),
      creatorName: video.user?.name || 'Pexels Creator',
      creatorHandle: `@${(video.user?.name || 'pexels').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      creatorAvatar: '',
      audioTrackTitle: 'Original Sound',
      audioArtist: 'Kinetic Visuals',
      hashtags: ['kinetic', 'visuals'],
      viewsCount: 0,
      likesCount: 0,
      commentsCount: 0,
      source: 'api' as const,
    })).filter((video) => video.videoUrl);
  });
};