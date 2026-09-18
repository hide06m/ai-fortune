/**
 * キャラクター選択画面
 * クラッシュバンディクー2 風カメラ回転 UI
 */

import React, { useState, useEffect } from 'react';
import '../styles/character-selection.css';
import { CHARACTER_MASTER_DATA, type CharacterId } from '../types/character';
import { getCharacterIntimacy, getUnlockedCharacters } from '../api/character';
import { speakGreeting, isVoiceEnabled } from '../services/textToSpeech';

interface CharacterSelectionPageProps {
  onCharacterSelected: (characterId: CharacterId) => void;
}

export function CharacterSelectionPage({ onCharacterSelected }: CharacterSelectionPageProps) {
  const [rotation, setRotation] = useState(0);
  const [selectedCharacterId, setSelectedCharacterId] = useState<CharacterId>(1); // ナツメをデフォルト選択
  const [intimacyLevels, setIntimacyLevels] = useState<Map<number, number>>(new Map());
  const [unlockedCharacters, setUnlockedCharacters] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // キャラクター情報を取得
  useEffect(() => {
    async function loadCharacterData() {
      try {
        const response = await getUnlockedCharacters();
        if (response.success) {
          setUnlockedCharacters(new Set(response.unlockedCharacters));

          // 各キャラクターの親密度を取得
          const intimacyMap = new Map<number, number>();
          for (let i = 0; i < 5; i++) {
            const charResponse = await getCharacterIntimacy(i as CharacterId);
            if (charResponse.success && charResponse.intimacy) {
              intimacyMap.set(i, charResponse.intimacy.intimacyLevel);
            }
          }
          setIntimacyLevels(intimacyMap);
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
  const intimacyLevel = intimacyLevels.get(selectedCharacterId) || 0;

  // 診断開始
  const handleStartDiagnosis = () => {
    if (!isUnlocked && selectedCharacterId !== 1) {
      alert(`${selectedCharacter.name}は親密度 Lv.${getUnlockLevel(selectedCharacterId)} で解放されます`);
      return;
    }
    onCharacterSelected(selectedCharacterId);
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
                {/* キャラクター画像 */}
                <img
                  src={`/assets/ham${charId}99.jpg`}
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
                  {unlockedCharacters.has(charId) && (
                    <div className="intimacy">
                      ♥ Lv.{intimacyLevels.get(charId) || 0}/10
                    </div>
                  )}
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

          {/* 親密度バー */}
          {isUnlocked && (
            <div className="intimacy-bar">
              <div
                className="intimacy-fill"
                style={{ width: `${(intimacyLevel / 10) * 100}%` }}
              />
              <span className="intimacy-text">Lv.{intimacyLevel}</span>
            </div>
          )}

          {/* ボタン */}
          <div className="action-buttons">
            {!isUnlocked && selectedCharacterId !== 1 ? (
              <button className="btn btn-locked" disabled>
                🔒 親密度 Lv.{getUnlockLevel(selectedCharacterId)} で解放
              </button>
            ) : (
              <>
                <button className="btn btn-primary" onClick={handleStartDiagnosis}>
                  🔮 {selectedCharacter.name}に占ってもらう
                </button>
              </>
            )}
          </div>
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
