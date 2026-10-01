import { Howl } from 'howler'

const FOREST_BGM_VOLUME = 0.2025

// 音声オブジェクト
let treeswayLoop: Howl | null = null
let birdLoop: Howl | null = null
let bgmLoop: Howl | null = null
let forestBgmLoop: Howl | null = null
let knockSound: Howl | null = null
let doorOpenSound1: Howl | null = null
let doorOpenSound2: Howl | null = null

// BGM/SE の ON・OFF 設定（localStorageに永続化）
let bgmMuted = false
let seMuted = false

// initAudio() の多重初期化ガード。
// React StrictMode は開発時にマウント時のeffectを意図的に二重実行するため、
// ガード無しでは Howl インスタンスが2セットできてしまい、古い方が「誰にも
// 参照されないまま鳴り続ける／止められない」状態になる（BGMが不安定に途切れる原因）
let initialized = false

function loadAudioPrefs() {
  try {
    bgmMuted = localStorage.getItem('audio_bgm_muted') === 'true'
    seMuted = localStorage.getItem('audio_se_muted') === 'true'
  } catch {
    // localStorageが使えない環境ではデフォルト（ON）のまま
  }
}

export function isBgmMuted(): boolean {
  return bgmMuted
}

export function isSeMuted(): boolean {
  return seMuted
}

export function setBgmMuted(muted: boolean) {
  bgmMuted = muted
  try {
    localStorage.setItem('audio_bgm_muted', String(muted))
  } catch {
    // 保存できなくても今回のセッション内では反映される
  }
  ;[treeswayLoop, birdLoop, bgmLoop, forestBgmLoop].forEach((h) => h?.mute(muted))
}

export function setSeMuted(muted: boolean) {
  seMuted = muted
  try {
    localStorage.setItem('audio_se_muted', String(muted))
  } catch {
    // 保存できなくても今回のセッション内では反映される
  }
  ;[knockSound, doorOpenSound1, doorOpenSound2].forEach((h) => h?.mute(muted))
}

// 初期化
export function initAudio() {
  if (initialized) return
  initialized = true

  loadAudioPrefs()
  // treesway 背景音
  treeswayLoop = new Howl({
    src: ['/assets/treesway001.mp3'],
    loop: true,
    volume: 0.6,
    fade: 500
  })

  // bird 背景音
  birdLoop = new Howl({
    src: ['/assets/bird001.mp3'],
    loop: true,
    volume: 0.03,
    fade: 500
  })

  // ルーム背景音
  bgmLoop = new Howl({
    src: ['/assets/roombgm001.mp3'],
    loop: true,
    volume: 0.6,
    fade: 500
  })

  // 森の会話パート用BGM（既存BGMに重ねて小さめに再生）
  forestBgmLoop = new Howl({
    src: ['/assets/forestBGM001.mp3'],
    loop: true,
    volume: FOREST_BGM_VOLUME,
    fade: 800
  })

  // ノック音
  knockSound = new Howl({
    src: ['/assets/knock001.wav'],
    volume: 0.7
  })

  // ドア開く音 1
  doorOpenSound1 = new Howl({
    src: ['/assets/doorOpen001.wav'],
    volume: 0.7
  })

  // ドア開く音 2
  doorOpenSound2 = new Howl({
    src: ['/assets/doorOpen002.wav'],
    volume: 0.7
  })

  // 保存済みのON/OFF設定を新しく作成したHowlインスタンスへ反映
  ;[treeswayLoop, birdLoop, bgmLoop, forestBgmLoop].forEach((h) => h?.mute(bgmMuted))
  ;[knockSound, doorOpenSound1, doorOpenSound2].forEach((h) => h?.mute(seMuted))
}

// ランディングページの背景音を開始
export function startAmbientLoop() {
  if (treeswayLoop && !treeswayLoop.playing()) {
    treeswayLoop.play()
  }
  if (birdLoop && !birdLoop.playing()) {
    birdLoop.play()
  }
}

// 背景音を停止
// ⚠️ Howler の fade(from, to, duration, id) の第4引数は完了コールバックではなく
//   任意の sound id のため、フェード完了後の停止は setTimeout で行う
export function stopAmbientLoop() {
  if (treeswayLoop && treeswayLoop.playing()) {
    treeswayLoop.fade(treeswayLoop.volume(), 0, 500)
    setTimeout(() => treeswayLoop?.stop(), 500)
  }
  if (birdLoop && birdLoop.playing()) {
    birdLoop.fade(birdLoop.volume(), 0, 500)
    setTimeout(() => birdLoop?.stop(), 500)
  }
}

// ノック音を再生
export function playKnock() {
  knockSound?.play()
}

// ドア開く音を再生
export function playDoorOpen() {
  doorOpenSound1?.play()
  doorOpenSound2?.play()
}

// BGM ループに切り替え（フェード）
export function switchToRoomBGM() {
  // 環境音をフェードアウト
  if (treeswayLoop && treeswayLoop.playing()) {
    treeswayLoop.fade(treeswayLoop.volume(), 0, 500)
    setTimeout(() => treeswayLoop?.stop(), 500)
  }
  if (birdLoop && birdLoop.playing()) {
    birdLoop.fade(birdLoop.volume(), 0, 500)
    setTimeout(() => birdLoop?.stop(), 500)
  }

  // BGM をフェードイン
  setTimeout(() => {
    if (bgmLoop && !bgmLoop.playing()) {
      bgmLoop.volume(0)
      bgmLoop.play()
      bgmLoop.fade(0, 0.6, 500)
    }
  }, 500)
}

// 会話パート用の森BGMを既存BGMに重ねて小さめに再生開始
export function startForestBgmLayer() {
  if (forestBgmLoop && !forestBgmLoop.playing()) {
    forestBgmLoop.volume(0)
    forestBgmLoop.play()
    forestBgmLoop.fade(0, FOREST_BGM_VOLUME, 800)
  }
}

// 森BGMレイヤーを停止
export function stopForestBgmLayer() {
  if (forestBgmLoop && forestBgmLoop.playing()) {
    forestBgmLoop.fade(forestBgmLoop.volume(), 0, 800)
    setTimeout(() => forestBgmLoop?.stop(), 800)
  }
}

// すべての音を停止
export function stopAllAudio() {
  treeswayLoop?.stop()
  birdLoop?.stop()
  bgmLoop?.stop()
  forestBgmLoop?.stop()
  knockSound?.stop()
  doorOpenSound1?.stop()
  doorOpenSound2?.stop()
}
