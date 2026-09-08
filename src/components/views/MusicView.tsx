import React, { useState, useEffect } from 'react';
import { Play, Pause, Heart, MoreHorizontal, Music2, Share2, Sparkles, Filter, Disc } from 'lucide-react';
import { Track, ActiveTab } from '../../types';
import { musicApi } from '../../services/musicApi';
import { MediaLoadingState } from '../MediaLoadingState';

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

  const genres = ['All', 'Synthwave', 'Ambient', 'Future Bass', 'Lo-Fi', 'Electronic'];

  const filteredTracks = activeGenre === 'All' 
    ? tracks 
    : tracks.filter(t => t.genre?.toLowerCase().includes(activeGenre.toLowerCase()));

  const toggleLike = (id: string) => {
    setLikedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-8 pb-28 pt-2 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1F273A] pb-6">
        <div>
          <h1 className="text-3xl font-black text-white font-display tracking-tight">Music Catalog</h1>
          <p className="text-xs text-[#94A3B8] mt-1">Explore lossless master tracks, user uploads, and API discoveries</p>
        </div>

        {/* Genre Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1">
          {genres.map(g => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeGenre === g
                  ? 'bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/30'
                  : 'bg-[#131722] text-[#94A3B8] border border-[#1F273A] hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <MediaLoadingState />
      )}

      {/* Featured Track Card */}
      {tracks[0] && (
        <div className="relative rounded-3xl bg-gradient-to-r from-[#131722] via-[#1B2130] to-[#0D1017] border border-[#1F273A] p-6 flex flex-col md:flex-row items-center gap-6 shadow-xl">
          <img src={tracks[0].coverUrl} alt={tracks[0].title} className="w-40 h-40 rounded-2xl object-cover shadow-2xl border border-[#1F273A]" />
          
          <div className="flex-1 space-y-3 text-center md:text-left">
            <span className="text-[10px] font-bold text-[#6366F1] uppercase tracking-wider bg-[#6366F1]/10 px-3 py-1 rounded-full border border-[#6366F1]/30">
              FEATURED RELEASE
            </span>
            <h2 className="text-2xl font-black text-white font-display">{tracks[0].title}</h2>
            <p className="text-xs text-[#94A3B8] max-w-md">{tracks[0].artist} • {tracks[0].album}</p>

            <button
              onClick={() => onPlayTrack(tracks[0])}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#6366F1] hover:bg-[#8B5CF6] text-white font-bold text-xs shadow-lg shadow-[#6366F1]/30 transition-all hover:scale-105"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Play Featured Track</span>
            </button>
          </div>
        </div>
      )}

      {/* Tracks Table */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-white font-display">Popular Tracks</h3>

        <div className="bg-[#131722] border border-[#1F273A] rounded-3xl overflow-hidden divide-y divide-[#1F273A]">
          {filteredTracks.map((t, idx) => {
            const isCurrent = currentTrack.id === t.id;
            const isLiked = likedMap[t.id] ?? t.isLiked;

            return (
              <div
                key={t.id}
                className={`flex items-center justify-between p-3.5 hover:bg-[#1B2130] transition-colors group cursor-pointer ${
                  isCurrent ? 'bg-[#6366F1]/10' : ''
                }`}
                onClick={() => onPlayTrack(t)}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="text-xs font-black text-[#64748B] w-5 text-center">{idx + 1}</span>
                  <img src={t.coverUrl} alt={t.title} className="w-11 h-11 rounded-xl object-cover shadow" />
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-bold truncate ${isCurrent ? 'text-[#A5B4FC]' : 'text-white'}`}>
                      {t.title}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] truncate">{t.artist}</div>
                  </div>
                </div>

                <div className="hidden md:block flex-1 text-xs text-[#94A3B8] truncate">
                  {t.album}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(t.id); }}
                    className={`p-1.5 rounded-full transition-colors ${
                      isLiked ? 'text-[#F43F5E]' : 'text-[#64748B] hover:text-white'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-[#F43F5E]' : ''}`} />
                  </button>

                  <span className="text-xs font-medium text-[#64748B] tabular-nums">
                    {t.durationFormatted || '3:30'}
                  </span>

                  <button 
                    onClick={(e) => { e.stopPropagation(); onOpenShareModal(t.title); }}
                    className="p-1.5 text-[#64748B] hover:text-white rounded-full"
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
