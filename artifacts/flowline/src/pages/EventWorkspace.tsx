import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetEvent, getGetEventQueryKey,
  useListAgendaItems, getListAgendaItemsQueryKey,
  useListDisplays, getListDisplaysQueryKey,
  useGetLiveSession, getGetLiveSessionQueryKey,
  useControlLiveSession, useSendOperatorMessage, useTriggerCue,
  useCreateAgendaItem, useUpdateAgendaItem, useDeleteAgendaItem,
  useCreateDisplayAccess,
  EventDetail, AgendaItem, LiveSession,
  getGetDashboardSummaryQueryKey
} from '@workspace/api-client-react';
import { Shell } from '../components/layout';
import { Button, Card, Badge, Input, Label, Select } from '../components/ui';
import { formatTimer, fmtDate, fmtTime, cn } from '../lib/utils';
import {
  ArrowLeft, Monitor, Play, Pause, RotateCcw,
  ArrowRight, Loader2, Zap, MessageSquare, ListVideo,
  Settings2, Plus, Edit2, Trash2, Check, X, Share2, Copy, Link as LinkIcon
} from 'lucide-react';

export default function EventWorkspace() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const [tab, setTab] = useState<'live' | 'run'>('live');

  const eq = useGetEvent(eventId, { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) } });
  const aq = useListAgendaItems(eventId, { query: { enabled: !!eventId, queryKey: getListAgendaItemsQueryKey(eventId) } });
  const dq = useListDisplays(eventId, { query: { enabled: !!eventId, queryKey: getListDisplaysQueryKey(eventId) } });
  const sessionQ = useGetLiveSession(eventId, { query: { enabled: !!eventId, queryKey: getGetLiveSessionQueryKey(eventId), refetchInterval: 2000 } });
  const queryClient = useQueryClient();
  const revision = useRef(-1);
  const [streamState, setStreamState] = useState<'CONNECTED' | 'RECONNECTING' | 'OFFLINE'>('OFFLINE');

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareData, setShareData] = useState<{ code: string, token: string, expiresAt: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const createAccess = useCreateDisplayAccess();

  const handleShare = (displayId: string) => {
    setShareData(null);
    setIsCopied(false);
    setIsShareModalOpen(true);
    createAccess.mutate({ eventId, data: { displayId, expiresInMinutes: 1440 } }, {
      onSuccess: (data) => setShareData(data)
    });
  };

  const copyToClipboard = () => {
    if (!shareData) return;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
    const url = `${window.location.origin}${basePath}/display/${displays[0]?.id}?token=${shareData.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (!eventId) return;
    let opened = false;
    const stream = new EventSource(`/api/events/${encodeURIComponent(eventId)}/stream`, { withCredentials: true });
    const apply = (event: MessageEvent) => {
      const payload = JSON.parse(event.data);
      if (!payload?.state || payload.revision <= revision.current) return;
      revision.current = payload.revision;
      queryClient.setQueryData(getGetEventQueryKey(eventId), payload.state);
      queryClient.setQueryData(getGetLiveSessionQueryKey(eventId), payload.state.session);
      queryClient.setQueryData(getListAgendaItemsQueryKey(eventId), payload.state.agenda);
      queryClient.setQueryData(getListDisplaysQueryKey(eventId), payload.state.displays);
    };
    ['snapshot', 'session', 'message', 'cue', 'agenda', 'display', 'event'].forEach((name) => stream.addEventListener(name, apply));
    stream.onopen = () => {
      setStreamState('CONNECTED');
      if (opened) queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
      opened = true;
    };
    stream.onerror = () => setStreamState(navigator.onLine ? 'RECONNECTING' : 'OFFLINE');
    return () => stream.close();
  }, [eventId, queryClient]);

  if (eq.isLoading) {
    return (
      <Shell>
        <div className="flex flex-col h-[50vh] items-center justify-center text-slate-400 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <div className="mono text-xs uppercase tracking-widest">Connecting to Control Room...</div>
        </div>
      </Shell>
    );
  }

  if (eq.isError || !eq.data) {
    return (
      <Shell>
        <Card className="p-8 text-center max-w-md mx-auto mt-20 border-red-500/20">
          <div className="text-red-400 font-bold mb-2">Signal Lost</div>
          <p className="text-sm text-slate-400 mb-6">Unable to connect to the event workspace.</p>
          <Button variant="outline" onClick={() => eq.refetch()}>Re-establish connection</Button>
        </Card>
      </Shell>
    );
  }

  const event = eq.data;
  const items = aq.data ?? [];
  const session = sessionQ.data ?? event.session;
  const displays = dq.data ?? [];

  return (
    <Shell>
      <div className="fade-up h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors mb-4">
              <ArrowLeft className="h-3 w-3" /> Command Center
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">{event.name}</h1>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
              <span>{fmtDate(event.date)}</span>
              <span className="h-1 w-1 rounded-full bg-slate-700"></span>
              <span>{event.venue || 'Venue TBC'}</span>
              <span className="h-1 w-1 rounded-full bg-slate-700"></span>
              <Badge variant={event.status === 'live' ? 'live' : 'good'}>{event.status}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/events/${event.id}/import`}>
              <Button variant="outline">Import Blocks</Button>
            </Link>
            <Button variant="primary" onClick={() => handleShare(displays[0]?.id ?? 'main')} disabled={displays.length === 0}>
              <Share2 className="h-4 w-4" /> Share Display
            </Button>
            <Link href={`/events/${event.id}/display/${displays[0]?.id ?? 'main'}`}>
              <Button variant="glass" className="text-slate-400 hover:text-white"><Monitor className="h-4 w-4" /> Preview</Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10 mb-6">
          <button
            className={cn("px-6 py-3 text-sm font-semibold transition-colors border-b-2 outline-none", tab === 'live' ? "border-cyan-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200")}
            onClick={() => setTab('live')}
          >
            Live Control
          </button>
          <button
            className={cn("px-6 py-3 text-sm font-semibold transition-colors border-b-2 outline-none flex items-center gap-2", tab === 'run' ? "border-cyan-400 text-white" : "border-transparent text-slate-400 hover:text-slate-200")}
            onClick={() => setTab('run')}
          >
            Run of Show <span className="mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded-md">{items.length}</span>
          </button>
        </div>

        {/* Content */}
        {tab === 'live' ? (
          <LiveControl event={event} items={items} session={session} displays={displays} streamState={streamState} />
        ) : (
          <RunOfShow event={event} items={items} />
        )}
      </div>

      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 bg-[#0a0e17] border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Share2 className="h-5 w-5 text-cyan-400" /> Share Display Link
              </h3>
              <button onClick={() => setIsShareModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {createAccess.isPending || !shareData ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                <span className="text-sm font-medium">Generating access code...</span>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-black/40 rounded-xl border border-white/5 p-5 text-center">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Pairing Code</div>
                  <div className="text-4xl font-bold tracking-[0.2em] text-white font-mono">{shareData.code}</div>
                  <div className="text-[10px] text-slate-500 mt-2">Expires {fmtDate(shareData.expiresAt)} at {fmtTime(shareData.expiresAt)}</div>
                </div>

                <div className="space-y-2">
                  <Label>Public Link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/display/${displays[0]?.id}?token=${shareData.token}`}
                      className="font-mono text-xs text-slate-300 flex-1 truncate bg-black/20"
                    />
                    <Button variant="outline" onClick={copyToClipboard} className="shrink-0 w-24">
                      {isCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      {isCopied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full h-12"
                  onClick={() => window.open(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/display/${displays[0]?.id}?token=${shareData.token}`, '_blank')}
                >
                  <LinkIcon className="h-4 w-4 mr-2" /> Open in New Tab
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </Shell>
  );
}

function LiveControl({ event, items, session, displays, streamState }: { event: EventDetail, items: AgendaItem[], session: LiveSession, displays: any[], streamState: string }) {
  const queryClient = useQueryClient();
  const control = useControlLiveSession();
  const sendMsg = useSendOperatorMessage();
  const triggerCue = useTriggerCue();

  const [message, setMessage] = useState('');
  const [cueLabel, setCueLabel] = useState('');
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  const active = items.find(i => i.id === session.activeItemId) ?? items.find(i => i.status === 'active');
  const [localSeconds, setLocalSeconds] = useState(session.remainingSeconds);
  useEffect(() => {
    const receivedAt = Date.now();
    const sync = () => {
      if (session.state !== 'running' && session.state !== 'overtime') return setLocalSeconds(session.remainingSeconds);
      const serverNow = new Date(session.serverTime).getTime() + (Date.now() - receivedAt);
      setLocalSeconds(session.remainingSeconds - Math.floor((serverNow - new Date(session.timerAnchorAt).getTime()) / 1000));
    };
    sync();
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [session.remainingSeconds, session.state, session.serverTime, session.timerAnchorAt]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(event.id) });
    queryClient.invalidateQueries({ queryKey: getGetLiveSessionQueryKey(event.id) });
    queryClient.invalidateQueries({ queryKey: getListAgendaItemsQueryKey(event.id) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const act = (action: string, extra?: any) => {
    const commandId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    control.mutate(
      { eventId: event.id, data: { action, expectedRevision: session.revision, commandId, ...extra } as any },
      { onSuccess: invalidateAll, onError: () => invalidateAll() },
    );
  };

  const overtime = localSeconds < 0;
  const running = session.state === 'running' || session.state === 'overtime';
  const primaryAction = running ? 'pause' : session.state === 'paused' ? 'resume' : 'start';
  const primaryLabel = running ? 'Pause Clock' : session.state === 'paused' ? 'Resume Clock' : 'Go Live';

  return (
    <div className="grid xl:grid-cols-[1.3fr_1fr] gap-6 flex-1">
      <div className="space-y-6 flex flex-col">
        {/* Main Timer Display */}
        <Card className={cn(
          "p-8 md:p-12 flex-1 flex flex-col justify-center relative overflow-hidden transition-colors duration-500",
          overtime ? "bg-red-950/40 border-red-500/50 shadow-[0_0_50px_rgba(255,0,0,0.15)]" :
          running ? "bg-cyan-950/20 border-cyan-500/30 shadow-[0_0_50px_rgba(0,229,255,0.1)]" : "bg-[#0a0e17] border-white/10"
        )}>
          {running && !overtime && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(0,229,255,0.8)]" />}
          {overtime && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-orange-500 shadow-[0_0_20px_rgba(255,0,0,0.8)] animate-pulse" />}

          <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", running ? "bg-red-500 live-dot" : "bg-slate-600")} />
              <span className="mono text-xs uppercase tracking-widest text-slate-300 font-bold">
                {overtime ? 'Overtime' : session.state === 'running' ? 'On Air' : session.state}
              </span>
            </div>
            <span className="mono text-[10px] text-slate-500">{streamState} • {fmtTime(session.serverTime)}</span>
          </div>

          <div className="text-center relative z-10 my-12">
            <div className="text-slate-400 text-sm font-bold tracking-widest uppercase mb-4">{active?.title || 'Ready for first cue'}</div>
            <div className={cn(
              "timer-text text-[clamp(5rem,12vw,10rem)] leading-none mb-6 drop-shadow-2xl transition-colors duration-300",
              overtime ? "text-red-400 text-gradient-none" : "text-[#00FF9D]"
            )}>
              {formatTimer(localSeconds)}
            </div>
            {active && (
              <div className="inline-flex items-center gap-3 bg-black/40 rounded-full px-4 py-2 border border-white/5">
                <span className="text-sm font-medium text-white">{active.speaker || 'No speaker'}</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-sm text-slate-400">{active.plannedDurationMinutes}m block</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-auto relative z-10">
            <Button variant={running ? "danger" : "primary"} onClick={() => act(primaryAction)} disabled={control.isPending} className="col-span-2 lg:col-span-1 h-12">
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {primaryLabel}
            </Button>
            <Button variant="glass" onClick={() => act('next')} disabled={control.isPending} className="col-span-2 lg:col-span-1 h-12">
              Next Cue <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="glass" onClick={() => act('subtract_time', { amountSeconds: 60 })} disabled={control.isPending} className="col-span-1 h-12">
              -1 Min
            </Button>
            <Button variant="glass" onClick={() => act('add_time', { amountSeconds: 60 })} disabled={control.isPending} className="col-span-1 h-12">
              +1 Min
            </Button>
            {isConfirmingReset ? (
              <Button variant="danger" onClick={() => { setIsConfirmingReset(false); act('reset'); }} disabled={control.isPending} className="col-span-2 lg:col-span-1 h-12 text-white">
                <RotateCcw className="h-4 w-4 mr-1" /> Sure?
              </Button>
            ) : (
              <Button variant="glass" onClick={() => setIsConfirmingReset(true)} disabled={control.isPending} className="col-span-2 lg:col-span-1 h-12 text-slate-400 hover:text-white">
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
            )}
          </div>
        </Card>

        {/* Messaging & Cues */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4 text-sm font-bold text-white">
              <MessageSquare className="h-4 w-4 text-cyan-400" /> Room Message
            </div>
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="e.g. Hold for talent..."
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && message && sendMsg.mutate({ eventId: event.id, data: { message, target: 'all', expiresInSeconds: 120 } }, { onSuccess: () => { setMessage(''); invalidateAll(); }})}
              />
              <Button
                variant="secondary"
                disabled={!message || sendMsg.isPending}
                onClick={() => sendMsg.mutate({ eventId: event.id, data: { message, target: 'all', expiresInSeconds: 120 } }, { onSuccess: () => { setMessage(''); invalidateAll(); }})}
              >
                Send
              </Button>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4 text-sm font-bold text-white">
              <Zap className="h-4 w-4 text-amber-400" /> Trigger Cue
            </div>
            <div className="flex gap-2">
              <Input
                value={cueLabel}
                onChange={e => setCueLabel(e.target.value)}
                placeholder="e.g. Walk-on music"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && cueLabel && triggerCue.mutate({ eventId: event.id, data: { label: cueLabel } }, { onSuccess: () => { setCueLabel(''); invalidateAll(); }})}
              />
              <Button
                variant="outline"
                disabled={!cueLabel || triggerCue.isPending}
                onClick={() => triggerCue.mutate({ eventId: event.id, data: { label: cueLabel } }, { onSuccess: () => { setCueLabel(''); invalidateAll(); }})}
              >
                Trigger
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-6 flex flex-col">
        <Card className="flex flex-col flex-1 min-h-[400px]">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white">
              <ListVideo className="h-4 w-4 text-cyan-400" /> Up Next
            </div>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">No items in run of show.</div>
            ) : (
              <div className="space-y-1">
                {items.slice(0, 8).map((item, i) => (
                  <div key={item.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    item.id === active?.id ? "bg-cyan-500/10 border-cyan-500/30" : "bg-transparent border-transparent hover:bg-white/5"
                  )}>
                    <div className="mono w-6 text-center text-[10px] font-bold text-slate-600">{String(i+1).padStart(2,'0')}</div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-bold truncate", item.id === active?.id ? "text-cyan-400" : "text-slate-200")}>{item.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{item.speaker || item.type} • {item.plannedDurationMinutes}m</div>
                    </div>
                    {item.id === active?.id ? (
                      <Badge variant="live">Live</Badge>
                    ) : (
                      <div className="mono text-[10px] text-slate-600 uppercase">{item.status}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Monitor className="h-4 w-4 text-indigo-400" /> Active Displays
            </div>
            <span className="mono text-[10px] text-slate-500">{displays.length} connected</span>
          </div>
          {displays.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4 bg-black/20 rounded-lg">No connected surfaces.</div>
          ) : (
            <div className="space-y-2">
              {displays.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                  <div>
                    <div className="text-xs font-bold text-slate-200">{d.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{d.assignedLayout}</div>
                  </div>
                  <Badge variant={d.connectionStatus === 'online' ? 'good' : 'warn'}>{d.connectionStatus}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function RunOfShow({ event, items }: { event: EventDetail, items: AgendaItem[] }) {
  const queryClient = useQueryClient();
  const create = useCreateAgendaItem();
  const update = useUpdateAgendaItem();
  const del = useDeleteAgendaItem();

  const [form, setForm] = useState<Partial<AgendaItem>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAgendaItemsQueryKey(event.id) });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.plannedDurationMinutes) return;

    if (form.id) {
      update.mutate(
        { itemId: form.id, data: {
          title: form.title,
          type: form.type as any,
          speaker: form.speaker,
          plannedDurationMinutes: Number(form.plannedDurationMinutes)
        }},
        { onSuccess: () => { setForm({}); setIsEditing(false); invalidate(); } }
      );
    } else {
      create.mutate(
        { eventId: event.id, data: {
          title: form.title,
          type: (form.type || 'custom') as any,
          speaker: form.speaker,
          plannedDurationMinutes: Number(form.plannedDurationMinutes)
        }},
        { onSuccess: () => { setForm({}); setIsEditing(false); invalidate(); } }
      );
    }
  };

  const handleDelete = (id: string) => {
    del.mutate({ itemId: id }, { onSuccess: () => { setItemToDelete(null); invalidate(); } });
  };

  return (
    <Card className="flex flex-col min-h-[50vh] p-6">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2 text-white font-bold text-lg">
          <ListVideo className="h-5 w-5 text-cyan-400" /> Agenda Builder
        </div>
        {!isEditing && (
          <Button variant="primary" size="sm" onClick={() => { setForm({ type: 'custom', plannedDurationMinutes: 15 }); setIsEditing(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Block
          </Button>
        )}
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-black/30 border border-cyan-500/30 rounded-xl p-5 mb-8 fade-up">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="lg:col-span-2">
              <Label>Block Title</Label>
              <Input
                autoFocus
                value={form.title || ''}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Welcome Address"
                required
              />
            </div>
            <div>
              <Label>Speaker / Talent</Label>
              <Input
                value={form.speaker || ''}
                onChange={e => setForm({ ...form, speaker: e.target.value })}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min="1"
                value={form.plannedDurationMinutes || ''}
                onChange={e => setForm({ ...form, plannedDurationMinutes: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setForm({}); setIsEditing(false); }}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={create.isPending || update.isPending}>
              <Check className="h-4 w-4 mr-1" /> Save Block
            </Button>
          </div>
        </form>
      )}

      {items.length === 0 && !isEditing ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-12">
          <ListVideo className="h-10 w-10 mb-4 opacity-50" />
          <p className="mb-4">No agenda items scheduled yet.</p>
          <Button variant="outline" onClick={() => { setForm({ type: 'custom', plannedDurationMinutes: 15 }); setIsEditing(true); }}>
            Add First Block
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={item.id} className="group flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div className="mono w-8 text-center text-xs text-slate-500">{String(i + 1).padStart(2,'0')}</div>

              <div className="flex-1 min-w-0 grid sm:grid-cols-[1.5fr_1fr_1fr] gap-4 items-center">
                <div className="font-bold text-slate-200 truncate">{item.title}</div>
                <div className="text-sm text-slate-400 truncate">{item.speaker || <span className="opacity-50">No speaker</span>}</div>
                <div className="text-sm font-mono text-cyan-400">{item.plannedDurationMinutes}m</div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {itemToDelete === item.id ? (
                  <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded-md border border-red-500/30">
                    <span className="text-xs text-red-400 mr-2 font-bold">Sure?</span>
                    <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-white/10 rounded text-red-400"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setItemToDelete(null)} className="p-1 hover:bg-white/10 rounded text-slate-400"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => { setForm(item); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 focus-ring">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setItemToDelete(item.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 focus-ring">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}