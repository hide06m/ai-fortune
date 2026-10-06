/**
 * 手相診断：「しわの候補」から Gemini に線を選ばせる方式
 *
 * フロントが画像処理で取り出した候補（実際のしわの形）に番号を付け、Gemini には
 *   ・どの候補が感情線／頭脳線／生命線／運命線か（見つからなければ none）
 *   ・その線の読み（測定値と判断基準を根拠に）
 * だけを答えさせる。Gemini に座標は書かせない（画面に描く線は必ず写真のしわの形になる）。
 */

import { LINE_CRITERIA, criteriaPromptBlock, describeFeatures, type MeasuredFeatures, type PalmLineKey } from './palmistryCriteria.js'

export interface Candidate {
  id: string
  zone: PalmLineKey
  /** 0〜1000 の座標（画像左上が原点） */
  points: Array<{ x: number; y: number }>
  features: MeasuredFeatures
}

const LINE_KEYS: PalmLineKey[] = ['heart', 'head', 'life', 'fate']
const MAX_CANDIDATES = 24
const MAX_POINTS = 80

function num(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** クライアントから届いた候補を検証する（不正な形のものは捨てる） */
export function sanitizeCandidates(raw: unknown): Candidate[] {
  if (!Array.isArray(raw)) return []
  const out: Candidate[] = []
  const seen = new Set<string>()
  for (const item of raw.slice(0, MAX_CANDIDATES)) {
    const c = item as Record<string, any>
    if (typeof c?.id !== 'string' || !/^C\d{1,3}$/.test(c.id) || seen.has(c.id)) continue
    if (!LINE_KEYS.includes(c.zone)) continue
    if (!Array.isArray(c.points) || c.points.length < 2) continue

    const points: Array<{ x: number; y: number }> = []
    for (const p of c.points.slice(0, MAX_POINTS)) {
      const x = num(p?.x)
      const y = num(p?.y)
      if (x === null || y === null) continue
      points.push({ x: Math.min(1000, Math.max(0, Math.round(x))), y: Math.min(1000, Math.max(0, Math.round(y))) })
    }
    if (points.length < 2) continue

    const f = c.features
    const lengthRatio = num(f?.lengthRatio)
    const straightness = num(f?.straightness)
    const depth = num(f?.depth)
    const continuity = num(f?.continuity)
    const sa = num(f?.start?.a)
    const sd = num(f?.start?.d)
    const ea = num(f?.end?.a)
    const ed = num(f?.end?.d)
    if ([lengthRatio, straightness, depth, continuity, sa, sd, ea, ed].some((v) => v === null)) continue

    seen.add(c.id)
    out.push({
      id: c.id,
      zone: c.zone,
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

function candidateTable(candidates: Candidate[]): string {
  return candidates
    .map((c) => {
      const f = c.features
      return `- ${c.id}（画像処理が推定した位置：${LINE_CRITERIA[c.zone].label}の付近）長さ${f.lengthRatio.toFixed(2)}／直線度${f.straightness.toFixed(2)}／濃さ${f.depth.toFixed(2)}／連続性${f.continuity.toFixed(2)}`
    })
    .join('\n')
}

export function buildSelectionPrompt(concernText: string, candidates: Candidate[]): string {
  const hasConcern = !!concernText && concernText.trim().length > 0
  const situation = hasConcern
    ? `**あなたの状況：**\n${concernText}`
    : `**あなたの状況：**\n特定の悩みの入力はなし。手のひらから、総合的な人物像と人生の傾向を診断してほしい。`

  return `あなたは、手相から人の本質と可能性を見抜く手相占い師です。2枚の画像を渡します。

- 1枚目：撮影した手のひらの元の写真
- 2枚目：同じ写真に、画像処理が見つけた「しわの候補」を番号付きの色線（C1, C2, …）で重ねたもの

# あなたの仕事（1）：どの候補がどの線かを選ぶ
元の写真と2枚目を見比べて、4本の主要な線（heart=感情線、head=頭脳線、life=生命線、fate=運命線）それぞれに当てはまる候補を、候補の番号で選んでください。

選び方のルール：
- 手のひらに**実際に見える線**だけを選ぶ。候補が影・手の輪郭・指のしわ・関係ないしわを拾っているように見えるときは選ばない。
- 候補が合わない、または写真ではっきり見えない線は candidateId を "none" にする（無理に当てはめない。運命線は無い人も多い）。
- 同じ候補を複数の線に使わない。
- 各線の位置の目安：感情線は小指の下あたりから人差し指・中指の方向へ横に伸びる線／頭脳線は親指と人差し指の間あたりから手のひらを横切る線／生命線は親指の付け根を囲む弧／運命線は手首から中指方向へ縦に伸びる線。

## 候補の測定値（画像処理が測った客観的な数値）
${candidateTable(candidates)}
（長さ：指の付け根〜手首の長さを1とした比。直線度：1に近いほどまっすぐ。濃さ・連続性：1に近いほどはっきり・途切れなし）

## 測定値の言葉づかい（reading はこの基準に合わせる。画面には同じ基準の根拠が並んで表示される）
- 形：直線度0.9超＝「まっすぐに近い」／0.75未満＝「大きく曲がっている」／その間＝「ゆるやかなカーブ」
- 濃さ：0.65以上＝「はっきりと濃い」／0.4未満＝「薄め」／その間＝「標準的」
- 連続性：0.8未満＝「途切れ・かすれがある」／それ以上＝「ほぼ途切れなく続いている」
- 長さ（線ごとの境目）：感情線は0.6未満が短め・0.85超が長め／頭脳線は0.8未満が短め・1.15超が長め／生命線は0.85未満が短め・1.2超が長め／運命線は0.6未満が短め・0.95超が長め

# あなたの仕事（2）：選んだ線をもとに診断する
選んだ線の測定値と、下の判断基準を根拠にして診断してください。手相は流派で解釈が分かれるため、断定ではなく「傾向」として語り、医学的・寿命・健康についての断定は絶対にしないこと。

## 判断基準
${criteriaPromptBlock()}

${situation}

---

# 📝 出力（JSON）
次の2つを持つJSONだけを出力する（説明文やコードブロックは付けない）。

- \`lines\`：4本の線（heart, head, life, fate）それぞれ1要素。
  - \`candidateId\`：選んだ候補の番号（例 "C3"）。選べない線は "none"。
  - \`reading\`：その線についての読み（2〜4文）。**写真から見えた特徴（長さ・曲がり・濃さ・途切れ・位置）を、上の言葉づかいに合わせて具体的に示してから**、その意味を傾向として説明する。**候補の番号（C1など）や、画像上の線の色は、文章に書かない**（利用者には見えない内部の情報のため。「親指の付け根を囲む弧」のように、手のひらのどこにある線かで説明する）。選べなかった線は「写真ではっきりとは読み取れませんでした」と書き、無理に意味づけをしない。
- \`analysis\`：診断文（Markdown）。次の構成で、です・ます体、短い段落と箇条書きを組み合わせる。
  - 総合結論（1-2段落。見出しは付けず本文から書き始める）
  - ## 強み（箇条書き 5-7個）
  - ## 課題・気をつけたいこと（箇条書き 4-6個。「ダメ」ではなく「気をつけるとよい」という前向きなトーン）
  - ## テーマ別アドバイス（2-3テーマ。仕事・人間関係・恋愛など）
  - ## 今からできる行動プラン（短期・中期・長期に分けて 4-6個）
  - ## 長期展望（1-2段落）
  4本の線の個別の説明は \`lines\` に書くので、analysis では繰り返さず、線同士の組み合わせから見える全体像を中心に書く。

避けること：誰にでも当てはまる一般論／「運が良い」「宿命」のような曖昧な表現／医学的・寿命の断定。
`
}

export interface SelectedLine {
  id: PalmLineKey
  label: string
  /** 選ばれた候補の番号。見つからなければ null */
  candidateId: string | null
  /** 画像上に描く座標（0〜1000）。候補の形そのもの。見つからなければ空 */
  points: Array<{ x: number; y: number }>
  reading: string
  /** 画面に出す根拠（測定値を言葉にしたもの） */
  evidence: string[]
}

export interface SelectionOutput {
  analysis: string
  lines: SelectedLine[]
}

/** Gemini の出力（JSON）を検証し、選ばれた候補の形と根拠を付けて返す */
export function parseSelectionOutput(raw: string, candidates: Candidate[]): SelectionOutput {
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    return { analysis: raw, lines: [] }
  }
  const analysis = typeof data?.analysis === 'string' && data.analysis.trim() ? data.analysis : raw
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const used = new Set<string>()
  const lines: SelectedLine[] = []
  const seenLine = new Set<string>()

  if (Array.isArray(data?.lines)) {
    for (const item of data.lines) {
      const key = item?.id
      if (!LINE_KEYS.includes(key) || seenLine.has(key)) continue
      const reading = typeof item?.reading === 'string' ? item.reading.trim() : ''
      if (!reading) continue
      seenLine.add(key)

      const cand = typeof item.candidateId === 'string' && !used.has(item.candidateId) ? byId.get(item.candidateId) : undefined
      if (cand) used.add(cand.id)
      lines.push({
        id: key,
        label: LINE_CRITERIA[key as PalmLineKey].label,
        candidateId: cand ? cand.id : null,
        points: cand ? cand.points : [],
        reading,
        evidence: cand ? describeFeatures(key as PalmLineKey, cand.features).evidence : [],
      })
    }
  }
  return { analysis, lines }
}
