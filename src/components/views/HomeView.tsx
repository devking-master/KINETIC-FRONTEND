import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Film, 
  Sparkles, 
  Heart, 
  ArrowRight, 
  Radio, 
  Flame, 
  Music2, 
  TrendingUp, 
  Clock, 
  UserCheck, 
  Plus 
} from 'lucide-react';
import { Track, ShortVideo, ActiveTab } from '../../types';
import { musicApi } from '../../services/musicApi';
import { videoApi } from '../../services/videoApi';
import { MediaLoadingState } from '../MediaLoadingState';

interface HomeViewProps {
  onPlayTrack: (track: Track) => void;
  onSelectShort: (short: ShortVideo) => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onPlayTrack,
  onSelectShort,
  onNavigate,
}) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHomeContent = async () => {
      setIsLoading(true);
      try {
        const [fetchedTracks, fetchedVideos] = await Promise.all([
          musicApi.getTrendingTracks(),
          videoApi.getTrendingVideos(),
        ]);
        setTracks(fetchedTracks);
        setVideos(fetchedVideos);
      } finally {
        setIsLoading(false);
      }
    };
    loadHomeContent();
  }, []);

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
      {isLoading && <MediaLoadingState />}
      {!isLoading && !heroTrack && (
        <div className="rounded-3xl border border-[#1F273A] bg-[#131722] px-6 py-12 text-center text-sm text-[#94A3B8]">
          Live media is unavailable right now. Please try again shortly.
        </div>
      )}
      {!isLoading && <>
      {/* 1. HERO SPOTLIGHT BANNER */}
      {heroTrack && <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0D1017] via-[#131722] to-[#1B2130] border border-[#1F273A] p-6 lg:p-10 shadow-2xl">
        {/* Dynamic atmospheric glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#6366F1]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#8B5CF6]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                FEATURED SPOTLIGHT #1
              </span>
              <span className="text-xs font-semibold text-[#94A3B8]">Master Audio & 9:16 Film</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white font-display leading-tight">
              {heroTrack.title} <span className="text-[#6366F1] font-light">—</span> {heroTrack.artist}
            </h1>

            <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed max-w-xl">
              Immersive spatial audio combined with seamless 9:16 short film visuals. Streamed in high-headroom 24-Bit FLAC fidelity.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onPlayTrack(heroTrack)}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-[#6366F1]/30 transition-all hover:scale-105 active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Listen Now</span>
              </button>

              <button
                onClick={() => onNavigate('shorts')}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#1B2130] hover:bg-[#262E42] text-white font-semibold text-xs border border-[#1F273A] transition-all"
              >
                <Film className="w-4 h-4 text-[#06B6D4]" />
                <span>Watch Shorts</span>
              </button>
            </div>
          </div>

          <div className="relative group flex-shrink-0">
            <img
              src={heroTrack.coverUrl}
              alt={heroTrack.title}
              className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl object-cover shadow-2xl border border-[#1F273A] group-hover:scale-102 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-2xl flex items-end p-4">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
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
            <Clock className="w-5 h-5 text-[#6366F1]" />
            <h2 className="text-xl font-bold text-white font-display">Continue Listening</h2>
          </div>
          <button 
            onClick={() => onNavigate('music')}
            className="text-xs font-semibold text-[#6366F1] hover:text-[#8B5CF6] flex items-center gap-1"
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
              className="group bg-[#131722] hover:bg-[#1B2130] border border-[#1F273A] p-3 rounded-2xl cursor-pointer transition-all hover:scale-102 hover:shadow-xl"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
                <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-[#6366F1] flex items-center justify-center text-white shadow-lg shadow-[#6366F1]/40">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="font-bold text-xs text-white truncate">{t.title}</div>
              <div className="text-[11px] text-[#94A3B8] truncate">{t.artist}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. POPULAR SHORT VIDEOS (9:16 Vertical Video Cards) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#F43F5E]" />
            <h2 className="text-xl font-bold text-white font-display">Popular Short Videos</h2>
          </div>
          <button 
            onClick={() => onNavigate('shorts')}
            className="text-xs font-semibold text-[#6366F1] hover:text-[#8B5CF6] flex items-center gap-1"
          >
            <span>Feed View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v, index) => (
            <div
              key={`short-video-${v.id}-${index}`}
              onClick={() => onSelectShort(v)}
              onMouseEnter={(event) => {
                const preview = event.currentTarget.querySelector<HTMLVideoElement>('video');
                if (preview) playPreview(preview);
              }}
              onMouseLeave={(event) => {
                const preview = event.currentTarget.querySelector<HTMLVideoElement>('video');
                if (preview) stopPreview(preview);
              }}
              className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-[#131722] border border-[#1F273A] cursor-pointer shadow-lg hover:border-[#6366F1] transition-all"
            >
              {v.videoUrl ? (
                <video
                  src={v.videoUrl}
                  poster={v.thumbnailUrl || undefined}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label={v.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <img src={v.thumbnailUrl} alt={v.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-between">
                <div className="flex justify-end">
                  <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20">
                    {v.views} views
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <img src={v.creatorAvatar} alt={v.creatorName} className="w-6 h-6 rounded-full border border-white/40 object-cover" />
                    <span className="text-xs font-bold text-white truncate">{v.creatorName}</span>
                  </div>
                  <p className="text-xs text-white/90 font-medium line-clamp-2 leading-snug">
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
          <TrendingUp className="w-5 h-5 text-[#06B6D4]" />
          <h2 className="text-xl font-bold text-white font-display">Trending Sounds</h2>
        </div>

        <div className="bg-[#131722] border border-[#1F273A] rounded-3xl p-4 divide-y divide-[#1F273A]">
          {tracks.slice(0, 4).map((t, idx) => (
            <div
              key={`trending-track-${t.id}-${idx}`}
              className="flex items-center justify-between py-3 px-2 hover:bg-[#1B2130] rounded-xl transition-colors group cursor-pointer"
              onClick={() => onPlayTrack(t)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-xs font-black text-[#64748B] w-4 text-center">{idx + 1}</span>
                <img src={t.coverUrl} alt={t.title} className="w-11 h-11 rounded-xl object-cover" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-[#6366F1] transition-colors truncate">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] truncate">{t.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="hidden sm:inline-block text-[11px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded-full">
                  {t.shortsCount || '12.4k Shorts'}
                </span>
                <button className="w-8 h-8 rounded-full bg-[#1B2130] group-hover:bg-[#6366F1] flex items-center justify-center text-white transition-colors">
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
