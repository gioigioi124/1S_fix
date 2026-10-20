import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'sm', children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none rounded select-none';

    const variants = {
      primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm',
      secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400 border border-slate-300',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500',
      ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      outline: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 focus:ring-primary-500',
    };

    const sizes = {
      sm: 'h-7 px-2.5 text-xs gap-1',
      md: 'h-8 px-3 text-xs gap-1.5',
      lg: 'h-10 px-4 text-sm gap-2',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
