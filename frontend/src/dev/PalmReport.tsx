/**
 * 手相の線検出の精度レポート（開発専用）：/palm-report
 * 正解データのある全サンプルについて、写真の上に「正解（白い点線）」と「検出（色の実線＝しわが確認できた区間だけ）」を重ねて並べ、
 * 線ごとの再現率・精度を示す。
 *   再現率：正解の線のうち、検出の近く（手のひら幅の10%以内）にある部分の割合
 *   精度　：検出のうち、正解の線の近くにある部分の割合
 */

import { useEffect, useState } from 'react';
import { evaluateOne, listSamples, type SampleReport } from './evalPalm';

const COLORS: Record<string, string> = { heart: '#ff5c8a', head: '#4aa8ff', life: '#3ddc84', fate: '#ffc94a' };
const NAMES: Record<string, string> = { heart: '感情線', head: '頭脳線', life: '生命線', fate: '運命線' };
const VERDICT: Record<SampleReport['lines'][number]['verdict'], string> = {
  correct: '✅ 正しく検出',
  wrong: '❌ 位置がずれている',
  missed: '➖ 検出せず（省略）',
  extra: '⚠ 正解なしで検出',
  none: '',
};

export function PalmReport() {
  const [reports, setReports] = useState<SampleReport[]>([]);
  const [progress, setProgress] = useState('準備中…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const files = await listSamples();
      const out: SampleReport[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`解析中… ${i + 1}/${files.length}`);
        const r = await evaluateOne(files[i]).catch(() => null);
        if (cancelled) return;
        // 手があり、正解のある写真だけ並べる
        if (r && r.hasHand && r.lines.some((l) => l.gt)) {
          out.push(r);
          setReports([...out]);
        }
      }
      setProgress('完了');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const all = reports.flatMap((r) => r.lines);
  const gtN = all.filter((l) => l.gt).length;
  const detN = all.filter((l) => l.gt && l.segments).length;
  const okN = all.filter((l) => l.verdict === 'correct').length;
  const wrongN = all.filter((l) => l.verdict === 'wrong').length;
  const extraN = all.filter((l) => l.verdict === 'extra').length;
  const rec = all.filter((l) => l.recall !== undefined).reduce((s, l) => s + l.recall!, 0) / Math.max(1, gtN);
  const prec = all.filter((l) => l.precision !== undefined).reduce((s, l) => s + l.precision!, 0) / Math.max(1, detN);
  const perLine = (id: string) => {
    const ls = all.filter((l) => l.id === id && l.gt);
    const det = ls.filter((l) => l.segments);
    return `${NAMES[id]}：検出 ${det.length}/${ls.length}、正しい ${ls.filter((l) => l.verdict === 'correct').length}`;
  };

  return (
    <div style={{ background: '#15151a', color: '#eee', minHeight: '100vh', padding: 16, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 20 }}>手相の線検出：精度レポート</h1>
      <p style={{ opacity: 0.8 }}>
        {progress}　／　写真の上：白い点線＝あなたが描いた正解、色の実線＝検出（しわが確認できた区間だけ）
      </p>
      <div style={{ background: '#222', padding: 12, borderRadius: 8, margin: '12px 0', lineHeight: 1.8 }}>
        <div>
          <b>全体</b>（{reports.length}枚、正解の線 {gtN}本）：検出 {detN}本（{Math.round((detN / Math.max(1, gtN)) * 100)}%）／ 正しい {okN}本 ／ ずれ{' '}
          {wrongN}本 ／ 余分 {extraN}本
        </div>
        <div>
          平均再現率 {rec.toFixed(2)}（正解のうち検出で覆えた割合）／ 平均精度 {prec.toFixed(2)}（検出のうち正解と重なった割合）
        </div>
        <div style={{ opacity: 0.85 }}>{['heart', 'head', 'life', 'fate'].map(perLine).join('　｜　')}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {reports.map((r) => (
          <div key={r.file} style={{ background: '#222', borderRadius: 8, padding: 8 }}>
            <div style={{ position: 'relative' }}>
              <img src={`/dev-samples/${r.file}`} alt={r.file} style={{ width: '100%', display: 'block', borderRadius: 4 }} />
              <svg
                viewBox="0 0 1000 1000"
                preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              >
                {r.lines.map((l) => (
                  <g key={l.id}>
                    {l.gt && (
                      <polyline
                        points={l.gt.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#fff"
                        strokeWidth={3}
                        strokeDasharray="10 8"
                        vectorEffect="non-scaling-stroke"
                        opacity={0.9}
                      />
                    )}
                    {l.segments?.map((s, i) => (
                      <polyline
                        key={i}
                        points={s.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={COLORS[l.id]}
                        strokeWidth={4}
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                ))}
              </svg>
            </div>
            <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
              <b>{r.file}</b>
              {r.lines.map((l) => (
                <div key={l.id} style={{ color: COLORS[l.id] }}>
                  {NAMES[l.id]}：{VERDICT[l.verdict]}
                  {l.recall !== undefined && `（再現 ${Math.round(l.recall * 100)}% / 精度 ${Math.round(l.precision! * 100)}%）`}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
