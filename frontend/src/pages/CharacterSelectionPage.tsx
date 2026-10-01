/**
 * キャラクター選択画面
 * クラッシュバンディクー2 風カメラ回転 UI
 */

import React, { useState, useEffect } from 'react';
import '../styles/character-selection.css';
import {
  CHARACTER_MASTER_DATA,
  DIAGNOSIS_STONE_COST,
  GIFT_ELIGIBLE_CHARACTERS,
  GIFT_STONE_COST,
  INTIMACY_POINTS_PER_LEVEL,
  type CharacterId,
} from '../types/character';
import { getCharacterIntimacy, getUnlockedCharacters, sendCharacterGift, getCharacterGreeting } from '../api/character';
import { getStoneBalance } from '../api/stones';
import { speakGreeting, isVoiceEnabled } from '../services/textToSpeech';
import { CHARACTER_VISUAL } from '../data/characterVisuals';

export type KuriDiagnosisMode = 'mbti' | 'love64';

interface CharacterSelectionPageProps {
  onCharacterSelected: (characterId: CharacterId, kuriMode?: KuriDiagnosisMode) => void;
}

interface IntimacyState {
  level: number;
  points: number;
}

function getCharacterImage(characterId: CharacterId): string {
  const { folder, prefix } = CHARACTER_VISUAL[characterId];
  return `/assets/characters/${folder}/${prefix}001.webp`;
}

// 親密度レベルによってハートの色・大きさの段階を変える（牧場物語のような見た目の変化）
function getHeartStage(level: number): { color: string; scale: number } {
  if (level >= 10) return { color: '#ffd54a', scale: 1.3 }; // 金：最愛
  if (level >= 7) return { color: '#ff1493', scale: 1.15 }; // 濃いピンク：親密
  if (level >= 4) return { color: '#ff69b4', scale: 1.05 }; // ピンク：仲良し
  if (level >= 1) return { color: '#ffb6c1', scale: 0.95 }; // 薄いピンク：知り合い
  return { color: '#cfcfcf', scale: 0.85 }; // グレー：初対面
}

function IntimacyHeart({ intimacy }: { intimacy: IntimacyState }) {
  const stage = getHeartStage(intimacy.level);
  const percentToNext = intimacy.level >= 10 ? 100 : intimacy.points % INTIMACY_POINTS_PER_LEVEL;

  return (
    <div className="intimacy-heart-row">
      <span className="intimacy-heart" style={{ color: stage.color, transform: `scale(${stage.scale})` }}>
        ♥
      </span>
      <div className="intimacy-heart-text">
        <span className="intimacy-heart-level">Lv.{intimacy.level}/10</span>
        {intimacy.level < 10 && <span className="intimacy-heart-percent">次のハートまで {percentToNext}%</span>}
      </div>
    </div>
  );
}

export function CharacterSelectionPage({ onCharacterSelected }: CharacterSelectionPageProps) {
  const [rotation, setRotation] = useState(0);
  const [selectedCharacterId, setSelectedCharacterId] = useState<CharacterId>(1); // ナツメをデフォルト選択
  const [intimacies, setIntimacies] = useState<Map<number, IntimacyState>>(new Map());
  const [unlockedCharacters, setUnlockedCharacters] = useState<Set<number>>(new Set());
  const [stoneBalance, setStoneBalance] = useState<number | null>(null);
  const [giftingCharacterId, setGiftingCharacterId] = useState<CharacterId | null>(null);
  const [giftMessage, setGiftMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // キャラクター情報を取得
  useEffect(() => {
    async function loadCharacterData() {
      try {
        const response = await getUnlockedCharacters();
        if (response.success) {
          setUnlockedCharacters(new Set(response.unlockedCharacters));

          // 各キャラクターの親密度を取得
          const intimacyMap = new Map<number, IntimacyState>();
          for (let i = 0; i < 5; i++) {
            const charResponse = await getCharacterIntimacy(i as CharacterId);
            if (charResponse.success && charResponse.intimacy) {
              intimacyMap.set(i, {
                level: charResponse.intimacy.intimacyLevel ?? 0,
                points: charResponse.intimacy.intimacyPoints ?? 0,
              });
            }
          }
          setIntimacies(intimacyMap);
        }

        const balanceResponse = await getStoneBalance();
        if (balanceResponse.success) {
          setStoneBalance(balanceResponse.balance);
        }
      } catch (error) {
        console.error('Failed to load character data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadCharacterData();
  }, []);

  // 選択中のキャラクターが変わったら挨拶を再生
  useEffect(() => {
    if (isVoiceEnabled()) {
      speakGreeting(selectedCharacterId);
    }
  }, [selectedCharacterId]);

  // 選択中のキャラクターが変わったら、再訪問時の一言挨拶を取得（初対面イベント対象キャラのみ）
  const [greetingText, setGreetingText] = useState<string | null>(null);
  useEffect(() => {
    if (selectedCharacterId === 0 || !unlockedCharacters.has(selectedCharacterId)) {
      setGreetingText(null);
      return;
    }
    let cancelled = false;
    setGreetingText(null);
    getCharacterGreeting(selectedCharacterId)
      .then((res) => {
        if (!cancelled && res.success && res.text) {
          setGreetingText(res.text);
        }
      })
      .catch((error) => console.error('Failed to fetch character greeting:', error));
    return () => {
      cancelled = true;
    };
  }, [selectedCharacterId, unlockedCharacters]);

  // マウス/キーボード操作で回転
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setRotation((prev) => (prev - 72) % 360); // 5体なので 72° 毎
      } else if (e.key === 'ArrowRight') {
        setRotation((prev) => (prev + 72) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // マウスホイール操作
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        setRotation((prev) => (prev + 72) % 360);
      } else {
        setRotation((prev) => (prev - 72) % 360);
      }
    };

    const carousel = document.querySelector('.character-carousel');
    carousel?.addEventListener('wheel', handleWheel, { passive: true });
    return () => carousel?.removeEventListener('wheel', handleWheel);
  }, []);

  // 選択済みキャラクターを判定
  const selectedCharacter = CHARACTER_MASTER_DATA[selectedCharacterId];
  const isUnlocked = unlockedCharacters.has(selectedCharacterId);
  const intimacy = intimacies.get(selectedCharacterId) ?? { level: 0, points: 0 };
  const stoneCost = DIAGNOSIS_STONE_COST[selectedCharacterId];
  const canAffordDiagnosis = stoneBalance === null || stoneBalance >= stoneCost;
  const canGift = GIFT_ELIGIBLE_CHARACTERS.includes(selectedCharacterId);
  const canAffordGift = stoneBalance === null || stoneBalance >= GIFT_STONE_COST;

  // 診断開始（クリのみ、性格診断かラブタイプ診断かを選べる）
  const handleStartDiagnosis = (kuriMode?: KuriDiagnosisMode) => {
    if (!isUnlocked && selectedCharacterId !== 1) {
      alert(`${selectedCharacter.name}は親密度 Lv.${getUnlockLevel(selectedCharacterId)} で解放されます`);
      return;
    }
    if (!canAffordDiagnosis) {
      alert(`ルーンストーンが足りません（必要: ${stoneCost}個）`);
      return;
    }
    onCharacterSelected(selectedCharacterId, kuriMode);
  };

  // ちょっとした挨拶（ミニ贈り物）
  const handleGift = async () => {
    if (giftingCharacterId !== null) return;
    setGiftMessage(null);
    setGiftingCharacterId(selectedCharacterId);
    try {
      const response = await sendCharacterGift(selectedCharacterId);
      if (response.success) {
        setIntimacies((prev) => {
          const next = new Map(prev);
          next.set(selectedCharacterId, {
            level: response.intimacy.intimacyLevel,
            points: response.intimacy.intimacyPoints,
          });
          return next;
        });
        if (typeof response.stoneBalance === 'number') {
          setStoneBalance(response.stoneBalance);
        }
        if (response.justUnlocked !== null && response.justUnlocked !== undefined) {
          setUnlockedCharacters((prev) => new Set(prev).add(response.justUnlocked));
        }
        setGiftMessage(`${selectedCharacter.name}に贈り物を渡した♪`);
      } else if (response.error === 'INSUFFICIENT_STONES') {
        setGiftMessage('ルーンストーンが足りません');
      } else {
        setGiftMessage(response.error || '失敗しました');
      }
    } catch (error) {
      console.error('Failed to send gift:', error);
      setGiftMessage('失敗しました');
    } finally {
      setGiftingCharacterId(null);
    }
  };

  if (loading) {
    return <div className="character-selection loading">読み込み中...</div>;
  }

  return (
    <div className="character-selection">
      {/* カメラ回転カルーセル */}
      <div className="carousel-container">
        <div
          className="character-carousel"
          style={{
            perspective: '1200px',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* 5体のキャラクターを円形配置 */}
          {[0, 1, 2, 3, 4].map((charId) => {
            const character = CHARACTER_MASTER_DATA[charId as CharacterId];
            const angle = charId * 72; // 5体なので 72° 毎
            const offsetRotation = (angle - rotation + 360) % 360;
            const isCenter = offsetRotation === 0 || offsetRotation === 360;
            const cardIntimacy = intimacies.get(charId) ?? { level: 0, points: 0 };

            return (
              <div
                key={charId}
                className={`character-card ${isCenter ? 'center' : ''} ${
                  !unlockedCharacters.has(charId) && charId !== 1 ? 'locked' : ''
                }`}
                style={{
                  transform: `rotateY(${offsetRotation}deg) translateZ(400px)`,
                  pointerEvents: isCenter ? 'auto' : 'none',
                }}
                onClick={() => {
                  if (isCenter) {
                    setSelectedCharacterId(charId as CharacterId);
                  } else {
                    // クリックした方向に回転
                    const diff = offsetRotation;
                    setRotation((prev) => prev + (diff > 180 ? 360 - diff : -diff));
                  }
                }}
              >
                {/* キャラクター画像（背景透過ビジュアル） */}
                <img
                  src={getCharacterImage(charId as CharacterId)}
                  alt={character.name}
                  className="character-image"
                />

                {/* ロック状態表示 */}
                {!unlockedCharacters.has(charId) && charId !== 1 && (
                  <div className="lock-badge">🔒</div>
                )}

                {/* キャラクター情報 */}
                <div className="character-info">
                  <h3>{character.name}</h3>
                  {unlockedCharacters.has(charId) && <IntimacyHeart intimacy={cardIntimacy} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 選択中のキャラクター情報パネル */}
      <div className="selection-panel">
        <div className="panel-content">
          <h2>{selectedCharacter.name}</h2>
          <p className="role">{selectedCharacter.role}</p>
          <p className="personality">{selectedCharacter.personality}</p>

          {/* 再訪問時の一言挨拶 */}
          {greetingText && <p className="character-greeting">「{greetingText}」</p>}

          {/* 親密度（ハート＋%） */}
          {isUnlocked && <IntimacyHeart intimacy={intimacy} />}

          {stoneBalance !== null && (
            <p className="stone-cost-hint">
              <img src="/assets/stone.webp" alt="" className="stone-cost-icon" />
              所持: {stoneBalance}個
            </p>
          )}

          {/* ボタン */}
          <div className="action-buttons">
            {!isUnlocked && selectedCharacterId !== 1 ? (
              <button className="btn btn-locked" disabled>
                🔒 親密度 Lv.{getUnlockLevel(selectedCharacterId)} で解放
              </button>
            ) : selectedCharacterId === 4 ? (
              <>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('mbti')} disabled={!canAffordDiagnosis}>
                  🔮 性格診断で占ってもらう（石{stoneCost}個）
                </button>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('love64')} disabled={!canAffordDiagnosis}>
                  💕 ラブタイプ診断で占ってもらう（石{stoneCost}個）
                </button>
                {canGift && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleGift}
                    disabled={!canAffordGift || giftingCharacterId !== null}
                  >
                    💌 ちょっとした挨拶（石{GIFT_STONE_COST}個）
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis()} disabled={!canAffordDiagnosis}>
                  🔮 {selectedCharacter.name}に占ってもらう（石{stoneCost}個）
                </button>
                {canGift && (
                  <button
                    className="btn btn-secondary"
                    onClick={handleGift}
                    disabled={!canAffordGift || giftingCharacterId !== null}
                  >
                    💌 ちょっとした挨拶（石{GIFT_STONE_COST}個）
                  </button>
                )}
              </>
            )}
          </div>
          {giftMessage && <p className="gift-message">{giftMessage}</p>}
        </div>
      </div>

      {/* ナビゲーションヒント */}
      <div className="navigation-hint">
        ← → キーまたはマウスホイールでキャラクターを選択
      </div>
    </div>
  );
}

/**
 * キャラクター解放に必要な親密度レベルを取得
 */
function getUnlockLevel(characterId: CharacterId): number {
  const unlocks: Record<CharacterId, number> = {
    0: 0, // ムスビ（出迎え役・常に表示）
    1: 0, // ナツメ（初期解放）
    2: 3, // ツキ
    3: 5, // コクウ
    4: 7, // クリ
  };
  return unlocks[characterId];
}
