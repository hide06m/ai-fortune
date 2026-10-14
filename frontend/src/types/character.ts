/**
 * キャラクター関連の型定義（Frontend）
 */

export type CharacterId = 0 | 1 | 2 | 3 | 4;

export interface Character {
  id: CharacterId;
  name: string;
  gender: 'male' | 'female';
  role: string;
  personality: string;
  voiceId: number; // VOICEVOX speaker ID
  imageFile: string;
}

export interface CharacterIntimacy {
  id?: number;
  userId?: number;
  characterId: CharacterId;
  intimacyLevel: number; // 0-10（ハート数）
  intimacyPoints: number; // 0-1000（ハート内の細かい進捗。%表示に使う）
  totalDiagnoses: number;
  lastDiagnosisDate?: string | null;
  unlockedAt?: string | null;
  metAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const INTIMACY_POINTS_PER_LEVEL = 100;

/** 診断1回に必要なルーンストーン数（キャラごとに異なる。解放の遅いキャラほど高価） */
export const DIAGNOSIS_STONE_COST: Record<CharacterId, number> = {
  0: 0,
  1: 1,
  2: 5,
  3: 10,
  4: 1, // クリ：タイプ診断（AIなし）1回あたり。悩み・状況の相談は KURI_CONSULT_STONE_COST
};

/** クリへの「悩み・状況の相談」（AIを使う）に必要なルーンストーン数。診断して相談する場合は、診断1＋相談3＝4個 */
export const KURI_CONSULT_STONE_COST = 3;

/** 「ちょっとした挨拶（ミニ贈り物）」に必要なルーンストーン数（固定） */
export const GIFT_STONE_COST = 1;

/** 「ちょっとした挨拶」が使えるキャラ（診断コストが高いキャラのみ） */
export const GIFT_ELIGIBLE_CHARACTERS: CharacterId[] = [1, 2, 3, 4];

export const CHARACTER_MASTER_DATA: Record<CharacterId, Character> = {
  0: {
    id: 0,
    name: 'ムスビ',
    gender: 'male',
    role: '総合相談役',
    personality: '温かみのある長男肌、優しい',
    voiceId: 11, // 玄野武宏・男性
    imageFile: 'ham0',
  },
  1: {
    id: 1,
    name: 'ナツメ',
    gender: 'female',
    role: '生年月日の占い師（四柱推命ほか）',
    personality: 'ふんわり癒しタイプ、親しみやすい、躊躇がない',
    voiceId: 2, // 四国めたん ノーマル・女性
    imageFile: 'ham1',
  },
  2: {
    id: 2,
    name: 'ツキ',
    gender: 'female',
    role: '星占い系の占い師',
    personality: '神秘的、落ち着いた雰囲気、知識豊富',
    voiceId: 9, // 波音リツ・女性
    imageFile: 'ham2',
  },
  3: {
    id: 3,
    name: 'コクウ',
    gender: 'male',
    role: '手相の占い師',
    personality: '経験豊富な長老タイプ、厳格だが優しい',
    voiceId: 13, // 青山龍星・男性、低め
    imageFile: 'ham3',
  },
  4: {
    id: 4,
    name: 'クリ',
    gender: 'male',
    role: '性格・恋愛タイプの診断師',
    personality: '親切で親しみやすい、ユーザーの話をよく聞く',
    voiceId: 12, // 白上虎太郎 ふつう・男性
    imageFile: 'ham4',
  },
};
