/**
 * キャラクター関連 API エンドポイント
 * GET  /api/character/list              - 全キャラ情報取得
 * GET  /api/character/intimacy          - ユーザーの親密度一覧
 * GET  /api/character/:id/intimacy      - 特定キャラの親密度
 * POST /api/character/:id/unlock        - キャラ解放
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  CHARACTER_MASTER_DATA,
  INTIMACY_UNLOCKS,
  CharacterId,
  CHARACTER_DIALOGUES,
} from '../types/character.js';
import {
  getUserCharacterIntimacy,
  getUserAllIntimacies,
  unlockCharacter,
  getUnlockedCharacters,
} from '../db/character.js';

function getRequiredIntimacyLevel(characterId: CharacterId): number | null {
  const unlock = INTIMACY_UNLOCKS.find((u) => u.characterId === characterId);
  return unlock ? unlock.level : null;
}

const router = Router();

/**
 * GET /api/character/list
 * 全キャラクター情報を取得
 */
router.get('/list', (req: Request, res: Response) => {
  try {
    const characters = Object.values(CHARACTER_MASTER_DATA);
    res.json({
      success: true,
      characters,
    });
  } catch (error) {
    console.error('[API] Failed to get character list:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get character list',
    });
  }
});

/**
 * GET /api/character/intimacy
 * ログインユーザーの全キャラクター親密度を取得
 */
router.get('/intimacy', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId;

    const intimacies = await getUserAllIntimacies(userId);
    const unlockedCharacters = await getUnlockedCharacters(userId);

    res.json({
      success: true,
      intimacies,
      unlockedCharacters,
    });
  } catch (error) {
    console.error('[API] Failed to get user intimacies:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get intimacies',
    });
  }
});

/**
 * GET /api/character/:characterId/intimacy
 * 特定キャラクターの親密度を取得
 */
router.get('/:characterId/intimacy', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const characterId = parseInt(req.params.characterId) as CharacterId;

    if (![0, 1, 2, 3, 4].includes(characterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid character ID',
      });
    }

    const intimacy = await getUserCharacterIntimacy(userId, characterId);
    const character = CHARACTER_MASTER_DATA[characterId];
    const dialogues = CHARACTER_DIALOGUES[characterId];

    res.json({
      success: true,
      character,
      intimacy: intimacy || {
        userId,
        characterId,
        intimacyLevel: 0,
        totalDiagnoses: 0,
        lastDiagnosisDate: null,
        unlockedAt: null,
      },
      dialogues,
    });
  } catch (error) {
    console.error('[API] Failed to get character intimacy:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get character intimacy',
    });
  }
});

/**
 * POST /api/character/:characterId/unlock
 * キャラクターを解放（親密度達成時）
 */
router.post('/:characterId/unlock', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const characterId = parseInt(req.params.characterId) as CharacterId;

    if (![0, 1, 2, 3, 4].includes(characterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid character ID',
      });
    }

    const requiredLevel = getRequiredIntimacyLevel(characterId);
    if (requiredLevel !== null) {
      const currentIntimacy = await getUserCharacterIntimacy(userId, characterId);
      if (!currentIntimacy || currentIntimacy.intimacyLevel < requiredLevel) {
        return res.status(403).json({
          success: false,
          error: `親密度Lv.${requiredLevel}が必要です`,
        });
      }
    }

    const intimacy = await unlockCharacter(userId, characterId);

    res.json({
      success: true,
      message: `Character ${CHARACTER_MASTER_DATA[characterId].name} unlocked!`,
      intimacy,
    });
  } catch (error) {
    console.error('[API] Failed to unlock character:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unlock character',
    });
  }
});

/**
 * GET /api/character/unlocks/info
 * 親密度レベルによる解放情報を取得
 */
router.get('/unlocks/info', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      unlocks: INTIMACY_UNLOCKS,
      characters: CHARACTER_MASTER_DATA,
    });
  } catch (error) {
    console.error('[API] Failed to get unlock info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get unlock info',
    });
  }
});

export default router;
