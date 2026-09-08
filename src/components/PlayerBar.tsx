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
  Maximize2,
  Sparkles,
  ChevronUp,
  X,
  Loader2
} from 'lucide-react';
import { html5Player, PlayerState } from '../services/html5Player';
import { Track } from '../types';
import { KineticLogo } from './KineticLogo';

interface PlayerBarProps {
  onNavigate: (tab: string) => void;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({ onNavigate }) => {
  const [playerState, setPlayerState] = useState<PlayerState>(html5Player.getState());
  const [isQueueOpen, setIsQueueOpen] = useState(false);
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

  return (
    <>
      {/* Queue Drawer Modal */}
      {isQueueOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-[#0D1017] border-l border-[#1F273A] shadow-2xl p-5 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between border-b border-[#1F273A] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-[#6366F1]" />
              <h3 className="font-bold text-sm text-white font-display">Playing Queue</h3>
            </div>
            <button 
              onClick={() => setIsQueueOpen(false)}
              className="text-[#64748B] hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

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
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-30 bg-[#0D1017]/95 backdrop-blur-xl border-t border-[#1F273A] px-4 py-2.5 shadow-2xl transition-all">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Track Information & Artwork */}
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-1/4">
            <div className="relative group flex-shrink-0">
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

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-extrabold text-white truncate hover:underline cursor-pointer" onClick={() => onNavigate('music')}>
                  {track.title}
                </h4>
                {track.format && (
                  <span className="hidden lg:inline-block text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded border border-[#10B981]/20">
                    {track.format}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8] truncate">{track.artist}</p>
            </div>

            <button
              onClick={() => setIsLikedTrack(!isLikedTrack)}
              className={`p-1.5 rounded-full transition-colors hidden sm:block ${
                isLikedTrack ? 'text-[#F43F5E]' : 'text-[#64748B] hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLikedTrack ? 'fill-[#F43F5E]' : ''}`} />
            </button>
          </div>

          {/* Center: Playback Controls & Progress Bar */}
          <div className="flex-1 max-w-xl w-full sm:w-auto flex flex-col items-center gap-1.5">
            {/* Control Buttons */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => html5Player.toggleShuffle()}
                className={`hidden sm:block p-1 rounded-full text-xs transition-colors ${
                  playerState.isShuffle ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => html5Player.previousTrack()}
                className="text-[#94A3B8] hover:text-white transition-colors"
                title="Previous Track"
              >
                <SkipBack className="w-4 h-4" />
              </button>

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
                onClick={() => html5Player.nextTrack()}
                className="text-[#94A3B8] hover:text-white transition-colors"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => html5Player.toggleRepeat()}
                className={`hidden sm:block p-1 rounded-full text-xs transition-colors ${
                  playerState.isRepeat ? 'text-[#6366F1]' : 'text-[#64748B] hover:text-white'
                }`}
                title="Repeat"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Progress Slider */}
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
          </div>

          {/* Right: Volume & Queue Tools */}
          <div className="hidden md:flex items-center gap-3 w-1/4 justify-end">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => html5Player.toggleMute()}
                className="text-[#64748B] hover:text-white transition-colors"
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
                className="w-16 h-1 bg-[#1F273A] rounded-lg appearance-none cursor-pointer accent-[#6366F1]"
              />
            </div>

            {/* Queue Toggle Button */}
            <button
              onClick={() => setIsQueueOpen(!isQueueOpen)}
              className={`p-2 rounded-xl border transition-all ${
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
