import React from 'react';
import { Link } from 'wouter';
import { useGetDashboardSummary } from '@workspace/api-client-react';
import { Shell } from '../components/layout';
import { Button, Card, Badge } from '../components/ui';
import { Plus, ArrowRight, Calendar, Clock, Activity as ActivityIcon, Monitor, Play } from 'lucide-react';
import { fmtDate, fmtTime } from '../lib/utils';
import { EventDetail, Event, Activity } from '@workspace/api-client-react';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { data: summary, isLoading, isError, refetch } = useGetDashboardSummary();

  return (
    <Shell>
      <div className="fade-up">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold mb-2">Operator Desk</div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Command Center</h1>
            <p className="text-slate-400">Your production overview and upcoming schedule.</p>
          </div>
          <Link href="/events/new">
            <Button variant="primary"><Plus className="h-4 w-4" /> Create Production</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mr-3" /> Loading systems...
          </div>
        ) : isError ? (
          <Card className="p-8 text-center max-w-md mx-auto mt-20 border-red-500/20 bg-red-500/5">
            <div className="text-red-400 font-bold mb-2">Telemetry Failure</div>
            <p className="text-sm text-slate-400 mb-6">Could not establish link with the scheduling server.</p>
            <Button variant="outline" onClick={() => refetch()}>Retry connection</Button>
          </Card>
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
    </Shell>
  );
}

function MetricCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <Card className="p-6 flex flex-col justify-between hover:bg-white/[0.03] transition-colors">
      <div className="flex items-start justify-between text-slate-500 mb-6">
        <span className="mono text-[10px] font-bold uppercase tracking-widest">{label}</span>
        <span className="text-cyan-500/80">{icon}</span>
      </div>
      <div className="text-4xl font-bold tracking-tight text-white">{value}</div>
    </Card>
  );
}

function ActiveEvent({ event }: { event: EventDetail | null }) {
  if (!event) {
    return (
      <Card className="p-8 flex flex-col justify-center items-center text-center border-dashed border-white/10 bg-transparent h-full min-h-[240px]">
        <Monitor className="h-10 w-10 text-slate-600 mb-4 opacity-50" />
        <h3 className="text-lg font-bold text-white mb-2">No active production</h3>
        <p className="text-sm text-slate-400 mb-6 max-w-sm">When a show goes live, its timing heartbeat and operator controls will appear here.</p>
        <Link href="/events/new">
          <Button variant="outline">Schedule a show</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-8 flex flex-col min-h-[240px] border-cyan-500/30 bg-gradient-to-br from-cyan-900/20 to-slate-900/50 shadow-[0_0_30px_rgba(0,229,255,0.05)]">
      <div className="absolute right-[-20%] top-[-20%] w-[50%] h-[150%] bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.15),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-8">
        <Badge variant="live">On Air</Badge>
        <div className="mono text-[10px] uppercase tracking-widest text-slate-400">Live Session</div>
      </div>

      <div className="relative z-10 flex-1">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">{event.name}</h2>
        <div className="text-sm text-cyan-100/70 font-medium">
          {event.venue || 'Venue TBC'} <span className="mx-2 opacity-50">•</span> {fmtDate(event.date)}
        </div>
      </div>

      <div className="relative z-10 mt-8 flex flex-wrap gap-4">
        <Link href={`/events/${event.id}`}>
          <Button variant="primary" className="shadow-none"><Play className="h-4 w-4" /> Open Control Room</Button>
        </Link>
        {event.displays?.[0] && (
          <Link href={`/events/${event.id}/display/${event.displays[0].id}`}>
            <Button variant="glass">Monitor Display</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

function UpcomingList({ events }: { events: Event[] }) {
  return (
    <Card className="flex flex-col h-full">
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-widest text-slate-400 font-bold">The Slate</div>
        <Link href="/events/new">
          <Button variant="ghost" size="sm"><Plus className="h-3 w-3 mr-1" /> Add</Button>
        </Link>
      </div>
      <div className="p-2 flex-1">
        {events.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No scheduled productions.</div>
        ) : (
          <div className="space-y-1">
            {events.slice(0, 5).map(evt => (
              <Link key={evt.id} href={`/events/${evt.id}`}>
                <div className="group flex items-center gap-4 p-4 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/10">
                  <div className="h-10 w-10 rounded-md bg-slate-800 border border-white/5 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-200 truncate">{evt.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{fmtDate(evt.date)} • {evt.venue || 'TBA'}</div>
                  </div>
                  <div className="hidden sm:block text-right">
                    <Badge variant={evt.status === 'live' ? 'live' : evt.status === 'scheduled' ? 'good' : 'neutral'}>{evt.status}</Badge>
                    <div className="mono text-[10px] text-slate-500 mt-1.5">{evt.segmentCount} blocks</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all ml-2" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ActivityList({ items }: { items: Activity[] }) {
  return (
    <Card className="flex flex-col h-full bg-[#0a0e17] border-white/5">
      <div className="p-6 border-b border-white/5">
        <div className="mono text-[10px] uppercase tracking-widest text-slate-400 font-bold">System Log</div>
      </div>
      <div className="p-6 flex-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No recent events logged.</div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-white/5">
            {items.slice(0, 6).map((item) => (
              <div key={item.id} className="relative flex gap-4">
                <div className={`mt-1 h-6 w-6 rounded-full border-4 border-[#0a0e17] z-10 shrink-0 ${
                  item.tone === 'warning' ? 'bg-amber-500' :
                  item.tone === 'positive' ? 'bg-emerald-500' : 'bg-slate-600'
                }`} />
                <div className="pt-0.5">
                  <div className="text-sm text-slate-300 leading-tight">{item.label}</div>
                  <div className="mono text-[10px] text-slate-500 mt-1.5">{fmtTime(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}