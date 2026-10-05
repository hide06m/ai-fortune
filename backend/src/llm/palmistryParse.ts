/**
 * 手相診断のGemini出力（JSON）の検証・整形
 * モデル出力は信用せず、線のID・座標範囲・点の数を検証してから画面に渡す。
 * JSONとして読めない場合は、全文を診断文として扱い、線の表示だけを諦める（診断自体は失敗させない）
 */

export const PALM_LINE_IDS = ['heart', 'head', 'life', 'fate'] as const
export type PalmLineId = (typeof PALM_LINE_IDS)[number]

export const PALM_LINE_LABELS: Record<PalmLineId, string> = {
  heart: '感情線',
  head: '頭脳線',
  life: '生命線',
  fate: '運命線',
}

export interface PalmLine {
  id: PalmLineId
  label: string
  /** 画像左上を原点とする 0-1000 の座標（x: 右向き、y: 下向き）。線に沿って始点→終点の順 */
  points: Array<{ x: number; y: number }>
  /** この線についての観察と意味（診断文と紐づけて表示する） */
  reading: string
}

export interface PalmistryOutput {
  analysis: string
  lines: PalmLine[]
}

const MIN_POINTS = 2
const MAX_POINTS = 12

function clampCoord(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.min(1000, Math.max(0, Math.round(n)))
}

export function parsePalmistryOutput(raw: string): PalmistryOutput {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { analysis: raw, lines: [] }
  }

  const obj = data as { analysis?: unknown; lines?: unknown }
  const analysis = typeof obj?.analysis === 'string' && obj.analysis.trim() ? obj.analysis : raw
  const lines: PalmLine[] = []
  const seen = new Set<string>()

  if (Array.isArray(obj?.lines)) {
    for (const item of obj.lines) {
      const l = item as { id?: unknown; found?: unknown; points?: unknown; reading?: unknown }
      if (typeof l?.id !== 'string' || !(PALM_LINE_IDS as readonly string[]).includes(l.id) || seen.has(l.id)) continue
      if (typeof l.reading !== 'string' || !l.reading.trim()) continue

      const id = l.id as PalmLineId
      const points: Array<{ x: number; y: number }> = []
      if (l.found !== false && Array.isArray(l.points)) {
        for (const p of l.points.slice(0, MAX_POINTS)) {
          const x = clampCoord((p as { x?: unknown })?.x)
          const y = clampCoord((p as { y?: unknown })?.y)
          if (x !== null && y !== null) points.push({ x, y })
        }
      }
      // 線が見つからなかった／座標が足りない場合も、解説は残す（points を空にして画像上の線だけ描かない）
      seen.add(id)
      lines.push({
        id,
        label: PALM_LINE_LABELS[id],
        points: points.length >= MIN_POINTS ? points : [],
        reading: l.reading.trim(),
      })
    }
  }

  return { analysis, lines }
}
