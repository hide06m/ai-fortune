/**
 * 恋愛タイプ診断64 クイズ画面（クリ専用）
 * 18問を1ページ6問・全3ページで表示し、4段階のハート（ピンク/グリーン）で回答する
 */

import React, { useState, useEffect } from 'react';
import '../styles/mbti-quiz.css';
import { LOVE_TYPE64_QUESTIONS, LOVE_TYPE64_QUESTIONS_PER_PAGE, LOVE_SCALE_VALUES } from '../data/loveType64Questions';
import {
  submitLoveType64Quiz,
  
  submitLoveType64DirectType,
  getLatestLoveType64Result,
  type LoveAnswer,
  type LoveType64Response,
} from '../api/loveType64';
import { QuizRetakeChoice } from '../components/QuizRetakeChoice';

interface LoveType64QuizPageProps {
  onConsult: () => void;
  onComplete: (response: LoveType64Response) => void;
  onCancel: () => void;
}

const TOTAL_PAGES = Math.ceil(LOVE_TYPE64_QUESTIONS.length / LOVE_TYPE64_QUESTIONS_PER_PAGE);

const LF_OPTIONS = ['L', 'F'] as const;
const CA_OPTIONS = ['C', 'A'] as const;
const PR_OPTIONS = ['P', 'R'] as const;
const OE_OPTIONS = ['O', 'E'] as const;
const VN_OPTIONS = ['V', 'N'] as const;
const DI_OPTIONS = ['D', 'I'] as const;

export function LoveType64QuizPage({ onComplete, onConsult, onCancel }: LoveType64QuizPageProps) {
  // checking: 前回結果確認中／choice: 再診断選択／entry: 初回の入り口選択
  // direct-input: 既知のタイプをプルダウンで直接入力／quiz: 18問クイズ画面
  const [mode, setMode] = useState<'checking' | 'choice' | 'entry' | 'direct-input' | 'quiz'>('checking');
  const [previousType, setPreviousType] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // 次のページに進んだら、上に戻す
  useEffect(() => {
    // 描画が終わってから、先頭を画面の上に出す（スクロールできる親が、どれでも効く）
    const id = requestAnimationFrame(() => {
      document.querySelector('.mbti-quiz')?.scrollIntoView({ block: 'start' });
      window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(id);
  }, [page]);
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [concern, setConcern] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [directLF, setDirectLF] = useState<string>(LF_OPTIONS[0]);
  const [directCA, setDirectCA] = useState<string>(CA_OPTIONS[0]);
  const [directPR, setDirectPR] = useState<string>(PR_OPTIONS[0]);
  const [directOE, setDirectOE] = useState<string>(OE_OPTIONS[0]);
  const [directVN, setDirectVN] = useState<string>(VN_OPTIONS[0]);
  const [directDI, setDirectDI] = useState<string>(DI_OPTIONS[0]);

  useEffect(() => {
    let cancelled = false;
    getLatestLoveType64Result()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.result) {
          setPreviousType(res.result.fullType);
          setMode('choice');
        } else {
          setMode('entry');
        }
      })
      .catch((err) => {
        console.error('Failed to check latest love-type64 result:', err);
        if (!cancelled) setMode('entry');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmitDirectType = async () => {
    setError('');
    setSubmitting(true);
    try {
      const fullType = `${directLF}${directCA}${directPR}${directOE}-${directVN}${directDI}`;
      const response = await submitLoveType64DirectType(fullType, '', true);
      if (response.success) {
        onComplete(response);
      } else if (response.error === 'INSUFFICIENT_STONES') {
        setError('ルーンストーンが足りません。');
      } else {
        setError(response.error || '診断に失敗しました。');
      }
    } catch (err) {
      console.error('Failed to submit love-type64 direct type:', err);
      setError('診断に失敗しました。通信環境をご確認ください。');
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'checking') {
    return <div className="mbti-quiz" />;
  }

  if (mode === 'choice') {
    return (
      <QuizRetakeChoice
        quizName="恋愛タイプ診断64"
        resultLabel={`前回の結果：${previousType}`}
        onConsult={onConsult}
        onStartOver={() => setMode('quiz')}
        onCancel={onCancel}
        submitting={submitting}
        error={error}
      />
    );
  }

  if (mode === 'entry') {
    return (
      <div className="mbti-quiz">
        <h2 className="mbti-entry-title">恋愛タイプ診断64</h2>
        <p className="mbti-entry-desc">18問の質問に答えて診断するか、他サイトで診断済みのタイプを直接入力できます。</p>
        <div className="mbti-entry-options">
          <button type="button" className="primary-button" onClick={() => setMode('quiz')}>
            18問の質問に答えて診断する
          </button>
          <button type="button" className="secondary-button" onClick={() => setMode('direct-input')}>
            診断済みのタイプを入力する
          </button>
        </div>
        <button type="button" className="mbti-entry-cancel" onClick={onCancel} disabled={submitting}>
          戻る
        </button>
      </div>
    );
  }

  if (mode === 'direct-input') {
    return (
      <div className="mbti-quiz">
        <h2 className="mbti-entry-title">タイプを入力してください</h2>
        <div className="love-direct-input">
          <div className="love-direct-select-group">
            <select value={directLF} onChange={(e) => setDirectLF(e.target.value)}>
              {LF_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={directCA} onChange={(e) => setDirectCA(e.target.value)}>
              {CA_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={directPR} onChange={(e) => setDirectPR(e.target.value)}>
              {PR_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={directOE} onChange={(e) => setDirectOE(e.target.value)}>
              {OE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="love-direct-hyphen">-</span>
            <select value={directVN} onChange={(e) => setDirectVN(e.target.value)}>
              {VN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={directDI} onChange={(e) => setDirectDI(e.target.value)}>
              {DI_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="love-direct-preview">{directLF}{directCA}{directPR}{directOE}-{directVN}{directDI}</div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="mbti-nav">
          <button type="button" className="secondary-button" onClick={() => setMode('entry')} disabled={submitting}>
            戻る
          </button>
          <button type="button" className="primary-button" onClick={handleSubmitDirectType} disabled={submitting}>
            {submitting ? '診断中...' : '診断結果を見る'}
          </button>
        </div>
      </div>
    );
  }

  const startIndex = page * LOVE_TYPE64_QUESTIONS_PER_PAGE;
  const pageQuestions = LOVE_TYPE64_QUESTIONS.slice(startIndex, startIndex + LOVE_TYPE64_QUESTIONS_PER_PAGE);
  const isLastPage = page === TOTAL_PAGES - 1;
  const allAnsweredOnPage = pageQuestions.every((q) => answers.has(q.id));

  const handleSelect = (questionId: number, val: number) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, val);
      return next;
    });
  };

  const handleNext = async () => {
    if (!allAnsweredOnPage) return;

    if (!isLastPage) {
      setPage((p) => p + 1);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const payload: LoveAnswer[] = LOVE_TYPE64_QUESTIONS.map((q) => ({ id: q.id, val: answers.get(q.id)! }));
      const response = await submitLoveType64Quiz(payload, concern);
      if (response.success) {
        onComplete(response);
      } else if (response.error === 'INSUFFICIENT_STONES') {
        setError('ルーンストーンが足りません。');
      } else {
        setError(response.error || '診断に失敗しました。');
      }
    } catch (err) {
      console.error('Failed to submit love-type64 quiz:', err);
      setError('診断に失敗しました。通信環境をご確認ください。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (page === 0) {
      setMode(previousType ? 'choice' : 'entry');
    } else {
      setPage((p) => p - 1);
    }
  };

  return (
    <div className="mbti-quiz">
      <div className="mbti-quiz-header">
        <div className="mbti-progress-bar">
          <div className="mbti-progress-fill" style={{ width: `${((page + 1) / TOTAL_PAGES) * 100}%` }} />
        </div>
        <div className="mbti-progress-text">{page + 1} / {TOTAL_PAGES}</div>
      </div>

      <div className="mbti-questions">
        {pageQuestions.map((q) => (
          <div key={q.id} className="mbti-question">
            <p className="mbti-statement">{q.text}</p>
            <div className="mbti-scale love-heart-scale">
              {LOVE_SCALE_VALUES.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`mbti-scale-dot love-scale-heart-${val} ${answers.get(q.id) === val ? 'selected' : ''}`}
                  title={val <= 1 ? q.left : q.right}
                  onClick={() => handleSelect(q.id, val)}
                  aria-label={val <= 1 ? q.left : q.right}
                >
                  ♥
                </button>
              ))}
            </div>
            <div className="mbti-scale-labels">
              <span>{q.left}</span>
              <span>{q.right}</span>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="mbti-nav">
        <button type="button" className="secondary-button" onClick={handleBack} disabled={submitting}>
          戻る
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handleNext}
          disabled={!allAnsweredOnPage || submitting}
        >
          {submitting ? '診断中...' : isLastPage ? 'クリに占ってもらう' : '次へ'}
        </button>
      </div>
    </div>
  );
}
