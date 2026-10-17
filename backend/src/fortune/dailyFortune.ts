/**
 * 今日の運勢（AIを使わず、計算だけで出す。毎日、安定して無料で出せる）
 *
 * 数秘術の「パーソナルデー」を使う：生年月日のライフパスナンバーに、今日の月・日を足して、1桁にしたもの。
 *   パーソナルデー ＝ 1桁に縮めた（ライフパス ＋ 今日の月 ＋ 今日の日）
 * パーソナルデーごとに、その日のテーマ・ひとこと・ラッキーカラーを決め、運の目安（★1〜5）は、
 * 表の基準値に、生年月日と曜日による小さなゆらぎ（−1〜+1）を足す。同じ人・同じ日は、何度見ても、同じ結果になる。
 * 医学・金銭の断定はせず、「傾向」として、前向きな言い方にする。
 */

export interface DailyFortune {
  /** 今日（日本時間）YYYY-MM-DD */
  day: string
  /** パーソナルデー（1〜9） */
  personalDay: number
  title: string
  message: string
  advice: string
  luckyColor: { name: string; hex: string }
  luckyNumber: number
  /** 運の目安（★1〜5） */
  stars: { total: number; love: number; work: number; money: number }
}

interface DayEntry {
  title: string
  message: string
  advice: string
  color: { name: string; hex: string }
  // 基準の★（総合・恋愛・仕事・金運）
  base: [number, number, number, number]
}

const DAYS: Record<number, DayEntry> = {
  1: {
    title: '始まりの日',
    message: '新しいことを、ひとつ始めるのに向いた日。小さな一歩でも、流れが、前へ動き出します。',
    advice: '迷っていたことに、まず、最初の一手だけ、手をつけてみましょう。',
    color: { name: 'あかるい赤', hex: '#e8534a' },
    base: [4, 3, 5, 3],
  },
  2: {
    title: '寄りそいの日',
    message: '人との調和が、うまくいく日。急がず、相手の話を聞くことで、思いがけない縁がつながります。',
    advice: '「ありがとう」を、ひとつ、多めに伝えてみて。',
    color: { name: 'やわらかな橙', hex: '#f2a65a' },
    base: [3, 5, 3, 3],
  },
  3: {
    title: 'ひらめきの日',
    message: '発想が、軽やかに広がる日。おしゃべりや、遊び心のある工夫が、運を呼びます。',
    advice: '頭に浮かんだアイデアは、小さくてもメモに残しておきましょう。',
    color: { name: 'たんぽぽ色', hex: '#f4d03f' },
    base: [4, 4, 3, 3],
  },
  4: {
    title: '土台を整える日',
    message: '地道な作業が、実を結ぶ日。足もとを固めることが、あとで、大きな安心になります。',
    advice: '先送りにしていた片づけや手続きを、ひとつだけ、終わらせましょう。',
    color: { name: '若草色', hex: '#7cb342' },
    base: [3, 2, 5, 4],
  },
  5: {
    title: '変化の日',
    message: '予定外の出来事が、新鮮な風を運んでくる日。柔軟に受け止めると、視野が広がります。',
    advice: 'いつもと違う道・店・やり方を、ひとつだけ試してみて。',
    color: { name: '空色', hex: '#4fc3f7' },
    base: [4, 4, 3, 4],
  },
  6: {
    title: 'いたわりの日',
    message: '身近な人や、自分自身を、大切にするほど、運が満ちる日。心のゆとりが、鍵になります。',
    advice: '温かい飲み物を用意して、ゆっくり、一息つく時間をとりましょう。',
    color: { name: 'さくら色', hex: '#f48fb1' },
    base: [4, 5, 2, 3],
  },
  7: {
    title: '内省の日',
    message: '静かに考えるほど、答えが見えてくる日。ひとりの時間が、直感を研ぎ澄ませます。',
    advice: '情報を見る時間を減らして、ひとりで考える時間を、少しだけ作って。',
    color: { name: '藤色', hex: '#9575cd' },
    base: [3, 2, 4, 2],
  },
  8: {
    title: '実りの日',
    message: '努力が、形になりやすい日。責任のある役割や、お金の話は、冷静に進めるとうまくいきます。',
    advice: '「やる」と決めたことは、今日のうちに、期限と数字を決めておきましょう。',
    color: { name: '金茶', hex: '#c9a24b' },
    base: [4, 3, 4, 5],
  },
  9: {
    title: '手放しの日',
    message: '区切りをつけるのに、ふさわしい日。手放すことで、次に入ってくる、新しい運のための場所ができます。',
    advice: '使っていないもの・気がかりな予定を、ひとつ、手放してみましょう。',
    color: { name: '深い青', hex: '#3f51b5' },
    base: [3, 3, 3, 3],
  },
}

const reduceToDigit = (n: number): number => {
  while (n > 9) n = String(n).split('').reduce((s, d) => s + Number(d), 0)
  return n
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayInJapan(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

export function computeDailyFortune(birthDate: string, day: string): DailyFortune | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!b || !d) return null
  const digitSum = (s: string) => s.split('').reduce((x, c) => x + Number(c), 0)
  const lifePath = reduceToDigit(digitSum(b[1]) + digitSum(b[2]) + digitSum(b[3]))
  const personalDay = reduceToDigit(lifePath + Number(d[2]) + Number(d[3]))
  const entry = DAYS[personalDay]

  // ゆらぎ：生年月日と日付と曜日から、決まった値（−1, 0, +1）を作る
  const weekday = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]))).getUTCDay()
  const wobble = (salt: number) => ((lifePath * 7 + personalDay * 3 + weekday * 5 + salt * 11) % 3) - 1
  const clamp = (v: number) => Math.max(1, Math.min(5, v))
  const [t, l, w, m] = entry.base
  return {
    day,
    personalDay,
    title: entry.title,
    message: entry.message,
    advice: entry.advice,
    luckyColor: entry.color,
    luckyNumber: personalDay,
    stars: { total: clamp(t + wobble(1)), love: clamp(l + wobble(2)), work: clamp(w + wobble(3)), money: clamp(m + wobble(4)) },
  }
}
