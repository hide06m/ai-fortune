/**
 * 今日の運勢と、デイリーミッション（ホーム画面から開く）
 */

import { useEffect, useState } from 'react';
import { BirthDateSelects } from './CounselingScene';
import { claimMission, getDaily, markFortuneViewed, saveBirthDate, type DailySnapshot } from '../api/daily';
import { claimLongMission, claimWeekly, getLongMissions, getWeekly, type LongSnapshot, type WeeklySnapshot } from '../api/home';

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

interface DailyPanelProps {
  onClose: () => void;
  /** 石の数が変わったとき（報酬の受け取り） */
  onBalance: (balance: number) => void;
  /** 状況が変わったとき（ホームの赤い印の更新） */
  onSnapshot: (s: DailySnapshot) => void;
}

export function DailyPanel({ onClose, onBalance, onSnapshot }: DailyPanelProps) {
  const [snap, setSnap] = useState<DailySnapshot | null>(null);
  const [birth, setBirth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [weekly, setWeekly] = useState<WeeklySnapshot | null>(null);
  const [long, setLong] = useState<LongSnapshot | null>(null);
  const [tab, setTab] = useState<'today' | 'week' | 'long'>('today');

  const apply = (s: DailySnapshot) => {
    if (!s.success) {
      setError(s.message || '読み込めませんでした。時間をおいてもう一度お試しください。');
      return;
    }
    setError('');
    setSnap(s);
    onBalance(s.balance);
    onSnapshot(s);
  };

  useEffect(() => {
    (async () => {
      const s = await getDaily();
      apply(s);
      // 運勢を表示できたら、「見た」ことを記録する（ミッションの達成）
      if (s.success && s.fortune && !s.missions.find((m) => m.id === 'fortune')?.done) apply(await markFortuneViewed());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveBirth = async () => {
    if (!birth) return;
    setBusy(true);
    const s = await saveBirthDate(birth);
    apply(s);
    if (s.success && s.fortune) apply(await markFortuneViewed());
    setBusy(false);
  };

  const claim = async (id: string) => {
    setBusy(true);
    apply(await claimMission(id));
    setBusy(false);
  };

  useEffect(() => {
    getWeekly()
      .then((w) => w.success && setWeekly(w))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    getLongMissions()
      .then((l) => l.success && setLong(l))
      .catch(() => undefined);
  }, []);
  const claimLong = async (id: string) => {
    setBusy(true);
    const l = await claimLongMission(id);
    if (l.success) {
      setLong(l);
      onBalance(l.balance);
    }
    setBusy(false);
  };
  const claimWeeklyMission = async (id: string) => {
    setBusy(true);
    const w = await claimWeekly(id);
    if (w.success) {
      setWeekly(w);
      onBalance(w.balance);
    }
    setBusy(false);
  };

  const f = snap?.fortune ?? null;

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel daily-panel" onClick={(e) => e.stopPropagation()}>
        <div className="zukan-tabs">
          <button type="button" className={tab === 'today' ? 'is-on' : ''} onClick={() => setTab('today')}>
            今日
          </button>
          <button type="button" className={tab === 'week' ? 'is-on' : ''} onClick={() => setTab('week')}>
            今週
          </button>
          <button type="button" className={tab === 'long' ? 'is-on' : ''} onClick={() => setTab('long')}>
            ずっと
          </button>
        </div>
        {tab === 'today' && <h3>🌟 今日の運勢</h3>}
        {tab === 'today' && !snap && !error && <p className="home-panel-empty">読み込んでいます…</p>}
        {error && <p className="daily-error">{error}</p>}

        {tab === 'today' && snap && !f && (
          <div className="daily-birth">
            <p>今日の運勢を見るには生年月日を教えてください（この端末だけでなくアカウントに保存されます）。</p>
            <BirthDateSelects value={birth} onChange={setBirth} />
            <button type="button" className="daily-btn" disabled={!birth || busy} onClick={saveBirth}>
              この生年月日で今日の運勢を見る
            </button>
          </div>
        )}

        {tab === 'today' && f && (
          <div className="daily-fortune">
            <div className="daily-fortune-head">
              <span className="daily-fortune-day">{f.day}</span>
              <span className="daily-fortune-title">{f.title}</span>
            </div>
            <p className="daily-fortune-msg">{f.message}</p>
            <ul className="daily-stars">
              <li><span>総合</span><b>{stars(f.stars.total)}</b></li>
              <li><span>恋愛</span><b>{stars(f.stars.love)}</b></li>
              <li><span>仕事</span><b>{stars(f.stars.work)}</b></li>
              <li><span>金運</span><b>{stars(f.stars.money)}</b></li>
            </ul>
            <div className="daily-lucky">
              <span className="daily-chip" style={{ background: f.luckyColor.hex }} />
              ラッキーカラー：{f.luckyColor.name}　／　ラッキーナンバー：{f.luckyNumber}
            </div>
            <p className="daily-advice">💡 {f.advice}</p>
          </div>
        )}

        {tab === 'today' && snap && (
          <>
            <h3 className="daily-missions-title">📋 今日のミッション</h3>
            <ul className="daily-missions">
              {snap.missions.map((m) => (
                <li key={m.id} className={m.claimed ? 'is-claimed' : m.done ? 'is-done' : ''}>
                  <div>
                    <b>{m.title}</b>
                    <small>{m.desc}</small>
                  </div>
                  {m.claimed ? (
                    <span className="daily-got">受け取り済み</span>
                  ) : m.done ? (
                    <button type="button" className="daily-btn" disabled={busy} onClick={() => claim(m.id)}>
                      石 <span className="stone-plus">＋{m.reward}</span>
                    </button>
                  ) : (
                    <span className="daily-todo">石 <span className="stone-plus">＋{m.reward}</span></span>
                  )}
                </li>
              ))}
              <li className={snap.allBonus.claimed ? 'is-claimed' : snap.allBonus.ready ? 'is-done' : ''}>
                <div>
                  <b>ぜんぶ達成ボーナス</b>
                  <small>3つのミッションをすべて受け取ると</small>
                </div>
                {snap.allBonus.claimed ? (
                  <span className="daily-got">受け取り済み</span>
                ) : snap.allBonus.ready ? (
                  <button type="button" className="daily-btn" disabled={busy} onClick={() => claim('all')}>
                    石 <span className="stone-plus">＋{snap.allBonus.reward}</span>
                  </button>
                ) : (
                  <span className="daily-todo">石 <span className="stone-plus">＋{snap.allBonus.reward}</span></span>
                )}
              </li>
            </ul>
            <p className="daily-note">ミッションは毎日朝4時にリセットされます。</p>
          </>
        )}

        {tab === 'long' && long && (
          <>
            <h3 className="daily-missions-title">🌲 ずっとミッション</h3>
            <p className="daily-note">かけら：{long.shards} 個（これからのお楽しみに使います）</p>
            <ul className="daily-missions">
              {long.missions.map((m) => (
                <li key={m.id} className={m.claimed ? 'is-claimed' : m.done ? 'is-done' : ''}>
                  <div>
                    <b>{m.title}</b>
                    <small>
                      {m.desc}（{m.progress} / {m.target}）
                    </small>
                  </div>
                  {m.claimed ? (
                    <span className="daily-got">受け取り済み</span>
                  ) : m.done ? (
                    <button type="button" className="daily-btn" disabled={busy} onClick={() => claimLong(m.id)}>
                      石 <span className="stone-plus">＋{m.reward.stones}</span>
                      {m.reward.shards ? `・かけら +${m.reward.shards}` : ''}
                    </button>
                  ) : (
                    <span className="daily-todo">
                      石 <span className="stone-plus">＋{m.reward.stones}</span>
                      {m.reward.shards ? `・かけら +${m.reward.shards}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="daily-note">一度だけ受け取れます。称号は、図鑑の「実績」を達成すると、手に入ります。</p>
          </>
        )}

        {tab === 'week' && weekly && (
          <>
            <h3 className="daily-missions-title">🗓 今週のミッション</h3>
            <ul className="daily-missions">
              {weekly.missions.map((m) => (
                <li key={m.id} className={m.claimed ? 'is-claimed' : m.done ? 'is-done' : ''}>
                  <div>
                    <b>{m.title}</b>
                    <small>
                      {m.desc}（{m.progress} / {m.target}）
                    </small>
                  </div>
                  {m.claimed ? (
                    <span className="daily-got">受け取り済み</span>
                  ) : m.done ? (
                    <button type="button" className="daily-btn" disabled={busy} onClick={() => claimWeeklyMission(m.id)}>
                      石 <span className="stone-plus">＋{m.reward}</span>
                    </button>
                  ) : (
                    <span className="daily-todo">石 <span className="stone-plus">＋{m.reward}</span></span>
                  )}
                </li>
              ))}
            </ul>
            <p className="daily-note">毎週月曜の朝4時にリセットされます。</p>
          </>
        )}

        <button type="button" className="home-panel-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
