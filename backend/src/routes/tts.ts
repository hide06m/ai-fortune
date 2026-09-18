/**
 * Text-to-Speech API エンドポイント
 * POST /api/tts/speak - テキストを音声に変換
 */

import { Router, Request, Response } from 'express';
import { synthesizeSpeech } from '../services/textToSpeech.js';

const router = Router();

/**
 * POST /api/tts/speak
 * テキストを音声に変換して返す
 */
router.post('/speak', async (req: Request, res: Response) => {
  try {
    const { text, voiceId = 'ja-JP-Neural2-B', languageCode = 'ja-JP', pitch = 0, speakingRate = 1.0 } = req.body;

    // バリデーション
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Text is too long (max 5000 characters)',
      });
    }

    console.log(`[TTS] Synthesizing: "${text.substring(0, 50)}..." with voice: ${voiceId}`);

    // 音声合成
    const audioBuffer = await synthesizeSpeech(text, voiceId, languageCode, pitch, speakingRate);

    // MP3 としてレスポンス
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.length);
    res.send(audioBuffer);
  } catch (error) {
    console.error('[TTS API] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to synthesize speech',
    });
  }
});

export default router;
