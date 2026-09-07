import React from 'react';
import { StageTimeLayout, StageTimeCard, StageTimeButton, StageTimeInput, StageTimeLabel } from '../components/stagetime';
import { Link } from 'wouter';

export default function Settings() {
  return (
    <StageTimeLayout>
      <div className="max-w-5xl mx-auto fade-up h-full flex flex-col">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Configuration
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white display-font mb-4">Workspace Settings</h1>
          <p className="text-[var(--color-stagetime-text-dim)] text-lg">Manage your team profile and default preferences.</p>
        </div>

        <div className="space-y-8">
          <StageTimeCard className="p-8 md:p-10">
            <h2 className="text-2xl font-bold text-white mb-8 border-b border-[var(--color-stagetime-border)] pb-6 display-font">Team Profile</h2>
            <div className="space-y-8 max-w-xl">
              <div>
                <StageTimeLabel>Workspace Name</StageTimeLabel>
                <StageTimeInput defaultValue="Production Crew" />
              </div>
              <div>
                <StageTimeLabel>Default Timezone</StageTimeLabel>
                <StageTimeInput defaultValue="America/Los_Angeles" disabled />
              </div>
              <StageTimeButton variant="primary" size="lg">Save Changes</StageTimeButton>
            </div>
          </StageTimeCard>

          <StageTimeCard className="p-8 md:p-10">
            <h2 className="text-2xl font-bold text-white mb-8 border-b border-[var(--color-stagetime-border)] pb-6 display-font">Billing & Plan</h2>
            <div className="bg-[var(--color-stagetime-blue)]/5 border border-[var(--color-stagetime-blue)]/20 rounded-2xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_0_20px_rgba(77,163,255,0.05)]">
              <div>
                <div className="text-[var(--color-stagetime-cyan)] font-bold text-lg display-font mb-2">Workspace billing</div>
                <div className="text-sm text-[var(--color-stagetime-text-dim)]">View the persisted plan and current entitlements.</div>
              </div>
              <Link href="/billing"><StageTimeButton variant="outline" size="lg">View Billing Dashboard</StageTimeButton></Link>
            </div>
          </StageTimeCard>
        </div>
      </div>
    </StageTimeLayout>
  );
}