import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Bell, 
  User as UserIcon, 
  Music2, 
  Video, 
  Compass, 
  Home, 
  Library, 
  Radio,
  Upload,
  X,
  ChevronDown,
  LogOut,
  Loader2
} from '../ui/Icon';
import { ActiveTab, AuthUser, Track, ShortVideo } from '../../types';
import { musicApi } from '../../services/musicApi';
import { KineticLogo } from '../KineticLogo';
import { Field } from '../ui/Field';
import { Avatar } from '../ui/Avatar';

interface NavbarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onOpenUploadModal: () => void;
  onPlayTrack?: (track: Track) => void;
  currentUser: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => Promise<void> | void;
  isPlaying?: boolean;
  onOpenProfile: (username?: string) => void;
  onOpenWatch?: (video: ShortVideo) => void;
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
  onOpenProfile,
  onOpenWatch,
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
    <header className="sticky top-0 z-40 w-full bg-[var(--bg)]/85 backdrop-blur-xl border-b border-[var(--border)] px-4 lg:px-8 py-3 transition-all">
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
          <nav className="hidden lg:flex items-center gap-1 bg-[var(--raised)] p-1 rounded-full border border-[var(--border)]">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--text)] shadow-md'
                      : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)]'
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--subtle)]" />
            <Field
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracks, creators, short videos..."
              className="w-full rounded-xl pl-10 pr-9 py-2 text-xs font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--subtle)] hover:text-[var(--text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Predictive Search Dropdown */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--raised)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50 p-2 space-y-2 animate-in fade-in slide-in-from-top-2">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-[var(--muted)]">Searching Kinetic index...</div>
              ) : searchResults.tracks.length === 0 && searchResults.videos.length === 0 ? (
                <div className="p-4 text-center text-xs text-[var(--muted)]">No results found for "{searchQuery}"</div>
              ) : (
                <div>
                  <div className="text-[10px] font-bold   text-[var(--subtle)] px-3 py-1">
                    Songs & Sounds
                  </div>
                  {searchResults.tracks.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (onPlayTrack) onPlayTrack(t);
                        setShowSearchDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--raised)] text-left transition-colors"
                    >
                      <img src={t.coverUrl} alt={t.title} className="w-9 h-9 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[var(--text)] truncate">{t.title}</div>
                        <div className="text-[11px] text-[var(--muted)] truncate">{t.artist}</div>
                      </div>
                      <span className="text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                        Play
                      </span>
                    </button>
                  ))}
                  {searchResults.videos.slice(0, 4).map((rawVideo) => {
                    const video = rawVideo as ShortVideo & { _id?: string };
                    const normalized: ShortVideo = { ...video, id: video.id || video._id || `search-${video.caption}`, thumbnailUrl: video.thumbnailUrl || '', duration: video.duration || 0 };
                    return <button key={normalized.id} onClick={() => { onOpenWatch?.(normalized); setShowSearchDropdown(false); }} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--raised)] text-left transition-colors"><img src={normalized.thumbnailUrl} alt="" className="w-9 h-9 rounded-lg object-cover" /><div className="flex-1 min-w-0"><div className="text-xs font-bold text-[var(--text)] truncate">{normalized.caption}</div><span onClick={(event) => { event.stopPropagation(); onOpenProfile(normalized.creatorHandle.replace(/^@/, '')); }} className="block text-[11px] text-[var(--muted)] truncate hover:underline">{normalized.creatorName}</span></div><span className="text-[10px] font-semibold text-[var(--accent)]">Watch</span></button>;
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions: Live Audio Indicator, Upload, Studio, Profile */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Live Playing Spectrum Bar Mini Indicator */}
          {isPlaying && (
            <div className="hidden lg:flex items-center gap-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-3 bg-[var(--accent)] rounded-full equalizer-bar-1" />
              <span className="w-1.5 h-4 bg-[var(--accent)] rounded-full equalizer-bar-2" />
              <span className="w-1.5 h-2 bg-[var(--accent)] rounded-full equalizer-bar-3" />
              <span className="text-[11px] font-bold text-[var(--accent-hover)] ml-1">Live Playing</span>
            </div>
          )}

          {/* Quick Create Button */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent)] hover:brightness-110 text-[var(--text)] font-semibold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </button>

          {/* Creator Studio Link */}
          <button
            onClick={() => onNavigate('creator-studio')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              activeTab === 'creator-studio'
                ? 'bg-[var(--raised)] text-[var(--text)] border-[var(--accent)]'
                : 'bg-[var(--raised)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--border-hover)]'
            }`}
          >
            Studio
          </button>

          {/* User Auth Profile Trigger */}
          <button
            onClick={() => {
              if (currentUser) {
                onOpenProfile();
              } else {
                onOpenAuth();
              }
            }}
            className="flex items-center gap-2 p-1 rounded-full bg-[var(--raised)] border border-[var(--border)] hover:border-[var(--accent)] transition-all"
          >
            {currentUser ? (
              <Avatar src={currentUser.avatarUrl} name={currentUser.name} size={28} />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--raised)] flex items-center justify-center text-[var(--muted)]">
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
              className="p-2 rounded-full text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)] transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>

            {showSearchDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-5rem)] bg-[var(--raised)] border border-[var(--border)] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--subtle)]" />
                  <input
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-8 pr-2.5 py-2 text-xs text-[var(--text)] placeholder-[var(--subtle)] focus:outline-none focus:border-[var(--accent)] transition-all"
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
              className="flex items-center gap-1 p-1 rounded-full bg-[var(--raised)] border border-[var(--border)] hover:border-[var(--accent)] transition-all"
            >
              {currentUser ? (
                <Avatar src={currentUser.avatarUrl} name={currentUser.name} size={28} />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--raised)] flex items-center justify-center text-[var(--muted)]">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform ${showCompactMenu ? 'rotate-180' : ''}`} />
            </button>

            {showCompactMenu && (
              <div className="absolute right-0 top-full mt-2 w-60 max-w-[calc(100vw-2rem)] bg-[var(--raised)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50 p-2 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                  <p className="text-xs font-bold text-[var(--text)] truncate">{currentUser?.name || 'Kinetic Menu'}</p>
                  <p className="text-[11px] text-[var(--subtle)]">Navigate Kinetic</p>
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
                        ? 'bg-[var(--accent)]/15 text-[var(--text)]'
                        : 'text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}

                <div className="border-t border-[var(--border)] mt-1 pt-1">
                  <button
                    onClick={() => {
                      setShowCompactMenu(false);
                      onOpenUploadModal();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] transition-colors"
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
                        ? 'bg-[var(--accent)]/15 text-[var(--text)]'
                        : 'text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Studio</span>
                  </button>
                  {currentUser && (
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--danger)] hover:bg-[var(--like)]/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
