/**
 * 性格タイプ診断（16タイプ）の表示用マスターデータ
 * 役割グループ（4分類）のテーマカラーと、各タイプの名称・ひとこと紹介を持つ
 */

export type MBTIRoleKey = 'analysts' | 'diplomats' | 'sentinels' | 'explorers'

export const MBTI_ROLE_THEMES: Record<MBTIRoleKey, { name: string; color: string; description: string }> = {
  analysts: { name: '分析家', color: '#88619a', description: '直観（N）× 思考（T）。合理性と公平さ、戦略的な考え方を大切にする。' },
  diplomats: { name: '外交官', color: '#33a474', description: '直観（N）× 感情（F）。共感力と協調性、理想に向かう情熱を持つ。' },
  sentinels: { name: '番人', color: '#4298b4', description: '現実（S）× 計画（J）。秩序と安全、実用性と安定を重んじる。' },
  explorers: { name: '探検家', color: '#e4ae3a', description: '現実（S）× 探索（P）。自発的で機転が利き、柔軟に動ける。' },
}

export interface MBTITypeInfo {
  name: string
  roleKey: MBTIRoleKey
  tagline: string
}

export const MBTI_TYPES: Record<string, MBTITypeInfo> = {
  INTJ: { name: '建築家', roleKey: 'analysts', tagline: '想像力と戦略性を兼ね備え、あらゆることに綿密な計画を立てる。' },
  INTP: { name: '論理学者', roleKey: 'analysts', tagline: '知識への欲求が強い発明家タイプ。独自の視点で物事を捉える。' },
  ENTJ: { name: '指揮官', roleKey: 'analysts', tagline: '大胆で意志が強いリーダー。目標へ向けて道を切り開く。' },
  ENTP: { name: '討論者', roleKey: 'analysts', tagline: '好奇心旺盛な思考家。知的な挑戦や議論を恐れず、新しい発想を生む。' },
  INFJ: { name: '提唱者', roleKey: 'diplomats', tagline: '物静かで神秘的な理想主義者。揺るがない信念で人を励ます。' },
  INFP: { name: '仲介者', roleKey: 'diplomats', tagline: '詩的で心優しい利他主義者。よい目的のためなら手を差し伸べる。' },
  ENFJ: { name: '主人公', roleKey: 'diplomats', tagline: 'カリスマ性のある励ましのリーダー。人を魅了し、導く力を持つ。' },
  ENFP: { name: '運動家', roleKey: 'diplomats', tagline: '情熱的で独創的、社交的な自由人。前向きなエネルギーを放つ。' },
  ISTJ: { name: '管理者', roleKey: 'sentinels', tagline: '実用的で事実を重んじる人。信頼性と誠実さは揺るがない。' },
  ISFJ: { name: '擁護者', roleKey: 'sentinels', tagline: '献身的で温かい人。大切な人をいつでも守る用意がある。' },
  ESTJ: { name: '幹部', roleKey: 'sentinels', tagline: '物事や人をまとめる力に長けた実務家。伝統と秩序を大切にする。' },
  ESFJ: { name: '領事', roleKey: 'sentinels', tagline: '思いやりがあり社交的な人気者。周囲に気を配り、調和を保つ。' },
  ISTP: { name: '巨匠', roleKey: 'explorers', tagline: '大胆で実践的な実験者。道具や仕組みを使いこなす名手。' },
  ISFP: { name: '冒険家', roleKey: 'explorers', tagline: '柔軟で魅力にあふれた芸術家肌。新しい体験や美しさを探し求める。' },
  ESTP: { name: '起業家', roleKey: 'explorers', tagline: 'エネルギッシュで知覚が鋭く、危険を恐れず行動する。' },
  ESFP: { name: 'エンターテイナー', roleKey: 'explorers', tagline: '自発的で熱心。周りを退屈させない盛り上げ役。' },
}

/** 末尾の A / T（自己主張型 / 乱高下型）の表示名 */
export const MBTI_IDENTITY_LABELS: Record<string, string> = {
  A: '自己主張型',
  T: '乱高下型',
}
