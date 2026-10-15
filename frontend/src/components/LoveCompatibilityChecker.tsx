/**
 * 恋愛タイプ診断64：2人のタイプを選んで相性スコアと解説を表示する
 */

import { useEffect, useState } from 'react'
import { loadLoveCompatibility, loadLoveTypeOptions, type LoveCompatibilityEntry } from '../data/privateData'

interface Props {
  ownType?: string // 例: "FAPE-ND"。指定があれば「自分」の初期値にする
}

export function LoveCompatibilityChecker({ ownType }: Props) {
  const [options, setOptions] = useState<Array<{ code: string; name: string }>>([])
  const [self, setSelf] = useState(ownType ?? '')
  const [partner, setPartner] = useState('')
  const [entry, setEntry] = useState<LoveCompatibilityEntry | null>(null)

  useEffect(() => {
    loadLoveTypeOptions().then(setOptions)
  }, [])

  useEffect(() => {
    if (!self || !partner) {
      setEntry(null)
      return
    }
    let cancelled = false
    loadLoveCompatibility(self, partner).then((e) => {
      if (!cancelled) setEntry(e)
    })
    return () => {
      cancelled = true
    }
  }, [self, partner])

  if (options.length === 0) return null

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="love-compat-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">タイプを選択</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code}｜{o.name}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="love-compat">
      <h3>相性診断</h3>
      <div className="love-compat-selects">
        {select(self, setSelf, 'あなた')}
        {select(partner, setPartner, 'お相手')}
      </div>
      {entry && (
        <div className="love-compat-result">
          <div className="love-compat-score">
            <strong>{entry.score}</strong>
            <span> 点</span>
          </div>
          <p>{entry.summary_japanese}</p>
        </div>
      )}
      {self && partner && !entry && <p>この組み合わせのデータが見つかりませんでした。</p>}
    </div>
  )
}
