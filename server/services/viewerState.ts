import mongoose from 'mongoose';
import { Follow, Like } from '../models/Social';
import { SavedVideo } from '../models/SavedVideo';

type ViewerItem = Record<string, any>;

export const withViewerState = async <T extends ViewerItem>(
  items: T[],
  userId: string | undefined,
  targetType: 'video' | 'track'
): Promise<T[]> => {
  const plainItems = items.map((item) => typeof item.toObject === 'function' ? item.toObject() : item);
  if (!plainItems.length) return plainItems;
  const getId = (item: ViewerItem) => String(item._id || item.id || '');
  const ids = plainItems.map(getId).filter((id) => mongoose.isValidObjectId(id));
  if (!userId || !mongoose.isValidObjectId(userId) || ids.length === 0) {
    return plainItems.map((item) => ({ ...item, isLiked: false, isSaved: false, isFollowingCreator: false }));
  }

  const getCreatorId = (item: ViewerItem) => {
    const creator = targetType === 'video' ? item.creator : item.uploadedBy || item.artistId;
    if (creator && typeof creator === 'object' && !(creator instanceof mongoose.Types.ObjectId)) {
      return String(creator._id || (typeof creator.id === 'string' ? creator.id : ''));
    }
    return String(creator || '');
  };
  const creatorIds = plainItems.map(getCreatorId).filter((id) => mongoose.isValidObjectId(id));
  const [likes, saved, follows] = await Promise.all([
    Like.find({ userId, targetType, targetId: { $in: ids } }).select('targetId').lean(),
    targetType === 'video'
      ? SavedVideo.find({ userId, videoId: { $in: ids } }).select('videoId').lean()
      : Promise.resolve([]),
    creatorIds.length
      ? Follow.find({ followerId: userId, followingId: { $in: creatorIds } }).select('followingId').lean()
      : Promise.resolve([]),
  ]);
  const likedIds = new Set(likes.map((like) => String(like.targetId)));
  const savedIds = new Set(saved.map((item: any) => String(item.videoId)));
  const followedIds = new Set(follows.map((follow: any) => String(follow.followingId)));
  return plainItems.map((item) => ({
    ...item,
    isLiked: likedIds.has(getId(item)),
    isSaved: targetType === 'video' && savedIds.has(getId(item)),
    isFollowingCreator: followedIds.has(getCreatorId(item)),
  }));
};