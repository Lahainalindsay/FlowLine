export type DisplayCodeRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

type RateLimitEntry = { attempts: number; resetAt: number };

/**
 * Small in-process guard for the unauthenticated six-character code exchange.
 * It intentionally has a hard memory bound; this is a defense-in-depth control
 * rather than a substitute for edge rate limiting in a multi-instance deploy.
 */
export class DisplayCodeRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly limit = 12,
    private readonly windowMs = 60_000,
    private readonly maxEntries = 10_000,
  ) {}

  consume(ip: string, now = Date.now()): DisplayCodeRateLimitResult {
    const existing = this.entries.get(ip);
    if (!existing || existing.resetAt <= now) {
      this.makeRoom(now);
      this.entries.set(ip, { attempts: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    existing.attempts += 1;
    if (existing.attempts <= this.limit) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  private makeRoom(now: number) {
    if (this.entries.size < this.maxEntries) return;
    for (const [ip, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(ip);
    }
    while (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (!oldest) return;
      this.entries.delete(oldest);
    }
  }
}