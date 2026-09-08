import { LiveComment, ShortVideo } from '../types';
import { authApi } from './authApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type ApiVideo = ShortVideo & { _id?: string; viewsCount?: number; createdAt?: string };

const LEGACY_VIDEO_THUMBNAIL = 'images.unsplash.com/photo-1598488035139-bdbb2231ce04';

const getVideoThumbnail = (video: ApiVideo) => {
  if (video.thumbnailUrl && !video.thumbnailUrl.includes(LEGACY_VIDEO_THUMBNAIL)) {
    return video.thumbnailUrl;
  }
  if (!video.videoUrl) return video.thumbnailUrl || '';
  return video.videoUrl
    .replace('/upload/', '/upload/so_0/')
    .replace(/\.[^/.?]+(?:\?.*)?$/, '.jpg');
};

const normalizeVideo = (video: ApiVideo, sourceFallback: ShortVideo['source'] = 'user'): ShortVideo => ({
  ...video,
  id: video.id || video._id || `video-${video.creatorHandle}-${video.caption}`,
  views: video.views || String(video.viewsCount || 0),
  likes: video.likes || String(video.likesCount || 0),
  commentsCount: video.commentsCount || '0',
  thumbnailUrl: getVideoThumbnail(video),
  source: video.source || sourceFallback,
});

const getVideos = async (endpoint: string): Promise<ShortVideo[]> => {
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Video API request failed (${res.status})`);
  }

  const data = await res.json();
  return (data.videos || [])
    .filter((video: ApiVideo) => typeof video.videoUrl === 'string' && video.videoUrl.length > 0)
    .map((video: ApiVideo) => normalizeVideo(video));
};

export const videoApi = {
  async getTrendingVideos(): Promise<ShortVideo[]> {
    try {
      return await getVideos(`${API_BASE}/videos/trending`);
    } catch {
      return [];
    }
  },

  async getAllVideos(): Promise<ShortVideo[]> {
    try {
      return await getVideos(`${API_BASE}/videos`);
    } catch {
      return [];
    }
  },

  async getMyVideos(): Promise<(ShortVideo & { createdAt?: string })[]> {
    const token = authApi.getToken();
    const res = await fetch(`${API_BASE}/videos/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error('Failed to fetch your videos');
    }
    const data = await res.json();
    return (data.videos || [])
      .filter((video: ApiVideo) => typeof video.videoUrl === 'string' && video.videoUrl.length > 0)
      .map((video: ApiVideo) => normalizeVideo(video));
  },

  async toggleLikeVideo(videoId: string, token: string): Promise<{ liked: boolean; likesCount?: number }> {
    const res = await fetch(`${API_BASE}/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Unable to update like');
    }
    return body;
  },

  async toggleSaveVideo(videoId: string, token: string): Promise<{ saved: boolean }> {
    const res = await fetch(`${API_BASE}/videos/${videoId}/save`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Unable to update saved videos');
    }
    return body;
  },

  async recordView(videoId: string): Promise<{ viewsCount: number }> {
    const res = await fetch(`${API_BASE}/videos/${videoId}/view`, { method: 'POST' });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Unable to record video view');
    }
    return body;
  },

  async recordShare(videoId: string): Promise<{ sharesCount: number }> {
    const res = await fetch(`${API_BASE}/videos/${videoId}/share`, { method: 'POST' });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Unable to record video share');
    }
    return body;
  },

  async getComments(videoId: string): Promise<LiveComment[]> {
    const res = await fetch(`${API_BASE}/videos/${videoId}/comments`);
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Unable to load comments');
    }
    return (body.comments || []).map((comment: {
      _id: string;
      userHandle: string;
      userAvatar: string;
      text: string;
      likesCount: number;
      createdAt: string;
    }) => ({
      id: comment._id,
      userHandle: comment.userHandle,
      userAvatar: comment.userAvatar,
      timeAgo: formatTimeAgo(comment.createdAt),
      text: comment.text,
      likes: comment.likesCount || 0,
    }));
  },

  async addComment(videoId: string, text: string, token: string): Promise<{ comment: LiveComment; commentsCount: number }> {
    const res = await fetch(`${API_BASE}/videos/${videoId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Unable to post comment');
    }
    return {
      commentsCount: body.commentsCount,
      comment: {
        id: body.comment._id,
        userHandle: body.comment.userHandle,
        userAvatar: body.comment.userAvatar,
        timeAgo: 'Just now',
        text: body.comment.text,
        likes: body.comment.likesCount || 0,
      },
    };
  },
};

const formatTimeAgo = (dateString: string) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
