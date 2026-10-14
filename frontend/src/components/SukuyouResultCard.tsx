/**
 * 宿曜占星術の結果：旧暦の日付、本命宿、三九の宿（命・業・胎）を表示する
 */

import '../styles/seimei-result.css';
import type { SukuyouResult, SukuyouShuku } from '../api/sukuyou';

function ShukuBox({ label, note, s }: { label: string; note: string; s: SukuyouShuku }) {
  return (
    <li className="seimei-kaku">
      <div className="seimei-kaku-head">
        <span className="seimei-kaku-label">{label}</span>
        <span className="seimei-kaku-strokes">{s.name}</span>
        <span className="seimei-kaku-element">{s.reading}・{s.youbi}曜</span>
        <span className="seimei-kaku-keyword">{s.keywords.join('・')}</span>
      </div>
      <div className="seimei-kaku-meaning">{note}</div>
      <div className="seimei-kaku-text">{s.text}</div>
    </li>
  );
}

export function SukuyouResultCard({ result }: { result: SukuyouResult }) {
  const k = result.kyureki;
  return (
    <div className="seimei-result">
      <div className="seimei-sansai">
        <b>生年月日</b>：{result.birthDate}（旧暦 {k.isLeap ? '閏' : ''}{k.month}月{k.day}日）
      </div>
      <div className="sukuyou-main">
        <div className="sukuyou-main-label">本命宿</div>
        <div className="sukuyou-main-name">{result.mei.name}</div>
        <div className="sukuyou-main-sub">{result.mei.reading}・{result.mei.youbi}曜</div>
      </div>
      <ul className="seimei-kaku-list">
        <ShukuBox label="命宿（本命宿）" note="あなたの核になる性格・魅力" s={result.mei} />
        <ShukuBox label="業宿" note="本命宿から9つ先。積み重ねや、過去からの課題の面" s={result.gyo} />
        <ShukuBox label="胎宿" note="本命宿から18先。内面の深いところ、支えとなる面" s={result.tai} />
      </ul>
      <p className="seimei-note">旧暦は、天文計算で求めています。閏月は、元の月と同じ月として数えています。流派や書物によって、解釈が異なることがあります。</p>
    </div>
  );
}
