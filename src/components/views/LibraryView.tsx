import React, { useState, useEffect } from 'react';
import { Heart, Bookmark, ListMusic, Plus, Play, Music2, Library } from 'lucide-react';
import { Track, ActiveTab } from '../../types';
import { musicApi } from '../../services/musicApi';
import { MediaLoadingState } from '../MediaLoadingState';
import { StateFeedback } from '../ui/StateFeedback';

interface LibraryViewProps {
  onPlayTrack: (track: Track) => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onPlayTrack, onNavigate }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
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

  return (
    <div className="space-y-8 pb-28 pt-2 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] font-display ">Your Library</h1>
          <p className="text-xs text-[var(--muted)] mt-1">Saved tracks, custom playlists, and listening history</p>
        </div>

        <button 
          onClick={() => onNavigate('music')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--raised)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold hover:border-[var(--accent)]"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {isLoading && (
        <div>
          <MediaLoadingState />
          {isWakingServer && <p className="-mt-10 pb-8 text-center text-xs text-[var(--muted)]">Waking up the server, this can take a few seconds</p>}
        </div>
      )}
      {hasLoadError && !isLoading && (
        <StateFeedback
          state="error"
          message="Couldn't load music. Check your connection and try again."
          action={{ label: 'Retry', onClick: () => { void loadTracks(); } }}
        />
      )}

      {/* Liked Songs Banner */}
      <div 
        onClick={() => tracks[0] && onPlayTrack(tracks[0])}
        className="rounded-2xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent)] p-6 text-[var(--text)] shadow-xl flex items-center justify-between cursor-pointer hover:scale-101 transition-transform"
      >
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5 fill-white text-[var(--text)]" />
          </div>
          <h2 className="text-2xl font-black font-display">Liked Songs</h2>
          <p className="text-xs text-[var(--text)]/80">{tracks.length} tracks in your collection</p>
        </div>

        <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
          <Play className="w-5 h-5 fill-black ml-0.5" />
        </div>
      </div>

      {/* Library Tracks List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-[var(--text)] font-display">Saved Songs</h3>
        <div className="bg-[var(--raised)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]">
          {tracks.map((t, idx) => (
            <div
              key={t.id}
              onClick={() => onPlayTrack(t)}
              className="flex items-center justify-between p-3.5 hover:bg-[var(--raised)] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-xs font-bold text-[var(--subtle)] w-5 text-center">{idx + 1}</span>
                <img src={t.coverUrl} alt={t.title} className="w-10 h-10 rounded-xl object-cover" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors truncate">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] truncate">{t.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4 fill-[var(--like)] text-[var(--like)]" />
                <span className="text-xs font-medium text-[var(--subtle)] tabular-nums">{t.durationFormatted || '3:30'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
