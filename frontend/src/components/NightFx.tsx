/**
 * 夜のトップページの演出：舞う光の点（蛍のような）と、地面の草花・キノコの、やわらかい明滅
 * 背景画像と同じ大きさのステージの上に重ねるので、位置は、画像の中の割合（%）で決める
 */

import { useMemo } from 'react';

// 光る草花・キノコの位置（背景画像の横・縦の割合 %）と、大きさ（横幅の %）、色
const GLOWS: { x: number; y: number; r: number; c: string }[] = [
  { x: 25.5, y: 82.2, r: 3.2, c: '120, 255, 220' },
  { x: 34.5, y: 84.6, r: 3.0, c: '120, 255, 230' },
  { x: 40.3, y: 84.2, r: 3.4, c: '140, 255, 240' },
  { x: 59.5, y: 80.6, r: 4.2, c: '110, 255, 235' },
  { x: 63.5, y: 81.6, r: 2.6, c: '130, 255, 230' },
  { x: 54.5, y: 93.2, r: 4.6, c: '255, 245, 170' },
  { x: 68.0, y: 89.6, r: 3.6, c: '150, 255, 190' },
  { x: 73.5, y: 90.5, r: 3.4, c: '140, 255, 200' },
  { x: 19.0, y: 93.6, r: 4.0, c: '250, 170, 255' },
  { x: 9.0, y: 95.0, r: 4.4, c: '230, 170, 255' },
  { x: 85.0, y: 86.0, r: 3.2, c: '200, 170, 255' },
  { x: 89.0, y: 86.8, r: 2.8, c: '255, 200, 130' },
  { x: 48.0, y: 93.0, r: 4.4, c: '170, 255, 200' },
  { x: 13.0, y: 89.5, r: 3.0, c: '230, 190, 255' },
  { x: 62.5, y: 87.5, r: 3.0, c: '255, 210, 120' },
];

interface Mote {
  x: number;
  y: number;
  size: number;
  dur: number;
  delay: number;
  dx: number;
  dy: number;
  c: string;
}

const MOTE_COLORS = ['190, 255, 240', '255, 245, 190', '210, 200, 255', '170, 235, 255'];

export function NightFx() {
  // 光の点：位置・速さ・ゆれ方を、最初に1回だけ、ランダムに決める
  const motes = useMemo<Mote[]>(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        x: Math.random() * 100,
        y: 18 + Math.random() * 78,
        size: 4 + Math.random() * 6,
        dur: 9 + Math.random() * 12,
        delay: -Math.random() * 20,
        dx: (Math.random() - 0.5) * 8,
        dy: -(3 + Math.random() * 7),
        c: MOTE_COLORS[i % MOTE_COLORS.length],
      })),
    []
  );

  return (
    <div className="night-fx" aria-hidden="true">
      {GLOWS.map((g, i) => (
        <span
          key={`g${i}`}
          className="night-glow"
          style={{
            left: `${g.x}%`,
            top: `${g.y}%`,
            width: `${g.r * 1.7}%`,
            ['--c' as string]: g.c,
            animationDelay: `${-((i * 1.37) % 5)}s`,
            animationDuration: `${3.6 + (i % 5) * 0.7}s`,
          }}
        />
      ))}
      {motes.map((m, i) => (
        <span
          key={`m${i}`}
          className="night-mote"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            ['--c' as string]: m.c,
            ['--dx' as string]: `${m.dx}%`,
            ['--dy' as string]: `${m.dy}%`,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
