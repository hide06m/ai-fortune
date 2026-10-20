/**
 * 広告（リワード広告＝見ると報酬）の入口。
 *
 * - 環境変数 VITE_ADSENSE_CLIENT（例：ca-pub-0000000000000000）が、ないときは、「仮の広告」（5秒の待ち）。
 * - 設定すると、Google AdSense の「H5 Games Ads」（Ad Placement API）の、リワード広告に、切り替わる。
 *     VITE_ADSENSE_TEST=true を付けると、テスト広告（収益なし・審査前の確認用）
 * 返す値：'viewed' 最後まで見た／'dismissed' 途中で閉じた／'no_ad' 今は出せる広告がない／'error'
 *
 * ⚠️ ウェブ版の広告は、広告会社のサーバーから、こちらのサーバーへの確認（SSV）がない。
 *    画面の戻り値だけでは、不正に、石を増やせてしまうので、サーバー側で、1日の回数と、間隔の制限を、必ず、かける（backend の stones.ts）。
 */

export type AdOutcome = 'viewed' | 'dismissed' | 'no_ad' | 'error';

export interface AdProgress {
  /** 残り秒数（仮の広告の表示用）。本物の広告のときは、使わない */
  secondsLeft: number;
}

const CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() || '';
const TEST = import.meta.env.VITE_ADSENSE_TEST === 'true';
const FAKE_AD_SECONDS = 5;

/** 本物の広告をつないでいるか（画面の表示の切りかえに使う） */
export const isRealAdConfigured = CLIENT.length > 0;

interface AdBreakOptions {
  type: 'reward';
  name: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (info: { breakStatus: string }) => void;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (o: AdBreakOptions) => void;
    adConfig?: (o: Record<string, unknown>) => void;
  }
}

let scriptPromise: Promise<void> | null = null;

/** AdSense のスクリプトを、1回だけ読みこむ */
function loadAdSense(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = (o: unknown) => {
      (window.adsbygoogle as unknown[]).push(o);
    };
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`;
    s.crossOrigin = 'anonymous';
    if (TEST) s.setAttribute('data-adbreak-test', 'on');
    s.onload = () => {
      window.adConfig?.({ preloadAdBreaks: 'on', sound: 'on' });
      resolve();
    };
    s.onerror = () => reject(new Error('adsense load failed'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function showRealAd(): Promise<AdOutcome> {
  return loadAdSense()
    .then(
      () =>
        new Promise<AdOutcome>((resolve) => {
          let finished = false;
          const done = (o: AdOutcome) => {
            if (!finished) {
              finished = true;
              resolve(o);
            }
          };
          // 広告が出なければ、adBreakDone だけが呼ばれる（beforeReward は呼ばれない）
          window.adBreak!({
            type: 'reward',
            name: 'rune_stone',
            beforeReward: (showAdFn) => showAdFn(),
            adViewed: () => done('viewed'),
            adDismissed: () => done('dismissed'),
            adBreakDone: (info) => {
              if (info.breakStatus === 'viewed') done('viewed');
              else if (info.breakStatus === 'dismissed') done('dismissed');
              else done('no_ad');
            },
          });
          // 念のため：30秒たっても、何も起きなければ、広告なしとして、閉じる
          window.setTimeout(() => done('no_ad'), 30000);
        })
    )
    .catch(() => 'error' as AdOutcome);
}

function showFakeAd(onProgress: (p: AdProgress) => void, signal?: AbortSignal): Promise<AdOutcome> {
  return new Promise((resolve) => {
    let left = FAKE_AD_SECONDS;
    onProgress({ secondsLeft: left });
    const timer = window.setInterval(() => {
      if (signal?.aborted) {
        window.clearInterval(timer);
        resolve('dismissed');
        return;
      }
      left -= 1;
      onProgress({ secondsLeft: left });
      if (left <= 0) {
        window.clearInterval(timer);
        resolve('viewed');
      }
    }, 1000);
  });
}

export function showRewardedAd(onProgress: (p: AdProgress) => void, signal?: AbortSignal): Promise<AdOutcome> {
  return isRealAdConfigured ? showRealAd() : showFakeAd(onProgress, signal);
}
