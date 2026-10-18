/**
 * 縁むすびの招待ページ：招待された本人が、ログインなしで、恋愛タイプに答える
 * （18問に答える、または、すでに知っているタイプを選ぶ）。送信すると、招待した人の縁帳にだけ、登録される
 */

import { useEffect, useState } from 'react';
import '../styles/home.css';
import { LOVE_TYPE64_QUESTIONS, LOVE_TYPE64_QUESTIONS_PER_PAGE, LOVE_SCALE_VALUES } from '../data/loveType64Questions';
import { answerInvite, getInvite, revokeAnswer, type InviteInfo, type InviteResult, type Relation } from '../api/people';

const RELATION_LABEL: Record<Relation, string> = { family: '家族', friend: '友だち', lover: '恋人', work: '仕事', other: 'その他' };
const PAGES = Math.ceil(LOVE_TYPE64_QUESTIONS.length / LOVE_TYPE64_QUESTIONS_PER_PAGE);

const AXES: { key: string; pair: [string, string]; hint: [string, string] }[] = [
  { key: 'LF', pair: ['L', 'F'], hint: ['リードする', '合わせる'] },
  { key: 'CA', pair: ['C', 'A'], hint: ['甘えたい', '甘えられたい'] },
  { key: 'PR', pair: ['P', 'R'], hint: ['気持ちで動く', '理想で選ぶ'] },
  { key: 'OE', pair: ['O', 'E'], hint: ['自由・開放的', '一途・真剣'] },
  { key: 'VN', pair: ['V', 'N'], hint: ['未来を重んじる', '今を重んじる'] },
  { key: 'DI', pair: ['D', 'I'], hint: ['寄り添う', '自立・適度な距離'] },
];

const REVOKE_KEY = (token: string) => `invite.revoke.${token}`;

function savedRevokeToken(token: string): string {
  try {
    return localStorage.getItem(REVOKE_KEY(token)) ?? '';
  } catch {
    return '';
  }
}

type Step = 'loading' | 'invalid' | 'intro' | 'choose' | 'quiz' | 'pick' | 'done' | 'revoked';

export function InvitePage({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [consent, setConsent] = useState(false);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [picked, setPicked] = useState<string[]>(AXES.map((a) => a.pair[0]));
  const [result, setResult] = useState<InviteResult | null>(null);
  const [revokeToken, setRevokeToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getInvite(token).then((r) => {
      if (r.success) {
        setInfo({ fromName: r.fromName, relation: r.relation });
        setStep('intro');
      } else {
        // 送信したあとに、同じ端末でリンクを開き直した場合は、取り消せるようにする
        const saved = savedRevokeToken(token);
        if (saved) setRevokeToken(saved);
        setStep('invalid');
      }
    });
  }, [token]);

  // ページ（質問の次の6問・画面の切り替え）が変わったら、上に戻す
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      document.querySelector('.invite-page')?.scrollIntoView({ block: 'start' });
      window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(id);
  }, [page, step]);

  const submit = async (body: { answers?: { id: number; val: number }[]; pickedType?: string }) => {
    setError('');
    setBusy(true);
    const r = await answerInvite(token, { consent: true, ...body });
    setBusy(false);
    if (!r.success) {
      setError(r.error ?? '送信できませんでした');
      return;
    }
    setResult(r.result);
    setRevokeToken(r.revokeToken);
    try {
      localStorage.setItem(REVOKE_KEY(token), r.revokeToken);
    } catch {
      /* 保存できなくても、この画面では取り消せる */
    }
    setStep('done');
  };

  const submitQuiz = () => submit({ answers: LOVE_TYPE64_QUESTIONS.map((q) => ({ id: q.id, val: answers.get(q.id)! })) });
  const submitPicked = () => submit({ pickedType: `${picked.slice(0, 4).join('')}-${picked.slice(4).join('')}` });

  const doRevoke = async () => {
    if (!window.confirm('あなたの回答を、相手の縁帳から、削除します。よろしいですか？')) return;
    const r = await revokeAnswer(revokeToken);
    if (r.success) {
      try {
        localStorage.removeItem(REVOKE_KEY(token));
      } catch {
        /* 何もしない */
      }
      setStep('revoked');
    }
    else setError(r.error ?? '取り消せませんでした');
  };

  const pageQuestions = LOVE_TYPE64_QUESTIONS.slice(page * LOVE_TYPE64_QUESTIONS_PER_PAGE, (page + 1) * LOVE_TYPE64_QUESTIONS_PER_PAGE);
  const pageDone = pageQuestions.every((q) => answers.has(q.id));
  const isLastPage = page === PAGES - 1;
  const from = info?.fromName ?? '';

  return (
    <div className="invite-page">
      <div className="home-panel people-panel invite-card">
        {error && <p className="daily-error">{error}</p>}

        {step === 'loading' && <p className="home-panel-empty">読み込んでいます…</p>}

        {step === 'invalid' && (
          <>
            <h3>この招待は、使えません</h3>
            <p className="home-panel-lead">期限切れ・回答済み、または、取り消された招待です。気になる場合は、招待してくれた人に、聞いてみてください。</p>
            {revokeToken && (
              <>
                <p className="daily-note">この端末から、以前に送信した回答が、残っています。取り消す場合は、下のボタンを押してください。</p>
                <button type="button" className="people-danger" onClick={doRevoke}>送った回答を取り消して、削除する</button>
              </>
            )}
          </>
        )}

        {step === 'intro' && info && (
          <>
            <h3>🧵 {from}さんからの、おたより</h3>
            <p className="invite-lead">
              {from}さん（{RELATION_LABEL[info.relation]}）が、あなたの「恋愛タイプ」を、知りたいそうです。
              <br />
              答えると、あなたのタイプだけが、{from}さんに届きます。
            </p>
            <p className="invite-soft">答えるかどうかは、自由です。あとから、いつでも取り消せます。</p>
            <details className="invite-details">
              <summary>くわしい説明</summary>
              <ul>
                <li>届くのは、恋愛タイプの結果だけです（名前・連絡先・住所は、入力しません）。</li>
                <li>{from}さんだけが見られます。公開や、ランキングは、ありません。</li>
                <li>答えなくても、{from}さんには、伝わりません。</li>
                <li>「{from}」は、送り主が自分でつけた名前です。心当たりがなければ、閉じてください。</li>
                <li>この診断は、遊びのための占いです（検査ではありません）。</li>
              </ul>
            </details>
            <label className="invite-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{from}さんに、結果を届けて、いいです。</span>
            </label>
            <button type="button" className="daily-btn people-wide" disabled={!consent} onClick={() => setStep('choose')}>
              すすむ
            </button>
          </>
        )}

        {step === 'choose' && (
          <>
            <h3>どちらで答えますか？</h3>
            <button type="button" className="daily-btn people-wide" onClick={() => { setPage(0); setStep('quiz'); }}>
              18問に答えて、診断する
            </button>
            <button type="button" className="home-panel-link" onClick={() => setStep('pick')}>
              自分のタイプを、すでに知っている → 選ぶだけ
            </button>
          </>
        )}

        {step === 'quiz' && (
          <>
            <h3>恋愛タイプ診断　<small>{page + 1} / {PAGES}</small></h3>
            <div className="people-questions">
              {pageQuestions.map((q) => (
                <div key={q.id} className="people-question">
                  <p>{q.text}</p>
                  <div className="people-scale">
                    {LOVE_SCALE_VALUES.map((val) => (
                      <button key={val} type="button" className={answers.get(q.id) === val ? 'is-on' : ''} onClick={() => setAnswers((m) => new Map(m).set(q.id, val))} aria-label={val <= 1 ? q.left : q.right}>
                        ♥
                      </button>
                    ))}
                  </div>
                  <div className="people-scale-labels">
                    <span>{q.left}</span>
                    <span>{q.right}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="people-nav">
              <button type="button" className="home-panel-close" disabled={busy} onClick={() => (page === 0 ? setStep('choose') : setPage(page - 1))}>戻る</button>
              <button type="button" className="daily-btn" disabled={!pageDone || busy} onClick={() => (isLastPage ? submitQuiz() : setPage(page + 1))}>
                {busy ? '送信中…' : isLastPage ? `${from}さんに送る` : '次へ'}
              </button>
            </div>
          </>
        )}

        {step === 'pick' && (
          <>
            <h3>自分のタイプを選ぶ</h3>
            <p className="home-panel-lead">診断結果のタイプ（例：LCPO-VI）を、選んでください。</p>
            <div className="invite-pick">
              {AXES.map((a, i) => (
                <div key={a.key} className="invite-pick-row">
                  {a.pair.map((letter, j) => (
                    <button key={letter} type="button" className={picked[i] === letter ? 'is-on' : ''} onClick={() => setPicked((p) => p.map((v, k) => (k === i ? letter : v)))}>
                      <b>{letter}</b>
                      <small>{a.hint[j]}</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <p className="invite-code">{picked.slice(0, 4).join('')}-{picked.slice(4).join('')}</p>
            <div className="people-nav">
              <button type="button" className="home-panel-close" disabled={busy} onClick={() => setStep('choose')}>戻る</button>
              <button type="button" className="daily-btn" disabled={busy} onClick={submitPicked}>
                {busy ? '送信中…' : `${from}さんに送る`}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <>
            <h3>送りました</h3>
            <div className="people-result">
              <img src={`/assets/results/lovetype/${result.type1}.webp`} alt={result.characterName} />
              <p className="people-result-type">{result.characterName}　<small>{result.subTypeName}</small></p>
              <p className="home-panel-lead">{result.characterDesc}</p>
            </div>
            <p className="daily-note">{from}さんの縁帳に、あなたの結果が、登録されました。間違えた場合や、やめたい場合は、下のボタンで、取り消せます。</p>
            <button type="button" className="people-danger" onClick={doRevoke}>回答を取り消して、削除する</button>
          </>
        )}

        {step === 'revoked' && (
          <>
            <h3>削除しました</h3>
            <p className="home-panel-lead">あなたの回答を、相手の縁帳から、削除しました。このページは、閉じて大丈夫です。</p>
          </>
        )}
      </div>
    </div>
  );
}
