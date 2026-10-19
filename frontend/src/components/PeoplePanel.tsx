/**
 * 縁帳（周りの人の記録）：ホーム画面から開く。本人だけが見られる、私的な記録
 * 「縁むすび」方式：相手に招待リンク（URL・LINE・QRコード）を送り、相手本人が恋愛タイプに答えると、ここに登録される
 */

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  addPerson,
  deleteAllPeople,
  deletePerson,
  getLinks,
  getPerson,
  inviteUrl,
  listPeople,
  reissueInvite,
  type Comparison,
  type Links,
  type Person,
  type Relation,
} from '../api/people';

type View = 'list' | 'add' | 'share' | 'detail' | 'links';

const RELATION_LABEL: Record<Relation, string> = { family: '家族', friend: '友だち', lover: '恋人', work: '仕事', other: 'その他' };
const STATUS_LABEL = { pending: '招待中', answered: '回答済み', expired: '期限切れ' } as const;
const FROM_NAME_KEY = 'engi.fromName';

function loadFromName(): string {
  try {
    return localStorage.getItem(FROM_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function PeoplePanel({ onClose }: { onClose: () => void; onBalance?: (balance: number) => void }) {
  const [view, setView] = useState<View>('list');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [limit, setLimit] = useState(50);
  const [current, setCurrent] = useState<Person | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [links, setLinks] = useState<Links | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 追加フォーム
  const [name, setName] = useState('');
  const [fromName, setFromName] = useState(loadFromName);
  const [relation, setRelation] = useState<Relation>('friend');
  const [memo, setMemo] = useState('');

  // 共有（招待リンク）
  const [shareToken, setShareToken] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    const r = await listPeople();
    if (r.success) {
      setPeople(r.people);
      setLimit(r.limit);
    } else {
      setError(r.error ?? '読み込めませんでした');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    // 同じ招待を開き直したときも、QRを作り直す（view が変わるたびに実行する）
    if (!shareToken || view !== 'share') return;
    let cancelled = false;
    QRCode.toDataURL(inviteUrl(shareToken), { margin: 1, width: 360 }).then(
      (url) => !cancelled && setQr(url),
      () => !cancelled && setQr('')
    );
    return () => {
      cancelled = true;
    };
  }, [shareToken, view]);

  const openShare = (p: Person, token: string) => {
    setCurrent(p);
    setShareToken(token);
    setQr('');
    setCopied(false);
    setView('share');
  };

  const openPerson = async (id: string) => {
    setError('');
    const r = await getPerson(id);
    if (!r.success) {
      setError(r.error ?? '読み込めませんでした');
      return;
    }
    setCurrent(r.person);
    setComparison(r.comparison);
    if (r.person.status === 'pending' && r.person.inviteToken) openShare(r.person, r.person.inviteToken);
    else setView('detail');
  };

  const handleAdd = async () => {
    setError('');
    setBusy(true);
    const r = await addPerson({ name, relation, memo, fromName });
    setBusy(false);
    if (!r.success) {
      setError(r.error ?? '追加できませんでした');
      return;
    }
    try {
      localStorage.setItem(FROM_NAME_KEY, fromName);
    } catch {
      /* 保存できなくても、続けられる */
    }
    const person: Person = { id: r.id, name, relation, memo, createdAt: '', status: 'pending', inviteToken: r.inviteToken, result: null };
    setName('');
    setMemo('');
    await reload();
    openShare(person, r.inviteToken);
  };

  const handleReissue = async (p: Person) => {
    setError('');
    const r = await reissueInvite(p.id);
    if (!r.success) {
      setError(r.error ?? '再発行できませんでした');
      return;
    }
    await reload();
    openShare(p, r.inviteToken);
  };

  const handleDelete = async (p: Person) => {
    if (!window.confirm(`「${p.name}」さんの記録を削除します。元には戻せません。`)) return;
    await deletePerson(p.id);
    await reload();
    setView('list');
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('縁帳の記録をすべて削除します。元には戻せません。')) return;
    await deleteAllPeople();
    await reload();
  };

  const openLinks = async () => {
    setView('links');
    const r = await getLinks();
    if (r.success) setLinks(r);
  };

  const shareText = () => `恋愛タイプ診断（占いの森）に答えてもらえませんか？ 送信は任意であとから削除もできます。`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(shareToken));
      setCopied(true);
    } catch {
      setError('コピーできませんでした。URLを長押ししてコピーしてください。');
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: '占いの森：恋愛タイプ診断', text: shareText(), url: inviteUrl(shareToken) });
    } catch {
      /* 取りやめた場合は、何もしない */
    }
  };

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel people-panel" onClick={(e) => e.stopPropagation()}>
        {error && <p className="daily-error">{error}</p>}

        {view === 'list' && (
          <>
            <h3>🧵 縁帳</h3>
            <p className="home-panel-lead">
              周りの人に恋愛タイプ診断を送ります。相手が自分で答えるとその人のタイプがここに登録されます。あなた以外には見えません。
            </p>
            {people === null ? (
              <p className="home-panel-empty">読み込んでいます…</p>
            ) : people.length === 0 ? (
              <p className="home-panel-empty">まだだれも登録されていません。</p>
            ) : (
              <ul>
                {people.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => openPerson(p.id)}>
                      <span>
                        {p.result && <img className="people-thumb" src={`/assets/results/lovetype/${p.result.type1}.webp`} alt="" />}
                        {p.name}　<small>{RELATION_LABEL[p.relation]}</small>
                      </span>
                      {p.result ? <small>{p.result.characterName}</small> : <span className="people-status">{STATUS_LABEL[p.status]}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="daily-btn people-wide" onClick={() => { setError(''); setView('add'); }} disabled={(people?.length ?? 0) >= limit}>
              ＋ 人を招待する（{people?.length ?? 0} / {limit}）
            </button>
            {(people?.filter((p) => p.result).length ?? 0) >= 2 && (
              <button type="button" className="home-panel-link" onClick={openLinks}>
                つながりを見る →
              </button>
            )}
            {(people?.length ?? 0) > 0 && (
              <button type="button" className="people-danger" onClick={handleDeleteAll}>
                縁帳をすべて削除する
              </button>
            )}
            <button type="button" className="home-panel-close" onClick={onClose}>
              閉じる
            </button>
          </>
        )}

        {view === 'add' && (
          <>
            <h3>人を招待する</h3>
            <div className="people-notice">
              <b>書かないでください：</b>実名・電話番号・住所・勤務先・健康や性に関すること。ニックネームがおすすめです。
            </div>
            <label className="people-field">
              この人の呼び名（あなたの縁帳にだけ表示）
              <input type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="例：はなちゃん" />
            </label>
            <label className="people-field">
              あなたの呼び名（<b>相手に見えます</b>）
              <input type="text" value={fromName} maxLength={30} onChange={(e) => setFromName(e.target.value)} placeholder="例：ゆうき" />
            </label>
            <label className="people-field">
              関係（相手にも表示されます）
              <select value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
                {(Object.keys(RELATION_LABEL) as Relation[]).map((r) => (
                  <option key={r} value={r}>{RELATION_LABEL[r]}</option>
                ))}
              </select>
            </label>
            <label className="people-field">
              メモ（任意・100文字まで・あなたにだけ表示）
              <input type="text" value={memo} maxLength={100} onChange={(e) => setMemo(e.target.value)} />
            </label>
            <p className="daily-note">追加すると招待リンクができます。石は使いません。</p>
            <button type="button" className="daily-btn people-wide" onClick={handleAdd} disabled={busy || !name.trim() || !fromName.trim()}>
              {busy ? '作っています…' : '招待リンクを作る'}
            </button>
            <button type="button" className="home-panel-close" onClick={() => setView('list')}>戻る</button>
          </>
        )}

        {view === 'share' && current && (
          <>
            <h3>{current.name}さんへの招待リンク</h3>
            <p className="home-panel-lead">このリンクを{current.name}さんに送ってください（LINE・メッセージ・QRコード）。相手が答えると縁帳に登録されます。リンクは14日間・1回だけ使えます。</p>
            <div className="people-share">
              {qr && <img src={qr} alt="招待のQRコード" />}
              <input className="people-share-url" readOnly value={inviteUrl(shareToken)} onFocus={(e) => e.target.select()} />
            </div>
            {typeof navigator.share === 'function' && (
              <button type="button" className="daily-btn people-wide" onClick={nativeShare}>LINEなどで送る</button>
            )}
            <button type="button" className="daily-btn people-wide" onClick={copy}>{copied ? 'コピーしました' : 'リンクをコピー'}</button>
            <p className="daily-note">相手が断っても通知は来ません。返事を急かさないでください。</p>
            <button type="button" className="home-panel-close" onClick={() => { reload(); setView('list'); }}>戻る</button>
          </>
        )}

        {view === 'detail' && current && (
          <>
            <h3>{current.name}　<small>{RELATION_LABEL[current.relation]}</small></h3>
            {current.result ? (
              <div className="people-result">
                <img src={`/assets/results/lovetype/${current.result.type1}.webp`} alt={current.result.characterName} />
                <p className="people-result-label">{current.name}さん本人の回答</p>
                <p className="people-result-type">{current.result.characterName}　<small>{current.result.subTypeName}</small></p>
                <p className="daily-note">{current.result.confidence === 'quiz' ? '18問に答えた結果です。' : 'ご本人がタイプを選んで送ってくれました（本人の申告）。'}</p>
              </div>
            ) : (
              <>
                <p className="home-panel-empty">まだ回答がありません（{STATUS_LABEL[current.status]}）。</p>
                <button type="button" className="daily-btn people-wide" onClick={() => handleReissue(current)}>招待リンクを作り直す</button>
              </>
            )}

            {comparison && comparison.total > 0 && (
              <div className="people-compare">
                <h4>あなたとの共通点・違い（{comparison.sameCount} / {comparison.total} が同じ向き）</h4>
                <p className="daily-note">{comparison.summary}</p>
                <ul>
                  {comparison.axes.map((a) => (
                    <li key={a.axis} className={a.same ? 'is-same' : ''}>
                      <b>{a.name}</b>
                      <span>あなた：{a.mine}</span>
                      <span>{current.name}さん：{a.theirs}</span>
                      <i>{a.same ? '同じ' : 'ちがう'}</i>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {current.result && !comparison && (
              <p className="daily-note">あなた自身の恋愛タイプ診断をすると共通点・違いが見られます。</p>
            )}

            {current.memo && <p className="people-memo">メモ：{current.memo}</p>}

            <button type="button" className="people-danger" onClick={() => handleDelete(current)}>この人の記録を削除</button>
            <button type="button" className="home-panel-close" onClick={() => { reload(); setView('list'); }}>戻る</button>
          </>
        )}

        {view === 'links' && (
          <>
            <h3>つながり</h3>
            {!links ? (
              <p className="home-panel-empty">読み込んでいます…</p>
            ) : (
              <>
                <h4>あなたと同じタイプの人</h4>
                {links.sameAsMe.length ? <p>{links.sameAsMe.join('')}</p> : <p className="home-panel-empty">{links.myType1 ? 'まだいません。' : 'あなた自身の恋愛タイプ診断をすると見られます。'}</p>}
                <h4>同じタイプどうし</h4>
                {links.sameType.length ? (
                  <ul className="people-links">
                    {links.sameType.map((g) => (
                      <li key={g.type1}>
                        <img src={`/assets/results/lovetype/${g.type1}.webp`} alt="" />
                        <span>{g.names.join('')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="home-panel-empty">まだ同じタイプの人はいません。</p>
                )}
              </>
            )}
            <button type="button" className="home-panel-close" onClick={() => setView('list')}>戻る</button>
          </>
        )}
      </div>
    </div>
  );
}
