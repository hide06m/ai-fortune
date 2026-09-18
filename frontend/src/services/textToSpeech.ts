/**
 * テキストツースピーチ（TTS）サービス
 * VOICEVOX Engine（backend経由）を使用
 */

import { type CharacterId, CHARACTER_MASTER_DATA } from '../types/character';
import { API_URL } from '../api';

/**
 * TTS API エンドポイント（backend 経由で VOICEVOX Engine を呼ぶ）
 */
const TTS_ENDPOINT = `${API_URL}/api/tts/speak`;

/**
 * キャラクター ID から VOICEVOX の話者ID（speaker id）を取得
 * VOICEVOXにインストール済みの話者一覧は GET {engineURL}/speakers で確認できる
 */
function getCharacterSpeakerId(characterId: CharacterId): number {
  const speakers: Record<CharacterId, number> = {
    0: 11, // ムスビ（玄野武宏・男性）
    1: 2,  // ナツメ（四国めたん ノーマル・女性）
    2: 9,  // ツキ（波音リツ・女性）
    3: 13, // コクウ（青山龍星・男性、低め）
    4: 12, // クリ（白上虎太郎 ふつう・男性）
  };
  return speakers[characterId];
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
    const speakerId = getCharacterSpeakerId(characterId);
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
        speakerId,
        speed,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`);
    }

    const audioData = await response.arrayBuffer();
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });
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
