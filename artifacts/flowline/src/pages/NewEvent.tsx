import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateEvent,
  getListEventsQueryKey,
  getGetDashboardSummaryQueryKey
} from '@workspace/api-client-react';
import { Shell } from '../components/layout';
import { Button, Card, Input, Label, Select } from '../components/ui';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

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
    <Shell>
      <div className="max-w-3xl mx-auto fade-up">
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="h-3 w-3" /> Return to Command Center
        </Link>

        <div className="mb-10">
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-bold mb-3">Provision Workspace</div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">New Production</h1>
          <p className="text-slate-400">Initialize a new event workspace for your crew.</p>
        </div>

        <Card className="p-6 md:p-10">
          <form onSubmit={submit} className="space-y-6">
            <div>
              <Label hint="Visible to the entire control room">Production Name</Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Global Tech Summit 2024"
                className="text-lg py-6"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Event Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Time Zone</Label>
                <Select
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                  <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                </Select>
              </div>
            </div>

            <div>
              <Label hint="Optional">Venue / Location</Label>
              <Input
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                placeholder="e.g. Main Hall, Moscone Center"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm font-medium text-red-400">
                {error}
              </div>
            )}

            <div className="pt-6 mt-8 border-t border-white/10 flex items-center justify-end gap-4">
              <Link href="/">
                <Button type="button" variant="ghost">Cancel</Button>
              </Link>
              <Button type="submit" variant="primary" loading={create.isPending}>
                Provision Workspace <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </Shell>
  );
}