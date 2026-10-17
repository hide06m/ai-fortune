/**
 * ホーム画面のひとこと（時間帯ごと）と、診断のあとの占い師のひとこと感想
 */

import type { CharacterId } from '../types/character'
import type { IntroLine } from './characterIntros'

type TimeBand = 'morning' | 'day' | 'night'

const HOME_LINES: Record<CharacterId, Record<TimeBand, string[]>> = {
  0: {
    morning: ['おはよう。今日も、森は静かだよ', '朝のコーヒーが、ちょうど入ったところだ'],
    day: ['やあ。ひと休みしていくかい', '今日は何を視ようか。急がなくていい'],
    night: ['こんばんは。夜は、考えごとがはかどるね', 'ランプの灯りで、ゆっくり話そう'],
  },
  1: {
    morning: ['あら、おはよう。靴下の片方は見つかった？', 'おはよう。朝のお茶は、ぬるめがいいのよ'],
    day: ['いらっしゃい。ちょうど、お茶が冷めたところ', 'フフ、来てくれたのね。どんな話をしましょうか'],
    night: ['こんばんは。夜更かしは、ほどほどにね', '今夜は、ゆっくり話を聞かせてちょうだい'],
  },
  2: {
    morning: ['……おはよう。朝の光は、星の名残ね', '空は、もう明るいのね。早起きだこと'],
    day: ['昼の星は、見えないだけで、そこにあるのよ', 'いらっしゃい。今日の空は、どうだった？'],
    night: ['今夜は、星がよく見えるわ', '夜は、わたしの時間。ゆっくりしていって'],
  },
  3: {
    morning: ['ふむ、早いな。朝の手は、まだ温まっておらん', '朝の空気は、よい。まあ座れ'],
    day: ['来たか。手を見せたくなったら、言うがいい', '昼は、巻物を干す時間だ。話し相手には、なってやろう'],
    night: ['夜は、手の線が静かに見える。座るがいい', '遅いな。まあ、よい。茶でも飲め'],
  },
  4: {
    morning: ['おはよう！今日も、いい日になりそうだね', 'あ、おはよう！朝から会えて、うれしいな'],
    day: ['わあ、来てくれたんだ！今日は何しようか', 'ねえねえ、何か気になることはある？'],
    night: ['こんばんは！夜のおしゃべりも、いいよね', '今日はどんな一日だった？聞かせて！'],
  },
}

/** 日本時間の時間帯（4〜11時＝朝、11〜17時＝昼、それ以外＝夜） */
function timeBandJst(now: Date = new Date()): TimeBand {
  const h = new Date(now.getTime() + 9 * 3600 * 1000).getUTCHours()
  if (h >= 4 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'day'
  return 'night'
}

/** ホーム画面で、その占い師が話すひとこと（直前と同じにならないよう、prev を渡す） */
export function pickHomeLine(characterId: CharacterId, prev?: string): string {
  const pool = HOME_LINES[characterId][timeBandJst()]
  const choices = pool.filter((l) => l !== prev)
  const list = choices.length ? choices : pool
  return list[Math.floor(Math.random() * list.length)]
}

const AFTER_RESULT: Record<CharacterId, IntroLine[][]> = {
  0: [
    [{ text: 'ふむ。いい話を、聞かせてもらったよ', image: 'ham002' }, { text: 'また、いつでも来るといい。ここは、君の席だ', image: 'ham004' }],
    [{ text: '結果は、答えじゃなくて、手がかりだ', image: 'ham001' }, { text: '気になったところから、ゆっくり考えてみてほしい', image: 'ham002' }],
    [{ text: '視えたものは、君の輪郭の、ほんの一部さ', image: 'ham002' }, { text: '続きは、また今度。コーヒーを淹れておくよ', image: 'ham004' }],
  ],
  1: [
    [{ text: 'フフフ、どうだったかしら。当たるも八卦、でも気は楽になったでしょう？', image: 'natsume004' }, { text: 'また、お茶でも飲みに来てちょうだいね', image: 'natsume003' }],
    [{ text: '気になったところだけ、覚えておけばいいのよ', image: 'natsume002' }, { text: '全部を信じなくても、ちゃんと役に立つから', image: 'natsume003' }],
    [{ text: 'お疲れさま。少し、息をつきなさいな', image: 'natsume004' }, { text: 'また聞かせてね、アナタの話を', image: 'natsume003' }],
  ],
  2: [
    [{ text: '……星は、答えを急がないわ', image: 'tsuki002' }, { text: 'また、空を見上げたくなったら、来てちょうだい', image: 'tsuki003' }],
    [{ text: '今日の話は、そっと胸にしまっておいて', image: 'tsuki001' }, { text: '必要なときに、ひとりでに思い出すものよ', image: 'tsuki003' }],
    [{ text: '読み解けたのは、巡りのほんの一節', image: 'tsuki002' }, { text: '続きは、次の夜に', image: 'tsuki001' }],
  ],
  3: [
    [{ text: 'ふむ。儂が言えるのは、ここまでだ', image: 'kokuu002' }, { text: '先は、おまえさんが歩くものだ。また来るがいい', image: 'kokuu001' }],
    [{ text: '線は、嘘をつかん。だが、決めるのは、おまえさんだ', image: 'kokuu001' }, { text: '気が向いたら、また見せに来い', image: 'kokuu003' }],
    [{ text: 'よく聞いたな。それで十分だ', image: 'kokuu002' }, { text: '茶でも飲んで、ひと息つくがいい', image: 'kokuu001' }],
  ],
  4: [
    [{ text: 'どうだった？気になるところ、あった？', image: 'kuri001' }, { text: 'また遊びに来てね！待ってるよ', image: 'kuri003' }],
    [{ text: '結果、ちょっと意外だった？それも、いいよね', image: 'kuri002' }, { text: 'また、いろいろ話そうね！', image: 'kuri003' }],
    [{ text: 'ありがとう、最後まで付き合ってくれて！', image: 'kuri003' }, { text: '次は、別の診断も、やってみようよ', image: 'kuri002' }],
  ],
}

/** 診断の結果を見たあとに、その占い師が話すひとこと感想（2セリフ） */
export function pickAfterResultLines(characterId: CharacterId): IntroLine[] {
  const v = AFTER_RESULT[characterId]
  return v[Math.floor(Math.random() * v.length)]
}
