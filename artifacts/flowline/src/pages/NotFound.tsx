import React from 'react';
import { Link } from 'wouter';
import { PublicLayout } from '../components/layout';
import { Button } from '../components/ui';

export default function NotFound() {
  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 fade-up">
        <div className="mono text-8xl font-bold text-cyan-500/20 mb-4 tracking-tighter">404</div>
        <h1 className="text-3xl font-bold text-white mb-4">Signal Lost</h1>
        <p className="text-slate-400 max-w-md mb-8">The coordinate you requested does not exist or has been archived.</p>
        <Link href="/">
          <Button variant="primary">Return to Base</Button>
        </Link>
      </div>
    </PublicLayout>
  );
}