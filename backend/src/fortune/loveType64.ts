/**
 * ラブタイプ診断64（Love Character 64 準拠）計算ロジック
 * クリ専用の占術その2。MBTI同様、生年月日ではなく設問への回答から性格タイプを算出する
 */

export type LoveAxis = 'LF' | 'CA' | 'PR' | 'OE' | 'VN' | 'DI'

export interface LoveQuestion {
  id: number
  axis: LoveAxis
  reversed: boolean
  starred: boolean
  text: string
  left: string
  right: string
}

export interface LoveAnswer {
  id: number // 質問ID
  val: number // 0-5（ハート4段階なら 0,1,4,5 のいずれかを送る）
}

export interface LoveType64Result {
  type1: string // LF+CA+PR+OE（ベース16タイプ）
  type2: string // VN+DI（恋愛固有の4分類）
  fullType: string // 例: "LCPO-VI"
  scores: Record<LoveAxis, number>
  characterName: string
  characterDesc: string
  subTypeName: string
  subTypeTagline: string
  subTypeTraits: string[]
}

const AXES: LoveAxis[] = ['LF', 'CA', 'PR', 'OE', 'VN', 'DI']
// 選択肢インデックス(0-5)ごとの配点。UIはこのうち0,1,4,5の4段階のみを使う想定
const SCORE_WEIGHTS = [-4, -2, -1, 1, 2, 4]

export interface LoveBaseCharacter {
  name: string
  description: string
}

export interface LoveSubType {
  name: string
  tagline: string
  traits: string[]
}

// ベース16キャラクター（LF+CA+PR+OE の4文字で決まる）
export const LOVE_BASE_CHARACTERS: Record<string, LoveBaseCharacter> = {
  LCRO: { name: 'ボス猫', description: '自分のペースを崩さない「ボス猫」。我が道をゆくエネルギーに溢れており、唯一無二の魅力を秘めています。意外と繊細な一面も。' },
  LCRE: { name: '隠れベイビー', description: '誠実で信頼されている「隠れベイビー」。意外と天然で不器用な一面も持っていて、そのギャップで周囲を惹きつけ、自然と好かれる存在です。' },
  LCPO: { name: '主役体質', description: '自然と目立ち、周りに影響を与える「主役体質」。世渡り上手で華やかな人ですが、悩みをみんなに見せずに生き抜くような一面も持っている人です。' },
  LCPE: { name: 'ツンデレヤンキー', description: '元気で子どもっぽいけど、仲間思いで情に厚い「ツンデレヤンキー」。常に大事な人にたくさんの愛を与え、そして同じくらい自らも愛を欲しています。' },
  LARO: { name: '憧れの先輩', description: '大人っぽくてさっぱりした性格の「憧れの先輩」。自分のペースで自由に生きててもいつのまにか信頼を獲得している不思議な人です。' },
  LARE: { name: 'カリスマバランサー', description: 'リーダーシップの中にバランス感覚を仕込んでいる「カリスマバランサー」。人間性が素晴らしく頼りになります。人に弱みを見せるのは少し苦手。' },
  LAPO: { name: 'パーフェクトカメレオン', description: '多面性と完璧さをあわせ持つ「パーフェクトカメレオン」。普段はマイワールドの中に生きているのに、スイッチが入ると急に本領を発揮します。' },
  LAPE: { name: 'キャプテンライオン', description: '優しさと強さを兼ね備えた「キャプテンライオン」。器がでかく人間味があり、どんな立場でもどんな人相手でも自分の力を発揮できます。' },
  FCRO: { name: 'ロマンスマジシャン', description: '魔法使いのように人との距離感をつかむのが上手な「ロマンスマジシャン」。人間観察能力に優れ、生きるセンスを持っています。' },
  FCRE: { name: 'ちゃっかりうさぎ', description: '人懐っこさと冷静さを武器に生きる「ちゃっかりうさぎ」。優れた感性を持ち危機察知能力が高く、素敵な恋人を見つけられる可能性が高い人です。' },
  FCPO: { name: '恋愛モンスター', description: 'お調子者の愛されキャラである「恋愛モンスター」。恋に忙しく気分屋ですが根本の性格が優しく、人を愛し人に愛され生きていきます。' },
  FCPE: { name: '忠犬ハチ公', description: '素直で人懐っこい「忠犬ハチ公」。純粋で全体的にかわいい人ですが、仕事は真面目で頼りになります。感情豊かで、人を愛する力が強い人です。' },
  FARO: { name: '不思議生命体', description: '一見ふつうだけど、独特な個性を持つ「不思議生命体」。周りに合わせながらも自分だけの世界観を持っており、みんなが気になる存在です。' },
  FARE: { name: '敏腕マネージャー', description: '冷静で人を見る目があり、周りをうまく支える「敏腕マネージャー」。どんな人ともうまく付き合えますが振り回されすぎないバランス感覚を持っています。' },
  FAPO: { name: 'デビル天使', description: '優しさと自由のハイブリッドである「デビル天使」。普段は天使のような性格の良さの中に潜む予想外の自由さ。そのギャップが魅力です。' },
  FAPE: { name: '最後の恋人', description: '優しくて包容力があり、どこか儚い雰囲気を持つ「最後の恋人」。純粋で最も性格のいいタイプであり、"令和のマザーテレサ"とも呼ばれています。' },
}

// 追加4系統属性（VN+DI の2文字で決まる）
export const LOVE_SUB_TYPES: Record<string, LoveSubType> = {
  VD: {
    name: '溺愛系',
    tagline: '未来を大事にする × 寄り添い型',
    traits: ['恋は将来込みで考えやすい', '愛情表現が濃く、相手を大切にしたい', '不安になりやすい分、安心の設計が鍵'],
  },
  VI: {
    name: '堅実系',
    tagline: '未来を大事にする × 自立・安定型',
    traits: ['誠実で、関係を育てるのが得意', '計画的で、信頼を積み上げる恋', 'ベタつきすぎず、長続きしやすい'],
  },
  ND: {
    name: '魅惑系',
    tagline: '今を大事にする × 寄り添い型',
    traits: ['感情やときめきで恋が動く', '愛され力が強く、空気を甘くできる', 'その場の温度を上げるのが上手い'],
  },
  NI: {
    name: '自立系',
    tagline: '今を大事にする × 自立・自由型',
    traits: ['マイペースで、心地よい距離感が得意', '縛られない恋が向いている', '安心＝束縛ではないタイプ'],
  },
}

function getLoveTypeDetails(type1: string, type2: string): Pick<LoveType64Result, 'characterName' | 'characterDesc' | 'subTypeName' | 'subTypeTagline' | 'subTypeTraits'> {
  const character = LOVE_BASE_CHARACTERS[type1] ?? { name: type1, description: '' }
  const subType = LOVE_SUB_TYPES[type2] ?? { name: type2, tagline: '', traits: [] as string[] }
  return {
    characterName: character.name,
    characterDesc: character.description,
    subTypeName: subType.name,
    subTypeTagline: subType.tagline,
    subTypeTraits: subType.traits,
  }
}

export const LOVE_TYPE64_QUESTIONS: LoveQuestion[] = [
  { id: 1, axis: 'VN', reversed: true, starred: false, text: '恋人と付き合うとき、あなたが一番大事にしているのはどちら?', left: '一緒に過ごす「今の時間の楽しさ」やフィーリング', right: '「この人とどんな未来を築けるか」という安心感や将来性' },
  { id: 2, axis: 'VN', reversed: true, starred: true, text: 'たとえ「今はすごく好き」でも、将来が見えない相手だったらどうしますか？', left: '先のことより、今の"好き"を大事にして関係を続ける', right: 'どんなに好きでも、将来が見えないなら距離を置くと思う' },
  { id: 3, axis: 'VN', reversed: true, starred: false, text: '付き合いがスタートする時あなたはどちらのタイプ？', left: '好きや気になるという今の気持ちを大切にしたい', right: '付き合う前に、この関係がどこへ向かうかをある程度しっかり考えておきたい' },
  { id: 4, axis: 'DI', reversed: false, starred: true, text: '普通の人よりも、好きな人の一言で気分が大きく変わるタイプだと思う。', left: 'はい', right: 'いいえ' },
  { id: 5, axis: 'DI', reversed: false, starred: false, text: '好きな人が自分から離れてしまうことを想像すると、普通の人よりも強く不安を感じるタイプだ。', left: 'はい', right: 'いいえ' },
  { id: 6, axis: 'DI', reversed: false, starred: false, text: '恋人との距離感はどちらの方が心地いい？', left: '繋がっていたい', right: '仲良くしながらも、適度な距離がある方が心地いい' },
  { id: 7, axis: 'LF', reversed: false, starred: true, text: '恋愛において、自分が主導権を握りたいタイプだと思う', left: 'はい', right: 'いいえ' },
  { id: 8, axis: 'LF', reversed: true, starred: false, text: 'どちらかと言えば、恋人に合わせる方だ', left: 'はい', right: 'いいえ' },
  { id: 9, axis: 'LF', reversed: true, starred: false, text: '興味ないお店の買い物に付き合って欲しいと言われたら？', left: '相手が喜ぶなら行く！', right: '正直あんまり行きたくない' },
  { id: 10, axis: 'CA', reversed: false, starred: true, text: '恋人といる時はどちらの気持ちの方が強い', left: '甘えたい', right: '甘えられたい' },
  { id: 11, axis: 'CA', reversed: false, starred: false, text: 'ふとした時に思う恋人像は？', left: '自分を優しく受け止めてくれる人', right: '自分が守ってあげたくなる存在' },
  { id: 12, axis: 'CA', reversed: true, starred: false, text: '恋人のことを「子どもっぽくて可愛い」と感じることが多々ある', left: 'ある', right: 'ない' },
  { id: 13, axis: 'PR', reversed: true, starred: false, text: 'どちらかと言えば', left: '徐々に人を好きになる', right: '人を好きになる時は早い' },
  { id: 14, axis: 'PR', reversed: true, starred: false, text: '好きになった理由を論理的に説明できる方だ', left: 'はい', right: 'いいえ' },
  { id: 15, axis: 'PR', reversed: false, starred: true, text: 'あなたはどちらのタイプですか？', left: '「好き」という感情がすべて', right: '理想の人をしっかり考えて探したい' },
  { id: 16, axis: 'OE', reversed: true, starred: true, text: 'そもそも恋人がいる時は異性がいる場には行かない、もしくは行きたいと思わない。', left: 'はい', right: 'いいえ' },
  { id: 17, axis: 'OE', reversed: false, starred: false, text: '恋愛において自分はどちらの要素が強い？', left: '自由奔放', right: '真剣・真面目' },
  { id: 18, axis: 'OE', reversed: false, starred: false, text: 'あなたの恋愛スタイルは？', left: '自由でマイペースな恋愛スタイル', right: '相手にしっかり向き合う誠実なスタイル' },
]

/**
 * 回答から恋愛タイプ（64タイプ）を算出する
 */
export function calculateLoveType64(answers: LoveAnswer[]): LoveType64Result {
  const questionById = new Map(LOVE_TYPE64_QUESTIONS.map((q) => [q.id, q]))
  const scores: Record<LoveAxis, number> = { LF: 0, CA: 0, PR: 0, OE: 0, VN: 0, DI: 0 }
  const questionScores = new Map<number, number>()

  for (const { id, val } of answers) {
    const q = questionById.get(id)
    if (!q) continue
    if (!Number.isFinite(val) || val < 0 || val > 5) continue

    const score = SCORE_WEIGHTS[val] * (q.reversed ? -1 : 1)
    questionScores.set(id, score)
    scores[q.axis] += score
  }

  const letters: string[] = []
  for (const axis of AXES) {
    if (scores[axis] > 0) {
      letters.push(axis[1])
      continue
    }
    if (scores[axis] < 0) {
      letters.push(axis[0])
      continue
    }
    // 同点の場合は starred 設問の回答方向を優先する
    const starred = LOVE_TYPE64_QUESTIONS.find((q) => q.axis === axis && q.starred)
    const starScore = starred ? questionScores.get(starred.id) ?? 0 : 0
    letters.push(starScore > 0 ? axis[1] : axis[0])
  }

  const code = letters.join('')
  const type1 = code.slice(0, 4)
  const type2 = code.slice(4)

  return { type1, type2, fullType: `${type1}-${type2}`, scores, ...getLoveTypeDetails(type1, type2) }
}

/**
 * 外部サイトなどで診断済みのタイプコード（例: "LCPO-VI"）から直接結果を組み立てる
 * 設問回答がないため scores は全軸0とする
 */
export function buildLoveType64ResultFromType(fullType: string): LoveType64Result {
  const [type1raw, type2raw] = fullType.split('-')
  const type1 = (type1raw ?? '').toUpperCase()
  const type2 = (type2raw ?? '').toUpperCase()
  const scores: Record<LoveAxis, number> = { LF: 0, CA: 0, PR: 0, OE: 0, VN: 0, DI: 0 }
  return { type1, type2, fullType: `${type1}-${type2}`, scores, ...getLoveTypeDetails(type1, type2) }
}

const LOVE_TYPE1_VALUES = new Set(Object.keys(LOVE_BASE_CHARACTERS))
const LOVE_TYPE2_VALUES = new Set(Object.keys(LOVE_SUB_TYPES))

export function isValidLoveType64Code(fullType: string): boolean {
  const [type1, type2] = fullType.split('-')
  return !!type1 && !!type2 && LOVE_TYPE1_VALUES.has(type1.toUpperCase()) && LOVE_TYPE2_VALUES.has(type2.toUpperCase())
}
