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
            {/* Mockup visual */}
            <div className="relative mx-auto w-full max-w-[600px] aspect-[4/3] glass-panel rounded-2xl p-2 shadow-2xl border-white/10 bg-[#0c121e]/80">
              <div className="absolute top-4 left-4 text-xs text-slate-500 font-medium flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="w-full h-full rounded-xl bg-[#06090e] border border-white/5 flex flex-col justify-center items-center relative overflow-hidden">
                <div className="absolute top-8 mono text-xs tracking-widest text-slate-500">MAIN STAGE • KEYNOTE</div>
                <div className="timer-text text-[clamp(4rem,8vw,7rem)] text-[#00FF9D] drop-shadow-[0_0_30px_rgba(0,255,157,0.3)]">
                  00:12:34
                </div>
                <div className="absolute bottom-12 w-3/4 max-w-md h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 w-[65%] rounded-full shadow-[0_0_10px_rgba(0,229,255,0.5)]"></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}