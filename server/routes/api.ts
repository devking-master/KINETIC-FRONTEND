import { Router, Request, Response } from 'express';
import { signup, login, getCurrentUser } from '../controllers/authController';
import { getUploadSignature, createUploadedTrack, createUploadedVideo } from '../controllers/uploadController';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Track } from '../models/Track';
import { Video } from '../models/Video';
import { Playlist } from '../models/Playlist';
import { Comment, Like, Follow } from '../models/Social';
import { SavedVideo } from '../models/SavedVideo';
import { User } from '../models/User';
import { getJamendoTracks, getPexelsVideos } from '../services/externalMedia';

const router = Router();

// ============================================================
// AUTH ROUTES
// ============================================================
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getCurrentUser);

// Update user profile
router.patch('/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { bio, name, avatarUrl } = req.body;
    const update: Record<string, unknown> = {};
    if (bio !== undefined) update.bio = bio;
    if (name) update.name = name;
    if (avatarUrl) update.avatarUrl = avatarUrl;

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
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err instanceof Error ? err.message : err });
  }
});

// ============================================================
// UPLOAD ROUTES (Cloudinary Signed Upload Flow)
// ============================================================
router.get('/upload/signature', requireAuth, getUploadSignature);
router.post('/upload/track', requireAuth, createUploadedTrack);
router.post('/upload/video', requireAuth, createUploadedVideo);

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
    const ownTracks = await Track.find().sort({ createdAt: -1 }).limit(20);

    let apiTracks: Awaited<ReturnType<typeof getJamendoTracks>> = [];
    try {
      apiTracks = await getJamendoTracks();
    } catch (providerError) {
      console.warn('[Kinetic] Jamendo fetch failed:', providerError instanceof Error ? providerError.message : providerError);
    }

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

router.get('/music/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json({ tracks: [], videos: [] });
      return;
    }
    const regex = new RegExp(q, 'i');
    const [uploadedTracks, uploadedVideos, apiTracks] = await Promise.all([
      Track.find({
        $or: [{ title: regex }, { artist: regex }, { album: regex }, { genre: regex }],
      }).limit(20),
      Video.find({
        $or: [{ caption: regex }, { creatorName: regex }, { audioTrackTitle: regex }],
      }).limit(10),
      getJamendoTracks(q),
    ]);
    res.json({ tracks: uploadedTracks.length > 0 ? uploadedTracks : apiTracks, videos: uploadedVideos });
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

router.post('/music/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const trackId = req.params.id;
    const userId = req.user!.id;

    const existing = await Like.findOne({ userId, targetId: trackId, targetType: 'track' });
    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      await Track.findByIdAndUpdate(trackId, { $inc: { likesCount: -1 } });
      res.json({ liked: false });
    } else {
      await Like.create({ userId, targetId: trackId, targetType: 'track' });
      await Track.findByIdAndUpdate(trackId, { $inc: { likesCount: 1 } });
      res.json({ liked: true });
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
    const ownVideos = await Video.find().sort({ createdAt: -1 }).limit(20);

    let apiVideos: Awaited<ReturnType<typeof getPexelsVideos>> = [];
    try {
      apiVideos = await getPexelsVideos();
    } catch (providerError) {
      console.warn('[Kinetic] Pexels fetch failed:', providerError instanceof Error ? providerError.message : providerError);
    }

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
router.post('/videos/:id/view', async (req: Request, res: Response) => {
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
router.post('/videos/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const videoId = req.params.id;
    const userId = req.user!.id;

    const existing = await Like.findOne({ userId, targetId: videoId, targetType: 'video' });
    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      await Video.findByIdAndUpdate(videoId, { $inc: { likesCount: -1 } });
      const video = await Video.findById(videoId).select('likesCount');
      res.json({ liked: false, likesCount: video?.likesCount || 0 });
    } else {
      await Like.create({ userId, targetId: videoId, targetType: 'video' });
      await Video.findByIdAndUpdate(videoId, { $inc: { likesCount: 1 } });
      const video = await Video.findById(videoId).select('likesCount');
      res.json({ liked: true, likesCount: video?.likesCount || 0 });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error processing like', error: err instanceof Error ? err.message : err });
  }
});

// Save / unsave a video for the current user.
router.post('/videos/:id/save', requireAuth, async (req: AuthRequest, res: Response) => {
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
router.post('/videos/:id/share', async (req: Request, res: Response) => {
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

router.post('/videos/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
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
    res.status(201).json({ comment, commentsCount: video?.commentsCount || 0 });
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
router.post('/users/:userId/follow', requireAuth, async (req: AuthRequest, res: Response) => {
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

router.post('/playlists', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, coverUrl } = req.body;
    if (!title) {
      res.status(400).json({ message: 'Playlist title is required' });
      return;
    }
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

router.post('/playlists/:id/tracks', requireAuth, async (req: AuthRequest, res: Response) => {
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

export default router;
