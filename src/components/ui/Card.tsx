import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ className = '', ...props }) => (
  <div
    {...props}
    className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-[transform,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--border-hover)] ${className}`}
  />
);