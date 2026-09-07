import React from 'react';
import { Link } from 'wouter';
import { Button } from '../components/ui';
import { PublicLayout } from '../components/layout';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Landing() {
  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center py-20 px-6">
        <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-16 items-center">

          <div className="fade-up max-w-2xl">
            <div className="mono text-cyan-400 text-[11px] font-bold tracking-[0.2em] uppercase mb-6">
              Live Event Timer Platform
            </div>
            <h1 className="text-[clamp(3rem,6vw,5.5rem)] font-bold leading-[1.05] tracking-tight text-white mb-6">
              Keep your<br/>event on track.<br/>
              <span className="text-gradient">Every time.</span>
            </h1>
            <p className="text-lg text-slate-400 mb-10 leading-relaxed max-w-lg">
              The professional real-time timing platform for producers, speakers, venues, educators, and teams. Run cleaner shows, keep every screen synchronized, and give your crew confidence from the first cue to the final minute.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link href="/sign-up">
                <Button size="lg" className="rounded-full px-8 text-base">
                  Start free <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="glass" size="lg" className="rounded-full px-8 text-base">
                  Explore the product
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500 font-medium">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-500" /> No credit card required</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-500" /> Setup in minutes</div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-500" /> Secure cloud sync</div>
            </div>
          </div>

          <div className="fade-up-2 lg:block relative">
            <div className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[28px] border border-cyan-200/15 bg-[#0c121e]/80 p-2 shadow-[0_30px_100px_rgba(0,100,255,0.24)]">
              <div className="relative aspect-[3/2] overflow-hidden rounded-[22px] bg-[#06090e]">
                <img
                  src="/images/stagetime-hero.webp"
                  alt="StageTime controlling a live event timer from the main stage"
                  className="h-full w-full object-cover object-center"
                  width="1536"
                  height="1024"
                  fetchPriority="high"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050b14]/75 via-transparent to-transparent" />
                <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-[#07111f]/75 px-5 py-4 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:left-6 sm:min-w-72">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                    Main Stage • Keynote
                  </div>
                  <div className="timer-text text-4xl text-[#6BEA9C] drop-shadow-[0_0_22px_rgba(107,234,156,0.35)] sm:text-5xl">
                    00:12:34
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-cyan-300 to-blue-500 shadow-[0_0_12px_rgba(104,225,255,0.6)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}