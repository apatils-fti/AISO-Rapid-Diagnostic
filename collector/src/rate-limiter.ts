/**
 * Token-bucket style rate limiter for staying within Perplexity's RPM limits.
 *
 * Usage:
 *   const limiter = new RateLimiter(50); // 50 RPM
 *   await limiter.acquire();             // blocks until a token is available
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(requestsPerMinute: number) {
    this.maxRequests = requestsPerMinute;
    this.windowMs = 60_000; // 1 minute
  }

  /** Block until we can make another request without exceeding the rate limit. */
  async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();

      // Purge timestamps older than the window
      this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      // Earliest timestamp in the window — wait until it falls outside
      const oldest = this.timestamps[0];
      const waitMs = oldest + this.windowMs - now + 50; // +50ms safety margin
      await sleep(waitMs);
    }
  }

  /** Returns how many requests are available right now. */
  get available(): number {
    const now = Date.now();
    const recent = this.timestamps.filter(t => now - t < this.windowMs).length;
    return Math.max(0, this.maxRequests - recent);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
