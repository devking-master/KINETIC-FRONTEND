import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, Heart, MoreHorizontal, Music2, Share2, Filter, Disc, Plus, Search } from '../ui/Icon';
import { Track, ActiveTab } from '../../types';
import { clearTrackCache, musicApi } from '../../services/musicApi';
import { MediaLoadingState } from '../MediaLoadingState';
import { StateFeedback } from '../ui/StateFeedback';
import { Card } from '../ui/Card';
import { TrackLibrary, sumDurations } from '../../services/dsa';
import { html5Player } from '../../services/html5Player';

interface MusicViewProps {
  onPlayTrack: (track: Track, context?: Track[]) => void;
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
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'shortest' | 'longest' | 'title'>('default');

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

  const filteredTracks = useMemo(
    () => (activeGenre === 'All' ? tracks : tracks.filter((t) => t.genre?.toLowerCase().includes(activeGenre.toLowerCase()))),
    [tracks, activeGenre],
  );

  // The visible list is built with the Spotify Lite library: sorted with bubble sort (by duration or title),
  // searched with linear search, or binary search for the exact title when the list is sorted A to Z.
  const library = useMemo(() => {
    const lib = new TrackLibrary<Track>();
    for (let i = 0; i < filteredTracks.length; i++) lib.addSong(filteredTracks[i]);
    if (sortMode === 'shortest') lib.sortByDuration();
    else if (sortMode === 'longest') lib.sortByDuration(true);
    else if (sortMode === 'title') lib.sortByTitleAlphabetical();
    return lib;
  }, [filteredTracks, sortMode]);

  const visibleTracks = useMemo(
    () => (query.trim() ? library.search(query) : library.toArray()),
    [library, query],
  );

  const totalMinutes = Math.round(sumDurations(visibleTracks) / 60);
  const totalLabel = totalMinutes < 60 ? `${totalMinutes} min` : `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`;

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
              onClick={() => onPlayTrack(tracks[0], tracks)}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--text)] font-display">Popular Tracks</h3>
            <p className="text-[11px] text-[var(--muted)] tabular-nums">
              {visibleTracks.length} {visibleTracks.length === 1 ? 'track' : 'tracks'}
              {visibleTracks.length > 0 ? ` · ${totalLabel}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--subtle)]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or artist"
                aria-label="Search these tracks"
                className="w-44 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-xs text-[var(--text)] placeholder:text-[var(--subtle)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15 sm:w-56"
              />
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
              aria-label="Sort tracks"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15"
            >
              <option value="default">Default order</option>
              <option value="shortest">Shortest first</option>
              <option value="longest">Longest first</option>
              <option value="title">Title A to Z</option>
            </select>
          </div>
        </div>

        <div className="bg-[var(--raised)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {visibleTracks.length === 0 && query.trim() !== '' && (
            <div className="p-8 text-center text-xs text-[var(--subtle)]">No tracks match “{query.trim()}”.</div>
          )}
          {visibleTracks.map((t, idx) => {
            const isCurrent = currentTrack.id === t.id;
            const isLiked = likedMap[t.id] ?? t.isLiked;

            return (
              <div
                key={t.id}
                className={`flex items-center justify-between p-3.5 hover:bg-[var(--raised)] transition-colors group cursor-pointer ${
                  isCurrent ? 'bg-[var(--accent)]/10' : ''
                }`}
                onClick={() => onPlayTrack(t, visibleTracks)}
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
                    title="Add to queue"
                    aria-label={`Add ${t.title} to queue`}
                    onClick={(e) => { e.stopPropagation(); html5Player.enqueue(t); }}
                    className="p-1.5 rounded-full text-[var(--subtle)] transition-colors hover:text-[var(--text)]"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
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
