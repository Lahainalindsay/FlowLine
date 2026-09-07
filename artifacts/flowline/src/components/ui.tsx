import React, { ButtonHTMLAttributes, InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const baseStyles = "focus-ring inline-flex items-center justify-center rounded-md font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      primary: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110 shadow-[0_0_15px_rgba(0,229,255,0.25)]",
      secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))/0.8]",
      outline: "border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--secondary))]",
      ghost: "bg-transparent hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]",
      danger: "bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.25)]",
      glass: "glass-panel hover:bg-white/10 text-white"
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-10 px-4 py-2 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
      icon: "h-10 w-10"
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={loading || disabled}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          error && "border-[hsl(var(--destructive))] focus-visible:ring-[hsl(var(--destructive))]",
          "glass-panel !bg-black/20",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export const Badge = ({ children, variant = 'neutral', className }: { children: ReactNode, variant?: 'neutral' | 'live' | 'warn' | 'good' | 'outline', className?: string }) => {
  const variants = {
    neutral: "bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]",
    live: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,229,255,0.15)]",
    warn: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    good: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    outline: "border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", variants[variant], className)}>
      {variant === 'live' && <span className="live-dot h-1.5 w-1.5 rounded-full bg-cyan-400" />}
      {children}
    </span>
  );
};

export const Card = ({ children, className }: { children: ReactNode, className?: string }) => (
  <div className={cn("glass-panel rounded-xl overflow-hidden", className)}>
    {children}
  </div>
);

export const Select = forwardRef<HTMLSelectElement, InputHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-[hsl(var(--border))] bg-black/20 px-3 py-2 text-sm text-[hsl(var(--foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] glass-panel transition-colors appearance-none",
      className
    )}
    {...props}
  />
));
Select.displayName = 'Select';

export const Label = ({ children, className, hint }: { children: ReactNode, className?: string, hint?: string }) => (
  <label className={cn("flex justify-between items-baseline text-xs font-semibold text-[hsl(var(--foreground))] mb-1.5", className)}>
    {children}
    {hint && <span className="text-[10px] font-normal text-[hsl(var(--muted-foreground))]">{hint}</span>}
  </label>
);