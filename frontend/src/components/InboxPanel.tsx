/**
 * 受信箱：ホームから開く。運営からのお知らせ・お詫びの石の配布など
 * 石つきのお知らせは「受け取る」をおすと、ルーンストーンがもらえる
 */

import { useCallback, useEffect, useState } from 'react';
import { claimAllInbox, claimInbox, getInbox, markInboxRead, type InboxMessage } from '../api/inbox';
import { StoneGift } from './StoneGift';
import { playSe } from '../sound';

const KIND_LABEL: Record<string, string> = {
  notice: 'お知らせ',
  maintenance: 'メンテナンス',
  update: 'アップデート',
  event: 'イベント',
  apology: 'お詫び',
  gift: 'プレゼント',
  welcome: 'ようこそ',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
}

export function InboxPanel({
  onClose,
  onBalance,
  onChanged,
}: {
  onClose: () => void;
  onBalance?: (balance: number) => void;
  /** 未読数・受け取れる数が変わったとき（ホームの赤い印を更新する） */
  onChanged?: (unread: number, claimable: number) => void;
}) {
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [gift, setGift] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getInbox()
      .then((r) => {
        setMessages(r.messages);
        onChanged?.(r.unread, r.claimable);
      })
      .catch(() => setError('読み込めませんでした'));
  }, [onChanged]);
  useEffect(() => load(), [load]);
  useEffect(() => playSe('mail_open'), []);

  const open = (m: InboxMessage) => {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.read) {
      markInboxRead(m.id).then(load);
      setMessages((prev) => prev && prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
    }
  };

  const claim = async (m: InboxMessage) => {
    setError('');
    try {
      const r = await claimInbox(m.id);
      if (r.granted > 0) {
        setGift(r.granted);
        if (typeof r.balance === 'number') onBalance?.(r.balance);
      } else if (r.reason === 'already') setError('もう受け取っています');
      load();
    } catch {
      setError('受け取れませんでした');
    }
  };

  const claimAll = async () => {
    setError('');
    try {
      const r = await claimAllInbox();
      if (r.granted > 0) {
        setGift(r.granted);
        if (typeof r.balance === 'number') onBalance?.(r.balance);
      }
      load();
    } catch {
      setError('受け取れませんでした');
    }
  };

  const claimable = (messages ?? []).filter((m) => m.stones > 0 && !m.claimed).length;

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel inbox-panel" onClick={(e) => e.stopPropagation()}>
        <h3>受信箱</h3>
        {claimable > 0 && (
          <button type="button" className="inbox-claim-all" onClick={claimAll}>
            受け取れる石をまとめて受け取る（{claimable}件）
          </button>
        )}
        {messages === null && !error && <p className="home-panel-empty">読み込んでいます</p>}
        {messages !== null && messages.length === 0 && <p className="home-panel-empty">お知らせはまだありません</p>}
        {messages !== null && messages.length > 0 && (
          <ul className="inbox-list">
            {messages.map((m) => (
              <li key={m.id} className={m.read ? 'is-read' : ''}>
                <button type="button" className="inbox-row" onClick={() => open(m)}>
                  {!m.read && <i className="inbox-dot" aria-label="未読" />}
                  <span className="inbox-kind">{KIND_LABEL[m.kind] ?? 'お知らせ'}</span>
                  <span className="inbox-title">{m.title}</span>
                  <small>{formatDate(m.createdAt)}</small>
                </button>
                {m.stones > 0 && (
                  <div className="inbox-reward">
                    <span>ルーンストーン +{m.stones}</span>
                    {m.claimed ? (
                      <b className="is-done">受け取りました</b>
                    ) : (
                      <button type="button" onClick={() => claim(m)}>
                        受け取る
                      </button>
                    )}
                  </div>
                )}
                {openId === m.id && <p className="inbox-body">{m.body}</p>}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="stone-manage-err">{error}</p>}
        <button type="button" className="home-panel-close" onClick={onClose}>
          閉じる
        </button>
      </div>

      {gift !== null && (
        <div className="stone-ad-overlay" onClick={(e) => { e.stopPropagation(); setGift(null); }}>
          <StoneGift amount={gift} />
        </div>
      )}
    </div>
  );
}
