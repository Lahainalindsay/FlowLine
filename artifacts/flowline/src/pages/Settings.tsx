import React from 'react';
import { Shell } from '../components/layout';
import { Card, Button, Input, Label } from '../components/ui';
import { Link } from 'wouter';

export default function Settings() {
  return (
    <Shell>
      <div className="max-w-4xl mx-auto fade-up">
        <h1 className="text-3xl font-bold text-white mb-8">Workspace Settings</h1>

        <div className="space-y-8">
          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-4">Team Profile</h2>
            <div className="space-y-6 max-w-xl">
              <div>
                <Label>Workspace Name</Label>
                <Input defaultValue="Production Crew" />
              </div>
              <div>
                <Label>Default Timezone</Label>
                <Input defaultValue="America/Los_Angeles" disabled />
              </div>
              <Button variant="primary">Save Changes</Button>
            </div>
          </Card>

          <Card className="p-8">
            <h2 className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-4">Billing & Plan</h2>
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="text-cyan-400 font-bold mb-1">Workspace billing</div>
                <div className="text-sm text-slate-400">View the persisted plan and current entitlements.</div>
              </div>
              <Link href="/billing"><Button variant="outline">View billing</Button></Link>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}