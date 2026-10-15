/**
 * 診断結果のオリジナルキャラクター画像（性格タイプ診断・恋愛タイプ診断）。読み込めないときは、代わりの文字を出す
 */

import { useState } from 'react';

export function ResultCharacter({ src, alt, fallback }: { src: string; alt: string; fallback?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback ? <div className="mbti-result-emblem" aria-hidden="true">{fallback}</div> : null;
  return <img className="result-character" src={src} alt={alt} onError={() => setFailed(true)} />;
}
