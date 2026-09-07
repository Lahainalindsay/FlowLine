import React, { ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import {
  LayoutDashboard, Plus, Settings, LogOut, Menu, X,
  Clock, Activity, CircleHelp, Users, FileStack, CreditCard
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui';

export const StageTimeLogo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-2.5", className)}>
    <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(0,229,255,0.3)]">
      <Clock className="h-4 w-4 text-white" strokeWidth={3} />
    </div>
    <span className="text-xl font-bold tracking-tight text-white">
      Stage<span className="text-cyan-400">Time</span>
    </span>
  </div>
);

export function Shell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const [location] = useLocation();

  const nav = [
    { href: '/', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Control Room' },
    { href: '/events/new', icon: <Plus className="h-4 w-4" />, label: 'New Production' },
    { href: '/templates', icon: <FileStack className="h-4 w-4" />, label: 'Templates' },
    { href: '/team', icon: <Users className="h-4 w-4" />, label: 'Team' },
    { href: '/billing', icon: <CreditCard className="h-4 w-4" />, label: 'Billing' },
    { href: '/settings', icon: <Settings className="h-4 w-4" />, label: 'Settings' },
  ];

  return (
    <div className="noise min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-white/5 bg-[#0a0e17]/95 backdrop-blur-xl px-4 py-6 transition-transform duration-300 md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="focus-ring outline-none">
            <StageTimeLogo />
          </Link>
          <button className="text-slate-400 md:hidden p-1 rounded hover:bg-white/10" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mono mt-10 px-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Workspace</div>
        <nav className="mt-4 space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <span className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring outline-none",
                location === item.href || (item.href !== '/' && location.startsWith(item.href))
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}>
                {item.icon}
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-8 border-t border-white/5 pt-6">
          <div className="mono px-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold mb-3">Active Team</div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300 border border-indigo-500/30">
              {user?.firstName?.[0] || 'T'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-slate-200">Production Crew</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] text-slate-400">All systems go</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-1">
          <div className="truncate px-3 pb-3 text-xs text-slate-500">{user?.primaryEmailAddress?.emailAddress}</div>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors focus-ring outline-none">
            <CircleHelp className="h-4 w-4" />
            Support
          </button>
          <button onClick={() => signOut({ redirectUrl: '/' })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition-colors focus-ring outline-none">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 md:pl-[260px] flex flex-col min-h-[100dvh]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/5 bg-[#0a0e17]/80 px-4 md:px-8 backdrop-blur-md">
          <button className="text-slate-400 md:hidden p-1.5 rounded hover:bg-white/10" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 hidden md:block">
            <div className="mono text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-cyan-500" />
              Global Timing Service
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-400 font-medium">
               <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
               Connected
             </div>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-8 xl:p-10 mx-auto w-full max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="noise min-h-[100dvh] bg-[#0a0e17] text-white flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <header className="flex h-20 items-center justify-between px-6 md:px-12 relative z-10">
        <Link href="/" className="focus-ring outline-none">
          <StageTimeLogo />
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/pricing" className="text-slate-300 hover:text-white transition-colors hidden sm:block">Pricing</Link>
          <Link href="/sign-in" className="text-slate-300 hover:text-white transition-colors hidden sm:block">Log in</Link>
          <Link href="/sign-in">
            <Button variant="primary" size="sm" className="rounded-full px-5">Get Started</Button>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex flex-col relative z-10">
        {children}
      </main>
    </div>
  );
}