/**
 * 図鑑（出会ったタイプ）と実績（ホーム画面から開く）
 */

import { useEffect, useState } from 'react';
import { MBTI_TYPES } from '../data/mbtiTypes';
import { getAchievements, getCollection, type AchievementItem, type CollectionData, type CollectionItem } from '../api/collection';

type Tab = 'zukan' | 'achv';
type Section = 'mbti' | 'love' | 'sukuyou';

const SECTION_LABEL: Record<Section, string> = { mbti: '性格タイプ', love: '恋愛タイプ', sukuyou: '宿曜（本命宿）' };

function Card({ section, item }: { section: Section; item: CollectionItem }) {
  const name = section === 'mbti' ? MBTI_TYPES[item.code]?.name ?? item.code : section === 'love' ? item.name ?? item.code : item.code;
  const image = section === 'mbti' ? `/assets/results/mbti/${item.code}.webp` : section === 'love' ? `/assets/results/lovetype/${item.code}.webp` : null;
  return (
    <li className={`zukan-card${item.collected ? ' is-got' : ''}`}>
      {image ? <img src={image} alt={item.collected ? name : '？'} /> : <div className="zukan-shuku">{item.collected ? item.code.replace('宿', '') : '？'}</div>}
      <span className="zukan-name">{item.collected ? name : '？？？'}</span>
      {item.collected && item.count > 1 && <small>{item.count}回</small>}
    </li>
  );
}

export function CollectionPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('zukan');
  const [zukan, setZukan] = useState<CollectionData | null>(null);
  const [achv, setAchv] = useState<AchievementItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const [z, a] = await Promise.all([getCollection(), getAchievements()]);
      if (!z && !a) setFailed(true);
      setZukan(z);
      setAchv(a);
    })();
  }, []);

  const got = (items: CollectionItem[]) => items.filter((i) => i.collected).length;

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel zukan-panel" onClick={(e) => e.stopPropagation()}>
        <div className="zukan-tabs">
          <button type="button" className={tab === 'zukan' ? 'is-on' : ''} onClick={() => setTab('zukan')}>
            📖 図鑑
          </button>
          <button type="button" className={tab === 'achv' ? 'is-on' : ''} onClick={() => setTab('achv')}>
            🏅 実績
          </button>
        </div>

        {failed && <p className="daily-error">読み込めませんでした。時間をおいて、もう一度お試しください。</p>}
        {!failed && !zukan && !achv && <p className="home-panel-empty">読み込んでいます…</p>}

        {tab === 'zukan' && (
          <div className="zukan-preparing">
            <p>🔒 図鑑は、準備中です。</p>
            <p>性格タイプ16・恋愛タイプ16・宿曜27宿の、図鑑を、作っています。自分の診断結果ではなく、「ほかの人のタイプ」に出会って、集めていく形を、考えています。</p>
          </div>
        )}

        {false &&
          zukan &&
          (['mbti', 'love', 'sukuyou'] as Section[]).map((s) => (
            <section key={s}>
              <h3 className="zukan-title">
                {SECTION_LABEL[s]}　<small>{got(zukan[s])} / {zukan[s].length}</small>
              </h3>
              <ul className={`zukan-grid${s === 'sukuyou' ? ' is-small' : ''}`}>
                {zukan[s].map((item) => (
                  <Card key={item.code} section={s} item={item} />
                ))}
              </ul>
            </section>
          ))}


        {tab === 'achv' && achv && (
          <ul className="achv-list">
            {achv.map((a) => (
              <li key={a.id} className={a.done ? 'is-done' : ''}>
                <div>
                  <b>{a.done ? '🏅 ' : ''}{a.title}</b>
                  <small>{a.desc}</small>
                </div>
                <span className="achv-progress">{a.done ? '達成' : `${a.progress} / ${a.target}`}</span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="home-panel-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
