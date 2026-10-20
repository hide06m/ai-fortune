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

/** 新規登録ボーナスなど、石をもらったことを、枠つきの表示で、はっきり伝える（枚数は、サーバーから届いた値） */
export interface TutorialStepStoneGift {
  type: 'stoneGift'
}

export interface TutorialStepHandoff {
  type: 'handoff'
  action: 'doorKnock' | 'gotoForm'
}

export type TutorialStep =
  | TutorialStepNarration
  | TutorialStepDialogue
  | TutorialStepItemReveal
  | TutorialStepStoneGift
  | TutorialStepHandoff

/**
 * Segment A: 大木の前でのナレーション（キャラなし、中央揃え）。
 * 最後にドアをクリックしてもらうため handoff: doorKnock で締める。
 */
export const TUTORIAL_INTRO_STEPS: TutorialStep[] = [
  { type: 'narration', text: '― 気が付くと、わたしはどこでもない深い森の中にいて、その中央にはまるで古い記憶のように大きな木が立っていた ―' },
  { type: 'narration', text: 'その根元には、長い年月を経ているはずなのに奇妙に手入れの行き届いた木のドアがあって、向こう側からかすかに、何かが擦れるような音が聞こえてくる。' },
  { type: 'narration', text: 'わたしは、特に深く考えることもなく、あるいはそうすることがあらかじめ決まっていたかのように、吸い込まれるようにドアを叩いた。' },
  { type: 'handoff', action: 'doorKnock' },
]

/**
 * Segment B: ドアが開いた後、ムスビ・ナツメとの出会い。
 * 最後は入力フォームへ handoff。
 */
export const TUTORIAL_MEETING_STEPS: TutorialStep[] = [
  // 自己紹介まで、ムスビはフードをかぶって顔が隠れている（ham003）。「ボクはここの案内人のムスビ」でフードを脱ぐ（ham001）
  { type: 'dialogue', character: 'musubi', image: 'ham003', speaker: null, text: 'いらっしゃい' },
  { type: 'dialogue', character: 'musubi', image: 'ham003', speaker: null, text: 'おや、人が来るのは久しぶりだね' },
  { type: 'dialogue', character: 'musubi', image: 'ham003', speaker: null, text: 'ここは占いの館、あるいはただの通り道さ' },
  { type: 'dialogue', character: 'musubi', image: 'ham001', speaker: 'ムスビ', text: 'ボクはここの案内人の"ムスビ"。君の心をほんの少しだけ照らす灯りになれればいいと思っているけれど、名前なんてものはこの森ではコーヒー一杯分の価値もないよ。よろしくね' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'ボクたちは、あらゆる世界の歴史や、使い捨てのライターの構造、あるいは過去の過ちについて研究しているんだ' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'ここには時々迷いや悩みを持った人々を引き寄せられるようにやってくる' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'キミみたいにね' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: '研究の傍ら、そんな人たちを導くための手助けをしているんだ' },
  { type: 'dialogue', character: 'musubi', image: 'ham004', speaker: 'ムスビ', text: '占いでね' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: '話が長くなったね、キミも占っていくだろう？' },
  { type: 'dialogue', character: 'natsume', image: 'natsume001', speaker: 'ムスビ', text: 'うちの占術師を紹介するよ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume001', speaker: 'ムスビ', text: '彼女はナツメ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume004', speaker: 'ナツメ', text: 'はじめまして、私はナツメ。見ての通り、ただここに身を置いているだけの小さな生き物よ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: '古い井戸の底から、乾いた風をすくい上げるような仕事をしているわ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: '特に古いものと、行き場をなくした靴下を扱うのは得意だから、何かあればいつでも言ってね' },
  { type: 'dialogue', character: 'natsume', image: 'natsume004', speaker: 'ナツメ', text: '私の占いは、ふんわりして見えるけれど、ちゃんと根拠があるのよ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: '私が使うのは、四柱推命と、数秘術と、九星気学。どれも、アナタが生まれた日から読むのよ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: '知りたいのは、生まれた年と月と日。それから、わかれば、生まれた時間と、生まれた場所ね' },
  { type: 'dialogue', character: 'natsume', image: 'natsume003', speaker: 'ナツメ', text: '時間は、朝か夜かくらいの目安で大丈夫。わからなければ、わからないと言ってくれればいいわ' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: 'それと、いま気になっていることがあれば、それも聞かせてちょうだい' },
  { type: 'dialogue', character: 'natsume', image: 'natsume004', speaker: 'ナツメ', text: '初めて来てくれた人には、ルーンストーンを渡す決まりなの。はい、どうぞ' },
  { type: 'stoneGift' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: 'ルーンストーンは占いに使う石。私の占いなら、ひとつで足りるわ。残りは取っておいてね' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: '挨拶代わりに占ってみましょうか' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: 'アナタのことを教えてくれます？' },
  { type: 'handoff', action: 'gotoForm' },
]

/**
 * Segment C: 診断結果を見た後のフォロー（ナツメ→ルーンストーン表示→ムスビ）。
 */
export const TUTORIAL_AFTER_RESULT_STEPS: TutorialStep[] = [
  { type: 'dialogue', character: 'natsume', image: 'natsume004', speaker: 'ナツメ', text: 'フフフ、どうだったかしら？いつでも相談してね' },
  { type: 'dialogue', character: 'natsume', image: 'natsume002', speaker: 'ナツメ', text: 'また相談したいときは、その石をつかってちょうだい' },
  { type: 'dialogue', character: 'natsume', image: 'natsume003', speaker: 'ナツメ', text: '今日はありがとうね' },
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
  { type: 'dialogue', character: 'tsuki', image: 'tsuki002', speaker: 'ツキ', text: 'わたしの占いは二つ。ひとつは、西洋占星術。生まれた日と、時刻と、場所から、星の配置を読むの' },
  { type: 'dialogue', character: 'tsuki', image: 'tsuki001', speaker: 'ツキ', text: 'もうひとつは、宿曜占星術。こちらは、生まれた日だけでいいわ。旧い暦に直して、月の宿りを見るの' },
  { type: 'dialogue', character: 'tsuki', image: 'tsuki001', speaker: 'ツキ', text: '時刻や場所は、わからなければ、わからないでいいのよ。星は、急かさないもの' },
  { type: 'dialogue', character: 'tsuki', image: 'tsuki003', speaker: 'ツキ', text: 'あなたが生まれた日の空を、いつか聞かせてちょうだい' },
]

export const KOKUU_MEETING_STEPS: TutorialStep[] = [
  { type: 'narration', text: '古い本棚の奥、埃を被った巻物の山の陰から、低く落ち着いた声がした。' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu001', speaker: 'コクウ', text: 'ほう……' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu002', speaker: 'コクウ', text: '珍しい気配だ。この館に長く暮らしているが、新しい顔を見るのは久方ぶりでな' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu001', speaker: 'コクウ', text: '儂はコクウ。古くからの占術を扱う者だ。伊達に長く生きてはおらんつもりだが、まあそれは追い追い分かるだろう' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu002', speaker: 'コクウ', text: '儂の占いは二つある。ひとつは手相。見せてもらうのは、左の手のひらだ。写真に撮ってもらうことになる' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu001', speaker: 'コクウ', text: '明るい所で、手のひらを開いて、線がはっきり写るようにな。写真から、確かに読み取れた線しか、儂は語らん' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu002', speaker: 'コクウ', text: 'もうひとつは姓名判断。姓と名を、漢字で聞かせてもらう。ひらがなでも構わん。画数は、儂が数える' },
  { type: 'dialogue', character: 'kokuu', image: 'kokuu003', speaker: 'コクウ', text: '厳しいことも言うかもしれんが、悪気はない。困ったことがあれば、いつでも訪ねてくるといい' },
]

export const KURI_MEETING_STEPS: TutorialStep[] = [
  { type: 'narration', text: '廊下を歩いていると、明るい声に呼び止められた。' },
  { type: 'dialogue', character: 'kuri', image: 'kuri001', speaker: 'クリ', text: 'あ、もしかして……はじめまして？' },
  { type: 'dialogue', character: 'kuri', image: 'kuri002', speaker: 'クリ', text: 'わたしはクリ。ここでみんなの話を聞くのが得意なんだ。なんでも話してね、ちゃんと最後まで聞くから' },
  { type: 'dialogue', character: 'kuri', image: 'kuri002', speaker: 'クリ', text: 'わたしがやるのは、性格タイプ診断と、恋愛タイプ診断。どっちも、質問に答えていくだけだよ' },
  { type: 'dialogue', character: 'kuri', image: 'kuri001', speaker: 'クリ', text: '生まれた日とかは、いらないの。思ったままに答えてくれればいいからね' },
  { type: 'dialogue', character: 'kuri', image: 'kuri002', speaker: 'クリ', text: '診断のあとは、悩みや今の状況を聞かせてくれたら、タイプに合わせてお話しするよ。こっちは、ちょっとだけ石を使うけど' },
  { type: 'dialogue', character: 'kuri', image: 'kuri003', speaker: 'クリ', text: 'みんな最初はちょっと緊張するみたいだけど、すぐ慣れると思うよ。これからよろしくね！' },
]

/**
 * ムスビの解放イベント：解放条件が揃った直後（占い師選択に戻ったとき）に再生する。
 * 条件そのものは明かさず、匂わせるだけにする。
 */
export const MUSUBI_MEETING_STEPS: TutorialStep[] = [
  { type: 'narration', text: '館の奥の机で、ムスビが、積まれた紙の束を、ゆっくりとめくっていた。' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'ああ、君か。ちょうどいい' },
  { type: 'dialogue', character: 'musubi', image: 'ham001', speaker: 'ムスビ', text: 'みんなの話を聞いていたら、君の輪郭が、だいぶ見えてきてね。ボクの出番が、来たみたいだ' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: 'ボクがするのは、総合相談。これまでに君が視てもらった結果を、すべて読んだうえで、君の悩みや状況に、答えるんだ' },
  { type: 'dialogue', character: 'musubi', image: 'ham004', speaker: 'ムスビ', text: '知りたいのは、いま気になっていること。それだけでいい。あとは、君が集めてきた結果が、語ってくれる' },
  { type: 'dialogue', character: 'musubi', image: 'ham002', speaker: 'ムスビ', text: '視てもらった占いが多いほど、ボクの答えは、深くなる。ゆっくり、好きなだけ、みんなのところへ寄っていくといい' },
]
