import React from 'react';

type FieldProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Field: React.FC<FieldProps> = ({ className = '', ...props }) => (
  <input
    {...props}
    className={`min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--subtle)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/15 disabled:opacity-60 ${className}`}
  />
);