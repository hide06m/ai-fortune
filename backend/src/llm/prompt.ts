/**
 * LLM用プロンプトテンプレート
 */

import type { BaZiChart, NumerologyResult, KyuseiSeisun } from '../fortune/types.js'

export function buildFortunePrompt(
  baZi: BaZiChart,
  numerology: NumerologyResult,
  kyuseiSeisun: KyuseiSeisun
): string {
  const template = `
【占術計算結果】

【四柱推命】
- 命式:
  年柱: ${baZi.yearPillar.stem}${baZi.yearPillar.branch} (${baZi.yearPillar.element})
  月柱: ${baZi.monthPillar.stem}${baZi.monthPillar.branch} (${baZi.monthPillar.element})
  日柱: ${baZi.dayPillar.stem}${baZi.dayPillar.branch} (${baZi.dayPillar.element})
  時柱: ${baZi.timePillar.stem}${baZi.timePillar.branch} (${baZi.timePillar.element})
- 日干(最も重要): ${baZi.dayStem}

【数秘術】
- ライフパスナンバー: ${numerology.lifePathNumber}${numerology.isMasterNumber ? ' (マスターナンバー)' : ''}

【九星気学】
- 本命星: ${kyuseiSeisun}

これらの占術結果に基づいて、あなたの性質、強み、課題、人生の方向性についての統合診断を提供します。
各占術結果は独立した視点から同じ結論に到達していることが多く、その場合は特に信頼性が高いと考えられます。
`

  return template
}

export function buildLLMPrompt(
  baZi: BaZiChart,
  numerology: NumerologyResult,
  kyuseiSeisun: KyuseiSeisun,
  concernText: string
): string {
  const fortuneDesc = buildFortunePrompt(baZi, numerology, kyuseiSeisun)

  return `
${fortuneDesc}

【ユーザーの悩み・現在の状況】
${concernText}

上記の占術結果とユーザーの悩みを踏まえて、以下の構成で統合的な診断文を生成してください:

1. 現在の状況への総評(1-2段落)
2. 強みと課題(箇条書き)
3. 推奨される行動・姿勢(箇条書き)
4. 今後の見通し(1段落)

診断文は励ましと現実的なアドバイスのバランスを取り、決して占い的な曖昧さに逃げず、
統計学的・心理学的根拠が感じられる内容にしてください。
`
}
