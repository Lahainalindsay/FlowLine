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
import { formatTimer, cn } from '../lib/utils';
import { Loader2, TriangleAlert, Monitor, ArrowRight } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { StageTimeLogo } from '../components/layout';

export default function PublicDisplay() {
  const { displayId = '' } = useParams<{ displayId: string }>();
  const [, setLocation] = useLocation();

  const searchString = window.location.search;
  const urlParams = new URLSearchParams(searchString);
  const queryToken = urlParams.get('token');

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (queryToken) {
      sessionStorage.setItem(`display_token_${displayId}`, queryToken);
      setToken(queryToken);
      // Strip token from URL cleanly
      window.history.replaceState({}, '', `/display/${displayId}`);
    } else {
      const storedToken = sessionStorage.getItem(`display_token_${displayId}`);
      if (storedToken) {
        setToken(storedToken);
      } else {
        setLocation(`/display/${displayId}/pair`);
      }
    }
  }, [queryToken, displayId, setLocation]);

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
    <div className="noise flex min-h-[100dvh] items-center justify-center bg-[#0a0e17] px-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.05),transparent_50%)] pointer-events-none" />

      <form onSubmit={submit} className="w-full max-w-md rounded-2xl glass-panel p-10 text-center shadow-2xl relative z-10">
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
          <Monitor className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Pair Surface</h1>
        <p className="mt-3 text-sm text-slate-400">Enter the pairing code shown on your operator dashboard to link this display.</p>

        <input
          autoFocus
          className="mt-10 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-5 text-center text-4xl font-bold tracking-[0.2em] text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 uppercase transition-all"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
        />

        {error && <div className="mt-5 text-sm font-semibold text-red-400">{error}</div>}

        <Button
          variant="primary"
          className="mt-8 w-full h-14 text-lg"
          type="submit"
          disabled={code.length < 6 || resolve.isPending}
          loading={resolve.isPending}
        >
          Pair Device <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}

export function DisplayHost({ token, preview, eventId, displayId }: { token?: string; preview?: boolean; eventId?: string; displayId?: string }) {
  if (preview) {
    return <PreviewDisplayHost eventId={eventId!} displayId={displayId!} />;
  }
  return <TokenDisplayHost token={token!} />;
}

function TokenDisplayHost({ token }: { token: string }) {
  const queryClient = useQueryClient();
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
      const payload = JSON.parse(event.data);
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
  if (q.isError || !q.data) return <ErrorView />;

  return <DisplayUI state={q.data} streamState={streamState} />;
}

function PreviewDisplayHost({ eventId, displayId }: { eventId: string; displayId: string }) {
  const pq = useGetEvent(eventId, { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) } });
  const aq = useListAgendaItems(eventId, { query: { enabled: !!eventId, queryKey: getListAgendaItemsQueryKey(eventId) } });
  const sq = useGetLiveSession(eventId, { query: { enabled: !!eventId, queryKey: getGetLiveSessionQueryKey(eventId), refetchInterval: 1000 } });

  const loading = pq.isLoading || aq.isLoading || sq.isLoading;
  const error = pq.isError || sq.isError || aq.isError;

  if (loading) return <LoadingView />;
  if (error || !pq.data || !aq.data || !sq.data) return <ErrorView />;

  const state: PublicDisplayState = {
    event: pq.data,
    display: pq.data.displays?.find(d => d.id === displayId) ?? pq.data.displays?.[0] ?? { id: '', eventId: '', name: 'PREVIEW', kind: 'stage', connectionStatus: 'online', assignedLayout: 'default', currentContent: '' },
    agenda: aq.data,
    session: sq.data
  } as any;

  return <DisplayUI state={state} />;
}

function LoadingView() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-black text-cyan-500/50"><Loader2 className="h-12 w-12 animate-spin" /></div>;
}

function ErrorView() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-black text-red-500"><TriangleAlert className="h-12 w-12" /></div>;
}

function DisplayUI({ state, streamState }: { state: PublicDisplayState, streamState?: string }) {
  const [localSeconds, setLocalSeconds] = useState(state.session.remainingSeconds);

  useEffect(() => {
    setLocalSeconds(state.session.remainingSeconds);
    const receivedAt = Date.now();
    const sync = () => {
      if (state.session.state !== 'running' && state.session.state !== 'overtime') {
        return setLocalSeconds(state.session.remainingSeconds);
      }
      const serverNow = new Date(state.session.serverTime).getTime() + (Date.now() - receivedAt);
      setLocalSeconds(state.session.remainingSeconds - Math.floor((serverNow - new Date(state.session.timerAnchorAt).getTime()) / 1000));
    };
    sync();
    const id = window.setInterval(sync, 250);
    return () => window.clearInterval(id);
  }, [state.session.remainingSeconds, state.session.state, state.session.serverTime, state.session.timerAnchorAt]);

  const active = state.agenda.find(i => i.id === state.session.activeItemId) ?? state.agenda.find(i => i.status === 'active');
  const next = state.agenda.find(i => i.status === 'queued' && i.id !== active?.id);

  const overtime = localSeconds < 0;

  return (
    <div className={cn('noise flex min-h-[100dvh] flex-col justify-center px-10 py-10 transition-colors duration-1000 overflow-hidden relative', overtime ? 'bg-[#2a0f0d]' : 'bg-[#06090e]')}>
      {streamState && streamState !== 'CONNECTED' && (
        <div className="absolute top-4 left-4 z-50 text-[10px] font-mono tracking-widest text-red-400 bg-red-950/50 px-2 py-1 rounded">
          {streamState}
        </div>
      )}
      {/* Background gradients */}
      {overtime ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,0,0,0.15),transparent_70%)] pointer-events-none animate-pulse" />
      ) : state.session.state === 'running' ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.08),transparent_70%)] pointer-events-none" />
      ) : null}

      <div className="flex-1" />

      <div className="text-center relative z-10 w-full max-w-7xl mx-auto">
        <div className="mono text-2xl md:text-3xl font-bold uppercase tracking-[0.3em] text-slate-500 mb-8">
          {state.display?.name || 'MAIN STAGE'} <span className="mx-4 opacity-30">•</span> {active?.title || 'READY'}
        </div>

        <div className={cn(
          'timer-text text-[clamp(10rem,30vw,35rem)] font-medium leading-[0.8] drop-shadow-2xl transition-colors duration-500',
          overtime ? 'text-[#FF4040]' : state.session.state === 'running' ? 'text-[#00FF9D]' : 'text-slate-600'
        )}>
          {formatTimer(localSeconds)}
        </div>

        {state.session.state === 'running' && !overtime && (
          <div className="mx-auto mt-16 w-3/4 max-w-4xl h-3 bg-white/5 rounded-full overflow-hidden">
             <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 w-[65%] rounded-full shadow-[0_0_15px_rgba(0,229,255,0.5)]"></div>
          </div>
        )}

        {active?.speaker && (
          <div className="mt-16 text-5xl md:text-7xl font-bold tracking-tight text-white drop-shadow-lg">
            {active.speaker}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {state.session.operatorMessage && (
        <div className="mx-auto mt-auto w-full max-w-5xl rounded-3xl border-2 border-red-500/50 bg-red-950/80 backdrop-blur-xl p-10 text-center shadow-[0_0_50px_rgba(255,0,0,0.2)] z-20">
          <div className="text-4xl md:text-6xl font-bold leading-tight text-red-400 tracking-tight">
            {state.session.operatorMessage}
          </div>
        </div>
      )}

      {!state.session.operatorMessage && next && (
        <div className="mx-auto mt-auto flex items-center justify-between w-full max-w-5xl rounded-2xl border border-white/10 glass-panel px-12 py-8 z-20">
          <div className="text-3xl font-bold text-slate-300">Up Next: {next.title}</div>
          <div className="mono text-3xl font-bold text-cyan-400">{next.plannedDurationMinutes}m</div>
        </div>
      )}
    </div>
  );
}