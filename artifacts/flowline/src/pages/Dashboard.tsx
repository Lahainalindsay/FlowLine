import React from 'react';
import { Link } from 'wouter';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import { StageTimeLayout, StageTimeButton, StageTimeCard, StageTimeBadge, EmptyState } from '../components/stagetime';
import { Plus, ArrowRight, Calendar, Clock, Activity as ActivityIcon, Monitor, Play, Loader2 } from 'lucide-react';
import { fmtDate, fmtTime, cn } from '../lib/utils';
import { EventDetail, Event, Activity } from '@workspace/api-client-react';

export default function Dashboard() {
  const { data: summary, isLoading, isError, refetch } = useGetDashboardSummary();

  return (
    <StageTimeLayout>
      <div className="fade-up">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--color-stagetime-cyan)]" />
              Operator Desk
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white display-font mb-2">Command Center</h1>
            <p className="text-[var(--color-stagetime-text-dim)]">Your production overview and upcoming schedule.</p>
          </div>
          <Link href="/events/new">
            <StageTimeButton variant="primary"><Plus className="h-4 w-4 mr-2" /> Create Production</StageTimeButton>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-[var(--color-stagetime-text-dim)]">
            <Loader2 className="h-6 w-6 animate-spin mr-3 text-[var(--color-stagetime-blue)]" /> Loading systems...
          </div>
        ) : isError ? (
          <StageTimeCard className="p-8 text-center max-w-md mx-auto mt-20 border-[var(--color-stagetime-red)]/30 bg-[var(--color-stagetime-red)]/5">
            <div className="text-[var(--color-stagetime-red)] font-bold display-font mb-2">Telemetry Failure</div>
            <p className="text-sm text-[var(--color-stagetime-text-dim)] mb-6">Could not establish link with the scheduling server.</p>
            <StageTimeButton variant="outline" onClick={() => refetch()}>Retry connection</StageTimeButton>
          </StageTimeCard>
        ) : (
          <>
            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6 mb-8">
              <ActiveEvent event={summary?.activeEvent ?? null} />
              <div className="grid grid-cols-2 gap-4">
                <MetricCard label="Total Shows" value={summary?.totalEvents ?? 0} icon={<Calendar />} />
                <MetricCard label="Minutes On Air" value={summary?.minutesOnAir ?? 0} icon={<Clock />} />
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-6">
              <UpcomingList events={summary?.upcomingEvents ?? []} />
              <ActivityList items={summary?.recentActivity ?? []} />
            </div>
          </>
        )}
      </div>
    </StageTimeLayout>
  );
}

function MetricCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <StageTimeCard className="p-6 flex flex-col justify-between group hover:border-[var(--color-stagetime-blue)]/30 transition-colors bg-[rgba(13,27,46,0.5)]">
      <div className="flex items-start justify-between text-[var(--color-stagetime-text-dim)] mb-6">
        <span className="mono text-[10px] font-bold uppercase tracking-widest">{label}</span>
        <span className="text-[var(--color-stagetime-cyan)] opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
      </div>
      <div className="text-4xl font-bold tracking-tight text-white display-font">{value}</div>
    </StageTimeCard>
  );
}

function ActiveEvent({ event }: { event: EventDetail | null }) {
  if (!event) {
    return (
      <StageTimeCard className="p-8 flex flex-col justify-center items-center text-center border-dashed border-[var(--color-stagetime-border)] bg-transparent h-full min-h-[240px]">
        <Monitor className="h-10 w-10 text-[var(--color-stagetime-text-dim)] mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-white mb-2 display-font">No active production</h3>
        <p className="text-sm text-[var(--color-stagetime-text-dim)] mb-6 max-w-sm">When a show goes live, its timing heartbeat and operator controls will appear here.</p>
        <Link href="/events/new">
          <StageTimeButton variant="outline">Schedule a show</StageTimeButton>
        </Link>
      </StageTimeCard>
    );
  }

  return (
    <StageTimeCard className="relative overflow-hidden p-8 flex flex-col min-h-[240px] border-[var(--color-stagetime-blue)]/30 bg-gradient-to-br from-[var(--color-stagetime-blue)]/10 to-transparent shadow-[0_0_30px_rgba(77,163,255,0.1)]">
      <div className="absolute right-[-20%] top-[-20%] w-[50%] h-[150%] bg-[radial-gradient(ellipse_at_center,rgba(77,163,255,0.15),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-8">
        <StageTimeBadge variant="live">On Air</StageTimeBadge>
        <div className="mono text-[10px] uppercase tracking-widest text-[var(--color-stagetime-text-dim)]">Live Session</div>
      </div>

      <div className="relative z-10 flex-1">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2 display-font">{event.name}</h2>
        <div className="text-sm text-[var(--color-stagetime-text-dim)] font-medium">
          {event.venue || 'Venue TBC'} <span className="mx-2 opacity-50">•</span> {fmtDate(event.date)}
        </div>
      </div>

      <div className="relative z-10 mt-8 flex flex-wrap gap-4">
        <Link href={`/events/${event.id}`}>
          <StageTimeButton variant="primary"><Play className="h-4 w-4 mr-2" fill="currentColor" /> Open Control Room</StageTimeButton>
        </Link>
        {event.displays?.[0] && (
          <Link href={`/events/${event.id}/display/${event.displays[0].id}`}>
            <StageTimeButton variant="glass"><Monitor className="h-4 w-4 mr-2" /> Monitor Display</StageTimeButton>
          </Link>
        )}
      </div>
    </StageTimeCard>
  );
}

function UpcomingList({ events }: { events: Event[] }) {
  return (
    <StageTimeCard className="flex flex-col h-full bg-[rgba(13,27,46,0.5)]">
      <div className="p-6 border-b border-[var(--color-stagetime-border)] flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-widest text-[var(--color-stagetime-text-dim)] font-bold">The Slate</div>
        <Link href="/events/new">
          <StageTimeButton variant="ghost" size="sm"><Plus className="h-3 w-3 mr-1" /> Add</StageTimeButton>
        </Link>
      </div>
      <div className="p-2 flex-1">
        {events.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--color-stagetime-text-dim)]">No scheduled productions.</div>
        ) : (
          <div className="space-y-1">
            {events.slice(0, 5).map(evt => (
              <Link key={evt.id} href={`/events/${evt.id}`}>
                <div className="group flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-[var(--color-stagetime-border)]">
                  <div className="h-10 w-10 rounded-lg bg-[var(--color-stagetime-bg)] border border-[var(--color-stagetime-border)] flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-[var(--color-stagetime-text-dim)] group-hover:text-[var(--color-stagetime-cyan)] transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-stagetime-text)] truncate display-font">{evt.name}</div>
                    <div className="text-xs text-[var(--color-stagetime-text-dim)] mt-1">{fmtDate(evt.date)} • {evt.venue || 'TBA'}</div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <StageTimeBadge variant={evt.status === 'live' ? 'live' : evt.status === 'scheduled' ? 'good' : 'neutral'}>{evt.status}</StageTimeBadge>
                    <div className="mono text-[10px] text-[var(--color-stagetime-text-dim)] mt-1.5">{evt.segmentCount} blocks</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[var(--color-stagetime-text-dim)] group-hover:text-[var(--color-stagetime-cyan)] group-hover:translate-x-1 transition-all ml-2" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </StageTimeCard>
  );
}

function ActivityList({ items }: { items: Activity[] }) {
  return (
    <StageTimeCard className="flex flex-col h-full bg-[rgba(13,27,46,0.5)]">
      <div className="p-6 border-b border-[var(--color-stagetime-border)]">
        <div className="mono text-[10px] uppercase tracking-widest text-[var(--color-stagetime-text-dim)] font-bold">System Log</div>
      </div>
      <div className="p-6 flex-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--color-stagetime-text-dim)]">No recent events logged.</div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[1px] before:bg-[var(--color-stagetime-border)]">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="relative flex gap-4 fade-in">
                <div className={cn(
                  "mt-1 h-6 w-6 rounded-full border-4 border-[var(--color-stagetime-panel)] z-10 shrink-0",
                  item.tone === 'warning' ? 'bg-[var(--color-stagetime-orange)]' :
                  item.tone === 'positive' ? 'bg-[var(--color-stagetime-green)]' : 'bg-[var(--color-stagetime-blue)]'
                )} />
                <div className="pt-0.5">
                  <div className="text-sm text-[var(--color-stagetime-text)] leading-tight">{item.label}</div>
                  <div className="mono text-[10px] text-[var(--color-stagetime-text-dim)] mt-1.5">{fmtTime(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </StageTimeCard>
  );
}