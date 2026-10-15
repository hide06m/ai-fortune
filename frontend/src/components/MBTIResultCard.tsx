/**
 * 性格診断（16タイプ診断）の結果カード
 * 役割グループのテーマカラーでタイプ名と5軸のパーセンテージバーを表示する
 */

import { useEffect, useState } from 'react';
import '../styles/mbti-result.css';
import { loadMBTIFullContent, type TextBlock } from '../data/privateData';
import { ResultCharacter } from './ResultCharacter';
import { LongTextSection } from './LongTextSection';
import { MBTI_TYPES, MBTI_ROLE_THEMES, MBTI_IDENTITY_LABELS } from '../data/mbtiTypes';

interface DimensionResult {
  traitA: string;
  traitB: string;
  percentageA: number;
  percentageB: number;
  winner: string;
}

interface MBTIResultCardProps {
  result: {
    personalityType: string; // 例: "INTJ-A"
    dimensions: Record<string, DimensionResult>;
  };
}

export function MBTIResultCard({ result }: MBTIResultCardProps) {
  const [coreType, identity] = result.personalityType.split('-');
  const info = MBTI_TYPES[coreType];
  const role = info ? MBTI_ROLE_THEMES[info.roleKey] : null;
  const color = role?.color ?? '#888888';
  const [fullText, setFullText] = useState<TextBlock[] | null>(null);

  useEffect(() => {
    loadMBTIFullContent(coreType).then(setFullText);
  }, [coreType]);

  return (
    <div className="mbti-result-card" style={{ ['--mbti-color' as string]: color }}>
      <div className="mbti-result-header">
        <ResultCharacter src={`/assets/results/mbti/${coreType}.webp`} alt={info?.name ?? coreType} fallback={coreType} />
        <h3 className="mbti-result-name">
          {info?.name ?? '性格診断'}
          <span className="mbti-result-code">（{result.personalityType}）</span>
        </h3>
        {identity && <div className="mbti-result-identity">{MBTI_IDENTITY_LABELS[identity] ?? identity}</div>}
        {info && <p className="mbti-result-tagline">{info.tagline}</p>}
        {role && <div className="mbti-result-role">4つのグループ：{role.name}</div>}
      </div>

      <div className="mbti-result-bars">
        {Object.entries(result.dimensions).map(([dim, d]) => (
          <div key={dim} className="mbti-result-bar-row">
            <div className="mbti-result-bar-labels">
              <span className={d.winner === d.traitA ? 'is-winner' : ''}>
                {d.traitA} {d.percentageA}%
              </span>
              <span className={d.winner === d.traitB ? 'is-winner' : ''}>
                {d.traitB} {d.percentageB}%
              </span>
            </div>
            <div className="mbti-result-bar-track">
              <div className="mbti-result-bar-fill" style={{ width: `${d.percentageA}%` }} />
            </div>
          </div>
        ))}
      </div>

      {fullText && <LongTextSection blocks={fullText} />}
    </div>
  );
}
