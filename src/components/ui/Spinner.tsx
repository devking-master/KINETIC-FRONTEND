import React from 'react';

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', ...props }) => (
  <span
    {...props}
    role={props.role || 'status'}
    aria-label={props['aria-label'] || 'Loading'}
    className={`inline-block animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] ${sizes[size]} ${className}`}
  />
);
