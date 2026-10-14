/**
 * カウンセリング方式の入力（ゲスト診断・ログイン初回診断）
 *
 * ムスビが、生年月日 → 出生時刻 → 出生地 → 悩み・状況の順に、1項目ずつ質問する。
 * 入力フォームをいきなり出さず、会話の流れのまま情報を集めて、診断に進む。
 *   ・生年月日：打ち込み／カレンダー／リストの3通りで入力できる
 *   ・出生時刻・出生地・悩み：選択肢を出し、そのうえで自由に書き込める
 * 質問の言い回しは、ムスビ（村上春樹風の語り口）のまま。
 */

import { useEffect, useState } from 'react';
import '../styles/counseling.css';
import { BirthDateInput } from './BirthDateInput';

export interface CounselingValues {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  concern: string;
}

interface CounselingSceneProps {
  /** 背景画像 */
  background: string;
  /** ムスビの立ち絵 */
  characterImage: string;
  /** セリフ枠に出す名前（ゲストには正体を明かさないので ??? ） */
  speakerName: string;
  /** 診断の実行中か（実行中は入力を止める） */
  busy: boolean;
  /** 診断の失敗などの表示 */
  error: string;
  /** 全部聞き終えたあと、診断を始める */
  onComplete: (values: CounselingValues) => void;
}

type StepId = 'birthDate' | 'birthTime' | 'birthPlace' | 'concern' | 'done';

const QUESTIONS: Record<StepId, string> = {
  birthDate:
    'まず、君がこの世界に最初の息を吸い込んだ日を教えてもらえるかな。年と月と日だ。',
  birthTime:
    '次は時刻だ。生まれた時間を覚えているなら、それも手がかりになる。正確でなくていい。朝だったか夜だったか、そのくらいの目安で十分だよ。わからなければ、わからないと言ってくれればいい。',
  birthPlace:
    'どこで生まれたのかも聞いておこうか。町の名前でも、地方の名前でもいい。たとえば「東京都千代田区」のようにね。',
  concern:
    '最後に、いま君の頭の隅にひっかかっているものを教えてほしい。うまく言葉にならなくてもかまわない。近いものを選んでくれればいい。',
  done: '……なるほど。それだけ聞けば十分だ。少しのあいだ、静かにしていてくれ。君の輪郭を視てみよう。',
};

/** 出生時刻の選択肢。選ぶと、その時間帯の真ん中あたりの時刻を入れる（空は「わからない」） */
const TIME_CHOICES: Array<{ label: string; value: string }> = [
  { label: '早朝（5〜8時ごろ）', value: '06:30' },
  { label: '午前（8〜12時ごろ）', value: '10:00' },
  { label: '午後（12〜16時ごろ）', value: '14:00' },
  { label: '夕方（16〜19時ごろ）', value: '17:30' },
  { label: '夜（19〜24時ごろ）', value: '21:30' },
  { label: '深夜（0〜5時ごろ）', value: '02:30' },
  { label: 'わからない', value: '' },
];

const PLACE_CHOICES = ['北海道・東北', '関東', '中部', '近畿', '中国・四国', '九州・沖縄', '海外', 'わからない'];

const CONCERN_CHOICES = ['仕事のこと', '恋愛のこと', '友人のこと', '家族のこと', 'その他（自由に書く）', '特にない（総合的に見てほしい）'];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1900 + 1 }, (_, i) => THIS_YEAR - i);

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 年・月・日をそれぞれリストから選ぶ入力 */
function BirthDateSelects({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y0, m0, d0] = value ? value.split('-') : ['', '', ''];
  // 年のリストは、2000年を最初に選んだ状態で開く（開いたときに、この辺りから選べるように）
  const [year, setYear] = useState(y0 || '2000');
  const [month, setMonth] = useState(m0 || '');
  const [day, setDay] = useState(d0 || '');
  const maxDay = year && month ? daysIn(Number(year), Number(month)) : 31;

  useEffect(() => {
    if (year && month && day && Number(day) <= maxDay) {
      onChange(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    } else {
      onChange('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  return (
    <div className="counsel-selects">
      <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="年">
        <option value="">年</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}年
          </option>
        ))}
      </select>
      <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="月">
        <option value="">月</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="日">
        <option value="">日</option>
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </div>
  );
}

export function CounselingScene({ background, characterImage, speakerName, busy, error, onComplete }: CounselingSceneProps) {
  const [step, setStep] = useState<StepId>('birthDate');
  const [birthDate, setBirthDate] = useState('');
  // 既定はリストから選ぶ。打ち込み・カレンダー入力に切り替えられる
  const [dateMode, setDateMode] = useState<'type' | 'list'>('list');
  // 出生時刻：選んだ目安（ラベル）と、時刻の値（自由入力で上書きできる）
  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  const [birthTime, setBirthTime] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [concernChoices, setConcernChoices] = useState<string[]>([]);
  const [concernText, setConcernText] = useState('');

  // タイプライター：どの文のものかを一緒に持つので、切り替わった瞬間に新しい文が見えてしまわない
  const text = QUESTIONS[step];
  const [typed, setTyped] = useState({ text: '', n: 0 });
  const shown = typed.text === text ? typed.n : 0;
  useEffect(() => {
    setTyped({ text, n: 0 });
    let i = 0;
    const timer = window.setInterval(() => {
      i++;
      setTyped({ text, n: i });
      if (i >= text.length) window.clearInterval(timer);
    }, 30);
    return () => window.clearInterval(timer);
  }, [text]);

  const goNext = (next: StepId) => setStep(next);

  const finish = () => {
    const parts = concernChoices.filter((c) => !c.startsWith('その他') && !c.startsWith('特にない'));
    const free = concernText.trim();
    const concern = [parts.length ? parts.join('、') : '', free].filter(Boolean).join('。');
    setStep('done');
    onComplete({ birthDate, birthTime, birthPlace: birthPlace.trim(), concern });
  };

  const toggleConcern = (c: string) => {
    setConcernChoices((cur) => {
      if (c.startsWith('特にない')) return cur.includes(c) ? [] : [c];
      const without = cur.filter((x) => !x.startsWith('特にない'));
      return without.includes(c) ? without.filter((x) => x !== c) : [...without, c];
    });
  };

  const back: Partial<Record<StepId, StepId>> = { birthTime: 'birthDate', birthPlace: 'birthTime', concern: 'birthPlace' };
  const showFree = concernChoices.some((c) => c.startsWith('その他'));

  return (
    <div className="vn-scene counsel-scene" style={{ backgroundImage: `url(${background})`, cursor: 'default' }}>
      <div className="vn-character-bust-wrap">
        <img src={characterImage} alt={speakerName} className="vn-character-bust" />
      </div>

      {step !== 'done' && (
        <div className="counsel-panel">
          {step === 'birthDate' && (
            <>
              <div className="counsel-row">
                <span className="counsel-label">生年月日</span>
                {dateMode === 'type' ? (
                  <BirthDateInput id="counselBirthDate" value={birthDate} onChange={setBirthDate} />
                ) : (
                  <BirthDateSelects value={birthDate} onChange={setBirthDate} />
                )}
              </div>
              <button type="button" className="counsel-link" onClick={() => setDateMode(dateMode === 'type' ? 'list' : 'type')}>
                {dateMode === 'type' ? 'リストから選ぶ' : '打ち込み・カレンダーで入力する'}
              </button>
              <div className="counsel-actions">
                <button type="button" className="counsel-next" disabled={!birthDate} onClick={() => goNext('birthTime')}>
                  次へ
                </button>
              </div>
            </>
          )}

          {step === 'birthTime' && (
            <>
              <div className="counsel-chips">
                {TIME_CHOICES.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    className={`counsel-chip${timeChoice === c.label ? ' is-selected' : ''}`}
                    onClick={() => {
                      setTimeChoice(c.label);
                      setBirthTime(c.value);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <label className="counsel-free">
                <span>時刻がわかるなら、直接入力</span>
                <input
                  type="time"
                  value={birthTime}
                  onChange={(e) => {
                    setBirthTime(e.target.value);
                    setTimeChoice(e.target.value ? '入力' : null);
                  }}
                />
              </label>
              <div className="counsel-actions">
                <button type="button" className="counsel-back" onClick={() => goNext(back.birthTime!)}>
                  戻る
                </button>
                <button type="button" className="counsel-next" disabled={timeChoice === null} onClick={() => goNext('birthPlace')}>
                  次へ
                </button>
              </div>
            </>
          )}

          {step === 'birthPlace' && (
            <>
              <div className="counsel-chips">
                {PLACE_CHOICES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`counsel-chip${birthPlace === p ? ' is-selected' : ''}`}
                    onClick={() => setBirthPlace(p === 'わからない' ? '' : p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <label className="counsel-free">
                <span>くわしくわかるなら、直接入力</span>
                <input
                  type="text"
                  placeholder="例: 東京都千代田区"
                  value={birthPlace}
                  onChange={(e) => setBirthPlace(e.target.value)}
                />
              </label>
              <div className="counsel-actions">
                <button type="button" className="counsel-back" onClick={() => goNext(back.birthPlace!)}>
                  戻る
                </button>
                <button type="button" className="counsel-next" onClick={() => goNext('concern')}>
                  次へ
                </button>
              </div>
            </>
          )}

          {step === 'concern' && (
            <>
              <div className="counsel-chips">
                {CONCERN_CHOICES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`counsel-chip${concernChoices.includes(c) ? ' is-selected' : ''}`}
                    onClick={() => toggleConcern(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {showFree && (
                <label className="counsel-free">
                  <span>よければ、くわしく教えてほしい</span>
                  <textarea
                    rows={3}
                    placeholder="例: キャリアチェンジを考えています。今後の方向性について知りたいです。"
                    value={concernText}
                    onChange={(e) => setConcernText(e.target.value)}
                  />
                </label>
              )}
              <div className="counsel-actions">
                <button type="button" className="counsel-back" onClick={() => goNext(back.concern!)}>
                  戻る
                </button>
                <button type="button" className="counsel-next" disabled={concernChoices.length === 0 || busy} onClick={finish}>
                  これで視てもらう
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="vn-dialogue-box" style={{ cursor: 'default' }}>
        <div className="vn-speaker-name">{speakerName}</div>
        <p className="vn-dialogue-text">{text.slice(0, shown)}</p>
        {error && step === 'done' && (
          <div className="counsel-error">
            <p>{error}</p>
            <button type="button" className="counsel-next" disabled={busy} onClick={() => setStep('concern')}>
              もう一度やり直す
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
