/**
 * VOICEVOX Engine を使った音声合成サービス
 * ローカルで起動している VOICEVOX Engine（デフォルト: http://localhost:50021）の
 * HTTP API（/audio_query → /synthesis）を呼び出す。
 * 参照: https://voicevox.github.io/voicevox_engine/api/
 */

const VOICEVOX_ENGINE_URL = process.env.VOICEVOX_ENGINE_URL || 'http://localhost:50021';

/**
 * テキストを音声（WAV）に変換
 * @param text 変換するテキスト
 * @param speakerId VOICEVOXの話者ID（キャラクターごとの声を数値IDで指定）
 * @param speedScale 話速（0.5〜2.0、デフォルト1.0）
 * @returns 音声ファイルのバイナリデータ（WAV）
 */
export async function synthesizeSpeech(
  text: string,
  speakerId: number = 2,
  speedScale: number = 1.0
): Promise<Buffer> {
  try {
    // テキストが長すぎる場合は切る（VOICEVOXは長文も扱えるが、読み上げ時間を抑えるため制限）
    const truncatedText = text.substring(0, 1000);

    // 1. audio_query: テキストから読み上げクエリ（アクセント・音素情報など）を生成
    const queryUrl = `${VOICEVOX_ENGINE_URL}/audio_query?speaker=${speakerId}&text=${encodeURIComponent(truncatedText)}`;
    const queryRes = await fetch(queryUrl, { method: 'POST' });
    if (!queryRes.ok) {
      throw new Error(`VOICEVOX audio_query failed: ${queryRes.status} ${await queryRes.text()}`);
    }
    const audioQuery = (await queryRes.json()) as Record<string, unknown>;
    audioQuery.speedScale = speedScale;

    // 2. synthesis: クエリから実際の音声（WAV）を生成
    const synthUrl = `${VOICEVOX_ENGINE_URL}/synthesis?speaker=${speakerId}`;
    const synthRes = await fetch(synthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioQuery),
    });
    if (!synthRes.ok) {
      throw new Error(`VOICEVOX synthesis failed: ${synthRes.status} ${await synthRes.text()}`);
    }

    const arrayBuffer = await synthRes.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[TTS] Failed to synthesize speech via VOICEVOX:', error);
    throw error;
  }
}

/**
 * VOICEVOX Engineが起動しているか確認
 */
export async function isVoicevoxAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${VOICEVOX_ENGINE_URL}/version`);
    return res.ok;
  } catch {
    return false;
  }
}
