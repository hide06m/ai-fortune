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

  // 外から値が入れられたとき（ナツメで答えた内容を、入力済みにするとき）に、欄へ反映する
  useEffect(() => {
    if (!value) return
    const [y, m, d] = value.split('-')
    if (y !== year || m !== month.padStart(2, '0') || d !== day.padStart(2, '0')) {
      setYear(y ?? '')
      setMonth(m ?? '')
      setDay(d ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

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
      {/* 📅 の上に、透明な日付入力を重ねる。指でふれると、そのまま、端末のカレンダーが開く（スマホで確実に開く方法） */}
      <span className="birthdate-calendar-wrap">
        <span className="birthdate-calendar-button" aria-hidden="true">
          📅
        </span>
        <input
          ref={nativeDateRef}
          type="date"
          className="birthdate-native-picker"
          aria-label="カレンダーから選択"
          // 年の一覧が、ありえない範囲（0001〜275760年）まで、続くと、スクロールが、重くなる。生まれた年として、ありうる範囲に、しぼる
          min="1900-01-01"
          max={new Date().toISOString().slice(0, 10)}
          // 未入力のときは、1990年のあたりで、カレンダーが開く（今年から、遠くまで、さかのぼらなくてよいように）
          value={year.length === 4 && month.length > 0 && day.length > 0 ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` : '1990-01-01'}
        onChange={(e) => {
          const [y, m, d] = e.target.value.split('-')
          if (y && m && d) {
            setYear(y)
            setMonth(m)
            setDay(d)
          }
        }}
        />
      </span>
    </div>
  )
}
