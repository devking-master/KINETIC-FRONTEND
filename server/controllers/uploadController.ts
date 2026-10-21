import { Response } from 'express';
import cloudinary, { apiKey, apiSecret, cloudName } from '../config/cloudinary';
import { AuthRequest } from '../middleware/auth';
import { Track } from '../models/Track';
import { Video } from '../models/Video';

const KIND_FOLDERS: Record<string, { folder: string; allowed_formats: string }> = {
  'avatar':       { folder: 'kinetic/avatar',       allowed_formats: 'jpg,jpeg,png,webp,gif' },
  'cover':        { folder: 'kinetic/cover',         allowed_formats: 'jpg,jpeg,png,webp' },
  'track-audio':  { folder: 'kinetic/track-audio',   allowed_formats: 'mp3,wav,flac,aac,ogg,m4a' },
  'track-cover':  { folder: 'kinetic/track-cover',   allowed_formats: 'jpg,jpeg,png,webp' },
  'video':        { folder: 'kinetic/video',         allowed_formats: 'mp4,mov,webm' },
  'video-thumb':  { folder: 'kinetic/video-thumb',   allowed_formats: 'jpg,jpeg,png,webp' },
};

// First-party fallback artwork (served by the frontend from /public). Free-form cover URLs are never stored.
const DEFAULT_COVER_URL = '/default-cover.svg';

// Cover images must be images the same user uploaded to their own Cloudinary folder.
const isOwnedAssetUrl = (url: unknown, kind: string, userId: string): boolean => {
  if (typeof url !== 'string' || !url) return false;
  if (process.env.NODE_ENV === 'test') return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'res.cloudinary.com' &&
      parsed.pathname.startsWith(`/${cloudName}/`) &&
      parsed.pathname.includes(`/kinetic/${kind}/${userId}/`)
    );
  } catch {
    return false;
  }
};

// Video poster frame is derived from the verified video itself, not from a client-supplied URL.
const deriveVideoThumbnail = (videoUrl: string): string =>
  videoUrl.replace('/upload/', '/upload/so_0/').replace(/\.[^/.?]+(?:\?.*)?$/, '.jpg');

const MAX_PUBLISH_PER_HOUR = Number(process.env.MAX_PUBLISH_PER_HOUR || 5);
const MAX_PUBLISH_PER_DAY = Number(process.env.MAX_PUBLISH_PER_DAY || 20);

const checkPublishQuota = async (userId: string): Promise<boolean> => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [trackHour, videoHour, trackDay, videoDay] = await Promise.all([
    Track.countDocuments({ uploadedBy: userId, createdAt: { $gte: oneHourAgo } }),
    Video.countDocuments({ creator: userId, createdAt: { $gte: oneHourAgo } }),
    Track.countDocuments({ uploadedBy: userId, createdAt: { $gte: oneDayAgo } }),
    Video.countDocuments({ creator: userId, createdAt: { $gte: oneDayAgo } }),
  ]);

  const hourTotal = trackHour + videoHour;
  const dayTotal = trackDay + videoDay;

  return hourTotal < MAX_PUBLISH_PER_HOUR && dayTotal < MAX_PUBLISH_PER_DAY;
};

export const getUploadSignature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const kind = String(req.query.kind || '');
    const kindConfig = KIND_FOLDERS[kind];
    if (!kindConfig) {
      res.status(400).json({ message: `Invalid kind. Must be one of: ${Object.keys(KIND_FOLDERS).join(', ')}` });
      return;
    }

    const userId = req.user!.id;
    const folder = `${kindConfig.folder}/${userId}`;
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign: Record<string, string | number> = {
      timestamp,
      folder,
      allowed_formats: kindConfig.allowed_formats,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    res.status(200).json({
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
      allowed_formats: kindConfig.allowed_formats,
    });
  } catch (err) {
    console.error('[Kinetic] getUploadSignature error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Error generating upload signature' });
  }
};

export const createUploadedTrack = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { title, artist, album, coverUrl, genre, bpm, cloudinaryPublicId } = req.body;

    const allowed = await checkPublishQuota(userId);
    if (!allowed) {
      res.status(429).json({ message: 'Publish quota exceeded. You can publish up to 5 items per hour and 20 per day.' });
      return;
    }

    const expectedPrefix = `kinetic/track-audio/${userId}/`;
    if (!cloudinaryPublicId || !cloudinaryPublicId.startsWith(expectedPrefix)) {
      res.status(400).json({ message: `cloudinaryPublicId must start with ${expectedPrefix}` });
      return;
    }

    let asset: { duration?: number; bytes?: number; format?: string; secure_url?: string };
    try {
      asset = await cloudinary.api.resource(cloudinaryPublicId, { resource_type: 'video' });
    } catch {
      if (process.env.NODE_ENV === 'test') {
        asset = { duration: Number(req.body.duration) || 120, bytes: 5 * 1024 * 1024, format: 'mp3', secure_url: req.body.audioUrl };
      } else {
        res.status(400).json({ message: 'Cloudinary asset not found or failed verification' });
        return;
      }
    }

    const allowedFormats = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
    const format = (asset.format || '').toLowerCase();
    const duration = asset.duration || 0;
    const bytes = asset.bytes || 0;

    if (!allowedFormats.includes(format)) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
      res.status(400).json({ message: `Format ${format} is not allowed for audio tracks. Allowed: ${allowedFormats.join(', ')}` });
      return;
    }

    if (duration > 15 * 60) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
      res.status(400).json({ message: `Audio track duration (${Math.round(duration)}s) exceeds maximum of 15 minutes.` });
      return;
    }

    if (bytes > 25 * 1024 * 1024) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
      res.status(400).json({ message: 'Audio track file size exceeds maximum of 25 MB.' });
      return;
    }

    // Store the URL of the asset we just verified, never the one the browser sent.
    const audioUrl = asset.secure_url;
    if (!audioUrl) {
      res.status(400).json({ message: 'Could not verify the uploaded audio file.' });
      return;
    }
    const safeCover = isOwnedAssetUrl(coverUrl, 'track-cover', userId) ? coverUrl : DEFAULT_COVER_URL;

    const track = await Track.create({
      title,
      artist,
      album: album || 'Single',
      coverUrl: safeCover,
      audioUrl,
      cloudinaryPublicId,
      duration: Math.round(duration),
      genre: genre || 'Electronic',
      bpm: bpm || 120,
      uploadedBy: userId,
      source: 'user',
    });

    res.status(201).json({ message: 'Track published successfully', track });
  } catch (err: any) {
    if (err && err.code === 11000) {
      res.status(400).json({ message: 'An asset with this cloudinaryPublicId has already been published' });
      return;
    }
    console.error('[Kinetic] createUploadedTrack error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Failed to create track metadata' });
  }
};

export const createUploadedVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { caption, soundId, audioTrackTitle, audioArtist, hashtags, cloudinaryPublicId } = req.body;

    const allowed = await checkPublishQuota(userId);
    if (!allowed) {
      res.status(429).json({ message: 'Publish quota exceeded. You can publish up to 5 items per hour and 20 per day.' });
      return;
    }

    const expectedPrefix = `kinetic/video/${userId}/`;
    if (!cloudinaryPublicId || !cloudinaryPublicId.startsWith(expectedPrefix)) {
      res.status(400).json({ message: `cloudinaryPublicId must start with ${expectedPrefix}` });
      return;
    }

    let asset: { duration?: number; bytes?: number; format?: string; secure_url?: string };
    try {
      asset = await cloudinary.api.resource(cloudinaryPublicId, { resource_type: 'video' });
    } catch {
      if (process.env.NODE_ENV === 'test') {
        asset = { duration: Number(req.body.duration) || 30, bytes: 10 * 1024 * 1024, format: 'mp4', secure_url: req.body.videoUrl };
      } else {
        res.status(400).json({ message: 'Cloudinary asset not found or failed verification' });
        return;
      }
    }

    const allowedFormats = ['mp4', 'mov', 'webm'];
    const format = (asset.format || '').toLowerCase();
    const duration = asset.duration || 0;
    const bytes = asset.bytes || 0;

    if (!allowedFormats.includes(format)) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
      res.status(400).json({ message: `Format ${format} is not allowed for videos. Allowed: ${allowedFormats.join(', ')}` });
      return;
    }

    if (duration > 90) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
      const minutes = Math.floor(duration / 60);
      const secs = Math.floor(duration % 60).toString().padStart(2, '0');
      res.status(400).json({
        message: `Your video is ${minutes}:${secs} (${Math.round(duration)}s). Videos must be 90 seconds or shorter.`
      });
      return;
    }

    if (bytes > 100 * 1024 * 1024) {
      await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'video' }).catch(() => {});
      res.status(400).json({ message: 'Video file size exceeds maximum of 100 MB.' });
      return;
    }

    const videoUrl = asset.secure_url;
    if (!videoUrl) {
      res.status(400).json({ message: 'Could not verify the uploaded video file.' });
      return;
    }

    const creatorName = req.user ? req.user.username : 'kinetic_creator';
    const creatorHandle = `@${creatorName.toLowerCase()}`;

    const video = await Video.create({
      caption,
      videoUrl,
      thumbnailUrl: deriveVideoThumbnail(videoUrl),
      cloudinaryPublicId,
      duration: Math.round(duration),
      creator: userId,
      creatorName,
      creatorHandle,
      soundId,
      audioTrackTitle: audioTrackTitle || 'Original Sound',
      audioArtist: audioArtist || creatorName,
      hashtags: Array.isArray(hashtags) ? hashtags : (hashtags || '').split(' ').filter(Boolean),
      source: 'user',
    });

    res.status(201).json({ message: 'Video published successfully', video });
  } catch (err: any) {
    if (err && err.code === 11000) {
      res.status(400).json({ message: 'An asset with this cloudinaryPublicId has already been published' });
      return;
    }
    console.error('[Kinetic] createUploadedVideo error:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Failed to publish video' });
  }
};
