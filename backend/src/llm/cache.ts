/**
 * LLM応答のメモリキャッシュ層
 */

import crypto from 'crypto'

interface CacheEntry {
  result: string
  timestamp: number
  ttlMs: number
}

class FortuneCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly defaultTTL = 24 * 60 * 60 * 1000 // 24 hours

  /**
   * キャッシュキーを生成(命式+悩みテキストのハッシュ)
   */
  private generateKey(bazi: string, concern: string): string {
    const combined = `${bazi}:${concern}`
    return crypto.createHash('sha256').update(combined).digest('hex')
  }

  /**
   * キャッシュから取得
   */
  get(baziStr: string, concernText: string): string | null {
    const key = this.generateKey(baziStr, concernText)
    const entry = this.cache.get(key)

    if (!entry) return null

    // TTL切れチェック
    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key)
      return null
    }

    return entry.result
  }

  /**
   * キャッシュに保存
   */
  set(baziStr: string, concernText: string, result: string, ttlMs?: number): void {
    const key = this.generateKey(baziStr, concernText)
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttlMs: ttlMs || this.defaultTTL
    })
  }

  /**
   * キャッシュ統計情報
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear()
  }
}

export const fortuneCache = new FortuneCache()
