/**
 * AI（Gemini）の呼び出しの、同時実行数の上限
 *
 * 利用者が増えたとき、一度に大量の呼び出しが走ると、混雑（503）や、料金・割り当ての上限（429）に当たりやすい。
 * 上限を超えた呼び出しは、順番待ちにする（待ちすぎたときは、失敗として返し、石は払い戻される）。
 */

const MAX_CONCURRENCY = Math.max(1, Number(process.env.LLM_MAX_CONCURRENCY) || 6)
const MAX_WAIT_MS = 60_000

let active = 0
const queue: Array<{ resolve: () => void; timer: NodeJS.Timeout }> = []

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active++
    return Promise.resolve()
  }
  return new Promise<void>((resolve, reject) => {
    const entry = {
      resolve: () => {
        clearTimeout(entry.timer)
        active++
        resolve()
      },
      timer: setTimeout(() => {
        const i = queue.indexOf(entry)
        if (i >= 0) queue.splice(i, 1)
        reject(new Error('現在、占いの依頼が混み合っています（順番待ちが長すぎました）'))
      }, MAX_WAIT_MS),
    }
    queue.push(entry)
  })
}

function release() {
  active--
  const next = queue.shift()
  if (next) next.resolve()
}

/** 同時実行数の上限のもとで、fn を実行する */
export async function withLlmSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await fn()
  } finally {
    release()
  }
}

export function llmConcurrencyState() {
  return { active, waiting: queue.length, max: MAX_CONCURRENCY }
}
