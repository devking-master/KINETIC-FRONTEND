import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Bell, Menu, X, LayoutDashboard, ChevronDown } from 'lucide-react';
import { ActiveTab } from '../types';
import { KineticLogo } from './KineticLogo';

interface NavbarProps {
  onOpenMobileMenu: () => void;
  onOpenUploadModal: () => void;
  onNavigate: (tab: ActiveTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMobileMenu,
  onOpenUploadModal,
  onNavigate,
  searchQuery,
  onSearchChange,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMenuNotifications, setShowMenuNotifications] = useState(false);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isMobileSearchOpen) {
      mobileSearchInputRef.current?.focus();
    }
  }, [isMobileSearchOpen]);

  const notifications = [
    { id: 1, title: 'Sound Trending', desc: 'Your stem for "Neon Horizon" was used in 420 new Shorts!', time: '12m ago', unread: true },
    { id: 2, title: 'New Master Available', desc: 'Sora uploaded stems for Elysium Dreams in 24-bit 96kHz FLAC.', time: '1h ago', unread: true },
    { id: 3, title: 'Royalty Payout Ready', desc: 'Estimated net payout of $8,420.50 scheduled for Nov 14.', time: '1d ago', unread: false },
  ];
  const hasUnread = notifications.some((n) => n.unread);

  const closeProfileMenu = () => {
    setShowProfileMenu(false);
    setShowMenuNotifications(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-[var(--bg)]/85 backdrop-blur-md border-b border-[var(--border)]/60 px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
        {/* Mobile/tablet: just the logo — hamburger still opens primary site nav */}
        <div className="flex items-center gap-2 sm:gap-3 lg:hidden shrink-0">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--raised)]"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <KineticLogo showText={false} size="sm" />
        </div>

        {/* Desktop inline search bar — lg+ only, plenty of room here */}
        <div className="hidden lg:block flex-1 min-w-0 max-w-xl relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[var(--subtle)] pointer-events-none" />
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search songs, artists, shorts, creators..."
              className="w-full min-w-0 bg-[var(--raised)] text-sm text-[var(--text)] placeholder-[var(--subtle)] pl-10 pr-4 py-2 rounded-full border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 text-[var(--subtle)] hover:text-[var(--text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Pushes the profile icon to the far right below lg */}
        <div className="flex-1 lg:hidden" />

        {/* Desktop-only Right Controls */}
        <div className="hidden lg:flex items-center gap-3 shrink-0">
          <button
            id="btn-navbar-upload"
            onClick={onOpenUploadModal}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text)] font-medium text-sm shadow-md shadow-[var(--accent)]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Upload</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--raised)] transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {hasUnread && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent)]" />}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[var(--raised)] border border-[var(--border)] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] mb-2 px-1">
                  <span className="text-xs font-semibold text-[var(--text)]">Notifications</span>
                  <span className="text-[10px] text-[var(--accent)] cursor-pointer hover:underline">Mark all read</span>
                </div>
                <div className="space-y-2">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2 rounded-lg text-xs transition-colors ${
                        n.unread ? 'bg-[var(--border)]/60 text-[var(--text)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>{n.title}</span>
                        <span className="text-[10px] text-[var(--subtle)] font-normal">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('creator-studio')}
            className="relative group p-0.5 rounded-full ring-2 ring-[var(--border)] hover:ring-[var(--accent)] transition-all shrink-0"
            title="Kaelen Vance - Creator Studio"
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Kaelen Vance"
              className="w-8 h-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--bg)]" />
          </button>
        </div>

        {/* Mobile/tablet: a single profile icon — everything else lives in its dropdown */}
        <div className="relative lg:hidden">
          <button
            onClick={() => setShowProfileMenu((v) => !v)}
            className="relative p-0.5 rounded-full ring-2 ring-[var(--border)] hover:ring-[var(--accent)] transition-all shrink-0"
            title="Menu"
          >
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Kaelen Vance"
              className="w-8 h-8 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--bg)]" />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--like)] ring-2 ring-[var(--bg)]" />
            )}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[var(--raised)] border border-[var(--border)] rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
              <div className="flex items-center gap-2.5 p-3 border-b border-[var(--border)]">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                  alt="Kaelen Vance"
                  className="w-9 h-9 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--text)] truncate">Kaelen Vance</p>
                  <p className="text-[11px] text-[var(--subtle)] truncate">Creator</p>
                </div>
              </div>

              <div className="p-1.5">
                <button
                  onClick={() => { closeProfileMenu(); setIsMobileSearchOpen(true); }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--border)]/60 transition-colors"
                >
                  <Search className="w-4 h-4 text-[var(--muted)]" />
                  <span>Search</span>
                </button>

                <button
                  onClick={() => { closeProfileMenu(); onOpenUploadModal(); }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--border)]/60 transition-colors"
                >
                  <Plus className="w-4 h-4 text-[var(--muted)]" />
                  <span>Upload</span>
                </button>

                <button
                  onClick={() => { closeProfileMenu(); onNavigate('creator-studio'); }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--border)]/60 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-[var(--muted)]" />
                  <span>Creator Studio</span>
                </button>

                <button
                  onClick={() => setShowMenuNotifications((v) => !v)}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm text-[var(--text)] hover:bg-[var(--border)]/60 transition-colors"
                >
                  <Bell className="w-4 h-4 text-[var(--muted)]" />
                  <span className="flex-1 text-left">Notifications</span>
                  {hasUnread && <span className="w-1.5 h-1.5 rounded-full bg-[var(--like)]" />}
                  <ChevronDown className={`w-3.5 h-3.5 text-[var(--subtle)] transition-transform ${showMenuNotifications ? 'rotate-180' : ''}`} />
                </button>

                {showMenuNotifications && (
                  <div className="px-1 pb-1.5 pt-1 space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2 rounded-lg text-xs transition-colors ${
                          n.unread ? 'bg-[var(--border)]/60 text-[var(--text)]' : 'text-[var(--muted)]'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center justify-between">
                          <span>{n.title}</span>
                          <span className="text-[10px] text-[var(--subtle)] font-normal shrink-0 ml-2">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Mobile/tablet search dropdown — slides down right below the header */}
      {isMobileSearchOpen && (
        <div className="lg:hidden sticky top-16 z-30 bg-[var(--bg)]/95 backdrop-blur-md border-b border-[var(--border)]/60 px-3 sm:px-4 py-3 animate-in slide-in-from-top duration-200">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-[var(--subtle)] pointer-events-none" />
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search songs, artists, shorts..."
              className="w-full min-w-0 bg-[var(--raised)] text-sm text-[var(--text)] placeholder-[var(--subtle)] pl-10 pr-10 py-2.5 rounded-full border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 text-[var(--subtle)] hover:text-[var(--text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
