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
  intimacyLevel: number; // 0-10
  totalDiagnoses: number;
  lastDiagnosisDate: Date | null;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
