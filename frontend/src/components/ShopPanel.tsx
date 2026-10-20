/**
 * 交換所：ルーンストーンで、称号とホームの背景を手に入れる。手に入れたものは、身につけられる
 */

import { useEffect, useState } from 'react';
import { buyItem, equipItem, getShop, type ShopItem, type ShopSnapshot } from '../api/home';

type Tab = 'title' | 'background';

export function ShopPanel({ onClose, onBalance, onChanged }: { onClose: () => void; onBalance?: (balance: number) => void; onChanged?: () => void }) {
  const [snap, setSnap] = useState<ShopSnapshot | null>(null);
  const [tab, setTab] = useState<Tab>('title');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = (s: ShopSnapshot) => {
    if (!s.success) {
      setError(s.message || '読み込めませんでした');
      return;
    }
    setError('');
    setSnap(s);
    onBalance?.(s.balance);
  };
  useEffect(() => {
    getShop().then(apply).catch(() => setError('読み込めませんでした'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buy = async (it: ShopItem) => {
    setBusy(true);
    const s = await buyItem(it.id);
    apply(s);
    if (s.success) {
      // 買ったら、そのまま身につける
      apply(await equipItem(it.id));
      onChanged?.();
    }
    setBusy(false);
  };
  const equip = async (it: ShopItem) => {
    setBusy(true);
    apply(await equipItem(it.id));
    onChanged?.();
    setBusy(false);
  };

  const items = (snap?.items ?? []).filter((i) => i.kind === tab);

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel shop-panel" onClick={(e) => e.stopPropagation()}>
        <h3>🛍 交換所</h3>
        <p className="shop-balance">
          <img src="/assets/stone.webp" alt="" /> {snap ? snap.balance : '—'} 個
        </p>
        <div className="zukan-tabs">
          <button type="button" className={tab === 'title' ? 'is-on' : ''} onClick={() => setTab('title')}>
            称号
          </button>
          <button type="button" className={tab === 'background' ? 'is-on' : ''} onClick={() => setTab('background')}>
            ホームの背景
          </button>
        </div>
        {!snap && !error && <p className="home-panel-empty">読み込んでいます</p>}
        <ul className="shop-list">
          {items.map((it) => (
            <li key={it.id} className={it.equipped ? 'is-equipped' : ''}>
              {it.kind === 'background' && it.image && <img className="shop-thumb" src={it.image} alt="" />}
              <div className="shop-info">
                <b>{it.name}</b>
                <small>{it.desc}</small>
              </div>
              {it.equipped ? (
                <span className="shop-state">身につけ中</span>
              ) : it.owned ? (
                <button type="button" disabled={busy} onClick={() => equip(it)}>
                  身につける
                </button>
              ) : (
                <button type="button" className="shop-buy" disabled={busy || (snap ? snap.balance < it.price : true)} onClick={() => buy(it)}>
                  石 {it.price}
                </button>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="daily-error">{error}</p>}
        <button type="button" className="home-panel-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
