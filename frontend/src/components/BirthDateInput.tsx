import { useEffect, useRef, useState } from 'react'

const MIN_YEAR = 1900
const WEEK = ['日', '月', '火', '水', '木', '金', '土']

/**
 * 生年月日のカレンダー
 * ブラウザ標準のカレンダーは、年を選ぶ一覧が長くてスクロールが重い。そこで、年は20年ずつの一覧（ボタン）から選べる専用のカレンダーにした。
 * 使い方：「◯年」を押すと20年ずつの一覧 → 年を選ぶと月の一覧 → 月を選ぶと日にち
 */
function CalendarPopup({ value, onPick, onClose }: { value: string; onPick: (y: string, m: string, d: string) => void; onClose: () => void }) {
  const now = new Date()
  const maxYear = now.getFullYear()
  const [sy, sm, sd] = value ? value.split('-').map(Number) : [0, 0, 0]
  const [mode, setMode] = useState<'days' | 'months' | 'years'>(value ? 'days' : 'years')
  const [vy, setVy] = useState(sy || 1990)
  const [vm, setVm] = useState(sm || 1)
  const [page, setPage] = useState(Math.floor(((sy || 1990) - MIN_YEAR) / 20))
  const boxRef = useRef<HTMLDivElement>(null)

  // まわりを押したら閉じる
  useEffect(() => {
    const onDown = (e: Event) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [onClose])

  const firstDow = new Date(vy, vm - 1, 1).getDay()
  const daysInMonth = new Date(vy, vm, 0).getDate()
  const isFuture = (d: number) => new Date(vy, vm - 1, d) > now
  const moveMonth = (delta: number) => {
    let y = vy
    let m = vm + delta
    if (m < 1) {
      m = 12
      y--
    }
    if (m > 12) {
      m = 1
      y++
    }
    if (y < MIN_YEAR || y > maxYear) return
    setVy(y)
    setVm(m)
  }
  const startYear = MIN_YEAR + page * 20
  const years = Array.from({ length: 20 }, (_, i) => startYear + i).filter((y) => y <= maxYear)

  return (
    <div className="cal-popup" ref={boxRef} role="dialog" aria-label="生年月日を選ぶ">
      {mode === 'days' && (
        <>
          <div className="cal-head">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="前の月">‹</button>
            <span className="cal-title">
              <button type="button" onClick={() => { setPage(Math.floor((vy - MIN_YEAR) / 20)); setMode('years') }}>{vy}年</button>
              <button type="button" onClick={() => setMode('months')}>{vm}月</button>
            </span>
            <button type="button" onClick={() => moveMonth(1)} aria-label="次の月">›</button>
          </div>
          <div className="cal-grid cal-week">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="cal-grid">
            {Array.from({ length: firstDow }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                className={sy === vy && sm === vm && sd === d ? 'is-on' : ''}
                disabled={isFuture(d)}
                onClick={() => { onPick(String(vy), String(vm).padStart(2, '0'), String(d).padStart(2, '0')); onClose() }}
              >
                {d}
              </button>
            ))}
          </div>
        </>
      )}
      {mode === 'months' && (
        <>
          <div className="cal-head">
            <span />
            <span className="cal-title"><button type="button" onClick={() => setMode('years')}>{vy}年</button></span>
            <span />
          </div>
          <div className="cal-grid cal-grid-3">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button key={m} type="button" className={vm === m ? 'is-on' : ''} onClick={() => { setVm(m); setMode('days') }}>{m}月</button>
            ))}
          </div>
        </>
      )}
      {mode === 'years' && (
        <>
          <div className="cal-head">
            <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page <= 0} aria-label="前の20年">‹</button>
            <span className="cal-title">{startYear}〜{Math.min(startYear + 19, maxYear)}年</span>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={startYear + 20 > maxYear} aria-label="次の20年">›</button>
          </div>
          <div className="cal-grid cal-grid-4">
            {years.map((y) => (
              <button key={y} type="button" className={vy === y ? 'is-on' : ''} onClick={() => { setVy(y); setMode('months') }}>{y}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// 生年月日入力：年4桁→自動で月欄へ、月2桁→自動で日欄へフォーカス移動する
export function BirthDateInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const initial = value ? value.split('-') : ['', '', '']
  const [year, setYear] = useState(initial[0] || '')
  const [month, setMonth] = useState(initial[1] || '')
  const [day, setDay] = useState(initial[2] || '')
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  const [calOpen, setCalOpen] = useState(false)

  useEffect(() => {
    if (year.length === 4 && month.length > 0 && day.length > 0) {
      onChange(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
    } else {
      onChange('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day])

  return (
    <div className="birthdate-input-group">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="年"
        maxLength={4}
        value={year}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setYear(v)
          if (v.length === 4) monthRef.current?.focus()
        }}
        className="birthdate-year"
      />
      <span className="birthdate-sep">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="月"
        maxLength={2}
        value={month}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
          setMonth(v)
          if (v.length === 2) dayRef.current?.focus()
        }}
        className="birthdate-month"
      />
      <span className="birthdate-sep">/</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        placeholder="日"
        maxLength={2}
        value={day}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 2)
          setDay(v)
        }}
        className="birthdate-day"
      />
      <button
        type="button"
        className="birthdate-calendar-button"
        aria-label="カレンダーから選択"
        onClick={() => setCalOpen((o) => !o)}
      >
        📅
      </button>
      {calOpen && (
        <CalendarPopup
          value={year.length === 4 && month.length > 0 && day.length > 0 ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : ''}
          onPick={(y, m, d) => {
            setYear(y)
            setMonth(m)
            setDay(d)
          }}
          onClose={() => setCalOpen(false)}
        />
      )}
    </div>
  )
}
