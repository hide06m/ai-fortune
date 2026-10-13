import { useEffect, useRef, useState } from 'react'

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
  const nativeDateRef = useRef<HTMLInputElement>(null)

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
        onClick={() => {
          const el = nativeDateRef.current as (HTMLInputElement & { showPicker?: () => void }) | null
          el?.showPicker ? el.showPicker() : el?.focus()
        }}
      >
        📅
      </button>
      <input
        ref={nativeDateRef}
        type="date"
        className="birthdate-native-picker"
        tabIndex={-1}
        value={year.length === 4 && month.length > 0 && day.length > 0 ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : ''}
        onChange={(e) => {
          const [y, m, d] = e.target.value.split('-')
          if (y && m && d) {
            setYear(y)
            setMonth(m)
            setDay(d)
          }
        }}
      />
    </div>
  )
}
