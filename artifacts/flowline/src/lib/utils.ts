import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatTimer = (seconds: number) => {
  const absolute = Math.abs(seconds);
  const h = Math.floor(absolute / 3600);
  const m = String(Math.floor((absolute % 3600) / 60)).padStart(2, '0');
  const s = String(absolute % 60).padStart(2, '0');

  if (h > 0) {
    return `${seconds < 0 ? '+' : ''}${h}:${m}:${s}`;
  }
  return `${seconds < 0 ? '+' : ''}${m}:${s}`;
};

/**
 * Projects anchored counters to the server snapshot, then advances from the
 * local receipt time. This avoids assuming the browser and server clocks match.
 */
export const projectSessionTiming = (session: {
  remainingSeconds: number;
  elapsedSeconds: number;
  state: string;
  timerAnchorAt: string;
  serverTime: string;
}, clientNow = Date.now(), receivedAt = clientNow) => {
  const advances = session.state === 'running' || session.state === 'overtime';
  const anchoredAt = new Date(session.timerAnchorAt).getTime();
  const capturedAt = new Date(session.serverTime).getTime();
  const elapsedToCapture = advances && Number.isFinite(anchoredAt) && Number.isFinite(capturedAt)
    ? Math.max(0, Math.floor((capturedAt - anchoredAt) / 1000))
    : 0;
  const elapsedSinceReceipt = advances
    ? Math.max(0, Math.floor((clientNow - receivedAt) / 1000))
    : 0;
  const projectedSeconds = elapsedToCapture + elapsedSinceReceipt;

  return {
    remainingSeconds: session.remainingSeconds - projectedSeconds,
    elapsedSeconds: session.elapsedSeconds + projectedSeconds,
  };
};

export const fmtDate = (v?: string | null) => v ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(v)) : '—';
export const fmtTime = (v?: string | null) => v ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(v)) : '—';