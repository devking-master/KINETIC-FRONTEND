import React, { useState } from 'react';
import { Search, Plus, Bell, Menu, X, CheckCircle2 } from 'lucide-react';
import { ActiveTab } from '../types';

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

  const notifications = [
    { id: 1, title: 'Sound Trending', desc: 'Your stem for "Neon Horizon" was used in 420 new Shorts!', time: '12m ago', unread: true },
    { id: 2, title: 'New Master Available', desc: 'Sora uploaded stems for Elysium Dreams in 24-bit 96kHz FLAC.', time: '1h ago', unread: true },
    { id: 3, title: 'Royalty Payout Ready', desc: 'Estimated net payout of $8,420.50 scheduled for Nov 14.', time: '1d ago', unread: false },
  ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#08090b]/85 backdrop-blur-md border-b border-[#232a34]/60 px-4 lg:px-8 flex items-center justify-between gap-4">
      {/* Mobile menu trigger */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 text-[#9ca3af] hover:text-white rounded-lg hover:bg-[#161a22]"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-display font-extrabold text-white text-base tracking-wider">KINETIC</span>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-xl relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-[#6b7280] pointer-events-none" />
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search songs, artists, shorts, creators..."
            className="w-full bg-[#151c25] text-sm text-[#dce3f0] placeholder-[#6b7280] pl-10 pr-4 py-2 rounded-full border border-[#232a34] focus:outline-none focus:border-[#2f6bff] focus:ring-1 focus:ring-[#2f6bff] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 text-[#6b7280] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* + Upload Button */}
        <button
          id="btn-navbar-upload"
          onClick={onOpenUploadModal}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#2f6bff] hover:bg-[#2558d6] text-white font-medium text-xs sm:text-sm shadow-md shadow-[#2f6bff]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Upload</span>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-full text-[#9ca3af] hover:text-white hover:bg-[#161a22] transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2f6bff]" />
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-[#161a22] border border-[#232a34] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#232a34] mb-2 px-1">
                <span className="text-xs font-semibold text-white">Notifications</span>
                <span className="text-[10px] text-[#2f6bff] cursor-pointer hover:underline">Mark all read</span>
              </div>
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2 rounded-lg text-xs transition-colors ${
                      n.unread ? 'bg-[#232a34]/60 text-white' : 'text-[#9ca3af]'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>{n.title}</span>
                      <span className="text-[10px] text-[#6b7280] font-normal">{n.time}</span>
                    </div>
                    <p className="text-[11px] text-[#9ca3af] mt-0.5 leading-relaxed">{n.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar with Studio Link */}
        <button
          onClick={() => onNavigate('creator-studio')}
          className="relative group p-0.5 rounded-full ring-2 ring-[#232a34] hover:ring-[#2f6bff] transition-all"
          title="Kaelen Vance - Creator Studio"
        >
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
            alt="Kaelen Vance"
            className="w-8 h-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#4edea3] ring-2 ring-[#08090b]" />
        </button>
      </div>
    </header>
  );
};
