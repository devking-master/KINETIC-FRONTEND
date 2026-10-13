import React from 'react';
import { Loader2, AlertCircle, SearchX, Radio, WifiOff } from 'lucide-react';

type StateType = 'loading' | 'error' | 'empty' | 'offline';

interface StateFeedbackProps {
  state: StateType;
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  /** Number of skeleton card columns to show in loading state */
  skeletonCount?: number;
  /** Compact mode - smaller sizing for inline use */
  compact?: boolean;
}

const SkeletonCard: React.FC = () => (
  <div className="bg-[#131722] border border-[#1F273A] rounded-2xl overflow-hidden animate-pulse">
    <div className="aspect-square bg-[#1B2130]" />
    <div className="p-3 space-y-2">
      <div className="h-3 bg-[#1B2130] rounded-full w-4/5" />
      <div className="h-2.5 bg-[#1B2130] rounded-full w-3/5" />
    </div>
  </div>
);

const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 p-3 bg-[#131722] border border-[#1F273A] rounded-2xl animate-pulse">
    <div className="w-10 h-10 rounded-xl bg-[#1B2130] shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-[#1B2130] rounded-full w-3/4" />
      <div className="h-2 bg-[#1B2130] rounded-full w-1/2" />
    </div>
  </div>
);

export const StateFeedback: React.FC<StateFeedbackProps> = ({
  state,
  title,
  message,
  action,
  skeletonCount = 6,
  compact = false,
}) => {
  if (state === 'loading') {
    const gridClass = skeletonCount <= 3
      ? `grid grid-cols-1 sm:grid-cols-${skeletonCount} gap-4`
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4';
    const showRows = skeletonCount <= 3;

    return showRows ? (
      <div className="space-y-2">
        {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    ) : (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const stateConfig = {
    error: {
      icon: <AlertCircle className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} text-[#F43F5E]/60`} />,
      defaultTitle: 'Something went wrong',
      defaultMessage: 'We hit a snag. Please try again.',
      color: 'text-[#F43F5E]',
    },
    empty: {
      icon: <SearchX className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} text-[#1F273A]`} />,
      defaultTitle: 'Nothing here yet',
      defaultMessage: 'Content will appear once available.',
      color: 'text-[#64748B]',
    },
    offline: {
      icon: <WifiOff className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} text-[#64748B]`} />,
      defaultTitle: "You're offline",
      defaultMessage: 'Check your connection and try again.',
      color: 'text-[#94A3B8]',
    },
  } as const;

  const config = stateConfig[state as keyof typeof stateConfig];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 gap-2' : 'py-16 gap-4'}`}>
      <div className={`${compact ? 'p-3' : 'p-5'} rounded-3xl bg-[#0D1117] border border-[#1F273A]`}>
        {config.icon}
      </div>
      <div>
        <p className={`font-bold text-white ${compact ? 'text-sm' : 'text-base'}`}>
          {title ?? config.defaultTitle}
        </p>
        <p className={`text-[#64748B] mt-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {message ?? config.defaultMessage}
        </p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-5 py-2 rounded-full bg-[#6366F1] text-white text-xs font-bold hover:bg-[#4F46E5] transition-colors active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

/** Simple inline loading spinner for button / small contexts */
export const SpinnerInline: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => (
  <Loader2 className={`animate-spin ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
);

/** Empty placeholder specifically for the Shorts feed */
export const EmptyFeed: React.FC<{ onUpload?: () => void }> = ({ onUpload }) => (
  <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
    <div className="p-6 rounded-3xl bg-[#0D1117] border border-[#1F273A]">
      <Radio className="w-14 h-14 text-[#1F273A]" />
    </div>
    <div>
      <h3 className="text-xl font-black text-white font-display">No Shorts Yet</h3>
      <p className="text-sm text-[#64748B] mt-2 max-w-xs">
        Kinetic Shorts are your stage. Upload a vertical video to get started.
      </p>
    </div>
    {onUpload && (
      <button
        onClick={onUpload}
        className="px-6 py-3 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold text-sm hover:opacity-90 transition-opacity active:scale-95 shadow-lg shadow-[#6366F1]/30"
      >
        Upload Your First Short
      </button>
    )}
  </div>
);
