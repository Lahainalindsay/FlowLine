import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateEvent,
  getListEventsQueryKey,
  getGetDashboardSummaryQueryKey
} from '@workspace/api-client-react';
import { StageTimeLayout, StageTimeCard, StageTimeButton, StageTimeInput, StageTimeLabel, StageTimeSelect } from '../components/stagetime';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function NewEvent() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const create = useCreateEvent();

  const [form, setForm] = useState({ name: '', date: '', venue: '', timezone: 'America/Los_Angeles' });
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.date) {
      setError('Production name and date are required to initialize the workspace.');
      return;
    }
    setError('');
    create.mutate({ data: form }, {
      onSuccess: (event) => {
        queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setLocation(`/events/${event.id}`);
      },
      onError: () => setError('Could not provision the production. Verify connection and try again.')
    });
  };

  return (
    <StageTimeLayout>
      <div className="max-w-3xl mx-auto fade-up">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-stagetime-text-dim)] hover:text-[var(--color-stagetime-cyan)] mb-10 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Command Center
        </Link>

        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Workspace Init
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white display-font mb-4">New Production</h1>
          <p className="text-[var(--color-stagetime-text-dim)] text-lg">Initialize a new event workspace for your crew.</p>
        </div>

        <StageTimeCard className="p-8 md:p-12 border-[var(--color-stagetime-blue)]/20 bg-[rgba(13,27,46,0.6)] backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <form onSubmit={submit} className="space-y-8">
            <div>
              <StageTimeLabel hint="Visible to the entire control room">Production Name</StageTimeLabel>
              <StageTimeInput
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Global Tech Summit 2024"
                className="text-lg py-7 px-5"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <StageTimeLabel>Event Date</StageTimeLabel>
                <StageTimeInput
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <StageTimeLabel>Time Zone</StageTimeLabel>
                <StageTimeSelect
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                  <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                </StageTimeSelect>
              </div>
            </div>

            <div>
              <StageTimeLabel hint="Optional">Venue / Location</StageTimeLabel>
              <StageTimeInput
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="e.g. Main Hall, Moscone Center"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-[var(--color-stagetime-red)]/10 border border-[var(--color-stagetime-red)]/20 p-5 text-sm font-medium text-[var(--color-stagetime-red)] flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--color-stagetime-red)]" /> {error}
              </div>
            )}

            <div className="pt-8 mt-10 border-t border-[var(--color-stagetime-border)] flex items-center justify-end gap-5">
              <Link href="/">
                <StageTimeButton type="button" variant="ghost">Cancel</StageTimeButton>
              </Link>
              <StageTimeButton type="submit" variant="primary" size="lg" loading={create.isPending}>
                Provision Workspace <ArrowRight className="h-5 w-5 ml-2" />
              </StageTimeButton>
            </div>
          </form>
        </StageTimeCard>
      </div>
    </StageTimeLayout>
  );
}