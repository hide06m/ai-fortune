/**
 * 恋愛タイプ診断64の結果画面に追加する要素（アプローチ解説＋相性診断）
 */

import { useEffect, useState } from 'react'
import '../styles/mbti-result.css'
import { loadLoveApproach, type TextBlock } from '../data/privateData'
import { LongTextSection } from './LongTextSection'
import { LoveCompatibilityChecker } from './LoveCompatibilityChecker'

export function LoveResultExtras({ fullType }: { fullType: string }) {
  const [approach, setApproach] = useState<TextBlock[] | null>(null)
  const baseType = fullType.split('-')[0]

  useEffect(() => {
    loadLoveApproach(baseType).then(setApproach)
  }, [baseType])

  return (
    <>
      {approach && <LongTextSection blocks={approach} />}
      <LoveCompatibilityChecker ownType={fullType} />
    </>
  )
}
