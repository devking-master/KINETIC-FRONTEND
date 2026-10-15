import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, Play, Radio, RefreshCw, Zap } from 'lucide-react';
import { Track, ActiveTab, ShortVideo } from '../../types';
import { musicApi } from '../../services/musicApi';
import { videoApi } from '../../services/videoApi';
import { authApi } from '../../services/authApi';
import { MediaLoadingState } from '../MediaLoadingState';
import { StateFeedback } from '../ui/StateFeedback';

interface DiscoverViewProps {
  onPlayTrack: (track: Track) => void;
  onNavigate: (tab: ActiveTab) => void;
  onOpenWatch: (video: ShortVideo) => void;
  onOpenProfile: (username: string) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onPlayTrack, onNavigate, onOpenWatch, onOpenProfile }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPersonalized, setIsPersonalized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWakingServer, setIsWakingServer] = useState(false);

  const loadRecommended = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await musicApi.getRecommended();
      setTracks(data.tracks);
      setIsPersonalized(data.personalized);
      setVideos(data.videos.filter((video): video is ShortVideo => !!video && typeof video === 'object' && 'id' in video) as ShortVideo[]);
    } catch (err) {
      setError('Unable to load recommendations. Check your connection and try again.');
      // Fallback to trending
      try {
        const trending = await musicApi.getTrendingTracks();
        setTracks(trending);
      } catch {
        setTracks([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecommended();
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

  const categories = [
    { title: 'Synthwave & Cyberpunk', color: 'from-[var(--accent)] to-[var(--accent)]', count: '1.2k tracks', icon: '🌐' },
    { title: 'Ambient & Deep Chill', color: 'from-[var(--accent)] to-[var(--accent-hover)]', count: '850 tracks', icon: '🌊' },
    { title: 'Future Bass & Beats', color: 'from-[var(--success)] to-[var(--accent)]', count: '2.4k tracks', icon: '🎛️' },
    { title: 'Lo-Fi Transmissions', color: 'from-[var(--warning)] to-[var(--like)]', count: '3.1k tracks', icon: '📻' },
  ];

  const isLoggedIn = !!authApi.getToken();

  return (
    <div className="space-y-8 pb-28 pt-2 animate-in fade-in duration-300">
      <div className="border-b border-[var(--border)] pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] font-display ">Discover</h1>
          <p className="text-xs text-[var(--muted)] mt-1">Explore curated genres, rising audio artists, and viral sonic trends</p>
        </div>
        <button
          onClick={loadRecommended}
          disabled={isLoading}
          title="Refresh recommendations"
          className="mt-1 p-2 rounded-full bg-[var(--raised)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error Banner */}
      {error && !isLoading && (
        <StateFeedback
          state="error"
          message="Couldn't load music. Check your connection and try again."
          action={{ label: 'Retry', onClick: () => { void loadRecommended(); } }}
        />
      )}

      {/* Genre Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat, idx) => (
          <div
            key={idx}
            className={`relative rounded-2xl p-6 bg-gradient-to-br ${cat.color} border border-white/10 shadow-xl overflow-hidden group cursor-pointer hover:scale-[1.02] transition-transform`}
            onClick={() => onNavigate('music')}
          >
            <div className="relative z-10 space-y-2">
              <span className="text-[10px] font-extrabold   text-[var(--text)]/80 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
                {cat.count}
              </span>
              <h3 className="text-lg font-black text-[var(--text)] font-display">{cat.title}</h3>
            </div>
            <span className="absolute right-5 bottom-4 text-5xl opacity-20 group-hover:opacity-40 transition-opacity">{cat.icon}</span>
            <Radio className="absolute right-4 bottom-4 w-20 h-20 text-[var(--text)]/10 group-hover:scale-110 transition-transform" />
          </div>
        ))}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="text-xl font-bold text-[var(--text)] font-display">Watch next</h2><p className="text-xs text-[var(--subtle)] mt-1">Short videos from creators and live providers</p></div>
          <button onClick={() => onNavigate('shorts')} className="text-xs font-bold text-[var(--accent-hover)]">Open Shorts</button>
        </div>
        {videos.length === 0 ? <div className="rounded-2xl border border-[var(--border)] bg-[var(--raised)] p-8 text-center text-xs text-[var(--subtle)]">No videos available right now.</div> : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{videos.slice(0, 8).map((video) => <button key={video.id} onClick={() => onOpenWatch(video)} className="group text-left"><div className="relative aspect-video rounded-2xl overflow-hidden bg-[var(--raised)] border border-[var(--border)]"><img src={video.thumbnailUrl} alt={video.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /><span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-9 h-9 text-[var(--text)] fill-white" /></span><span className="absolute right-2 bottom-2 text-[10px] font-bold text-[var(--text)] bg-black/70 px-2 py-0.5 rounded-full">{Math.round(video.duration)}s</span></div><span className="flex items-center gap-2 mt-2"><img src={video.creatorAvatar} alt="" className="w-6 h-6 rounded-full object-cover" /><span className="text-xs font-bold text-[var(--text)] truncate hover:underline" onClick={(event) => { event.stopPropagation(); onOpenProfile(video.creatorHandle.replace(/^@/, '')); }}>{video.creatorName}</span></span><span className="block text-xs text-[var(--muted)] line-clamp-2 mt-1">{video.caption}</span></button>)}</div>}
      </section>

      {/* Recommended/Trending Track Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {isPersonalized ? (
            <>
              <Sparkles className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="text-xl font-bold text-[var(--text)] font-display">For You</h2>
              <span className="text-[10px] font-bold   bg-gradient-to-r from-[var(--accent)] to-[var(--accent)] text-[var(--text)] px-2.5 py-0.5 rounded-full">
                Personalized
              </span>
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 text-[var(--warning)]" />
              <h2 className="text-xl font-bold text-[var(--text)] font-display">Rising Discoveries</h2>
              {!isLoggedIn && (
                <button
                  onClick={() => onNavigate('auth')}
                  className="text-[10px] font-bold text-[var(--accent)] hover:underline ml-1"
                >
                  Sign in for personalized picks →
                </button>
              )}
            </>
          )}
        </div>

        {isLoading ? (
          <div>
            <MediaLoadingState compact />
            {isWakingServer && <p className="-mt-6 pb-6 text-center text-xs text-[var(--muted)]">Waking up the server, this can take a few seconds</p>}
          </div>
        ) : tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Radio className="w-12 h-12 text-[var(--border)] mb-4" />
            <p className="text-sm font-bold text-[var(--subtle)]">No tracks found yet</p>
            <p className="text-xs text-[var(--subtle)] mt-1">Upload music or check back later</p>
            <button
              onClick={() => onNavigate('creator-studio')}
              className="mt-4 px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--text)] text-xs font-bold hover:bg-[var(--accent)] transition-colors"
            >
              Start Uploading
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {tracks.slice(0, 12).map((t, i) => (
              <div
                key={t.id}
                onClick={() => onPlayTrack(t)}
                className="group bg-[var(--raised)] hover:bg-[var(--raised)] border border-[var(--border)] p-3 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] hover:border-[var(--accent)]/40"
              >
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                  <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--text)]">
                      <Play className="w-4 h-4 fill-white ml-0.5" />
                    </div>
                  </div>
                  {/* Source badge */}
                  {t.source === 'api' && (
                    <span className="absolute top-1.5 left-1.5 text-[8px] font-bold bg-black/60 backdrop-blur-sm text-[var(--muted)] px-1.5 py-0.5 rounded-full">
                      Jamendo
                    </span>
                  )}
                  {t.source === 'user' && (
                    <span className="absolute top-1.5 left-1.5 text-[8px] font-bold bg-gradient-to-r from-[var(--accent)]/80 to-[var(--accent)]/80 backdrop-blur-sm text-[var(--text)] px-1.5 py-0.5 rounded-full">
                      ✦ Original
                    </span>
                  )}
                  {/* Personalized rank badge */}
                  {isPersonalized && i < 3 && (
                    <span className="absolute bottom-1.5 right-1.5 text-[8px] font-bold bg-[var(--warning)]/90 text-black px-1.5 py-0.5 rounded-full">
                      ★ Picked
                    </span>
                  )}
                </div>
                <div className="font-bold text-xs text-[var(--text)] truncate">{t.title}</div>
                <div className="text-[11px] text-[var(--muted)] truncate">{t.artist}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
