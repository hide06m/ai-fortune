/**
 * 手相診断の結果：撮影した写真の上に各線を重ね、線ごとの解説と紐づけて表示する
 * 線をクリック（または解説カードをクリック）すると、画像上の線と解説が同時にハイライトされる。
 * 写真は診断レスポンスで受け取った一時データで、サーバーにも履歴にも保存されない
 */

import { useState } from 'react';
import '../styles/palm-result.css';
import type { PalmLine } from '../api/palmistry';

const LINE_COLORS: Record<PalmLine['id'], string> = {
  heart: '#ff5c8a',
  head: '#4aa8ff',
  life: '#3ddc84',
  fate: '#ffc94a',
};

interface Props {
  imageUrl: string;
  lines: PalmLine[];
}

export function PalmAnnotatedResult({ imageUrl, lines }: Props) {
  const [activeId, setActiveId] = useState<PalmLine['id'] | null>(null);

  const toggle = (id: PalmLine['id']) => setActiveId((cur) => (cur === id ? null : id));

  return (
    <div className="palm-result">
      <div className="palm-result-image">
        <img src={imageUrl} alt="撮影した手のひら" />
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {lines
            .filter((l) => l.points.length >= 2)
            .map((l) => {
              const color = LINE_COLORS[l.id];
              const dim = activeId !== null && activeId !== l.id;
              const pts = l.points.map((p) => `${p.x},${p.y}`).join(' ');
              return (
                <g key={l.id} opacity={dim ? 0.25 : 1} onClick={() => toggle(l.id)} style={{ cursor: 'pointer' }}>
                  {/* 細い線でも押しやすいよう、透明の太い線を重ねる */}
                  <polyline points={pts} fill="none" stroke="transparent" strokeWidth={28} vectorEffect="non-scaling-stroke" />
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={color}
                    strokeWidth={activeId === l.id ? 6 : 4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
        </svg>
      </div>

      <div className="palm-result-legend">
        {lines.map((l) => {
          const color = LINE_COLORS[l.id];
          const active = activeId === l.id;
          return (
            <button
              key={l.id}
              type="button"
              className={`palm-result-card${active ? ' is-active' : ''}`}
              style={{ ['--palm-color' as string]: color }}
              onClick={() => toggle(l.id)}
            >
              <span className="palm-result-card-title">
                <i className="palm-result-swatch" />
                {l.label}
                {l.points.length < 2 && <small>（写真ではっきり見えませんでした）</small>}
              </span>
              <span className="palm-result-card-text">{l.reading}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
