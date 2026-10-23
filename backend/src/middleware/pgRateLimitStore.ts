/**
 * express-rate-limit の、DB（rate_limits テーブル）に数える Store。
 * Cloudflare Workers では、リクエストごとに別のサーバーが動くため、メモリのカウンターでは数えられない。
 * Node（開発）でも同じ DB を使うので、動作は同じ。
 */
import type { Store, Options, IncrementResponse, ClientRateLimitInfo } from 'express-rate-limit'
import { query } from '../db/client.js'

export class PgRateLimitStore implements Store {
  private windowMs = 60_000
  private ns: string

  constructor(prefix: string) {
    this.ns = prefix
  }

  init(options: Options): void {
    this.windowMs = options.windowMs
  }

  private k(key: string): string {
    return `${this.ns}:${key}`
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const r = await query('SELECT hits, reset_at FROM rate_limits WHERE key = $1 AND reset_at > NOW()', [this.k(key)])
    if (!r.rows[0]) return undefined
    return { totalHits: Number(r.rows[0].hits), resetTime: new Date(r.rows[0].reset_at) }
  }

  async increment(key: string): Promise<IncrementResponse> {
    const r = await query(
      `INSERT INTO rate_limits (key, hits, reset_at) VALUES ($1, 1, NOW() + ($2 || ' milliseconds')::interval)
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.hits + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN NOW() + ($2 || ' milliseconds')::interval ELSE rate_limits.reset_at END
       RETURNING hits, reset_at`,
      [this.k(key), String(this.windowMs)]
    )
    return { totalHits: Number(r.rows[0].hits), resetTime: new Date(r.rows[0].reset_at) }
  }

  async decrement(key: string): Promise<void> {
    await query('UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1', [this.k(key)])
  }

  async resetKey(key: string): Promise<void> {
    await query('DELETE FROM rate_limits WHERE key = $1', [this.k(key)])
  }
}
