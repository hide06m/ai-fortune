/**
 * 撮影画像の簡易品質チェック（明るさ・ピント）
 * サーバーに送る前にブラウザ側だけで完結させる（AIモデル不要の軽量な画像処理）
 */

export interface ImageQualityResult {
  ok: boolean
  brightness: number // 0-255
  sharpness: number // ラプラシアン分散（値が大きいほどピントが合っている）
  reason?: 'dark' | 'blurry'
}

const BRIGHTNESS_THRESHOLD = 60 // これ未満は「暗い」と判定
const SHARPNESS_THRESHOLD = 25 // これ未満は「ピンボケ」と判定（要調整の初期値）

// 判定処理を軽くするため、小さくリサイズしたグレースケール画像で計算する
const ANALYSIS_WIDTH = 160

function toGrayscale(canvas: HTMLCanvasElement | HTMLVideoElement, width: number, height: number): Uint8ClampedArray {
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  const ctx = offscreen.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D context is not available')

  ctx.drawImage(canvas, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)

  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }
  return gray
}

function computeBrightness(gray: Uint8ClampedArray): number {
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  return sum / gray.length
}

// ラプラシアンフィルタ（エッジ検出）をかけた結果の分散＝ピントの合い具合の目安
function computeSharpness(gray: Uint8ClampedArray, width: number, height: number): number {
  const laplacian: number[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const value =
        -4 * gray[idx] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx - width] +
        gray[idx + width]
      laplacian.push(value)
    }
  }

  const mean = laplacian.reduce((a, b) => a + b, 0) / laplacian.length
  const variance = laplacian.reduce((a, b) => a + (b - mean) ** 2, 0) / laplacian.length
  return variance
}

/**
 * video要素またはcanvas要素の現在のフレームを解析し、明るさ・ピントの合い具合を判定する
 */
export function assessImageQuality(source: HTMLCanvasElement | HTMLVideoElement): ImageQualityResult {
  const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.height

  if (!sourceWidth || !sourceHeight) {
    return { ok: false, brightness: 0, sharpness: 0, reason: 'dark' }
  }

  const width = ANALYSIS_WIDTH
  const height = Math.round((sourceHeight / sourceWidth) * ANALYSIS_WIDTH)

  const gray = toGrayscale(source, width, height)
  const brightness = computeBrightness(gray)
  const sharpness = computeSharpness(gray, width, height)

  if (brightness < BRIGHTNESS_THRESHOLD) {
    return { ok: false, brightness, sharpness, reason: 'dark' }
  }
  if (sharpness < SHARPNESS_THRESHOLD) {
    return { ok: false, brightness, sharpness, reason: 'blurry' }
  }
  return { ok: true, brightness, sharpness }
}
