/**
 * ルーンストーンの管理画面：ホームの石の数をおすと開く。
 * 残高・今日の受け取り状況（ログインボーナス・広告・ミニゲーム）・最近の増減・広告を見て石をもらう
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLoginCalendar, getStoneSummary, watchAdForStone, type LoginCalendar, type StoneSummary } from '../api/stones';
import { showRewardedAd } from '../ads/rewardedAd';

const REASON_LABEL: Record<string, string> = {
  login_bonus: 'ログインボーナス',
  signup_bonus: '新規登録ボーナス',
  ad_watch: '広告を見た',
  diagnosis: '診断',
  diagnosis_refund: '診断の返却',
  character_gift: 'ちょっとした挨拶',
  mission_reward: 'ミッション報酬',
  minigame_reward: 'ミニゲーム報酬',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ログインカレンダー：今月の、ログインした日に印。連続日数と、つぎのごほうび */
function LoginCalendarView() {
  const [cal, setCal] = useState<LoginCalendar | null>(null);
  useEffect(() => {
    getLoginCalendar()
      .then(setCal)
      .catch(() => undefined);
  }, []);
  if (!cal) return null;
  const [y, m] = cal.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const last = new Date(y, m, 0).getDate();
  const done = new Set(cal.days.map((d) => Number(d.slice(8, 10))));
  const todayNum = cal.today.slice(0, 7) === cal.month ? Number(cal.today.slice(8, 10)) : -1;
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  return (
    <div className="login-cal">
      <h4>
        ログインカレンダー　{y}年{m}月
      </h4>
      <div className="login-cal-grid">
        {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
          <span key={w} className="login-cal-week">
            {w}
          </span>
        ))}
        {cells.map((d, i) => (
          <span key={i} className={`login-cal-day${d && done.has(d) ? ' is-done' : ''}${d === todayNum ? ' is-today' : ''}`}>
            {d ?? ''}
          </span>
        ))}
      </div>
      <p className="login-cal-streak">
        連続ログイン <b>{cal.streak}</b> 日
        {cal.nextMilestone && (
          <small>
            　あと{cal.nextMilestone.day - cal.streak}日で ルーンストーン+{cal.nextMilestone.stones}
          </small>
        )}
      </p>
      <p className="login-cal-ms">
        {cal.milestones.map((x) => (
          <span key={x.day} className={cal.streak >= x.day ? 'is-reached' : ''}>
            {x.day}日 +{x.stones}
          </span>
        ))}
      </p>
    </div>
  );
}

export function StonePanel({ onClose, onBalance }: { onClose: () => void; onBalance?: (balance: number) => void }) {
  const [summary, setSummary] = useState<StoneSummary | null>(null);
  const [error, setError] = useState('');
  const [adSeconds, setAdSeconds] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    getStoneSummary()
      .then((s) => {
        setSummary(s);
        onBalance?.(s.balance);
      })
      .catch(() => setError('読み込めませんでした'));
  }, [onBalance]);
  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const watchAd = async () => {
    setError('');
    setMessage('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const done = await showRewardedAd((p) => setAdSeconds(p.secondsLeft), ctrl.signal);
    setAdSeconds(null);
    if (!done) return;
    try {
      const r = await watchAdForStone();
      if (r.granted) setMessage('ルーンストーンを1個もらいました');
      else setError('今日の広告はもう見られません');
      load();
    } catch {
      setError('受け取れませんでした');
    }
  };

  const adLeft = summary?.adRemaining ?? 0;

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel stone-manage" onClick={(e) => e.stopPropagation()}>
        <h3>ルーンストーン</h3>
        <div className="stone-manage-balance">
          <img src="/assets/stone.webp" alt="" />
          <strong>{summary ? summary.balance : '—'}</strong>
          <span>個</span>
        </div>

        {summary && (
          <>
            <ul className="stone-manage-list">
              <li>
                <span>ログインボーナス</span>
                <b className={summary.loginBonusClaimed ? 'is-done' : ''}>{summary.loginBonusClaimed ? '今日はもらいました' : 'まだです'}</b>
              </li>
              <li>
                <span>ミニゲーム</span>
                <b className={summary.minigameStonesToday > 0 ? 'is-done' : ''}>
                  {summary.minigameStonesToday > 0 ? `今日は${summary.minigameStonesToday}個もらいました` : '診断を待つ間に遊べます'}
                </b>
              </li>
              <li>
                <span>広告</span>
                <b>{summary.adTestMode ? 'テスト中（何回でも）' : `あと${adLeft}回／${summary.adLimit}回`}</b>
              </li>
            </ul>

            <button type="button" className="stone-manage-ad" disabled={adLeft <= 0 || adSeconds !== null} onClick={watchAd}>
              {adLeft <= 0 ? '今日の広告は終わりました' : '広告を見てルーンストーン+1'}
            </button>
            <p className="stone-manage-note">毎日朝4時に更新されます</p>

            <LoginCalendarView />

            <h4>最近の増減</h4>
            {summary.history.length === 0 ? (
              <p className="home-panel-empty">まだありません</p>
            ) : (
              <ul className="stone-manage-history">
                {summary.history.map((h, i) => (
                  <li key={i}>
                    <small>{formatTime(h.createdAt)}</small>
                    <span>{REASON_LABEL[h.reason] ?? h.reason}</span>
                    <b className={h.amount > 0 ? 'is-plus' : 'is-minus'}>{h.amount > 0 ? `+${h.amount}` : h.amount}</b>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {message && <p className="stone-manage-msg">{message}</p>}
        {error && <p className="stone-manage-err">{error}</p>}

        <button type="button" className="home-panel-close" onClick={onClose}>
          閉じる
        </button>
      </div>

      {adSeconds !== null && (
        <div className="stone-ad-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="stone-ad-box">
            <p className="stone-ad-title">広告（仮の表示）</p>
            <p className="stone-ad-count">{adSeconds}</p>
            <p className="stone-ad-note">本物の広告はこれからつなぎます</p>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
              }}
            >
              やめる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
