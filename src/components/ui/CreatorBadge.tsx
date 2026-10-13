import React from 'react';
import { CheckCircle2, Zap, Crown, Star } from 'lucide-react';

type BadgeVariant = 'verified' | 'pro' | 'rising' | 'top-creator';

interface CreatorBadgeProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  /** If true, only show the icon without a label */
  iconOnly?: boolean;
  followersCount?: number;
}

const BADGE_CONFIG: Record<BadgeVariant, { icon: React.ElementType; label: string; className: string }> = {
  verified: {
    icon: CheckCircle2,
    label: 'Verified',
    className: 'bg-[#3B82F6]/20 text-[#60A5FA] border-[#3B82F6]/30',
  },
  pro: {
    icon: Crown,
    label: 'Pro',
    className: 'bg-gradient-to-r from-[#F59E0B]/20 to-[#F43F5E]/20 text-[#F59E0B] border-[#F59E0B]/30',
  },
  rising: {
    icon: Zap,
    label: 'Rising',
    className: 'bg-[#10B981]/20 text-[#34D399] border-[#10B981]/30',
  },
  'top-creator': {
    icon: Star,
    label: 'Top Creator',
    className: 'bg-gradient-to-r from-[#6366F1]/20 to-[#8B5CF6]/20 text-[#A78BFA] border-[#6366F1]/30',
  },
};

const SIZE_CLASSES = {
  sm: { wrapper: 'px-1.5 py-0.5 gap-0.5 rounded-full', icon: 'w-2.5 h-2.5', text: 'text-[9px]' },
  md: { wrapper: 'px-2 py-0.5 gap-1 rounded-full', icon: 'w-3 h-3', text: 'text-[10px]' },
  lg: { wrapper: 'px-2.5 py-1 gap-1 rounded-full', icon: 'w-3.5 h-3.5', text: 'text-xs' },
};

/** Determine badge variant from follower count */
export const getBadgeVariant = (followersCount: number): BadgeVariant | null => {
  if (followersCount >= 100_000) return 'top-creator';
  if (followersCount >= 10_000) return 'pro';
  if (followersCount >= 1_000) return 'rising';
  return null;
};

export const CreatorBadge: React.FC<CreatorBadgeProps> = ({
  variant,
  size = 'md',
  iconOnly = false,
  followersCount,
}) => {
  // Derive variant from follower count if not explicitly set
  const resolvedVariant = variant ?? (followersCount !== undefined ? getBadgeVariant(followersCount) : null);
  if (!resolvedVariant) return null;

  const config = BADGE_CONFIG[resolvedVariant];
  const sizeClass = SIZE_CLASSES[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center border font-bold ${sizeClass.wrapper} ${sizeClass.text} ${config.className}`}
      title={config.label}
    >
      <Icon className={sizeClass.icon} />
      {!iconOnly && <span>{config.label}</span>}
    </span>
  );
};
