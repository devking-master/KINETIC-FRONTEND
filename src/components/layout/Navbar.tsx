import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Sparkles, 
  Plus, 
  Bell, 
  User as UserIcon, 
  Music2, 
  Video, 
  Compass, 
  Home, 
  Library, 
  Radio,
  X,
  ChevronDown,
  LogOut,
  Loader2
} from 'lucide-react';
import { ActiveTab, AuthUser, Track } from '../../types';
import { musicApi } from '../../services/musicApi';
import { KineticLogo } from '../KineticLogo';

interface NavbarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onOpenUploadModal: () => void;
  onPlayTrack?: (track: Track) => void;
  currentUser: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => Promise<void> | void;
  isPlaying?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenUploadModal,
  onPlayTrack,
  currentUser,
  onOpenAuth,
  onLogout,
  isPlaying,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ tracks: Track[]; videos: unknown[] }>({ tracks: [], videos: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showCompactMenu, setShowCompactMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
      setShowCompactMenu(false);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ tracks: [], videos: [] });
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await musicApi.searchMusic(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
      setShowSearchDropdown(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'discover', label: 'Discover', icon: <Compass className="w-4 h-4" /> },
    { id: 'shorts', label: 'Shorts', icon: <Video className="w-4 h-4" /> },
    { id: 'music', label: 'Music', icon: <Music2 className="w-4 h-4" /> },
    { id: 'library', label: 'Library', icon: <Library className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#080A0F]/85 backdrop-blur-xl border-b border-[#1F273A] px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand Identity Logo */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 group text-left focus:outline-none"
          >
            <KineticLogo size="md" animated />
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#131722] p-1 rounded-full border border-[#1F273A]">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/30'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#1B2130]'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center: Global Search Input */}
        <div className="relative flex-1 max-w-md hidden lg:block">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracks, creators, short videos..."
              className="w-full bg-[#131722] border border-[#1F273A] rounded-full pl-10 pr-9 py-2 text-xs font-medium text-white placeholder-[#64748B] focus:outline-none focus:border-[#6366F1] transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Predictive Search Dropdown */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#131722] border border-[#1F273A] rounded-2xl shadow-2xl overflow-hidden z-50 p-2 space-y-2 animate-in fade-in slide-in-from-top-2">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-[#94A3B8]">Searching Kinetic index...</div>
              ) : searchResults.tracks.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#94A3B8]">No results found for "{searchQuery}"</div>
              ) : (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] px-3 py-1">
                    Songs & Sounds
                  </div>
                  {searchResults.tracks.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (onPlayTrack) onPlayTrack(t);
                        setShowSearchDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#1B2130] text-left transition-colors"
                    >
                      <img src={t.coverUrl} alt={t.title} className="w-9 h-9 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{t.title}</div>
                        <div className="text-[11px] text-[#94A3B8] truncate">{t.artist}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-[#6366F1] bg-[#6366F1]/10 px-2 py-0.5 rounded-full">
                        Play
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions: Live Audio Indicator, Upload, Studio, Profile */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Live Playing Spectrum Bar Mini Indicator */}
          {isPlaying && (
            <div className="hidden lg:flex items-center gap-1 bg-[#6366F1]/10 border border-[#6366F1]/30 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-3 bg-[#6366F1] rounded-full equalizer-bar-1" />
              <span className="w-1.5 h-4 bg-[#8B5CF6] rounded-full equalizer-bar-2" />
              <span className="w-1.5 h-2 bg-[#06B6D4] rounded-full equalizer-bar-3" />
              <span className="text-[11px] font-bold text-[#A5B4FC] ml-1">Live Playing</span>
            </div>
          )}

          {/* Quick Create Button */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:brightness-110 text-white font-semibold text-xs shadow-md shadow-[#6366F1]/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {/* Creator Studio Link */}
          <button
            onClick={() => onNavigate('creator-studio')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeTab === 'creator-studio'
                ? 'bg-[#1B2130] text-white border-[#6366F1]'
                : 'bg-[#131722] text-[#94A3B8] border-[#1F273A] hover:text-white hover:border-[#2D374E]'
            }`}
          >
            Studio
          </button>

          {/* User Auth Profile Trigger */}
          <button
            onClick={() => {
              if (currentUser) {
                onNavigate('auth');
              } else {
                onOpenAuth();
              }
            }}
            className="flex items-center gap-2 p-1 rounded-full bg-[#131722] border border-[#1F273A] hover:border-[#6366F1] transition-all"
          >
            {currentUser ? (
              <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#1B2130] flex items-center justify-center text-[#94A3B8]">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
          </button>
        </div>

        {/* Tablet/mobile: keep the header focused on the brand and profile menu */}
        <div className="flex items-center gap-2 lg:hidden">
          <div className="relative">
            <button
              onClick={() => setShowSearchDropdown((isOpen) => !isOpen)}
              aria-expanded={showSearchDropdown}
              aria-label="Search"
              className="p-2 rounded-full text-[#94A3B8] hover:text-white hover:bg-[#1B2130] transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>

            {showSearchDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-5rem)] bg-[#131722] border border-[#1F273A] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748B]" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-[#0F131B] border border-[#1F273A] rounded-lg pl-8 pr-2.5 py-2 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#6366F1] transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowCompactMenu((isOpen) => !isOpen)}
              aria-expanded={showCompactMenu}
              aria-label="Open navigation menu"
              className="flex items-center gap-1 p-1 rounded-full bg-[#131722] border border-[#1F273A] hover:border-[#6366F1] transition-all"
            >
              {currentUser ? (
                <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#1B2130] flex items-center justify-center text-[#94A3B8]">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${showCompactMenu ? 'rotate-180' : ''}`} />
            </button>

            {showCompactMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 max-w-[calc(100vw-2rem)] bg-[#131722] border border-[#1F273A] rounded-2xl shadow-2xl overflow-hidden z-50 p-2 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-[#1F273A] mb-1">
                  <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Kinetic Menu'}</p>
                  <p className="text-[11px] text-[#64748B]">Navigate Kinetic</p>
                </div>

                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setShowCompactMenu(false);
                      onNavigate(item.id);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      activeTab === item.id
                        ? 'bg-[#6366F1]/15 text-white'
                        : 'text-[#94A3B8] hover:bg-[#1B2130] hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}

                <div className="border-t border-[#1F273A] mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowCompactMenu(false);
                      onOpenUploadModal();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#94A3B8] hover:bg-[#1B2130] hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCompactMenu(false);
                      onNavigate('creator-studio');
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      activeTab === 'creator-studio'
                        ? 'bg-[#6366F1]/15 text-white'
                        : 'text-[#94A3B8] hover:bg-[#1B2130] hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Studio</span>
                  </button>
                  {currentUser && (
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#F87171] hover:bg-[#F43F5E]/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                      <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
