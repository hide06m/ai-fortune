/**
 * ヘルプ・お問い合わせ・アカウントの削除：設定（⚙）から開く
 * ログインしていなくても、ヘルプ・お問い合わせ・規約は見られる。アカウントの削除は、ログイン中だけ
 */

import { useState } from 'react';
import { clearToken, isAuthenticated } from '../api';
import { deleteMyAccount } from '../api/account';
import { LEGAL } from '../pages/legalConfig';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'ルーンストーンとは？',
    a: '占いに使う石です。占う占い師によって、1回に使う数が変わります。残りの数と増減は、ホームの石の数をおすと見られます。',
  },
  {
    q: 'ルーンストーンを増やすには？',
    a: 'ログインボーナス（毎日）・連続ログインのごほうび・デイリーミッション・診断を待つ間のミニゲーム（1日1回）・広告を見る・運営からのプレゼント（受信箱）で増えます。毎日朝4時に切りかわります。',
  },
  {
    q: '占いの結果が出ません',
    a: '混み合っているときは、数十秒から数分かかることがあります。画面を閉じずにお待ちください。待つ間は、ミニゲームで遊べます。失敗したときは、石は戻ります。',
  },
  {
    q: '前の結果をもう一度見たい',
    a: 'ホームの「診断の記録」から、占いごとの最新の結果を、石を使わずに見返せます。',
  },
  {
    q: '手相の写真は保存されますか？',
    a: '診断のあいだだけ使い、データベースには保存しません。診断の文章を作るために、AIサービスへ送られます。くわしくはプライバシーポリシーをご覧ください。',
  },
  {
    q: 'ログインできません',
    a: 'ブラウザのポップアップを許可し、Googleアカウントを選びなおしてみてください。それでも入れないときは、お問い合わせください。',
  },
  {
    q: '縁帳の招待リンクはどうなりますか？',
    a: '招待リンクは、一度だけ使えて、期限があります。答えた方は、回答画面の手順で、自分の回答を消せます。',
  },
];

type Tab = 'help' | 'contact' | 'account';

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('help');
  const [openQ, setOpenQ] = useState<number | null>(0);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const authed = isAuthenticated();

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteMyAccount();
      clearToken();
      window.location.href = '/';
    } catch {
      setError('削除できませんでした。時間をおいてもう一度お試しください。');
      setBusy(false);
    }
  };

  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="help-tabs">
          <button type="button" className={tab === 'help' ? 'is-on' : ''} onClick={() => setTab('help')}>
            ヘルプ
          </button>
          <button type="button" className={tab === 'contact' ? 'is-on' : ''} onClick={() => setTab('contact')}>
            お問い合わせ
          </button>
          {authed && (
            <button type="button" className={tab === 'account' ? 'is-on' : ''} onClick={() => setTab('account')}>
              アカウント
            </button>
          )}
        </div>

        {tab === 'help' && (
          <ul className="help-faq">
            {FAQ.map((f, i) => (
              <li key={f.q}>
                <button type="button" onClick={() => setOpenQ(openQ === i ? null : i)}>
                  {f.q}
                </button>
                {openQ === i && <p>{f.a}</p>}
              </li>
            ))}
          </ul>
        )}

        {tab === 'contact' && (
          <div className="help-body">
            <p>不具合や、ご意見・ご要望は、メールでお送りください。</p>
            <p>
              <a href={`mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent('【占いの森】お問い合わせ')}`}>{LEGAL.contactEmail}</a>
            </p>
            <p className="help-note">お送りいただくときは、起きたことと、使っている端末（スマホかパソコンか）を書いてください。</p>
            <p>
              <a href="/terms" target="_blank" rel="noreferrer">
                利用規約
              </a>

              <a href="/privacy" target="_blank" rel="noreferrer">
                プライバシーポリシー
              </a>
            </p>
          </div>
        )}

        {tab === 'account' && authed && (
          <div className="help-body">
            <p>アカウントを削除すると、診断の記録・ルーンストーン・縁帳・図鑑など、すべてのデータが消え、元に戻せません。</p>
            <p className="help-note">確認のため、下の欄に「削除」と入力してください。</p>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="削除" aria-label="確認の入力" />
            <button type="button" className="help-danger" disabled={confirmText !== '削除' || busy} onClick={remove}>
              {busy ? '削除しています' : 'アカウントとデータを削除する'}
            </button>
            {error && <p className="help-error">{error}</p>}
          </div>
        )}

        <button type="button" className="help-close" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
