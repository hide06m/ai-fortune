/**
 * 占い師を選んだあと、診断の入力に入る前に挟む、短い会話（占い師ごとに、言い回しを何種類か用意し、ランダムに選ぶ）
 * image は /assets/characters/{フォルダ}/{image}.webp（フォルダはキャラごと）
 */

import type { CharacterId } from '../types/character'
import { GIFT_SETS } from './giftGreetings'

export interface IntroLine {
  text: string
  image: string
}

type IntroVariant = IntroLine[]

const INTROS: Record<CharacterId, IntroVariant[]> = {
  0: [
    [
      { text: 'やあ。また会ったね', image: 'ham001' },
      { text: '今日は何を視ようか。いつも通り、肩の力は抜いてくれていい', image: 'ham002' },
      { text: '準備ができたら、そう言ってほしい', image: 'ham004' },
    ],
    [
      { text: 'おや、君か。コーヒーなら、あとで淹れよう', image: 'ham001' },
      { text: '占いというのは、案外、話すことそのものが半分なんだ', image: 'ham002' },
      { text: 'では、君の話を聞かせてもらおうか', image: 'ham004' },
    ],
    [
      { text: 'いらっしゃい。ちょうど、古い時計のねじを巻いていたところだ', image: 'ham002' },
      { text: '時間というのはね、巻かなければ進まないようでいて、巻いても勝手に進んでいく', image: 'ham001' },
      { text: 'さあ、君の時間を少しだけ覗かせてもらおう', image: 'ham004' },
    ],
  ],
  1: [
    [
      { text: 'あら、いらっしゃい。ちょうどお茶が冷めたところだったの', image: 'natsume002' },
      { text: '今日はどんなお話を聞かせてくれるのかしら', image: 'natsume004' },
      { text: 'ゆっくりでいいわ。アナタのことを教えてちょうだい', image: 'natsume003' },
    ],
    [
      { text: 'フフフ、来てくれたのね。待っていたわけじゃないけれど、嬉しいものね', image: 'natsume012' },
      { text: '焦らなくていいのよ。靴下の片方みたいに、探しものはたいてい近くにあるわ', image: 'natsume011' },
      { text: 'アナタのことを、少しずつ聞かせてくれる？', image: 'natsume011' },
    ],
    [
      { text: 'こんにちは。外は風が出ていたでしょう', image: 'natsume002' },
      { text: '私の占いは、ふんわりしているけれど、ちゃんと当たるのよ。たぶんね', image: 'natsume003' },
      { text: 'それじゃあ、始めましょうか', image: 'natsume004' },
    ],
  ],
  2: [
    [
      { text: 'いらっしゃい。今夜は、星の並びが少し静かね', image: 'tsuki001' },
      { text: 'あなたがここへ来ることも、きっと巡りのうちだったのでしょう', image: 'tsuki002' },
      { text: '生まれた日のことを、聞かせてもらえるかしら', image: 'tsuki003' },
    ],
    [
      { text: '……来たのね。空を見上げる時間はあった？', image: 'tsuki002' },
      { text: '星は急かさないわ。あなたも、ゆっくりでいいのよ', image: 'tsuki001' },
      { text: 'では、あなたの星の話を始めましょう', image: 'tsuki003' },
    ],
    [
      { text: 'ようこそ。遠い光は、いつも少し遅れて届くものよ', image: 'tsuki001' },
      { text: '今のあなたに届いている光を、一緒に読んでみましょうか', image: 'tsuki003' },
      { text: 'まずは、あなたのことを教えてちょうだい', image: 'tsuki002' },
    ],
  ],
  3: [
    [
      { text: 'ほう、来たか。まあ、座るがいい', image: 'kokuu001' },
      { text: '儂の占いは古く、少々回りくどい。だが、嘘はつかん', image: 'kokuu002' },
      { text: '手のひらを見せてもらおう。左の手だ', image: 'kokuu003' },
    ],
    [
      { text: '……よく来たな。手を洗ってきたか、などとは聞かんでおこう', image: 'kokuu002' },
      { text: '手は、その者が歩いてきた道を、黙って覚えているものだ', image: 'kokuu001' },
      { text: 'さて、左の手のひらを見せてくれ', image: 'kokuu003' },
    ],
    [
      { text: '来たな。茶なら自分で淹れるといい。儂は手を見るだけだ', image: 'kokuu001' },
      { text: '線は嘘をつかん。もっとも、読む者次第で、物言いは変わるがな', image: 'kokuu003' },
      { text: '遠慮はいらん。左の手のひらを、こちらへ', image: 'kokuu002' },
    ],
  ],
  4: [
    [
      { text: 'あ、来てくれたんだ！ちょうど誰か来ないかなって思ってたところ', image: 'kuri001' },
      { text: 'ゆっくりでいいからね。ちゃんと最後まで聞くから', image: 'kuri002' },
      { text: 'じゃあ、さっそく始めよう！', image: 'kuri003' },
    ],
    [
      { text: 'いらっしゃい！今日はどんな気分？', image: 'kuri002' },
      { text: 'うまく言葉にならなくても大丈夫。質問に、答えていくだけだから', image: 'kuri001' },
      { text: 'それじゃあ、はじめよう！', image: 'kuri003' },
    ],
    [
      { text: 'わあ、来てくれてありがとう！', image: 'kuri003' },
      { text: '正解なんてないから、思ったままに答えてね', image: 'kuri001' },
      { text: 'オイラも、どきどきしてきた。いくよ！', image: 'kuri002' },
    ],
  ],
}

/** コクウの姓名判断の入り（手相の「左手をこちらに」ではなく、名前を聞く） */
const KOKUU_SEIMEI_INTROS: IntroLine[][] = [
  [
    { text: 'ほう、来たか。まあ、座るがいい', image: 'kokuu001' },
    { text: '名は、親が最初に贈る言葉だ。画数には、その重みが宿る', image: 'kokuu002' },
    { text: 'さて、そなたの名を、聞かせてもらおう', image: 'kokuu003' },
  ],
  [
    { text: '……よく来たな。名というものは、一生ついて回る', image: 'kokuu002' },
    { text: '一文字ずつ数えていけば、見えてくるものもある', image: 'kokuu001' },
    { text: 'では、そなたの姓と名を、ここに書いてくれ', image: 'kokuu003' },
  ],
]

export function pickCharacterIntro(characterId: CharacterId, mode?: string): IntroLine[] {
  const variants = characterId === 3 && mode === 'seimei' ? KOKUU_SEIMEI_INTROS : INTROS[characterId]
  return variants[Math.floor(Math.random() * variants.length)]
}

/** その日の最初のログインで、ムスビが石を渡すときの一言（言い回しを何種類か。最後の一文で石を見せる） */
export const DAILY_BONUS_LINES = [
  '……ああ、そうだ。忘れるところだった。今日の分のルーンストーンを渡しておこう。ほら、受け取ってくれ。',
  'そうそう、これを。今日の分のルーンストーンだ。なくさないように、ポケットの奥にしまっておいてくれ。ほら。',
  '来てくれた礼に、といっては何だが、ルーンストーンをひとつ。今日の分だ。ほら、手を出して。',
  'ああ、ちょうどよかった。今日の分のルーンストーンを、まだ渡していなかったね。はい、どうぞ。',
  '毎日来てくれる君に、ささやかな贈り物だ。ルーンストーンをひとつ。ほら、受け取ってくれ。',
  'おっと、忘れるところだった。ルーンストーンだ、今日の分。大切に使ってくれるとうれしい。ほら。',
  '朝いちばんの井戸水みたいなものだよ。今日の分のルーンストーンだ。遠慮なく、持っていってくれ。',
  'そうだ、君に渡すものがあった。ルーンストーンをひとつ。今日のぶんだ。ほら、落とさないように。',
]

/** その占い師の、ちょっとした挨拶の返事（2セリフ）を、2,500通り（50×50）の中からランダムに選ぶ。材料は giftGreetings.ts */
export function pickGiftGreeting(characterId: CharacterId): IntroLine[] {
  const set = GIFT_SETS[characterId]
  const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]
  return [
    { text: pick(set.reactions), image: pick(set.images) },
    { text: pick(set.followups), image: pick(set.images) },
  ]
}

/** ちょっとした挨拶の返事の通り数（占い師ごと） */
export function giftGreetingVariantCount(characterId: CharacterId): number {
  const set = GIFT_SETS[characterId]
  return set.reactions.length * set.followups.length
}
