import React from 'react';
import { Home, Compass, Plus, Library, User, Video, Music2 } from '../ui/Icon';
import { ActiveTab, AuthUser } from '../../types';

interface MobileNavProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onOpenUploadModal: () => void;
  currentUser: AuthUser | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onNavigate,
  onOpenUploadModal,
  currentUser,
  onOpenAuth,
  onOpenProfile,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg)]/90 backdrop-blur-xl border-t border-[var(--border)] px-2 py-2 flex items-center justify-around">
      {/* Home */}
      <button
        onClick={() => onNavigate('home')}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'home' ? 'text-[var(--accent)]' : 'text-[var(--subtle)] hover:text-[var(--text)]'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-bold ">Home</span>
      </button>

      {/* Discover / Shorts */}
      <button
        onClick={() => onNavigate('shorts')}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'shorts' ? 'text-[var(--accent)]' : 'text-[var(--subtle)] hover:text-[var(--text)]'
        }`}
      >
        <Video className="w-5 h-5" />
        <span className="text-[10px] font-bold ">Shorts</span>
      </button>

      {/* Center Create Button */}
      <button
        onClick={onOpenUploadModal}
        className="w-12 h-12 -mt-4 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--text)] shadow-xl border-2 border-[var(--bg)] active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Music */}
      <button
        onClick={() => onNavigate('music')}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'music' ? 'text-[var(--accent)]' : 'text-[var(--subtle)] hover:text-[var(--text)]'
        }`}
      >
        <Music2 className="w-5 h-5" />
        <span className="text-[10px] font-bold ">Music</span>
      </button>

      {/* Library / Profile */}
      <button
        onClick={() => {
          if (currentUser) {
            onOpenProfile();
          } else {
            onOpenAuth();
          }
        }}
        className={`flex flex-col items-center gap-1 px-3 py-1 transition-all ${
          activeTab === 'library' || activeTab === 'profile' || activeTab === 'auth' ? 'text-[var(--accent)]' : 'text-[var(--subtle)] hover:text-[var(--text)]'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] font-bold ">
          {currentUser ? 'Profile' : 'Sign In'}
        </span>
      </button>
    </nav>
  );
};
