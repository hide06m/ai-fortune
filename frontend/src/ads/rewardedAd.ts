/**
 * 広告（リワード広告）の入口。いまは、広告ネットワークに未接続の「仮の広告」。
 *
 * 本物の広告（AdMob・AdSense など）をつなぐときは、showRewardedAd の中身だけを差しかえる。
 * 返す値：広告を最後まで見たら true、途中で閉じたら false。
 * ⚠️ 本番では、広告ネットワークのサーバー側の確認（SSV）も、必ず、組み込むこと
 * （画面の戻り値だけを信じると、広告を見ずに、石を増やせてしまう）。
 */

export interface AdProgress {
  /** 残り秒数（仮の広告の表示用） */
  secondsLeft: number;
}

const FAKE_AD_SECONDS = 5;

export function showRewardedAd(onProgress: (p: AdProgress) => void, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let left = FAKE_AD_SECONDS;
    onProgress({ secondsLeft: left });
    const timer = window.setInterval(() => {
      if (signal?.aborted) {
        window.clearInterval(timer);
        resolve(false);
        return;
      }
      left -= 1;
      onProgress({ secondsLeft: left });
      if (left <= 0) {
        window.clearInterval(timer);
        resolve(true);
      }
    }, 1000);
  });
}
