import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bookmark, Check, ChevronDown, ChevronUp, Compass,
  Disc3, Flag, Heart, Home, Library, Loader2, LogIn, MessageCircle,
  MoreHorizontal, Music, Play, Plus, Search, Send, Share2, Upload,
  UserRound, Volume2, VolumeX, X,
} from 'lucide-react';
import { ActiveTab, AuthUser, LiveComment, ShortVideo, Track } from '../../types';
import { videoApi } from '../../services/videoApi';
import { authApi } from '../../services/authApi';
import { getSocket, joinVideoRoom, leaveVideoRoom } from '../../services/socket';
import { KineticLogo } from '../KineticLogo';
import { ReportModal } from '../ui/ReportModal';

const EMPTY_VIDEO: ShortVideo = {
  id: 'empty-video', creatorHandle: '', creatorName: '', creatorAvatar: '', verified: false,
  caption: '', thumbnailUrl: '', duration: 0, views: '0', likes: '0', likesCount: 0,
  commentsCount: '0', audioTrackTitle: '', audioArtist: '',
};

const formatCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace('.0', '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace('.0', '')}K`;
  return String(value);
};

const getSavedMuted = () => {
  try {
    const saved = localStorage.getItem('kinetic.muted');
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
};

const getViewedVideoIds = () => {
  try {
    const saved = sessionStorage.getItem('kinetic.viewedShorts');
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

interface ShortsViewProps {
  currentShort?: ShortVideo;
  refreshKey?: number;
  currentUser?: AuthUser | null;
  onSelectTrack: (track: Track) => void;
  onNavigate: (tab: ActiveTab) => void;
  onOpenUploadModal?: () => void;
  onOpenShareModal: (title: string, videoId?: string) => void;
  onOpenProfile: (username: string) => void;
}

export const ShortsView: React.FC<ShortsViewProps> = ({
  currentShort,
  refreshKey = 0,
  currentUser,
  onSelectTrack,
  onNavigate,
  onOpenUploadModal,
  onOpenShareModal,
  onOpenProfile,
}) => {
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'Following' | 'For You'>('For You');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(getSavedMuted);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [reportTarget, setReportTarget] = useState<{ id: string; caption: string } | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showHeartSplash, setShowHeartSplash] = useState(false);
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 });
  const [isBuffering, setIsBuffering] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const currentIndexRef = useRef(0);
  const wheelLockRef = useRef(false);
  const feedRequestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const initialPageLoadedRef = useRef(false);
  const lastActiveVideoIdRef = useRef('');
  const lastTapRef = useRef(0);
  const clickTimerRef = useRef<number | null>(null);
  const viewedIdsRef = useRef(new Set(getViewedVideoIds()));
  const viewProgressRef = useRef(new Map<string, { playedMs: number; startedAt: number; timer: number | null }>());
  const wasPlayingWhenHiddenRef = useRef(false);

  const activeVideo = videos[currentIndex] || EMPTY_VIDEO;
  const desktopStageWidth = Math.max(320, viewportSize.width - (viewportSize.width >= 1280 ? 240 : 72) - (isCommentsOpen && viewportSize.width >= 1024 ? 380 : 0));
  const desktopCardWidth = Math.max(180, Math.min((viewportSize.height - 24) * 9 / 16, desktopStageWidth - (isCommentsOpen ? 120 : 0)));
  const commentsCardStyle: React.CSSProperties | undefined = isCommentsOpen && viewportSize.width >= 1024
    ? { width: `${desktopCardWidth}px`, height: `${desktopCardWidth * 16 / 9}px`, transform: 'translateX(-60px)' }
    : undefined;
  const isLiked = likedMap[activeVideo.id] ?? activeVideo.isLiked ?? false;
  const isBookmarked = bookmarkedMap[activeVideo.id] ?? activeVideo.isBookmarked ?? false;
  const isFollowing = followingMap[activeVideo.creatorHandle] ?? false;

  const scrollToVideo = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const feed = feedRef.current;
    if (!feed || videos.length === 0) return;
    const boundedIndex = Math.max(0, Math.min(index, videos.length - 1));
    feed.scrollTo({ top: boundedIndex * feed.clientHeight, behavior });
  }, [videos.length]);

  const changeCategory = (category: 'Following' | 'For You') => {
    if (category === activeCategory) return;
    setActiveCategory(category);
    setIsCommentsOpen(false);
    setComments([]);
    setCurrentIndex(0);
    feedRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  };

  const loadFirstPage = useCallback(() => {
    const requestId = ++feedRequestIdRef.current;
    const token = authApi.getToken();
    initialPageLoadedRef.current = false;
    setVideos([]);
    setCurrentIndex(0);
    setPage(0);
    setHasMore(false);
    setFollowingCount(null);
    setFeedError(null);
    setIsLoading(true);
    feedRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    if (activeCategory === 'Following' && !token) {
      setIsLoading(false);
      setFeedError('Sign in to see videos from creators you follow');
      return () => {};
    }

    void videoApi.getFeedPage(1, activeCategory === 'Following', token || undefined)
      .then((result) => {
        if (requestId !== feedRequestIdRef.current) return;
        const loaded = [...result.videos];
        let index = 0;
        if (activeCategory === 'For You' && currentShort) {
          const deepLinkIndex = loaded.findIndex((video) => video.id === currentShort.id);
          if (deepLinkIndex >= 0) index = deepLinkIndex;
          else loaded.unshift(currentShort);
        }
        setVideos(loaded);
        setCurrentIndex(index);
        setPage(1);
        setHasMore(result.hasMore);
        setFollowingCount(result.followingCount ?? null);
        if (loaded.length === 0 && activeCategory === 'For You') setFeedError('No videos are available yet.');
        initialPageLoadedRef.current = true;
      })
      .catch(() => {
        if (requestId === feedRequestIdRef.current) setFeedError('Unable to load Shorts. Check your connection and try again.');
      })
      .finally(() => {
        if (requestId === feedRequestIdRef.current) setIsLoading(false);
      });
    return () => { feedRequestIdRef.current += 1; };
  }, [activeCategory, currentShort, refreshKey]);

  useEffect(() => loadFirstPage(), [loadFirstPage]);

  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || isLoading || page === 0) return;
    const token = authApi.getToken();
    if (activeCategory === 'Following' && !token) return;
    const requestId = feedRequestIdRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const result = await videoApi.getFeedPage(page + 1, activeCategory === 'Following', token || undefined);
      if (requestId !== feedRequestIdRef.current) return;
      setVideos((previous) => {
        const knownIds = new Set(previous.map((video) => video.id));
        return [...previous, ...result.videos.filter((video) => !knownIds.has(video.id))];
      });
      setPage((previous) => previous + 1);
      setHasMore(result.hasMore);
      if (typeof result.followingCount === 'number') setFollowingCount(result.followingCount);
    } catch {
      if (requestId === feedRequestIdRef.current) setInteractionError('Could not load more videos.');
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [activeCategory, hasMore, isLoading, page]);

  useEffect(() => {
    if (currentIndex >= videos.length - 3) void loadNextPage();
  }, [currentIndex, videos.length, loadNextPage]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || videos.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.6)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number((visible.target as HTMLElement).dataset.feedIndex);
      if (Number.isInteger(index)) setCurrentIndex(index);
    }, { root: feed, threshold: 0.6 });
    feed.querySelectorAll<HTMLElement>('[data-feed-index]').forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [videos.length]);

  useEffect(() => {
    if (!initialPageLoadedRef.current || videos.length === 0) return;
    const frame = requestAnimationFrame(() => scrollToVideo(currentIndex, 'auto'));
    return () => cancelAnimationFrame(frame);
  }, [currentIndex, scrollToVideo, videos.length]);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= 30) return;
      event.preventDefault();
      if (wheelLockRef.current) return;
      wheelLockRef.current = true;
      scrollToVideo(currentIndexRef.current + (event.deltaY > 0 ? 1 : -1));
      window.setTimeout(() => { wheelLockRef.current = false; }, 600);
    };
    feed.addEventListener('wheel', handleWheel, { passive: false });
    return () => feed.removeEventListener('wheel', handleWheel);
  }, [scrollToVideo]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const recordViewAfterPlayback = (videoId: string) => {
    if (viewedIdsRef.current.has(videoId)) return;
    const record = viewProgressRef.current.get(videoId) || { playedMs: 0, startedAt: Date.now(), timer: null };
    if (record.timer !== null) window.clearTimeout(record.timer);
    record.startedAt = Date.now();
    record.timer = window.setTimeout(() => {
      viewedIdsRef.current.add(videoId);
      record.timer = null;
      viewProgressRef.current.set(videoId, record);
      try {
        sessionStorage.setItem('kinetic.viewedShorts', JSON.stringify([...viewedIdsRef.current]));
      } catch {
        // Session storage can be unavailable in private browsing.
      }
      if (/^[a-f\d]{24}$/i.test(videoId)) {
        void videoApi.recordView(videoId).then(({ viewsCount }) => {
          setVideos((previous) => previous.map((video) => video.id === videoId
            ? { ...video, viewsCount, views: formatCount(viewsCount) }
            : video));
        }).catch(() => {});
      }
    }, Math.max(0, 2000 - record.playedMs));
    viewProgressRef.current.set(videoId, record);
  };

  const stopViewTimer = (videoId: string) => {
    const record = viewProgressRef.current.get(videoId);
    if (!record || record.timer === null) return;
    window.clearTimeout(record.timer);
    record.timer = null;
    record.playedMs += Date.now() - record.startedAt;
  };

  useEffect(() => {
    setIsPlaying(false);
    setIsBuffering(true);
    setVideoError(false);
    setProgress(0);
    setDuration(0);
    videos.forEach((video, index) => {
      const element = videoRefs.current.get(video.id);
      if (!element) return;
      if (index !== currentIndex) {
        element.pause();
        stopViewTimer(video.id);
        return;
      }
      if (!video.videoUrl) {
        setIsBuffering(false);
        setVideoError(true);
        return;
      }
      if (lastActiveVideoIdRef.current !== video.id) {
        element.currentTime = 0;
        lastActiveVideoIdRef.current = video.id;
      }
      element.muted = isMuted;
      if (!document.hidden) void element.play().catch(() => setIsPlaying(false));
    });
  }, [currentIndex, activeVideo.videoUrl]);

  useEffect(() => () => {
    viewProgressRef.current.forEach((record) => {
      if (record.timer !== null) window.clearTimeout(record.timer);
    });
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const active = videoRefs.current.get(activeVideo.id);
      if (document.hidden) {
        wasPlayingWhenHiddenRef.current = !!active && !active.paused;
        videoRefs.current.forEach((video, id) => {
          video.pause();
          stopViewTimer(id);
        });
        setIsPlaying(false);
      } else if (wasPlayingWhenHiddenRef.current && active) {
        void active.play().catch(() => {});
        wasPlayingWhenHiddenRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeVideo.id]);

  useEffect(() => {
    if (!isCommentsOpen || !activeVideo.id || activeVideo.id === EMPTY_VIDEO.id) return;
    void videoApi.getComments(activeVideo.id).then(setComments)
      .catch(() => setInteractionError('Comments are temporarily unavailable.'));
  }, [isCommentsOpen, activeVideo.id]);

  useEffect(() => {
    if (!activeVideo.id || activeVideo.id === EMPTY_VIDEO.id) return;
    setInteractionError(null);
    const socket = getSocket();
    joinVideoRoom(activeVideo.id);
    const handleLiveComment = (data: { videoId: string; comment: any; commentsCount: number }) => {
      if (data.videoId !== activeVideo.id) return;
      const comment: LiveComment = {
        id: data.comment._id || data.comment.id || String(Date.now()),
        userHandle: data.comment.userHandle || '@creator',
        userAvatar: data.comment.userAvatar || '',
        timeAgo: 'Just now',
        text: data.comment.text,
        likes: data.comment.likesCount || 0,
      };
      setComments((previous) => [comment, ...previous.filter((item) => item.id !== comment.id)]);
      setVideos((previous) => previous.map((video) => video.id === data.videoId
        ? { ...video, commentsCount: formatCount(data.commentsCount) }
        : video));
    };
    const handleLiveLike = (data: { videoId: string; likesCount: number }) => {
      setVideos((previous) => previous.map((video) => video.id === data.videoId
        ? { ...video, likesCount: data.likesCount, likes: formatCount(data.likesCount) }
        : video));
    };
    socket.on('video:comment_added', handleLiveComment);
    socket.on('video:like_updated', handleLiveLike);
    return () => {
      leaveVideoRoom(activeVideo.id);
      socket.off('video:comment_added', handleLiveComment);
      socket.off('video:like_updated', handleLiveLike);
    };
  }, [activeVideo.id]);

  const handleLike = async (forceLike = false) => {
    const token = authApi.getToken();
    if (!token) { setInteractionError('Sign in to like videos.'); return; }
    if (forceLike && isLiked) return;
    const videoId = activeVideo.id;
    const previousLiked = isLiked;
    const previousCount = activeVideo.likesCount || 0;
    const nextLiked = forceLike || !previousLiked;
    const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));
    setLikedMap((previous) => ({ ...previous, [videoId]: nextLiked }));
    setVideos((previous) => previous.map((video) => video.id === videoId
      ? { ...video, likesCount: nextCount, likes: formatCount(nextCount), isLiked: nextLiked }
      : video));
    try {
      const result = await videoApi.toggleLikeVideo(videoId, token);
      setLikedMap((previous) => ({ ...previous, [videoId]: result.liked }));
      if (typeof result.likesCount === 'number') setVideos((previous) => previous.map((video) => video.id === videoId
        ? { ...video, likesCount: result.likesCount!, likes: formatCount(result.likesCount!), isLiked: result.liked }
        : video));
    } catch (error) {
      setLikedMap((previous) => ({ ...previous, [videoId]: previousLiked }));
      setVideos((previous) => previous.map((video) => video.id === videoId
        ? { ...video, likesCount: previousCount, likes: formatCount(previousCount), isLiked: previousLiked }
        : video));
      setInteractionError(error instanceof Error ? error.message : 'Unable to update like.');
    }
  };

  const handleSave = async () => {
    const token = authApi.getToken();
    if (!token) { setInteractionError('Sign in to save videos.'); return; }
    const videoId = activeVideo.id;
    const previousSaved = isBookmarked;
    setBookmarkedMap((previous) => ({ ...previous, [videoId]: !previousSaved }));
    try {
      const result = await videoApi.toggleSaveVideo(videoId, token);
      setBookmarkedMap((previous) => ({ ...previous, [videoId]: result.saved }));
    } catch (error) {
      setBookmarkedMap((previous) => ({ ...previous, [videoId]: previousSaved }));
      setInteractionError(error instanceof Error ? error.message : 'Unable to save video.');
    }
  };

  const handleFollow = async () => {
    const creatorId = (activeVideo as ShortVideo & { creator?: string }).creator;
    const token = authApi.getToken();
    if (!token) { setInteractionError('Sign in to follow creators.'); return; }
    if (!creatorId || !/^[a-f\d]{24}$/i.test(creatorId)) {
      setInteractionError('This creator cannot be followed from a provider video.');
      return;
    }
    const previous = isFollowing;
    setFollowingMap((state) => ({ ...state, [activeVideo.creatorHandle]: !previous }));
    try {
      const result = await videoApi.toggleFollowCreator(creatorId, token);
      setFollowingMap((state) => ({ ...state, [activeVideo.creatorHandle]: result.following }));
    } catch (error) {
      setFollowingMap((state) => ({ ...state, [activeVideo.creatorHandle]: previous }));
      setInteractionError(error instanceof Error ? error.message : 'Unable to follow creator.');
    }
  };

  const toggleMute = () => {
    setIsMuted((previous) => {
      const next = !previous;
      try { localStorage.setItem('kinetic.muted', String(next)); } catch { /* Storage may be blocked. */ }
      const active = videoRefs.current.get(activeVideo.id);
      if (active) active.muted = next;
      return next;
    });
  };

  const togglePlayback = () => {
    const active = videoRefs.current.get(activeVideo.id);
    if (!active) return;
    if (active.paused) void active.play().catch(() => {});
    else active.pause();
  };

  const handleVideoClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
      lastTapRef.current = 0;
      const bounds = event.currentTarget.getBoundingClientRect();
      setHeartPos({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
      setShowHeartSplash(true);
      window.setTimeout(() => setShowHeartSplash(false), 800);
      void handleLike(true);
    } else {
      lastTapRef.current = now;
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        togglePlayback();
      }, 320);
    }
  };

  const handleAddComment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCommentText.trim()) return;
    const token = authApi.getToken();
    if (!token) { setInteractionError('Sign in to comment on videos.'); return; }
    void videoApi.addComment(activeVideo.id, newCommentText.trim(), token)
      .then(({ comment, commentsCount }) => {
        setComments((previous) => [comment, ...previous]);
        setVideos((previous) => previous.map((video) => video.id === activeVideo.id
          ? { ...video, commentsCount: formatCount(commentsCount) }
          : video));
        setNewCommentText('');
      })
      .catch((error: unknown) => setInteractionError(error instanceof Error ? error.message : 'Unable to post comment.'));
  };

  const seekToPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const video = videoRefs.current.get(activeVideo.id);
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!video || !duration || bounds.width === 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    video.currentTime = ratio * duration;
    setProgress(ratio * 100);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        onNavigate('home');
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) return;
      switch (event.code) {
        case 'ArrowDown': case 'KeyJ': event.preventDefault(); scrollToVideo(currentIndexRef.current + 1); break;
        case 'ArrowUp': case 'KeyK': event.preventDefault(); scrollToVideo(currentIndexRef.current - 1); break;
        case 'Space': event.preventDefault(); togglePlayback(); break;
        case 'KeyM': event.preventDefault(); toggleMute(); break;
        case 'KeyL': event.preventDefault(); void handleLike(); break;
        case 'Escape': onNavigate('home'); break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeVideo.id, isLiked, isMuted, onNavigate, scrollToVideo]);

  const activeHandle = activeVideo.creatorHandle?.replace(/^@/, '') || '';
  const activeCommentCount = Number.parseInt(activeVideo.commentsCount || '0', 10) || 0;
  const activeLikeCount = activeVideo.likesCount || Number.parseInt(activeVideo.likes || '0', 10) || 0;
  const isFollowingFeedEmpty = activeCategory === 'Following' && followingCount === 0 && !isLoading;
  const isGuestFollowingFeed = activeCategory === 'Following' && !authApi.getToken();

  const renderActionRail = () => (
    <div className="flex flex-col items-center gap-1 lg:gap-3" onClick={(event) => event.stopPropagation()}>
      <div className="relative mb-1">
        {activeVideo.creatorAvatar && <button onClick={() => onOpenProfile(activeHandle)} aria-label="Open creator profile"><img src={activeVideo.creatorAvatar} alt={activeVideo.creatorName} className="h-12 w-12 rounded-full border-2 border-white object-cover" /></button>}
        <button onClick={() => void handleFollow()} title={isFollowing ? 'Following creator' : 'Follow creator'} className="absolute -bottom-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full bg-[var(--accent)] text-[var(--text)]">{isFollowing ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}</button>
      </div>
      {[
        { label: formatCount(activeLikeCount), Icon: Heart, active: isLiked, action: () => void handleLike(), activeClass: 'text-[var(--like)]' },
        { label: formatCount(activeCommentCount), Icon: MessageCircle, active: isCommentsOpen, action: () => setIsCommentsOpen(true), activeClass: 'text-[var(--accent)]' },
        { label: isBookmarked ? 'Saved' : 'Save', Icon: Bookmark, active: isBookmarked, action: () => void handleSave(), activeClass: 'text-[var(--accent)]' },
        { label: 'Share', Icon: Share2, active: false, action: () => onOpenShareModal(activeVideo.caption, activeVideo.id), activeClass: '' },
      ].map(({ label, Icon, active, action, activeClass }) => <button key={label} onClick={action} aria-label={label} className="flex flex-col items-center gap-0.5 text-[var(--text)] lg:gap-1">
        <span className={`grid h-12 w-12 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 ${active ? activeClass : ''}`}><Icon className={`h-6 w-6 ${active && Icon === Heart ? 'fill-current' : ''}`} /></span>
        <span className="text-[11px] font-semibold leading-none text-[var(--text)] lg:text-xs">{label}</span>
      </button>)}
    </div>
  );

  const renderSection = (video: ShortVideo, index: number) => {
    const inLoadWindow = Math.abs(index - currentIndex) <= 1;
    const isCurrent = index === currentIndex;
    const hashtags: string[] = video.caption.match(/#[\w]+/g) || [];
    const creatorHandle = video.creatorHandle?.replace(/^@/, '') || '';
    return <section key={video.id} data-feed-index={index} className="relative flex h-full snap-start snap-always shrink-0 items-center justify-center">
      <div className="relative flex h-full w-full items-center justify-center gap-4 px-0 py-0 lg:px-0 lg:py-3">
        <div style={isCurrent ? commentsCardStyle : undefined} className="relative h-full w-full max-h-full overflow-hidden rounded-none bg-black lg:max-h-[calc(100dvh-24px)] lg:rounded-2xl lg:h-[calc(100dvh-24px)] lg:w-auto lg:aspect-[9/16] lg:border lg:border-white/10">
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {inLoadWindow && video.videoUrl && <video
            ref={(element) => { if (element) videoRefs.current.set(video.id, element); else videoRefs.current.delete(video.id); }}
            src={video.videoUrl}
            poster={video.thumbnailUrl || undefined}
            preload={isCurrent || index === currentIndex + 1 ? 'auto' : 'metadata'}
            loop playsInline muted={isMuted}
            onPlay={() => { if (isCurrent) { setIsPlaying(true); recordViewAfterPlayback(video.id); } }}
            onPause={() => { if (isCurrent) setIsPlaying(false); stopViewTimer(video.id); }}
            onWaiting={() => { if (isCurrent) setIsBuffering(true); }}
            onCanPlay={() => { if (isCurrent) { setIsBuffering(false); setVideoError(false); } }}
            onLoadedMetadata={(event) => { if (isCurrent) setDuration(event.currentTarget.duration || 0); }}
            onTimeUpdate={(event) => { if (isCurrent && event.currentTarget.duration) setProgress(event.currentTarget.currentTime / event.currentTarget.duration * 100); }}
            onError={() => { if (isCurrent) { setVideoError(true); setIsBuffering(false); } }}
            className="absolute inset-0 h-full w-full object-cover"
          />}
          <div onClick={isCurrent ? handleVideoClick : undefined} className="absolute inset-0 z-10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/60 to-transparent" />
          {isCurrent && isBuffering && !videoError && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--text)]" /></div>}
          {isCurrent && videoError && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/65 text-center"><p className="text-sm font-semibold">Video unavailable</p><button onClick={() => scrollToVideo(currentIndex + 1)} className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold">Next</button></div>}
          {isCurrent && showHeartSplash && <Heart className="animate-heart-splash pointer-events-none absolute z-40 h-20 w-20 fill-[var(--like)] text-[var(--like)] drop-shadow-2xl" style={{ left: heartPos.x - 40, top: heartPos.y - 40 }} />}
          {isCurrent && !isPlaying && !isBuffering && !videoError && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center"><span className="grid h-16 w-16 animate-in fade-in duration-200 place-items-center rounded-full bg-black/50"><Play className="ml-1 h-8 w-8 fill-white" /></span></div>}

          {isCurrent && <>
            <button onClick={toggleMute} className="group absolute left-3 top-3 z-30 flex items-center gap-2 rounded-full bg-black/45 p-2 text-[var(--text)]" aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              <input type="range" min="0" max="1" step="0.05" defaultValue="1" onClick={(event) => event.stopPropagation()} onChange={(event) => { const element = videoRefs.current.get(activeVideo.id); if (element) element.volume = Number(event.target.value); if (isMuted) toggleMute(); }} className="hidden w-20 accent-[var(--accent)] group-hover:block" aria-label="Volume" />
            </button>
            <div className="absolute right-3 top-3 z-30">
              <button onClick={() => setShowMenu((open) => !open)} aria-label="More video actions" className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-[var(--text)]"><MoreHorizontal /></button>
              {showMenu && <div className="absolute right-0 top-12 w-36 rounded-lg border border-white/10 bg-[var(--raised)] p-1 shadow-xl"><button onClick={() => { setReportTarget({ id: video.id, caption: video.caption }); setShowMenu(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10"><Flag className="h-4 w-4" />Report</button></div>}
            </div>
            <div className="absolute bottom-[76px] left-4 right-20 z-20 space-y-2 text-[var(--text)] lg:bottom-6 lg:right-4" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center gap-2">
                <button onClick={() => onOpenProfile(creatorHandle)} className="text-sm font-extrabold hover:underline">@{creatorHandle}</button>
                {video.verified && <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--accent)]"><Check className="h-3 w-3" /></span>}
                <span className="hidden text-xs text-[var(--text)]/60 lg:inline">{video.creatorName}</span>
                <button onClick={() => void handleFollow()} className="hidden rounded-full border border-white/40 px-3 py-1 text-[11px] font-bold hover:border-[var(--accent)] hover:bg-[var(--accent)] lg:inline">{isFollowing ? 'Following' : 'Follow'}</button>
              </div>
              <p className={`max-w-full text-sm leading-snug ${captionExpanded ? '' : 'line-clamp-2'}`}>
                {video.caption.split(/(#[\w]+)/g).map((part, partIndex) => hashtags.includes(part) ? <strong key={partIndex} className="font-extrabold">{part} </strong> : <React.Fragment key={partIndex}>{part}</React.Fragment>)}
                {video.caption.length > 100 && <button onClick={() => setCaptionExpanded((expanded) => !expanded)} className="ml-1 font-bold">{captionExpanded ? 'less' : 'more'}</button>}
              </p>
              <button onClick={() => onSelectTrack({ id: `sound-${video.id}`, title: video.audioTrackTitle, artist: video.audioArtist, album: 'Original Sound', coverUrl: video.thumbnailUrl, duration: 180 })} className="flex max-w-full items-center gap-2 overflow-hidden rounded-full bg-black/40 px-3 py-1.5 text-left">
                <Disc3 className="h-4 w-4 shrink-0 animate-spin text-[var(--text)]" />
                <span className="overflow-hidden whitespace-nowrap text-xs font-bold" style={{ animation: 'shorts-marquee 12s linear infinite' }}>{video.audioTrackTitle} · {video.audioArtist}</span>
                              <span className="inline-block overflow-hidden whitespace-nowrap text-xs font-bold" style={{ animation: 'shorts-marquee 12s linear infinite' }}>{video.audioTrackTitle} · {video.audioArtist}</span>
              </button>
            </div>
            <div className="group absolute inset-x-0 bottom-0 z-30 h-1 cursor-pointer bg-white/20 transition-all hover:h-2" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); seekToPointer(event); }} onPointerMove={(event) => { if (event.buttons === 1) seekToPointer(event); }}><div className="h-full bg-[var(--accent)]" style={{ width: `${progress}%` }} /></div>
          </>}
        </div>
      </div>
    </section>;
  };

  const renderComments = (desktop: boolean) => <aside className={desktop
    ? 'relative hidden h-full w-[380px] shrink-0 flex-col border-l border-white/10 bg-[var(--bg)] p-5 lg:flex'
    : 'absolute inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col rounded-t-2xl border-t border-white/10 bg-[var(--bg)] p-5 lg:hidden'}>
    <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3"><h2 className="text-sm font-bold">Comments</h2><button onClick={() => setIsCommentsOpen(false)} aria-label="Close comments" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button></div>
    {interactionError && <p className="mb-3 text-xs text-[var(--danger)]">{interactionError}</p>}
    <div className="flex-1 space-y-4 overflow-y-auto">
      {comments.map((comment) => <div key={comment.id} className="flex gap-3"><button onClick={() => onOpenProfile(comment.userHandle.replace(/^@/, ''))}><img src={comment.userAvatar} alt="" className="h-9 w-9 rounded-full object-cover" /></button><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><button onClick={() => onOpenProfile(comment.userHandle.replace(/^@/, ''))} className="text-xs font-bold text-white/80">{comment.userHandle}</button><span className="text-[10px] text-white/40">{comment.timeAgo}</span></div><p className="mt-1 text-xs leading-relaxed text-white/90">{comment.text}</p></div><span className="text-[10px] text-white/50">♥ {comment.likes}</span></div>)}
    </div>
    <form onSubmit={handleAddComment} className="mt-4 flex gap-2 border-t border-white/10 pt-4"><input value={newCommentText} onChange={(event) => setNewCommentText(event.target.value)} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-xs text-[var(--text)] placeholder:text-[var(--text)]/40 focus:border-[var(--accent)] focus:outline-none" /><button type="submit" aria-label="Send comment" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent)]"><Send className="h-4 w-4" /></button></form>
  </aside>;

  const retryFeed = () => { void loadFirstPage(); };

  return <div className="fixed inset-0 z-50 flex h-[100dvh] overflow-hidden bg-black text-[var(--text)]">
    <style>{'@keyframes shorts-marquee { from { transform: translateX(0); } to { transform: translateX(-35%); } } @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; scroll-behavior: auto !important; transition-duration: 0.01ms !important; } }'}</style>

    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-white/10 bg-black px-5 py-7 lg:flex max-[1279px]:w-[72px] max-[1279px]:items-center max-[1279px]:px-2">
      <button onClick={() => onNavigate('home')} className="mb-9 flex items-center max-[1279px]:justify-center" aria-label="Kinetic home"><KineticLogo size="sm" className="max-[1279px]:hidden" /><KineticLogo size="sm" showText={false} className="hidden max-[1279px]:flex" /></button>
      <input value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onNavigate('discover'); }} placeholder="Search" className="mb-5 h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm placeholder:text-[var(--text)]/45 focus:border-[var(--accent)] focus:outline-none max-[1279px]:hidden" />
      <nav className="flex w-full flex-col gap-1">
        {[
          { label: 'For You', Icon: Play, action: () => changeCategory('For You'), active: activeCategory === 'For You' },
          { label: 'Following', Icon: Heart, action: () => changeCategory('Following'), active: activeCategory === 'Following' },
          { label: 'Discover', Icon: Compass, action: () => onNavigate('discover') },
          { label: 'Music', Icon: Music, action: () => onNavigate('music') },
          { label: 'Library', Icon: Library, action: () => onNavigate('library') },
        ].map(({ label, Icon, action, active }) => <button key={label} onClick={action} title={label} className={`flex h-12 items-center gap-4 rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-white/10 max-[1279px]:w-12 max-[1279px]:justify-center max-[1279px]:px-0 ${active ? 'text-[var(--accent)]' : 'text-[var(--text)]/80'}`}><Icon className="h-5 w-5 shrink-0" /><span className="max-[1279px]:hidden">{label}</span></button>)}
      </nav>
      <button onClick={onOpenUploadModal} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-sm font-bold transition-colors hover:bg-[var(--accent)] max-[1279px]:w-12"><Upload className="h-4 w-4" /><span className="max-[1279px]:hidden">Upload</span></button>
      <div className="mt-auto flex w-full flex-col gap-1 border-t border-white/10 pt-4">
        <button onClick={() => currentUser ? onOpenProfile(currentUser.username) : onNavigate('auth')} title="Profile" className="flex h-12 items-center gap-4 rounded-lg px-3 text-sm font-semibold text-[var(--text)]/80 hover:bg-white/10 max-[1279px]:justify-center max-[1279px]:px-0">{currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" /> : <UserRound className="h-5 w-5" />}<span className="max-[1279px]:hidden">Profile</span></button>
        {!currentUser && <button onClick={() => onNavigate('auth')} title="Sign in" className="flex h-12 items-center gap-4 rounded-lg px-3 text-sm font-semibold text-[var(--text)]/80 hover:bg-white/10 max-[1279px]:justify-center max-[1279px]:px-0"><LogIn className="h-5 w-5" /><span className="max-[1279px]:hidden">Sign in</span></button>}
      </div>
    </aside>

    <main className="relative flex min-w-0 flex-1 lg:ml-[240px] max-[1279px]:lg:ml-[72px]">
      <div className="relative flex min-w-0 flex-1 items-center justify-center">
        <div ref={feedRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain no-scrollbar">
          {videos.map(renderSection)}
          {isLoading && videos.length === 0 && <div className="grid h-full place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" /></div>}
          {feedError && videos.length === 0 && <div className="absolute inset-0 z-20 grid place-items-center p-8 text-center"><div className="max-w-sm"><p className="text-sm font-semibold">{feedError}</p>{isGuestFollowingFeed ? <button onClick={() => onNavigate('auth')} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold">Sign in</button> : isFollowingFeedEmpty ? <button onClick={() => onNavigate('discover')} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold">Discover creators</button> : <button onClick={retryFeed} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold">Retry</button>}</div></div>}
          {isFollowingFeedEmpty && <div className="absolute inset-0 z-20 grid place-items-center p-8 text-center"><div><p className="text-sm font-semibold">Follow creators to see their videos here</p><button onClick={() => onNavigate('discover')} className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold">Discover creators</button></div></div>}
          {isLoadingMore && <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2"><Loader2 className="h-5 w-5 animate-spin text-[var(--text)]" /></div>}
        </div>
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-5 lg:hidden"><div className="pointer-events-auto flex items-center gap-6 rounded-full bg-black/25 px-5 py-2 backdrop-blur-sm">{(['Following', 'For You'] as const).map((category) => <button key={category} onClick={() => changeCategory(category)} className={`border-b-2 pb-1 text-sm font-extrabold ${activeCategory === category ? 'border-[var(--accent)] text-[var(--text)]' : 'border-transparent text-[var(--text)]/60'}`}>{category}</button>)}</div></div>
          <div className="absolute right-3 top-5 z-30 lg:hidden"><button onClick={() => onNavigate('discover')} aria-label="Search" className="grid h-10 w-10 place-items-center rounded-full bg-black/30"><Search className="h-5 w-5" /></button></div>
          <div style={isCommentsOpen ? { left: `calc(50% - 60px + ${desktopCardWidth / 2 + 72}px)`, right: 'auto' } : undefined} className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex"><button disabled={currentIndex === 0} onClick={() => scrollToVideo(currentIndex - 1)} aria-label="Previous video" className="grid h-12 w-12 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30"><ChevronUp /></button><button disabled={currentIndex >= videos.length - 1 && !hasMore} onClick={() => scrollToVideo(currentIndex + 1)} aria-label="Next video" className="grid h-12 w-12 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30"><ChevronDown /></button></div>
          {videos.length > 0 && <div className="absolute bottom-[84px] right-3 z-30 flex lg:hidden">{renderActionRail()}</div>}
          {videos.length > 0 && <div className="absolute bottom-3 z-30 hidden lg:flex" style={{ left: isCommentsOpen ? `calc(50% - 48px + ${desktopCardWidth / 2}px)` : 'calc(50% + 28.125dvh + 8px)' }}>{renderActionRail()}</div>}
          <nav className="absolute inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-white/10 bg-black/65 backdrop-blur-md lg:hidden">
            <button onClick={() => onNavigate('home')} aria-label="Home" className="grid place-items-center text-[var(--text)]/75"><Home className="h-5 w-5" /><span className="mt-1 text-[10px]">Home</span></button>
            <button onClick={() => onNavigate('discover')} aria-label="Discover" className="grid place-items-center text-[var(--text)]/75"><Compass className="h-5 w-5" /><span className="mt-1 text-[10px]">Discover</span></button>
            <button onClick={onOpenUploadModal} aria-label="Upload" className="grid h-10 w-12 place-items-center rounded-lg bg-[var(--accent)] text-[var(--text)]"><Plus className="h-7 w-7" /></button>
            <button onClick={() => onNavigate('music')} aria-label="Music" className="grid place-items-center text-[var(--text)]/75"><Music className="h-5 w-5" /><span className="mt-1 text-[10px]">Music</span></button>
            <button onClick={() => currentUser ? onOpenProfile(currentUser.username) : onNavigate('auth')} aria-label="Profile" className="grid place-items-center text-[var(--text)]/75"><UserRound className="h-5 w-5" /><span className="mt-1 text-[10px]">Profile</span></button>
          </nav>
        </>
      </div>
      {isCommentsOpen && renderComments(true)}
      {isCommentsOpen && <><div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setIsCommentsOpen(false)} />{renderComments(false)}</>}
    </main>
    {interactionError && !isCommentsOpen && <div className="absolute left-1/2 top-5 z-[80] -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-center text-xs text-[var(--danger)]">{interactionError}</div>}
    {reportTarget && <ReportModal targetType="video" targetId={reportTarget.id} targetLabel={reportTarget.caption} onClose={() => setReportTarget(null)} />}
  </div>;
};