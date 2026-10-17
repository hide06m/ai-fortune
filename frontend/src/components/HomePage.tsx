/**
 * ホーム画面：館の部屋で、占い師がひとこと話しかけてくれる。占う・前回の結果・履歴・ミニゲーム（準備中）へ進む
 */

import { useEffect, useState } from 'react';
import '../styles/home.css';
import { CHARACTER_VISUAL } from '../data/characterVisuals';
import { CHARACTER_MASTER_DATA, type CharacterId } from '../types/character';
import { getUnlockedCharacters } from '../api/character';
import { listLatestResults, type LatestResultSummary } from '../api/results';
import { pickHomeLine } from '../data/homeLines';
import { CrossfadeImage } from './CrossfadeImage';
import { DailyPanel } from './DailyPanel';
import { getDaily, type DailySnapshot } from '../api/daily';

const KIND_LABEL: Record<string, string> = {
  'fortune:1': '四柱推命などの診断',
  'fortune:2': '西洋占星術',
  sukuyou: '宿曜占星術',
  mbti: '性格タイプ診断',
  love64: '恋愛タイプ診断',
  palm: '手相',
  seimei: '姓名判断',
  musubi: 'ムスビの総合相談',
};

function formatSaved(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface HomePageProps {
  stoneBalance: number | null;
  email: string;
  onPlay: () => void;
  onHistory: () => void;
  onOpenLatest: (kind: string) => void;
  onLogout: () => void;
  /** 石の数が変わったとき（デイリーミッションの報酬） */
  onStoneBalance?: (balance: number) => void;
}

export function HomePage({ stoneBalance, email, onPlay, onHistory, onOpenLatest, onLogout, onStoneBalance }: HomePageProps) {
  const [characterId, setCharacterId] = useState<CharacterId>(0);
  const [line, setLine] = useState('');
  const [panel, setPanel] = useState<null | 'latest' | 'daily'>(null);
  // 赤い印：今日の運勢をまだ見ていない／受け取れる報酬がある
  const [dailyBadge, setDailyBadge] = useState(false);
  const updateBadge = (s: DailySnapshot) => {
    if (!s.success) return;
    const fortuneSeen = s.missions.find((m) => m.id === 'fortune')?.done ?? false;
    setDailyBadge(!fortuneSeen || s.missions.some((m) => m.done && !m.claimed) || s.allBonus.ready);
  };
  useEffect(() => {
    getDaily().then(updateBadge);
  }, []);
  const [latest, setLatest] = useState<LatestResultSummary[]>([]);

  // 来るたびに、解放済みの占い師から1人が出てきて、ひとこと話す
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let pool: CharacterId[] = [0, 1];
      try {
        const u = await getUnlockedCharacters();
        if (u.length) pool = u as CharacterId[];
      } catch {
        /* 取れなければ、ムスビとナツメだけで */
      }
      if (cancelled) return;
      const id = pool[Math.floor(Math.random() * pool.length)];
      setCharacterId(id);
      setLine(pickHomeLine(id));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openLatestPanel = async () => {
    setPanel('latest');
    setLatest(await listLatestResults());
  };

  const { folder, prefix } = CHARACTER_VISUAL[characterId];
  // ムスビは、フードをかぶっていない絵（ham001）。ナツメも、顔の見える絵（002）
  const image = characterId === 0 ? `/assets/characters/${folder}/ham001.webp` : `/assets/characters/${folder}/${prefix}${characterId === 1 ? '002' : '001'}.webp`;

  return (
    <div className="vn-scene home-scene" style={{ backgroundImage: 'url(/assets/room001.jpg)' }}>
      <div className="home-top">
        <div className="home-stone-chip">
          <img src="/assets/stone.webp" alt="" />
          <span>{stoneBalance === null ? '—' : stoneBalance} 個</span>
        </div>
        <span className="home-email">{email}</span>
      </div>

      <div
        className="vn-character-bust-wrap"
        onClick={() => setLine((p) => pickHomeLine(characterId, p))}
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
      >
        <CrossfadeImage src={image} alt={CHARACTER_MASTER_DATA[characterId].name} />
      </div>

      <div className="home-bottom">
        {line && (
          <div className="home-bubble">
            <span className="home-bubble-name">{CHARACTER_MASTER_DATA[characterId].name}</span>
            <p>{line.replace(/。/g, '\n').trim()}</p>
          </div>
        )}
        <div className="home-menu">
          <button type="button" className="home-btn home-btn-main" onClick={onPlay}>
            🔮 占う
          </button>
          <button type="button" className="home-btn home-btn-daily" onClick={() => setPanel('daily')}>
            🌟 運勢・ミッション{dailyBadge && <i className="home-badge" aria-label="新しいお知らせ" />}
          </button>
          <button type="button" className="home-btn" onClick={openLatestPanel}>
            📜 前回の結果
          </button>
          <button type="button" className="home-btn" onClick={onHistory}>
            🗂 診断履歴
          </button>
          <button type="button" className="home-btn is-disabled" disabled title="準備中です">
            🎮 ミニゲーム<small>準備中</small>
          </button>
          <button type="button" className="home-btn home-btn-quiet" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </div>

      {panel === 'daily' && (
        <DailyPanel onClose={() => setPanel(null)} onBalance={(b) => onStoneBalance?.(b)} onSnapshot={updateBadge} />
      )}

      {panel === 'latest' && (
        <div className="home-panel-backdrop" onClick={() => setPanel(null)}>
          <div className="home-panel" onClick={(e) => e.stopPropagation()}>
            <h3>前回の結果（石は使いません）</h3>
            {latest.length === 0 ? (
              <p className="home-panel-empty">まだ、保存された結果がありません。</p>
            ) : (
              <ul>
                {latest.map((r) => (
                  <li key={r.kind}>
                    <button type="button" onClick={() => onOpenLatest(r.kind)}>
                      <span>{KIND_LABEL[r.kind] ?? r.kind}</span>
                      <small>{formatSaved(r.savedAt)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="home-panel-close" onClick={() => setPanel(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
