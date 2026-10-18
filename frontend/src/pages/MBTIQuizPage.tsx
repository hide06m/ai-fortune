/**
 * 性格タイプ診断（16タイプ）クイズ画面（クリ専用）
 * 60問を1ページ6問・全10ページで表示し、7段階のリッカート尺度で回答する
 */

import React, { useState, useEffect } from 'react';
import '../styles/mbti-quiz.css';
import { MBTI_QUESTIONS, MBTI_QUESTIONS_PER_PAGE } from '../data/mbtiQuestions';
import { submitMBTIQuiz,  submitMBTIDirectType, getLatestMBTIResult, type MBTIAnswer, type MBTIResponse } from '../api/mbti';
import { QuizRetakeChoice } from '../components/QuizRetakeChoice';

const EI_OPTIONS = ['E', 'I'] as const;
const SN_OPTIONS = ['S', 'N'] as const;
const TF_OPTIONS = ['T', 'F'] as const;
const JP_OPTIONS = ['J', 'P'] as const;
const AT_OPTIONS = ['A', 'T'] as const;

interface MBTIQuizPageProps {
  onConsult: () => void;
  onComplete: (response: MBTIResponse) => void;
  onCancel: () => void;
}

const SCALE_OPTIONS = [-3, -2, -1, 0, 1, 2, 3];
const SCALE_LABELS: Record<number, string> = {
  [-3]: 'とてもそう思う',
  [-2]: 'ややそう思う',
  [-1]: 'そう思う',
  0: 'わからない',
  1: 'そう思わない',
  2: 'あまりそう思わない',
  3: 'まったくそう思わない',
};

const TOTAL_PAGES = Math.ceil(MBTI_QUESTIONS.length / MBTI_QUESTIONS_PER_PAGE);

export function MBTIQuizPage({ onComplete, onConsult, onCancel }: MBTIQuizPageProps) {
  // checking: 前回結果の有無を確認中／choice: 再診断方法の選択画面／entry: 初回の入り口選択
  // direct-input: 既知のタイプをプルダウンで直接入力／quiz: 60問クイズ画面
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
  const [directEI, setDirectEI] = useState<string>(EI_OPTIONS[0]);
  const [directSN, setDirectSN] = useState<string>(SN_OPTIONS[0]);
  const [directTF, setDirectTF] = useState<string>(TF_OPTIONS[0]);
  const [directJP, setDirectJP] = useState<string>(JP_OPTIONS[0]);
  const [directAT, setDirectAT] = useState<string>(AT_OPTIONS[0]);

  useEffect(() => {
    let cancelled = false;
    getLatestMBTIResult()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.result) {
          setPreviousType(res.result.personalityType);
          setMode('choice');
        } else {
          setMode('entry');
        }
      })
      .catch((err) => {
        console.error('Failed to check latest MBTI result:', err);
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
      const personalityType = `${directEI}${directSN}${directTF}${directJP}-${directAT}`;
      const response = await submitMBTIDirectType(personalityType, '', true);
      if (response.success) {
        onComplete(response);
      } else if (response.error === 'INSUFFICIENT_STONES') {
        setError('ルーンストーンが足りません。');
      } else {
        setError(response.error || '診断に失敗しました。');
      }
    } catch (err) {
      console.error('Failed to submit MBTI direct type:', err);
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
        quizName="性格タイプ診断（16タイプ）"
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
        <h2 className="mbti-entry-title">性格タイプ診断（16タイプ）</h2>
        <p className="mbti-entry-desc">60問の質問に答えて診断するか、他サイトで診断済みのタイプを直接入力できます。</p>
        <div className="mbti-entry-options">
          <button type="button" className="primary-button" onClick={() => setMode('quiz')}>
            60問の質問に答えて診断する
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
        <div className="mbti-direct-input">
          <div className="mbti-direct-select-group">
            <select value={directEI} onChange={(e) => setDirectEI(e.target.value)}>
              {EI_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={directSN} onChange={(e) => setDirectSN(e.target.value)}>
              {SN_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={directTF} onChange={(e) => setDirectTF(e.target.value)}>
              {TF_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={directJP} onChange={(e) => setDirectJP(e.target.value)}>
              {JP_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <span className="mbti-direct-hyphen">-</span>
            <select value={directAT} onChange={(e) => setDirectAT(e.target.value)}>
              {AT_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="mbti-direct-preview">{directEI}{directSN}{directTF}{directJP}-{directAT}</div>
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

  const startIndex = page * MBTI_QUESTIONS_PER_PAGE;
  const pageQuestions = MBTI_QUESTIONS.slice(startIndex, startIndex + MBTI_QUESTIONS_PER_PAGE);
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
      const payload: MBTIAnswer[] = MBTI_QUESTIONS.map((q) => ({ id: q.id, val: answers.get(q.id)! }));
      const response = await submitMBTIQuiz(payload, concern);
      if (response.success) {
        onComplete(response);
      } else if (response.error === 'INSUFFICIENT_STONES') {
        setError('ルーンストーンが足りません。');
      } else {
        setError(response.error || '診断に失敗しました。');
      }
    } catch (err) {
      console.error('Failed to submit MBTI quiz:', err);
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
            <p className="mbti-statement">{q.statement}</p>
            <div className="mbti-scale">
              {SCALE_OPTIONS.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`mbti-scale-dot mbti-scale-dot-${val} ${answers.get(q.id) === val ? 'selected' : ''}`}
                  title={SCALE_LABELS[val]}
                  onClick={() => handleSelect(q.id, val)}
                  aria-label={SCALE_LABELS[val]}
                />
              ))}
            </div>
            <div className="mbti-scale-labels">
              <span>そう思う</span>
              <span>そう思わない</span>
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
