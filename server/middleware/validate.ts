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

export const cloudinaryUrlSchema = z.string().trim().max(1000).refine((val) => {
  if (!val) return false;
  const cn = process.env.CLOUDINARY_CLOUD_NAME;
  if (cn) {
    return val.startsWith(`https://res.cloudinary.com/${cn}/`);
  }
  // No cloud name configured: only tolerated in tests, never in a real deployment.
  return process.env.NODE_ENV === 'test' && /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\//.test(val);
}, { message: 'Must be a valid Cloudinary URL' });

export const optionalCloudinaryUrlSchema = z.string().trim().max(1000).refine((val) => {
  if (!val) return true;
  const cn = process.env.CLOUDINARY_CLOUD_NAME;
  if (cn) {
    return val.startsWith(`https://res.cloudinary.com/${cn}/`);
  }
  return process.env.NODE_ENV === 'test' && /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\//.test(val);
}, { message: 'Must be a valid Cloudinary URL' });

export const profileUpdateSchema = z.object({
  bio: z.string().max(300, 'Bio must not exceed 300 characters').optional(),
  name: z.string().trim().min(1, 'Name cannot be empty').max(50, 'Name must be at most 50 characters').optional(),
  avatarUrl: optionalCloudinaryUrlSchema.optional(),
  coverUrl: optionalCloudinaryUrlSchema.optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  onboardingIntent: z.enum(['explore', 'create', 'both']).optional(),
  onboardingCompleted: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field (bio, name, or avatarUrl) must be provided',
});

export const onboardingSchema = z.object({
  genres: z.array(z.string().trim().min(1).max(30).regex(/^[a-z0-9][a-z0-9 -]*$/)).max(8),
  topics: z.array(z.string().trim().min(1).max(30).regex(/^[a-z0-9][a-z0-9 -]*$/)).max(8),
  role: z.enum(['listener', 'creator']),
  name: z.string().trim().max(50).optional(),
  bio: z.string().max(150).optional(),
  avatarUrl: optionalCloudinaryUrlSchema.optional(),
  completed: z.literal(true),
});

export const trackUploadSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title must not exceed 100 characters'),
  artist: z.string().trim().min(1, 'Artist is required').max(100, 'Artist must not exceed 100 characters'),
  album: z.string().trim().max(100, 'Album must not exceed 100 characters').optional().default('Single'),
  coverUrl: optionalCloudinaryUrlSchema.optional(),
  audioUrl: cloudinaryUrlSchema,
  cloudinaryPublicId: z.string().trim().min(1, 'cloudinaryPublicId is required').max(250),
  duration: z.coerce.number().positive('Duration must be greater than 0'),
  genre: z.string().trim().max(50, 'Genre must not exceed 50 characters').optional().default('Electronic'),
  bpm: z.coerce.number().positive('BPM must be positive').optional().default(120),
});

export const videoUploadSchema = z.object({
  caption: z.string().trim().min(1, 'Caption is required').max(500, 'Caption must not exceed 500 characters'),
  videoUrl: cloudinaryUrlSchema,
  thumbnailUrl: optionalCloudinaryUrlSchema.optional(),
  cloudinaryPublicId: z.string().trim().min(1, 'cloudinaryPublicId is required').max(250),
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
