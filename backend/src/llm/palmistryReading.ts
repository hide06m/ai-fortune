/**
 * 手相診断：撮影側で「定義に合う線だけ」検出して送ってきた結果をもとに、読み（診断文）を書く
 *
 * 線の検出は画像処理側（フロント）が、各線の定義（始点・終点・向き・通る範囲）に合うものだけを行う。
 * ここでは Gemini に線を探させたり、座標を書かせたりしない。
 *   ・検出できた線 → 測定値と判断基準を根拠に読みを書く
 *   ・検出できなかった線 → 何も言わない（「見つからなかった」とも書かない）
 */

import { LINE_CRITERIA, criteriaPromptBlock, describeFeatures, type MeasuredFeatures, type PalmLineKey } from './palmistryCriteria.js'

export interface DetectedLine {
  id: PalmLineKey
  /** 0〜1000 の座標（画像左上が原点、始点→終点の順） */
  points: Array<{ x: number; y: number }>
  features: MeasuredFeatures
}

const LINE_KEYS = Object.keys(LINE_CRITERIA) as PalmLineKey[]
const MAX_LINES = 8
const MAX_POINTS = 80

function num(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** クライアントから届いた検出結果を検証する（不正な形のものは捨てる） */
export function sanitizeDetectedLines(raw: unknown): DetectedLine[] {
  if (!Array.isArray(raw)) return []
  const out: DetectedLine[] = []
  const seen = new Set<string>()
  for (const item of raw.slice(0, MAX_LINES)) {
    const l = item as Record<string, any>
    if (!LINE_KEYS.includes(l?.id) || seen.has(l.id)) continue
    if (!Array.isArray(l.points) || l.points.length < 2) continue

    const points: Array<{ x: number; y: number }> = []
    for (const p of l.points.slice(0, MAX_POINTS)) {
      const x = num(p?.x)
      const y = num(p?.y)
      if (x === null || y === null) continue
      points.push({ x: Math.min(1000, Math.max(0, Math.round(x))), y: Math.min(1000, Math.max(0, Math.round(y))) })
    }
    if (points.length < 2) continue

    const f = l.features
    const lengthRatio = num(f?.lengthRatio)
    const straightness = num(f?.straightness)
    const depth = num(f?.depth)
    const continuity = num(f?.continuity)
    const sa = num(f?.start?.a)
    const sd = num(f?.start?.d)
    const ea = num(f?.end?.a)
    const ed = num(f?.end?.d)
    if ([lengthRatio, straightness, depth, continuity, sa, sd, ea, ed].some((v) => v === null)) continue

    seen.add(l.id)
    out.push({
      id: l.id,
      points,
      features: {
        lengthRatio: lengthRatio!,
        straightness: straightness!,
        depth: depth!,
        continuity: continuity!,
        start: { a: sa!, d: sd! },
        end: { a: ea!, d: ed! },
      },
    })
  }
  return out
}

function measurementTable(lines: DetectedLine[]): string {
  return lines
    .map((l) => {
      const f = l.features
      return `- ${LINE_CRITERIA[l.id].label}：長さ${f.lengthRatio.toFixed(2)}／直線度${f.straightness.toFixed(2)}／濃さ${f.depth.toFixed(2)}／連続性${f.continuity.toFixed(2)}`
    })
    .join('\n')
}

export function buildReadingPrompt(concernText: string, lines: DetectedLine[]): string {
  const hasConcern = !!concernText && concernText.trim().length > 0
  const situation = hasConcern
    ? `**あなたの状況：**\n${concernText}`
    : `**あなたの状況：**\n特定の悩みの入力はなし。手のひらから、総合的な人物像と人生の傾向を診断してほしい。`

  const linesBlock =
    lines.length > 0
      ? `# 確実に検出できた線
画像処理が、定義（始点・終点・向き・通る範囲）に合う線として確実に検出できたのは、次の線**だけ**です。

## 測定値（客観的な数値）
${measurementTable(lines)}
（長さ：指の付け根〜手首の長さを1とした比。直線度：1に近いほどまっすぐ。濃さ・連続性：1に近いほどはっきり・途切れなし）

## 測定値の言葉づかい（reading はこの基準に合わせる。画面には同じ基準の根拠が並んで表示される）
- 形：直線度0.9超＝「まっすぐに近い」／0.75未満＝「大きく曲がっている」／その間＝「ゆるやかなカーブ」
- 濃さ：0.65以上＝「はっきりと濃い」／0.4未満＝「薄め」／その間＝「標準的」
- 連続性：0.8未満＝「途切れ・かすれがある」（生命線だけは「途中で一度途切れ、その先でまた続いている」）／それ以上＝「ほぼ途切れなく続いている」
- 生命線の途切れの読み方：寿命や病気の兆候として読まない。「生活や役割の転換期を経験しやすい」「転換期で立ち止まっても、そこから持ち直す力がある」という傾向として、前向きに書く。いつ頃の出来事かの断定（年齢・年数）もしない
- 長さ（線ごとの境目）：感情線は0.6未満が短め・0.85超が長め／頭脳線は0.8未満が短め・1.15超が長め／生命線は0.85未満が短め・1.2超が長め／運命線は0.6未満が短め・0.95超が長め

## 判断基準（検出できた線について）
${criteriaPromptBlock(lines.map((l) => l.id))}`
      : `# 検出できた線
今回の写真では、線の検出結果は使えません。手のひら全体の印象（手の大きさ・指の長さ・全体のバランス・肌の質感など、写真から見える範囲）から、人物像と傾向を診断してください。**個々の線（感情線・頭脳線など）の読みは書かないこと。**`

  return `あなたは、手相から人の本質と可能性を見抜く手相占い師です。手のひらの写真（左手）を1枚渡します。
${linesBlock}

# 診断のルール
- 上に挙がった線**だけ**を読む。挙がっていない線（検出できなかった線）については、**言及しない**。「見つかりませんでした」「読み取れませんでした」「無いようです」とも書かない。手相には、無い人が多い線もあり、検出できなかったことは診断に使わない。
- 手相は流派で解釈が分かれるため、断定ではなく「傾向」として語る。医学的な診断・寿命・健康についての断定は絶対にしない。
- 文章に、画像処理の内部の情報（座標・色・番号など）は書かない。

${situation}

---

# 📝 出力（JSON）
次の2つを持つJSONだけを出力する（説明文やコードブロックは付けない）。

- \`lines\`：上に挙がった線それぞれ1要素（挙がっていない線は含めない）。
  - \`id\`：線のid（heart=感情線, head=頭脳線, life=生命線, fate=運命線, simian=ますかけ線, marriage=結婚線, sun=太陽線, health=健康線）。
  - \`reading\`：その線についての読み（2〜4文）。測定値を上の言葉づかいに合わせて具体的に示してから、その意味を傾向として説明する。「親指の付け根を囲む弧」のように、手のひらのどこにある線かで説明する。
- \`analysis\`：診断文（Markdown）。次の構成で、です・ます体、短い段落と箇条書きを組み合わせる。
  - 総合結論（1-2段落。見出しは付けず本文から書き始める）
  - ## 強み（箇条書き 5-7個）
  - ## 課題・気をつけたいこと（箇条書き 4-6個。「ダメ」ではなく「気をつけるとよい」という前向きなトーン）
  - ## テーマ別アドバイス（2-3テーマ。仕事・人間関係・恋愛など）
  - ## 今からできる行動プラン（短期・中期・長期に分けて 4-6個）
  - ## 長期展望（1-2段落）
  線ごとの説明は \`lines\` に書くので、analysis では繰り返さず、線同士の組み合わせから見える全体像を中心に書く。

避けること：誰にでも当てはまる一般論／「運が良い」「宿命」のような曖昧な表現／医学的・寿命の断定。
`
}

export interface ReadingLine {
  id: PalmLineKey
  label: string
  /** 画像上に描く座標（0〜1000）。検出された線の形そのもの */
  points: Array<{ x: number; y: number }>
  reading: string
  /** 画面に出す根拠（測定値を言葉にしたもの） */
  evidence: string[]
}

export interface ReadingOutput {
  analysis: string
  lines: ReadingLine[]
}

/** Gemini の出力（JSON）を検証し、検出された線の形と根拠を付けて返す。検出されていない線の読みは捨てる */
export function parseReadingOutput(raw: string, detected: DetectedLine[]): ReadingOutput {
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    return { analysis: raw, lines: [] }
  }
  const analysis = typeof data?.analysis === 'string' && data.analysis.trim() ? data.analysis : raw
  const byId = new Map(detected.map((l) => [l.id, l]))
  const seen = new Set<string>()
  const lines: ReadingLine[] = []

  if (Array.isArray(data?.lines)) {
    for (const item of data.lines) {
      const line = byId.get(item?.id)
      if (!line || seen.has(line.id)) continue
      const reading = typeof item?.reading === 'string' ? item.reading.trim() : ''
      if (!reading) continue
      seen.add(line.id)
      lines.push({
        id: line.id,
        label: LINE_CRITERIA[line.id].label,
        points: line.points,
        reading,
        evidence: describeFeatures(line.id, line.features).evidence,
      })
    }
  }
  // 読みが返らなかった線も、検出できていれば画像には載せる（読みなしで根拠だけ）。ただし読み抜けは稀なので省く
  return { analysis, lines }
}
