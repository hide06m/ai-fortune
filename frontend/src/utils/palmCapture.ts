/**
 * 撮影直後に、手のひらの写真から手相の線を検出する
 * 検出できた線だけをサーバーへ送る（確実に検出できなかった線は、何も言わず省く）。
 * 手が写っていない・指定の手でない場合は、撮り直しのメッセージを返す。
 * 解析自体が失敗しても診断は続けられる（線を重ねる表示がなくなるだけ）
 */

import { detectPalmLines, REQUIRED_HAND, type DetectedLine } from './palmDetect';

export type PalmAnalysis =
  | { status: 'ok'; lines: DetectedLine[] }
  | { status: 'retake'; message: string }
  | { status: 'unavailable' };

const HAND_NAME = REQUIRED_HAND === 'left' ? '左手' : '右手';

/** 解析にかけてよい時間。超えたら、線の表示なしで診断を続ける（待ち続けて固まらないようにする） */
const ANALYSIS_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`解析が${ms}ms以内に終わりませんでした`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function analyzePalmImage(canvas: HTMLCanvasElement): Promise<PalmAnalysis> {
  const startedAt = performance.now();
  try {
    const result = await withTimeout(detectPalmLines(canvas), ANALYSIS_TIMEOUT_MS);
    console.info(`[palm] 解析完了 ${Math.round(performance.now() - startedAt)}ms 手=${result.ok ? result.hand : result.reason} 線=${result.lines.length}`);
    if (!result.ok) {
      if (result.reason === 'wrong-hand') {
        return { status: 'retake', message: `${HAND_NAME}の手のひらを撮影してください（写っているのは${REQUIRED_HAND === 'left' ? '右手' : '左手'}のようです）` };
      }
      return { status: 'retake', message: '手のひらが見つかりませんでした。手のひら全体が写るように撮り直してください' };
    }
    return { status: 'ok', lines: result.lines };
  } catch (error) {
    console.warn(`[palm] 解析を断念（${Math.round(performance.now() - startedAt)}ms）。線の表示なしで続行します`, error);
    return { status: 'unavailable' };
  }
}
