/**
 * 姓名判断用の画数表を作る（Unicode の Unihan データから、常用漢字・人名用漢字の画数を取り出す）
 *
 * 使い方：  node scripts/build-kangxi-strokes.cjs <Unihanを展開したフォルダ>
 * 出力：    src/fortune/data/kangxiStrokes.json  （{ "漢字": 画数, ... }）
 *
 * 数え方は、姓名判断で最も広く使われる「旧字体（康熙字典の字体）で、部首は元の形の画数で数える」流儀：
 *   画数 ＝ 部首（康熙字典の214部首）の本来の画数 ＋ 部首を除いた残りの画数
 *   例：流（さんずい）… 水の4画 ＋ 7 ＝ 11、清 … 4 ＋ 8 ＝ 12、邊 … 辵の7画 ＋ …
 * 残りの画数は、Adobe-Japan1 の字形（kRSAdobe_Japan1_6）に基づく。
 * 常用漢字に、旧字体（kTraditionalVariant）がある場合は、旧字体の字形で数える（例：国 → 國 = 11画）。
 *
 * データの出典：Unicode Consortium の Unihan Database（Unicode のライセンスで、自由に利用できる）
 */

const fs = require('fs')
const path = require('path')

const dir = process.argv[2]
if (!dir) {
  console.error('Unihan を展開したフォルダを指定してください')
  process.exit(1)
}

const readLines = (f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter((l) => l && l[0] !== '#')

// 康熙字典の214部首の画数（部首番号 → 画数）。画数ごとの部首番号の範囲
const RADICAL_RANGES = [
  [1, 6, 1], [7, 29, 2], [30, 60, 3], [61, 94, 4], [95, 117, 5], [118, 146, 6], [147, 166, 7], [167, 175, 8],
  [176, 186, 9], [187, 194, 10], [195, 200, 11], [201, 204, 12], [205, 208, 13], [209, 210, 14], [211, 211, 15],
  [212, 213, 16], [214, 214, 17],
]
const radicalStrokes = (r) => {
  for (const [a, b, s] of RADICAL_RANGES) if (r >= a && r <= b) return s
  throw new Error('radical ' + r)
}

const adobe = new Map()
for (const l of readLines('Unihan_RadicalStrokeCounts.txt')) {
  const [u, k, v] = l.split('\t')
  if (k === 'kRSAdobe_Japan1_6') adobe.set(u, v)
}
const joyo = new Set()
const jin = new Set()
for (const l of readLines('Unihan_OtherMappings.txt')) {
  const [u, k] = l.split('\t')
  if (k === 'kJoyoKanji') joyo.add(u)
  if (k === 'kJinmeiyoKanji') jin.add(u)
}
// 常用漢字 → その旧字体（人名用漢字として登録されている異体字）。法務省の対応そのもの（kJinmeiyoKanji の「年:元の字」）
const oldFormOf = new Map()
for (const l of readLines('Unihan_OtherMappings.txt')) {
  const [u, k, v] = l.split('\t')
  if (k !== 'kJinmeiyoKanji') continue
  const m = /:(U\+[0-9A-F]+)/.exec(v)
  if (!m) continue
  if (!oldFormOf.has(m[1])) oldFormOf.set(m[1], [])
  oldFormOf.get(m[1]).push(u)
}

const toChar = (u) => String.fromCodePoint(parseInt(u.slice(2), 16))
const strokesOf = (u) => {
  const v = adobe.get(u)
  if (!v) return null
  const entries = v.split(' ').map((x) => x.split('+'))
  const e = entries.find((x) => x[0] === 'C') || entries[0]
  // e[2] は「部首.部首の字形の画数.残りの画数」
  const [radical, drawnRadical, residual] = e[2].split('.').map(Number)
  // 部首が略した形（氵・艹・辶・阝など）で書かれているときは、元の部首の画数で数える。
  // 逆に、字形の部首のほうが大きいとき（髙 など、部首そのものが変わった形）は、字形のとおりに数える
  return Math.max(radicalStrokes(radical), drawnRadical) + residual
}

const out = {}
const notes = []
// Adobe-Japan1 に字形がある漢字すべて（姓に使われる異体字なども引けるように）
for (const u of adobe.keys()) {
  const ch = toChar(u)
  if (!/\p{Script=Han}/u.test(ch)) continue
  // 常用漢字は、旧字体が1つに決まるときだけ、旧字体の字形で数える（複数あるときは、そのままの字形）
  const olds = joyo.has(u) ? (oldFormOf.get(u) || []).filter((x) => adobe.has(x)) : []
  const target = olds.length === 1 ? olds[0] : u
  const s = strokesOf(target)
  if (s === null) {
    notes.push('no data ' + ch)
    continue
  }
  out[ch] = s
}

// 旧字体そのもの（人名用漢字として登録されているもの）も、そのまま引けるようにしてある（jinmeiyō に含まれる）
const file = path.join(__dirname, '..', 'src', 'fortune', 'data', 'kangxiStrokes.json')
fs.mkdirSync(path.dirname(file), { recursive: true })
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.codePointAt(0) - b.codePointAt(0)))
fs.writeFileSync(file, JSON.stringify(sorted))
console.log('characters:', Object.keys(sorted).length, 'notes:', notes.length)
for (const sample of '山田中太郎花子佐藤鈴木渡辺邊髙橋斎齋國国流清海') {
  console.log(sample, sorted[sample] ?? '(none)')
}
