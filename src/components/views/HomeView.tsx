import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Film, 
  Heart, 
  ArrowRight, 
  Radio, 
  Music2, 
  TrendingUp, 
  Clock, 
  UserCheck, 
  Plus 
} from '../ui/Icon';
import { AuthUser, Track, ShortVideo, ActiveTab } from '../../types';
import { musicApi } from '../../services/musicApi';
import { videoApi } from '../../services/videoApi';
import { MediaLoadingState } from '../MediaLoadingState';
import { StateFeedback } from '../ui/StateFeedback';
import { Avatar } from '../ui/Avatar';

interface HomeViewProps {
  onPlayTrack: (track: Track) => void;
  onSelectShort: (short: ShortVideo) => void;
  onOpenWatch: (video: ShortVideo) => void;
  onOpenProfile: (username: string) => void;
  onNavigate: (tab: ActiveTab) => void;
  currentUser?: AuthUser | null;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onPlayTrack,
  onSelectShort,
  onOpenWatch,
  onOpenProfile,
  onNavigate,
  currentUser,
}) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const loadHomeTracks = async () => {
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const fetchedTracks = await musicApi.getTrendingTracks();
      setTracks(fetchedTracks);
    } catch {
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadHomeTracks();
    videoApi.getTrendingVideos().then(setVideos).catch(() => setVideos([]));
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setIsWakingServer(false);
      return;
    }
    const timer = setTimeout(() => setIsWakingServer(true), 4000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const heroTrack = tracks[0];

  const playPreview = (video: HTMLVideoElement) => {
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  const stopPreview = (video: HTMLVideoElement) => {
    video.pause();
    video.currentTime = 0;
  };

  return (
    <div className="space-y-10 pb-28 pt-2 animate-in fade-in duration-300">
      {isLoading && (
        <div>
          <MediaLoadingState />
          {isWakingServer && <p className="-mt-10 pb-8 text-center text-xs text-[var(--muted)]">Getting things ready. The first load can take up to a minute.</p>}
        </div>
      )}
      {hasLoadError && !isLoading && (
        <StateFeedback
          state="error"
          message="Couldn't load music. Check your connection and try again."
          action={{ label: 'Retry', onClick: () => { void loadHomeTracks(); } }}
        />
      )}
      {!isLoading && !hasLoadError && !heroTrack && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--raised)] px-6 py-12 text-center text-sm text-[var(--muted)]">
          Live media is unavailable right now. Please try again shortly.
        </div>
      )}
      {!isLoading && <>
      {/* 1. HERO SPOTLIGHT BANNER */}
      {heroTrack && <section className="relative overflow-hidden rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 lg:p-10 shadow-2xl">
        {/* Dynamic atmospheric glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[var(--accent)]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[var(--accent)]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/30">
                <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                FEATURED SPOTLIGHT #1
              </span>
              <span className="text-xs font-semibold text-[var(--muted)]">Master Audio & 9:16 Film</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black  text-[var(--text)] font-display leading-tight">
              {heroTrack.title} <span className="text-[var(--accent)] font-light">—</span> {heroTrack.artist}
            </h1>

            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-xl">
              Immersive spatial audio combined with seamless 9:16 short film visuals. Streamed in high-headroom 24-Bit FLAC fidelity.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onPlayTrack(heroTrack)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--accent)] hover:brightness-110 text-[var(--text)] font-bold text-xs shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Listen Now</span>
              </button>

              <button
                onClick={() => onNavigate('shorts')}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-[var(--raised)] hover:bg-[var(--border-hover)] text-[var(--text)] font-semibold text-xs border border-[var(--border)] transition-all"
              >
                <Film className="w-4 h-4 text-[var(--accent)]" />
                <span>Watch Shorts</span>
              </button>
            </div>
          </div>

          <div className="relative group flex-shrink-0">
            <img
              src={heroTrack.coverUrl}
              alt={heroTrack.title}
              className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl object-cover shadow-2xl border border-[var(--border)] group-hover:scale-102 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-2xl flex items-end p-4">
              <span className="text-[10px] font-bold text-[var(--text)]   bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
                Dolby Atmos Certified
              </span>
            </div>
          </div>
        </div>
      </section>}

      {/* 2. CONTINUE LISTENING (Horizontally scrollable tracks) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-xl font-bold text-[var(--text)] font-display">Continue listening</h2>
          </div>
          <button 
            onClick={() => onNavigate('music')}
            className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-1"
          >
            <span>See All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tracks.slice(0, 6).map((t, index) => (
            <div
              key={`continue-track-${t.id}-${index}`}
              onClick={() => onPlayTrack(t)}
              className="group bg-[var(--raised)] hover:bg-[var(--raised)] border border-[var(--border)] p-3 rounded-2xl cursor-pointer transition-all hover:scale-102 hover:shadow-xl"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
                <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--text)] shadow-lg">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="font-bold text-xs text-[var(--text)] truncate">{t.title}</div>
              <div className="text-[11px] text-[var(--muted)] truncate">{t.artist}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. POPULAR SHORT VIDEOS (9:16 Vertical Video Cards) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[var(--like)]" />
            <h2 className="text-xl font-bold text-[var(--text)] font-display">Popular shorts</h2>
          </div>
          <button 
            onClick={() => onNavigate('shorts')}
            className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent)] flex items-center gap-1"
          >
            <span>Feed View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v, index) => (
            <div
              key={`short-video-${v.id}-${index}`}
              onClick={() => onOpenWatch(v)}
              onMouseEnter={(event) => {
                const preview = event.currentTarget.querySelector<HTMLVideoElement>('video');
                if (preview) playPreview(preview);
              }}
              onMouseLeave={(event) => {
                const preview = event.currentTarget.querySelector<HTMLVideoElement>('video');
                if (preview) stopPreview(preview);
              }}
              className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-[var(--raised)] border border-[var(--border)] cursor-pointer shadow-lg hover:border-[var(--accent)] transition-all"
            >
              {v.videoUrl ? (
                <video
                  src={v.videoUrl}
                  poster={v.thumbnailUrl || undefined}
                  muted
                  playsInline
                  preload="none"
                  aria-label={v.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <img src={v.thumbnailUrl} alt={v.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm grid place-items-center text-[var(--text)] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4 fill-white" />
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text)] bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20">
                    {Math.round(v.duration)}s · {v.views} views
                  </span>
                </div>

                <div className="space-y-2">
                  <button onClick={(event) => { event.stopPropagation(); onOpenProfile(v.creatorHandle.replace(/^@/, '')); }} className="flex items-center gap-2 text-left">
                    <Avatar src={v.creator === currentUser?.id ? currentUser.avatarUrl : v.creatorAvatar} name={v.creatorName} size={24} className="border border-white/40" />
                    <span className="text-xs font-bold text-[var(--text)] truncate hover:underline">{v.creatorName}</span>
                  </button>
                  <p className="text-xs text-[var(--text)]/90 font-medium line-clamp-2 leading-snug">
                    {v.caption}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. TRENDING SOUNDS (Audio tracks powering videos) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-xl font-bold text-[var(--text)] font-display">Trending tracks</h2>
        </div>

        <div className="bg-[var(--raised)] border border-[var(--border)] rounded-2xl p-4 divide-y divide-[var(--border)]">
          {tracks.slice(0, 4).map((t, idx) => (
            <div
              key={`trending-track-${t.id}-${idx}`}
              className="flex items-center justify-between py-3 px-2 hover:bg-[var(--raised)] rounded-xl transition-colors group cursor-pointer"
              onClick={() => onPlayTrack(t)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-xs font-black text-[var(--subtle)] w-4 text-center">{idx + 1}</span>
                <img src={t.coverUrl} alt={t.title} className="w-11 h-11 rounded-xl object-cover" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] truncate">{t.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden sm:inline-block text-[11px] font-semibold text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-full">
                  {t.shortsCount || '12.4k Shorts'}
                </span>
                <button className="w-8 h-8 rounded-full bg-[var(--raised)] group-hover:bg-[var(--accent)] flex items-center justify-center text-[var(--text)] transition-colors">
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      </>}
    </div>
  );
};
