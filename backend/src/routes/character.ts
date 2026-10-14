/**
 * キャラクター関連 API エンドポイント
 * GET  /api/character/list              - 全キャラ情報取得
 * GET  /api/character/intimacy          - ユーザーの親密度一覧
 * GET  /api/character/:id/intimacy      - 特定キャラの親密度
 * POST /api/character/:id/unlock        - キャラ解放
 * POST /api/character/greet             - 案内役（ムスビ）のドア挨拶
 * GET  /api/character/next-unmet        - 初対面イベント未再生の解放済みキャラを1件取得
 * POST /api/character/:id/met           - 初対面イベントを再生済みとして記録
 * GET  /api/character/:id/greeting      - 診断キャラの再訪問時の一言挨拶（初対面済み前提）
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  CHARACTER_MASTER_DATA,
  INTIMACY_UNLOCKS,
  CharacterId,
  CHARACTER_DIALOGUES,
  GUIDE_GREETINGS,
  GIFT_ELIGIBLE_CHARACTERS,
  GIFT_INTIMACY_POINTS,
} from '../types/character.js';
import { pickCharacterGreeting } from '../data/characterGreetings.js';
import {
  getUserCharacterIntimacy,
  getUserAllIntimacies,
  unlockCharacter,
  getUnlockedCharacters,
  incrementCharacterIntimacy,
  markCharacterMet,
  getNextUnmetCharacter,
} from '../db/character.js';
import { spendStoneForGift } from '../db/stones.js';
import { ensureMusubiUnlocked } from '../db/musubi.js';

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

    // 4人の親密度がすべてMAXなら、ここで、ムスビを解放する（診断のたびに調べなくても、選択画面を開いたときに反映される）
    await ensureMusubiUnlocked(userId);
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

    const { intimacy, wasNewlyUnlocked } = await unlockCharacter(userId, characterId);

    res.json({
      success: true,
      message: wasNewlyUnlocked
        ? `Character ${CHARACTER_MASTER_DATA[characterId].name} unlocked!`
        : `Character ${CHARACTER_MASTER_DATA[characterId].name} was already unlocked`,
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
 * GET /api/character/next-unmet
 * 解放済みだが初対面イベント未再生のキャラを1件返す（無ければcharacterId: null）
 * キャラ選択画面を開く直前にチェックし、あれば先に出会いイベントを再生する
 */
router.get('/next-unmet', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const characterId = await getNextUnmetCharacter(userId);
    res.json({ success: true, characterId });
  } catch (error) {
    console.error('[API] Failed to get next unmet character:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get next unmet character',
    });
  }
});

/**
 * POST /api/character/:characterId/met
 * 初対面イベントを再生済みとして記録する
 */
router.post('/:characterId/met', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const characterId = parseInt(req.params.characterId) as CharacterId;

    if (![0, 1, 2, 3, 4].includes(characterId)) {
      return res.status(400).json({ success: false, error: 'Invalid character ID' });
    }

    const intimacy = await markCharacterMet(userId, characterId);
    res.json({ success: true, intimacy });
  } catch (error) {
    console.error('[API] Failed to mark character met:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark character met',
    });
  }
});

/**
 * GET /api/character/:characterId/greeting
 * 診断キャラ（ナツメ・ツキ・コクウ・クリ）の再訪問時の一言挨拶。
 * 親密度レベルに応じて通常／常連ティアからランダムに1つ返す（初対面イベントとは別物）。
 */
router.get('/:characterId/greeting', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const characterId = parseInt(req.params.characterId) as CharacterId;

    if (![1, 2, 3, 4].includes(characterId)) {
      return res.status(400).json({ success: false, error: 'Invalid character ID' });
    }

    const intimacy = await getUserCharacterIntimacy(userId, characterId);
    const greeting = pickCharacterGreeting(characterId, intimacy?.intimacyLevel ?? 0);

    if (!greeting) {
      return res.status(404).json({ success: false, error: 'No greeting data for this character' });
    }

    res.json({ success: true, ...greeting });
  } catch (error) {
    console.error('[API] Failed to get character greeting:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get character greeting',
    });
  }
});

/**
 * POST /api/character/greet
 * 案内役（ムスビ、キャラID0）がドアを開けるたびに話す挨拶。
 * ログイン済みならキャラID0の親密度（＝来館回数、10で頭打ち）をインクリメントし、
 * その回数に応じて初回／2〜9回目／10回目以降のセリフを返す。ゲストは常に初回扱い（保存なし）。
 */
router.post('/greet', async (req: Request, res: Response) => {
  try {
    let intimacyLevel: number | null = null
    let tier: 'first' | 'regular' | 'veteran' = 'first'

    if (req.isAuthenticated && req.user) {
      const intimacy = await incrementCharacterIntimacy((req.user as any).userId, 0)
      intimacyLevel = intimacy.intimacyLevel
      if (intimacyLevel >= 10) tier = 'veteran'
      else if (intimacyLevel >= 2) tier = 'regular'
      else tier = 'first'
    }

    const pool = tier === 'first' ? [GUIDE_GREETINGS.first] : GUIDE_GREETINGS[tier]
    const pick = pool[Math.floor(Math.random() * pool.length)]

    res.json({
      success: true,
      tier,
      intimacyLevel,
      dialogue: pick.text,
      expression: pick.expression,
      noSplit: pick.noSplit ?? false,
    })
  } catch (error) {
    console.error('[API] Failed to get guide greeting:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get guide greeting',
    })
  }
})

/**
 * POST /api/character/:characterId/gift
 * 「ちょっとした挨拶（ミニ贈り物）」：石1個で少量の親密度を上げる。
 * 診断コストが高いキャラ（GIFT_ELIGIBLE_CHARACTERS）だけが対象。診断としてはカウントしない。
 */
router.post('/:characterId/gift', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const characterId = parseInt(req.params.characterId) as CharacterId;

    if (!GIFT_ELIGIBLE_CHARACTERS.includes(characterId)) {
      return res.status(400).json({
        success: false,
        error: 'このキャラクターには「ちょっとした挨拶」はありません',
      });
    }

    // 未解放キャラには渡せない（診断と同じくキャラ選択画面で解放済みのキャラのみが対象）
    const currentIntimacy = await getUserCharacterIntimacy(userId, characterId);
    // ムスビだけは、解放される前から、ちょっとした挨拶ができる（親密度を上げられる）
    if (!currentIntimacy || (!currentIntimacy.unlockedAt && characterId !== 0)) {
      return res.status(403).json({
        success: false,
        error: 'まだ解放されていないキャラクターです',
      });
    }

    let stoneBalance: number;
    try {
      stoneBalance = await spendStoneForGift(userId);
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_STONES') {
        return res.status(402).json({
          success: false,
          error: 'INSUFFICIENT_STONES',
          message: 'ルーンストーンが足りません。ログインボーナスや広告視聴で増やしてください。',
        });
      }
      throw error;
    }

    const intimacy = await incrementCharacterIntimacy(userId, characterId, GIFT_INTIMACY_POINTS, false);

    // 他キャラの解放条件（INTIMACY_UNLOCKS）に達したら診断時と同様に自動解放する
    let justUnlocked: CharacterId | null = null;
    const unlock = INTIMACY_UNLOCKS.find(
      (u) => u.characterId !== undefined && u.level === intimacy.intimacyLevel
    );
    if (unlock?.characterId !== undefined) {
      const { wasNewlyUnlocked } = await unlockCharacter(userId, unlock.characterId);
      if (wasNewlyUnlocked) justUnlocked = unlock.characterId;
    }

    res.json({
      success: true,
      intimacy,
      stoneBalance,
      justUnlocked,
    });
  } catch (error) {
    console.error('[API] Failed to send character gift:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send character gift',
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
