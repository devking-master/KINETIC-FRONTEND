export type MediaSource = 'user' | 'api' | 'fallback';

export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  coverUrl: string;
  audioUrl?: string;
  duration: number; // in seconds
  durationFormatted?: string;
  bpm?: number;
  key?: string;
  genre?: string;
  format?: string;
  shortsCount?: string;
  plays?: string;
  isLiked?: boolean;
  source?: MediaSource;
  lyrics?: string[];
}

export interface ShortVideo {
  id: string;
  creatorHandle: string;
  creatorName: string;
  creatorAvatar: string;
  creatorRole?: string;
  verified: boolean;
  caption: string;
  videoUrl?: string;
  thumbnailUrl: string;
  duration: number; // in seconds (max 90s)
  views: string;
  likes: string;
  likesCount: number;
  commentsCount: string;
  viewsCount?: number;
  bookmarksCount?: string;
  sharesCount?: string;
  audioTrackTitle: string;
  audioArtist: string;
  audioAssetTag?: string;
  audioTimestamp?: string;
  shortsUsingSound?: string;
  gradientColors?: [string, string];
  waveformType?: 'analog' | 'vocal' | 'subbass' | 'glsl';
  isLiked?: boolean;
  isBookmarked?: boolean;
  source?: MediaSource;
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  bio?: string;
  role: 'listener' | 'creator';
  followersCount: number;
  followingCount: number;
}

export interface LiveComment {
  id: string;
  userHandle: string;
  userAvatar: string;
  timeAgo: string;
  text: string;
  likes: number;
  isLiked?: boolean;
}

export interface Creator {
  id: string;
  name: string;
  handle: string;
  genre: string;
  followers: string;
  shortsCount: number;
  avatarUrl: string;
  verified: boolean;
  isFollowing?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  coverUrl: string;
  tracksCount: number;
  ownerName: string;
}

export type ActiveTab = 'home' | 'discover' | 'music' | 'shorts' | 'library' | 'creator-studio' | 'auth';
