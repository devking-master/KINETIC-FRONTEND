import React from 'react';
import { Home, Compass, Plus, Library, User, Video, Music2 } from 'lucide-react';
import { ActiveTab, AuthUser } from '../../types';

interface MobileNavProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onOpenUploadModal: () => void;
  currentUser: AuthUser | null;
  onOpenAuth: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onNavigate,
  onOpenUploadModal,
  currentUser,
  onOpenAuth,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#080A0F]/90 backdrop-blur-xl border-t border-[#1F273A] px-2 py-2 flex items-center justify-around">
      {/* Home */}
      <button
        onClick={() => onNavigate('home')}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'home' ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-bold tracking-tight">Home</span>
      </button>

      {/* Discover / Shorts */}
      <button
        onClick={() => onNavigate('shorts')}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'shorts' ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
        }`}
      >
        <Video className="w-5 h-5" />
        <span className="text-[10px] font-bold tracking-tight">Shorts</span>
      </button>

      {/* Center Create Button */}
      <button
        onClick={onOpenUploadModal}
        className="w-12 h-12 -mt-4 rounded-full bg-gradient-to-tr from-[#6366F1] via-[#8B5CF6] to-[#06B6D4] flex items-center justify-center text-white shadow-xl shadow-[#6366F1]/40 border-2 border-[#080A0F] active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Music */}
      <button
        onClick={() => onNavigate('music')}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'music' ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
        }`}
      >
        <Music2 className="w-5 h-5" />
        <span className="text-[10px] font-bold tracking-tight">Music</span>
      </button>

      {/* Library / Profile */}
      <button
        onClick={() => {
          if (currentUser) {
            onNavigate('library');
          } else {
            onOpenAuth();
          }
        }}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'library' || activeTab === 'auth' ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-bold tracking-tight">
          {currentUser ? 'Library' : 'Sign In'}
        </span>
      </button>
    </nav>
  );
};
