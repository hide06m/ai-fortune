/**
 * 個人利用の抽出データ（frontend/src/data/private/ 配下・git管理外）の型定義とローダー
 * ファイルが無い環境でもビルド・動作する（読み込めなければ null を返し、呼び出し側は表示を省く）
 */

export interface MBTIFullContentEntry {
  title: string
  text: string
  subLinks: unknown[]
}

export interface LoveCompatibilityEntry {
  type1_code: string
  type1_name: string
  type2_code: string
  type2_name: string
  score: number
  summary_japanese: string
  summary_chinese: string
}

interface Love64Database {
  approachDescriptions: Record<string, string>
  compatibilityMatrix: LoveCompatibilityEntry[]
}

export interface TextBlock {
  kind: 'heading' | 'paragraph'
  text: string
}

const mbtiLoaders = import.meta.glob('./private/mbti_full_content.json', { import: 'default' })
const loveLoaders = import.meta.glob('./private/love64_database.json', { import: 'default' })

let mbtiCache: Promise<Record<string, MBTIFullContentEntry> | null> | null = null
let loveCache: Promise<Love64Database | null> | null = null

function loadMBTIAll() {
  mbtiCache ??= (async () => {
    const loader = Object.values(mbtiLoaders)[0]
    if (!loader) return null
    const raw = (await loader()) as Record<string, MBTIFullContentEntry>
    // キーは URL（…/ja/intj型の性格）なので、4文字タイプコードに変換する
    const byType: Record<string, MBTIFullContentEntry> = {}
    for (const [url, entry] of Object.entries(raw)) {
      const m = decodeURIComponent(url).match(/\/([a-z]{4})型/i)
      if (m) byType[m[1].toUpperCase()] = entry
    }
    return byType
  })().catch(() => null)
  return mbtiCache
}

function loadLoveAll() {
  loveCache ??= (async () => {
    const loader = Object.values(loveLoaders)[0]
    if (!loader) return null
    return (await loader()) as Love64Database
  })().catch(() => null)
  return loveCache
}

/** 空白だらけの原文を、見出し（短い行）と段落に整形する */
function toBlocks(text: string): TextBlock[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => ({
      kind: l.length <= 24 && !/[。、！？]/.test(l) ? ('heading' as const) : ('paragraph' as const),
      text: l,
    }))
}

/** 性格診断：4文字タイプ（例 "INTJ"）の長文解説 */
export async function loadMBTIFullContent(coreType: string): Promise<TextBlock[] | null> {
  const all = await loadMBTIAll()
  const entry = all?.[coreType.toUpperCase()]
  return entry ? toBlocks(entry.text) : null
}

/** ラブタイプ診断：ベース4文字（例 "LCPO"）の「どんなアプローチに弱い？」解説 */
export async function loadLoveApproach(baseType: string): Promise<TextBlock[] | null> {
  const all = await loadLoveAll()
  const raw = all?.approachDescriptions?.[baseType]
  if (!raw) return null
  // 末尾の外部診断への宣伝文（「そんなあなたが今よりも…」以降）と、先頭の「① キャラ名」行は表示しない
  const cut = raw.split('そんなあなたが今よりも')[0]
  const lines = cut.split('\n').filter((l) => !/^[①-⑯]/.test(l.trim()))
  return toBlocks(lines.join('\n'))
}

/** ラブタイプ診断：64タイプ同士の相性（フルタイプ同士、例 "FAPE-ND" × "LCRO-VI"） */
export async function loadLoveCompatibility(a: string, b: string): Promise<LoveCompatibilityEntry | null> {
  const all = await loadLoveAll()
  // 2,080件 = 64×65/2 の片方向のみの収録なので、順序を入れ替えても検索する
  return (
    all?.compatibilityMatrix.find(
      (e) => (e.type1_code === a && e.type2_code === b) || (e.type1_code === b && e.type2_code === a),
    ) ?? null
  )
}

/** 相性診断の選択肢（64タイプ分のコードと名前） */
export async function loadLoveTypeOptions(): Promise<Array<{ code: string; name: string }>> {
  const all = await loadLoveAll()
  if (!all) return []
  const map = new Map<string, string>()
  for (const e of all.compatibilityMatrix) map.set(e.type1_code, e.type1_name)
  return [...map].map(([code, name]) => ({ code, name })).sort((x, y) => x.code.localeCompare(y.code))
}
