/**
 * 初回ログイン（サインアップ）チュートリアルの台本データ
 *
 * 設計方針：演出パターン（ナレーション／セリフ／アイテム表示／画面遷移）が多いため、
 * JSXに直接書かず「ただのデータ」として定義する。台詞の追加・修正・キャラ表情の
 * 差し替えは、このファイルの配列を編集するだけで完結し、コンポーネント側（App.tsx）
 * を触る必要はない。再生ロジックは App.tsx 側の汎用プレイヤーが担当する。
 */

export type TutorialCharacter = 'musubi' | 'natsume' | 'tsuki' | 'kokuu' | 'kuri'

export interface TutorialStepNarration {
  type: 'narration'
  text: string
  // trueの場合、「。」で分割せず全文を一度に表示する（分割すると不自然になる場合の逃げ道）
  noSplit?: boolean
}

export interface TutorialStepDialogue {
  type: 'dialogue'
  character: TutorialCharacter | null
  // キャラクター画像のファイル名（拡張子なし）。/assets/characters/{0-musubi|1-natsume}/{image}.webp を参照する
  image: string | null
  speaker: string | null
  text: string
  // trueの場合、「。」で分割せず全文を一度に表示する（分割すると不自然になる場合の逃げ道）
  noSplit?: boolean
}

export interface TutorialStepItemReveal {
  type: 'itemReveal'
  image: string // /assets/ 以下の画像パス（アイテム本体）
  // クリックでアイテム表示を閉じ、そのまま次のステップへ進む（キャプションは後続のdialogueステップ側で持つ）
}

export interface TutorialStepHandoff {
  type: 'handoff'
  action: 'doorKnock' | 'gotoForm'
}

export type TutorialStep =
  | TutorialStepNarration
  | TutorialStepDialogue
  | TutorialStepItemReveal
  | TutorialStepHandoff

/**
 * Segment A: 大木の前でのナレーション（キャラなし、中央揃え）。
 * 最後にドアをクリックしてもらうため handoff: doorKnock で締める。
 */
export const TUTORIAL_INTRO_STEPS: TutorialStep[] = [
  { type: 'narration', text: '― 気が付くと、私たちはどこでもない深い森の中にいて、その中央にはまるで古い記憶のように大きな木が立っていた ―' },
  { type: 'narration', text: 'その根元には、長い年月を経ているはずなのに奇妙に手入れの行き届いた木のドアがあって、向こう側からかすかに、何かが擦れるような音が聞こえてくる。' },
  { type: 'narration', text: '私たちは、特に深く考えることもなく、あるいはそうすることがあらかじめ決まっていたかのように、吸い込まれるようにドアを叩いた。' },
  { type: 'handoff', action: 'doorKnock' },
]

/**
 * Segment B: ドアが開いた後、ムスビ・ナツメとの出会い。
 * 最後は入力フォームへ handoff。
 */
export const TUTORIAL_MEETING_STEPS: TutorialStep[] = [
  { type: 'dialogue', character: 'musubi', image: 'ham001', speaker: null, text: 'いらっしゃい' },
  { type: 'dialogue', character: 'musubi', image: 'ham001', speaker: null, text: 'おや、人が来るのは久しぶりだね' },
  { type: 'dialogue', character: 'musubi', image: 'ham003', speaker: null, text: 'はじめまして。見慣れない顔だね。ここは占いの館、あるいはただの通り道さ。ボクはここの案内人の"ムスビ"。君の心をほんの少しだけ照らす灯りになれればいいと思っているけれど、名前なんてものはこの森ではコーヒー一杯分の価値もないよ。よろしくね' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'ボクたちは、あらゆる世界の歴史や、使い捨てのライターの構造、あるいは過去の過ちについて研究しているんだ' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'ここには時々迷いや悩みを持った人々を引き寄せられるようにやってくる' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'キミみたいにね' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: '研究の傍ら、そんな人たちを導くための手助けをしているんだ' },
  { type: 'dialogue', character: 'musubi', image: 'ham004', speaker: 'ムスビ', text: '占いでね' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: '話が長くなったね、キミも占っていくだろう？' },
  { type: 'dialogue', character: 'natsume', image: 'natsume001', speaker: 'ムスビ', text: 'うちの占術師を紹介するよ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume001', speaker: 'ムスビ', text: '彼女はナツメ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume004', speaker: 'ナツメ', text: 'はじめまして、私はナツメ。見ての通り、ただここに身を置いているだけの小さな生き物よ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: '古い井戸の底から、乾いた風をすくい上げるような仕事をしているわ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: '特に古いものと、行き場をなくした靴下を扱うのは得意だから、何かあればいつでも言ってね' },
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: '挨拶代わりに占ってみましょうか' },
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: 'アナタのことを教えてくれます？' },
  { type: 'handoff', action: 'gotoForm' },
]

/**
 * Segment C: 診断結果を見た後のフォロー（ナツメ→ルーンストーン表示→ムスビ）。
 */
export const TUTORIAL_AFTER_RESULT_STEPS: TutorialStep[] = [
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: 'フフフ、どうだったかしら？いつでも相談してね' },
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: 'そうだ、これを' },
  { type: 'itemReveal', image: '/assets/stone.webp' },
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: 'それはルーンストーン、また相談したいときはその石をつかってちょうだい' },
  { type: 'dialogue', character: 'natsume', image: 'natsume011', speaker: 'ナツメ', text: '今日はありがとうね' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'どうだった？ 何かにぶつかった時は彼女に相談するといいよ。今は留守にしているけれど、この館には他にも奇妙で、少しばかり風変わりな同居人たちがいるんだ。また来る機会があれば、いずれ引き合わせるよ' },
]

/**
 * 新キャラクターとの「初対面イベント」台本。
 * ナツメと違い、ムスビの紹介は挟まず、解放条件が揃った次のアクセス時に
 * 本人と偶然出くわした体で自己紹介が始まる（キャラ選択画面に入る直前に一度だけ再生）。
 */
export const TSUKI_MEETING_STEPS: TutorialStep[] = [
  { type: 'narration', text: '廊下の奥、普段は静まり返っている部屋の扉が、その日はうっすらと開いていた。覗き込むと、窓辺の淡い光の中に、見慣れない影があった。' },
  { type: 'dialogue', character: 'tsuki', image: 'tsuki001', speaker: 'ツキ', text: 'あら' },
  { type: 'dialogue', character: 'tsuki', image: 'tsuki002', speaker: 'ツキ', text: '新しい来訪者の気配がすると思ったら、当たっていたようね' },
  { type: 'dialogue', character: 'tsuki', image: 'tsuki001', speaker: 'ツキ', text: 'わたしはツキ。星の巡りを読む占い師よ。この館にはずいぶん長く住んでいるけれど、顔を合わせるのは意外と久しぶりね' },
  { type: 'dialogue', character: 'tsuki', image: 'tsuki003', speaker: 'ツキ', text: 'あなたが生まれた瞬間、空にはどんな星が瞬いていたのかしら。よかったら、今度聞かせてちょうだい' },
]

export const KOKUU_MEETING_STEPS: TutorialStep[] = [
  { type: 'narration', text: '古い本棚の奥、埃を被った巻物の山の陰から、低く落ち着いた声がした。' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu001', speaker: 'コクウ', text: 'ほう……' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu002', speaker: 'コクウ', text: '珍しい気配だ。この館に長く暮らしているが、新しい顔を見るのは久方ぶりでな' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu001', speaker: 'コクウ', text: '儂はコクウ。古くからの占術を扱う者だ。伊達に長く生きてはおらんつもりだが、まあそれは追い追い分かるだろう' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu003', speaker: 'コクウ', text: '厳しいことも言うかもしれんが、悪気はない。困ったことがあれば、いつでも訪ねてくるといい' },
]

export const KURI_MEETING_STEPS: TutorialStep[] = [
  { type: 'narration', text: '廊下を歩いていると、明るい声に呼び止められた。' },
  { type: 'dialogue', character: 'kuri', image: 'kuri001', speaker: 'クリ', text: 'あ、もしかして……はじめまして？' },
  { type: 'dialogue', character: 'kuri', image: 'kuri002', speaker: 'クリ', text: 'わたしはクリ。ここでみんなの話を聞くのが得意なんだ。なんでも話してね、ちゃんと最後まで聞くから' },
  { type: 'dialogue', character: 'kuri', image: 'kuri003', speaker: 'クリ', text: 'みんな最初はちょっと緊張するみたいだけど、すぐ慣れると思うよ。これからよろしくね！' },
]
