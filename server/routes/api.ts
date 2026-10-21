import { Report } from '../models/Report';
import { Router, Request, Response } from 'express';
import { signup, login, getCurrentUser } from '../controllers/authController';
import { getUploadSignature, createUploadedTrack, createUploadedVideo } from '../controllers/uploadController';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  validateBody,
  signupSchema,
  loginSchema,
  profileUpdateSchema,
  trackUploadSchema,
  videoUploadSchema,
  commentCreateSchema,
  playlistCreateSchema,
  playlistTrackSchema,
  onboardingSchema,
} from '../middleware/validate';
import { authLimiter, socialLimiter, signatureLimiter } from '../middleware/rateLimiters';
import { Track } from '../models/Track';
import { Video } from '../models/Video';
import { Playlist } from '../models/Playlist';
import { z } from 'zod';
import { isAllowedOrigin } from '../config/origins';
import { clearRefreshCookie } from '../utils/cookies';
import { verifyAccessToken, signAccessToken, verifyRefreshToken, signRefreshToken } from '../utils/tokens';
import { Comment, Like, Follow } from '../models/Social';
import { SavedVideo } from '../models/SavedVideo';
import { User } from '../models/User';
import { getJamendoTracks, getPexelsVideos } from '../services/externalMedia';
import { emitCommentAdded, emitVideoLikeUpdated, emitTrackLikeUpdated } from '../services/socketService';
import { withViewerState } from '../services/viewerState';
import { withCommentAvatars, withCreatorAvatars } from '../services/avatars';
import mongoose from 'mongoose';

const router = Router();

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const reportSchema = z.object({
  targetType: z.enum(['video', 'track', 'comment']),
  targetId: z.string().regex(/^[a-f\d]{24}$/i, 'targetId must be a valid ID'),
  reason: z.enum(['spam', 'harassment', 'hate_speech', 'misinformation', 'copyright', 'explicit_content', 'other']),
  details: z.string().max(500).optional(),
});

const reportActionSchema = z.object({
  action: z.enum(['dismiss', 'remove']),
});

const likeWriteQueues = new Map<string, Promise<void>>();
const serializeLikeWrite = async <T>(key: string, write: () => Promise<T>): Promise<T> => {
  const previous = likeWriteQueues.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  likeWriteQueues.set(key, current);
  await previous;
  try {
    return await write();
  } finally {
    release();
    if (likeWriteQueues.get(key) === current) likeWriteQueues.delete(key);
  }
};

// ============================================================
// AUTH ROUTES
// ============================================================
router.post('/auth/signup', authLimiter, validateBody(signupSchema), signup);
router.post('/auth/login', authLimiter, validateBody(loginSchema), login);
router.get('/auth/me', requireAuth, getCurrentUser);

// Refresh access token using a long-lived refresh token (stored in httpOnly cookie)
router.post('/auth/refresh', async (req: Request, res: Response) => {
  const origin = req.headers.origin || '';
  const clientHeader = req.headers['x-kinetic-client'];
  if (!isAllowedOrigin(origin) || clientHeader !== 'web') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ message: 'No refresh token provided' });
      return;
    }
    let payload: { id: string; tokenVersion: number };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      clearRefreshCookie(res);
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const user = await User.findById(payload.id).select('tokenVersion role username email');
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      clearRefreshCookie(res);
      res.status(401).json({ message: 'Session invalidated. Please log in again.' });
      return;
    }

    const newAccessToken = signAccessToken({ id: String(user._id), email: user.email, username: user.username, role: user.role });
    res.json({ token: newAccessToken });
  } catch (err) {
    console.error('[Kinetic] refresh error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Error refreshing token' });
  }
});

// Logout: increment tokenVersion so all existing refresh tokens become invalid
router.post('/auth/logout', async (req: AuthRequest, res: Response) => {
  const origin = req.headers.origin || '';
  const clientHeader = req.headers['x-kinetic-client'];
  if (!isAllowedOrigin(origin) || clientHeader !== 'web') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  try {
    // Identify the user from the refresh cookie (works even when the 1h access token has expired),
    // falling back to a still-valid access token.
    let userId: string | undefined;
    try {
      if (req.cookies?.refreshToken) userId = verifyRefreshToken(req.cookies.refreshToken).id;
    } catch { /* invalid cookie: just clear it below */ }
    if (!userId) {
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        try { userId = verifyAccessToken(header.split(' ')[1]).id; } catch { /* ignore */ }
      }
    }
    if (userId) await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
    clearRefreshCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[Kinetic] logout error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Error logging out' });
  }
});

// Update user profile
router.patch('/auth/profile', requireAuth, validateBody(profileUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { bio, name, avatarUrl, coverUrl, interests, onboardingIntent, onboardingCompleted } = req.body;
    const update: Record<string, unknown> = {};
    if (bio !== undefined) update.bio = bio;
    if (name) update.name = name;
    if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;
    if (coverUrl !== undefined) update.coverUrl = coverUrl;
    if (interests !== undefined) update['interests.genres'] = [...new Set(interests)];
    if (onboardingIntent !== undefined) update.onboardingIntent = onboardingIntent;
    if (onboardingCompleted !== undefined) update.onboardingCompleted = onboardingCompleted;

    const user = await User.findByIdAndUpdate(req.user!.id, update, { returnDocument: 'after' }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    console.error('[Kinetic] profile update error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Get public profile by username
router.get('/users/:username', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ username: req.params.username.toLowerCase() }).select('-passwordHash -email');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const [tracks, videos, playlists, likes] = await Promise.all([
      Track.find({ uploadedBy: user._id }).sort({ createdAt: -1 }).limit(50),
      Video.find({ creator: user._id }).sort({ createdAt: -1 }).limit(50),
      Playlist.find({ owner: user._id }).populate('tracks').sort({ createdAt: -1 }).limit(30),
      Like.find({ targetId: { $in: [...(await Track.find({ uploadedBy: user._id }).select('_id')), ...(await Video.find({ creator: user._id }).select('_id'))].map((item) => item._id) } }),
    ]);
    const authHeader = req.headers.authorization;
    let isFollowing = false;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const viewer = verifyAccessToken(authHeader.slice(7));
        isFollowing = !!(await Follow.exists({ followerId: viewer.id, followingId: user._id }));
      } catch {
        isFollowing = false;
      }
    }
    res.json({
      user,
      tracks: await withViewerState(await withCreatorAvatars(tracks as any[]), getOptionalUser(req)?.id, 'track'),
      videos: await withViewerState(await withCreatorAvatars(videos as any[]), getOptionalUser(req)?.id, 'video'),
      playlists: await withCreatorAvatars(playlists as any[]),
      totalUploads: tracks.length + videos.length,
      totalLikesReceived: likes.length,
      isFollowing,
    });
  } catch (err) {
    console.error('[Kinetic] get user error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// ============================================================
// UPLOAD ROUTES (Cloudinary Signed Upload Flow)
// ============================================================
router.get('/upload/signature', requireAuth, signatureLimiter, getUploadSignature);
router.post('/upload/track', requireAuth, validateBody(trackUploadSchema), createUploadedTrack);
router.post('/upload/video', requireAuth, validateBody(videoUploadSchema), createUploadedVideo);

// ============================================================
// MUSIC / TRACKS ROUTES
// ============================================================
router.get('/music', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    // Your own uploads always come first; live provider tracks fill out the rest.
    const ownTracks = await Track.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const ownTotal = await Track.countDocuments();

    let apiTracks: Awaited<ReturnType<typeof getJamendoTracks>> = [];
    try {
      apiTracks = await getJamendoTracks();
    } catch (providerError) {
      console.warn('[Kinetic] Jamendo fetch failed:', providerError instanceof Error ? providerError.message : providerError);
    }

    const remainingSlots = Math.max(0, limit - ownTracks.length);
    const combined = [...ownTracks, ...apiTracks.slice(0, remainingSlots)];

    res.json({
      tracks: await withViewerState(await withCreatorAvatars(combined as any[]), getOptionalUser(req)?.id, 'track'),
      total: ownTotal + apiTracks.length,
      page,
      hasMore: skip + ownTracks.length < ownTotal,
      source: ownTracks.length > 0 ? (apiTracks.length > 0 ? 'mixed' : 'database') : (apiTracks.length > 0 ? 'jamendo' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching music' });
  }
});

router.get('/music/trending', async (req: Request, res: Response) => {
  try {
    // Newest uploads surface first, then live provider tracks fill the rest of the list.
    const [ownTracks, apiTracks] = await Promise.all([
      Track.find().sort({ createdAt: -1 }).limit(20),
      getJamendoTracks().catch((providerError) => {
        console.warn('[Kinetic] Jamendo fetch failed:', providerError instanceof Error ? providerError.message : providerError);
        return [];
      }),
    ]);

    const remainingSlots = Math.max(0, 20 - ownTracks.length);
    const combined = [...ownTracks, ...apiTracks.slice(0, remainingSlots)];

    res.json({
      tracks: await withViewerState(await withCreatorAvatars(combined as any[]), getOptionalUser(req)?.id, 'track'),
      source: ownTracks.length > 0 ? (apiTracks.length > 0 ? 'mixed' : 'database') : (apiTracks.length > 0 ? 'jamendo' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trending music' });
  }
});

router.get('/music/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tracks = await Track.find({ uploadedBy: req.user!.id }).sort({ createdAt: -1 });
    res.json({ tracks: await withViewerState(await withCreatorAvatars(tracks as any[]), req.user!.id, 'track') });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your tracks' });
  }
});

// ============================================================
// DISCOVER: RECOMMENDATION SCORING ENGINE
// ============================================================
const getOptionalUser = (req: Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
};

const onboardingFallbackGenres = ['ambient', 'electronic', 'hip hop', 'jazz', 'pop', 'rock', 'soul', 'world'];
const onboardingFallbackTopics = ['music', 'dance', 'comedy', 'gaming', 'art', 'fashion', 'fitness', 'travel'];
let onboardingOptionsCache: { expiresAt: number; value: { genres: Array<{ key: string; label: string; count: number }>; topics: Array<{ key: string; label: string; count: number }> } } | null = null;
const optionKey = (value: unknown) => String(value || '').trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, ' ');
const optionLabel = (key: string) => key.replace(/\b\w/g, (letter) => letter.toUpperCase());

router.get('/onboarding/options', async (_req: Request, res: Response) => {
  try {
    if (onboardingOptionsCache && onboardingOptionsCache.expiresAt > Date.now()) {
      res.json(onboardingOptionsCache.value);
      return;
    }
    const [trackGenres, apiTracks, topicCounts] = await Promise.all([
      Track.aggregate<{ _id: string; count: number }>([
        { $group: { _id: { $toLower: { $trim: { input: '$genre' } } }, count: { $sum: 1 } } },
        { $match: { _id: { $ne: '' } } },
      ]),
      getJamendoTracks().catch(() => []),
      Video.aggregate<{ _id: string; count: number }>([
        { $unwind: '$hashtags' },
        { $group: { _id: { $toLower: { $replaceAll: { input: '$hashtags', find: '#', replacement: '' } } }, count: { $sum: 1 } } },
        { $match: { _id: { $ne: '' } } },
        { $sort: { count: -1 } },
        { $limit: 40 },
      ]),
    ]);
    const genreCounts = new Map<string, number>(trackGenres.map(({ _id, count }) => [optionKey(_id), count]));
    apiTracks.forEach((track) => {
      const key = optionKey(track.genre);
      if (key) genreCounts.set(key, (genreCounts.get(key) || 0) + 1);
    });
    onboardingFallbackGenres.forEach((key) => { if (!genreCounts.has(key)) genreCounts.set(key, 0); });
    const topicMap = new Map(topicCounts.map((item) => [optionKey(item._id), item.count]));
    onboardingFallbackTopics.forEach((key) => { if (!topicMap.has(key)) topicMap.set(key, 0); });
    const value = {
      genres: [...genreCounts].map(([key, count]) => ({ key, label: optionLabel(key), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      topics: [...topicMap].map(([key, count]) => ({ key, label: optionLabel(key), count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    };
    onboardingOptionsCache = { value, expiresAt: Date.now() + 10 * 60 * 1000 };
    res.json(value);
  } catch (err) {
    res.status(500).json({ message: 'Unable to load onboarding options' });
  }
});

router.get('/onboarding/suggested-creators', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [viewer, followed, videoCreatorIds, trackCreatorIds] = await Promise.all([
      User.findById(req.user!.id).select('interests').lean(),
      Follow.find({ followerId: req.user!.id }).distinct('followingId'),
      Video.distinct('creator', { creator: { $exists: true } }),
      Track.distinct('uploadedBy', { uploadedBy: { $exists: true } }),
    ]);
    const excludedIds = new Set([req.user!.id, ...followed.map(String)]);
    const creatorIds = [...new Set([...videoCreatorIds, ...trackCreatorIds].map(String))].filter((id) => !excludedIds.has(id));
    if (!creatorIds.length) { res.json({ creators: [] }); return; }
    const creators = await User.find({ _id: { $in: creatorIds } }).select('name username avatarUrl followersCount').lean();
    const [creatorVideos, creatorTracks] = await Promise.all([
      Video.find({ creator: { $in: creators.map((creator) => creator._id) } }).select('creator hashtags').lean(),
      Track.find({ uploadedBy: { $in: creators.map((creator) => creator._id) } }).select('uploadedBy genre').lean(),
    ]);
    const interests = viewer?.interests || { genres: [], topics: [] };
    const genres = new Set((interests.genres || []).map((genre: string) => genre.toLowerCase()));
    const topics = new Set((interests.topics || []).map((topic: string) => topic.toLowerCase().replace(/^#/, '')));
    const scores = new Map<string, number>();
    creatorVideos.forEach((video) => {
      const id = String(video.creator);
      const match = (video.hashtags || []).filter((tag) => topics.has(String(tag).toLowerCase().replace(/^#/, ''))).length;
      scores.set(id, (scores.get(id) || 0) + match * 3);
    });
    creatorTracks.forEach((track) => {
      const id = String(track.uploadedBy);
      if (track.genre && genres.has(track.genre.toLowerCase())) scores.set(id, (scores.get(id) || 0) + 4);
    });
    const suggested = creators.map((creator) => ({
      id: String(creator._id),
      name: creator.name,
      username: creator.username,
      avatarUrl: creator.avatarUrl || '',
      followersCount: creator.followersCount || 0,
      isFollowing: false,
      score: scores.get(String(creator._id)) || 0,
    })).sort((a, b) => b.score - a.score || b.followersCount - a.followersCount).slice(0, 12)
      .map(({ score: _score, ...creator }) => creator);
    res.json({ creators: suggested });
  } catch (err) {
    res.status(500).json({ message: 'Unable to load suggested creators' });
  }
});

router.patch('/onboarding', requireAuth, socialLimiter, validateBody(onboardingSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { genres, topics, role, name, bio, avatarUrl } = req.body;
    const update: Record<string, unknown> = {
      interests: { genres: [...new Set(genres)], topics: [...new Set(topics)] },
      role,
      onboardingCompleted: true,
      onboardedAt: new Date(),
    };
    if (name?.trim()) update.name = name.trim();
    if (bio !== undefined) update.bio = bio;
    if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;
    const user = await User.findByIdAndUpdate(req.user!.id, update, { returnDocument: 'after' }).select('-passwordHash');
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Unable to save onboarding' });
  }
});

router.get('/discover/recommended', async (req: Request, res: Response) => {
  try {
    const user = getOptionalUser(req);

    const preferredGenres = new Set<string>();
    const preferredHashtags = new Set<string>();
    let followingIds = new Set<string>();

    if (user?.id) {
      const viewer = await User.findById(user.id).select('interests').lean();
      const interests = viewer?.interests as unknown as { genres?: string[]; topics?: string[] } | undefined;
      (interests?.genres || []).forEach((genre) => preferredGenres.add(genre.toLowerCase()));
      (interests?.topics || []).forEach((topic) => preferredHashtags.add(topic.toLowerCase().replace(/^#/, '')));
      const [likes, follows] = await Promise.all([
        Like.find({ userId: user.id }),
        Follow.find({ followerId: user.id }),
      ]);

      followingIds = new Set(follows.map((f) => String(f.followingId)));

      const trackIds = likes.filter((l) => l.targetType === 'track').map((l) => l.targetId);
      const videoIds = likes.filter((l) => l.targetType === 'video').map((l) => l.targetId);

      const [likedTracks, likedVideos] = await Promise.all([
        Track.find({ _id: { $in: trackIds } }).select('genre artist'),
        Video.find({ _id: { $in: videoIds } }).select('hashtags creator'),
      ]);

      likedTracks.forEach((t) => {
        if (t.genre) preferredGenres.add(t.genre.toLowerCase());
      });

      likedVideos.forEach((v) => {
        (v.hashtags || []).forEach((h) => preferredHashtags.add(h.toLowerCase().replace('#', '')));
      });
    }

    // Fetch candidate tracks and videos
    const [candidateTracks, candidateVideos, apiTracks] = await Promise.all([
      Track.find().sort({ createdAt: -1 }).limit(40),
      Video.find().sort({ createdAt: -1 }).limit(40),
      getJamendoTracks().catch(() => []),
    ]);

    // Score tracks: genre overlap (+4), followed creator (+5), likes popularity (+1)
    const scoredTracks = [...candidateTracks, ...apiTracks].map((track) => {
      let score = 0;
      const genre = (track.genre || '').toLowerCase();
      if (preferredGenres.has(genre)) score += 4;
      if (track.uploadedBy && followingIds.has(String(track.uploadedBy))) score += 5;
      score += Math.log10((track.likesCount || 0) + 1);
      return { track, score };
    });

    scoredTracks.sort((a, b) => b.score - a.score);
    const recommendedTracks = scoredTracks.slice(0, 20).map((s) => s.track);

    // Score videos: followed creator (+5), hashtag overlap (+3 per tag), likes popularity (+1)
    const scoredVideos = candidateVideos.map((video) => {
      let score = 0;
      if (video.creator && followingIds.has(String(video.creator))) score += 5;
      (video.hashtags || []).forEach((tag) => {
        if (preferredHashtags.has(tag.toLowerCase().replace('#', ''))) score += 3;
      });
      score += Math.log10((video.likesCount || 0) + 1);
      return { video, score };
    });

    scoredVideos.sort((a, b) => b.score - a.score);
    const recommendedVideos = scoredVideos.slice(0, 20).map((s) => s.video);

    res.json({
      tracks: await withViewerState(await withCreatorAvatars(recommendedTracks as any[]), user?.id, 'track'),
      videos: await withViewerState(await withCreatorAvatars(recommendedVideos as any[]), user?.id, 'video'),
      personalized: user !== null && (preferredGenres.size > 0 || followingIds.size > 0 || preferredHashtags.size > 0),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error generating recommendations' });
  }
});

router.get('/music/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ tracks: [], videos: [] });
      return;
    }
    const safeQ = escapeRegex(q);
    const regex = new RegExp(safeQ, 'i');

    const [uploadedTracks, uploadedVideos, apiTracks, apiVideos] = await Promise.all([
      Track.find({
        $or: [{ title: regex }, { artist: regex }, { album: regex }, { genre: regex }],
      }).limit(20),
      Video.find({
        $or: [{ caption: regex }, { creatorName: regex }, { audioTrackTitle: regex }],
      }).limit(20),
      getJamendoTracks(q).catch((err) => {
        console.warn('[Kinetic] Jamendo search failed:', err instanceof Error ? err.message : err);
        return [];
      }),
      getPexelsVideos(q).catch((err) => {
        console.warn('[Kinetic] Pexels search failed:', err instanceof Error ? err.message : err);
        return [];
      }),
    ]);

    // Blend uploaded tracks with Jamendo results, filling remaining slots
    const remainingTrackSlots = Math.max(0, 20 - uploadedTracks.length);
    const blendedTracks = [...uploadedTracks, ...apiTracks.slice(0, remainingTrackSlots)];

    // Blend uploaded videos with Pexels results, filling remaining slots
    const remainingVideoSlots = Math.max(0, 20 - uploadedVideos.length);
    const blendedVideos = [...uploadedVideos, ...apiVideos.slice(0, remainingVideoSlots)];

    res.json({
      tracks: await withViewerState(await withCreatorAvatars(blendedTracks as any[]), getOptionalUser(req)?.id, 'track'),
      videos: await withViewerState(await withCreatorAvatars(blendedVideos as any[]), getOptionalUser(req)?.id, 'video'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error searching media' });
  }
});

router.get('/music/:id', async (req: Request, res: Response) => {
  try {
    const track = await Track.findById(req.params.id);
    if (!track) {
      res.status(404).json({ message: 'Track not found' });
      return;
    }
    // Increment play count in background
    Track.findByIdAndUpdate(req.params.id, { $inc: { playsCount: 1 } }).exec();
    res.json({ track: (await withViewerState(await withCreatorAvatars([track as any]), getOptionalUser(req)?.id, 'track'))[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching track' });
  }
});

router.post('/music/:id/like', requireAuth, socialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const trackId = req.params.id;
    const userId = req.user!.id;
    if (!mongoose.isValidObjectId(trackId)) {
      res.status(400).json({ message: 'Likes are only available on Kinetic tracks' });
      return;
    }
    const track = await Track.findById(trackId).select('_id');
    if (!track) { res.status(404).json({ message: 'Track not found' }); return; }
    const { liked, likesCount } = await serializeLikeWrite(`track:${trackId}`, async () => {
      const filter = { userId, targetId: trackId, targetType: 'track' as const };
      const existing = await Like.exists(filter);
      const nextLiked = typeof req.body?.liked === 'boolean' ? req.body.liked : !existing;
      if (nextLiked) {
        try { await Like.updateOne(filter, { $setOnInsert: filter }, { upsert: true }); }
        catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
      } else {
        await Like.deleteOne(filter);
      }
      const count = await Like.countDocuments({ targetId: trackId, targetType: 'track' });
      await Track.updateOne({ _id: trackId }, { $set: { likesCount: count } });
      return { liked: nextLiked, likesCount: count };
    });
    emitTrackLikeUpdated(trackId, likesCount);
    res.json({ liked, likesCount });
  } catch (err) {
    res.status(500).json({ message: 'Error processing track like' });
  }
});

// ============================================================
// VIDEO / SHORTS ROUTES
// ============================================================
router.get('/videos', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const viewerId = getOptionalUser(req)?.id;
    const ownTotal = await Video.countDocuments();
    const ownCount = Math.max(0, Math.min(limit, ownTotal - skip));
    let ownVideos: any[] = [];
    let personalized = false;
    if (viewerId) {
      const [viewer, follows] = await Promise.all([
        User.findById(viewerId).select('interests').lean(),
        Follow.find({ followerId: viewerId }).distinct('followingId'),
      ]);
      const genres = new Set(viewer?.interests?.genres || []);
      const topics = new Set((viewer?.interests?.topics || []).map((topic: string) => topic.toLowerCase().replace(/^#/, '')));
      personalized = genres.size > 0 || topics.size > 0;
      if (personalized) {
        const candidates = await Video.find().sort({ createdAt: -1 }).limit(500);
        const followingIds = new Set(follows.map(String));
        const scored = candidates.map((video) => {
          const creatorId = String((video.creator as any)?._id || video.creator || '');
          let score = creatorId && followingIds.has(creatorId) ? 5 : 0;
          (video.hashtags || []).forEach((tag: string) => {
            if (topics.has(tag.toLowerCase().replace(/^#/, ''))) score += 3;
          });
          score += Math.log10((video.likesCount || 0) + 1);
          return { video, score };
        }).sort((a, b) => b.score - a.score);
        ownVideos = scored.slice(skip, skip + limit).map(({ video }) => video);
      }
    }
    if (!personalized) {
      ownVideos = ownCount > 0
        ? await Video.find().sort({ createdAt: -1 }).skip(skip).limit(ownCount)
        : [];
    }

    let apiVideos: Awaited<ReturnType<typeof getPexelsVideos>> = [];
    try {
      apiVideos = await getPexelsVideos();
    } catch (providerError) {
      console.warn('[Kinetic] Pexels fetch failed:', providerError instanceof Error ? providerError.message : providerError);
    }

    const remainingSlots = Math.max(0, limit - ownVideos.length);
    const apiOffset = Math.max(0, skip + ownVideos.length - ownTotal);
    const combined = [...ownVideos, ...apiVideos.slice(apiOffset, apiOffset + remainingSlots)];

    res.json({
      videos: await withViewerState(await withCreatorAvatars(combined as any[]), getOptionalUser(req)?.id, 'video'),
      total: ownTotal + apiVideos.length,
      page,
      hasMore: skip + combined.length < ownTotal + apiVideos.length,
      personalized,
      source: ownVideos.length > 0 ? (apiVideos.length > 0 ? 'mixed' : 'database') : (apiVideos.length > 0 ? 'pexels' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching videos' });
  }
});

router.get('/videos/trending', async (req: Request, res: Response) => {
  try {
    // Newest uploads surface first, then live provider videos fill the rest of the list.
    const [ownVideos, apiVideos] = await Promise.all([
      Video.find().sort({ createdAt: -1 }).limit(20),
      getPexelsVideos().catch((providerError) => {
        console.warn('[Kinetic] Pexels fetch failed:', providerError instanceof Error ? providerError.message : providerError);
        return [];
      }),
    ]);

    const remainingSlots = Math.max(0, 20 - ownVideos.length);
    const combined = [...ownVideos, ...apiVideos.slice(0, remainingSlots)];

    res.json({
      videos: await withViewerState(await withCreatorAvatars(combined as any[]), getOptionalUser(req)?.id, 'video'),
      source: ownVideos.length > 0 ? (apiVideos.length > 0 ? 'mixed' : 'database') : (apiVideos.length > 0 ? 'pexels' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trending videos' });
  }
});

router.get('/videos/following', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit || '10'), 10) || 10));
    const skip = (page - 1) * limit;
    const follows = await Follow.find({ followerId: req.user!.id }).select('followingId');
    const followingIds = follows.map((follow) => follow.followingId);
    if (followingIds.length === 0) {
      res.json({ videos: [], total: 0, page, hasMore: false, followingCount: 0 });
      return;
    }

    const filter = { creator: { $in: followingIds } };
    const [videos, total] = await Promise.all([
      Video.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Video.countDocuments(filter),
    ]);
    res.json({ videos: await withViewerState(await withCreatorAvatars(videos as any[]), req.user!.id, 'video'), total, page, hasMore: skip + videos.length < total, followingCount: followingIds.length });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching followed creators videos' });
  }
});

router.get('/videos/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const videos = await Video.find({ creator: req.user!.id }).sort({ createdAt: -1 });
    res.json({ videos: await withViewerState(await withCreatorAvatars(videos as any[]), req.user!.id, 'video') });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your videos' });
  }
});

router.get('/videos/:id', async (req: Request, res: Response) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json({ video: (await withViewerState(await withCreatorAvatars([video as any]), getOptionalUser(req)?.id, 'video'))[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching video' });
  }
});

// Count a view when a video becomes active in the Shorts feed.
router.post('/videos/:id/view', socialLimiter, async (req: Request, res: Response) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewsCount: 1 } },
      { returnDocument: 'after', projection: { viewsCount: 1 } }
    );
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json({ viewsCount: video.viewsCount });
  } catch (err) {
    res.status(500).json({ message: 'Error recording video view' });
  }
});

// Like / Unlike a video
router.post('/videos/:id/like', requireAuth, socialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const videoId = req.params.id;
    const userId = req.user!.id;
    if (!mongoose.isValidObjectId(videoId)) {
      res.status(400).json({ message: 'Likes are only available on Kinetic videos' });
      return;
    }
    const video = await Video.findById(videoId).select('_id');
    if (!video) { res.status(404).json({ message: 'Video not found' }); return; }
    const { liked, likesCount } = await serializeLikeWrite(`video:${videoId}`, async () => {
      const filter = { userId, targetId: videoId, targetType: 'video' as const };
      const existing = await Like.exists(filter);
      const nextLiked = typeof req.body?.liked === 'boolean' ? req.body.liked : !existing;
      if (nextLiked) {
        try { await Like.updateOne(filter, { $setOnInsert: filter }, { upsert: true }); }
        catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
      } else {
        await Like.deleteOne(filter);
      }
      const count = await Like.countDocuments({ targetId: videoId, targetType: 'video' });
      await Video.updateOne({ _id: videoId }, { $set: { likesCount: count } });
      return { liked: nextLiked, likesCount: count };
    });
    emitVideoLikeUpdated(videoId, likesCount, userId);
    res.json({ liked, likesCount });
  } catch (err) {
    res.status(500).json({ message: 'Error processing like' });
  }
});

// Save / unsave a video for the current user.
router.post('/videos/:id/save', requireAuth, socialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const videoId = req.params.id;
    const userId = req.user!.id;
    const existing = await SavedVideo.findOne({ userId, videoId });

    if (existing) {
      await existing.deleteOne();
      res.json({ saved: false });
      return;
    }

    await SavedVideo.create({ userId, videoId });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ message: 'Error saving video' });
  }
});

// Count a share after the user copies or sends the link.
router.post('/videos/:id/share', socialLimiter, async (req: Request, res: Response) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { sharesCount: 1 } },
      { returnDocument: 'after', projection: { sharesCount: 1 } }
    );
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json({ sharesCount: video.sharesCount });
  } catch (err) {
    res.status(500).json({ message: 'Error recording video share' });
  }
});

// Comments on a video
router.get('/videos/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await Comment.find({ videoId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ comments: await withCommentAvatars(comments as any[]) });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching comments' });
  }
});

router.post('/videos/:id/comments', requireAuth, socialLimiter, validateBody(commentCreateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ message: 'Comment text is required' });
      return;
    }

    const comment = await Comment.create({
      videoId: req.params.id,
      userId: req.user!.id,
      userName: req.user!.username,
      userHandle: `@${req.user!.username}`,
      userAvatar: '',
      text: text.trim(),
    });

    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: 1 } }, { returnDocument: 'after' }).select('commentsCount');
    const commentsCount = video?.commentsCount || 0;
    const [commentWithAvatar] = await withCommentAvatars([comment as any]);
    emitCommentAdded(req.params.id, commentWithAvatar, commentsCount);
    res.status(201).json({ comment: commentWithAvatar, commentsCount });
  } catch (err) {
    res.status(500).json({ message: 'Error posting comment' });
  }
});

// Delete own comment
router.delete('/comments/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }
    if (String(comment.userId) !== req.user!.id) {
      res.status(403).json({ message: 'Not authorized to delete this comment' });
      return;
    }
    await comment.deleteOne();
    await Video.findByIdAndUpdate(comment.videoId, { $inc: { commentsCount: -1 } });
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

// ============================================================
// SOCIAL: FOLLOW / UNFOLLOW
// ============================================================
router.post('/users/:userId/follow', requireAuth, socialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const followerId = req.user!.id;
    const followingId = req.params.userId;

    if (followerId === followingId) {
      res.status(400).json({ message: 'You cannot follow yourself' });
      return;
    }

    const targetUser = await User.findById(followingId);
    if (!targetUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const existing = await Follow.findOne({ followerId, followingId });
    if (existing) {
      // Unfollow
      await Follow.deleteOne({ _id: existing._id });
      await User.findByIdAndUpdate(followingId, { $inc: { followersCount: -1 } });
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: -1 } });
      res.json({ following: false });
    } else {
      // Follow
      await Follow.create({ followerId, followingId });
      await User.findByIdAndUpdate(followingId, { $inc: { followersCount: 1 } });
      await User.findByIdAndUpdate(followerId, { $inc: { followingCount: 1 } });
      res.json({ following: true });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error processing follow' });
  }
});

// ============================================================
// PLAYLISTS
// ============================================================
router.get('/playlists', async (_req: Request, res: Response) => {
  try {
    const playlists = await Playlist.find().populate('tracks').limit(30);
    res.json({ playlists: await withCreatorAvatars(playlists as any[]) });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching playlists' });
  }
});

router.get('/playlists/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await Playlist.find({ owner: req.user!.id }).populate('tracks');
    res.json({ playlists: await withCreatorAvatars(playlists as any[]) });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user playlists' });
  }
});

router.post('/playlists', requireAuth, validateBody(playlistCreateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, coverUrl } = req.body;
    const playlist = await Playlist.create({
      title,
      description,
      coverUrl: coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
      owner: req.user!.id,
    });
    res.status(201).json({ playlist: (await withCreatorAvatars([playlist as any]))[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

router.post('/playlists/:id/tracks', requireAuth, validateBody(playlistTrackSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { trackId } = req.body;
    if (!trackId) {
      res.status(400).json({ message: 'trackId is required' });
      return;
    }
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, owner: req.user!.id },
      { $addToSet: { tracks: trackId } },
      { returnDocument: 'after' }
    ).populate('tracks');
    if (!playlist) {
      res.status(404).json({ message: 'Playlist not found or unauthorized' });
      return;
    }
    res.json({ playlist: (await withCreatorAvatars([playlist as any]))[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error adding track to playlist' });
  }
});

router.delete('/playlists/:id/tracks/:trackId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, owner: req.user!.id },
      { $pull: { tracks: req.params.trackId } },
      { returnDocument: 'after' }
    ).populate('tracks');
    if (!playlist) {
      res.status(404).json({ message: 'Playlist not found or unauthorized' });
      return;
    }
    res.json({ playlist: (await withCreatorAvatars([playlist as any]))[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error removing track from playlist' });
  }
});

router.delete('/playlists/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, owner: req.user!.id });
    if (!playlist) {
      res.status(404).json({ message: 'Playlist not found or unauthorized' });
      return;
    }
    res.json({ message: 'Playlist deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting playlist' });
  }
});

// ============================================================
// CONTENT REPORTING
// ============================================================
router.post('/report', requireAuth, socialLimiter, validateBody(reportSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { targetType, targetId, reason, details } = req.body;

    // Prevent duplicate reports from same user
    const existingReport = await Report.findOne({ targetType, targetId, reporterId: req.user!.id });
    if (existingReport) {
      res.status(409).json({ message: 'You have already reported this content' });
      return;
    }

    await Report.create({ targetType, targetId, reporterId: req.user!.id, reason, details });

    // Increment reportCount on the target
    if (targetType === 'video') {
      await Video.findByIdAndUpdate(targetId, { $inc: { reportCount: 1 }, $addToSet: { reportReasons: reason } });
    } else if (targetType === 'track') {
      await Track.findByIdAndUpdate(targetId, { $inc: { reportCount: 1 } });
    }

    res.status(201).json({ message: 'Content reported. Our team will review it shortly.' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting report' });
  }
});

// ============================================================
// ADMIN ROUTES (role: admin)
// ============================================================
const requireAdmin = (req: AuthRequest, res: Response, next: () => void) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};

// Get all pending reports
router.get('/admin/reports', requireAuth, requireAdmin as unknown as (req: AuthRequest, res: Response) => void, async (_req: Request, res: Response) => {
  try {
    const reports = await Report.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(100);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reports' });
  }
});

// Admin: take action on a report (dismiss or remove content)
router.patch('/admin/reports/:reportId', requireAuth, requireAdmin as unknown as (req: AuthRequest, res: Response) => void, validateBody(reportActionSchema), async (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    const report = await Report.findById(req.params.reportId);
    if (!report) {
      res.status(404).json({ message: 'Report not found' });
      return;
    }

    if (action === 'remove') {
      report.status = 'removed';
      // Soft-remove the content
      if (report.targetType === 'video') {
        await Video.findByIdAndUpdate(report.targetId, { isReported: true });
      } else if (report.targetType === 'track') {
        await Track.findByIdAndUpdate(report.targetId, { isReported: true });
      } else if (report.targetType === 'comment') {
        await Comment.findByIdAndDelete(report.targetId);
      }
      // Mark all reports on this target as removed
      await Report.updateMany({ targetType: report.targetType, targetId: report.targetId }, { status: 'removed' });
    } else {
      report.status = 'dismissed';
    }

    await report.save();
    res.json({ message: `Report ${action === 'remove' ? 'actioned and content removed' : 'dismissed'}`, report });
  } catch (err) {
    res.status(500).json({ message: 'Error processing report action' });
  }
});

export default router;
