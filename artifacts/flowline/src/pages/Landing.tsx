import React from 'react';
import { Link } from 'wouter';
import { ArrowRight, ShieldCheck, Zap, Users, Play, Clock, LayoutDashboard, Monitor, Settings, CheckCircle2 } from 'lucide-react';
import { PublicLayout, StageTimeButton, StageTimeCard } from '../components/stagetime';

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <StageTimeCard glass className="p-8 group relative overflow-hidden h-full">
    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-[var(--color-stagetime-blue)]/5 blur-3xl transition-transform group-hover:scale-150 duration-700" />
    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--color-stagetime-panel)] to-[var(--color-stagetime-bg)] border border-[var(--color-stagetime-border)] flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
      <Icon className="h-6 w-6 text-[var(--color-stagetime-cyan)]" />
    </div>
    <h3 className="text-xl font-bold display-font text-[var(--color-stagetime-text)] mb-3">{title}</h3>
    <p className="text-[var(--color-stagetime-text-dim)] leading-relaxed">{description}</p>
  </StageTimeCard>
);

const TrustNote = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 text-sm text-[var(--color-stagetime-text-dim)] font-medium">
    <CheckCircle2 className="h-4 w-4 text-[var(--color-stagetime-green)]" />
    {text}
  </div>
);

export default function Landing() {
  return (
    <PublicLayout>
      <div className="w-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col pt-16 md:pt-24 pb-32 z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16 md:mb-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-xs font-bold uppercase tracking-widest mb-8 fade-up">
            <span className="live-dot h-2 w-2 rounded-full bg-[var(--color-stagetime-cyan)]" />
            Live Event Timer Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white display-font leading-[1.05] mb-8 fade-up-2">
            Keep your event on track.<br />
            <span className="cyan-gradient-text mt-2 block">Every time.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-[var(--color-stagetime-text-dim)] max-w-2xl leading-relaxed mb-10 fade-up-3">
            Professional real-time timing for producers, speakers, venues, educators, and production teams. Sync everyone instantly, anywhere in the world.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto fade-up-3">
            <Link href="/sign-up" className="w-full sm:w-auto">
              <StageTimeButton size="lg" className="w-full sm:w-auto rounded-full px-8 text-base shadow-[0_0_30px_rgba(77,163,255,0.4)]">
                Start free <ArrowRight className="h-5 w-5" />
              </StageTimeButton>
            </Link>
            <Link href="/pricing" className="w-full sm:w-auto">
              <StageTimeButton variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 text-base bg-black/20 backdrop-blur-md">
                Explore the product
              </StageTimeButton>
            </Link>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10 mt-12 fade-up-3">
            <TrustNote text="No credit card required" />
            <TrustNote text="Setup in minutes" />
            <TrustNote text="Secure cloud sync" />
          </div>
        </div>

        {/* Hero Image Section */}
        <div className="relative w-full max-w-6xl mx-auto rounded-3xl p-[1px] bg-gradient-to-b from-[var(--color-stagetime-border)] to-transparent fade-up-3 mb-24">
          <div className="absolute inset-0 rounded-3xl bg-[var(--color-stagetime-blue)]/5 blur-3xl -z-10" />
          <div className="relative rounded-[23px] overflow-hidden bg-[var(--color-stagetime-panel)] aspect-[16/9] shadow-2xl">
            <img 
              src="/images/stagetime-hero.webp" 
              alt="StageTime Event Production Interface" 
              className="w-full h-full object-cover opacity-90 transition-transform duration-1000 hover:scale-[1.02]"
            />
            {/* Overlay Timer Card */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 md:left-12 md:-translate-x-0">
              <StageTimeCard glass className="px-6 py-4 md:px-8 md:py-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[var(--color-stagetime-blue)]/20 animate-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both">
                <div className="flex items-center gap-3 mb-3">
                  <span className="live-dot h-2 w-2 rounded-full bg-[var(--color-stagetime-red)]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-stagetime-text-dim)]">MAIN STAGE • KEYNOTE</span>
                </div>
                <div className="text-5xl md:text-7xl font-bold display-font tabular-nums tracking-tight text-[var(--color-stagetime-text)]">
                  00:12:34
                </div>
                <div className="mt-3 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[var(--color-stagetime-cyan)] to-[var(--color-stagetime-blue)] w-[65%]" />
                </div>
              </StageTimeCard>
            </div>
          </div>
        </div>

        {/* Compact Feature Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 max-w-6xl mx-auto mb-32 fade-up-3">
          {[
            { icon: Zap, label: "Real-time sync" },
            { icon: Users, label: "Built for teams" },
            { icon: Settings, label: "Flexible control" },
            { icon: Monitor, label: "Beautiful displays" },
            { icon: ShieldCheck, label: "Secure & reliable" }
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-4 rounded-xl bg-[var(--color-stagetime-panel)]/50 border border-[var(--color-stagetime-border)] hover:bg-[var(--color-stagetime-panel)] transition-colors">
              <item.icon className="h-6 w-6 text-[var(--color-stagetime-blue)] mb-3" />
              <span className="text-sm font-semibold text-[var(--color-stagetime-text)]">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main Features */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold display-font mb-6">Built for high-stakes production.</h2>
          <p className="text-[var(--color-stagetime-text-dim)] text-lg">Every feature is designed to reduce anxiety and give you complete control over your run of show.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <FeatureCard 
            icon={Clock} 
            title="Multiple timer modes" 
            description="Count down, count up, time-of-day, and custom formats. Easily switch modes based on the segment requirements without breaking the flow."
          />
          <FeatureCard 
            icon={LayoutDashboard} 
            title="Control from anywhere" 
            description="Run the show from your laptop, tablet, or phone. The fully responsive interface adapts to whatever device you have in front of you."
          />
          <FeatureCard 
            icon={Monitor} 
            title="Venue-ready displays" 
            description="Clean, distraction-free stage displays designed for readability under stage lighting. Send messages directly to the presenter screen."
          />
          <FeatureCard 
            icon={Users} 
            title="Team collaboration" 
            description="Invite operators with specific permissions. Everyone stays perfectly synced with sub-second latency across all devices."
          />
          <FeatureCard 
            icon={ShieldCheck} 
            title="Reconnect confidently" 
            description="If your internet drops, the timer keeps running on the server. When you reconnect, you instantly snap back to the exact right time."
          />
          <FeatureCard 
            icon={Play} 
            title="Fast operator workflows" 
            description="Built for speed with keyboard shortcuts, rapid agenda reordering, and one-click time adjustments when segments run long."
          />
        </div>
      </div>
      
      {/* Footer */}
      <footer className="border-t border-[var(--color-stagetime-border)] py-12 mt-20 relative z-10 bg-[var(--color-stagetime-bg)]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[var(--color-stagetime-blue)]" />
            <span className="font-bold display-font text-white tracking-tight">Stage<span className="text-[var(--color-stagetime-cyan)]">Time</span></span>
          </div>
          <div className="text-[var(--color-stagetime-text-dim)] text-sm">
            © {new Date().getFullYear()} StageTime Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </PublicLayout>
  );
}