import React, { useEffect, useState } from 'react';
import { Edit3, ImagePlus, Loader2, LogOut, Music2, Play, Plus, UserPlus, UserRoundCheck, Video, X } from 'lucide-react';
import { AuthUser, Playlist, ShortVideo, Track } from '../../types';
import { authApi } from '../../services/authApi';
import { musicApi } from '../../services/musicApi';
import { uploadApi } from '../../services/uploadApi';
import { videoApi } from '../../services/videoApi';
import { CreatorBadge } from '../ui/CreatorBadge';
import { StateFeedback } from '../ui/StateFeedback';

interface ProfileViewProps {
  username?: string;
  currentUser: AuthUser | null;
  onUserUpdated: (user: AuthUser) => void;
  onOpenUpload: () => void;
  onOpenWatch: (video: ShortVideo) => void;
  onOpenProfile: (username: string) => void;
  onLogout: () => void;
}

type ProfileData = {
  user: AuthUser & { _id?: string };
  tracks: Track[];
  videos: ShortVideo[];
  playlists: Playlist[];
  totalUploads: number;
  totalLikesReceived: number;
  isFollowing: boolean;
};

type ProfileTab = 'tracks' | 'videos' | 'playlists' | 'liked';

export const ProfileView: React.FC<ProfileViewProps> = ({
  username,
  currentUser,
  onUserUpdated,
  onOpenUpload,
  onOpenWatch,
  onLogout,
}) => {
  const isOwnProfile = !!currentUser && (!username || username.toLowerCase() === currentUser.username.toLowerCase());
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [tab, setTab] = useState<ProfileTab>('tracks');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (isOwnProfile && currentUser) {
          const token = authApi.getToken();
          const [tracks, videos, playlists] = await Promise.all([
            musicApi.getMyTracks(),
            videoApi.getMyVideos(),
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/playlists/my`, { headers: { Authorization: `Bearer ${token}` } }).then(async (res) => {
              if (!res.ok) throw new Error('Unable to load playlists');
              return (await res.json()).playlists || [];
            }),
          ]);
          if (!cancelled) {
            setProfile({ user: currentUser, tracks, videos, playlists, totalUploads: tracks.length + videos.length, totalLikesReceived: 0, isFollowing: false });
          }
        } else if (username) {
          const data = await authApi.getPublicProfile(username);
          if (!cancelled) {
            setProfile(data);
            setIsFollowing(!!data.isFollowing);
          }
        } else {
          throw new Error('Sign in to view your profile.');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load profile');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser, isOwnProfile, username]);

  if (isLoading) return <StateFeedback state="loading" skeletonCount={3} />;
  if (error || !profile) return <StateFeedback state="error" title="Profile unavailable" message={error || 'This profile could not be loaded.'} />;

  const profileUser = profile.user;
  const displayVideos = profile.videos || [];
  const displayTracks = profile.tracks || [];
  const emptyAction = isOwnProfile ? { label: 'Upload media', onClick: onOpenUpload } : undefined;

  return (
    <div className="pb-28 pt-3 animate-in fade-in duration-300">
      <section className="relative overflow-hidden border-x border-t border-[var(--border)] bg-[var(--raised)]">
        <div className="h-48 sm:h-64 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(90deg, rgba(8,10,15,.88), rgba(19,23,34,.25)), url(${profileUser.coverUrl || 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=1600'})` }} />
        <div className="relative px-5 sm:px-10 pb-7">
          <img src={profileUser.avatarUrl} alt={profileUser.name} className="absolute -top-14 left-5 sm:left-10 w-28 h-28 rounded-full border-4 border-[var(--raised)] object-cover shadow-2xl" />
          <div className="pt-20 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-black text-[var(--text)] font-display">{profileUser.name}</h1>
                {profileUser.role === 'creator' && <CreatorBadge variant="verified" size="sm" />}
              </div>
              <p className="text-sm font-semibold text-[var(--accent-hover)]">@{profileUser.username}</p>
              <p className="text-sm leading-relaxed text-[var(--muted)]">{profileUser.bio || 'No bio yet.'}</p>
            </div>
            <div className="flex items-center gap-2">
              {isOwnProfile ? (
                <>
                  <button onClick={() => setIsEditing(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--accent)] text-[var(--text)] text-xs font-bold hover:bg-[var(--accent-hover)]"><Edit3 className="w-4 h-4" /> Edit Profile</button>
                  <button onClick={onLogout} title="Sign out" className="p-2.5 rounded-full border border-[var(--like)]/30 text-[var(--danger)] hover:bg-[var(--like)]/10"><LogOut className="w-4 h-4" /></button>
                </>
              ) : (
                <button onClick={async () => { try { const result = await authApi.toggleFollow(profileUser._id || profileUser.id); setIsFollowing(result.following); setProfile((prev) => prev ? { ...prev, user: { ...prev.user, followersCount: Math.max(0, prev.user.followersCount + (result.following ? 1 : -1)) } } : prev); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update follow'); } }} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold ${isFollowing ? 'bg-[var(--raised)] text-[var(--text)] border border-[var(--accent)]' : 'bg-[var(--accent)] text-[var(--text)]'}`}>
                  {isFollowing ? <UserRoundCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}{isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[var(--border)] mt-7 pt-5 max-w-2xl">
            <Stat label="Followers" value={profileUser.followersCount} /><Stat label="Following" value={profileUser.followingCount} /><Stat label="Uploads" value={profile.totalUploads} /><Stat label="Likes received" value={profile.totalLikesReceived} />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
        {(['tracks', 'videos', 'playlists', ...(isOwnProfile ? ['liked'] : [])] as ProfileTab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`px-4 py-4 text-xs font-bold capitalize whitespace-nowrap border-b-2 ${tab === item ? 'text-[var(--text)] border-[var(--accent)]' : 'text-[var(--subtle)] border-transparent hover:text-[var(--text)]'}`}>{item}</button>
        ))}
      </div>

      <ProfileContent tab={tab} tracks={displayTracks} videos={displayVideos} playlists={profile.playlists || []} emptyAction={emptyAction} onOpenWatch={onOpenWatch} />
      {isEditing && <EditProfileModal user={profileUser} onClose={() => setIsEditing(false)} onSaved={(user) => { setProfile((prev) => prev ? { ...prev, user } : prev); onUserUpdated(user); setIsEditing(false); }} />}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => <div><div className="text-xl font-black text-[var(--text)] tabular-nums">{value || 0}</div><div className="text-[10px]   font-bold text-[var(--subtle)]">{label}</div></div>;

const ProfileContent = ({ tab, tracks, videos, playlists, emptyAction, onOpenWatch }: { tab: ProfileTab; tracks: Track[]; videos: ShortVideo[]; playlists: Playlist[]; emptyAction?: { label: string; onClick: () => void }; onOpenWatch: (video: ShortVideo) => void }) => {
  if (tab === 'tracks') return tracks.length ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-6">{tracks.map((track) => <div key={track.id} className="flex items-center gap-3 p-3 bg-[var(--raised)] border border-[var(--border)] rounded-2xl"><img src={track.coverUrl} alt="" className="w-14 h-14 rounded-xl object-cover" /><div className="min-w-0"><div className="text-sm font-bold text-[var(--text)] truncate">{track.title}</div><div className="text-xs text-[var(--muted)] truncate">{track.artist}</div></div></div>)}</div> : <StateFeedback state="empty" title="No tracks yet" message="Upload your first track to build your catalog." action={emptyAction} />;
  if (tab === 'videos') return videos.length ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 py-6">{videos.map((video) => <button key={video.id} onClick={() => onOpenWatch(video)} className="group text-left"><div className="relative aspect-video overflow-hidden rounded-2xl bg-[var(--raised)] border border-[var(--border)]"><img src={video.thumbnailUrl} alt={video.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /><span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 bg-black/35"><Play className="w-8 h-8 fill-white text-[var(--text)]" /></span></div><div className="text-xs font-bold text-[var(--text)] mt-2 line-clamp-2">{video.caption}</div></button>)}</div> : <StateFeedback state="empty" title="No videos yet" message="Upload your first Short to share it here." action={emptyAction} />;
  if (tab === 'playlists') return playlists.length ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-6">{playlists.map((playlist) => <div key={playlist.id || (playlist as any)._id} className="bg-[var(--raised)] border border-[var(--border)] rounded-2xl p-3"><img src={playlist.coverUrl} alt="" className="w-full aspect-video rounded-xl object-cover" /><div className="text-sm font-bold text-[var(--text)] mt-3">{playlist.title}</div><div className="text-xs text-[var(--subtle)] mt-1">{(playlist as any).tracks?.length || playlist.tracksCount || 0} tracks</div></div>)}</div> : <StateFeedback state="empty" title="No playlists yet" message="Curated collections will appear here." action={emptyAction} />;
  return <StateFeedback state="empty" title="No liked content yet" message="Like tracks and videos to collect them here." />;
};

const EditProfileModal = ({ user, onClose, onSaved }: { user: AuthUser; onClose: () => void; onSaved: (user: AuthUser) => void }) => {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(user.coverUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadImage = async (file: File, target: 'avatar' | 'cover') => { try { const result = await uploadApi.uploadFileToCloudinary(file, 'image'); (target === 'avatar' ? setAvatarUrl : setCoverUrl)(result.secure_url); } catch (err) { setError(err instanceof Error ? err.message : 'Image upload failed'); } };
  return <div className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm grid place-items-center p-4"><div className="w-full max-w-lg bg-[var(--raised)] border border-[var(--border)] rounded-3xl p-6 shadow-2xl"><div className="flex items-center justify-between mb-5"><h2 className="text-lg font-black text-[var(--text)]">Edit profile</h2><button onClick={onClose} className="p-2 text-[var(--subtle)] hover:text-[var(--text)]"><X className="w-5 h-5" /></button></div><div className="space-y-4"><label className="block text-xs font-bold text-[var(--muted)]">Name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 text-sm text-[var(--text)]" /></label><label className="block text-xs font-bold text-[var(--muted)]">Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className="mt-1 w-full rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 text-sm text-[var(--text)] resize-none" /></label><div className="grid grid-cols-2 gap-3"><ImagePicker label="Avatar image" value={avatarUrl} onChange={(file) => uploadImage(file, 'avatar')} /><ImagePicker label="Cover image" value={coverUrl} onChange={(file) => uploadImage(file, 'cover')} /></div>{error && <p className="text-xs text-[var(--danger)]">{error}</p>}<button disabled={isSaving} onClick={async () => { setIsSaving(true); setError(null); try { onSaved(await authApi.updateProfile({ name, bio, avatarUrl, coverUrl })); } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save profile'); } finally { setIsSaving(false); } }} className="w-full inline-flex justify-center items-center gap-2 rounded-full bg-[var(--accent)] py-3 text-xs font-bold text-[var(--text)] disabled:opacity-60">{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />} Save changes</button></div></div></div>;
};

const ImagePicker = ({ label, value, onChange }: { label: string; value: string; onChange: (file: File) => void }) => <label className="relative aspect-video rounded-2xl overflow-hidden border border-dashed border-[var(--border-hover)] bg-[var(--surface)] cursor-pointer group"><img src={value} alt="" className="w-full h-full object-cover opacity-70" /><span className="absolute inset-0 grid place-items-center bg-black/40 text-[var(--text)] text-xs font-bold gap-1"><ImagePlus className="w-5 h-5" />{label}</span><input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onChange(file); }} /></label>;
