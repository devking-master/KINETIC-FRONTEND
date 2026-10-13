import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((e) => {
          const field = e.path.join('.');
          return field ? `${field}: ${e.message}` : e.message;
        });
        res.status(400).json({
          message: errorMessages.join('; ') || 'Invalid request payload',
          errors: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
        return;
      }
      res.status(400).json({ message: 'Invalid request data' });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((e) => {
          const field = e.path.join('.');
          return field ? `${field}: ${e.message}` : e.message;
        });
        res.status(400).json({
          message: errorMessages.join('; ') || 'Invalid request parameters',
          errors: error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      res.status(400).json({ message: 'Invalid request parameters' });
    }
  };
};

// ==========================================
// SCHEMAS FOR POST / PATCH ROUTES
// ==========================================

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be at most 50 characters'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  email: z.string().trim().email('Invalid email address').max(100, 'Email must be at most 100 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password must be at most 100 characters'),
  role: z.enum(['listener', 'creator']).optional().default('creator'),
});

export const loginSchema = z.object({
  loginIdentifier: z.string().trim().min(1, 'Email or username is required').max(100, 'Identifier too long'),
  password: z.string().min(1, 'Password is required').max(100, 'Password too long'),
});

export const profileUpdateSchema = z.object({
  bio: z.string().max(300, 'Bio must not exceed 300 characters').optional(),
  name: z.string().trim().min(1, 'Name cannot be empty').max(50, 'Name must be at most 50 characters').optional(),
  avatarUrl: z.string().url('Avatar URL must be a valid URL').max(500, 'Avatar URL too long').optional().or(z.literal('')),
  coverUrl: z.string().url('Cover URL must be a valid URL').max(1000, 'Cover URL too long').optional().or(z.literal('')),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field (bio, name, or avatarUrl) must be provided',
});

export const trackUploadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title must not exceed 100 characters'),
  artist: z.string().trim().min(1, 'Artist is required').max(100, 'Artist must not exceed 100 characters'),
  album: z.string().trim().max(100, 'Album must not exceed 100 characters').optional().default('Single'),
  coverUrl: z.string().trim().max(1000).optional(),
  audioUrl: z.string().trim().min(1, 'Audio URL is required').max(1000),
  cloudinaryPublicId: z.string().trim().max(250).optional(),
  duration: z.coerce.number().positive('Duration must be greater than 0'),
  genre: z.string().trim().max(50, 'Genre must not exceed 50 characters').optional().default('Electronic'),
  bpm: z.coerce.number().positive('BPM must be positive').optional().default(120),
});

export const videoUploadSchema = z.object({
  caption: z.string().trim().min(1, 'Caption is required').max(500, 'Caption must not exceed 500 characters'),
  videoUrl: z.string().trim().min(1, 'Video URL is required').max(1000),
  thumbnailUrl: z.string().trim().max(1000).optional(),
  cloudinaryPublicId: z.string().trim().max(250).optional(),
  duration: z.coerce
    .number()
    .positive('Video duration must be greater than 0')
    .max(90, 'Videos must be 90 seconds or shorter'),
  soundId: z.string().trim().optional(),
  audioTrackTitle: z.string().trim().max(100, 'Audio title must not exceed 100 characters').optional(),
  audioArtist: z.string().trim().max(100, 'Audio artist must not exceed 100 characters').optional(),
  hashtags: z.union([z.array(z.string().max(50)), z.string().max(300)]).optional(),
});

export const commentCreateSchema = z.object({
  text: z.string().trim().min(1, 'Comment text is required').max(500, 'Comment must not exceed 500 characters'),
});

export const playlistCreateSchema = z.object({
  title: z.string().trim().min(1, 'Playlist title is required').max(100, 'Title must not exceed 100 characters'),
  description: z.string().trim().max(500, 'Description must not exceed 500 characters').optional().default(''),
  coverUrl: z.string().trim().max(1000).optional(),
});

export const playlistTrackSchema = z.object({
  trackId: z.string().trim().min(1, 'Track ID is required').max(100),
});
