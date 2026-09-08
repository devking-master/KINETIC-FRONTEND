import React, { useState, useEffect } from 'react';
import { ActiveTab, Track, ShortVideo, AuthUser } from './types';
import { html5Player } from './services/html5Player';
import { authApi } from './services/authApi';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { PlayerBar } from './components/PlayerBar';
import { HomeView } from './components/views/HomeView';
import { ShortsView } from './components/views/ShortsView';
import { MusicView } from './components/views/MusicView';
import { CreatorStudioView } from './components/views/CreatorStudioView';
import { DiscoverView } from './components/views/DiscoverView';
import { LibraryView } from './components/views/LibraryView';
import { AuthView } from './components/views/AuthView';
import { UploadModal } from './components/UploadModal';
import { ShareModal } from './components/ShareModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedShort, setSelectedShort] = useState<ShortVideo | undefined>(undefined);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [shareConfig, setShareConfig] = useState<{ isOpen: boolean; title: string; videoId?: string }>({
    isOpen: false,
    title: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [videoRefreshKey, setVideoRefreshKey] = useState(0);
  const [playerState, setPlayerState] = useState(html5Player.getState());

  // Subscribe to player state
  useEffect(() => {
    const unsubscribe = html5Player.subscribe((state) => {
      setPlayerState(state);
    });
    return unsubscribe;
  }, []);

  // Initialize auth state
  useEffect(() => {
    const checkAuth = async () => {
      const user = await authApi.getCurrentUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    checkAuth();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handlePlayTrack = (track: Track) => {
    html5Player.playTrack(track);
    showToast(`Now Playing: ${track.title} by ${track.artist}`);
  };

  const handleSelectShort = (short: ShortVideo) => {
    setSelectedShort(short);
    setActiveTab('shorts');
  };

  const handleUploadSuccess = (item: { title: string; type: 'track' | 'video' }) => {
    if (item.type === 'video') {
      setVideoRefreshKey((key) => key + 1);
    }
    showToast(`Successfully published "${item.title}" to Kinetic Catalog!`);
  };

  const handleOpenShare = (title: string, videoId?: string) => {
    setShareConfig({ isOpen: true, title, videoId });
  };

  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'shorts') {
      // Pause background music player when entering short-video feed
      if (html5Player.getState().isPlaying) {
        html5Player.togglePlay();
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isShorts = activeTab === 'shorts';

  return (
    <div className="min-h-screen bg-[#080A0F] text-[#E2E8F0] flex flex-col font-sans selection:bg-[#6366F1]/30 selection:text-[#A5B4FC]">
      
      {/* Global Toast Banner */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-[#131722] border border-[#6366F1] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================
          SHORTS: Full-Screen TikTok Experience
          Completely takes over the viewport.
          No navbar, no player, no padding.
      ======================================== */}
      {isShorts && (
        <ShortsView
          currentShort={selectedShort}
          refreshKey={videoRefreshKey}
          onSelectTrack={handlePlayTrack}
          onNavigate={handleNavigate}
          onOpenShareModal={handleOpenShare}
        />
      )}

      {/* ========================================
          NORMAL LAYOUT (everything except Shorts)
      ======================================== */}
      {!isShorts && (
        <>
          {/* Top Navigation Bar */}
          <Navbar
            activeTab={activeTab}
            onNavigate={handleNavigate}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            onPlayTrack={handlePlayTrack}
            currentUser={currentUser}
            onOpenAuth={() => handleNavigate('auth')}
            isPlaying={playerState.isPlaying}
          />

          {/* Main Viewport Container */}
          <main className="flex-1 px-4 lg:px-8 max-w-7xl w-full mx-auto">
            {activeTab === 'home' && (
              <HomeView
                onPlayTrack={handlePlayTrack}
                onSelectShort={handleSelectShort}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'music' && (
              <MusicView
                onPlayTrack={handlePlayTrack}
                onNavigate={handleNavigate}
                onOpenShareModal={handleOpenShare}
                currentTrack={playerState.currentTrack}
                isPlaying={playerState.isPlaying}
              />
            )}

            {activeTab === 'creator-studio' && (
              <CreatorStudioView
                onOpenUploadModal={() => setIsUploadModalOpen(true)}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'discover' && (
              <DiscoverView
                onPlayTrack={handlePlayTrack}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'library' && (
              <LibraryView
                onPlayTrack={handlePlayTrack}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'auth' && (
              <AuthView
                currentUser={currentUser}
                onAuthSuccess={(user) => {
                  setCurrentUser(user);
                  showToast(`Welcome to Kinetic, ${user.name}!`);
                  handleNavigate('home');
                }}
                onLogout={() => {
                  authApi.removeToken();
                  setCurrentUser(null);
                  showToast('Signed out of Kinetic.');
                  handleNavigate('home');
                }}
              />
            )}
          </main>

          {/* Mobile Bottom Navigation */}
          <MobileNav
            activeTab={activeTab}
            onNavigate={handleNavigate}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
            currentUser={currentUser}
            onOpenAuth={() => handleNavigate('auth')}
          />

          {/* Persistent Docked Audio Player */}
          <PlayerBar onNavigate={(tab) => handleNavigate(tab as ActiveTab)} />
        </>
      )}

      {/* Creator Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareConfig.isOpen}
        onClose={() => setShareConfig({ isOpen: false, title: '' })}
        title={shareConfig.title}
        videoId={shareConfig.videoId}
      />
    </div>
  );
}
