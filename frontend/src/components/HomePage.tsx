/**
 * ホーム画面：館の部屋で、占い師がひとこと話しかけてくれる。占う・前回の結果・履歴・ミニゲーム（準備中）へ進む
 */

import { StonePanel } from './StonePanel';
import { InboxPanel } from './InboxPanel';
import { ShopPanel } from './ShopPanel';
import { GachaPanel } from './GachaPanel';
import { getHomeProfile, type HomeProfile } from '../api/home';
import { getInbox, type InboxMessage } from '../api/inbox';
import { useEffect, useState } from 'react';
import '../styles/home.css';
import { CHARACTER_VISUAL } from '../data/characterVisuals';
import { CHARACTER_MASTER_DATA, type CharacterId } from '../types/character';
import { getUnlockedCharacters } from '../api/character';
import { listLatestResults, type LatestResultSummary } from '../api/results';
import { pickHomeLine } from '../data/homeLines';
import { CrossfadeImage } from './CrossfadeImage';
import { DailyPanel } from './DailyPanel';
import { CollectionPanel } from './CollectionPanel';
import { PeoplePanel } from './PeoplePanel';
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
  // 決まるまでは、立ち絵を出さない（別の占い師の絵が、一瞬、映るのを防ぐ）
  const [characterId, setCharacterId] = useState<CharacterId | null>(null);
  const [line, setLine] = useState('');
  const [panel, setPanel] = useState<null | 'latest' | 'daily' | 'zukan' | 'people' | 'stone' | 'inbox' | 'shop' | 'gacha'>(null);
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
  // 受信箱：未読・受け取れる石があると赤い印。ホームに出すお知らせは、いちばん新しい1件
  const [inboxBadge, setInboxBadge] = useState(0);
  const [homeNotice, setHomeNotice] = useState<InboxMessage | null>(null);
  const refreshInbox = () => {
    getInbox()
      .then((r) => {
        setInboxBadge(r.messages.filter((m) => !m.read || (m.stones > 0 && !m.claimed)).length);
        setHomeNotice(r.messages.find((m) => m.showOnHome && !m.read) ?? null);
      })
      .catch(() => undefined);
  };
  useEffect(refreshInbox, []);
  // 交換所で身につけた、称号とホームの背景
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const refreshProfile = () => {
    getHomeProfile()
      .then((p) => p.success && setProfile(p))
      .catch(() => undefined);
  };
  useEffect(refreshProfile, []);
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

  const shown: CharacterId = characterId ?? 0;
  const { folder, prefix } = CHARACTER_VISUAL[shown];
  // ムスビは、フードをかぶっていない絵（ham001）。ナツメも、顔の見える絵（002）
  const image = shown === 0 ? `/assets/characters/${folder}/ham001.webp` : `/assets/characters/${folder}/${prefix}${shown === 1 ? '002' : '001'}.webp`;

  return (
    <div className="vn-scene home-scene" style={{ backgroundImage: `url(${profile?.background?.image ?? '/assets/room001.jpg'})` }}>
      <div className="home-top">
        <button type="button" className="home-stone-chip" onClick={() => setPanel('stone')} aria-label="ルーンストーンの管理画面を開く">
          <img src="/assets/stone.webp" alt="" />
          <span>{stoneBalance === null ? '—' : stoneBalance} 個</span>
        </button>
        <span className="home-email">
          {profile?.title && <b className="home-title">{profile.title.name}</b>}
          {email}
        </span>
      </div>

      {homeNotice && (
        <button type="button" className="home-notice" onClick={() => setPanel('inbox')}>
          <span>📢</span>
          <b>{homeNotice.title}</b>
        </button>
      )}

      {characterId !== null && (
        <div
          className="vn-character-bust-wrap"
          onClick={() => setLine((p) => pickHomeLine(characterId, p))}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          <CrossfadeImage src={image} alt={CHARACTER_MASTER_DATA[characterId].name} />
        </div>
      )}

      <div className="home-bottom">
        {line && characterId !== null && (
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
          <button type="button" className="home-btn" onClick={() => setPanel('zukan')}>
            📖 図鑑・実績
          </button>
          <button type="button" className="home-btn" onClick={() => setPanel('people')}>
            🧵 縁帳
          </button>
          <button type="button" className="home-btn" onClick={openLatestPanel}>
            📜 診断の記録
          </button>
          <button type="button" className="home-btn" onClick={() => window.dispatchEvent(new CustomEvent('open-minigame'))}>
            🎮 ミニゲーム<small>森ラン・どんぐりキャッチ</small>
          </button>
          <button type="button" className="home-btn" onClick={() => setPanel('inbox')}>
            📬 受信箱{inboxBadge > 0 && <i className="home-badge" aria-label="新しいお知らせ" />}
          </button>
          <button type="button" className="home-btn" onClick={() => setPanel('shop')}>
            🛍 交換所
          </button>
          <button type="button" className="home-btn" onClick={() => setPanel('gacha')}>
            🌲 森での出会い
          </button>
          <button type="button" className="home-btn home-btn-quiet" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </div>

      {panel === 'daily' && (
        <DailyPanel onClose={() => setPanel(null)} onBalance={(b) => onStoneBalance?.(b)} onSnapshot={updateBadge} />
      )}

      {panel === 'inbox' && (
        <InboxPanel
          onClose={() => {
            setPanel(null);
            refreshInbox();
          }}
          onBalance={(b) => onStoneBalance?.(b)}
          onChanged={(unread, claimable) => setInboxBadge(unread + claimable)}
        />
      )}

      {panel === 'shop' && <ShopPanel onClose={() => setPanel(null)} onBalance={(b) => onStoneBalance?.(b)} onChanged={refreshProfile} />}

      {panel === 'gacha' && <GachaPanel onClose={() => setPanel(null)} onBalance={(b) => onStoneBalance?.(b)} />}

      {panel === 'stone' && <StonePanel onClose={() => setPanel(null)} onBalance={(b) => onStoneBalance?.(b)} />}

      {panel === 'zukan' && <CollectionPanel onClose={() => setPanel(null)} />}


      {panel === 'people' && <PeoplePanel onClose={() => setPanel(null)} onBalance={(b) => onStoneBalance?.(b)} />}

      {panel === 'latest' && (
        <div className="home-panel-backdrop" onClick={() => setPanel(null)}>
          <div className="home-panel" onClick={(e) => e.stopPropagation()}>
            <h3>診断の記録（石は使いません）</h3>
            <p className="home-panel-lead">占いごとのいちばん新しい結果です。手相は写真つきで見返せます。</p>
            {latest.length === 0 ? (
              <p className="home-panel-empty">まだ保存された結果がありません。</p>
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
            <button type="button" className="home-panel-link" onClick={onHistory}>
              これまでの診断の文章をすべて見る →
            </button>
            <button type="button" className="home-panel-close" onClick={() => setPanel(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
