import React, { useState, useEffect } from 'react';
import { Heart, Bookmark, ListMusic, Plus, Play, Music2, Library } from 'lucide-react';
import { Track, ActiveTab } from '../../types';
import { musicApi } from '../../services/musicApi';
import { MediaLoadingState } from '../MediaLoadingState';

interface LibraryViewProps {
  onPlayTrack: (track: Track) => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onPlayTrack, onNavigate }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const fetched = await musicApi.getAllTracks();
        setTracks(fetched);
      } finally {
        setIsLoading(false);
      }
    };
    loadTracks();
  }, []);

  return (
    <div className="space-y-8 pb-28 pt-2 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-[#1F273A] pb-6">
        <div>
          <h1 className="text-3xl font-black text-white font-display tracking-tight">Your Library</h1>
          <p className="text-xs text-[#94A3B8] mt-1">Saved tracks, custom playlists, and listening history</p>
        </div>

        <button 
          onClick={() => onNavigate('music')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#131722] border border-[#1F273A] text-white text-xs font-semibold hover:border-[#6366F1]"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {isLoading && <MediaLoadingState />}

      {/* Liked Songs Banner */}
      <div 
        onClick={() => tracks[0] && onPlayTrack(tracks[0])}
        className="rounded-3xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] p-6 text-white shadow-xl flex items-center justify-between cursor-pointer hover:scale-101 transition-transform"
      >
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5 fill-white text-white" />
          </div>
          <h2 className="text-2xl font-black font-display">Liked Songs</h2>
          <p className="text-xs text-white/80">{tracks.length} tracks in your collection</p>
        </div>

        <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
          <Play className="w-5 h-5 fill-black ml-0.5" />
        </div>
      </div>

      {/* Library Tracks List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white font-display">Saved Songs</h3>
        <div className="bg-[#131722] border border-[#1F273A] rounded-3xl overflow-hidden divide-y divide-[#1F273A]">
          {tracks.map((t, idx) => (
            <div
              key={t.id}
              onClick={() => onPlayTrack(t)}
              className="flex items-center justify-between p-3.5 hover:bg-[#1B2130] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-xs font-bold text-[#64748B] w-5 text-center">{idx + 1}</span>
                <img src={t.coverUrl} alt={t.title} className="w-10 h-10 rounded-xl object-cover" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white group-hover:text-[#6366F1] transition-colors truncate">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] truncate">{t.artist}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4 fill-[#F43F5E] text-[#F43F5E]" />
                <span className="text-xs font-medium text-[#64748B] tabular-nums">{t.durationFormatted || '3:30'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
