import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageCircle, Music2, Play, Share2, Shuffle, SkipBack, SkipForward, Repeat, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ShortVideo, Track } from '../../types';
import { videoApi } from '../../services/videoApi';
import { musicApi } from '../../services/musicApi';
import { KineticLogo } from '../KineticLogo';

interface AuthShowcaseProps {
  children: React.ReactNode;
  isExiting: boolean;
  isSignup: boolean;
  isSwapping: boolean;
  onModeSwitch: () => void;
}

const signupTaglines = [
  ['Share your', 'first short.'],
  ['Meet the creators', 'behind every beat.'],
  ['Your feed starts', 'with a feeling.'],
];

const loginTaglines = [
  ['Pick up where', 'the music left off.'],
  ['Your favorites', 'are waiting here.'],
  ['Your music is', 'waiting here.'],
];

const getMediaPreference = () => {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.innerWidth >= 640
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !connection?.saveData;
};

export const AuthShowcase: React.FC<AuthShowcaseProps> = ({ children, isExiting, isSignup, isSwapping, onModeSwitch }) => {
  const taglines = isSignup ? signupTaglines : loginTaglines;
  const [videos, setVideos] = useState<ShortVideo[]>([]);
  const [tracks, setTracks] = useState<Pick<Track, 'coverUrl' | 'title' | 'artist' | 'duration'>[]>([]);
  const [activeVideo, setActiveVideo] = useState(0);
  const [activeTrack, setActiveTrack] = useState(0);
  const [trackProgress, setTrackProgress] = useState(0);
  const [failedTrackCovers, setFailedTrackCovers] = useState<string[]>([]);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [desktopLayout, setDesktopLayout] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const videoRefs = useRef(new Map<string, HTMLVideoElement>());
  const desktopSlide = desktopLayout && !reducedMotion;

  useEffect(() => {
    const viewportQuery = window.matchMedia('(min-width: 1024px)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateViewport = () => setDesktopLayout(viewportQuery.matches);
    const updateMotionPreference = () => setReducedMotion(motionQuery.matches);
    viewportQuery.addEventListener('change', updateViewport);
    motionQuery.addEventListener('change', updateMotionPreference);
    return () => {
      viewportQuery.removeEventListener('change', updateViewport);
      motionQuery.removeEventListener('change', updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    let fetched = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const fetchAfterIdle = () => {
      if (cancelled || fetched || !getMediaPreference()) return;
      fetched = true;
      void videoApi.getTrendingVideos().then((results) => {
        if (!cancelled) setVideos(results.slice(0, 3));
      });
    };
    const schedule = () => {
      if (!getMediaPreference() || fetched || idleId !== undefined || timeoutId !== undefined) return;
      if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(fetchAfterIdle, { timeout: 3000 });
      else timeoutId = window.setTimeout(fetchAfterIdle, 1200);
    };
    schedule();
    window.addEventListener('resize', schedule);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', schedule);
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: number | undefined;
    let fetched = false;
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const fetchAfterIdle = () => {
      if (cancelled || fetched || !getMediaPreference()) return;
      fetched = true;
      void musicApi.getTrendingTracks().then((results) => {
        if (!cancelled) {
          setTracks(results.slice(0, 3).map(({ coverUrl, title, artist, duration }) => ({ coverUrl, title, artist, duration })));
        }
      }).catch(() => {
        if (!cancelled) setTracks([]);
      });
    };
    const schedule = () => {
      if (!getMediaPreference() || fetched || idleId !== undefined || timeoutId !== undefined) return;
      if (idleWindow.requestIdleCallback) idleId = idleWindow.requestIdleCallback(fetchAfterIdle, { timeout: 3000 });
      else timeoutId = window.setTimeout(fetchAfterIdle, 1200);
    };
    schedule();
    window.addEventListener('resize', schedule);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', schedule);
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (videos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActiveVideo((index) => (index + 1) % videos.length), 6000);
    return () => window.clearInterval(timer);
  }, [videos]);

  useEffect(() => {
    if (tracks.length === 0 || reducedMotion) return;
    let startedAt = Date.now();
    const timer = window.setInterval(() => {
      const progress = (Date.now() - startedAt) / 6000;
      if (progress >= 1) {
        startedAt = Date.now();
        setTrackProgress(0);
        setActiveTrack((index) => (index + 1) % tracks.length);
      } else {
        setTrackProgress(progress);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [activeTrack, reducedMotion, tracks]);

  useEffect(() => {
    videoRefs.current.forEach((video) => video.pause());
    if (!isSignup) return;
    const video = videos[activeVideo];
    const activeElement = video ? videoRefs.current.get(video.id) : undefined;
    void activeElement?.play().catch(() => {});
  }, [activeVideo, isSignup, videos]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setTaglineIndex(0);
    const timer = window.setInterval(() => setTaglineIndex((index) => (index + 1) % taglines.length), 4000);
    return () => window.clearInterval(timer);
  }, [isSignup]);

  const panelTransition = isSwapping && desktopSlide
    ? { duration: 0.68, ease: [0.65, 0, 0.35, 1] as [number, number, number, number] }
    : { duration: 0 };

  const currentTrack = tracks[activeTrack];
  const nextTracks = tracks.length > 1
    ? [tracks[(activeTrack + 1) % tracks.length], tracks[(activeTrack + 2) % tracks.length]].slice(0, 2)
    : [];
  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  const phone = (compact = false) => (
    <div className={`showcase-phone ${compact ? 'showcase-phone-compact' : ''} ${isSignup ? 'showcase-phone-right' : 'showcase-phone-left'}`}>
      <div className="phone-screen">
        <div className="phone-notch" />
        <div className={`phone-media phone-video-screen ${isSignup ? 'is-visible' : ''}`} aria-hidden={!isSignup}>
          {videos.map((video, index) => (
            <video
              key={video.id}
              ref={(element) => {
                if (element) videoRefs.current.set(video.id, element);
                else videoRefs.current.delete(video.id);
              }}
              className={index === activeVideo ? 'phone-video active' : 'phone-video'}
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              muted
              loop
              playsInline
              autoPlay={isSignup}
              preload="metadata"
              aria-hidden="true"
            />
          ))}
          <div className="phone-fallback"><KineticLogo size="md" /></div>
          <div className="phone-short-content">
            <div className="phone-action-stack"><span><Heart size={15} fill="currentColor" /></span><span><MessageCircle size={15} /></span><span><Share2 size={15} /></span></div>
            <div className="phone-caption"><b>@kinetic</b><span>{videos[activeVideo]?.caption || (isSignup ? 'Your next favorite sound is here.' : 'Stories worth staying for.')}</span></div>
          </div>
        </div>
        <div className={`phone-music-screen ${!isSignup ? 'is-visible' : ''}`} aria-hidden={isSignup}>
          <div className="music-player-content">
            <div className="music-art-wrap">
              <div className="music-vinyl" aria-hidden="true" />
              {currentTrack?.coverUrl && !failedTrackCovers.includes(currentTrack.coverUrl)
                ? <img className="music-album-art" src={currentTrack.coverUrl} alt="" onError={() => setFailedTrackCovers((items) => [...items, currentTrack.coverUrl])} />
                : <div className="music-album-placeholder"><KineticLogo size="md" /></div>}
            </div>
            <div className="music-track-heading">
              <div className="music-track-copy"><b>{currentTrack?.title || 'Find your next track'}</b><span>{currentTrack?.artist || 'Kinetic Radio'}</span></div>
              <Heart className="music-heart" size={15} />
            </div>
            <div className="music-progress"><span style={{ transform: `scaleX(${trackProgress})` }} /></div>
            <div className="music-time"><span>{formatTime((currentTrack?.duration || 0) * trackProgress)}</span><span>{formatTime(currentTrack?.duration || 0)}</span></div>
            <div className="music-transport" aria-hidden="true">
              <Shuffle size={13} />
              <SkipBack size={14} fill="currentColor" />
              <span className="music-play-button"><Play size={15} fill="currentColor" /></span>
              <SkipForward size={14} fill="currentColor" />
              <Repeat size={13} />
            </div>
            <div className="music-waveform" aria-hidden="true">
              {Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--bar-height': `${30 + ((index * 37) % 68)}%`, '--bar-delay': `${index * -0.055}s` } as React.CSSProperties} />)}
            </div>
            <div className="music-up-next">
              <b>Up next</b>
              {(nextTracks.length ? nextTracks : [{ title: 'More music', artist: 'Kinetic Radio', coverUrl: '', duration: 0 }, { title: 'Your next favorite', artist: 'Kinetic Radio', coverUrl: '', duration: 0 }]).map((track, index) => (
                <div className="music-next-row" key={`${track.title}-${index}`}>
                  {track.coverUrl && !failedTrackCovers.includes(track.coverUrl)
                    ? <img src={track.coverUrl} alt="" onError={() => setFailedTrackCovers((items) => [...items, track.coverUrl])} />
                    : <span className="music-next-placeholder"><Music2 size={11} /></span>}
                  <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`auth-card-grid ${isExiting ? 'auth-showcase-exiting' : ''}`}>
      <motion.section
        className={`auth-left ${isSwapping ? 'auth-panel-swapping' : ''}`}
        initial={false}
        animate={{
          x: isExiting ? (desktopSlide ? (isSignup ? '-40px' : 'calc(100% + 40px)') : desktopLayout ? (isSignup ? '0%' : '100%') : 0) : desktopLayout ? (isSignup ? '0%' : '100%') : 0,
          opacity: isExiting ? 0 : 1,
          filter: isExiting && desktopSlide ? 'blur(8px)' : 'blur(0px)',
        }}
        transition={isExiting ? { duration: desktopSlide ? 0.45 : 0.15, ease: 'easeIn', delay: desktopSlide ? 0.15 : 0 } : panelTransition}
        aria-hidden={isSwapping}
      >
        <div className="auth-mobile-preview" aria-hidden="true">{phone(true)}</div>
        {children}
      </motion.section>
      <motion.aside
        className={`auth-showcase-panel ${isSignup ? '' : 'showcase-is-signin'} ${isSwapping ? 'auth-panel-swapping' : ''}`}
        aria-label="Kinetic preview"
        initial={false}
        animate={{
          x: isExiting && desktopSlide ? (isSignup ? '40px' : 'calc(-100% - 40px)') : desktopLayout ? (isSignup ? '0%' : '-100%') : 0,
          opacity: isExiting ? 0 : 1,
          filter: isExiting && desktopSlide ? 'blur(8px)' : 'blur(0px)',
        }}
        transition={isExiting ? { duration: desktopSlide ? 0.45 : 0.15, ease: 'easeIn', delay: desktopSlide ? 0.15 : 0 } : panelTransition}
      >
        <div className="showcase-pattern" aria-hidden="true" />
        <div className="showcase-brand"><KineticLogo size="md" animated /></div>
        <motion.div
          className="showcase-stage"
          animate={{ x: isSwapping && desktopSlide ? (isSignup ? [-20, 0] : [20, 0]) : 0 }}
          transition={isSwapping && desktopSlide ? { duration: 0.68, ease: [0.65, 0, 0.35, 1] } : { duration: 0 }}
        >
          {phone()}
          {!isSignup ? <>
            <div className="showcase-music-float"><span className="music-disc"><Music2 size={16} /></span><span className="music-copy"><b>Now playing</b><small>{currentTrack?.title || 'Your saved music'}</small></span><span className="equalizer"><i /><i /><i /><i /></span></div>
            <div className="showcase-like-float"><Heart size={14} /> Liked songs +1</div>
          </> : <>
            <div className="showcase-video-float"><span className="video-float-thumb"><Play size={11} fill="currentColor" /></span><span><b>New short</b><small>Ready to share</small></span></div>
            <div className="showcase-short-float"><span className="short-float-bars"><i /><i /><i /></span> Your first post</div>
          </>}
        </motion.div>
        <div className="showcase-tagline" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div className="showcase-copy" key={isSignup ? 'signup-copy' : 'signin-copy'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <strong>{isSignup ? 'Start creating' : 'Pick up where the music left off.'}</strong>
              <p>{taglines[taglineIndex][0]}<br />{taglines[taglineIndex][1]}</p>
            </motion.div>
          </AnimatePresence>
          <div className="showcase-dots">{taglines.map((_, index) => <span key={index} className={index === taglineIndex ? 'selected' : ''} />)}</div>
        </div>
        <button className="showcase-mode-switch" type="button" onClick={onModeSwitch} disabled={isSwapping || isExiting}>
          {isSignup ? 'Already have an account? Sign in' : 'New here? Create account'} <span aria-hidden="true">→</span>
        </button>
        <div className="showcase-play-mark"><Play size={13} fill="currentColor" /> KINETIC / 01</div>
      </motion.aside>
    </div>
  );
};