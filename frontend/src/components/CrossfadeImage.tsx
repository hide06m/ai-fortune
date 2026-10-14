/**
 * 立ち絵の切り替え：表情などの絵が変わるとき、前の絵をフェードアウトしながら、次の絵をフェードインする（同時）。
 * 会話シーンのすべての立ち絵で使う。前の絵が一瞬消えたり、別の絵が一瞬見えたりしない
 */

import { useEffect, useState } from 'react';

/** フェードの長さ（ms）。CSS の vnCrossfade* と合わせる */
const FADE_MS = 350;

export function CrossfadeImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<{ cur: string; prev: string | null }>({ cur: src, prev: null });

  // 描画の途中で状態を更新する（React が、画面に出す前にやり直す）ので、新しい絵だけが先に出る瞬間がない
  if (state.cur !== src) {
    setState({ cur: src, prev: state.cur });
  }

  useEffect(() => {
    if (!state.prev) return;
    const timer = window.setTimeout(() => setState((s) => ({ ...s, prev: null })), FADE_MS + 50);
    return () => window.clearTimeout(timer);
  }, [state.prev]);

  return (
    <div className="vn-bust-stack">
      {state.prev && <img key={`prev-${state.prev}`} src={state.prev} alt="" aria-hidden="true" className="vn-character-bust vn-bust-prev" />}
      <img key={`cur-${src}`} src={src} alt={alt} className="vn-character-bust vn-bust-cur" />
    </div>
  );
}
