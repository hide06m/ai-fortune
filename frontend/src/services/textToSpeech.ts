/**
 * テキストツースピーチ（TTS）サービス
 * Google Cloud Text-to-Speech API を使用
 */

import { type CharacterId, CHARACTER_MASTER_DATA } from '../types/character';
import { API_URL } from '../api';

/**
 * Google TTS API エンドポイント（backend 経由で呼ぶ）
 */
const TTS_ENDPOINT = `${API_URL}/api/tts/speak`;

/**
 * キャラクター ID から Google TTS voice ID を取得
 */
function getCharacterVoiceId(characterId: CharacterId): string {
  const voices: Record<CharacterId, string> = {
    0: 'ja-JP-Neural2-C', // ムスビ（男性・低音・温かみ）
    1: 'ja-JP-Neural2-B', // ナツメ（女性・優しい）
    2: 'ja-JP-Neural2-D', // ツキ（女性・落ち着き）
    3: 'ja-JP-Neural2-A', // コクウ（男性・渋い）
    4: 'ja-JP-Neural2-E', // クリ（男性・優しい）
  };
  return voices[characterId];
}

/**
 * テキストを音声で再生
 * @param text 喋らせるテキスト
 * @param characterId キャラクター ID
 * @param speed 速度（0.5-2.0、デフォルト 1.0）
 */
export async function speak(
  text: string,
  characterId: CharacterId,
  speed: number = 1.0
): Promise<void> {
  try {
    const voiceId = getCharacterVoiceId(characterId);
    const character = CHARACTER_MASTER_DATA[characterId];

    console.log(`🎤 [${character.name}] Speaking: "${text}"`);

    // Backend の TTS エンドポイントに送信
    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId,
        languageCode: 'ja-JP',
        pitch: 0.0,
        speakingRate: speed,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    const audioData = await response.arrayBuffer();
    const audioBlob = new Blob([audioData], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);

    // 音声再生
    const audio = new Audio(audioUrl);
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
    });
    await audio.play();
  } catch (error) {
    console.error('Failed to speak:', error);
    // 音声再生失敗時は無視（ゲームは続行）
  }
}

/**
 * キャラクターの挨拶を再生
 */
export async function speakGreeting(characterId: CharacterId): Promise<void> {
  const greetings: Record<CharacterId, string> = {
    0: 'いらっしゃい。キミの運勢を見てあげようか',
    1: 'キミの運勢見てあげるね',
    2: 'ようこそ。今日のキミの星は何を示すのか',
    3: 'よく来たな。その悩みを見せてみよ',
    4: 'こんにちは。キミのことを教えてくださいな',
  };

  const greeting = greetings[characterId];
  await speak(greeting, characterId);
}

/**
 * 診断結果の概要を音声で読み上げ
 */
export async function speakResult(characterId: CharacterId, summary: string): Promise<void> {
  const prefix: Record<CharacterId, string> = {
    0: 'さあ、結果が出ました。',
    1: 'はい、どうかな？',
    2: '星の声が聞こえたわ。',
    3: '命式より見えてきたぞ。',
    4: 'できました。聞いてくださいな。',
  };

  const text = `${prefix[characterId]}${summary.substring(0, 200)}`; // 最初の200文字のみ
  await speak(text, characterId, 0.95);
}

/**
 * 音声設定を取得（localStorage）
 */
export function getVoiceSettings(): {
  enabled: boolean;
  volume: number;
} {
  const settings = localStorage.getItem('voiceSettings');
  if (settings) {
    return JSON.parse(settings);
  }
  return {
    enabled: true,
    volume: 1.0,
  };
}

/**
 * 音声設定を保存
 */
export function setVoiceSettings(enabled: boolean, volume: number): void {
  localStorage.setItem(
    'voiceSettings',
    JSON.stringify({ enabled, volume })
  );
}

/**
 * 音声が有効か確認
 */
export function isVoiceEnabled(): boolean {
  return getVoiceSettings().enabled;
}
