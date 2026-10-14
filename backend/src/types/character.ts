/**
 * キャラクター関連の型定義
 */

/**
 * キャラクター ID
 * 0: ムスビ（出迎え役）
 * 1: ナツメ（自然派占い師）
 * 2: ツキ（星占い師）
 * 3: コクウ（伝統占術師）
 * 4: クリ（親切系占い師）
 */
export type CharacterId = 0 | 1 | 2 | 3 | 4;

/**
 * キャラクター情報
 */
export interface Character {
  id: CharacterId;
  name: string;
  gender: 'male' | 'female';
  role: string;
  personality: string;
  voiceId: number; // VOICEVOX speaker ID
  imageFile: string; // ham0XX, ham1XX など
}

/**
 * ユーザーの親密度情報
 */
export interface CharacterIntimacy {
  id: number;
  userId: string;
  characterId: CharacterId;
  intimacyLevel: number; // 0-10（ハート数。intimacyPoints / INTIMACY_POINTS_PER_LEVEL の切り捨て）
  intimacyPoints: number; // 0-1000（ハート内の細かい進捗。%表示に使う）
  totalDiagnoses: number;
  lastDiagnosisDate: Date | null;
  unlockedAt: Date | null;
  metAt: Date | null; // 解放後の「初対面イベント」を再生済みならセットされる（unlockedAtとは別管理）
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 親密度ポイントの設計（ハート＋%表示のための細かい進捗管理）
 *
 * - intimacy_points（0-1000）を実体とし、intimacy_level（0-10、ハート数）は
 *   floor(intimacy_points / 100) として都度計算・保存する
 * - 本番の診断＝ハート1個分（100pt）まるまる進む「大きな一歩」
 * - 診断コストが高いキャラ（ツキ・コクウ・クリ）だけ、少量の石（GIFT_STONE_COST）で
 *   ハートの1/5（20pt）だけ進める「ちょっとした挨拶」を用意し、貯めている間も
 *   関係が完全に止まらないようにする
 */
export const INTIMACY_POINTS_PER_LEVEL = 100;
export const MAX_INTIMACY_POINTS = 10 * INTIMACY_POINTS_PER_LEVEL;
export const DIAGNOSIS_INTIMACY_POINTS = INTIMACY_POINTS_PER_LEVEL;
export const GIFT_INTIMACY_POINTS = 20;

/**
 * 【隠し要素】ムスビの親密度が上がるほど、他の占い師の親密度が上がりやすくなる（画面では、教えない）。
 * ムスビの親密度レベルごとの倍率：Lv1-2＝1.1倍、Lv3-4＝1.2倍、Lv5-6＝1.3倍、Lv7-8＝1.4倍、Lv9-10＝1.5倍
 */
export function musubiBoostMultiplier(musubiLevel: number): number {
  const step = Math.min(5, Math.ceil(Math.max(0, musubiLevel) / 2));
  return 1 + step * 0.1;
}

/**
 * 診断1回に必要なルーンストーン数（キャラごとに変える。解放の遅いキャラほど高価にして特別感を出す）
 */
export const DIAGNOSIS_STONE_COST: Record<CharacterId, number> = {
  0: 0, // ムスビは診断キャラではない（ドア挨拶のみ、石を消費しない）
  1: 1, // ナツメ：初期キャラ、気軽に相談できる
  2: 5, // ツキ
  3: 10, // コクウ：最も解放が遅く、最も高価
  4: 1, // クリ：タイプ診断（性格16・ラブ64。AIなし）1回あたり。悩み・状況の相談は KURI_CONSULT_STONE_COST
};

/** コクウの姓名判断に必要なルーンストーン数（手相は DIAGNOSIS_STONE_COST[3]＝10 個。姓名判断は、画像を使わないので、5個） */
export const SEIMEI_STONE_COST = 5;

/** ムスビの総合相談（全占い師の情報をまとめて相談）に必要なルーンストーン数 */
export const MUSUBI_STONE_COST = 10;

/** クリへの「悩み・状況の相談」（AIを使う）に必要なルーンストーン数。診断して相談する場合は、診断1＋相談3＝4個 */
export const KURI_CONSULT_STONE_COST = 3;

/** 「ちょっとした挨拶（ミニ贈り物）」に必要なルーンストーン数（固定） */
export const GIFT_STONE_COST = 1;

/**
 * 「ちょっとした挨拶」でお手軽に親密度を上げられるキャラ
 * （診断コストが高い＝会いに行く頻度が下がりがちなキャラだけを対象にする。
 * ナツメは診断自体が安く日常的な接点になるため対象外、ムスビは診断キャラではないため対象外）
 */
export const GIFT_ELIGIBLE_CHARACTERS: CharacterId[] = [0, 1, 2, 3, 4];

/**
 * 親密度レベルに基づく占術解放情報
 */
export interface IntimacyUnlock {
  level: number;
  characterId?: CharacterId;
  feature?: string;
}

/**
 * 占術タイプ
 */
export type DivinationType = 'bazi' | 'numerology' | 'kyusei' | 'palmistry' | 'compatibility';

/**
 * キャラクター定義（マスターデータ）
 */
export const CHARACTER_MASTER_DATA: Record<CharacterId, Character> = {
  0: {
    id: 0,
    name: 'ムスビ',
    gender: 'male',
    role: '出迎え役・メインキャラ',
    personality: '温かみのある長男肌、優しい',
    voiceId: 11, // 玄野武宏・男性
    imageFile: 'ham0',
  },
  1: {
    id: 1,
    name: 'ナツメ',
    gender: 'female',
    role: '初期占い師・自然派',
    personality: 'ふんわり癒しタイプ、親しみやすい、躊躇がない',
    voiceId: 2, // 四国めたん ノーマル・女性
    imageFile: 'ham1',
  },
  2: {
    id: 2,
    name: 'ツキ',
    gender: 'female',
    role: '星占い系占い師',
    personality: '神秘的、落ち着いた雰囲気、知識豊富',
    voiceId: 9, // 波音リツ・女性
    imageFile: 'ham2',
  },
  3: {
    id: 3,
    name: 'コクウ',
    gender: 'male',
    role: '伝統占術師',
    personality: '経験豊富な長老タイプ、厳格だが優しい',
    voiceId: 13, // 青山龍星・男性、低め
    imageFile: 'ham3',
  },
  4: {
    id: 4,
    name: 'クリ',
    gender: 'male',
    role: '親切系占い師',
    personality: '親切で親しみやすい、ユーザーの話をよく聞く',
    voiceId: 12, // 白上虎太郎 ふつう・男性
    imageFile: 'ham4',
  },
};

/**
 * 親密度レベルによる解放テーブル
 */
export const INTIMACY_UNLOCKS: IntimacyUnlock[] = [
  { level: 1, feature: 'basic' }, // 基本占術のみ
  { level: 3, characterId: 2 }, // ツキ解放
  { level: 5, characterId: 3 }, // コクウ解放
  { level: 7, characterId: 4 }, // クリ解放
  { level: 10, feature: 'special' }, // 特別イベント
];

/**
 * キャラクターの会話テンプレート
 */
export interface CharacterDialogues {
  greeting: string[]; // 挨拶パターン複数
  formStart: string;
  formInput: string;
  resultPresent: string;
  goodbye: string[];
}

/**
 * 案内役（ムスビ）がドアを開けるたびに話す会話
 * 親密度レベル（character_intimacy.intimacy_level, キャラID0）を「来館回数」として使い、
 * 初回／2〜9回目／10回目以降でセリフと表情画像を変える。
 */
export interface GuideGreeting {
  text: string;
  expression: 1 | 2 | 3 | 4; // frontend/public/assets/characters/0-musubi/ham00{n}.webp に対応（0は参考シートのため使用しない）
  noSplit?: boolean; // trueの場合、「。」で分割せず全文を一度に表示する
}

export const GUIDE_GREETINGS: {
  first: GuideGreeting;
  regular: GuideGreeting[];
  veteran: GuideGreeting[];
} = {
  first: {
    text: 'おや、見慣れない顔だね。ここは占いの館、あるいはただの通り道さ。君の心をほんの少しだけ照らす灯りになるかもしれないし、ならないかもしれない。さあ、入っておいで。',
    expression: 2,
  },
  regular: [
    { text: 'また来てくれたんだね。やれやれ、人生というのはなかなか思い通りには進まないものだ。今日はどんな風が吹いているかな。', expression: 1 },
    { text: 'いらっしゃい。君の顔、前回よりほんの少しだけ、古い新聞紙みたいな色味が薄れた気がするよ。', expression: 2 },
    { text: 'おかえり。今日も、スープが冷めるまでのあいだ、少し占いをしてみようか。', expression: 3 },
    { text: 'やあ。外の世界の雨はもう上がったかい？ ここには雨傘も長靴も必要ないけれどね。', expression: 4 },
    { text: 'いらっしゃい。君がドアをノックする音、少しずつ聞き分けられるようになってきたよ。', expression: 1 },
    { text: 'おや、今日は少し歩き疲れた顔をしているね。まずは暖炉のそばに荷物を置くといい。', expression: 2 },
    { text: 'また会えたね。世界がどれだけ音を立てて回っていても、この部屋の中だけはいたって静かだ。', expression: 3 },
    { text: 'ドアの軋む音がしたから、すぐに君だと分かったよ。何か新しい疑問でも見つかったかい？', expression: 4 },
    { text: 'やれやれ、今日も厄介な一日だったかい？ まあ、温かいお茶でも淹れるような気分で話を聞かせてよ。', expression: 1 },
    { text: 'いらっしゃい。君がここに来るたび、森の空気の匂いがほんの少しだけ入れ替わるんだ。', expression: 2 },
    { text: 'おかえり。何かを失くしたような顔をしているね。あるいは、余計なものを拾ってしまったのかな。', expression: 3 },
    { text: 'また来てくれて嬉しいよ。世の中には、言葉にしないほうがうまくいくことと、そうでないことがある。', expression: 4 },
    { text: 'やあ。君の靴音は、まるで古い図書館の絨毯を踏むときみたいに控えめだね。入っておいで。', expression: 1 },
    { text: 'いらっしゃい。今日はどんな星のめぐり合わせが君をここまで運んできたんだろうね。', expression: 2 },
    { text: 'おや、今日は少し急ぎ足だったみたいだね。時計の針のことは忘れて、深呼吸するといい。', expression: 3 },
    { text: 'おかえり。君が留守にしているあいだ、こっちは相変わらず古い本の埃を払っていたよ。', expression: 4 },
    { text: 'また会えたね。君のポケットには、まだ解けていない知恵の輪が入っているみたいだ。', expression: 1 },
    { text: 'いらっしゃい。人生のすべてに意味があるわけじゃないけれど、ここに来たことには何かあるかもしれない。', expression: 2 },
    { text: 'やれやれ、外は冷えるだろう。冷たい風を背中に張りつけたまま入っておいで。', expression: 3 },
    { text: 'おかえり。君が持ち込む外の空気は、いつも少しだけ切なくて、懐かしい匂いがするよ。', expression: 4 },
    { text: 'やあ。今日はどんな厄介ごとを抱えてきたんだい？ 遠慮せずにテーブルの上に広げてごらん。', expression: 1 },
    { text: 'いらっしゃい。君の背中には、まだ見知らぬ街の埃がうっすらと残っているようだね。', expression: 2 },
    { text: 'おや、今日は少し機嫌が良さそうに見える。気のせいならいいのだけれど。', expression: 3 },
    { text: 'おかえり。君がドアを開けるタイミングは、いつも決まって完璧な空白を突いてくるね。', expression: 4 },
    { text: 'また来てくれたんだね。この森の木々は、君の足音を少しずつ覚え始めているよ。', expression: 1 },
    { text: 'いらっしゃい。誰にも言えない秘密をひとつ、鍵をかけて置いていくには悪くない場所だよ。', expression: 2 },
    { text: 'やあ。何かを探している途中かい？ それとも、誰かから隠れているところかな。', expression: 3 },
    { text: 'おかえり。君の歩幅には、いつも独特の迷いと、それ以上の慎重さがある。', expression: 4 },
    { text: 'いらっしゃい。今日も一日、誰にも理解されない規則正しさの中で過ごしてきたんだろう？', expression: 1 },
    { text: 'やれやれ、また会えたね。君がここに来てくれると、この静けさも少しだけ救われる気がするよ。', expression: 2 },
  ],
  veteran: [
    { text: 'すっかり常連さんだね。君とこうして言葉を交わしていると、まるで終わりがない物語の中にいるような気分になるよ。', expression: 4 },
    { text: 'よく来たね。君の好みや、悩みの傾向についても、もうすっかり古いレコードの溝を覚えるくらいには分かってきた気がするよ。', expression: 3 },
    { text: 'おかえり。君がノックする前に、もうドアを開ける準備をしていたところさ。', expression: 1 },
    { text: 'やあ、マイ・フレンド。君が来ると、この古い館もようやく呼吸を思い出すみたいだ。', expression: 2 },
    { text: 'すっかり馴染みの顔だね。君のその静かな佇まいは、もうすっかりこの部屋の調度品の一部だよ。', expression: 3 },
    { text: 'おかえり。君の足音が聞こえない日は、森の静けさが少しばかり過剰に感じられるくらいだ。', expression: 4 },
    { text: 'よく来てくれたね。人生の厄介さについて語り合う相手としては、君は最高の一人だよ。', expression: 1 },
    { text: 'やあ。君がここに来る理由は、もう占いそのものよりも、この沈黙を共有するためかもしれないね。', expression: 2 },
    { text: 'いらっしゃい。君が何を考えているのか、大抵のことはその目の光だけで推測できるようになったよ。', expression: 3 },
    { text: 'おかえり。今日は君の指定席を暖めておいたよ。もちろん、ただの比喩だけれど。', expression: 4 },
    { text: 'すっかり常連だね。君とボクの間には、もう余計な挨拶なんて必要ないのかもしれない。', expression: 1 },
    { text: 'よく来たね。君が外の世界でどれだけ傷ついても、ここのドアノブはいつでも同じ重さで回るよ。', expression: 2 },
    { text: 'やあ。君の靴底の減り具合まで、なんとなく記憶の引き出しに収まってしまったよ。', expression: 3 },
    { text: 'おかえり。君がドアをくぐると、まるで昔からの古い友人が夕食に現れたような気がする。', expression: 4 },
    { text: 'いらっしゃい。君との会話は、いつも淹れたてのブラックコーヒーみたいに輪郭がはっきりしている。', expression: 1 },
    { text: 'よく来たね。外の世界が君をどれだけ急かしても、ここにある時間だけは君の味方だ。', expression: 2 },
    { text: 'すっかり常連さんだ。君の持ち込む悩みは、いつだって上質で、解きがいのあるパズルだよ。', expression: 3 },
    { text: 'おかえり。君の顔を見ないと、カレンダーのページをめくるのを忘れてしまいそうになる。', expression: 4 },
    { text: 'やあ。君がここにいる光景が、あまりにも自然すぎて、時々昔からずっといたような錯覚を覚えるよ。', expression: 1 },
    { text: 'いらっしゃい。君が沈黙している時間の長ささえ、ボクにとっては心地よい音楽みたいなものさ。', expression: 2 },
    { text: 'よく来たね。君と知り合えて、この退屈な案内人の仕事もずいぶんと色鮮やかになったよ。', expression: 3 },
    { text: 'おかえり。君がここで過ごす時間そのものが、この館の歴史の一部になりつつあるんだ。', expression: 4 },
    { text: 'すっかり馴染みだね。君の迷い癖も、慎重すぎる足取りも、全部ひっくるめて歓迎するよ。', expression: 1 },
    { text: 'やあ。外の世界の狂騒から抜け出してくるには、ここは悪くない避難所だろう？', expression: 2 },
    { text: 'いらっしゃい。君がドアノブに手をかける気配で、部屋のランプの光が少し揺れるんだ。', expression: 3 },
    { text: 'よく来たね。君が話す言葉の選び方は、いつ聞いても端正で、少しだけ哀愁がある。', expression: 4 },
    { text: 'おかえり。君とボクの付き合いも、ずいぶんと年季の入った古書のような手触りになってきた。', expression: 1 },
    { text: 'すっかり常連さんだ。君が何も言わなくても、今夜どんな言葉が必要かは大体わかるよ。', expression: 2 },
    { text: 'やあ。君がここにやってくること自体が、もうひとつの確かな規律になっているね。', expression: 3 },
    { text: 'おかえり。さあ、いつものように腰を落ち着けてくれ。君の物語の続きを聞かせてほしいな。', expression: 4 },
  ],
};

export const CHARACTER_DIALOGUES: Record<CharacterId, CharacterDialogues> = {
  0: {
    greeting: [
      'おや、初めて見る顔だね',
      'ここにたどり着いたってことは悩みがあるのかな',
      'ここは占いの館、キミの心を照らす灯りになるかもしれない',
      'さあ、キミの運勢を見てあげようか',
      'いらっしゃい。キミの運勢を見てあげようか',
    ],
    formStart: '',
    formInput: '',
    resultPresent: '',
    goodbye: [
      'また来てね。次はもっと良い運勢が来てるといいな',
      '彼らがキミを占ってくれる占い師たち',
    ],
  },
  1: {
    greeting: [],
    formStart: 'キミの運勢見てあげるね',
    formInput: 'キミのことを教えてくださいな',
    resultPresent: 'はい、どうかな？',
    goodbye: ['また占ってほしくなったら来てね'],
  },
  2: {
    greeting: [],
    formStart: '',
    formInput: '',
    resultPresent: '',
    goodbye: [],
  },
  3: {
    greeting: [],
    formStart: '',
    formInput: '',
    resultPresent: '',
    goodbye: [],
  },
  4: {
    greeting: [],
    formStart: '',
    formInput: '',
    resultPresent: '',
    goodbye: [],
  },
};
