import React from 'react';

interface KineticLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export const KineticLogo: React.FC<KineticLogoProps> = ({
  className = '',
  showText = true,
  size = 'md',
  animated = false,
}) => {
  const heights = {
    sm: { height: 20, iconW: 30, textClass: 'text-sm' },
    md: { height: 28, iconW: 42, textClass: 'text-lg tracking-widest' },
    lg: { height: 38, iconW: 56, textClass: 'text-2xl tracking-[0.2em]' },
  }[size];

  return (
    <div className={`flex items-center gap-2.5 font-display font-extrabold select-none ${className}`}>
      {/* Soundwave equalizer glyph */}
      <svg
        viewBox="0 0 54 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: heights.height, width: heights.iconW }}
        className="shrink-0"
      >
        <rect
          x="3"
          y="15"
          width="6"
          height="18"
          rx="3"
          fill="#2f6bff"
          className={animated ? 'animate-pulse' : ''}
        />
        <rect
          x="13"
          y="6"
          width="6"
          height="36"
          rx="3"
          fill="#2f6bff"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDelay: '150ms' }}
        />
        <rect
          x="23"
          y="12"
          width="6"
          height="24"
          rx="3"
          fill="#8b5cf6"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDelay: '300ms' }}
        />
        <g>
          <rect
            x="33"
            y="2"
            width="6"
            height="44"
            rx="3"
            fill="#2f6bff"
            className={animated ? 'animate-pulse' : ''}
            style={{ animationDelay: '450ms' }}
          />
          <circle cx="36" cy="6" r="3" fill="#60a5fa" />
        </g>
        <rect
          x="43"
          y="10"
          width="6"
          height="28"
          rx="3"
          fill="#2f6bff"
          className={animated ? 'animate-pulse' : ''}
          style={{ animationDelay: '600ms' }}
        />
      </svg>

      {showText && (
        <div className="flex items-center tracking-wider text-white font-black">
          <span className={`${heights.textClass} text-white font-extrabold`}>KINETIC</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#2f6bff] ml-1 mb-0.5 inline-block" />
        </div>
      )}
    </div>
  );
};
