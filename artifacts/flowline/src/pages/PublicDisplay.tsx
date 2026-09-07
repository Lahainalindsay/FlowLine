import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetPublicDisplayState, getGetPublicDisplayStateQueryKey,
  useResolveDisplayCode,
  useGetEvent, getGetEventQueryKey,
  useListAgendaItems, getListAgendaItemsQueryKey,
  useGetLiveSession, getGetLiveSessionQueryKey,
  PublicDisplayState, EventDetail
} from '@workspace/api-client-react';
import QRCode from 'react-qr-code';
import { formatTimer, cn, projectSessionTiming } from '../lib/utils';
import { Loader2, TriangleAlert, Monitor, ArrowRight } from 'lucide-react';
import { StageTimeButton, StageTimeInput } from '../components/stagetime';

export default function PublicDisplay() {
  const { displayId = '' } = useParams<{ displayId: string }>();
  const [, setLocation] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  const searchString = window.location.search;
  const urlParams = new URLSearchParams(searchString);
  const queryToken = urlParams.get('token');

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (queryToken) {
      sessionStorage.setItem(`display_token_${displayId}`, queryToken);
      setToken(queryToken);
      // Strip token from URL cleanly
      window.history.replaceState({}, '', `${basePath}/display/${displayId}`);
    } else {
      const storedToken = sessionStorage.getItem(`display_token_${displayId}`);
      if (storedToken) {
        setToken(storedToken);
      } else {
        setLocation(`/display/${displayId}/pair`);
      }
    }
  }, [basePath, queryToken, displayId, setLocation]);

  if (!token) {
    return null;
  }
  return <DisplayHost token={token} displayId={displayId} />;
}

export function DisplayPairing() {
  const { displayId = '' } = useParams<{ displayId: string }>();
  const [, setLocation] = useLocation();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const resolve = useResolveDisplayCode();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setError('');
    resolve.mutate(
      { data: { code } },
      {
        onSuccess: (res) => {
          sessionStorage.setItem(`display_token_${displayId}`, res.token);
          setLocation(`/display/${displayId}`);
        },
        onError: () => setError('Invalid or expired code.')
      }
    );
  };

  return (
    <div className="stagetime-noise flex min-h-[100dvh] items-center justify-center bg-[var(--color-stagetime-bg)] px-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(104,225,255,0.05),transparent_50%)] pointer-events-none" />

      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-[rgba(13,27,46,0.8)] backdrop-blur-xl border border-[var(--color-stagetime-border)] p-10 text-center shadow-2xl relative z-10">
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-xl bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] shadow-[0_0_20px_rgba(77,163,255,0.2)]">
          <Monitor className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white display-font">Pair Surface</h1>
        <p className="mt-3 text-sm text-[var(--color-stagetime-text-dim)]">Enter the pairing code shown on your operator dashboard to link this display.</p>

        <input
          autoFocus
          className="mt-10 w-full rounded-xl border border-[var(--color-stagetime-border)] bg-[rgba(0,0,0,0.4)] px-4 py-5 text-center text-4xl font-bold tracking-[0.2em] text-white outline-none focus:border-[var(--color-stagetime-blue)] focus:ring-1 focus:ring-[var(--color-stagetime-blue)] uppercase transition-all display-font"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
        />

        {error && <div className="mt-5 text-sm font-semibold text-[var(--color-stagetime-red)]">{error}</div>}

        <StageTimeButton
          variant="primary"
          className="mt-8 w-full h-14 text-lg rounded-xl"
          type="submit"
          disabled={code.length < 6 || resolve.isPending}
          loading={resolve.isPending}
        >
          Pair Device <ArrowRight className="ml-2 h-5 w-5" />
        </StageTimeButton>
      </form>
    </div>
  );
}

export function DisplayHost({ token, preview, eventId, displayId }: { token?: string; preview?: boolean; eventId?: string; displayId?: string }) {
  if (preview) {
    return <PreviewDisplayHost eventId={eventId!} displayId={displayId!} />;
  }
  return <TokenDisplayHost token={token!} displayId={displayId} />;
}

function TokenDisplayHost({ token, displayId }: { token: string; displayId?: string }) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const revision = useRef(-1);
  const [streamState, setStreamState] = useState<'CONNECTED' | 'RECONNECTING' | 'OFFLINE'>('OFFLINE');

  const q = useGetPublicDisplayState(
    token,
    { query: { enabled: !!token, refetchInterval: 1000, queryKey: getGetPublicDisplayStateQueryKey(token) } }
  );

  useEffect(() => {
    if (!token) return;
    let opened = false;
    const stream = new EventSource(`/api/display-access/${encodeURIComponent(token)}/stream`);
    const apply = (event: MessageEvent) => {
      let payload: any;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (!payload?.state || payload.revision <= revision.current) return;
      revision.current = payload.revision;
      queryClient.setQueryData(getGetPublicDisplayStateQueryKey(token), payload.state);
    };
    ['snapshot', 'session', 'message', 'cue', 'agenda', 'display', 'event'].forEach((name) => stream.addEventListener(name, apply));
    stream.onopen = () => {
      setStreamState('CONNECTED');
      if (opened) queryClient.invalidateQueries({ queryKey: getGetPublicDisplayStateQueryKey(token) });
      opened = true;
    };
    stream.onerror = () => setStreamState(navigator.onLine ? 'RECONNECTING' : 'OFFLINE');
    return () => stream.close();
  }, [token, queryClient]);

  if (q.isLoading) return <LoadingView />;
  if (q.isError || !q.data) {
    return <ErrorView
      onRetry={() => q.refetch()}
      onPair={() => {
        if (displayId) sessionStorage.removeItem(`display_token_${displayId}`);
        setLocation(`/display/${displayId}/pair`);
      }}
    />;
  }

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const guestUrl = `${window.location.origin}${basePath}/display/${displayId}?token=${token}`;
  return <DisplayUI state={q.data} streamState={streamState} guestUrl={guestUrl} />;
}

function PreviewDisplayHost({ eventId, displayId }: { eventId: string; displayId: string }) {
  const pq = useGetEvent(eventId, { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) } });
  const aq = useListAgendaItems(eventId, { query: { enabled: !!eventId, queryKey: getListAgendaItemsQueryKey(eventId) } });
  const sq = useGetLiveSession(eventId, { query: { enabled: !!eventId, queryKey: getGetLiveSessionQueryKey(eventId), refetchInterval: 1000 } });

  const loading = pq.isLoading || aq.isLoading || sq.isLoading;
  const error = pq.isError || sq.isError || aq.isError;

  if (loading) return <LoadingView />;
  if (error || !pq.data || !aq.data || !sq.data) return <ErrorView onRetry={() => { pq.refetch(); aq.refetch(); sq.refetch(); }} />;

  const state: PublicDisplayState = {
    event: pq.data,
    display: pq.data.displays?.find(d => d.id === displayId) ?? pq.data.displays?.[0] ?? { id: '', eventId: '', name: 'PREVIEW', kind: 'stage', connectionStatus: 'online', assignedLayout: 'default', currentContent: '' },
    agenda: aq.data,
    session: sq.data
  } as any;

  return <DisplayUI state={state} />;
}

function LoadingView() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-black text-[var(--color-stagetime-blue)]/50"><Loader2 className="h-12 w-12 animate-spin" /></div>;
}

function ErrorView({ onRetry, onPair }: { onRetry?: () => void; onPair?: () => void }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-center">
      <div className="max-w-sm">
        <TriangleAlert className="mx-auto h-12 w-12 text-[var(--color-stagetime-red)]" />
        <h1 className="mt-5 text-xl font-bold text-white display-font">Display unavailable</h1>
        <p className="mt-2 text-sm text-[var(--color-stagetime-text-dim)]">We could not load this display. Check the connection or pair this screen again.</p>
        <div className="mt-6 flex justify-center gap-3">
          {onRetry && <StageTimeButton variant="outline" onClick={onRetry}>Retry</StageTimeButton>}
          {onPair && <StageTimeButton variant="primary" onClick={onPair}>Back to pair</StageTimeButton>}
        </div>
      </div>
    </div>
  );
}

function DisplayUI({ state, streamState, guestUrl }: { state: PublicDisplayState, streamState?: string, guestUrl?: string }) {
  const [timing, setTiming] = useState(() => projectSessionTiming(state.session));

  useEffect(() => {
    const receivedAt = Date.now();
    const sync = () => setTiming(projectSessionTiming(state.session, Date.now(), receivedAt));
    sync();
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [state.session.remainingSeconds, state.session.elapsedSeconds, state.session.state, state.session.timerAnchorAt, state.session.serverTime]);

  const active = state.agenda.find(i => i.id === state.session.activeItemId) ?? state.agenda.find(i => i.status === 'active');
  const next = state.agenda.find(i => i.status === 'queued' && i.id !== active?.id);

  const overtime = timing.remainingSeconds < 0;
  const layout = `${state.display?.kind ?? ''} ${state.display?.assignedLayout ?? ''}`.toLowerCase();
  const speakerLayout = layout.includes('speaker');
  const backstageLayout = layout.includes('backstage');
  const creatorLayout = layout.includes('creator');
  const guestLayout = layout.includes('guest');

  if (creatorLayout) {
    return (
      <div className={cn('stagetime-noise relative flex min-h-[100dvh] overflow-hidden bg-transparent p-5 md:p-10', overtime && 'bg-red-950/20')} data-testid="display-creator-layout">
        {streamState && streamState !== 'CONNECTED' && (
          <div className="absolute left-4 top-4 rounded bg-red-950/70 px-2 py-1 font-mono text-[10px] tracking-widest text-[var(--color-stagetime-red)]">{streamState}</div>
        )}
        <div className="mt-auto flex w-full items-end justify-between gap-5 rounded-2xl border border-white/15 bg-[#07111d]/90 p-5 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--color-stagetime-cyan)]">{state.display.currentContent || state.event.name}</div>
            <div className="mt-2 truncate text-2xl font-bold text-white display-font md:text-4xl">{active?.title || 'Ready'}</div>
            {active?.speaker && <div className="mt-1 text-sm text-white/60 md:text-lg">{active.speaker}</div>}
          </div>
          <div className="shrink-0 text-right">
            <div className={cn('timer-text text-[clamp(3.5rem,10vw,9rem)] leading-none', overtime ? 'text-[var(--color-stagetime-red)]' : 'text-white')}>
              {formatTimer(timing.remainingSeconds)}
            </div>
            <div className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-white/45">Elapsed {formatTimer(timing.elapsedSeconds)}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('stagetime-noise flex min-h-[100dvh] flex-col justify-center px-10 py-10 transition-colors duration-1000 overflow-hidden relative', overtime ? 'bg-[#2a0f0d]' : 'bg-[var(--color-stagetime-bg)]')}>
      {streamState && streamState !== 'CONNECTED' && (
        <div className="absolute top-4 left-4 z-50 text-[10px] font-mono tracking-widest text-[var(--color-stagetime-red)] bg-red-950/50 px-2 py-1 rounded">
          {streamState}
        </div>
      )}
      {guestLayout && guestUrl && (
        <div className="absolute right-6 top-6 z-40 rounded-2xl border border-white/15 bg-white p-4 text-center shadow-2xl md:right-10 md:top-10" data-testid="qr-public-display">
          <QRCode value={guestUrl} size={148} level="M" aria-label="QR code to watch this timer on a phone" />
          <div className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-800">Scan to watch live</div>
        </div>
      )}
      {/* Background gradients */}
      {overtime ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,107,122,0.15),transparent_70%)] pointer-events-none animate-pulse" />
      ) : state.session.state === 'running' ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(104,225,255,0.08),transparent_70%)] pointer-events-none" />
      ) : null}

      <div className="flex-1" />

      <div className="text-center relative z-10 w-full max-w-7xl mx-auto">
        <div className="text-2xl md:text-3xl font-bold uppercase tracking-[0.3em] text-[var(--color-stagetime-text-dim)] mb-8 display-font">
          {state.display?.name || 'MAIN STAGE'} <span className="mx-4 opacity-30">•</span> {active?.title || 'READY'}
        </div>
        {state.display?.currentContent && (
          <div className="mb-8 text-xl font-semibold tracking-wide text-white/75 md:text-3xl" data-testid="text-display-content">
            {state.display.currentContent}
          </div>
        )}

        <div className={cn(
          'timer-text text-[clamp(8rem,25vw,30rem)] leading-[0.8] drop-shadow-2xl transition-colors duration-500',
          overtime ? 'text-[var(--color-stagetime-red)]' : state.session.state === 'running' ? 'text-[var(--color-stagetime-green)]' : 'text-white/80'
        )}>
          {formatTimer(timing.remainingSeconds)}
        </div>
        <div className="mt-12 mono text-2xl md:text-3xl uppercase tracking-[0.18em] text-[var(--color-stagetime-text-dim)]">Elapsed {formatTimer(timing.elapsedSeconds)}</div>

        {state.session.state === 'running' && !overtime && (
          <div className="mx-auto mt-16 w-3/4 max-w-4xl h-4 bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-[var(--color-stagetime-cyan)] w-[65%] rounded-full shadow-[0_0_20px_rgba(104,225,255,0.6)]"></div>
          </div>
        )}

        {!speakerLayout && active?.speaker && (
          <div className="mt-16 text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-lg display-font">
            {active.speaker}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {state.session.operatorMessage && (
        <div className="mx-auto mt-auto w-full max-w-5xl rounded-[2rem] border-2 border-[var(--color-stagetime-red)]/50 bg-[#2a0f0d]/80 backdrop-blur-xl p-10 md:p-16 text-center shadow-[0_0_50px_rgba(255,107,122,0.3)] z-20">
          <div className="text-4xl md:text-7xl font-bold leading-tight text-white tracking-tight display-font">
            {state.session.operatorMessage}
          </div>
        </div>
      )}

      {!state.session.operatorMessage && next && !speakerLayout && (
        <div className="mx-auto mt-auto flex items-center justify-between w-full max-w-5xl rounded-[1.5rem] border border-[var(--color-stagetime-border)] bg-[rgba(13,27,46,0.6)] backdrop-blur-md px-12 py-8 z-20 shadow-2xl">
          <div className="text-3xl font-bold text-[var(--color-stagetime-text)] display-font">Up Next: {next.title}</div>
          <div className="mono text-3xl font-bold text-[var(--color-stagetime-cyan)]">{next.plannedDurationMinutes}m</div>
        </div>
      )}
      {backstageLayout && (
        <div className="mx-auto mt-auto w-full max-w-5xl rounded-[1.5rem] border border-[var(--color-stagetime-border)] bg-[rgba(13,27,46,0.6)] backdrop-blur-md px-10 py-6 z-20">
          <div className="text-sm font-bold uppercase tracking-widest text-[var(--color-stagetime-text-dim)]">Rundown</div>
          <div className="mt-3 grid gap-2 md:grid-cols-3 text-lg text-[var(--color-stagetime-text)] display-font">
            {state.agenda.slice(0, 3).map(item => <div key={item.id} className={cn('truncate', item.id === active?.id && 'font-bold text-[var(--color-stagetime-cyan)]')}>{item.title}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}