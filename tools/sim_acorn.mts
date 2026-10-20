/**
 * どんぐりキャッチの難易度を、人間らしい自動操縦で、測る（クリア率）
 * 使い方: cd frontend && ../backend/node_modules/.bin/tsx ../tools/sim_acorn.mts
 */
;(globalThis as any).window = { devicePixelRatio: 2 }
;(globalThis as any).document = { createElement: () => ({ getContext: () => null }) }
const { acornCatchSpec } = await import('../frontend/src/minigames/acornCatch.ts')

const { boxes } = await import('../frontend/src/minigames/canvasUtil.ts')
const DIFFS = ['easy', 'normal', 'hard', 'extra'] as const
const fakeImg = (w: number, h: number) => ({ naturalWidth: w, naturalHeight: h }) as any
const imgs: any = {
  acorn: fakeImg(559, 794), acorn_big: fakeImg(600, 800), acorn_gold: fakeImg(600, 800),
  run_mushroom_1: fakeImg(500, 600), run_mushroom_2: fakeImg(500, 600), run_mushroom_3: fakeImg(500, 600),
}

for (const n of Object.keys(imgs)) boxes[n] = { sx: 0, sy: 0, sw: imgs[n].naturalWidth, sh: imgs[n].naturalHeight }

interface Skill { react: number; noise: number }

function runOnce(diff: (typeof DIFFS)[number], skill: Skill): { clear: boolean; time: number } {
  const lives = acornCatchSpec.lives[diff]
  const s: any = acornCatchSpec.init(diff, imgs)
  let hp = lives
  let outcome: null | 'clear' | 'miss' = null
  const api = {
    hurt() { hp -= 1; if (hp <= 0) outcome = 'miss' },
    clear() { if (!outcome) outcome = 'clear' },
    fail() { if (!outcome) outcome = 'miss' },
    setProgress() {},
  }
  const input = { pointerX: null as number | null, left: false, right: false }
  const dt = 1 / 60
  let t = 0
  let target = s.x
  let nextDecide = 0
  while (!outcome && t < 200) {
    if (t >= nextDecide) {
      nextDecide = t + skill.react
      const speed = s.conf.speed
      const CATCH_Y = 730 - 110
      // 反応の遅れ：少し前に見えた、落下物の位置（遅れの分だけ、古い）
      const view = s.items.map((it: any) => ({ ...it, y: it.y - it.vy * skill.react }))
      const arrive = (it: any) => Math.max(0.01, (CATCH_Y - it.y) / it.vy)
      // 目標の位置 tx へ向かったとき、毒に当たらないか（途中の軌道と、そこにとどまる間）
      const safe = (tx: number) => {
        for (const m of view) {
          if (m.kind !== 'mushroom') continue
          const mt = arrive(m)
          const dist = Math.abs(tx - s.x)
          const moved = Math.min(speed * mt, dist)
          const x = s.x + Math.sign(tx - s.x) * moved
          // 毒が、ムスビの高さを通る間（約 100px / 速度）の位置
          const dur = 110 / m.vy
          const x2 = s.x + Math.sign(tx - s.x) * Math.min(speed * (mt + dur), dist)
          if (Math.abs(x - m.x) < 66 + 8 || Math.abs(x2 - m.x) < 66 + 8 || (x - m.x) * (x2 - m.x) < 0) return false
        }
        return true
      }
      let best: any = null
      let bestScore = -1e9
      for (const it of view) {
        if (it.kind === 'mushroom') continue
        const tc = arrive(it)
        const dx = Math.abs(it.x - s.x)
        if (dx > speed * tc + 55) continue
        const tx = Math.max(40, Math.min(500, it.x))
        if (!safe(tx)) continue
        const value = it.kind === 'acorn_gold' ? 5 : it.kind === 'acorn_big' ? 3 : 1
        const sc = value / (tc + 0.15)
        if (sc > bestScore) { bestScore = sc; best = tx }
      }
      if (best === null) {
        // 取れるものがない：毒をさけて、安全な場所に、いちばん近い位置へ
        let bx = s.x
        let bd = safe(s.x) ? 0 : 1e9
        if (bd > 0) for (let x = 40; x <= 500; x += 10) if (safe(x) && Math.abs(x - s.x) < bd) { bd = Math.abs(x - s.x); bx = x }
        best = bx
      }
      target = Math.max(40, Math.min(500, best + (Math.random() - 0.5) * 2 * skill.noise))
    }
    input.pointerX = target
    acornCatchSpec.update(s, dt, api, input, diff, imgs)
    t += dt
  }
  return { clear: outcome === 'clear', time: t }
}

const skills: Record<string, Skill> = { 上手: { react: 0.1, noise: 12 }, ふつう: { react: 0.2, noise: 25 }, 苦手: { react: 0.32, noise: 40 } }
const N = 120
for (const [name, sk] of Object.entries(skills)) {
  const row: string[] = []
  for (const d of DIFFS) {
    let ok = 0
    for (let i = 0; i < N; i++) if (runOnce(d, sk).clear) ok++
    row.push(`${d} ${(ok / N * 100).toFixed(0)}%`)
  }
  console.log(name.padEnd(4), row.join('  '))
}
