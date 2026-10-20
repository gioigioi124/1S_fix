import React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={cn(
            'w-full h-7 px-2 text-xs border rounded bg-white text-slate-900 border-slate-300 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100 disabled:text-slate-500',
            error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
            className
          )}
          {...props}
        />
        {error && <p className="mt-0.5 text-[10px] text-rose-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
