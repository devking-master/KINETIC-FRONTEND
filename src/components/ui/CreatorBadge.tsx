import React from 'react';
import { SealCheck } from './Icon';

interface CreatorBadgeProps {
  variant?: 'verified';
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
}

const sizeClasses = {
  sm: 'gap-1 px-1.5 py-0.5 text-[9px]',
  md: 'gap-1 px-2 py-0.5 text-[10px]',
  lg: 'gap-1.5 px-2.5 py-1 text-xs',
};

export const CreatorBadge: React.FC<CreatorBadgeProps> = ({ variant, size = 'md', iconOnly = false }) => {
  if (variant !== 'verified') return null;

  return (
    <span className={`inline-flex items-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] font-bold text-[var(--accent)] ${sizeClasses[size]}`} title="Verified creator">
      <SealCheck weight="fill" />
      {!iconOnly && <span>Verified</span>}
    </span>
  );
};
