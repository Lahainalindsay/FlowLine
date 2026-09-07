import React, { ButtonHTMLAttributes, InputHTMLAttributes, forwardRef, ReactNode, useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Loader2, ArrowRight, Play, Pause, RotateCcw, Monitor, Settings, Zap, ArrowLeft, Clock, Activity, LayoutDashboard, FileStack, Users, CreditCard, LogOut, Check, X, Shield, Plus, CircleHelp, Trash2, Calendar, AlertTriangle, Menu } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { useToast } from '../hooks/use-toast';

// Basic Building Blocks

export interface StageTimeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const StageTimeButton = forwardRef<HTMLButtonElement, StageTimeButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const baseStyles = "focus-ring inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      primary: "bg-[var(--color-stagetime-blue)] text-[#000000] hover:brightness-110 shadow-[0_0_15px_rgba(77,163,255,0.35)]",
      secondary: "bg-[var(--color-stagetime-panel)] text-[var(--color-stagetime-text)] hover:bg-[rgba(13,27,46,0.95)] border border-[var(--color-stagetime-border)]",
      outline: "border border-[var(--color-stagetime-border)] bg-transparent text-[var(--color-stagetime-text)] hover:bg-[var(--color-stagetime-panel)]",
      ghost: "bg-transparent text-[var(--color-stagetime-text-dim)] hover:text-[var(--color-stagetime-text)] hover:bg-white/5",
      danger: "bg-[var(--color-stagetime-red)]/10 text-[var(--color-stagetime-red)] hover:bg-[var(--color-stagetime-red)]/20",
      glass: "stagetime-glass hover:bg-white/10 text-white"
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
StageTimeButton.displayName = 'StageTimeButton';

export const StageTimeCard = ({ children, className, glass = false }: { children: ReactNode, className?: string, glass?: boolean }) => (
  <div className={cn("rounded-2xl overflow-hidden", glass ? "stagetime-glass-subtle" : "bg-[var(--color-stagetime-panel)] border border-[var(--color-stagetime-border)] shadow-lg", className)}>
    {children}
  </div>
);

export interface StageTimeInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const StageTimeInput = forwardRef<HTMLInputElement, StageTimeInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-lg border border-[var(--color-stagetime-border)] bg-[rgba(0,0,0,0.2)] px-4 py-2 text-sm text-[var(--color-stagetime-text)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-stagetime-text-dim)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stagetime-blue)] focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          error && "border-[var(--color-stagetime-red)] focus-visible:ring-[var(--color-stagetime-red)]",
          className
        )}
        {...props}
      />
    );
  }
);
StageTimeInput.displayName = 'StageTimeInput';

export const StageTimeBadge = ({ children, variant = 'neutral', className }: { children: ReactNode, variant?: 'neutral' | 'live' | 'warn' | 'good' | 'critical' | 'outline', className?: string }) => {
  const variants = {
    neutral: "bg-white/5 text-[var(--color-stagetime-text-dim)] border border-white/10",
    live: "bg-[var(--color-stagetime-blue)]/15 text-[var(--color-stagetime-blue)] border border-[var(--color-stagetime-blue)]/30 shadow-[0_0_10px_rgba(77,163,255,0.15)]",
    warn: "bg-[var(--color-stagetime-orange)]/15 text-[var(--color-stagetime-orange)] border border-[var(--color-stagetime-orange)]/30",
    good: "bg-[var(--color-stagetime-green)]/15 text-[var(--color-stagetime-green)] border border-[var(--color-stagetime-green)]/30",
    critical: "bg-[var(--color-stagetime-red)]/15 text-[var(--color-stagetime-red)] border border-[var(--color-stagetime-red)]/30",
    outline: "border border-[var(--color-stagetime-border)] text-[var(--color-stagetime-text-dim)]"
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", variants[variant], className)}>
      {variant === 'live' && <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--color-stagetime-blue)]" />}
      {children}
    </span>
  );
};

export const ConnectionStatus = ({ isConnected }: { isConnected: boolean }) => (
  <div className={cn(
    "flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
    isConnected ? "border-[var(--color-stagetime-green)]/20 bg-[var(--color-stagetime-green)]/10 text-[var(--color-stagetime-green)]" : "border-[var(--color-stagetime-red)]/20 bg-[var(--color-stagetime-red)]/10 text-[var(--color-stagetime-red)]"
  )}>
    <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-[var(--color-stagetime-green)] animate-pulse" : "bg-[var(--color-stagetime-red)]")} />
    {isConnected ? "Healthy" : "Disconnected"}
  </div>
);

export const StageTimeSelect = forwardRef<HTMLSelectElement, InputHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-lg border border-[var(--color-stagetime-border)] bg-[rgba(0,0,0,0.2)] px-4 py-2 text-sm text-[var(--color-stagetime-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stagetime-blue)] transition-colors appearance-none disabled:opacity-50 disabled:cursor-not-allowed",
      className
    )}
    {...props}
  />
));
StageTimeSelect.displayName = 'StageTimeSelect';

export const StageTimeLabel = ({ children, className, hint }: { children: ReactNode, className?: string, hint?: string }) => (
  <label className={cn("flex justify-between items-baseline text-xs font-semibold text-[var(--color-stagetime-text)] mb-2 uppercase tracking-wide opacity-80", className)}>
    {children}
    {hint && <span className="text-[10px] font-normal text-[var(--color-stagetime-text-dim)] normal-case tracking-normal">{hint}</span>}
  </label>
);

// Complex Components

export const TimerDisplay = ({ timeStr, state, huge = false, className }: { timeStr: string, state: 'idle' | 'running' | 'paused' | 'overtime' | 'completed', huge?: boolean, className?: string }) => {
  const isOvertime = state === 'overtime';
  const isRunning = state === 'running';

  return (
    <div className={cn(
      "text-center transition-colors duration-500",
      isOvertime ? "text-[var(--color-stagetime-red)]" : "text-[var(--color-stagetime-text)]",
      className
    )}>
      <div className={cn(
        huge ? "timer-display-huge" : "timer-text text-6xl md:text-8xl",
        isOvertime && "animate-pulse"
      )}>
        {timeStr}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <StageTimeBadge variant={
          state === 'running' ? 'live' : 
          state === 'overtime' ? 'critical' : 
          state === 'completed' ? 'good' : 'neutral'
        }>
          {state.toUpperCase()}
        </StageTimeBadge>
      </div>
    </div>
  );
};

export const TimerControls = ({ 
  state, 
  onStart, 
  onPause, 
  onReset,
  onNext,
  onPrev,
  loading 
}: { 
  state: 'idle' | 'running' | 'paused' | 'overtime' | 'completed',
  onStart: () => void,
  onPause: () => void,
  onReset: () => void,
  onNext?: () => void,
  onPrev?: () => void,
  loading?: boolean
}) => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {onPrev && (
        <StageTimeButton variant="outline" size="icon" onClick={onPrev} disabled={loading} aria-label="Previous">
          <ArrowLeft className="h-4 w-4" />
        </StageTimeButton>
      )}
      
      {state === 'running' || state === 'overtime' ? (
        <StageTimeButton variant="danger" size="lg" onClick={onPause} loading={loading} className="w-32">
          <Pause className="h-5 w-5 mr-2" fill="currentColor" /> Pause
        </StageTimeButton>
      ) : (
        <StageTimeButton variant="primary" size="lg" onClick={onStart} loading={loading} className="w-32">
          <Play className="h-5 w-5 mr-2" fill="currentColor" /> Start
        </StageTimeButton>
      )}

      <StageTimeButton variant="secondary" size="lg" onClick={onReset} disabled={loading}>
        <RotateCcw className="h-5 w-5 mr-2" /> Reset
      </StageTimeButton>

      {onNext && (
        <StageTimeButton variant="outline" size="icon" onClick={onNext} disabled={loading} aria-label="Next">
          <ArrowRight className="h-4 w-4" />
        </StageTimeButton>
      )}
    </div>
  );
};

// Layout Components

export const TopNavigation = ({ onOpenNavigation }: { onOpenNavigation: () => void }) => (
  <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--color-stagetime-border)] bg-[rgba(12,23,39,0.8)] px-4 md:px-8 backdrop-blur-md">
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label="Open navigation"
        data-testid="button-open-navigation"
        className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-stagetime-border)] text-[var(--color-stagetime-text-dim)] transition-colors hover:bg-white/5 hover:text-white md:hidden"
        onClick={onOpenNavigation}
      >
        <Menu className="h-5 w-5" />
      </button>
      <Link href="/" className="focus-ring outline-none flex items-center gap-2.5">
        <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--color-stagetime-cyan)] to-[var(--color-stagetime-blue)] shadow-[0_0_15px_rgba(77,163,255,0.3)]">
          <Clock className="h-4 w-4 text-[var(--color-stagetime-bg)]" strokeWidth={3} />
        </div>
        <span className="text-xl font-bold tracking-tight text-white display-font hidden sm:block">
          Stage<span className="text-[var(--color-stagetime-cyan)]">Time</span>
        </span>
      </Link>
    </div>
    
    <div className="flex items-center gap-4">
      <ConnectionStatus isConnected={true} />
    </div>
  </header>
);

export const Sidebar = ({ mobileOpen, setMobileOpen }: { mobileOpen: boolean, setMobileOpen: (open: boolean) => void }) => {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  
  const nav = [
    { href: '/', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Live Control' },
    { href: '/events', icon: <Calendar className="h-4 w-4" />, label: 'Events' },
    { href: '/templates', icon: <FileStack className="h-4 w-4" />, label: 'Templates' },
    { href: '/team', icon: <Users className="h-4 w-4" />, label: 'Team' },
    { href: '/billing', icon: <CreditCard className="h-4 w-4" />, label: 'Billing' },
    { href: '/settings', icon: <Settings className="h-4 w-4" />, label: 'Settings' },
  ];

  return (
    <>
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[var(--color-stagetime-border)] bg-[var(--color-stagetime-panel)] px-4 py-6 transition-transform duration-300 md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="focus-ring outline-none flex items-center gap-2.5">
            <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--color-stagetime-cyan)] to-[var(--color-stagetime-blue)] shadow-[0_0_15px_rgba(77,163,255,0.3)]">
              <Clock className="h-4 w-4 text-[var(--color-stagetime-bg)]" strokeWidth={3} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white display-font">
              Stage<span className="text-[var(--color-stagetime-cyan)]">Time</span>
            </span>
          </Link>
          <button className="text-[var(--color-stagetime-text-dim)] md:hidden p-1 rounded hover:bg-white/10" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mono mt-10 px-2 text-[10px] uppercase tracking-widest text-[var(--color-stagetime-text-dim)]/70 font-semibold">Workspace</div>
        <nav className="mt-4 space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <span className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring outline-none",
                location === item.href || (item.href !== '/' && location.startsWith(item.href))
                  ? "bg-[var(--color-stagetime-blue)]/10 text-[var(--color-stagetime-cyan)]"
                  : "text-[var(--color-stagetime-text-dim)] hover:bg-white/5 hover:text-white"
              )}>
                {item.icon}
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-1 pt-6 border-t border-[var(--color-stagetime-border)]">
          <div className="truncate px-3 pb-3 text-xs text-[var(--color-stagetime-text-dim)] flex items-center gap-2">
             <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-stagetime-blue)]/20 text-[10px] font-bold text-[var(--color-stagetime-blue)] border border-[var(--color-stagetime-blue)]/30">
              {user?.firstName?.[0] || 'U'}
            </div>
            {user?.primaryEmailAddress?.emailAddress}
          </div>
          <button onClick={() => signOut({ redirectUrl: '/' })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--color-stagetime-text-dim)] hover:bg-white/5 hover:text-[var(--color-stagetime-red)] transition-colors focus-ring outline-none">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
};

export function StageTimeLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  
  return (
    <div className="stagetime-noise min-h-[100dvh] flex">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <main className="flex-1 min-w-0 md:pl-[260px] flex flex-col min-h-[100dvh] relative">
        {/* Cinematic background lighting */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-stagetime-blue)]/10 blur-[120px] pointer-events-none" />
        <TopNavigation onOpenNavigation={() => setMobileOpen(true)} />
        <div className="flex-1 p-4 md:p-8 xl:p-10 mx-auto w-full max-w-[1600px] relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="stagetime-noise min-h-[100dvh] flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[var(--color-stagetime-cyan)]/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--color-stagetime-blue)]/10 blur-[150px] pointer-events-none" />

      <header className="flex h-24 items-center justify-between px-6 md:px-12 relative z-10">
        <Link href="/" className="focus-ring outline-none flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-stagetime-cyan)] to-[var(--color-stagetime-blue)] shadow-[0_0_20px_rgba(77,163,255,0.4)]">
            <Clock className="h-5 w-5 text-[var(--color-stagetime-bg)]" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white display-font">
            Stage<span className="cyan-gradient-text">Time</span>
          </span>
        </Link>
        <div className="flex items-center gap-8 text-sm font-medium">
          <Link href="/pricing" className="text-[var(--color-stagetime-text-dim)] hover:text-white transition-colors hidden sm:block">Pricing</Link>
          <Link href="/sign-in" className="text-[var(--color-stagetime-text-dim)] hover:text-white transition-colors hidden sm:block">Log in</Link>
          <Link href="/sign-up" className="focus-ring outline-none">
            <StageTimeButton variant="primary" size="lg" className="rounded-full px-6 shadow-[0_0_20px_rgba(104,225,255,0.3)]">Get Started</StageTimeButton>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex flex-col relative z-10 w-full">
        {children}
      </main>
    </div>
  );
}

// Dialogs & Modals

export const StageTimeModal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: { isOpen: boolean, onClose: () => void, title: string, children: ReactNode, maxWidth?: string }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 fade-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <StageTimeCard glass className={cn("w-full relative z-10 animate-in zoom-in-95 duration-200", maxWidth)}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-stagetime-border)]">
          <h3 className="font-semibold text-lg display-font">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10 text-[var(--color-stagetime-text-dim)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </StageTimeCard>
    </div>
  );
};

export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDestructive = false, loading = false }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, title: string, message: string, confirmText?: string, isDestructive?: boolean, loading?: boolean }) => {
  return (
    <StageTimeModal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-[var(--color-stagetime-text-dim)] text-sm mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <StageTimeButton variant="ghost" onClick={onClose} disabled={loading}>Cancel</StageTimeButton>
        <StageTimeButton variant={isDestructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
          {confirmText}
        </StageTimeButton>
      </div>
    </StageTimeModal>
  );
};

// Utilities

export const EmptyState = ({ icon: Icon, title, description, action }: { icon: React.ElementType, title: string, description: string, action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="h-16 w-16 rounded-full bg-[var(--color-stagetime-panel)] border border-[var(--color-stagetime-border)] flex items-center justify-center mb-6 shadow-lg">
      <Icon className="h-8 w-8 text-[var(--color-stagetime-blue)] opacity-80" />
    </div>
    <h3 className="text-xl font-bold display-font mb-2">{title}</h3>
    <p className="text-[var(--color-stagetime-text-dim)] text-sm max-w-md mb-8">{description}</p>
    {action}
  </div>
);
