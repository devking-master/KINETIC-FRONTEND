import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  Volume2, 
  VolumeX, 
  Play, 
  Music2, 
  Check, 
  Plus, 
  Send, 
  X,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  Pause,
  Home,
  Compass,
  Search
} from 'lucide-react';
import { ShortVideo, Track, LiveComment, ActiveTab } from '../../types';
import { videoApi } from '../../services/videoApi';
import { authApi } from '../../services/authApi';
import { MediaLoadingState } from '../MediaLoadingState';

const EMPTY_VIDEO: ShortVideo = {
  id: 'empty-video',
  creatorHandle: '',
  creatorName: '',
  creatorAvatar: '',
  verified: false,
  caption: '',
  thumbnailUrl: '',
  duration: 0,
  views: '0',
  likes: '0',
  likesCount: 0,
  commentsCount: '0',
  audioTrackTitle: '',
  audioArtist: '',
};

const formatCount = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace('.0', '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.0', '')}K`;
  return String(value);
};

interface ShortsViewProps {
  currentShort?: ShortVideo;
  refreshKey?: number;
  onSelectTrack: (track: Track) => void;
  onNavigate: (tab: ActiveTab) => void;
  onOpenShareModal: (title: string, videoId?: string) => void;
}

export const ShortsView: React.FC<ShortsViewProps> = ({
  currentShort,
  refreshKey = 0,
  onSelectTrack,
  onNavigate,
  onOpenShareModal,
}) => {
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'Following' | 'For You'>('For You');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [showHeartSplash, setShowHeartSplash] = useState(false);
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [comments, setComments] = useState<LiveComment[]>([
    { id: '1', userHandle: '@ambient_producer', userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', timeAgo: '2h ago', text: 'This synth tone is insane! What synth model is this?', likes: 24 },
    { id: '2', userHandle: '@tokyo_nights', userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', timeAgo: '4h ago', text: 'Cleanest mix I have heard on Kinetic all week 🔥', likes: 12 },
    { id: '3', userHandle: '@wave_theory', userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', timeAgo: '6h ago', text: 'The sub bass in this hit different with headphones 🎧', likes: 8 },
  ]);
  const [newCommentText, setNewCommentText] = useState('');
  const [lastTap, setLastTap] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch videos
  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoading(true);
      setFeedError(null);
      try {
        const fetched = await videoApi.getTrendingVideos();
        if (fetched && fetched.length > 0) {
          setVideos(fetched);
          if (currentShort) {
            const idx = fetched.findIndex((v) => v.id === currentShort.id);
            if (idx !== -1) setCurrentIndex(idx);
          }
        }
        if (fetched.length === 0) {
          setFeedError('Videos are temporarily unavailable. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchVideos();
  }, [currentShort, refreshKey]);

  const activeVideo = videos[currentIndex] || EMPTY_VIDEO;
  const isLiked = likedMap[activeVideo.id] ?? activeVideo.isLiked ?? false;
  const isBookmarked = bookmarkedMap[activeVideo.id] ?? activeVideo.isBookmarked ?? false;
  const isFollowing = followingMap[activeVideo.creatorHandle] ?? false;

  useEffect(() => {
    if (!activeVideo.id || activeVideo.id === EMPTY_VIDEO.id) return;
    setInteractionError(null);
    void videoApi.recordView(activeVideo.id).then(({ viewsCount }) => {
      setVideos((prev) => prev.map((video) => video.id === activeVideo.id
        ? { ...video, viewsCount, views: formatCount(viewsCount) }
        : video));
    }).catch(() => {});
  }, [activeVideo.id]);

  useEffect(() => {
    if (!isCommentsOpen || !activeVideo.id || activeVideo.id === EMPTY_VIDEO.id) return;
    void videoApi.getComments(activeVideo.id)
      .then(setComments)
      .catch(() => setInteractionError('Comments are temporarily unavailable.'));
  }, [isCommentsOpen, activeVideo.id]);

  const handleLike = async (forceLike = false) => {
    const token = authApi.getToken();
    if (!token) {
      setInteractionError('Sign in to like videos.');
      return;
    }
    if (forceLike && isLiked) return;
    try {
      const result = await videoApi.toggleLikeVideo(activeVideo.id, token);
      setLikedMap((prev) => ({ ...prev, [activeVideo.id]: result.liked }));
      if (typeof result.likesCount === 'number') {
        setVideos((prev) => prev.map((video) => video.id === activeVideo.id
          ? { ...video, likesCount: result.likesCount, likes: formatCount(result.likesCount) }
          : video));
      }
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : 'Unable to update like.');
    }
  };

  const handleSave = async () => {
    const token = authApi.getToken();
    if (!token) {
      setInteractionError('Sign in to save videos.');
      return;
    }
    try {
      const result = await videoApi.toggleSaveVideo(activeVideo.id, token);
      setBookmarkedMap((prev) => ({ ...prev, [activeVideo.id]: result.saved }));
    } catch (error) {
      setInteractionError(error instanceof Error ? error.message : 'Unable to save video.');
    }
  };

  // Video Autoplay & Source sync
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      if (!activeVideo.videoUrl) return;
      video.src = activeVideo.videoUrl;
      video.currentTime = 0;
      video.muted = isMuted;
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            // Browsers require muted autoplay — unmute on user gesture
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
      }
    }
    // Intentionally not including isMuted in deps to avoid re-triggering on mute toggle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeVideo.videoUrl]);

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  const navigateVideo = useCallback((direction: 'next' | 'prev') => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    
    if (direction === 'next') {
      setCurrentIndex((prev) => (prev < videos.length - 1 ? prev + 1 : 0));
    } else {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : videos.length - 1));
    }
    
    setTimeout(() => setIsTransitioning(false), 400);
  }, [isTransitioning, videos.length]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartX.current - e.changedTouches[0].clientX);
    
    // Only swipe vertically (not accidentally while scrolling horizontally)
    if (Math.abs(deltaY) > 60 && deltaX < 50) {
      if (deltaY > 0) {
        navigateVideo('next');
      } else {
        navigateVideo('prev');
      }
    }
  };

  // Double-tap to like (mobile)
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTap;
    setLastTap(now);

    if (timeSinceLastTap < 300) {
      // Double tap
      const rect = e.currentTarget.getBoundingClientRect();
      setHeartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setShowHeartSplash(true);
      setTimeout(() => setShowHeartSplash(false), 800);
      void handleLike(true);
    } else {
      // Single tap — toggle play/pause with delay to differentiate
      setTimeout(() => {
        if (Date.now() - now >= 280) {
          togglePlayPause();
        }
      }, 300);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentsOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowDown':
        case 'KeyJ':
          e.preventDefault();
          navigateVideo('next');
          break;
        case 'ArrowUp':
        case 'KeyK':
          e.preventDefault();
          navigateVideo('prev');
          break;
        case 'KeyM':
          e.preventDefault();
          setIsMuted((prev) => {
            const newMuted = !prev;
            if (videoRef.current) videoRef.current.muted = newMuted;
            return newMuted;
          });
          break;
        case 'KeyL':
          e.preventDefault();
          void handleLike();
          break;
        case 'Escape':
          onNavigate('home');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isPlaying, isCommentsOpen, isLiked, activeVideo.id, togglePlayPause, navigateVideo, onNavigate]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const token = authApi.getToken();
    if (!token) {
      setInteractionError('Sign in to comment on videos.');
      return;
    }
    void videoApi.addComment(activeVideo.id, newCommentText.trim(), token)
      .then(({ comment, commentsCount }) => {
        setComments((prev) => [comment, ...prev]);
        setVideos((prev) => prev.map((video) => video.id === activeVideo.id
          ? { ...video, commentsCount: formatCount(commentsCount) }
          : video));
        setNewCommentText('');
      })
      .catch((error: unknown) => setInteractionError(error instanceof Error ? error.message : 'Unable to post comment.'));
  };

  const handleMuteToggle = () => {
    setIsMuted((prev) => {
      const newMuted = !prev;
      if (videoRef.current) videoRef.current.muted = newMuted;
      return newMuted;
    });
  };

  return (
    // Full-viewport takeover — no margins, no padding from parent
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black overflow-hidden"
    >
      {/* ──────────────────────────────────────
          FULL SCREEN VIDEO PLAYER
      ────────────────────────────────────── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={handleTap}
        className="relative w-full h-full select-none"
      >
        {isLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
            <MediaLoadingState compact />
          </div>
        )}

        {feedError && !isLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-8 text-center text-sm font-semibold text-white">
            {feedError}
          </div>
        )}

        {interactionError && !isCommentsOpen && (
          <div className="absolute top-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-[#F43F5E]/40 bg-black/70 px-4 py-2 text-center text-xs font-semibold text-[#FDA4AF] backdrop-blur-md">
            {interactionError}
          </div>
        )}

        {/* Native HTML5 Video — covers entire viewport */}
        {activeVideo.videoUrl && (
          <video
            ref={videoRef}
            src={activeVideo.videoUrl}
            poster={activeVideo.thumbnailUrl || undefined}
            loop
            playsInline
            muted={isMuted}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Subtle gradient darkening overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

        {/* ──────────────────────────────────────
            DOUBLE-TAP HEART ANIMATION
        ────────────────────────────────────── */}
        {showHeartSplash && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{ left: heartPos.x - 40, top: heartPos.y - 40 }}
          >
            <Heart className="w-20 h-20 text-[#F43F5E] fill-[#F43F5E] animate-heart-splash drop-shadow-2xl" />
          </div>
        )}

        {/* ──────────────────────────────────────
            PAUSED OVERLAY
        ────────────────────────────────────── */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
              <Play className="w-10 h-10 fill-white text-white ml-1" />
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────
            TOP UI: Header with nav tabs + back + mute
        ────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-12 pb-4 pointer-events-auto">
          {/* Back button */}
          <button
            onClick={(e) => { e.stopPropagation(); onNavigate('home'); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Following / For You Tabs */}
          <div className="flex items-center gap-6">
            {(['Following', 'For You'] as const).map((cat) => (
              <button
                key={cat}
                onClick={(e) => { e.stopPropagation(); setActiveCategory(cat); }}
                className={`text-sm font-extrabold transition-all drop-shadow-md ${
                  activeCategory === cat
                    ? 'text-white border-b-2 border-white pb-0.5'
                    : 'text-white/55 hover:text-white/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Mute toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); handleMuteToggle(); }}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-[#F43F5E]" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* ──────────────────────────────────────
            RIGHT SIDEBAR: TikTok-style action buttons
        ────────────────────────────────────── */}
        <div
          className="absolute right-3 bottom-32 z-30 flex flex-col items-center gap-5 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Creator Avatar + Follow */}
          <div className="relative mb-1">
            {activeVideo.creatorAvatar && (
              <img
                src={activeVideo.creatorAvatar}
                alt={activeVideo.creatorName}
                className="w-12 h-12 rounded-full border-2 border-white object-cover shadow-xl"
              />
            )}
            <button
              onClick={() => setFollowingMap((prev) => ({ ...prev, [activeVideo.creatorHandle]: !isFollowing }))}
              className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-90 ${
                isFollowing ? 'bg-[#10B981]' : 'bg-[#F43F5E] hover:scale-110'
              }`}
            >
              {isFollowing ? <Check className="w-3 h-3 stroke-[3]" /> : <Plus className="w-3 h-3 stroke-[3]" />}
            </button>
          </div>

          {/* Like */}
          <button
            onClick={() => void handleLike()}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
              isLiked ? 'text-[#F43F5E]' : 'text-white'
            }`}>
              <Heart className={`w-7 h-7 drop-shadow-lg ${isLiked ? 'fill-[#F43F5E]' : 'fill-white/20'}`} />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow-md">
              {activeVideo.likes}
            </span>
          </button>

          {/* Comments */}
          <button
            onClick={() => setIsCommentsOpen(true)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform">
              <MessageCircle className="w-7 h-7 fill-white/20 drop-shadow-lg" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow-md">
              {activeVideo.commentsCount}
            </span>
          </button>

          {/* Bookmark */}
          <button
            onClick={() => void handleSave()}
            className="flex flex-col items-center gap-1"
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-90 ${
              isBookmarked ? 'text-[#06B6D4]' : 'text-white'
            }`}>
              <Bookmark className={`w-7 h-7 drop-shadow-lg ${isBookmarked ? 'fill-[#06B6D4]' : 'fill-white/20'}`} />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow-md">
              {isBookmarked ? 'Saved' : 'Save'}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={() => onOpenShareModal(activeVideo.caption, activeVideo.id)}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform">
              <Share2 className="w-7 h-7 fill-white/20 drop-shadow-lg" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow-md">Share</span>
          </button>

          {/* Rotating Vinyl / Audio Disc */}
          <button
            onClick={() => onSelectTrack({
              id: `sound-${activeVideo.id}`,
              title: activeVideo.audioTrackTitle,
              artist: activeVideo.audioArtist,
              album: 'Original Sound',
              coverUrl: activeVideo.thumbnailUrl,
              duration: 180,
            })}
            className="w-12 h-12 rounded-full border-[3px] border-white/60 overflow-hidden shadow-2xl animate-spin-record mt-1"
          >
            {activeVideo.thumbnailUrl && (
              <img src={activeVideo.thumbnailUrl} alt="Audio disc" className="w-full h-full object-cover" />
            )}
          </button>
        </div>

        {/* ──────────────────────────────────────
            BOTTOM LEFT: Creator info + caption + sound
        ────────────────────────────────────── */}
        <div
          className="absolute left-4 right-20 bottom-24 z-30 space-y-2 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white drop-shadow-lg font-display">
              {activeVideo.creatorName}
            </span>
            <span className="text-xs text-white/70 font-medium">{activeVideo.creatorHandle}</span>
            {activeVideo.verified && (
              <span className="w-4 h-4 bg-[#6366F1] rounded-full flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
              </span>
            )}
          </div>

          <p className="text-sm text-white/95 leading-snug line-clamp-3 drop-shadow-lg font-sans max-w-xs">
            {activeVideo.caption}
          </p>

          {/* Audio track pill */}
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 w-fit">
            <Music2 className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="text-[11px] font-bold text-white truncate max-w-[200px]">
              {activeVideo.audioTrackTitle} • {activeVideo.audioArtist}
            </span>
          </div>
        </div>

        {/* ──────────────────────────────────────
            BOTTOM NAVIGATION: Prev / Next Video Arrows
        ────────────────────────────────────── */}
        <div 
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => navigateVideo('prev')}
            disabled={isTransitioning}
            className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-xl transition-all hover:bg-black/70 active:scale-90 disabled:opacity-50"
            title="Previous Video (↑)"
          >
            <ArrowUp className="w-5 h-5" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
            className="w-14 h-14 rounded-full bg-[#6366F1] hover:bg-[#8B5CF6] text-white flex items-center justify-center shadow-xl shadow-[#6366F1]/40 transition-all active:scale-90"
            title="Play/Pause (Space)"
          >
            {isPlaying 
              ? <Pause className="w-6 h-6 fill-white" /> 
              : <Play className="w-6 h-6 fill-white ml-0.5" />
            }
          </button>

          <button
            onClick={() => navigateVideo('next')}
            disabled={isTransitioning}
            className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-xl transition-all hover:bg-black/70 active:scale-90 disabled:opacity-50"
            title="Next Video (↓)"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>

        {/* ──────────────────────────────────────
            UNMUTE BANNER (when muted on autoplay)
        ────────────────────────────────────── */}
        {isMuted && isPlaying && (
          <button
            onClick={(e) => { e.stopPropagation(); handleMuteToggle(); }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-[#6366F1] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-bounce hover:bg-[#8B5CF6] transition-colors"
          >
            <VolumeX className="w-4 h-4" />
            <span>Tap to Unmute</span>
          </button>
        )}
      </div>

      {/* ──────────────────────────────────────
          COMMENTS SLIDE-OVER DRAWER (Bottom sheet)
      ────────────────────────────────────── */}
      {isCommentsOpen && (
        <div className="absolute inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setIsCommentsOpen(false)}
          />
          
          {/* Drawer */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#0D1017] rounded-t-3xl border-t border-[#1F273A] shadow-2xl p-5 flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="w-10 h-1 bg-[#2D374E] rounded-full mx-auto mb-4" />
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1F273A]">
              <h3 className="font-bold text-base text-white font-display">Comments</h3>
              <button onClick={() => setIsCommentsOpen(false)} className="text-[#64748B] hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {interactionError && <div className="mb-3 text-xs font-semibold text-[#F87171]">{interactionError}</div>}

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <img src={c.userAvatar} alt={c.userHandle} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white">{c.userHandle}</span>
                      <span className="text-[10px] text-[#64748B]">{c.timeAgo}</span>
                    </div>
                    <p className="text-xs text-[#CBD5E1] leading-relaxed">{c.text}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Heart className="w-3 h-3 text-[#64748B]" />
                      <span className="text-[10px] text-[#64748B]">{c.likes}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="mt-4 pt-3 border-t border-[#1F273A] flex gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-[#131722] border border-[#1F273A] rounded-full px-4 py-2.5 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#6366F1] transition-colors"
              />
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-[#6366F1] text-white flex items-center justify-center hover:bg-[#8B5CF6] transition-colors active:scale-90 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────
          MINI BOTTOM NAV BAR (for navigation from shorts)
      ────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-6 z-20 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
};
