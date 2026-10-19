/**
 * 「待たずに…」を選んだ診断ができたときの、お知らせ（画面の下に出る。ブラウザの通知も、許可されていれば出す）
 */

import { useEffect, useState } from 'react';
import { subscribeFinished, type JobFinished } from '../api/asyncJob';

export function JobToast({ onView }: { onView: (kind: string) => void }) {
  const [items, setItems] = useState<Array<JobFinished & { key: number }>>([]);

  useEffect(() => {
    let n = 0;
    return subscribeFinished((f) => {
      setItems((cur) => [...cur, { ...f, key: ++n }]);
      try {
        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification('占いの森', {
            body: f.ok ? `${f.job.label}の結果が出ました` : `${f.job.label}はうまくいきませんでした`,
          });
        }
      } catch {
        /* 通知が使えない環境では、画面内のお知らせだけになる */
      }
    });
  }, []);

  if (items.length === 0) return null;
  const close = (key: number) => setItems((cur) => cur.filter((i) => i.key !== key));

  return (
    <div className="job-toast-stack" role="status">
      {items.map((i) => (
        <div key={i.key} className={`job-toast${i.ok ? '' : ' is-error'}`}>
          <div className="job-toast-text">
            {i.ok ? `✨ ${i.job.label}の結果が出ました` : `${i.job.label}はうまくいきませんでした。${i.message || '時間をおいてもう一度お試しください。'}`}
          </div>
          <div className="job-toast-actions">
            {i.ok && i.job.kind !== 'compat' && (
              <button type="button" onClick={() => { onView(i.job.kind); close(i.key); }}>
                結果を見る
              </button>
            )}
            <button type="button" className="is-quiet" onClick={() => close(i.key)}>
              閉じる
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
