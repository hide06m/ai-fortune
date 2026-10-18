/**
 * 縁帳（周りの人の記録）：ホーム画面から開く。本人だけが見られる、私的な記録
 * 恋愛タイプの代理診断（「あなたから見た〇〇さん（仮説）」）と、自分との共通点・違い、同じタイプの人どうし
 */

import { useCallback, useEffect, useState } from 'react';
import { LOVE_TYPE64_QUESTIONS, LOVE_TYPE64_QUESTIONS_PER_PAGE, LOVE_SCALE_VALUES } from '../data/loveType64Questions';
import {
  addPerson,
  deleteAllPeople,
  deletePerson,
  diagnosePerson,
  getLinks,
  getPerson,
  listPeople,
  type Comparison,
  type Confidence,
  type Links,
  type Person,
  type Relation,
} from '../api/people';

type View = 'list' | 'add' | 'detail' | 'quiz' | 'links';

const RELATION_LABEL: Record<Relation, string> = { family: '家族', friend: '友だち', lover: '恋人', work: '仕事', other: 'その他' };
const CONFIDENCE_LABEL: Record<Confidence, string> = { high: 'よく分かる', partial: '一部のみ', low: 'あまり分からない' };
const PAGES = Math.ceil(LOVE_TYPE64_QUESTIONS.length / LOVE_TYPE64_QUESTIONS_PER_PAGE);

interface PeoplePanelProps {
  onClose: () => void;
  onBalance?: (balance: number) => void;
}

export function PeoplePanel({ onClose, onBalance }: PeoplePanelProps) {
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
  const [relation, setRelation] = useState<Relation>('friend');
  const [memo, setMemo] = useState('');

  // 代理診断
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<Map<number, number | null>>(new Map());
  const [confidence, setConfidence] = useState<Confidence>('partial');

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

  const openPerson = async (id: string) => {
    setError('');
    const r = await getPerson(id);
    if (!r.success) {
      setError(r.error ?? '読み込めませんでした');
      return;
    }
    setCurrent(r.person);
    setComparison(r.comparison);
    setView('detail');
  };

  const handleAdd = async () => {
    setError('');
    setBusy(true);
    const r = await addPerson({ name, relation, memo });
    setBusy(false);
    if (!r.success) {
      setError(r.error ?? '追加できませんでした');
      return;
    }
    setName('');
    setMemo('');
    await reload();
    startQuiz(r.id, name);
  };

  const startQuiz = (id: string, personName?: string) => {
    setCurrent((prev) => ({ ...(prev ?? { id, name: personName ?? '', relation: 'other', memo: '', createdAt: '', result: null }), id, name: personName ?? prev?.name ?? '' }));
    setAnswers(new Map());
    setPage(0);
    setConfidence('partial');
    setError('');
    setView('quiz');
  };

  const handleDelete = async (p: Person) => {
    if (!window.confirm(`「${p.name}」さんの記録を、削除します。元には戻せません。`)) return;
    await deletePerson(p.id);
    await reload();
    setView('list');
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('縁帳の記録を、すべて削除します。元には戻せません。')) return;
    await deleteAllPeople();
    await reload();
  };

  const openLinks = async () => {
    setView('links');
    const r = await getLinks();
    if (r.success) setLinks(r);
  };

  const submitQuiz = async () => {
    if (!current) return;
    setError('');
    const payload = LOVE_TYPE64_QUESTIONS.flatMap((q) => {
      const v = answers.get(q.id);
      return typeof v === 'number' ? [{ id: q.id, val: v }] : [];
    });
    setBusy(true);
    const r = await diagnosePerson(current.id, payload, confidence);
    setBusy(false);
    if (!r.success) {
      setError(r.error === 'INSUFFICIENT_STONES' ? 'ルーンストーンが足りません。' : r.error ?? '診断できませんでした');
      return;
    }
    if (typeof r.stoneBalance === 'number') onBalance?.(r.stoneBalance);
    await reload();
    await openPerson(current.id);
  };

  const pageQuestions = LOVE_TYPE64_QUESTIONS.slice(page * LOVE_TYPE64_QUESTIONS_PER_PAGE, (page + 1) * LOVE_TYPE64_QUESTIONS_PER_PAGE);
  const pageDone = pageQuestions.every((q) => answers.has(q.id));
  const isLastPage = page === PAGES - 1;

  return (
    <div className="home-panel-backdrop" onClick={onClose}>
      <div className="home-panel people-panel" onClick={(e) => e.stopPropagation()}>
        {error && <p className="daily-error">{error}</p>}

        {view === 'list' && (
          <>
            <h3>🧵 縁帳</h3>
            <p className="home-panel-lead">
              周りの人を、あなたの目で見て、記録します。あなた以外には、見えません。診断は、あなたから見た「仮説」で、ご本人の診断結果ではありません。
            </p>
            {people === null ? (
              <p className="home-panel-empty">読み込んでいます…</p>
            ) : people.length === 0 ? (
              <p className="home-panel-empty">まだ、だれも登録されていません。</p>
            ) : (
              <ul>
                {people.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => openPerson(p.id)}>
                      <span>
                        {p.result && <img className="people-thumb" src={`/assets/results/lovetype/${p.result.type1}.webp`} alt="" />}
                        {p.name}　<small>{RELATION_LABEL[p.relation]}</small>
                      </span>
                      <small>{p.result ? p.result.characterName : '未診断'}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="daily-btn people-wide" onClick={() => { setError(''); setView('add'); }} disabled={(people?.length ?? 0) >= limit}>
              ＋ 人を追加（{people?.length ?? 0} / {limit}）
            </button>
            {(people?.length ?? 0) >= 2 && (
              <button type="button" className="home-panel-link" onClick={openLinks}>
                つながりを見る →
              </button>
            )}
            {(people?.length ?? 0) > 0 && (
              <button type="button" className="people-danger" onClick={handleDeleteAll}>
                縁帳を、すべて削除する
              </button>
            )}
            <button type="button" className="home-panel-close" onClick={onClose}>
              閉じる
            </button>
          </>
        )}

        {view === 'add' && (
          <>
            <h3>人を追加</h3>
            <div className="people-notice">
              <b>書かないでください：</b>実名・電話番号・住所・勤務先・健康や性に関すること。ニックネームがおすすめです。
            </div>
            <label className="people-field">
              名前（ニックネーム）
              <input type="text" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="例：はなちゃん" />
            </label>
            <label className="people-field">
              関係
              <select value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
                {(Object.keys(RELATION_LABEL) as Relation[]).map((r) => (
                  <option key={r} value={r}>{RELATION_LABEL[r]}</option>
                ))}
              </select>
            </label>
            <label className="people-field">
              メモ（任意・100文字まで）
              <input type="text" value={memo} maxLength={100} onChange={(e) => setMemo(e.target.value)} />
            </label>
            <p className="daily-note">追加すると、そのまま、恋愛タイプの診断に進みます（ルーンストーン1個）。</p>
            <button type="button" className="daily-btn people-wide" onClick={handleAdd} disabled={busy || !name.trim()}>
              {busy ? '追加しています…' : '追加して、診断へ'}
            </button>
            <button type="button" className="home-panel-close" onClick={() => setView('list')}>戻る</button>
          </>
        )}

        {view === 'quiz' && current && (
          <>
            <h3>{current.name}さんなら、どう答えそう？</h3>
            <p className="home-panel-lead">
              {current.name}さんになったつもりで、答えてください。{page + 1} / {PAGES}　分からない質問は「？」を選べます。
            </p>
            <div className="people-questions">
              {pageQuestions.map((q) => (
                <div key={q.id} className="people-question">
                  <p>{q.text}</p>
                  <div className="people-scale">
                    {LOVE_SCALE_VALUES.map((val) => (
                      <button
                        key={val}
                        type="button"
                        className={answers.get(q.id) === val ? 'is-on' : ''}
                        onClick={() => setAnswers((m) => new Map(m).set(q.id, val))}
                        aria-label={val <= 1 ? q.left : q.right}
                      >
                        ♥
                      </button>
                    ))}
                    <button type="button" className={`people-unknown${answers.get(q.id) === null ? ' is-on' : ''}`} onClick={() => setAnswers((m) => new Map(m).set(q.id, null))}>
                      ？
                    </button>
                  </div>
                  <div className="people-scale-labels">
                    <span>{q.left}</span>
                    <span>{q.right}</span>
                  </div>
                </div>
              ))}
            </div>
            {isLastPage && (
              <label className="people-field">
                この人のことは、どのくらい分かりますか？
                <select value={confidence} onChange={(e) => setConfidence(e.target.value as Confidence)}>
                  {(Object.keys(CONFIDENCE_LABEL) as Confidence[]).map((c) => (
                    <option key={c} value={c}>{CONFIDENCE_LABEL[c]}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="people-nav">
              <button type="button" className="home-panel-close" onClick={() => (page === 0 ? setView('list') : setPage(page - 1))} disabled={busy}>
                戻る
              </button>
              <button
                type="button"
                className="daily-btn"
                disabled={!pageDone || busy}
                onClick={() => (isLastPage ? submitQuiz() : setPage(page + 1))}
              >
                {busy ? '診断中…' : isLastPage ? '診断する（石1個）' : '次へ'}
              </button>
            </div>
          </>
        )}

        {view === 'detail' && current && (
          <>
            <h3>{current.name}　<small>{RELATION_LABEL[current.relation]}</small></h3>
            {current.result ? (
              <div className="people-result">
                <img src={`/assets/results/lovetype/${current.result.type1}.webp`} alt={current.result.characterName} />
                <p className="people-result-label">あなたから見た、{current.name}さん（仮説）</p>
                <p className="people-result-type">{current.result.characterName}　<small>{current.result.subTypeName}</small></p>
                <p className="daily-note">確信度：{CONFIDENCE_LABEL[current.result.confidence]}　／　ご本人の診断結果ではありません。</p>
              </div>
            ) : (
              <p className="home-panel-empty">まだ、診断していません。</p>
            )}

            {comparison && comparison.total > 0 && (
              <div className="people-compare">
                <h4>あなたとの、共通点・違い（{comparison.sameCount} / {comparison.total} が同じ向き）</h4>
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
              <p className="daily-note">あなた自身の恋愛タイプ診断をすると、共通点・違いが見られます。</p>
            )}

            {current.memo && <p className="people-memo">メモ：{current.memo}</p>}

            <button type="button" className="daily-btn people-wide" onClick={() => startQuiz(current.id, current.name)}>
              {current.result ? 'もう一度診断する（石1個）' : '診断する（石1個）'}
            </button>
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
                {links.sameAsMe.length ? <p>{links.sameAsMe.join('、')}</p> : <p className="home-panel-empty">{links.myType1 ? 'まだ、いません。' : 'あなた自身の恋愛タイプ診断をすると、見られます。'}</p>}
                <h4>同じタイプどうし</h4>
                {links.sameType.length ? (
                  <ul className="people-links">
                    {links.sameType.map((g) => (
                      <li key={g.type1}>
                        <img src={`/assets/results/lovetype/${g.type1}.webp`} alt="" />
                        <span>{g.names.join('、')}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="home-panel-empty">まだ、同じタイプの人は、いません。</p>
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
