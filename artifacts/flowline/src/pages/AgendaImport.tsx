import React, { useState } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetEvent, getGetEventQueryKey,
  usePreviewAgendaImport, useApplyAgendaImport, getListAgendaItemsQueryKey
} from '@workspace/api-client-react';
import { StageTimeLayout, StageTimeCard, StageTimeButton, StageTimeBadge } from '../components/stagetime';
import { ArrowLeft, Check, RotateCcw, Zap, TriangleAlert, Loader2 } from 'lucide-react';

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
      <StageTimeLayout>
        <div className="flex flex-col h-[50vh] items-center justify-center text-[var(--color-stagetime-text-dim)] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-stagetime-blue)]" />
        </div>
      </StageTimeLayout>
    );
  }

  if (q.isError || !q.data) {
    return (
      <StageTimeLayout>
        <StageTimeCard className="p-8 text-center max-w-md mx-auto mt-20 border-[var(--color-stagetime-red)]/30 bg-[var(--color-stagetime-red)]/5">
          <div className="text-[var(--color-stagetime-red)] font-bold display-font mb-2">Signal Lost</div>
          <StageTimeButton variant="outline" onClick={() => q.refetch()}>Retry</StageTimeButton>
        </StageTimeCard>
      </StageTimeLayout>
    );
  }

  const event = q.data;
  const p = preview.data;

  return (
    <StageTimeLayout>
      <div className="fade-up mx-auto max-w-4xl">
        <Link href={`/events/${event.id}`} className="mb-10 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-stagetime-text-dim)] hover:text-[var(--color-stagetime-cyan)] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Return to Workspace
        </Link>

        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Data Operations
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white display-font mb-4">Import Schedule</h1>
          <p className="text-[var(--color-stagetime-text-dim)] text-lg">Paste your show flow text. The system will automatically extract timing blocks.</p>
        </div>

        {!p ? (
          <StageTimeCard className="p-8 md:p-12 border-[var(--color-stagetime-blue)]/20 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <textarea
              autoFocus
              className="min-h-[350px] w-full resize-y rounded-xl border border-[var(--color-stagetime-border)] bg-[rgba(0,0,0,0.3)] p-6 text-base font-medium text-white outline-none focus:border-[var(--color-stagetime-blue)] focus:ring-1 focus:ring-[var(--color-stagetime-blue)] transition-colors font-mono shadow-inner"
              placeholder="e.g.&#10;09:00 Opening Remarks (15m)&#10;09:15 Keynote: Future of Tech - Sarah (45m)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {error && (
              <div className="mt-6 rounded-xl border border-[var(--color-stagetime-red)]/20 bg-[var(--color-stagetime-red)]/10 p-5 text-sm font-medium text-[var(--color-stagetime-red)] flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--color-stagetime-red)]" /> {error}
              </div>
            )}
            <div className="mt-8 flex justify-end">
              <StageTimeButton
                variant="primary"
                size="lg"
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
                <Zap className="h-5 w-5 mr-2" /> Extract Blocks
              </StageTimeButton>
            </div>
          </StageTimeCard>
        ) : (
          <StageTimeCard className="p-8 md:p-12 border-[var(--color-stagetime-blue)]/30 bg-[rgba(13,27,46,0.6)] backdrop-blur-xl shadow-[0_0_50px_rgba(77,163,255,0.1)]">
            <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[var(--color-stagetime-border)] pb-8">
              <div className="flex items-center gap-5">
                <StageTimeBadge variant={p.confidence === 'high' ? 'good' : p.confidence === 'medium' ? 'warn' : 'outline'} className="px-4 py-1.5 text-xs">
                  {p.confidence} Confidence
                </StageTimeBadge>
                <span className="text-base font-bold text-white display-font">{p.items.length} Blocks Extracted</span>
              </div>
              <StageTimeButton variant="ghost" onClick={() => preview.reset()}>
                <RotateCcw className="h-4 w-4 mr-2" /> Restart
              </StageTimeButton>
            </div>

            {p.warnings.length > 0 && (
              <div className="mb-10 space-y-3 rounded-xl border border-[var(--color-stagetime-orange)]/30 bg-[var(--color-stagetime-orange)]/10 p-6 shadow-inner">
                {p.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-[var(--color-stagetime-orange)] font-medium">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 mb-10">
              {p.items.map((item, i) => (
                <div key={i} className="flex gap-4 rounded-xl bg-[rgba(0,0,0,0.2)] p-5 border border-[var(--color-stagetime-border)]">
                  <div className="mono w-8 text-[var(--color-stagetime-text-dim)] text-xs mt-1 font-bold">{String(i + 1).padStart(2,'0')}</div>
                  <div className="min-w-0 flex-1 grid sm:grid-cols-2 gap-4">
                    <div>
                      <div className="font-bold text-white text-lg display-font">{item.title}</div>
                      <div className="mt-1 text-sm text-[var(--color-stagetime-text-dim)]">{item.speaker || item.type}</div>
                    </div>
                    <div className="flex sm:justify-end items-center">
                      <div className="mono text-xs uppercase font-bold text-[var(--color-stagetime-cyan)] tracking-widest bg-[var(--color-stagetime-blue)]/10 px-3 py-1.5 rounded border border-[var(--color-stagetime-blue)]/20">
                        {item.plannedDurationMinutes} minutes
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-8 rounded-xl border border-[var(--color-stagetime-red)]/20 bg-[var(--color-stagetime-red)]/10 p-5 text-sm font-medium text-[var(--color-stagetime-red)] flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--color-stagetime-red)]" /> {error}
              </div>
            )}

            <div className="mt-10 flex justify-end gap-5 pt-8 border-t border-[var(--color-stagetime-border)]">
              <Link href={`/events/${event.id}`}>
                <StageTimeButton variant="ghost" size="lg">Cancel</StageTimeButton>
              </Link>
              <StageTimeButton
                variant="primary"
                size="lg"
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
                <Check className="h-5 w-5 mr-2" /> Commit to Run of Show
              </StageTimeButton>
            </div>
          </StageTimeCard>
        )}
      </div>
    </StageTimeLayout>
  );
}