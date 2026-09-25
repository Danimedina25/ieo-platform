import { createHmac } from "node:crypto";
// Single-process MVP limiter. No user input is stored in plaintext, and size is bounded.
export class LoginLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private global = { count: 0, resetAt: 0 };
  constructor(private readonly secret: string) {}
  allow(email: string, now = Date.now()): boolean {
    if (now >= this.global.resetAt) this.global = { count: 0, resetAt: now + 60_000 };
    if (++this.global.count > 60) return false;
    const key = createHmac("sha256", this.secret).update(email).digest("hex");
    for (const [id, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(id);
    const bucket = this.buckets.get(key) ?? { count: 0, resetAt: now + 15 * 60_000 };
    if (!this.buckets.has(key) && this.buckets.size >= 1000) return false;
    this.buckets.set(key, bucket);
    return ++bucket.count <= 10;
  }
}
