/**
 * 姓名判断の結果：名前の各字の画数と、五格（天格・人格・地格・外格・総格）、三才配置を表示する
 */

import '../styles/seimei-result.css';
import type { SeimeiResult } from '../api/seimei';

const LEVEL_CLASS: Record<string, string> = {
  大吉: 'is-daikichi',
  吉: 'is-kichi',
  半吉: 'is-hankichi',
  凶: 'is-kyo',
};

export function SeimeiResultCard({ result }: { result: SeimeiResult }) {
  const [t, j, c] = result.sansai.elements;
  return (
    <div className="seimei-result">
      <div className="seimei-name">
        {[...result.surname, ...result.givenName].map((ch, i) => (
          <span key={i} className={`seimei-char${i === result.surname.length ? ' is-given-start' : ''}`}>
            <span className="seimei-char-glyph">{ch.char}</span>
            <span className="seimei-char-strokes">{ch.strokes}画</span>
          </span>
        ))}
      </div>

      <ul className="seimei-kaku-list">
        {result.kaku.map((k) => (
          <li key={k.key} className="seimei-kaku">
            <div className="seimei-kaku-head">
              <span className="seimei-kaku-label">{k.label}</span>
              <span className="seimei-kaku-strokes">{k.strokes}画</span>
              <span className={`seimei-level ${LEVEL_CLASS[k.level]}`}>{k.level}</span>
              <span className="seimei-kaku-keyword">{k.keyword}</span>
              <span className="seimei-kaku-element">五行：{k.element}</span>
            </div>
            <div className="seimei-kaku-meaning">{k.meaning}</div>
            <div className="seimei-kaku-text">{k.text}</div>
          </li>
        ))}
      </ul>

      <div className="seimei-sansai">
        <b>三才配置</b>：天格 {t} ／ 人格 {j} ／ 地格 {c}（天格と人格：{result.sansai.tenJin}、人格と地格：{result.sansai.jinChi}）
      </div>
      <p className="seimei-note">画数は、旧字体（康熙字典の字体）で、部首は元の形で数えています。流派や書物によって、数え方や吉凶の分類が異なることがあります。</p>
    </div>
  );
}
