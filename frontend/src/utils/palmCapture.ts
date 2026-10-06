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

export async function analyzePalmImage(canvas: HTMLCanvasElement): Promise<PalmAnalysis> {
  try {
    const result = await detectPalmLines(canvas);
    if (!result.ok) {
      if (result.reason === 'wrong-hand') {
        return { status: 'retake', message: `${HAND_NAME}の手のひらを撮影してください（写っているのは${REQUIRED_HAND === 'left' ? '右手' : '左手'}のようです）` };
      }
      return { status: 'retake', message: '手のひらが見つかりませんでした。手のひら全体が写るように撮り直してください' };
    }
    return { status: 'ok', lines: result.lines };
  } catch (error) {
    console.error('Palm line analysis failed (continuing without line overlay):', error);
    return { status: 'unavailable' };
  }
}
