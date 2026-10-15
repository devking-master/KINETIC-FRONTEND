import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-[var(--accent)] text-[var(--text)] hover:bg-[var(--accent-hover)]',
  secondary: 'border border-[var(--border)] bg-transparent text-[var(--text)] hover:border-[var(--border-hover)]',
  ghost: 'border border-transparent bg-transparent text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]',
  icon: 'h-12 w-12 border border-transparent bg-transparent p-0 text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--text)]',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}) => (
  <button
    {...props}
    type={type}
    className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
  />
);