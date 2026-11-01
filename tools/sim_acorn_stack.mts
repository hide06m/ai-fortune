/**
 * どんぐり積みの難易度を、人間らしい自動操縦で、測る（クリア率）
 * 使い方: cd frontend && ../backend/node_modules/.bin/tsx ../tools/sim_acorn_stack.mts [timingSdMs] [回数]
 * 人間らしさ：ゆれが、ねらいの位置を通る瞬間を読んでタップするが、タップの時刻に、ばらつき（標準偏差）がある。
 * 判定は、本物のゲーム（update）をそのまま動かす。先読みも、状態を複製して本物の update で進める。
 */
;(globalThis as any).window = { devicePixelRatio: 2, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} }
;(globalThis as any).document = { createElement: () => ({ getContext: () => null }), addEventListener() {}, removeEventListener() {}, visibilityState: 'visible', hidden: false }
;(globalThis as any).location = { search: '' }
;(globalThis as any).localStorage = { getItem: () => null, setItem() {} }
const { acornStackSpec } = await import('../frontend/src/minigames/acornStack.ts')
const { boxes } = await import('../frontend/src/minigames/canvasUtil.ts')

const DIFFS = ['easy', 'normal', 'hard', 'extra'] as const
const sd = (Number(process.argv[2]) || 60) / 1000
const N = Number(process.argv[3]) || 400
const imgs: any = { acorn: { naturalWidth: 559, naturalHeight: 794 }, run_stump_l: { naturalWidth: 600, naturalHeight: 900 } }
for (const n of Object.keys(imgs)) boxes[n] = { sx: 0, sy: 0, sw: imgs[n].naturalWidth, sh: imgs[n].naturalHeight }

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
const dt = 1 / 60

function runOnce(diff: (typeof DIFFS)[number]): { clear: boolean; time: number } {
  const s: any = acornStackSpec.init(diff, imgs)
  let hp = acornStackSpec.lives[diff]
  let outcome: null | 'clear' | 'miss' = null
  const api = {
    hurt() { hp -= 1; if (hp <= 0) outcome = 'miss' },
    clear() { if (!outcome) outcome = 'clear' },
    fail() { if (!outcome) outcome = 'miss' },
    setProgress() {},
  }
  const input = { pointerX: null, left: false, right: false, taps: 0 }
  let t = 0
  let tapAt = -1
  while (!outcome && t < 300) {
    if (!s.drop && s.cooldown <= 0 && tapAt < 0) {
      // ねらい（下のどんぐりの真上）を、ゆれが通る時刻を、本物の update で先読みする
      const target = s.pieces.length ? s.pieces[s.pieces.length - 1].x : 270
      const c = structuredClone(s)
      const dummy = { pointerX: null, left: false, right: false, taps: 0 }
      const noop = { hurt() {}, clear() {}, fail() {}, setProgress() {} }
      let prev = c.swingX - target
      let tau = 0
      for (let i = 0; i < 600; i++) {
        acornStackSpec.update(c, dt, noop as any, dummy, diff, imgs)
        tau += dt
        const cur = c.swingX - target
        if (prev * cur <= 0 && tau > 0.1) break
        prev = cur
      }
      tapAt = t + Math.max(0, tau + gauss() * sd)
    }
    if (tapAt >= 0 && t >= tapAt) { input.taps = 1; tapAt = -1 }
    acornStackSpec.update(s, dt, api as any, input, diff, imgs)
    t += dt
  }
  return { clear: outcome === 'clear', time: t }
}

console.log(`タイミングのばらつき ±${sd * 1000}ms / ${N}回ずつ`)
for (const d of DIFFS) {
  let ok = 0, tm = 0
  for (let i = 0; i < N; i++) { const r = runOnce(d); if (r.clear) { ok++; tm += r.time } }
  console.log(d.padEnd(7), `クリア率 ${((ok / N) * 100).toFixed(1)}%`, ok ? `平均 ${(tm / ok).toFixed(0)}秒` : '')
}
