/**
 * 姓名判断の図：名前を縦に並べ、五格（天格・人格・地格・外格・総格）を、画数と吉凶つきで示す
 *
 *   外格（左）　　姓（上）　┐ 天格
 *                          ┤ 人格
 *                 名（下）　┘ 地格
 *   五行・三才配置　金-水-火　吉凶混合　　　総格
 */

import type { SeimeiKaku, SeimeiResult } from '../api/seimei';

const ROW_H = 64; // 1文字の高さ
const BRACKET_W = 78; // 文字と、右の格の枠のあいだの幅

const LEVEL_CLASS: Record<string, string> = { 大吉: 'is-daikichi', 吉: 'is-kichi', 半吉: 'is-hankichi', 凶: 'is-kyo' };

function KakuBox({ k, className }: { k: SeimeiKaku; className?: string }) {
  return (
    <div className={`sd-box ${className ?? ''}`}>
      <div className="sd-box-label">{k.label}</div>
      <div className="sd-box-strokes">{k.strokes}</div>
      <div className={`sd-box-level ${LEVEL_CLASS[k.level]}`}>{k.level}</div>
    </div>
  );
}

export function SeimeiDiagram({ result }: { result: SeimeiResult }) {
  const chars = [...result.surname, ...result.givenName];
  const S = result.surname.length;
  const n = chars.length;
  const H = n * ROW_H;
  const k = Object.fromEntries(result.kaku.map((x) => [x.key, x])) as Record<SeimeiKaku['key'], SeimeiKaku>;

  // 各格が示す文字の範囲（行の番号：0始まり、[from, to) ）
  const ranges = {
    ten: [0, S],
    jin: [S - 1, S + 1],
    chi: [S, n],
  } as const;
  // 右の枠は、上から、天格・人格・地格の順に、3等分した位置に置く
  const boxCenterY = { ten: H / 6, jin: H / 2, chi: (H * 5) / 6 };

  const overall = result.sansai.overall ?? (result.sansai.tenJin !== '相剋' && result.sansai.jinChi !== '相剋' ? '吉' : result.sansai.tenJin === '相剋' && result.sansai.jinChi === '相剋' ? '凶' : '吉凶混合');
  const [t, j, c] = result.sansai.elements;

  return (
    <div className="seimei-diagram">
      <div className="sd-main">
        <div className="sd-left">
          <KakuBox k={k.gai} />
        </div>

        <div className="sd-names" style={{ height: H }}>
          {chars.map((ch, i) => (
            <div key={i} className="sd-char" style={{ height: ROW_H }}>
              {ch.char}
            </div>
          ))}
        </div>

        <div className="sd-right" style={{ height: H, width: BRACKET_W + 92 }}>
          <svg className="sd-brackets" width={BRACKET_W} height={H} viewBox={`0 0 ${BRACKET_W} ${H}`} aria-hidden="true">
            {(['ten', 'jin', 'chi'] as const).map((key, idx) => {
              const [from, to] = ranges[key];
              const y1 = from * ROW_H + 8;
              const y2 = to * ROW_H - 8;
              const x = 6 + idx * 12;
              const mid = (y1 + y2) / 2;
              return (
                <g key={key} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5">
                  <path d={`M0,${y1} H${x} V${y2} H0`} />
                  <path d={`M${x},${mid} L${BRACKET_W},${boxCenterY[key]}`} />
                </g>
              );
            })}
          </svg>
          <div className="sd-boxes" style={{ left: BRACKET_W }}>
            <KakuBox k={k.ten} />
            <KakuBox k={k.jin} />
            <KakuBox k={k.chi} />
          </div>
        </div>
      </div>

      <div className="sd-bottom">
        <div className="sd-sansai">
          <span className="sd-sansai-title">五行・三才配置</span>
          <span className="sd-sansai-elements">
            {t}－{j}－{c}
          </span>
          <span className={`sd-sansai-overall ${overall === '吉' ? 'is-kichi' : overall === '凶' ? 'is-kyo' : 'is-mixed'}`}>{overall}</span>
        </div>
        <KakuBox k={k.so} className="sd-so" />
      </div>
    </div>
  );
}
