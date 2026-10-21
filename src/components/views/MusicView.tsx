import React, { useState, useEffect } from 'react';
import { Play, Pause, Heart, MoreHorizontal, Music2, Share2, Filter, Disc } from '../ui/Icon';
import { Track, ActiveTab } from '../../types';
import { clearTrackCache, musicApi } from '../../services/musicApi';
import { MediaLoadingState } from '../MediaLoadingState';
import { StateFeedback } from '../ui/StateFeedback';
import { Card } from '../ui/Card';

interface MusicViewProps {
  onPlayTrack: (track: Track) => void;
  onNavigate: (tab: ActiveTab) => void;
  onOpenShareModal: (title: string) => void;
  currentTrack: Track;
  isPlaying: boolean;
}

export const MusicView: React.FC<MusicViewProps> = ({
  onPlayTrack,
  onOpenShareModal,
  currentTrack,
  isPlaying,
}) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeGenre, setActiveGenre] = useState('All');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const loadTracks = async () => {
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const fetched = await musicApi.getAllTracks();
      setTracks(fetched);
    } catch {
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTracks();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setIsWakingServer(false);
      return;
    }
    const timer = setTimeout(() => setIsWakingServer(true), 4000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const genres = ['All', 'Synthwave', 'Ambient', 'Future Bass', 'Lo-Fi', 'Electronic'];

  const filteredTracks = activeGenre === 'All' 
    ? tracks 
    : tracks.filter(t => t.genre?.toLowerCase().includes(activeGenre.toLowerCase()));

  const toggleLike = async (track: Track) => {
    if (track.source === 'api' || !/^[a-f\d]{24}$/i.test(track.id)) return;
    const previous = likedMap[track.id] ?? !!track.isLiked;
    const desired = !previous;
    setLikedMap((state) => ({ ...state, [track.id]: desired }));
    try {
      const result = await musicApi.setLike(track.id, desired);
      setLikedMap((state) => ({ ...state, [track.id]: result.liked }));
      clearTrackCache();
    } catch {
      setLikedMap((state) => ({ ...state, [track.id]: previous }));
    }
  };

  return (
    <div className="space-y-8 pb-28 pt-2 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] font-display ">Music</h1>
          <p className="text-xs text-[var(--muted)] mt-1">New uploads from creators, plus free music from Jamendo.</p>
        </div>

        {/* Genre Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1">
          {genres.map(g => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeGenre === g
                  ? 'bg-[var(--accent)] text-[var(--text)] shadow-md'
                  : 'bg-[var(--raised)] text-[var(--muted)] border border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

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
          action={{ label: 'Retry', onClick: () => { void loadTracks(); } }}
        />
      )}

      {/* Featured Track Card */}
      {tracks[0] && (
        <Card className="relative rounded-2xl bg-[var(--raised)] border border-[var(--border)] p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl">
          <img src={tracks[0].coverUrl} alt={tracks[0].title} className="w-40 h-40 rounded-2xl object-cover shadow-2xl border border-[var(--border)]" />
          
          <div className="flex-1 space-y-3 text-center md:text-left">
            <span className="text-[10px] font-bold text-[var(--accent)]   bg-[var(--accent)]/10 px-3 py-1 rounded-full border border-[var(--accent)]/30">
              FEATURED RELEASE
            </span>
            <h2 className="text-2xl font-black text-[var(--text)] font-display">{tracks[0].title}</h2>
            <p className="text-xs text-[var(--muted)] max-w-md">{tracks[0].artist} • {tracks[0].album}</p>

            <button
              onClick={() => onPlayTrack(tracks[0])}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--accent)] hover:bg-[var(--accent)] text-[var(--text)] font-bold text-xs shadow-lg transition-all hover:scale-105"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play Featured Track</span>
            </button>
          </div>
        </Card>
      )}

      {/* Tracks Table */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-[var(--text)] font-display">Popular Tracks</h3>

        <div className="bg-[var(--raised)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {filteredTracks.map((t, idx) => {
            const isCurrent = currentTrack.id === t.id;
            const isLiked = likedMap[t.id] ?? t.isLiked;

            return (
              <div
                key={t.id}
                className={`flex items-center justify-between p-3.5 hover:bg-[var(--raised)] transition-colors group cursor-pointer ${
                  isCurrent ? 'bg-[var(--accent)]/10' : ''
                }`}
                onClick={() => onPlayTrack(t)}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="text-xs font-black text-[var(--subtle)] w-5 text-center">{idx + 1}</span>
                  <img src={t.coverUrl} alt={t.title} className="w-11 h-11 rounded-xl object-cover shadow" />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold truncate ${isCurrent ? 'text-[var(--accent-hover)]' : 'text-[var(--text)]'}`}>
                      {t.title}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate">{t.artist}</div>
                  </div>
                </div>

                <div className="hidden md:block flex-1 text-xs text-[var(--muted)] truncate">
                  {t.album}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    disabled={t.source === 'api' || !/^[a-f\d]{24}$/i.test(t.id)}
                    title={t.source === 'api' || !/^[a-f\d]{24}$/i.test(t.id) ? 'Sample track' : 'Like track'}
                    onClick={(e) => { e.stopPropagation(); void toggleLike(t); }}
                    className={`p-1.5 rounded-full transition-colors ${
                      isLiked ? 'text-[var(--like)]' : 'text-[var(--subtle)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-[var(--like)]' : ''}`} />
                  </button>

                  <span className="text-xs font-medium text-[var(--subtle)] tabular-nums">
                    {t.durationFormatted || '3:30'}
                  </span>

                  <button 
                    onClick={(e) => { e.stopPropagation(); onOpenShareModal(t.title); }}
                    className="p-1.5 text-[var(--subtle)] hover:text-[var(--text)] rounded-full"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
