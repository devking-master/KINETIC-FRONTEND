import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Film, 
  Music, 
  TrendingUp, 
  Eye, 
  Heart, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BarChart3,
  Layers,
  LayoutDashboard
} from '../ui/Icon';
import { ActiveTab } from '../../types';
import { videoApi } from '../../services/videoApi';
import { musicApi } from '../../services/musicApi';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  status: string;
  views: string;
  likes: string;
  date: string;
  thumbnail: string;
}

interface CreatorStudioViewProps {
  onOpenUploadModal: () => void;
  onNavigate: (tab: ActiveTab) => void;
}

export const CreatorStudioView: React.FC<CreatorStudioViewProps> = ({
  onOpenUploadModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'content' | 'analytics'>('overview');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    if (activeSubTab !== 'content' && contentItems.length > 0) return;

    const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString() : '-';
    const loadContent = async () => {
      const [videos, tracks] = await Promise.all([videoApi.getMyVideos(), musicApi.getMyTracks()]);
      setContentItems([
        ...videos.map((video) => ({
          id: video.id,
          title: video.caption,
          type: 'SHORT VIDEO',
          status: 'Published',
          views: video.views || '0',
          likes: video.likes || '0',
          date: formatDate(video.createdAt),
          thumbnail: video.thumbnailUrl,
        })),
        ...tracks.map((track) => ({
          id: track.id,
          title: track.title,
          type: 'MASTER AUDIO',
          status: 'Published',
          views: String(track.playsCount || 0),
          likes: String(track.likesCount || 0),
          date: formatDate(track.createdAt),
          thumbnail: track.coverUrl,
        })),
      ]);
    };

    loadContent().catch(() => setContentItems([]));
  }, [activeSubTab]);

  return (
    <div className="space-y-8 pb-28 pt-2 animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-[var(--accent)]" />
            <h1 className="text-3xl font-black text-[var(--text)] font-display ">Studio</h1>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">Your uploads and how they are doing.</p>
        </div>

        <button
          onClick={onOpenUploadModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] hover:brightness-110 text-[var(--text)] font-bold text-xs shadow-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Media</span>
        </button>
      </div>

      {/* Subtab navigation */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-3">
        {(['overview', 'content', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              activeSubTab === tab
                ? 'bg-[var(--raised)] text-[var(--text)] border border-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab Stats */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--raised)] border border-[var(--border)] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[var(--subtle)]">
                <span className="text-xs font-bold  ">Total Video Views</span>
                <Eye className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div className="text-2xl font-black text-[var(--text)] font-display">861.4K</div>
              <div className="text-[10px] font-semibold text-[var(--success)]">+14.2% from last month</div>
            </div>

            <div className="bg-[var(--raised)] border border-[var(--border)] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[var(--subtle)]">
                <span className="text-xs font-bold  ">Track Plays</span>
                <Music className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div className="text-2xl font-black text-[var(--text)] font-display">1.42M</div>
              <div className="text-[10px] font-semibold text-[var(--success)]">+28.5% from last month</div>
            </div>

            <div className="bg-[var(--raised)] border border-[var(--border)] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[var(--subtle)]">
                <span className="text-xs font-bold  ">Total Likes</span>
                <Heart className="w-4 h-4 text-[var(--like)]" />
              </div>
              <div className="text-2xl font-black text-[var(--like)] font-display">170.1K</div>
              <div className="text-[10px] font-semibold text-[var(--success)]">+8.1% from last month</div>
            </div>

            <div className="bg-[var(--raised)] border border-[var(--border)] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[var(--subtle)]">
                <span className="text-xs font-bold  ">Followers</span>
                <Users className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div className="text-2xl font-black text-[var(--text)] font-display">32.8K</div>
              <div className="text-[10px] font-semibold text-[var(--success)]">+1,240 new followers</div>
            </div>
          </div>
        </div>
      )}

      {/* Content Catalog Table */}
      <div className="bg-[var(--raised)] border border-[var(--border)] rounded-2xl p-4 space-y-4">
        <h3 className="text-sm font-bold text-[var(--text)] font-display px-2">Your uploads</h3>

        <div className="divide-y divide-[var(--border)]">
          {contentItems.map(item => (
            <div key={item.id} className="flex items-center justify-between py-3 px-2 hover:bg-[var(--raised)] rounded-xl transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <img src={item.thumbnail} alt={item.title} className="w-12 h-12 rounded-xl object-cover" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text)] truncate">{item.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-lg">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-[var(--subtle)]">{item.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  item.status === 'Published'
                    ? 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30'
                    : 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/30'
                }`}>
                  {item.status}
                </span>

                <div className="hidden sm:block text-right text-xs">
                  <div className="font-bold text-[var(--text)]">{item.views}</div>
                  <div className="text-[10px] text-[var(--subtle)]">{item.likes} likes</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
