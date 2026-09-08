import { Response } from 'express';
import cloudinary, { apiKey, apiSecret, cloudName } from '../config/cloudinary';
import { AuthRequest } from '../middleware/auth';
import { Track } from '../models/Track';
import { Video } from '../models/Video';

export const getUploadSignature = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = req.query.folder ? String(req.query.folder) : 'kinetic_uploads';
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      apiSecret
    );

    res.status(200).json({
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error generating upload signature', error: err instanceof Error ? err.message : err });
  }
};

export const createUploadedTrack = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, artist, album, coverUrl, audioUrl, duration, genre, bpm, cloudinaryPublicId } = req.body;

    if (!title || !artist || !audioUrl || !duration) {
      res.status(400).json({ message: 'Title, artist, audio URL, and duration are required.' });
      return;
    }

    const track = await Track.create({
      title,
      artist,
      album: album || 'Single',
      coverUrl: coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
      audioUrl,
      cloudinaryPublicId,
      duration: Math.round(Number(duration)),
      genre: genre || 'Electronic',
      bpm: bpm || 124,
      uploadedBy: req.user ? req.user.id : undefined,
      source: 'user',
    });

    res.status(201).json({ message: 'Track published successfully', track });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create track metadata', error: err instanceof Error ? err.message : err });
  }
};

export const createUploadedVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { caption, videoUrl, thumbnailUrl, duration, soundId, audioTrackTitle, audioArtist, hashtags, cloudinaryPublicId } = req.body;

    const parsedDuration = Number(duration);

    // STRICT BACKEND VALIDATION: MAX 90 SECONDS
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      res.status(400).json({ message: 'Invalid video duration provided.' });
      return;
    }

    if (parsedDuration > 90) {
      const minutes = Math.floor(parsedDuration / 60);
      const secs = Math.floor(parsedDuration % 60).toString().padStart(2, '0');
      res.status(400).json({
        message: `Your video is ${minutes}:${secs} (${Math.round(parsedDuration)}s). Videos must be 90 seconds or shorter.`
      });
      return;
    }

    if (!caption || !videoUrl) {
      res.status(400).json({ message: 'Caption and video URL are required.' });
      return;
    }

    const creatorName = req.user ? req.user.username : 'kinetic_creator';
    const creatorHandle = `@${creatorName.toLowerCase()}`;
    const creatorAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(creatorName)}`;

    const video = await Video.create({
      caption,
      videoUrl,
      thumbnailUrl: thumbnailUrl || 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&auto=format&fit=crop&q=80',
      cloudinaryPublicId,
      duration: parsedDuration,
      creator: req.user ? req.user.id : undefined,
      creatorName,
      creatorHandle,
      creatorAvatar,
      soundId,
      audioTrackTitle: audioTrackTitle || 'Original Sound',
      audioArtist: audioArtist || creatorName,
      hashtags: Array.isArray(hashtags) ? hashtags : (hashtags || '').split(' ').filter(Boolean),
      source: 'user',
    });

    res.status(201).json({ message: 'Video published successfully', video });
  } catch (err) {
    res.status(500).json({ message: 'Failed to publish video', error: err instanceof Error ? err.message : err });
  }
};
