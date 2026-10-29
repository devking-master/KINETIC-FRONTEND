import { describe, it, expect, vi, beforeEach } from 'vitest';

const resource = vi.fn();
const destroy = vi.fn(async () => ({ result: 'ok' }));
vi.mock('../config/cloudinary', () => ({
  default: { api: { resource: (...a: unknown[]) => resource(...a) }, uploader: { destroy: (...a: unknown[]) => destroy(...(a as [])) }, utils: {} },
  apiKey: 'key', apiSecret: 'secret', cloudName: 'democloud',
}));

const videoCreate = vi.fn();
const trackCreate = vi.fn();
vi.mock('../models/Video', () => ({ Video: { create: (...a: unknown[]) => videoCreate(...a), countDocuments: vi.fn(async () => 0) } }));
vi.mock('../models/Track', () => ({ Track: { create: (...a: unknown[]) => trackCreate(...a), countDocuments: vi.fn(async () => 0) } }));

import { createUploadedVideo, createUploadedTrack } from '../controllers/uploadController';

const makeRes = () => {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
};
const videoReq = (body: Record<string, unknown> = {}) => ({
  user: { id: 'u1', username: 'sam' },
  body: { caption: 'hello', videoUrl: 'https://res.cloudinary.com/democloud/video/upload/v1/kinetic/video/u1/a.mp4', cloudinaryPublicId: 'kinetic/video/u1/a', duration: 30, ...body },
}) as any;
const trackReq = (body: Record<string, unknown> = {}) => ({
  user: { id: 'u1', username: 'sam' },
  body: { title: 'Song', artist: 'Me', audioUrl: 'https://res.cloudinary.com/democloud/video/upload/v1/kinetic/track-audio/u1/a.mp3', cloudinaryPublicId: 'kinetic/track-audio/u1/a', duration: 200, ...body },
}) as any;
const asset = (extra: Record<string, unknown> = {}) => ({ format: 'mp4', bytes: 5_000_000, secure_url: 'https://res.cloudinary.com/democloud/video/upload/v1/kinetic/video/u1/a.mp4', ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  videoCreate.mockImplementation(async (doc: any) => ({ ...doc, _id: 'v1' }));
  trackCreate.mockImplementation(async (doc: any) => ({ ...doc, _id: 't1' }));
});

describe('publishing a video', () => {
  it('uses the length Cloudinary measured', async () => {
    resource.mockResolvedValue(asset({ duration: 45.2 }));
    const res = makeRes(); await createUploadedVideo(videoReq({ duration: 10 }), res);
    expect(res.statusCode).toBe(201);
    expect(videoCreate.mock.calls[0][0].duration).toBe(45);          // Cloudinary's number, not the browser's
  });

  it('REGRESSION (your log): Cloudinary returns no duration -> publishes with the browser-measured length, not a 500', async () => {
    for (const missing of [undefined, 0, null, NaN]) {
      videoCreate.mockClear();
      resource.mockResolvedValue(asset({ duration: missing }));
      const res = makeRes(); await createUploadedVideo(videoReq({ duration: 30 }), res);
      expect(res.statusCode).toBe(201);
      expect(videoCreate.mock.calls[0][0].duration).toBe(30);
      expect(destroy).not.toHaveBeenCalled();
    }
  });

  it('no length from Cloudinary and none from the browser -> clear 400 and the file is removed', async () => {
    resource.mockResolvedValue(asset());
    const res = makeRes(); await createUploadedVideo(videoReq({ duration: undefined }), res);
    expect(res.statusCode).toBe(400);
    expect((res.body as any).message).toMatch(/could not read the length/i);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(videoCreate).not.toHaveBeenCalled();
  });

  it('over 90 seconds is rejected with 400 and the file is removed (Cloudinary number or browser fallback)', async () => {
    resource.mockResolvedValue(asset({ duration: 95 }));
    let res = makeRes(); await createUploadedVideo(videoReq(), res);
    expect(res.statusCode).toBe(400); expect((res.body as any).message).toMatch(/90 seconds or shorter/);
    expect(destroy).toHaveBeenCalledTimes(1); expect(videoCreate).not.toHaveBeenCalled();

    resource.mockResolvedValue(asset());                                // no duration from Cloudinary, browser says 200
    res = makeRes(); await createUploadedVideo(videoReq({ duration: 200 }), res);
    expect(res.statusCode).toBe(400); expect(videoCreate).not.toHaveBeenCalled();
  });

  it('90.4 seconds is treated as 1:30 (stored as 90); 90.6 is too long', async () => {
    resource.mockResolvedValue(asset({ duration: 90.4 }));
    let res = makeRes(); await createUploadedVideo(videoReq(), res);
    expect(res.statusCode).toBe(201); expect(videoCreate.mock.calls[0][0].duration).toBe(90);
    resource.mockResolvedValue(asset({ duration: 90.6 }));
    res = makeRes(); await createUploadedVideo(videoReq(), res);
    expect(res.statusCode).toBe(400);
  });

  it('a very short clip is stored as at least 1 second', async () => {
    resource.mockResolvedValue(asset({ duration: 0.3 }));
    const res = makeRes(); await createUploadedVideo(videoReq(), res);
    expect(res.statusCode).toBe(201); expect(videoCreate.mock.calls[0][0].duration).toBe(1);
  });

  it('a database validation failure is a 400 with the real reason (and the file is removed), never a 500', async () => {
    resource.mockResolvedValue(asset({ duration: 30 }));
    videoCreate.mockRejectedValue({ name: 'ValidationError', errors: { caption: { message: 'Caption is too long.' } } });
    const res = makeRes(); await createUploadedVideo(videoReq(), res);
    expect(res.statusCode).toBe(400);
    expect((res.body as any).message).toBe('Caption is too long.');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('an unexpected error is still a 500 and does not leak details', async () => {
    resource.mockResolvedValue(asset({ duration: 30 }));
    videoCreate.mockRejectedValue(new Error('connection to 10.0.0.5 refused'));
    const res = makeRes(); await createUploadedVideo(videoReq(), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('still enforces format, size and ownership of the file', async () => {
    resource.mockResolvedValue(asset({ duration: 30, format: 'avi' }));
    let res = makeRes(); await createUploadedVideo(videoReq(), res); expect(res.statusCode).toBe(400);
    resource.mockResolvedValue(asset({ duration: 30, bytes: 150 * 1024 * 1024 }));
    res = makeRes(); await createUploadedVideo(videoReq(), res); expect(res.statusCode).toBe(400);
    resource.mockResolvedValue(asset({ duration: 30 }));
    res = makeRes(); await createUploadedVideo(videoReq({ cloudinaryPublicId: 'kinetic/video/someone-else/a' }), res); expect(res.statusCode).toBe(400);
    expect(videoCreate).not.toHaveBeenCalled();
  });

  it('stores the URL of the file Cloudinary verified, not the one the browser sent', async () => {
    resource.mockResolvedValue(asset({ duration: 30 }));
    const res = makeRes(); await createUploadedVideo(videoReq({ videoUrl: 'https://res.cloudinary.com/democloud/video/upload/v1/kinetic/video/u1/other.mp4' }), res);
    expect(videoCreate.mock.calls[0][0].videoUrl).toBe('https://res.cloudinary.com/democloud/video/upload/v1/kinetic/video/u1/a.mp4');
  });
});

describe('publishing a track', () => {
  const trackAsset = (extra: Record<string, unknown> = {}) => ({ format: 'mp3', bytes: 4_000_000, secure_url: 'https://res.cloudinary.com/democloud/video/upload/v1/kinetic/track-audio/u1/a.mp3', ...extra });

  it('uses Cloudinary\'s length, or the browser\'s when Cloudinary has none', async () => {
    resource.mockResolvedValue(trackAsset({ duration: 187.6 }));
    let res = makeRes(); await createUploadedTrack(trackReq(), res);
    expect(res.statusCode).toBe(201); expect(trackCreate.mock.calls[0][0].duration).toBe(188);

    trackCreate.mockClear();
    resource.mockResolvedValue(trackAsset({ duration: 0 }));
    res = makeRes(); await createUploadedTrack(trackReq({ duration: 200 }), res);
    expect(res.statusCode).toBe(201); expect(trackCreate.mock.calls[0][0].duration).toBe(200);
  });

  it('rejects tracks longer than 15 minutes and database validation failures with a 400', async () => {
    resource.mockResolvedValue(trackAsset({ duration: 16 * 60 }));
    let res = makeRes(); await createUploadedTrack(trackReq(), res);
    expect(res.statusCode).toBe(400);

    resource.mockResolvedValue(trackAsset({ duration: 100 }));
    trackCreate.mockRejectedValue({ name: 'ValidationError', errors: { title: { message: 'Title is required.' } } });
    res = makeRes(); await createUploadedTrack(trackReq(), res);
    expect(res.statusCode).toBe(400); expect((res.body as any).message).toBe('Title is required.');
  });
});
