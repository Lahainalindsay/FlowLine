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

export const fmtDate = (v?: string | null) => v ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(v)) : '—';
export const fmtTime = (v?: string | null) => v ? new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(v)) : '—';