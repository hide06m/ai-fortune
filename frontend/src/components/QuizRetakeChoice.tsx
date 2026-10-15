/**
 * 2回目以降のクイズ系診断（性格タイプ・恋愛タイプ診断64）向け：
 * 「前回の結果のまま悩みだけ入力し直す」か「最初からやり直す」かを選ぶ画面
 */

import React from 'react';
import { KURI_CONSULT_STONE_COST } from '../types/character';

interface QuizRetakeChoiceProps {
  quizName: string; // 例: "性格タイプ診断（16タイプ）"
  resultLabel: string; // 例: "前回の結果：ENTJ-T"
  /** 悩み・状況を、クリに相談する（前回のタイプのまま） */
  onConsult: () => void;
  onStartOver: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string;
}

export function QuizRetakeChoice({
  quizName,
  resultLabel,
  onConsult,
  onStartOver,
  onCancel,
  submitting,
  error,
}: QuizRetakeChoiceProps) {
  return (
    <div className="mbti-quiz">
      <h2>{quizName}</h2>
      <p className="quiz-retake-result">{resultLabel}</p>
      <p className="quiz-retake-hint">タイプはそのままに、今の悩み・状況をクリに相談できます。タイプを診断し直すこともできます。</p>

      {error && <div className="error">{error}</div>}

      <div className="mbti-nav">
        <button type="button" className="secondary-button" onClick={onCancel} disabled={submitting}>
          戻る
        </button>
        <button type="button" className="primary-button" onClick={onConsult} disabled={submitting}>
          悩み・状況をクリに相談する（石{KURI_CONSULT_STONE_COST}個）
        </button>
      </div>

      <button
        type="button"
        className="secondary-button quiz-retake-startover"
        onClick={onStartOver}
        disabled={submitting}
      >
        タイプを最初から診断し直す（{quizName}）
      </button>
    </div>
  );
}
