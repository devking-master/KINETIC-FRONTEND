import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { Video } from '../models/Video';

const make = (duration: number) => new Video({
  caption: 'x', videoUrl: 'https://res.cloudinary.com/democloud/video/upload/a.mp4', thumbnailUrl: 'https://t/x.jpg', duration,
  creator: new mongoose.Types.ObjectId(), creatorName: 'sam', creatorHandle: '@sam', creatorAvatar: '', audioTrackTitle: 'a', audioArtist: 'b', source: 'user',
});
const message = (duration: number) => make(duration).validateSync()?.errors?.duration?.message;

describe('Video model duration messages', () => {
  it('accepts 1 to 90 seconds', () => { for (const d of [1, 45, 90]) expect(message(d)).toBeUndefined(); });
  it('a length that could not be read is NOT reported as "over 90 seconds"', () => {
    expect(message(0)).toMatch(/could not be read/i);
    expect(message(0)).not.toMatch(/exceed/i);
  });
  it('a video that is too long says so', () => { expect(message(91)).toMatch(/must not exceed 90 seconds/); });
});
