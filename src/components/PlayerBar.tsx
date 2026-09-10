import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Shuffle, 
  Repeat, 
  Heart, 
  ListMusic, 
  ChevronUp,
  ChevronDown,
  X,
  Loader2
} from 'lucide-react';
import { html5Player, PlayerState } from '../services/html5Player';
import { KineticLogo } from './KineticLogo';

interface PlayerBarProps {
  onNavigate: (tab: string) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ onNavigate }) => {
  const [playerState, setPlayerState] = useState<PlayerState>(html5Player.getState());
  const [isQueueOpen, setIsQueueOpen] = useState(false); // desktop (lg+) side drawer
  const [isExpanded, setIsExpanded] = useState(false); // mobile/tablet (<lg) full-screen now-playing
  const [isMobileQueueOpen, setIsMobileQueueOpen] = useState(false); // secondary screen over now-playing
  const [isLikedTrack, setIsLikedTrack] = useState(false);

  useEffect(() => {
    const unsubscribe = html5Player.subscribe((state) => {
      setPlayerState(state);
    });
    return unsubscribe;
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const track = playerState.currentTrack;
  const hasTrack = track.id !== 'empty-track';
  const progressPct = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  // Shared control clusters, reused between the mobile dropup sheet and the
  // desktop inline bar so behavior never drifts between the two layouts.
  const TransportButtons = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center ${compact ? 'gap-5' : 'gap-4'}`}>
      <button
        onClick={() => html5Player.toggleShuffle()}
        className={`p-1 rounded-full transition-colors ${
          playerState.isShuffle ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
        }`}
        title="Shuffle"
      >
        <Shuffle className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      </button>

      <button
        onClick={() => html5Player.previousTrack()}
        className="text-[#94A3B8] hover:text-white transition-colors"
        title="Previous Track"
      >
        <SkipBack className={compact ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>

      <button
        onClick={() => hasTrack && html5Player.togglePlay()}
        disabled={!hasTrack || playerState.isLoading}
        className={`${compact ? 'w-11 h-11' : 'w-9 h-9'} rounded-full bg-white hover:bg-[#E2E8F0] text-black flex items-center justify-center shadow-lg shadow-white/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
        title={playerState.isPlaying ? 'Pause' : 'Play'}
      >
        {playerState.isLoading ? (
          <Loader2 className={compact ? 'w-5 h-5 animate-spin' : 'w-4 h-4 animate-spin'} />
        ) : playerState.isPlaying ? (
          <Pause className={compact ? 'w-5 h-5 fill-black' : 'w-4 h-4 fill-black'} />
        ) : (
          <Play className={compact ? 'w-5 h-5 fill-black ml-0.5' : 'w-4 h-4 fill-black ml-0.5'} />
        )}
      </button>

      <button
        onClick={() => html5Player.nextTrack()}
        className="text-[#94A3B8] hover:text-white transition-colors"
        title="Next Track"
      >
        <SkipForward className={compact ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>

      <button
        onClick={() => html5Player.toggleRepeat()}
        className={`p-1 rounded-full transition-colors ${
          playerState.isRepeat ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
        }`}
        title="Repeat"
      >
        <Repeat className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      </button>
    </div>
  );

  const ProgressBar = () => (
    <div className="w-full flex items-center gap-2.5">
      <span className="text-[10px] font-semibold text-[#64748B] tabular-nums w-8 text-right">
        {formatTime(playerState.currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={playerState.duration || 100}
        value={playerState.currentTime || 0}
        onChange={(e) => html5Player.seek(Number(e.target.value))}
        className="w-full h-1 bg-[#1F273A] rounded-lg appearance-none cursor-pointer accent-[#6366F1]"
      />
      <span className="text-[10px] font-semibold text-[#64748B] tabular-nums w-8">
        {formatTime(playerState.duration)}
      </span>
    </div>
  );

  const VolumeControl = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex items-center gap-2 ${compact ? 'flex-1' : ''}`}>
      <button
        onClick={() => html5Player.toggleMute()}
        className="text-[#64748B] hover:text-white transition-colors shrink-0"
      >
        {playerState.isMuted || playerState.volume === 0 ? (
          <VolumeX className="w-4 h-4 text-[#F43F5E]" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={playerState.isMuted ? 0 : playerState.volume}
        onChange={(e) => html5Player.setVolume(Number(e.target.value))}
        className={`${compact ? 'w-full' : 'w-16'} h-1 bg-[#1F273A] rounded-lg appearance-none cursor-pointer accent-[#6366F1]`}
      />
    </div>
  );

  const QueueList = () => (
    <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
      {playerState.queue.map((t, idx) => {
        const isCurrent = idx === playerState.queueIndex;
        return (
          <button
            key={`${t.id}-${idx}`}
            onClick={() => html5Player.playTrack(t)}
            className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
              isCurrent
                ? 'bg-[#6366F1]/15 border border-[#6366F1]/40'
                : 'hover:bg-[#1B2130]'
            }`}
          >
            {t.coverUrl ? (
              <img src={t.coverUrl} alt={t.title} className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[#1B2130] flex items-center justify-center">
                <KineticLogo showText={false} size="sm" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-bold truncate ${isCurrent ? 'text-[#A5B4FC]' : 'text-white'}`}>
                {t.title}
              </div>
              <div className="text-[11px] text-[#94A3B8] truncate">{t.artist}</div>
            </div>
            <span className="text-[11px] font-medium text-[#64748B]">
              {formatTime(t.duration)}
            </span>
          </button>
        );
      })}
      {playerState.queue.length === 0 && (
        <p className="text-xs text-[#64748B] text-center py-6">Queue is empty.</p>
      )}
    </div>
  );

  return (
    <>
      {/* ── DESKTOP (lg+) SIDE QUEUE DRAWER ── */}
      {isQueueOpen && (
        <div className="hidden lg:flex fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[#0D1017] border-l border-[#1F273A] shadow-2xl p-5 flex-col animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-[#1F273A] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-[#6366F1]" />
              <h3 className="font-bold text-sm text-white font-display">Playing Queue</h3>
            </div>
            <button onClick={() => setIsQueueOpen(false)} className="text-[#64748B] hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <QueueList />
        </div>
      )}

      {/* ── MOBILE / TABLET (<lg) FULL-SCREEN "NOW PLAYING" ──
          A dedicated full-screen overlay — simple, spacious, one thing at a
          time — the way Spotify's mobile now-playing screen works, rather
          than a cramped card. Being fixed inset-0 also sidesteps any
          stacking-context/height issues a nested dropup card could hit. */}
      {isExpanded && (
        <div className="lg:hidden fixed inset-0 z-50 bg-gradient-to-b from-[#161a22] to-[#0A0C10] flex flex-col animate-in slide-in-from-bottom duration-300">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 -ml-2 text-[#94A3B8] hover:text-white transition-colors"
              aria-label="Collapse player"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <span className="text-[11px] font-bold tracking-[0.15em] text-[#64748B] uppercase">Now Playing</span>
            <button
              onClick={() => setIsMobileQueueOpen(true)}
              className="p-2 -mr-2 text-[#94A3B8] hover:text-white transition-colors"
              aria-label="Open queue"
            >
              <ListMusic className="w-5 h-5" />
            </button>
          </div>

          {/* Centered content — simple, one column, generous spacing */}
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col items-center px-8 py-6">
            <div className="w-full max-w-xs flex flex-col items-center gap-8">
              {/* Big cover art */}
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/40 border border-[#1F273A]">
                {track.coverUrl ? (
                  <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#131722] to-[#1B2130] flex items-center justify-center">
                    <KineticLogo showText={false} size="lg" animated={!hasTrack} />
                  </div>
                )}
              </div>

              {/* Title / artist / like */}
              <div className="w-full flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold text-white truncate">{track.title}</h2>
                  <p className="text-sm text-[#94A3B8] truncate mt-0.5">{track.artist}</p>
                </div>
                <button
                  onClick={() => setIsLikedTrack(!isLikedTrack)}
                  className={`p-2 rounded-full transition-colors shrink-0 ${isLikedTrack ? 'text-[#F43F5E]' : 'text-[#64748B] hover:text-white'}`}
                >
                  <Heart className={`w-5 h-5 ${isLikedTrack ? 'fill-[#F43F5E]' : ''}`} />
                </button>
              </div>

              {/* Progress */}
              <div className="w-full">
                <ProgressBar />
              </div>

              {/* Transport — big, centered, spaced out */}
              <div className="w-full flex items-center justify-center">
                <TransportButtons compact />
              </div>

              {/* Volume */}
              <div className="w-full">
                <VolumeControl compact />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile queue screen — slides in over the now-playing screen */}
      {isMobileQueueOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] bg-[#0A0C10] flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-[#1F273A] shrink-0">
            <button
              onClick={() => setIsMobileQueueOpen(false)}
              className="p-2 -ml-2 text-[#94A3B8] hover:text-white transition-colors"
              aria-label="Back to now playing"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            <ListMusic className="w-4 h-4 text-[#6366F1]" />
            <h3 className="font-bold text-sm text-white font-display">Up Next</h3>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 py-4">
            <QueueList />
          </div>
        </div>
      )}

      {/* ── PERSISTENT BOTTOM BAR ──
          <lg: compact single-row mini player — tap it to open the full-screen
               now-playing view above.
          lg+: full original inline layout with every control visible. */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-[#0D1017]/95 backdrop-blur-xl border-t border-[#1F273A] shadow-2xl transition-all">

        {/* Slim progress indicator — visible only on the compact mobile/tablet bar */}
        <div className="lg:hidden h-0.5 w-full bg-[#1F273A]">
          <div
            className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 lg:py-2.5 flex items-center gap-3 sm:gap-4">

          {/* Left: Track Information & Artwork */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 lg:flex-none lg:w-1/4">
            <button
              onClick={() => setIsExpanded(true)}
              className="lg:hidden relative group flex-shrink-0"
              aria-label="Expand player"
            >
              {track.coverUrl ? (
                <img src={track.coverUrl} alt={track.title} className="w-10 h-10 rounded-xl object-cover shadow-md border border-[#1F273A]" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#131722] to-[#1B2130] border border-[#1F273A] flex items-center justify-center shadow-md">
                  <KineticLogo showText={false} size="sm" animated={!hasTrack} />
                </div>
              )}
              {playerState.isPlaying && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                  <div className="flex items-end gap-0.5 h-3">
                    <span className="w-1 bg-[#6366F1] rounded-full equalizer-bar-1" />
                    <span className="w-1 bg-[#8B5CF6] rounded-full equalizer-bar-2" />
                    <span className="w-1 bg-[#06B6D4] rounded-full equalizer-bar-3" />
                  </div>
                </div>
              )}
            </button>

            <div className="hidden lg:block relative group flex-shrink-0">
              {track.coverUrl ? (
                <img
                  src={track.coverUrl}
                  alt={track.title}
                  className="w-12 h-12 rounded-xl object-cover shadow-md border border-[#1F273A]"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#131722] to-[#1B2130] border border-[#1F273A] flex items-center justify-center shadow-md">
                  <KineticLogo showText={false} size="sm" animated={!hasTrack} />
                </div>
              )}
              {playerState.isLoading && (
                <div className="absolute inset-0 rounded-xl bg-black/55 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-[#A5B4FC] animate-spin" />
                </div>
              )}
              {playerState.isPlaying && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                  <div className="flex items-end gap-0.5 h-4">
                    <span className="w-1 bg-[#6366F1] rounded-full equalizer-bar-1" />
                    <span className="w-1 bg-[#8B5CF6] rounded-full equalizer-bar-2" />
                    <span className="w-1 bg-[#06B6D4] rounded-full equalizer-bar-3" />
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setIsExpanded(true)} className="lg:hidden min-w-0 flex-1 text-left">
              <h4 className="text-xs font-extrabold text-white truncate">{track.title}</h4>
              <p className="text-[11px] text-[#94A3B8] truncate">{track.artist}</p>
            </button>

            <div className="hidden lg:block min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold text-white truncate hover:underline cursor-pointer" onClick={() => onNavigate('music')}>
                  {track.title}
                </h4>
                {track.format && (
                  <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded border border-[#10B981]/20">
                    {track.format}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8] truncate">{track.artist}</p>
            </div>

            <button
              onClick={() => setIsLikedTrack(!isLikedTrack)}
              className={`hidden lg:block p-1.5 rounded-full transition-colors ${
                isLikedTrack ? 'text-[#F43F5E]' : 'text-[#64748B] hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLikedTrack ? 'fill-[#F43F5E]' : ''}`} />
            </button>
          </div>

          {/* Center: Playback Controls & Progress Bar — desktop only, mobile uses the dropup */}
          <div className="hidden lg:flex flex-1 min-w-0 max-w-xl flex-col items-center gap-1.5">
            <TransportButtons />
            <ProgressBar />
          </div>

          {/* Mobile/tablet: compact play/pause + expand chevron only */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <button
              onClick={() => hasTrack && html5Player.togglePlay()}
              disabled={!hasTrack || playerState.isLoading}
              className="w-9 h-9 rounded-full bg-white hover:bg-[#E2E8F0] text-black flex items-center justify-center shadow-lg shadow-white/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title={playerState.isPlaying ? 'Pause' : 'Play'}
            >
              {playerState.isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : playerState.isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black ml-0.5" />
              )}
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              className="w-9 h-9 rounded-full bg-[#131722] border border-[#1F273A] text-[#94A3B8] hover:text-white flex items-center justify-center transition-colors"
              aria-label="Expand player"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Volume & Queue Tools — desktop only */}
          <div className="hidden lg:flex items-center gap-3 w-1/4 justify-end shrink-0">
            <VolumeControl />
            <button
              onClick={() => setIsQueueOpen(!isQueueOpen)}
              className={`p-2 rounded-xl border transition-all shrink-0 ${
                isQueueOpen
                  ? 'bg-[#6366F1]/15 text-[#6366F1] border-[#6366F1]/40'
                  : 'bg-[#131722] text-[#64748B] border-[#1F273A] hover:text-white'
              }`}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </>
  );
};
