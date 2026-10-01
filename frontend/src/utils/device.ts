/**
 * ざっくりとしたモバイル端末判定（タッチ操作＋細い画面幅）
 * 手相診断で「スマホ本体からのアクセスか／PCからのアクセスか」の分岐に使う
 */
export function isMobileDevice(): boolean {
  const hasCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const isNarrowScreen = window.innerWidth <= 768
  return hasCoarsePointer && isNarrowScreen
}
