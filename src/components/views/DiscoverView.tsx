import React, { useState, useEffect } from 'react';
import { Compass, Sparkles, TrendingUp, Play, Flame, Music2, Radio } from 'lucide-react';
import { Track, ActiveTab } from '../../types';
import { musicApi } from '../../services/musicApi';
import { MediaLoadingState } from '../MediaLoadingState';

interface DiscoverViewProps {
  onPlayTrack: (track: Track) => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onPlayTrack, onNavigate }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const fetched = await musicApi.getTrendingTracks();
        setTracks(fetched);
      } finally {
        setIsLoading(false);
      }
    };
    loadTracks();
  }, []);

  const categories = [
    { title: 'Synthwave & Cyberpunk', color: 'from-[#6366F1] to-[#8B5CF6]', count: '1.2k tracks' },
    { title: 'Ambient & Deep Chill', color: 'from-[#06B6D4] to-[#3B82F6]', count: '850 tracks' },
    { title: 'Future Bass & Beats', color: 'from-[#10B981] to-[#06B6D4]', count: '2.4k tracks' },
    { title: 'Lo-Fi Transmissions', color: 'from-[#F59E0B] to-[#F43F5E]', count: '3.1k tracks' },
  ];

  return (
    <div className="space-y-8 pb-28 pt-2 animate-in fade-in duration-300">
      <div className="border-b border-[#1F273A] pb-6">
        <h1 className="text-3xl font-black text-white font-display tracking-tight">Discover</h1>
        <p className="text-xs text-[#94A3B8] mt-1">Explore curated genres, rising audio artists, and viral sonic trends</p>
      </div>

      {isLoading && <MediaLoadingState />}

      {/* Genre Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat, idx) => (
          <div
            key={idx}
            className={`relative rounded-3xl p-6 bg-gradient-to-br ${cat.color} border border-white/10 shadow-xl overflow-hidden group cursor-pointer hover:scale-102 transition-transform`}
            onClick={() => onNavigate('music')}
          >
            <div className="relative z-10 space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/80 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20">
                {cat.count}
              </span>
              <h3 className="text-lg font-black text-white font-display">{cat.title}</h3>
            </div>
            <Radio className="absolute right-4 bottom-4 w-20 h-20 text-white/10 group-hover:scale-110 transition-transform" />
          </div>
        ))}
      </div>

      {/* Trending Audio Tracks Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white font-display">Rising Audio Discoveries</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tracks.slice(0, 6).map((t) => (
            <div
              key={t.id}
              onClick={() => onPlayTrack(t)}
              className="group bg-[#131722] hover:bg-[#1B2130] border border-[#1F273A] p-3 rounded-2xl cursor-pointer transition-all hover:scale-102"
            >
              <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                <img src={t.coverUrl} alt={t.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-[#6366F1] flex items-center justify-center text-white">
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="font-bold text-xs text-white truncate">{t.title}</div>
              <div className="text-[11px] text-[#94A3B8] truncate">{t.artist}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
