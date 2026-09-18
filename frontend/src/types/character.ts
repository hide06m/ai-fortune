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
  intimacyLevel: number;
  totalDiagnoses: number;
  lastDiagnosisDate?: string | null;
  unlockedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

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
