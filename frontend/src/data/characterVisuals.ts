/**
 * キャラクターごとの立ち絵フォルダ・ファイル名prefix（共通定義）
 * /assets/characters/{folder}/{prefix}{番号}.webp を参照する
 */

import type { CharacterId } from '../types/character'

export const CHARACTER_VISUAL: Record<CharacterId, { folder: string; prefix: string }> = {
  0: { folder: '0-musubi', prefix: 'musubi' },
  1: { folder: '1-natsume', prefix: 'natsume' },
  2: { folder: '2-tsuki', prefix: 'tsuki' },
  3: { folder: '3-kokuu', prefix: 'kokuu' },
  4: { folder: '4-kuri', prefix: 'kuri' },
}

export function getCharacterFolder(characterId: CharacterId): string {
  return CHARACTER_VISUAL[characterId].folder
}
