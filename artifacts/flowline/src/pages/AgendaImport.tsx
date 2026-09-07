import React, { useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetEvent, getGetEventQueryKey,
  usePreviewAgendaImport, useApplyAgendaImport, getListAgendaItemsQueryKey
} from '@workspace/api-client-react';
import { Shell } from '../components/layout';
import { Button, Card, Badge } from '../components/ui';
import { ArrowLeft, Check, RotateCcw, Zap, TriangleAlert, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AgendaImport() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const q = useGetEvent(eventId, { query: { enabled: !!eventId, queryKey: getGetEventQueryKey(eventId) } });
  const preview = usePreviewAgendaImport();
  const apply = useApplyAgendaImport();

  const [text, setText] = useState('');
  const [error, setError] = useState('');

  if (q.isLoading) {
    return (
      <Shell>
        <div className="flex flex-col h-[50vh] items-center justify-center text-slate-400 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      </Shell>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Shell>
        <Card className="p-8 text-center max-w-md mx-auto mt-20 border-red-500/20">
          <div className="text-red-400 font-bold mb-2">Signal Lost</div>
          <Button variant="outline" onClick={() => q.refetch()}>Retry</Button>
        </Card>
      </Shell>
    );
  }

  const event = q.data;
  const p = preview.data;

  return (
    <Shell>
      <div className="fade-up mx-auto max-w-4xl">
        <Link href={`/events/${event.id}`} className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Return to Workspace
        </Link>

        <div className="mb-8">
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold mb-3">Data Operations</div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Import Schedule</h1>
          <p className="text-slate-400">Paste your show flow text. The system will automatically extract timing blocks.</p>
        </div>

        {!p ? (
          <Card className="p-6">
            <textarea
              autoFocus
              className="min-h-[300px] w-full resize-y rounded-xl border border-white/10 bg-black/40 p-6 text-sm font-medium text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              placeholder="e.g.&#10;09:00 Opening Remarks (15m)&#10;09:15 Keynote: Future of Tech - Sarah (45m)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-400">
                {error}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                disabled={!text || preview.isPending}
                loading={preview.isPending}
                onClick={() => {
                  setError('');
                  preview.mutate(
                    { eventId, data: { source: text, format: 'text' } },
                    { onError: () => setError('Parse failure. Verify the format and try again.') }
                  );
                }}
              >
                <Zap className="h-4 w-4 mr-2" /> Extract Blocks
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div className="flex items-center gap-4">
                <Badge variant={p.confidence === 'high' ? 'good' : p.confidence === 'medium' ? 'warn' : 'outline'}>
                  {p.confidence} Confidence
                </Badge>
                <span className="text-sm font-bold text-white">{p.items.length} Blocks Extracted</span>
              </div>
              <Button variant="ghost" onClick={() => preview.reset()}>
                <RotateCcw className="h-4 w-4 mr-1" /> Restart
              </Button>
            </div>

            {p.warnings.length > 0 && (
              <div className="mb-8 space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-5">
                {p.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-amber-400">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 mb-8">
              {p.items.map((item, i) => (
                <div key={i} className="flex gap-4 rounded-xl bg-black/30 p-4 border border-white/5">
                  <div className="mono w-8 text-slate-500 text-xs mt-0.5">{String(i + 1).padStart(2,'0')}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white text-base">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{item.speaker || item.type} <span className="mx-2 opacity-50">•</span> <span className="text-cyan-400 font-mono">{item.plannedDurationMinutes}m</span></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-white/10">
              <Link href={`/events/${event.id}`}>
                <Button variant="ghost">Cancel</Button>
              </Link>
              <Button
                variant="primary"
                disabled={apply.isPending}
                loading={apply.isPending}
                onClick={() => {
                  setError('');
                  apply.mutate(
                    { eventId, data: { items: p.items } },
                    {
                      onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: getListAgendaItemsQueryKey(eventId) });
                        setLocation(`/events/${event.id}`);
                      },
                      onError: () => setError('Database sync failed. Try again.')
                    }
                  );
                }}
              >
                <Check className="h-4 w-4 mr-1" /> Commit to Run of Show
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Shell>
  );
}