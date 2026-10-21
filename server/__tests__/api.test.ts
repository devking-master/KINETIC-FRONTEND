import './setup';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../index';
import { User } from '../models/User';
import { Track } from '../models/Track';
import { Video } from '../models/Video';
import { Like } from '../models/Social';
import { validateEnv } from '../config/env';

const TEST_SECRET = process.env.JWT_SECRET!;

describe('Kinetic API Test Suite', () => {
  let validToken: string;
  const testUsername = `testuser_${Date.now()}`;
  const testEmail = `${testUsername}@example.com`;
  const testPassword = 'Password123!';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kinetic_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    // Cleanup created test records
    await User.deleteMany({ username: { $regex: /^testuser_/ } });
    await Track.deleteMany({ title: { $regex: /^Test Track/ } });
    await Video.deleteMany({ caption: { $regex: /^Test Video/ } });
    await mongoose.connection.close();
  });

  describe('Health Check', () => {
    it('reports provider availability without exposing key values', async () => {
      const originalJamendoKey = process.env.JAMENDO_CLIENT_ID;
      const originalPexelsKey = process.env.PEXELS_API_KEY;
      process.env.JAMENDO_CLIENT_ID = 'test-jamendo-key';
      process.env.PEXELS_API_KEY = 'test-pexels-key';

      try {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.providers).toEqual({ jamendo: true, pexels: true });
        expect(JSON.stringify(res.body)).not.toContain('test-jamendo-key');
        expect(JSON.stringify(res.body)).not.toContain('test-pexels-key');
      } finally {
        if (originalJamendoKey === undefined) delete process.env.JAMENDO_CLIENT_ID;
        else process.env.JAMENDO_CLIENT_ID = originalJamendoKey;
        if (originalPexelsKey === undefined) delete process.env.PEXELS_API_KEY;
        else process.env.PEXELS_API_KEY = originalPexelsKey;
      }
    });
  });

  // ========================================================
  // 1. SIGNUP & LOGIN SUCCESS & FAILURE CASES
  // ========================================================
  describe('Authentication Routes (/api/auth)', () => {
    it('should successfully register a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test Creator',
          username: testUsername,
          email: testEmail,
          password: testPassword,
          role: 'creator',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('username', testUsername);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      validToken = res.body.token;
    });

    it('should reject signup with missing required fields (Zod validation)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'incomplete@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('errors');
    });

    it('should reject signup with invalid username containing special characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Invalid User',
          username: 'bad@user!name',
          email: 'validemail@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('alphanumeric');
    });

    it('should reject signup with password shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Short Pass',
          username: `short_${Date.now()}`,
          email: `short_${Date.now()}@example.com`,
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least 6 characters');
    });

    it('should reject duplicate signup with 409 conflict', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Duplicate User',
          username: testUsername,
          email: testEmail,
          password: testPassword,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already exists');
    });

    it('should successfully log in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          loginIdentifier: testUsername,
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(testEmail);
    });

    it('should reject login with missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should reject login with wrong password (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          loginIdentifier: testUsername,
          password: 'WrongPassword999',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent user (401)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          loginIdentifier: 'nonexistent_user_99999',
          password: 'SomePassword123',
        });

      expect(res.status).toBe(401);
    });
  });

  // ========================================================
  // 2. JWT AUTH MIDDLEWARE REJECTION PATHS
  // ========================================================
  describe('JWT Auth Middleware Rejections', () => {
    it('should reject request without Authorization header (401)', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Authentication token is missing');
    });

    it('should reject request without Bearer prefix (401)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic invalidcredentials');
      expect(res.status).toBe(401);
    });

    it('should reject request with forged/invalid token signature (401)', async () => {
      const forgedToken = jwt.sign({ id: 'fake_id' }, 'wrong_secret_key');
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('expired or invalid');
    });

    it('should reject request with expired token (401)', async () => {
      const expiredToken = jwt.sign(
        { id: 'fake_id', email: 'exp@test.com' },
        TEST_SECRET,
        { expiresIn: '-1s' }
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('should accept request with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe(testUsername);
    });
  });

  // ========================================================
  // 3. UPLOAD METADATA & 90-SECOND VIDEO CAP VALIDATION
  // ========================================================
  describe('Upload Metadata & Video Duration Validation', () => {
    it('should reject track upload without required fields', async () => {
      const res = await request(app)
        .post('/api/upload/track')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Test Track Incomplete',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    it('should reject track upload with title exceeding 100 characters', async () => {
      const res = await request(app)
        .post('/api/upload/track')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'a'.repeat(101),
          artist: 'Valid Artist',
          audioUrl: 'https://example.com/audio.mp3',
          duration: 180,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('100 characters');
    });

    it('should reject video upload with video duration exceeding 90 seconds', async () => {
      const res = await request(app)
        .post('/api/upload/video')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          caption: 'Test Video Exceeding Cap',
          videoUrl: 'https://example.com/video.mp4',
          duration: 91, // OVER 90s CAP
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('90 seconds or shorter');
    });

    it('should reject video upload with non-positive duration', async () => {
      const res = await request(app)
        .post('/api/upload/video')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          caption: 'Zero Duration Video',
          videoUrl: 'https://example.com/video.mp4',
          duration: 0,
        });

      expect(res.status).toBe(400);
    });

    it('should reject video upload with caption exceeding 500 characters', async () => {
      const res = await request(app)
        .post('/api/upload/video')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          caption: 'c'.repeat(501),
          videoUrl: 'https://example.com/video.mp4',
          duration: 45,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('500 characters');
    });

    it('should accept valid video upload within the 90-second cap', async () => {
      const res = await request(app)
        .post('/api/upload/video')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          caption: 'Test Video Valid Cap',
          videoUrl: 'https://example.com/valid-video.mp4',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          duration: 45, // Under 90s
        });

      expect(res.status).toBe(201);
      expect(res.body.video.caption).toBe('Test Video Valid Cap');
      expect(res.body.video.duration).toBe(45);
    });

    it('sets video likes idempotently and rejects provider video ids', async () => {
      const video = await Video.findOne({ caption: 'Test Video Valid Cap' });
      expect(video).toBeTruthy();

      const firstLike = await request(app)
        .post(`/api/videos/${video!._id}/like`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ liked: true });
      const repeatedLike = await request(app)
        .post(`/api/videos/${video!._id}/like`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ liked: true });

      expect(firstLike.body).toMatchObject({ liked: true, likesCount: 1 });
      expect(repeatedLike.body).toMatchObject({ liked: true, likesCount: 1 });
      expect(await Like.countDocuments({ targetId: video!._id, targetType: 'video' })).toBe(1);
      expect((await Video.findById(video!._id))?.likesCount).toBe(1);
      const viewerRead = await request(app)
        .get(`/api/videos/${video!._id}`)
        .set('Authorization', `Bearer ${validToken}`);
      expect(viewerRead.body.video.isLiked).toBe(true);

      const unliked = await request(app)
        .post(`/api/videos/${video!._id}/like`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ liked: false });
      expect(unliked.body).toMatchObject({ liked: false, likesCount: 0 });

      const providerLike = await request(app)
        .post('/api/videos/pexels-123/like')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ liked: true });
      expect(providerLike.status).toBe(400);
      expect(providerLike.body.message).toBe('Likes are only available on Kinetic videos');
    }, 15000);
  });

  // ========================================================
  // 4. GENERAL VALIDATION & REGEX SAFETY
  // ========================================================
  describe('Input Validation & Safe Querying', () => {
    it('provides onboarding options and authenticated creator suggestions', async () => {
      const options = await request(app).get('/api/onboarding/options');
      expect(options.status).toBe(200);
      expect(options.body.genres.length).toBeGreaterThan(0);
      expect(options.body.topics.length).toBeGreaterThan(0);

      const unauthorized = await request(app).get('/api/onboarding/suggested-creators');
      expect(unauthorized.status).toBe(401);
      const suggestions = await request(app)
        .get('/api/onboarding/suggested-creators')
        .set('Authorization', `Bearer ${validToken}`);
      expect(suggestions.status).toBe(200);
      expect(Array.isArray(suggestions.body.creators)).toBe(true);
    }, 15000);

    it('saves onboarding interests and marks the user complete', async () => {
      const res = await request(app)
        .patch('/api/onboarding')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ genres: ['ambient', 'jazz'], topics: ['dance', 'art'], role: 'listener', completed: true });
      expect(res.status).toBe(200);
      expect(res.body.user.interests).toEqual({ genres: ['ambient', 'jazz'], topics: ['dance', 'art'] });
      expect(res.body.user.onboardingCompleted).toBe(true);
      expect(res.body.user.onboardedAt).toBeTruthy();
      expect(res.body.user).not.toHaveProperty('passwordHash');

      const recommendations = await request(app)
        .get('/api/discover/recommended')
        .set('Authorization', `Bearer ${validToken}`);
      expect(recommendations.body.personalized).toBe(true);
    }, 15000);

    it('rejects external avatar URLs and accepts removing the current photo', async () => {
      const rejected = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ avatarUrl: 'https://example.com/avatar.png' });
      expect(rejected.status).toBe(400);

      const removed = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ avatarUrl: '' });
      expect(removed.status).toBe(200);
      expect(removed.body.user.avatarUrl).toBe('');
    });

    it('should reject profile update with bio exceeding 300 characters', async () => {
      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          bio: 'b'.repeat(301),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('300 characters');
    });

    it('should reject comment exceeding 500 characters', async () => {
      const res = await request(app)
        .post('/api/videos/dummyid/comments')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          text: 'x'.repeat(501),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('500 characters');
    });

    it('should safely handle search query with regex special characters without crashing', async () => {
      const res = await request(app)
        .get('/api/music/search?q=[.*+?^${}()|\\]');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tracks');
      expect(res.body).toHaveProperty('videos');
      expect(Array.isArray(res.body.tracks)).toBe(true);
      expect(Array.isArray(res.body.videos)).toBe(true);
    });
  });

  // ========================================================
  // TASK 2 — SECURITY HARDENING CHECKS
  // ========================================================
  describe('Security Hardening Checks', () => {
    it('validateEnv exits if JWT_SECRET is missing or under 32 characters', () => {
      const originalSecret = process.env.JWT_SECRET;
      const originalExit = process.exit;
      let exitCalled = false;
      // @ts-ignore
      process.exit = (code?: number) => {
        exitCalled = true;
        throw new Error(`process.exit(${code})`);
      };

      try {
        process.env.JWT_SECRET = 'short';
        expect(() => validateEnv()).toThrow('process.exit(1)');
        expect(exitCalled).toBe(true);
      } finally {
        process.env.JWT_SECRET = originalSecret;
        process.exit = originalExit;
      }
    });

    it('rejects a token signed with an invalid fallback secret (401)', async () => {
      const invalidSecret = ['kinetic', 'super', 'secret', 'key', '2026'].join('-');
      const forgedToken = jwt.sign({ id: 'dummy', email: 'forged@test.com' }, invalidSecret);
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects upload publish with non-Cloudinary URL (400)', async () => {
      const res = await request(app)
        .post('/api/upload/track')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Test External URL',
          artist: 'Test Artist',
          audioUrl: 'https://malicious.com/audio.mp3',
          cloudinaryPublicId: 'kinetic/track-audio/dummy/audio',
          duration: 120,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Cloudinary/i);
    });

    it('rejects upload publish with another user folder (400)', async () => {
      const res = await request(app)
        .post('/api/upload/track')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          title: 'Test Fake User Folder',
          artist: 'Test Artist',
          audioUrl: 'https://res.cloudinary.com/test-cloud/audio.mp3',
          cloudinaryPublicId: 'kinetic/track-audio/another-user-id/audio',
          duration: 120,
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cloudinaryPublicId must start with');
    });

    it('rejects upload publish for video over 90 seconds (400)', async () => {
      const res = await request(app)
        .post('/api/upload/video')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          caption: 'Overlong Video',
          videoUrl: 'https://res.cloudinary.com/test-cloud/video.mp4',
          cloudinaryPublicId: 'kinetic/video/dummy/vid',
          duration: 95,
        });
      expect(res.status).toBe(400);
    });

    it('rejects refresh request with missing or untrusted Origin (403)', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Origin', 'https://untrusted-site.com')
        .set('X-Kinetic-Client', 'web');
      expect(res.status).toBe(403);
    });
  });
});

