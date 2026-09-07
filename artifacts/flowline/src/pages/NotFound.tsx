import React from 'react';
import { Link } from 'wouter';
import { PublicLayout, StageTimeButton } from '../components/stagetime';

export default function NotFound() {
  return (
    <PublicLayout>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 fade-up relative z-10 w-full">
        <div className="text-[12rem] font-bold text-[var(--color-stagetime-blue)]/10 mb-4 tracking-tighter leading-none display-font">404</div>
        <h1 className="text-4xl font-bold text-white mb-4 display-font">Signal Lost</h1>
        <p className="text-[var(--color-stagetime-text-dim)] text-lg max-w-md mb-10">The coordinate you requested does not exist or has been archived.</p>
        <Link href="/">
          <StageTimeButton variant="primary" size="lg">Return to Command Center</StageTimeButton>
        </Link>
      </div>
    </PublicLayout>
  );
}