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
  Sparkles
} from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1F273A] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#6366F1]" />
            <h1 className="text-3xl font-black text-white font-display tracking-tight">Creator Studio Workspace</h1>
          </div>
          <p className="text-xs text-[#94A3B8] mt-1">Manage your catalog, inspect audience analytics, and upload new media</p>
        </div>

        <button
          onClick={onOpenUploadModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-[#6366F1]/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Media</span>
        </button>
      </div>

      {/* Subtab navigation */}
      <div className="flex gap-2 border-b border-[#1F273A] pb-3">
        {(['overview', 'content', 'analytics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
              activeSubTab === tab
                ? 'bg-[#1B2130] text-white border border-[#6366F1]'
                : 'text-[#94A3B8] hover:text-white hover:bg-[#131722]'
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
            <div className="bg-[#131722] border border-[#1F273A] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-bold uppercase tracking-wider">Total Video Views</span>
                <Eye className="w-4 h-4 text-[#6366F1]" />
              </div>
              <div className="text-2xl font-black text-white font-display">861.4K</div>
              <div className="text-[10px] font-semibold text-[#10B981]">+14.2% from last month</div>
            </div>

            <div className="bg-[#131722] border border-[#1F273A] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-bold uppercase tracking-wider">Track Plays</span>
                <Music className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <div className="text-2xl font-black text-white font-display">1.42M</div>
              <div className="text-[10px] font-semibold text-[#10B981]">+28.5% from last month</div>
            </div>

            <div className="bg-[#131722] border border-[#1F273A] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-bold uppercase tracking-wider">Total Likes</span>
                <Heart className="w-4 h-4 text-[#F43F5E]" />
              </div>
              <div className="text-2xl font-black text-[#F43F5E] font-display">170.1K</div>
              <div className="text-[10px] font-semibold text-[#10B981]">+8.1% from last month</div>
            </div>

            <div className="bg-[#131722] border border-[#1F273A] p-5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[#64748B]">
                <span className="text-xs font-bold uppercase tracking-wider">Followers</span>
                <Users className="w-4 h-4 text-[#06B6D4]" />
              </div>
              <div className="text-2xl font-black text-white font-display">32.8K</div>
              <div className="text-[10px] font-semibold text-[#10B981]">+1,240 new followers</div>
            </div>
          </div>
        </div>
      )}

      {/* Content Catalog Table */}
      <div className="bg-[#131722] border border-[#1F273A] rounded-3xl p-4 space-y-4">
        <h3 className="text-sm font-bold text-white font-display px-2">Published Media Catalog</h3>

        <div className="divide-y divide-[#1F273A]">
          {contentItems.map(item => (
            <div key={item.id} className="flex items-center justify-between py-3 px-2 hover:bg-[#1B2130] rounded-xl transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <img src={item.thumbnail} alt={item.title} className="w-12 h-12 rounded-xl object-cover" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{item.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-[#6366F1] bg-[#6366F1]/10 px-2 py-0.5 rounded">
                      {item.type}
                    </span>
                    <span className="text-[10px] text-[#64748B]">{item.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  item.status === 'Published'
                    ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                    : 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                }`}>
                  {item.status}
                </span>

                <div className="hidden sm:block text-right text-xs">
                  <div className="font-bold text-white">{item.views}</div>
                  <div className="text-[10px] text-[#64748B]">{item.likes} likes</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
