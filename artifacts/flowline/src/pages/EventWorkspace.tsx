import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetEvent, getGetEventQueryKey,
  useListAgendaItems, getListAgendaItemsQueryKey,
  useListDisplays, getListDisplaysQueryKey,
  useGetLiveSession, getGetLiveSessionQueryKey,
  useControlLiveSession, useSendOperatorMessage, useTriggerCue,
  useCreateAgendaItem, useUpdateAgendaItem, useDeleteAgendaItem, useReorderAgendaItems,
  useCreateDisplayAccess,
  EventDetail, AgendaItem, LiveSession,
  getGetDashboardSummaryQueryKey
} from '@workspace/api-client-react';
import { StageTimeLayout, StageTimeButton, StageTimeCard, StageTimeBadge, StageTimeInput, StageTimeLabel, StageTimeSelect, StageTimeModal, ConfirmDialog, TimerDisplay, TimerControls } from '../components/stagetime';
import { formatTimer, fmtDate, fmtTime, cn, projectSessionTiming } from '../lib/utils';
import {
  ArrowLeft, Monitor, Play, Pause, RotateCcw,
  ArrowRight, Loader2, Zap, MessageSquare, ListVideo,
  Plus, Edit2, Trash2, Check, X, Share2, Copy, Link as LinkIcon, ChevronUp, ChevronDown
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
  const [sharedDisplayId, setSharedDisplayId] = useState<string | null>(null);
  const [shareError, setShareError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const createAccess = useCreateDisplayAccess();

  const handleShare = (displayId: string) => {
    setShareData(null);
    setShareError('');
    setIsCopied(false);
    setIsShareModalOpen(true);
    setSharedDisplayId(displayId);
    createAccess.mutate({ eventId, data: { displayId, expiresInMinutes: 1440 } }, {
      onSuccess: (data) => setShareData(data),
      onError: () => setShareError('Could not create a display link. Please try again.')
    });
  };

  const copyToClipboard = () => {
    if (!shareData) return;
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
    const url = `${window.location.origin}${basePath}/display/${sharedDisplayId}?token=${shareData.token}`;
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
      let payload: any;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (!payload?.state || payload.revision <= revision.current) return;
      revision.current = payload.revision;
      queryClient.setQueryData(getGetEventQueryKey(eventId), (current: EventDetail | undefined) => ({
        ...payload.state,
        accessRole: current?.accessRole,
      }));
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
      <StageTimeLayout>
        <div className="flex flex-col h-[50vh] items-center justify-center text-[var(--color-stagetime-text-dim)] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-stagetime-blue)]" />
          <div className="mono text-xs uppercase tracking-widest">Connecting to Control Room...</div>
        </div>
      </StageTimeLayout>
    );
  }

  if (eq.isError || !eq.data) {
    return (
      <StageTimeLayout>
        <StageTimeCard className="p-8 text-center max-w-md mx-auto mt-20 border-[var(--color-stagetime-red)]/30 bg-[var(--color-stagetime-red)]/5">
          <div className="text-[var(--color-stagetime-red)] font-bold display-font mb-2">Signal Lost</div>
          <p className="text-sm text-[var(--color-stagetime-text-dim)] mb-6">Unable to connect to the event workspace.</p>
          <StageTimeButton variant="outline" onClick={() => eq.refetch()}>Re-establish connection</StageTimeButton>
        </StageTimeCard>
      </StageTimeLayout>
    );
  }

  const event = eq.data;
  const items = aq.data ?? [];
  const session = sessionQ.data ?? event.session;
  const displays = dq.data ?? [];
  const sharedDisplay = displays.find(display => display.id === sharedDisplayId) ?? displays[0];
  const canOperate = ['OWNER', 'ADMIN', 'OPERATOR'].includes(event.accessRole);

  return (
    <StageTimeLayout>
      <div className="fade-up h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-stagetime-text-dim)] hover:text-[var(--color-stagetime-cyan)] transition-colors mb-4">
              <ArrowLeft className="h-3 w-3" /> Command Center
            </Link>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white display-font mb-2">{event.name}</h1>
            <div className="flex items-center gap-3 text-xs font-medium text-[var(--color-stagetime-text-dim)]">
              <span>{fmtDate(event.date)}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--color-stagetime-border)]"></span>
              <span>{event.venue || 'Venue TBC'}</span>
              <span className="h-1 w-1 rounded-full bg-[var(--color-stagetime-border)]"></span>
              <StageTimeBadge variant={event.status === 'live' ? 'live' : 'good'}>{event.status}</StageTimeBadge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canOperate && <Link href={`/events/${event.id}/import`}>
              <StageTimeButton variant="outline">Import Blocks</StageTimeButton>
            </Link>}
            {canOperate && displays.length > 1 && (
              <StageTimeSelect
                aria-label="Display to share or preview"
                value={sharedDisplay?.id ?? ''}
                onChange={e => setSharedDisplayId(e.target.value)}
                className="max-w-40"
              >
                {displays.map(display => <option key={display.id} value={display.id}>{display.name}</option>)}
              </StageTimeSelect>
            )}
            {canOperate && <StageTimeButton variant="primary" onClick={() => handleShare(sharedDisplay?.id ?? '')} disabled={!sharedDisplay}>
              <Share2 className="h-4 w-4 mr-2" /> Share Display
            </StageTimeButton>}
            <Link href={`/events/${event.id}/display/${sharedDisplay?.id ?? 'main'}`}>
              <StageTimeButton variant="glass"><Monitor className="h-4 w-4 mr-2" /> Preview</StageTimeButton>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--color-stagetime-border)] mb-6">
          <button
            className={cn("px-6 py-3 text-sm font-semibold transition-colors border-b-2 outline-none", tab === 'live' ? "border-[var(--color-stagetime-cyan)] text-white" : "border-transparent text-[var(--color-stagetime-text-dim)] hover:text-white")}
            onClick={() => setTab('live')}
          >
            Live Control
          </button>
          <button
            className={cn("px-6 py-3 text-sm font-semibold transition-colors border-b-2 outline-none flex items-center gap-2", tab === 'run' ? "border-[var(--color-stagetime-cyan)] text-white" : "border-transparent text-[var(--color-stagetime-text-dim)] hover:text-white")}
            onClick={() => setTab('run')}
          >
            Run of Show <span className="mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded border border-white/10">{items.length}</span>
          </button>
        </div>

        {/* Content */}
        {tab === 'live' ? (
          <LiveControl event={event} items={items} session={session} displays={displays} streamState={streamState} canControl={canOperate} />
        ) : (
          <RunOfShow event={event} items={items} canEdit={canOperate} />
        )}
      </div>

      <StageTimeModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="Share Display Link">
        {createAccess.isPending ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-[var(--color-stagetime-text-dim)]">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-stagetime-blue)]" />
            <span className="text-sm font-medium">Generating access code...</span>
          </div>
        ) : shareError ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-[var(--color-stagetime-red)]">{shareError}</p>
            <StageTimeButton className="mt-5" variant="outline" onClick={() => handleShare(sharedDisplayId ?? sharedDisplay?.id ?? '')}>Try again</StageTimeButton>
          </div>
        ) : shareData ? (
          <div className="space-y-6">
            <div className="bg-[rgba(0,0,0,0.3)] rounded-xl border border-[var(--color-stagetime-border)] p-6 text-center shadow-inner">
              <div className="text-xs font-bold text-[var(--color-stagetime-text-dim)] uppercase tracking-widest mb-3">Pairing Code</div>
              <div className="text-5xl font-bold tracking-[0.2em] text-white display-font">{shareData.code}</div>
              <div className="text-[10px] text-[var(--color-stagetime-text-dim)] mt-3">For {sharedDisplay?.name ?? 'selected display'} • Expires {fmtDate(shareData.expiresAt)} at {fmtTime(shareData.expiresAt)}</div>
            </div>

            <div className="space-y-2">
              <StageTimeLabel>Read-only public link</StageTimeLabel>
              <div className="flex gap-2">
                <StageTimeInput
                  readOnly
                  value={`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/display/${sharedDisplayId}?token=${shareData.token}`}
                  className="font-mono text-xs text-[var(--color-stagetime-text-dim)] flex-1 truncate"
                />
                <StageTimeButton variant="outline" onClick={copyToClipboard} className="shrink-0 w-28">
                  {isCopied ? <Check className="h-4 w-4 mr-2 text-[var(--color-stagetime-green)]" /> : <Copy className="h-4 w-4 mr-2" />}
                  {isCopied ? 'Copied' : 'Copy'}
                </StageTimeButton>
              </div>
            </div>

            <StageTimeButton
              variant="primary"
              className="w-full h-12 mt-4"
              onClick={() => window.open(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/display/${sharedDisplayId}?token=${shareData.token}`, '_blank')}
            >
              <LinkIcon className="h-4 w-4 mr-2" /> Open in New Tab
            </StageTimeButton>
          </div>
        ) : null}
      </StageTimeModal>
    </StageTimeLayout>
  );
}

function LiveControl({ event, items, session, displays, streamState, canControl }: { event: EventDetail, items: AgendaItem[], session: LiveSession, displays: any[], streamState: string, canControl: boolean }) {
  const queryClient = useQueryClient();
  const control = useControlLiveSession();
  const sendMsg = useSendOperatorMessage();
  const triggerCue = useTriggerCue();

  const [message, setMessage] = useState('');
  const [cueLabel, setCueLabel] = useState('');
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState('');
  const [cueFeedback, setCueFeedback] = useState('');

  const active = items.find(i => i.id === session.activeItemId) ?? items.find(i => i.status === 'active');
  const nextItem = active ? items[items.indexOf(active) + 1] : items[0];
  const prevItem = active ? items[items.indexOf(active) - 1] : null;
  const [timing, setTiming] = useState(() => projectSessionTiming(session));
  useEffect(() => {
    const receivedAt = Date.now();
    const sync = () => setTiming(projectSessionTiming(session, Date.now(), receivedAt));
    sync();
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [session.remainingSeconds, session.elapsedSeconds, session.state, session.timerAnchorAt, session.serverTime]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(event.id) });
    queryClient.invalidateQueries({ queryKey: getGetLiveSessionQueryKey(event.id) });
    queryClient.invalidateQueries({ queryKey: getListAgendaItemsQueryKey(event.id) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const sendMessage = () => {
    if (!canControl || !message.trim()) return;
    setMessageFeedback('');
    sendMsg.mutate(
      { eventId: event.id, data: { message: message.trim(), target: 'all', expiresInSeconds: 120 } },
      {
        onSuccess: () => { setMessage(''); setMessageFeedback('Message sent.'); invalidateAll(); },
        onError: () => setMessageFeedback('Could not send message. Try again.'),
      },
    );
  };

  const sendCue = () => {
    if (!canControl || !cueLabel.trim()) return;
    setCueFeedback('');
    triggerCue.mutate(
      { eventId: event.id, data: { label: cueLabel.trim() } },
      {
        onSuccess: () => { setCueLabel(''); setCueFeedback('Cue triggered.'); invalidateAll(); },
        onError: () => setCueFeedback('Could not trigger cue. Try again.'),
      },
    );
  };

  const act = (action: string, extra?: any) => {
    if (!canControl) return;
    const commandId = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    control.mutate(
      { eventId: event.id, data: { action, expectedRevision: session.revision, commandId, ...extra } as any },
      { onSuccess: invalidateAll, onError: () => invalidateAll() },
    );
  };

  const overtime = timing.remainingSeconds < 0;
  const running = session.state === 'running' || session.state === 'overtime';

  return (
    <div className="grid xl:grid-cols-[1.5fr_1fr] gap-6 flex-1">
      <div className="space-y-6 flex flex-col">
        {/* Main Timer Display */}
        <StageTimeCard className="p-8 md:p-12 flex-1 flex flex-col justify-center relative overflow-hidden transition-colors duration-500 min-h-[500px]">
          {/* Subtle glow behind timer based on state */}
          <div className={cn(
            "absolute inset-0 opacity-20 transition-all duration-1000",
            overtime ? "bg-[radial-gradient(circle_at_center,var(--color-stagetime-red),transparent_70%)]" :
            running ? "bg-[radial-gradient(circle_at_center,var(--color-stagetime-cyan),transparent_70%)]" : "bg-transparent"
          )} />

          <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-10">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 border border-white/10 backdrop-blur-sm">
              <span className={cn("h-2.5 w-2.5 rounded-full", running ? "bg-[var(--color-stagetime-red)] live-dot" : "bg-[var(--color-stagetime-text-dim)]")} />
              <span className="mono text-[10px] uppercase tracking-[0.2em] font-bold text-white">
                {overtime ? 'Overtime' : session.state === 'running' ? 'On Air' : session.state}
              </span>
            </div>
            <span className="mono text-[10px] uppercase tracking-widest text-[var(--color-stagetime-text-dim)]">{streamState} • {fmtTime(session.serverTime)}</span>
          </div>

          <div className="text-center relative z-10 flex-1 flex flex-col justify-center my-8">
            <div className="mb-8 flex flex-col items-center">
              <div className="text-[var(--color-stagetime-text-dim)] text-xs font-bold tracking-[0.2em] uppercase mb-2">Current Segment</div>
              <div className="text-2xl md:text-3xl font-bold display-font text-white">{active?.title || 'Ready for first cue'}</div>
            </div>
            
            <TimerDisplay 
              timeStr={formatTimer(timing.remainingSeconds)} 
              state={session.state}
              huge
              className="my-4"
            />
            
            <div className="mono text-sm uppercase tracking-[0.2em] text-[var(--color-stagetime-text-dim)] mt-4">
              Elapsed {formatTimer(timing.elapsedSeconds)}
            </div>
            
            {active && (
              <div className="mt-8 inline-flex items-center gap-3 bg-[var(--color-stagetime-bg)]/80 rounded-full px-5 py-2.5 border border-[var(--color-stagetime-border)] backdrop-blur-md">
                <span className="text-sm font-bold text-white">{active.speaker || 'No speaker assigned'}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-stagetime-border)]" />
                <span className="text-sm text-[var(--color-stagetime-text-dim)]">{active.plannedDurationMinutes}m segment block</span>
              </div>
            )}
          </div>

          {!canControl && <p className="mb-6 text-center text-sm font-medium text-[var(--color-stagetime-text-dim)] relative z-10">Read-only event access</p>}
          
          <div className="mt-auto pt-8 border-t border-white/5 relative z-10 flex flex-col items-center gap-6">
            <TimerControls
              state={session.state}
              onStart={() => act('start')}
              onPause={() => act('pause')}
              onReset={() => setIsConfirmingReset(true)}
              onNext={() => act('next')}
              onPrev={() => act('previous')}
              loading={control.isPending}
            />
            
            <div className="flex gap-4">
              <StageTimeButton variant="ghost" size="sm" aria-label="Take one minute from the timer" onClick={() => act('subtract_time', { amountSeconds: 60 })} disabled={!canControl || control.isPending}>
                -1 Min
              </StageTimeButton>
              <StageTimeButton variant="ghost" size="sm" aria-label="Give one minute to the timer" onClick={() => act('add_time', { amountSeconds: 60 })} disabled={!canControl || control.isPending}>
                +1 Min
              </StageTimeButton>
            </div>
            
            <ConfirmDialog 
              isOpen={isConfirmingReset} 
              onClose={() => setIsConfirmingReset(false)} 
              onConfirm={() => { setIsConfirmingReset(false); act('reset'); }} 
              title="Reset Timer" 
              message="Are you sure you want to reset the timer for the current segment? This will set elapsed time back to zero." 
              confirmText="Reset" 
              isDestructive 
              loading={control.isPending} 
            />
          </div>
        </StageTimeCard>

        {/* Messaging & Cues */}
        <div className="grid md:grid-cols-2 gap-6">
          <StageTimeCard className="p-6">
            <div className="flex items-center gap-2 mb-5 text-sm font-bold text-white display-font">
              <MessageSquare className="h-5 w-5 text-[var(--color-stagetime-cyan)]" /> Room Message
            </div>
            <div className="flex gap-3 relative">
              <StageTimeInput
                value={message}
                disabled={!canControl}
                onChange={e => setMessage(e.target.value)}
                placeholder="e.g. Hold for talent..."
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && message && sendMessage()}
              />
              <StageTimeButton
                variant="secondary"
                disabled={!canControl || !message || sendMsg.isPending}
                onClick={sendMessage}
              >
                Send
              </StageTimeButton>
              {messageFeedback && <p role="status" className={cn("absolute -bottom-6 left-0 text-[10px] font-medium tracking-wide uppercase", messageFeedback.startsWith('Could not') ? "text-[var(--color-stagetime-red)]" : "text-[var(--color-stagetime-green)]")}>{messageFeedback}</p>}
            </div>
          </StageTimeCard>
          <StageTimeCard className="p-6">
            <div className="flex items-center gap-2 mb-5 text-sm font-bold text-white display-font">
              <Zap className="h-5 w-5 text-[var(--color-stagetime-orange)]" /> Trigger Cue
            </div>
            <div className="flex gap-3 relative">
              <StageTimeInput
                value={cueLabel}
                disabled={!canControl}
                onChange={e => setCueLabel(e.target.value)}
                placeholder="e.g. Walk-on music"
                className="flex-1"
                onKeyDown={e => e.key === 'Enter' && cueLabel && sendCue()}
              />
              <StageTimeButton
                variant="outline"
                disabled={!canControl || !cueLabel || triggerCue.isPending}
                onClick={sendCue}
              >
                Trigger
              </StageTimeButton>
              {cueFeedback && <p role="status" className={cn("absolute -bottom-6 left-0 text-[10px] font-medium tracking-wide uppercase", cueFeedback.startsWith('Could not') ? "text-[var(--color-stagetime-red)]" : "text-[var(--color-stagetime-orange)]")}>{cueFeedback}</p>}
            </div>
          </StageTimeCard>
        </div>
      </div>

      <div className="space-y-6 flex flex-col">
        <StageTimeCard className="flex flex-col flex-1 min-h-[400px]">
          <div className="p-6 border-b border-[var(--color-stagetime-border)] flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white display-font text-lg">
              <ListVideo className="h-5 w-5 text-[var(--color-stagetime-cyan)]" /> Session Queue
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[var(--color-stagetime-text-dim)]">No items in run of show.</div>
            ) : (
              <div className="space-y-2">
                {items.slice(0, 10).map((item, i) => {
                  const isActive = item.id === active?.id;
                  const isNext = item.id === nextItem?.id;
                  const isPrev = item.id === prevItem?.id;
                  
                  return (
                    <div key={item.id} className={cn(
                      "flex items-center gap-4 p-4 rounded-xl border transition-all",
                      isActive ? "bg-[var(--color-stagetime-blue)]/10 border-[var(--color-stagetime-blue)]/30 shadow-[0_0_15px_rgba(77,163,255,0.1)]" : 
                      isNext ? "bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)]" :
                      "bg-transparent border-transparent opacity-60 hover:opacity-100"
                    )}>
                      <div className="mono w-6 text-center text-xs font-bold text-[var(--color-stagetime-text-dim)]">{String(i+1).padStart(2,'0')}</div>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-base font-bold truncate display-font", isActive ? "text-[var(--color-stagetime-cyan)]" : "text-[var(--color-stagetime-text)]")}>{item.title}</div>
                        <div className="text-xs text-[var(--color-stagetime-text-dim)] mt-1 truncate">{item.speaker || item.type} • {item.plannedDurationMinutes}m</div>
                      </div>
                      {isActive ? (
                        <StageTimeBadge variant="live">Live</StageTimeBadge>
                      ) : isNext ? (
                        <div className="mono text-[10px] text-[var(--color-stagetime-text-dim)] uppercase font-bold tracking-widest bg-white/10 px-2 py-1 rounded">Next</div>
                      ) : (
                        <div className="mono text-[10px] text-[var(--color-stagetime-text-dim)] uppercase">{item.status}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </StageTimeCard>

        <StageTimeCard className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="text-base font-bold text-white flex items-center gap-2 display-font">
              <Monitor className="h-5 w-5 text-[var(--color-stagetime-blue)]" /> Active Displays
            </div>
            <span className="mono text-[10px] font-bold text-[var(--color-stagetime-text-dim)] uppercase tracking-widest">{displays.length} connected</span>
          </div>
          {displays.length === 0 ? (
            <div className="text-sm font-medium text-[var(--color-stagetime-text-dim)] text-center py-6 bg-black/20 rounded-xl border border-[var(--color-stagetime-border)] border-dashed">No connected surfaces.</div>
          ) : (
            <div className="space-y-3">
              {displays.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-[rgba(0,0,0,0.2)] p-4 rounded-xl border border-[var(--color-stagetime-border)]">
                  <div>
                    <div className="text-sm font-bold text-white">{d.name}</div>
                    <div className="text-[10px] text-[var(--color-stagetime-text-dim)] mt-1 uppercase tracking-widest font-semibold">{d.assignedLayout}</div>
                  </div>
                  <StageTimeBadge variant={d.connectionStatus === 'online' ? 'good' : 'warn'}>{d.connectionStatus}</StageTimeBadge>
                </div>
              ))}
            </div>
          )}
        </StageTimeCard>
      </div>
    </div>
  );
}

function RunOfShow({ event, items, canEdit }: { event: EventDetail, items: AgendaItem[], canEdit: boolean }) {
  const queryClient = useQueryClient();
  const create = useCreateAgendaItem();
  const update = useUpdateAgendaItem();
  const del = useDeleteAgendaItem();
  const reorder = useReorderAgendaItems();

  const [form, setForm] = useState<Partial<AgendaItem>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [error, setError] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAgendaItemsQueryKey(event.id) });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !form.title || !form.plannedDurationMinutes) return;

    if (form.id) {
      update.mutate(
        { itemId: form.id, data: {
          title: form.title,
          type: form.type as any,
          speaker: form.speaker,
          plannedDurationMinutes: Number(form.plannedDurationMinutes)
        }},
        { onSuccess: () => { setForm({}); setIsEditing(false); invalidate(); }, onError: () => setError('Could not update block. Try again.') }
      );
    } else {
      create.mutate(
        { eventId: event.id, data: {
          title: form.title,
          type: (form.type || 'custom') as any,
          speaker: form.speaker,
          plannedDurationMinutes: Number(form.plannedDurationMinutes)
        }},
        { onSuccess: () => { setForm({}); setIsEditing(false); invalidate(); }, onError: () => setError('Could not create block. Try again.') }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    del.mutate({ itemId: id }, { onSuccess: () => { setItemToDelete(null); invalidate(); }, onError: () => setError('Could not delete block. Try again.') });
  };

  const moveItem = (from: number, direction: -1 | 1) => {
    if (!canEdit) return;
    const to = from + direction;
    if (to < 0 || to >= items.length) return;
    const itemIds = items.map(item => item.id);
    [itemIds[from], itemIds[to]] = [itemIds[to], itemIds[from]];
    setError('');
    reorder.mutate(
      { eventId: event.id, data: { itemIds } },
      { onSuccess: () => invalidate(), onError: () => setError('Could not reorder blocks. Try again.') },
    );
  };

  return (
    <StageTimeCard className="flex flex-col min-h-[50vh] p-6 md:p-8">
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--color-stagetime-border)]">
        <div className="flex items-center gap-3 text-white font-bold text-2xl display-font">
          <ListVideo className="h-6 w-6 text-[var(--color-stagetime-cyan)]" /> Agenda Builder
        </div>
        {canEdit && !isEditing && (
          <StageTimeButton variant="primary" onClick={() => { setForm({ type: 'custom', plannedDurationMinutes: 15 }); setIsEditing(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Block
          </StageTimeButton>
        )}
      </div>
      {error && <p role="alert" className="mb-6 text-sm font-medium text-[var(--color-stagetime-red)] px-4 py-3 bg-[var(--color-stagetime-red)]/10 rounded-lg">{error}</p>}

      {isEditing && (
        <form onSubmit={handleSave} className="bg-[rgba(0,0,0,0.2)] border border-[var(--color-stagetime-blue)]/30 rounded-2xl p-6 md:p-8 mb-10 fade-up shadow-[0_0_20px_rgba(77,163,255,0.05)]">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="lg:col-span-2">
              <StageTimeLabel>Block Title</StageTimeLabel>
              <StageTimeInput
                autoFocus
                value={form.title || ''}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Welcome Address"
                required
              />
            </div>
            <div>
              <StageTimeLabel>Speaker / Talent</StageTimeLabel>
              <StageTimeInput
                value={form.speaker || ''}
                onChange={e => setForm({ ...form, speaker: e.target.value })}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div>
              <StageTimeLabel>Duration (min)</StageTimeLabel>
              <StageTimeInput
                type="number"
                min="1"
                value={form.plannedDurationMinutes || ''}
                onChange={e => setForm({ ...form, plannedDurationMinutes: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-4 border-t border-[var(--color-stagetime-border)] pt-6">
            <StageTimeButton type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</StageTimeButton>
            <StageTimeButton type="submit" variant="primary" loading={create.isPending || update.isPending}>
              {form.id ? 'Update Block' : 'Add Block'}
            </StageTimeButton>
          </div>
        </form>
      )}

      {items.length === 0 && !isEditing ? (
        <div className="py-20 text-center flex flex-col items-center">
          <ListVideo className="h-12 w-12 text-[var(--color-stagetime-text-dim)] opacity-30 mb-6" />
          <h3 className="text-xl font-bold text-white mb-2 display-font">Empty Agenda</h3>
          <p className="text-[var(--color-stagetime-text-dim)] mb-8">Build your run of show to use the live timer controls.</p>
          {canEdit && (
            <StageTimeButton variant="outline" onClick={() => { setForm({ type: 'custom', plannedDurationMinutes: 15 }); setIsEditing(true); }}>
              Add First Block
            </StageTimeButton>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="group flex items-center gap-4 bg-[rgba(0,0,0,0.2)] p-4 rounded-xl border border-[var(--color-stagetime-border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
              <div className="flex flex-col gap-1 items-center justify-center text-[var(--color-stagetime-text-dim)] w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0 || reorder.isPending} className="hover:text-white disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1 || reorder.isPending} className="hover:text-white disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
              <div className="mono w-8 text-center text-xs font-bold text-[var(--color-stagetime-text-dim)] tracking-widest">{String(index+1).padStart(2,'0')}</div>
              <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="font-bold text-white text-lg display-font">{item.title}</div>
                  <div className="text-sm text-[var(--color-stagetime-text-dim)] mt-1">{item.type}</div>
                </div>
                <div className="flex sm:flex-col justify-between sm:justify-center items-start sm:items-end">
                  {item.speaker ? <div className="text-sm font-medium text-white bg-black/30 px-3 py-1 rounded-full border border-white/5">{item.speaker}</div> : <div />}
                  <div className="mono text-[10px] uppercase font-bold text-[var(--color-stagetime-cyan)] mt-2 tracking-widest bg-[var(--color-stagetime-blue)]/10 px-2 py-1 rounded border border-[var(--color-stagetime-blue)]/20">{item.plannedDurationMinutes} minutes</div>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                  <StageTimeButton variant="secondary" size="icon" onClick={() => { setForm(item); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <Edit2 className="h-4 w-4" />
                  </StageTimeButton>
                  <StageTimeButton variant="danger" size="icon" onClick={() => setItemToDelete(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </StageTimeButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && handleDelete(itemToDelete)}
        title="Delete Block"
        message="Are you sure you want to remove this agenda block? This action cannot be undone."
        confirmText="Delete Block"
        isDestructive
        loading={del.isPending}
      />
    </StageTimeCard>
  );
}