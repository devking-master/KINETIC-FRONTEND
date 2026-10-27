import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ActiveTab, Track, ShortVideo, AuthUser } from './types';
import { html5Player } from './services/html5Player';
import { authApi } from './services/authApi';
import { videoApi } from './services/videoApi';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { MediaLoadingState } from './components/MediaLoadingState';
import { StateFeedback } from './components/ui/StateFeedback';
import { PlayerBar } from './components/PlayerBar';
const HomeView = lazy(() => import('./components/views/HomeView').then((m) => ({ default: m.HomeView })));
const ShortsView = lazy(() => import('./components/views/ShortsView.tsx').then((m) => ({ default: m.ShortsView })));
const MusicView = lazy(() => import('./components/views/MusicView').then((m) => ({ default: m.MusicView })));
const CreatorStudioView = lazy(() => import('./components/views/CreatorStudioView').then((m) => ({ default: m.CreatorStudioView })));
const DiscoverView = lazy(() => import('./components/views/DiscoverView').then((m) => ({ default: m.DiscoverView })));
const LibraryView = lazy(() => import('./components/views/LibraryView').then((m) => ({ default: m.LibraryView })));
const AuthView = lazy(() => import('./components/views/AuthView').then((m) => ({ default: m.AuthView })));
const ProfileView = lazy(() => import('./components/views/ProfileView').then((m) => ({ default: m.ProfileView })));
const WatchView = lazy(() => import('./components/views/WatchView').then((m) => ({ default: m.WatchView })));
const UploadModal = lazy(() => import('./components/UploadModal').then((m) => ({ default: m.UploadModal })));
import { ShareModal } from './components/ShareModal';
const OnboardingView = lazy(() => import('./components/views/OnboardingView').then((m) => ({ default: m.OnboardingView })));

type AppRoute = {
  path: string;
  tab: ActiveTab;
  username?: string;
  contentId?: string;
  contentType?: 'short' | 'watch';
};

const routeFromLocation = (): AppRoute => {
  const { pathname, search } = window.location;
  const path = `${pathname}${search}`;
  const segments = pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (segments.length === 0) return { path, tab: 'home' };
  if (segments.length === 1) {
    const tabs: Record<string, ActiveTab> = {
      music: 'music', discover: 'discover', shorts: 'shorts', library: 'library',
      studio: 'creator-studio', login: 'auth', welcome: 'welcome',
    };
    return { path, tab: tabs[segments[0]] || 'home' };
  }
  if (segments.length === 2 && segments[0] === 'shorts') {
    return { path, tab: 'shorts', contentType: 'short', contentId: segments[1] };
  }
  if (segments.length === 2 && segments[0] === 'watch') {
    return { path, tab: 'watch', contentType: 'watch', contentId: segments[1] };
  }
  if (segments.length === 2 && segments[0] === 'u') {
    return { path, tab: 'profile', username: segments[1] };
  }
  return { path, tab: 'home' };
};

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => routeFromLocation());
  const [selectedShort, setSelectedShort] = useState<ShortVideo | undefined>(undefined);
  const [selectedVideo, setSelectedVideo] = useState<ShortVideo | undefined>(undefined);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [routeVideo, setRouteVideo] = useState<ShortVideo | null>(null);
  const [routeVideoStatus, setRouteVideoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [shareConfig, setShareConfig] = useState<{ isOpen: boolean; title: string; videoId?: string }>({
    isOpen: false,
    title: '',
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
  const [playerState, setPlayerState] = useState(html5Player.getState());
  const activeTab = route.tab;
  const viewedUsername = route.username;

  const navigate = (path: string, replace = false) => {
    const target = new URL(path, window.location.origin);
    const targetPath = `${target.pathname}${target.search}${target.hash}`;
    if (replace) window.history.replaceState({}, '', targetPath);
    else window.history.pushState({}, '', targetPath);
    setRoute(routeFromLocation());
    if (routeFromLocation().tab === 'shorts' && html5Player.getState().isPlaying) {
      html5Player.togglePlay();
    }
  };

  const previousPath = useRef(route.path);

  useEffect(() => {
    const handlePopState = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const title = route.tab === 'welcome' ? 'Welcome - Kinetic'
      : route.tab === 'music' ? 'Music - Kinetic'
      : route.tab === 'discover' ? 'Discover - Kinetic'
        : route.tab === 'shorts' ? 'Shorts - Kinetic'
          : route.tab === 'watch' ? 'Watch - Kinetic'
            : route.tab === 'library' ? 'Library - Kinetic'
              : route.tab === 'creator-studio' ? 'Studio - Kinetic'
                : route.tab === 'auth' ? 'Login - Kinetic'
                  : route.tab === 'profile' ? `${route.username || 'Profile'} - Kinetic`
                    : 'Home - Kinetic';
    document.title = title;
    if (previousPath.current !== route.path) window.scrollTo({ top: 0, behavior: 'smooth' });
    previousPath.current = route.path;
  }, [route]);

  // Subscribe to player state
  useEffect(() => {
    const unsubscribe = html5Player.subscribe((state) => {
      setPlayerState(state);
    });
    return unsubscribe;
  }, []);

  // Initialize auth state
  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        const user = await authApi.getCurrentUser();
        if (!cancelled) setCurrentUser(user);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    };
    void checkAuth();
    return () => { cancelled = true; };
  }, []);

  const requiresAuth = activeTab === 'library' || activeTab === 'creator-studio' || activeTab === 'welcome';

  useEffect(() => {
    if (!authChecked) return;
    if (currentUser?.onboardingCompleted === false && route.tab !== 'welcome') {
      navigate('/welcome', true);
    } else if (currentUser && route.tab === 'welcome' && currentUser.onboardingCompleted !== false) {
      navigate('/', true);
    }
  }, [authChecked, currentUser, route.tab]);

  useEffect(() => {
    if (authChecked && requiresAuth && !currentUser) {
      navigate(`/login?next=${encodeURIComponent(route.path)}`, true);
    }
  }, [authChecked, currentUser, requiresAuth, route.path]);

  useEffect(() => {
    if (!route.contentId || !route.contentType) {
      setRouteVideo(null);
      setRouteVideoStatus('idle');
      return;
    }

    const existingVideo = [selectedVideo, selectedShort].find((video) => video?.id === route.contentId);
    if (existingVideo) {
      setRouteVideo(existingVideo);
      setRouteVideoStatus('ready');
      return;
    }

    let cancelled = false;
    setRouteVideo(null);
    setRouteVideoStatus('loading');
    videoApi.getVideoById(route.contentId)
      .then((video) => {
        if (!cancelled) {
          setRouteVideo(video);
          setRouteVideoStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setRouteVideoStatus('error');
      });
    return () => { cancelled = true; };
  }, [route.contentId, route.contentType, selectedShort, selectedVideo]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handlePlayTrack = (track: Track, context?: Track[]) => {
    // Pressing the song that is already loaded pauses or resumes it, so only announce a NEW song.
    const isSameSong = html5Player.getState().currentTrack.id === track.id;
    html5Player.playTrack(track, context);
    if (!isSameSong) showToast(`Now Playing: ${track.title} by ${track.artist}`);
  };

  const handleSelectShort = (short: ShortVideo) => {
    setSelectedShort(short);
    navigate(`/shorts/${encodeURIComponent(short.id)}`);
  };

  const handleOpenWatch = (video: ShortVideo) => {
    setSelectedVideo(video);
    navigate(`/watch/${encodeURIComponent(video.id)}`);
  };

  const handleOpenProfile = (username: string) => {
    navigate(`/u/${encodeURIComponent(username)}`);
  };

  const handleUploadSuccess = (item: { title: string; type: 'track' | 'video' }) => {
    setMediaRefreshKey((key) => key + 1);
    showToast(`Successfully published "${item.title}" to Kinetic Catalog!`);
  };

  const handleOpenUploadModal = () => {
    if (!currentUser) {
      showToast('Sign in before uploading media.');
      handleNavigate('auth');
      return;
    }
    setIsUploadModalOpen(true);
  };

  const handleOpenShare = (title: string, videoId?: string) => {
    setShareConfig({ isOpen: true, title, videoId });
  };

  const handleNavigate = (tab: ActiveTab) => {
    const paths: Record<ActiveTab, string> = {
      home: '/', music: '/music', discover: '/discover', shorts: '/shorts',
      library: '/library', 'creator-studio': '/studio', auth: '/login', welcome: '/welcome',
      profile: viewedUsername ? `/u/${encodeURIComponent(viewedUsername)}` : '/u', watch: '/watch',
    };
    navigate(paths[tab]);
  };

  const handleAuthSuccess = (user: AuthUser, isSignup: boolean) => {
    setCurrentUser(user);
    showToast(`Welcome to Kinetic, ${user.name}!`);
    if (isSignup) {
      navigate('/welcome', true);
      return;
    }
    const next = new URLSearchParams(window.location.search).get('next');
    const requestedDestination = next?.startsWith('/') && !next.startsWith('//') ? next : '/';
    const destination = requestedDestination === '/welcome' && user.onboardingCompleted !== false ? '/' : requestedDestination;
    navigate(destination, true);
  };

  const isShorts = activeTab === 'shorts';
  const isWelcome = activeTab === 'welcome';
  const isAuthPending = requiresAuth && (!authChecked || !currentUser);
  const isRouteVideoLoading = Boolean(route.contentId && routeVideo?.id !== route.contentId && routeVideoStatus !== 'error');

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans selection:bg-[var(--accent)]/30 selection:text-[var(--accent-hover)]">
      
      {/* Global Toast Banner */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-[var(--raised)] border border-[var(--accent)] text-[var(--text)] text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================
          SHORTS: Full-screen vertical feed
          Completely takes over the viewport.
          No navbar, no player, no padding.
      ======================================== */}
      {isShorts && (
        <Suspense fallback={<MediaLoadingState />}>
        {route.contentType === 'short' && isRouteVideoLoading ? <MediaLoadingState />
          : route.contentType === 'short' && routeVideoStatus === 'error' ? (
            <StateFeedback state="error" title="Video unavailable" message="This video could not be loaded." action={{ label: 'Home', onClick: () => handleNavigate('home') }} />
          ) : (
            <ShortsView
              currentShort={route.contentType === 'short' ? routeVideo || undefined : undefined}
              refreshKey={mediaRefreshKey}
              onSelectTrack={handlePlayTrack}
              onNavigate={handleNavigate}
              currentUser={currentUser}
              authChecked={authChecked}
              onRequireAuth={() => navigate(`/login?next=${encodeURIComponent('/shorts')}`)}
              onOpenUploadModal={handleOpenUploadModal}
              onOpenShareModal={handleOpenShare}
              onOpenProfile={handleOpenProfile}
            />
          )}
        </Suspense>
      )}

      {/* ========================================
            NORMAL LAYOUT (everything except Shorts and onboarding)
      ======================================== */}
          {!isShorts && !isWelcome && (
        <>
          {/* Top Navigation Bar */}
          <Navbar
            activeTab={activeTab}
            onNavigate={handleNavigate}
            onOpenUploadModal={handleOpenUploadModal}
            onPlayTrack={handlePlayTrack}
            currentUser={currentUser}
            onOpenAuth={() => handleNavigate('auth')}
            onLogout={async () => {
              authApi.removeToken();
              setCurrentUser(null);
              showToast('Signed out of Kinetic.');
              handleNavigate('home');
            }}
            isPlaying={playerState.isPlaying}
            onOpenProfile={(username) => {
              if (username) handleOpenProfile(username);
              else if (currentUser) handleOpenProfile(currentUser.username);
              else handleNavigate('auth');
            }}
            onOpenWatch={handleOpenWatch}
          />

          {/* Main Viewport Container */}
          <main className={activeTab === 'auth' ? 'flex-1 w-full' : 'flex-1 px-4 lg:px-8 max-w-7xl w-full mx-auto'}>
            <Suspense fallback={<MediaLoadingState compact />}>
            {isAuthPending && <MediaLoadingState compact />}
            {!isAuthPending && activeTab === 'home' && (
              <HomeView
                key={mediaRefreshKey}
                currentUser={currentUser}
                onPlayTrack={handlePlayTrack}
                onSelectShort={handleSelectShort}
                onOpenWatch={handleSelectShort}
                onOpenProfile={handleOpenProfile}
                onNavigate={handleNavigate}
              />
            )}

            {!isAuthPending && activeTab === 'music' && (
              <MusicView
                key={mediaRefreshKey}
                onPlayTrack={handlePlayTrack}
                onNavigate={handleNavigate}
                onOpenShareModal={handleOpenShare}
                currentTrack={playerState.currentTrack}
                isPlaying={playerState.isPlaying}
              />
            )}

            {!isAuthPending && activeTab === 'creator-studio' && (
              <CreatorStudioView
                onOpenUploadModal={handleOpenUploadModal}
                onNavigate={handleNavigate}
              />
            )}

            {!isAuthPending && activeTab === 'discover' && (
              <DiscoverView
                key={mediaRefreshKey}
                currentUser={currentUser}
                onPlayTrack={handlePlayTrack}
                onNavigate={handleNavigate}
                onOpenWatch={handleOpenWatch}
                onOpenProfile={handleOpenProfile}
              />
            )}

            {!isAuthPending && activeTab === 'library' && (
              <LibraryView
                key={mediaRefreshKey}
                onPlayTrack={handlePlayTrack}
                onNavigate={handleNavigate}
              />
            )}

            {!isAuthPending && activeTab === 'auth' && (
              <AuthView
                currentUser={currentUser}
                onNavigate={handleNavigate}
                onAuthSuccess={handleAuthSuccess}
                onLogout={async () => {
                  authApi.removeToken();
                  setCurrentUser(null);
                  showToast('Signed out of Kinetic.');
                  handleNavigate('home');
                }}
              />
            )}

            {!isAuthPending && activeTab === 'profile' && (
              <ProfileView
                key={viewedUsername || currentUser?.username || 'profile'}
                username={viewedUsername}
                currentUser={currentUser}
                onUserUpdated={setCurrentUser}
                onOpenUpload={handleOpenUploadModal}
                onOpenWatch={handleOpenWatch}
                onOpenProfile={handleOpenProfile}
                onLogout={async () => {
                  await authApi.logout();
                  setCurrentUser(null);
                  handleNavigate('home');
                }}
              />
            )}

            {!isAuthPending && activeTab === 'watch' && isRouteVideoLoading && <MediaLoadingState />}
            {!isAuthPending && activeTab === 'watch' && routeVideoStatus === 'error' && (
              <StateFeedback state="error" title="Video unavailable" message="This video could not be loaded." action={{ label: 'Home', onClick: () => handleNavigate('home') }} />
            )}
            {!isAuthPending && activeTab === 'watch' && routeVideoStatus === 'ready' && routeVideo && (
              <WatchView
                video={routeVideo}
                currentUser={currentUser}
                onBack={() => handleNavigate('home')}
                onOpenProfile={handleOpenProfile}
                onOpenWatch={handleOpenWatch}
                onNavigate={handleNavigate}
              />
            )}
            </Suspense>
          </main>

          {/* Mobile Bottom Navigation */}
          <MobileNav
            activeTab={activeTab}
            onNavigate={handleNavigate}
            onOpenUploadModal={handleOpenUploadModal}
            currentUser={currentUser}
            onOpenAuth={() => handleNavigate('auth')}
            onOpenProfile={() => currentUser ? handleOpenProfile(currentUser.username) : handleNavigate('auth')}
          />

          {/* Persistent Docked Audio Player */}
          {activeTab !== 'auth' && (
            <PlayerBar onNavigate={(tab) => handleNavigate(tab as ActiveTab)} />
          )}
        </>
      )}

      {isWelcome && !isAuthPending && currentUser && (
        <Suspense fallback={<MediaLoadingState />}>
          <OnboardingView
            user={currentUser}
            onUserUpdated={setCurrentUser}
            onComplete={() => navigate('/', true)}
          />
        </Suspense>
      )}

      {/* Creator Upload Modal */}
      <Suspense fallback={null}>
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={handleUploadSuccess}
        />
      </Suspense>

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
