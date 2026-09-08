import React from 'react';

interface MediaLoadingStateProps {
  compact?: boolean;
}

export const MediaLoadingState: React.FC<MediaLoadingStateProps> = ({ compact = false }) => (
  <div className={`flex flex-col items-center justify-center gap-3 text-[#A5B4FC] ${compact ? 'py-8' : 'min-h-[260px] py-16'}`} role="status" aria-label="Loading">
    <div className="flex h-16 items-center justify-center gap-1.5 px-5">
      <span className="equalizer-bar-1 h-2 w-1.5 rounded-full bg-[#6366F1]" />
      <span className="equalizer-bar-2 h-2 w-1.5 rounded-full bg-[#7C5CFF]" />
      <span className="equalizer-bar-3 h-2 w-1.5 rounded-full bg-[#8B5CF6]" />
      <span className="equalizer-bar-4 h-2 w-1.5 rounded-full bg-[#06B6D4]" />
      <span className="equalizer-bar-2 h-2 w-1.5 rounded-full bg-[#8B5CF6]" />
      <span className="equalizer-bar-3 h-2 w-1.5 rounded-full bg-[#7C5CFF]" />
      <span className="equalizer-bar-1 h-2 w-1.5 rounded-full bg-[#6366F1]" />
    </div>
    <span className="text-xs font-semibold text-[#94A3B8]">Loading</span>
  </div>
);
