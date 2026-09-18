/**
 * Google Cloud Text-to-Speech サービス
 */

import textToSpeech from '@google-cloud/text-to-speech';

// Text-to-Speech クライアント
let ttsClient: textToSpeech.TextToSpeechClient | null = null;

/**
 * TTS クライアントを初期化
 */
function getTtsClient(): textToSpeech.TextToSpeechClient {
  if (!ttsClient) {
    // Google Cloud の認証は GOOGLE_APPLICATION_CREDENTIALS 環境変数で自動的に行われる
    // または、.env に設定されたキーで認証
    ttsClient = new textToSpeech.TextToSpeechClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  return ttsClient;
}

/**
 * テキストを音声に変換
 * @param text 変換するテキスト
 * @param voiceId Google TTS voice ID (例: 'ja-JP-Neural2-C')
 * @param languageCode 言語コード (例: 'ja-JP')
 * @param pitch ピッチ (-20.0 ~ 20.0)
 * @param speakingRate 速度 (0.25 ~ 4.0)
 * @returns 音声ファイルのバイナリデータ
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: string = 'ja-JP-Neural2-B',
  languageCode: string = 'ja-JP',
  pitch: number = 0.0,
  speakingRate: number = 1.0
): Promise<Buffer> {
  try {
    const client = getTtsClient();

    // テキストが長すぎる場合は切る（5000文字まで）
    const truncatedText = text.substring(0, 5000);

    const request = {
      input: { text: truncatedText },
      voice: {
        languageCode,
        name: voiceId,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch,
        speakingRate,
      },
    };

    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content in response');
    }

    // Buffer に変換
    return Buffer.from(response.audioContent);
  } catch (error) {
    console.error('[TTS] Failed to synthesize speech:', error);
    throw error;
  }
}

/**
 * 複数のテキストを連結して音声化
 */
export async function synthesizeMultiple(
  texts: string[],
  voiceId: string = 'ja-JP-Neural2-B',
  languageCode: string = 'ja-JP'
): Promise<Buffer> {
  const combined = texts.join(' ');
  return synthesizeSpeech(combined, voiceId, languageCode);
}
