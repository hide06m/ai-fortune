import { Howl } from 'howler'

// 音声オブジェクト
let treeswayLoop: Howl | null = null
let birdLoop: Howl | null = null
let bgmLoop: Howl | null = null
let knockSound: Howl | null = null
let doorOpenSound1: Howl | null = null
let doorOpenSound2: Howl | null = null

// 初期化
export function initAudio() {
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
export function stopAmbientLoop() {
  if (treeswayLoop && treeswayLoop.playing()) {
    treeswayLoop.fade(treeswayLoop.volume(), 0, 500, () => {
      treeswayLoop?.stop()
    })
  }
  if (birdLoop && birdLoop.playing()) {
    birdLoop.fade(birdLoop.volume(), 0, 500, () => {
      birdLoop?.stop()
    })
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
    treeswayLoop.fade(treeswayLoop.volume(), 0, 500, () => {
      treeswayLoop?.stop()
    })
  }
  if (birdLoop && birdLoop.playing()) {
    birdLoop.fade(birdLoop.volume(), 0, 500, () => {
      birdLoop?.stop()
    })
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

// すべての音を停止
export function stopAllAudio() {
  treeswayLoop?.stop()
  birdLoop?.stop()
  bgmLoop?.stop()
  knockSound?.stop()
  doorOpenSound1?.stop()
  doorOpenSound2?.stop()
}
