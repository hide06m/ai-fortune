import { Howl, Howler } from 'howler'

const FOREST_BGM_VOLUME = 0.2025

// 各音の基準の音量（音量スライダーが100%のときの音量）。実際の音量は、基準 × 利用者が決めた音量（0〜1）
const BASE_VOLUME = {
  treesway: 0.6,
  bird: 0.03,
  roomBgm: 0.6,
  forestBgm: FOREST_BGM_VOLUME,
  knock: 0.7,
  door: 0.35,
} as const

// 利用者が決めた音量（0〜1）。localStorageに保存する
let bgmVolume = 1
let seVolume = 1

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

// 設定（音量・ON/OFF）が変わったことを、ほかの音（ミニゲームのBGMなど）に知らせる
const prefListeners = new Set<() => void>()
export function subscribeAudioPrefs(cb: () => void): () => void {
  prefListeners.add(cb)
  return () => prefListeners.delete(cb)
}
function notifyPrefs() {
  prefListeners.forEach((cb) => cb())
}

// ミニゲームの間、館のBGMなどを、いったん止める（いま鳴っているものだけ。閉じたら、同じものを、再開する）
let duckedHowls: Howl[] = []
let duckCount = 0 // 重ねて呼ばれても、最初の1回で止め、最後の1回で戻す
export function duckMainBgm(on: boolean) {
  if (on) {
    if (duckCount++ === 0) {
      duckedHowls = [treeswayLoop, birdLoop, bgmLoop, forestBgmLoop].filter((h): h is Howl => !!h && h.playing())
      duckedHowls.forEach((h) => h.pause())
    }
  } else if (duckCount > 0 && --duckCount === 0) {
    // 途中からいきなり鳴らさず、頭から、フェードインで戻す
    duckedHowls.forEach((h) => {
      const target = h === bgmLoop ? BASE_VOLUME.roomBgm : h === forestBgmLoop ? BASE_VOLUME.forestBgm : h === birdLoop ? BASE_VOLUME.bird : BASE_VOLUME.treesway
      h.seek(0)
      h.volume(0)
      h.play()
      h.fade(0, target * bgmVolume, 800)
    })
    duckedHowls = []
  }
}

// ───── スマホで、スリープ・ホーム画面に戻る・ほかのアプリに切りかえる、のあと、音を戻す ─────
// ブラウザは、画面が見えない間、音の仕組み（AudioContext）を、止める。戻ったときに、自動では、再開しない（特に iPhone の Safari）。
// 戻ったとき・画面にさわったとき・音が鳴るべきときに、止まっていたら、再開する。
export function resumeAudio() {
  resumeAudioContext()
}
function resumeAudioContext() {
  const ctx = (Howler as unknown as { ctx?: AudioContext }).ctx
  if (ctx && ctx.state !== 'running') {
    ctx.resume().catch(() => undefined)
  }
}
if (typeof document !== 'undefined') {
  if (import.meta.env.DEV) (window as unknown as { __howler?: unknown }).__howler = Howler // 開発用：音の再開の確認
  const onBack = () => {
    // ほかのタブ・アプリに移ったあいだは、音を消す（Safari は、タブを移っても、鳴らし続ける）。戻ったら、元に戻す
    Howler.mute(document.visibilityState !== 'visible')
    if (document.visibilityState === 'visible') resumeAudioContext()
  }
  document.addEventListener('visibilitychange', onBack)
  window.addEventListener('pagehide', () => Howler.mute(true))
  window.addEventListener('pageshow', () => { Howler.mute(false); resumeAudioContext() })
  window.addEventListener('focus', resumeAudioContext)
  // 戻ってすぐは、ブラウザが、再開を認めないことがある。次に画面にさわったとき（指・クリック・キー）に、再開する
  for (const ev of ['pointerdown', 'touchend', 'keydown']) {
    window.addEventListener(ev, resumeAudioContext, { passive: true, capture: true })
  }
}

// initAudio() の多重初期化ガード。
// React StrictMode は開発時にマウント時のeffectを意図的に二重実行するため、
// ガード無しでは Howl インスタンスが2セットできてしまい、古い方が「誰にも
// 参照されないまま鳴り続ける／止められない」状態になる（BGMが不安定に途切れる原因）
let initialized = false

/** 保存された音量の文字列を 0〜1 にする（無い・不正なときは 1 = 基準のまま） */
function parseVolume(raw: string | null): number {
  if (raw === null) return 1
  const v = Number(raw)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
}

function loadAudioPrefs() {
  try {
    bgmMuted = localStorage.getItem('audio_bgm_muted') === 'true'
    seMuted = localStorage.getItem('audio_se_muted') === 'true'
    bgmVolume = parseVolume(localStorage.getItem('audio_bgm_volume'))
    seVolume = parseVolume(localStorage.getItem('audio_se_volume'))
  } catch {
    // localStorageが使えない環境ではデフォルト（ON）のまま
  }
}

// 設定パネル（SettingsButton）は、initAudio() より前に描画されて isBgmMuted() を読む。
// 保存済みの設定をここで先に読み込んでおかないと、BGMが実際はオフなのに、
// パネルが「BGM ON」と表示してしまい、利用者がオンにし直せなくなる
loadAudioPrefs()

export function isBgmMuted(): boolean {
  return bgmMuted
}

export function isSeMuted(): boolean {
  return seMuted
}

export function getBgmVolume(): number {
  return bgmVolume
}

export function getSeVolume(): number {
  return seVolume
}

/** BGMの音量（0〜1）を変える。保存し、いま鳴っている／これから鳴るBGMにも反映する */
export function setBgmVolume(volume: number) {
  bgmVolume = Math.min(1, Math.max(0, volume))
  try {
    localStorage.setItem('audio_bgm_volume', String(bgmVolume))
  } catch {
    // 保存できなくても今回のセッション内では反映される
  }
  treeswayLoop?.volume(BASE_VOLUME.treesway * bgmVolume)
  birdLoop?.volume(BASE_VOLUME.bird * bgmVolume)
  // ルーム・森のBGMは、鳴っていないときに音量を変えると、フェードインの出発点がずれるので、鳴っているときだけ即時反映する
  if (bgmLoop?.playing()) bgmLoop.volume(BASE_VOLUME.roomBgm * bgmVolume)
  if (forestBgmLoop?.playing()) forestBgmLoop.volume(BASE_VOLUME.forestBgm * bgmVolume)
  notifyPrefs()
}

/** 効果音の音量（0〜1）を変える。保存し、これから鳴る効果音に反映する */
export function setSeVolume(volume: number) {
  seVolume = Math.min(1, Math.max(0, volume))
  try {
    localStorage.setItem('audio_se_volume', String(seVolume))
  } catch {
    // 保存できなくても今回のセッション内では反映される
  }
  knockSound?.volume(BASE_VOLUME.knock * seVolume)
  doorOpenSound1?.volume(BASE_VOLUME.door * seVolume)
  doorOpenSound2?.volume(BASE_VOLUME.door * seVolume)
  notifyPrefs()
}

export function setBgmMuted(muted: boolean) {
  bgmMuted = muted
  try {
    localStorage.setItem('audio_bgm_muted', String(muted))
  } catch {
    // 保存できなくても今回のセッション内では反映される
  }
  ;[treeswayLoop, birdLoop, bgmLoop, forestBgmLoop].forEach((h) => h?.mute(muted))
  notifyPrefs()
}

export function setSeMuted(muted: boolean) {
  seMuted = muted
  try {
    localStorage.setItem('audio_se_muted', String(muted))
  } catch {
    // 保存できなくても今回のセッション内では反映される
  }
  ;[knockSound, doorOpenSound1, doorOpenSound2].forEach((h) => h?.mute(muted))
  notifyPrefs()
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
    volume: BASE_VOLUME.treesway * bgmVolume,
    fade: 500
  })

  // bird 背景音
  birdLoop = new Howl({
    src: ['/assets/bird001.mp3'],
    loop: true,
    volume: BASE_VOLUME.bird * bgmVolume,
    fade: 500
  })

  // ルーム背景音
  bgmLoop = new Howl({
    src: ['/assets/roombgm001.mp3'],
    loop: true,
    volume: BASE_VOLUME.roomBgm * bgmVolume,
    fade: 500
  })

  // 森の会話パート用BGM（既存BGMに重ねて小さめに再生）
  forestBgmLoop = new Howl({
    src: ['/assets/forestBGM001.mp3'],
    loop: true,
    volume: BASE_VOLUME.forestBgm * bgmVolume,
    fade: 800
  })

  // ノック音
  knockSound = new Howl({
    src: ['/assets/knock001.wav'],
    volume: BASE_VOLUME.knock * seVolume
  })

  // ドア開く音 1
  doorOpenSound1 = new Howl({
    src: ['/assets/doorOpen001.wav'],
    volume: BASE_VOLUME.door * seVolume
  })

  // ドア開く音 2
  doorOpenSound2 = new Howl({
    src: ['/assets/doorOpen002.wav'],
    volume: BASE_VOLUME.door * seVolume
  })

  // 保存済みのON/OFF設定を新しく作成したHowlインスタンスへ反映
  ;[treeswayLoop, birdLoop, bgmLoop, forestBgmLoop].forEach((h) => h?.mute(bgmMuted))
  ;[knockSound, doorOpenSound1, doorOpenSound2].forEach((h) => h?.mute(seMuted))
}

// ランディングページの背景音を開始
export function startAmbientLoop() {
  // 館のBGMが鳴っているときは、止める（トップ画面に戻ったとき、環境音と館のBGMが、同時に鳴らないように）
  for (const h of [bgmLoop, forestBgmLoop]) {
    if (h && h.playing()) {
      h.fade(h.volume(), 0, 500)
      setTimeout(() => h.stop(), 500)
    }
  }
  // フェードアウトで音量が0になったまま止まっていることがあるので、再生の前に、利用者の音量へ戻す
  if (treeswayLoop && !treeswayLoop.playing()) {
    treeswayLoop.volume(BASE_VOLUME.treesway * bgmVolume)
    treeswayLoop.play()
  }
  if (birdLoop && !birdLoop.playing()) {
    birdLoop.volume(BASE_VOLUME.bird * bgmVolume)
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
  resumeAudioContext()
  knockSound?.play()
}

// ドア開く音を再生
export function playDoorOpen() {
  // 音の後ろの5分の1を、切る。フェードアウトは、そのぶん前（全体の3割）から始めて、8割のところで終わる
  for (const h of [doorOpenSound1, doorOpenSound2]) {
    if (!h) continue
    const id = h.play()
    const total = h.duration() * 1000
    if (!total) continue
    const fadeStart = total * 0.3
    const end = total * 0.8
    window.setTimeout(() => {
      const from = BASE_VOLUME.door * seVolume
      h.fade(from, 0, end - fadeStart, id)
    }, fadeStart)
    window.setTimeout(() => h.stop(id), end)
  }
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

  // BGM をフェードイン（ミニゲームの間は、戻るときに、鳴らす）
  setTimeout(() => {
    // ミニゲームの間は、鳴らさず、閉じたときに鳴らす
    if (duckCount > 0 && bgmLoop && !duckedHowls.includes(bgmLoop)) {
      duckedHowls.push(bgmLoop)
      return
    }
    if (bgmLoop && !bgmLoop.playing()) {
      bgmLoop.volume(0)
      bgmLoop.play()
      bgmLoop.fade(0, BASE_VOLUME.roomBgm * bgmVolume, 500)
    }
  }, 500)
}

// 会話パート用の森BGMを既存BGMに重ねて小さめに再生開始
export function startForestBgmLayer() {
  if (forestBgmLoop && !forestBgmLoop.playing()) {
    forestBgmLoop.volume(0)
    forestBgmLoop.play()
    forestBgmLoop.fade(0, BASE_VOLUME.forestBgm * bgmVolume, 800)
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
