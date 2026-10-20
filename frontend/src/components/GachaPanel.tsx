/**
 * 出会いのガチャ：ルーンストーンで、森で、ほかの人のタイプに出会う → 図鑑に入る
 * 自分の診断結果とは関係なく、いろいろなタイプに出会える
 */

import { useEffect, useState } from 'react';
import { MBTI_TYPES } from '../data/mbtiTypes';
import { getCollection } from '../api/collection';
import { playSe } from '../sound';
import { getGachaInfo, pullGacha, type GachaInfo, type GachaResult } from '../api/home';

const KIND_LABEL = { mbti: '性格タイプ', love: '恋愛タイプ', sukuyou: '宿曜（本命宿）' } as const;

export function GachaPanel({ onClose, onBalance }: { onClose: () => void; onBalance?: (balance: number) => void }) {
  const [info, setInfo] = useState<GachaInfo | null>(null);
  const [result, setResult] = useState<(GachaResult & { name: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    getGachaInfo()
      .then((i) => {
        if (i.success) {
          setInfo(i);
          onBalance?.(i.balance);
        }
      })
      .catch(() => setError('読み込めませんでした'));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pull = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    playSe('gacha_walk');
    const r = await pullGacha();
    if (!r.success || !r.kind || !r.code) {
      setError(r.message || '引けませんでした');
      setBusy(false);
      return;
    }
    // 名前を調べる（恋愛タイプの名前は、図鑑のデータにある）
    let name = r.code;
    if (r.kind === 'mbti') name = MBTI_TYPES[r.code]?.name ?? r.code;
    if (r.kind === 'love') {
      const z = await getCollection();
      name = z?.love.find((x) => x.code === r.code)?.name ?? r.code;
    }
    setResult({ ...r, name });
    playSe(r.isNew ? 'gacha_new' : 'gacha_dup');
    if (typeof r.balance === 'number') onBalance?.(r.balance);
    await load();
    setBusy(false);
  };

  const image = result?.kind === 'mbti' ? `/assets/results/mbti/${result.code}.webp` : result?.kind === 'love' ? `/assets/results/lovetype/${result.code}.webp` : null;
  const canPull = !!info && !info.complete && info.balance >= info.cost && !busy;

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel gacha-panel" onClick={(e) => e.stopPropagation()}>
        <h3>🌲 森での出会い</h3>
        <p className="gacha-lead">ルーンストーンを使うと、森の中で、だれかに出会えます。出会ったタイプは図鑑に残ります。</p>
        {info && (
          <p className="gacha-progress">
            出会った数　<b>{info.collected}</b> / {info.total}
          </p>
        )}

        {result && (
          <div className={`gacha-result${result.isNew ? ' is-new' : ''}`}>
            <small>{KIND_LABEL[result.kind!]}</small>
            {image ? <img src={image} alt={result.name} /> : <div className="gacha-shuku">{result.code!.replace('宿', '')}</div>}
            <strong>{result.name}</strong>
            <span>{result.isNew ? '新しい出会いです' : `また会えました（石を${result.refunded}個お返しします）`}</span>
          </div>
        )}

        <button type="button" className="gacha-pull" disabled={!canPull} onClick={pull}>
          {info?.complete ? 'すべてのタイプに出会いました' : busy ? '森を歩いています' : `森を歩く（ルーンストーン ${info?.cost ?? 3}個）`}
        </button>
        {info && !info.complete && info.balance < info.cost && <p className="gacha-note">ルーンストーンが足りません</p>}
        {error && <p className="daily-error">{error}</p>}
        <button type="button" className="home-panel-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
