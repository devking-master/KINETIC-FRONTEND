import mongoose from 'mongoose';
import { User } from '../models/User';

type AvatarItem = Record<string, any>;

const plain = (item: AvatarItem) => typeof item.toObject === 'function' ? item.toObject() : item;
const relatedUserId = (value: any) => {
  if (value && typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId)) {
    return String(value._id || (typeof value.id === 'string' ? value.id : ''));
  }
  return String(value || '');
};

export const withCreatorAvatars = async <T extends AvatarItem>(items: T[]): Promise<T[]> => {
  const records = items.map(plain);
  const ids = records.flatMap((item) => [item.creator, item.uploadedBy, item.artistId, item.owner]
    .map(relatedUserId).filter((id) => mongoose.isValidObjectId(id)));
  const users = ids.length ? await User.find({ _id: { $in: [...new Set(ids)] } }).select('avatarUrl').lean() : [];
  const avatars = new Map(users.map((user) => [String(user._id), user.avatarUrl || '']));
  return records.map((item) => {
    const result = { ...item };
    const creatorId = relatedUserId(item.creator);
    const uploaderId = relatedUserId(item.uploadedBy || item.artistId);
    const ownerId = relatedUserId(item.owner);
    if (item.creator !== undefined) {
      result.creatorAvatar = avatars.get(creatorId) || '';
      if (typeof item.creator === 'object' && item.creator !== null) result.creator = creatorId;
    }
    if (item.uploadedBy !== undefined || item.artistId !== undefined) result.uploaderAvatar = avatars.get(uploaderId) || '';
    if (item.owner !== undefined) result.ownerAvatar = avatars.get(ownerId) || '';
    return result;
  });
};

export const withCommentAvatars = async <T extends AvatarItem>(items: T[]): Promise<T[]> => {
  const records = items.map(plain);
  const ids = records.map((item) => relatedUserId(item.userId)).filter((id) => mongoose.isValidObjectId(id));
  const users = ids.length ? await User.find({ _id: { $in: [...new Set(ids)] } }).select('avatarUrl').lean() : [];
  const avatars = new Map(users.map((user) => [String(user._id), user.avatarUrl || '']));
  return records.map((item) => ({ ...item, userAvatar: avatars.get(relatedUserId(item.userId)) || '' }));
};