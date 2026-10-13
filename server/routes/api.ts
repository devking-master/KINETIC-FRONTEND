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
} from '../middleware/validate';
import { authLimiter, socialLimiter } from '../middleware/rateLimiters';
import { Track } from '../models/Track';
import { Video } from '../models/Video';
import { Playlist } from '../models/Playlist';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Comment, Like, Follow } from '../models/Social';
import { SavedVideo } from '../models/SavedVideo';
import { User } from '../models/User';
import { getJamendoTracks, getPexelsVideos } from '../services/externalMedia';
import { emitCommentAdded, emitVideoLikeUpdated, emitTrackLikeUpdated } from '../services/socketService';

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

// ============================================================
// AUTH ROUTES
// ============================================================
router.post('/auth/signup', authLimiter, validateBody(signupSchema), signup);
router.post('/auth/login', authLimiter, validateBody(loginSchema), login);
router.get('/auth/me', requireAuth, getCurrentUser);

// Refresh access token using a long-lived refresh token (stored in httpOnly cookie)
router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ message: 'No refresh token provided' });
      return;
    }
    const jwtSecret = process.env.JWT_SECRET || 'kinetic-super-secret-key-2026';
    let payload: { id: string; tokenVersion: number };
    try {
      payload = jwt.verify(refreshToken, jwtSecret) as { id: string; tokenVersion: number };
    } catch {
      res.clearCookie('refreshToken');
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const user = await User.findById(payload.id).select('tokenVersion role username email');
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      res.clearCookie('refreshToken');
      res.status(401).json({ message: 'Session invalidated. Please log in again.' });
      return;
    }

    const newAccessToken = jwt.sign(
      { id: user._id, email: user.email, username: user.username, role: user.role },
      jwtSecret,
      { expiresIn: '1h' }
    );
    res.json({ token: newAccessToken });
  } catch (err) {
    res.status(500).json({ message: 'Error refreshing token', error: err instanceof Error ? err.message : err });
  }
});

// Logout: increment tokenVersion so all existing refresh tokens become invalid
router.post('/auth/logout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await User.findByIdAndUpdate(req.user!.id, { $inc: { tokenVersion: 1 } });
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error logging out', error: err instanceof Error ? err.message : err });
  }
});

// Update user profile
router.patch('/auth/profile', requireAuth, validateBody(profileUpdateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { bio, name, avatarUrl, coverUrl } = req.body;
    const update: Record<string, unknown> = {};
    if (bio !== undefined) update.bio = bio;
    if (name) update.name = name;
    if (avatarUrl) update.avatarUrl = avatarUrl;
    if (coverUrl) update.coverUrl = coverUrl;

    const user = await User.findByIdAndUpdate(req.user!.id, update, { new: true }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile', error: err instanceof Error ? err.message : err });
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
        const viewer = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'kinetic-super-secret-key-2026') as { id: string };
        isFollowing = !!(await Follow.exists({ followerId: viewer.id, followingId: user._id }));
      } catch {
        isFollowing = false;
      }
    }
    res.json({
      user,
      tracks,
      videos,
      playlists,
      totalUploads: tracks.length + videos.length,
      totalLikesReceived: likes.length,
      isFollowing,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err instanceof Error ? err.message : err });
  }
});

// ============================================================
// UPLOAD ROUTES (Cloudinary Signed Upload Flow)
// ============================================================
router.get('/upload/signature', requireAuth, getUploadSignature);
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
      tracks: combined,
      total: ownTotal + apiTracks.length,
      page,
      hasMore: skip + ownTracks.length < ownTotal,
      source: ownTracks.length > 0 ? (apiTracks.length > 0 ? 'mixed' : 'database') : (apiTracks.length > 0 ? 'jamendo' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching music', error: err instanceof Error ? err.message : err });
  }
});

router.get('/music/trending', async (_req: Request, res: Response) => {
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
      tracks: combined,
      source: ownTracks.length > 0 ? (apiTracks.length > 0 ? 'mixed' : 'database') : (apiTracks.length > 0 ? 'jamendo' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trending music', error: err instanceof Error ? err.message : err });
  }
});

router.get('/music/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tracks = await Track.find({ uploadedBy: req.user!.id }).sort({ createdAt: -1 });
    res.json({ tracks });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your tracks', error: err instanceof Error ? err.message : err });
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
    const jwtSecret = process.env.JWT_SECRET || 'kinetic-super-secret-key-2026';
    return jwt.verify(token, jwtSecret) as { id: string; email: string; username: string };
  } catch {
    return null;
  }
};

router.get('/discover/recommended', async (req: Request, res: Response) => {
  try {
    const user = getOptionalUser(req);

    const preferredGenres = new Set<string>();
    const preferredHashtags = new Set<string>();
    let followingIds = new Set<string>();

    if (user?.id) {
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
      tracks: recommendedTracks,
      videos: recommendedVideos,
      personalized: user !== null && (preferredGenres.size > 0 || followingIds.size > 0 || preferredHashtags.size > 0),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error generating recommendations', error: err instanceof Error ? err.message : err });
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

    res.json({ tracks: blendedTracks, videos: blendedVideos });
  } catch (err) {
    res.status(500).json({ message: 'Error searching media', error: err instanceof Error ? err.message : err });
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
    res.json({ track });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching track', error: err instanceof Error ? err.message : err });
  }
});

router.post('/music/:id/like', requireAuth, socialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const trackId = req.params.id;
    const userId = req.user!.id;

    const existing = await Like.findOne({ userId, targetId: trackId, targetType: 'track' });
    let newLikes = 0;
    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      const updated = await Track.findByIdAndUpdate(trackId, { $inc: { likesCount: -1 } }, { new: true }).select('likesCount');
      newLikes = updated?.likesCount || 0;
      emitTrackLikeUpdated(trackId, newLikes);
      res.json({ liked: false, likesCount: newLikes });
    } else {
      await Like.create({ userId, targetId: trackId, targetType: 'track' });
      const updated = await Track.findByIdAndUpdate(trackId, { $inc: { likesCount: 1 } }, { new: true }).select('likesCount');
      newLikes = updated?.likesCount || 0;
      emitTrackLikeUpdated(trackId, newLikes);
      res.json({ liked: true, likesCount: newLikes });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error processing track like', error: err instanceof Error ? err.message : err });
  }
});

// ============================================================
// VIDEO / SHORTS ROUTES
// ============================================================
router.get('/videos', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1')));
    const limit = Math.min(50, parseInt(String(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    // Your own uploads always come first; live provider videos fill out the rest.
    const ownVideos = await Video.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const ownTotal = await Video.countDocuments();

    let apiVideos: Awaited<ReturnType<typeof getPexelsVideos>> = [];
    try {
      apiVideos = await getPexelsVideos();
    } catch (providerError) {
      console.warn('[Kinetic] Pexels fetch failed:', providerError instanceof Error ? providerError.message : providerError);
    }

    const remainingSlots = Math.max(0, limit - ownVideos.length);
    const combined = [...ownVideos, ...apiVideos.slice(0, remainingSlots)];

    res.json({
      videos: combined,
      total: ownTotal + apiVideos.length,
      page,
      hasMore: skip + ownVideos.length < ownTotal,
      source: ownVideos.length > 0 ? (apiVideos.length > 0 ? 'mixed' : 'database') : (apiVideos.length > 0 ? 'pexels' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching videos', error: err instanceof Error ? err.message : err });
  }
});

router.get('/videos/trending', async (_req: Request, res: Response) => {
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
      videos: combined,
      source: ownVideos.length > 0 ? (apiVideos.length > 0 ? 'mixed' : 'database') : (apiVideos.length > 0 ? 'pexels' : 'database-seed'),
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trending videos', error: err instanceof Error ? err.message : err });
  }
});

router.get('/videos/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const videos = await Video.find({ creator: req.user!.id }).sort({ createdAt: -1 });
    res.json({ videos });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your videos', error: err instanceof Error ? err.message : err });
  }
});

router.get('/videos/:id', async (req: Request, res: Response) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json({ video });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching video', error: err instanceof Error ? err.message : err });
  }
});

// Count a view when a video becomes active in the Shorts feed.
router.post('/videos/:id/view', socialLimiter, async (req: Request, res: Response) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewsCount: 1 } },
      { new: true, projection: { viewsCount: 1 } }
    );
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json({ viewsCount: video.viewsCount });
  } catch (err) {
    res.status(500).json({ message: 'Error recording video view', error: err instanceof Error ? err.message : err });
  }
});

// Like / Unlike a video
router.post('/videos/:id/like', requireAuth, socialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const videoId = req.params.id;
    const userId = req.user!.id;

    const existing = await Like.findOne({ userId, targetId: videoId, targetType: 'video' });
    let newCount = 0;
    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      await Video.findByIdAndUpdate(videoId, { $inc: { likesCount: -1 } });
      const video = await Video.findById(videoId).select('likesCount');
      newCount = video?.likesCount || 0;
      emitVideoLikeUpdated(videoId, newCount);
      res.json({ liked: false, likesCount: newCount });
    } else {
      await Like.create({ userId, targetId: videoId, targetType: 'video' });
      await Video.findByIdAndUpdate(videoId, { $inc: { likesCount: 1 } });
      const video = await Video.findById(videoId).select('likesCount');
      newCount = video?.likesCount || 0;
      emitVideoLikeUpdated(videoId, newCount);
      res.json({ liked: true, likesCount: newCount });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error processing like', error: err instanceof Error ? err.message : err });
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
    res.status(500).json({ message: 'Error saving video', error: err instanceof Error ? err.message : err });
  }
});

// Count a share after the user copies or sends the link.
router.post('/videos/:id/share', socialLimiter, async (req: Request, res: Response) => {
  try {
    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { $inc: { sharesCount: 1 } },
      { new: true, projection: { sharesCount: 1 } }
    );
    if (!video) {
      res.status(404).json({ message: 'Video not found' });
      return;
    }
    res.json({ sharesCount: video.sharesCount });
  } catch (err) {
    res.status(500).json({ message: 'Error recording video share', error: err instanceof Error ? err.message : err });
  }
});

// Comments on a video
router.get('/videos/:id/comments', async (req: Request, res: Response) => {
  try {
    const comments = await Comment.find({ videoId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching comments', error: err instanceof Error ? err.message : err });
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
      userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.user!.username)}`,
      text: text.trim(),
    });

    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: 1 } }, { new: true }).select('commentsCount');
    const commentsCount = video?.commentsCount || 0;
    emitCommentAdded(req.params.id, comment, commentsCount);
    res.status(201).json({ comment, commentsCount });
  } catch (err) {
    res.status(500).json({ message: 'Error posting comment', error: err instanceof Error ? err.message : err });
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
    res.status(500).json({ message: 'Error deleting comment', error: err instanceof Error ? err.message : err });
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
    res.status(500).json({ message: 'Error processing follow', error: err instanceof Error ? err.message : err });
  }
});

// ============================================================
// PLAYLISTS
// ============================================================
router.get('/playlists', async (_req: Request, res: Response) => {
  try {
    const playlists = await Playlist.find().populate('tracks').limit(30);
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching playlists', error: err instanceof Error ? err.message : err });
  }
});

router.get('/playlists/my', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await Playlist.find({ owner: req.user!.id }).populate('tracks');
    res.json({ playlists });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user playlists', error: err instanceof Error ? err.message : err });
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
    res.status(201).json({ playlist });
  } catch (err) {
    res.status(500).json({ message: 'Error creating playlist', error: err instanceof Error ? err.message : err });
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
      { new: true }
    ).populate('tracks');
    if (!playlist) {
      res.status(404).json({ message: 'Playlist not found or unauthorized' });
      return;
    }
    res.json({ playlist });
  } catch (err) {
    res.status(500).json({ message: 'Error adding track to playlist', error: err instanceof Error ? err.message : err });
  }
});

router.delete('/playlists/:id/tracks/:trackId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, owner: req.user!.id },
      { $pull: { tracks: req.params.trackId } },
      { new: true }
    ).populate('tracks');
    if (!playlist) {
      res.status(404).json({ message: 'Playlist not found or unauthorized' });
      return;
    }
    res.json({ playlist });
  } catch (err) {
    res.status(500).json({ message: 'Error removing track from playlist', error: err instanceof Error ? err.message : err });
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
    res.status(500).json({ message: 'Error deleting playlist', error: err instanceof Error ? err.message : err });
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
    res.status(500).json({ message: 'Error submitting report', error: err instanceof Error ? err.message : err });
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
    res.status(500).json({ message: 'Error fetching reports', error: err instanceof Error ? err.message : err });
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
    res.status(500).json({ message: 'Error processing report action', error: err instanceof Error ? err.message : err });
  }
});

export default router;
