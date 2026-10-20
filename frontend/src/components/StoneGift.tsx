/**
 * ルーンストーンを、もらったときの表示（ムスビのログインボーナスと、森ランの報酬で、同じ見た目にする）
 * 石の絵に、蔦と葉の枠（frame_leaf）を付けて、「ルーンストーン +N」と出す
 */

import { useEffect } from 'react';
import { playSe } from '../sound';

export function StoneGift({ amount, className = '' }: { amount: number; className?: string }) {
  useEffect(() => {
    playSe('stone_get');
  }, []);
  return (
    <div className={`stone-gift ${className}`}>
      <img src="/assets/stone.webp" alt="" draggable={false} />
      <span className="stone-gift-label">ルーンストーン +{amount}</span>
    </div>
  );
}
