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
  SEIMEI_STONE_COST,
  MUSUBI_STONE_COST,
  INTIMACY_POINTS_PER_LEVEL,
  type CharacterId,
} from '../types/character';
import { getCharacterIntimacy, getUnlockedCharacters, sendCharacterGift } from '../api/character';
import { getStoneBalance } from '../api/stones';
import { CHARACTER_VISUAL } from '../data/characterVisuals';
import { HamsterLoading } from '../components/HamsterLoading';
import { listLatestResults } from '../api/results';

/** 占い師ごとの、見返せる最新の結果の種類（kind）と、ボタンに出す名前 */
const LATEST_BY_CHARACTER: Record<number, Array<{ kind: string; label: string }>> = {
  0: [{ kind: 'musubi', label: '総合相談' }],
  1: [{ kind: 'fortune:1', label: '四柱推命など' }],
  2: [{ kind: 'fortune:2', label: '西洋占星術' }, { kind: 'sukuyou', label: '宿曜占星術' }],
  3: [{ kind: 'palm', label: '手相' }, { kind: 'seimei', label: '姓名判断' }],
  4: [{ kind: 'mbti', label: '性格タイプ診断' }, { kind: 'love64', label: '恋愛タイプ診断' }],
};

/** 占術の選び方：クリ＝性格(mbti)／恋愛タイプ(love64)、コクウ＝手相(palm)／姓名判断(seimei) */
export type KuriDiagnosisMode = 'mbti' | 'love64' | 'palm' | 'seimei' | 'sukuyou' | 'consult';

interface CharacterSelectionPageProps {
  onCharacterSelected: (characterId: CharacterId, kuriMode?: KuriDiagnosisMode) => void;
  /** 「ちょっとした挨拶」を渡したあと、その占い師との会話を始める */
  onGreeting?: (characterId: CharacterId) => void;
  /** 前回の結果を見る（ルーンストーン不要） */
  onViewLatest?: (kind: string) => void;
  /** ホーム画面へ戻る */
  onHome?: () => void;
}

interface IntimacyState {
  level: number;
  points: number;
}

function getCharacterImage(characterId: CharacterId, unlocked = true): string {
  const { folder, prefix } = CHARACTER_VISUAL[characterId];
  // ナツメの 001 は、フードで顔が隠れた初対面用の絵。選択画面では、顔の見える絵（002）を使う
  // ムスビも、解放されたら、顔の見える絵（002）。解放前は、フードで顔を隠した絵（001）
  const number = characterId === 1 || (characterId === 0 && unlocked) ? '002' : '001';
  return `/assets/characters/${folder}/${prefix}${number}.webp`;
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

export function CharacterSelectionPage({ onCharacterSelected, onGreeting, onViewLatest, onHome }: CharacterSelectionPageProps) {
  // 保存されている、前回の結果の種類
  const [latestKinds, setLatestKinds] = useState<Set<string>>(new Set());
  useEffect(() => {
    listLatestResults().then((list) => setLatestKinds(new Set(list.map((r) => r.kind))));
  }, []);
  // ナツメ（1番）が正面に来る向きから始める（5体なので 72° 毎）
  const [rotation, setRotation] = useState(72);
  // 選択中のキャラは、正面に来ているキャラ。矢印・ホイール・クリックで回すと、下の表示も同時に切り替わる
  const selectedCharacterId = ((Math.round((((rotation % 360) + 360) % 360) / 72) % 5) + 5) % 5 as CharacterId;
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

  // 診断開始（クリのみ、性格タイプ診断か恋愛タイプ診断かを選べる）
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
        setGiftMessage(null);
        // 親密度が上がるだけでなく、その占い師との会話を始める
        onGreeting?.(selectedCharacterId);
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
    return <HamsterLoading message="占い師たちを呼んでいます..." showEstimate={false} />;
  }

  return (
    <div className="character-selection">
      {onHome && (
        <button type="button" className="selection-home-btn" onClick={onHome}>
          ← ホーム
        </button>
      )}
      {/* カメラ回転カルーセル */}
      <div className="carousel-container">
        {/* 左右の矢印：クリック・タップでも占い師を切り替えられる（キー・ホイールと同じ動き） */}
        <button type="button" className="carousel-arrow carousel-arrow-left" aria-label="前の占い師" onClick={() => setRotation((prev) => prev - 72)}>
          ◀
        </button>
        <button type="button" className="carousel-arrow carousel-arrow-right" aria-label="次の占い師" onClick={() => setRotation((prev) => prev + 72)}>
          ▶
        </button>
        <div
          className="character-carousel"
          style={{
            // 奥行きの強さ。小さいと、手前のカードが画面いっぱいに拡大されてしまう（1200px では、約2倍になり、枠をはみ出した）
            perspective: '3200px',
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
                  transform: `rotateY(${offsetRotation}deg) translateZ(max(400px, calc(var(--carousel-h) * 1.6)))`,
                  pointerEvents: isCenter ? 'auto' : 'none',
                }}
                onClick={() => {
                  if (!isCenter) {
                    // クリックした方向に回転（回すと選択も切り替わる）
                    const diff = offsetRotation;
                    setRotation((prev) => prev + (diff > 180 ? 360 - diff : -diff));
                  }
                }}
              >
                {/* キャラクター画像（背景透過ビジュアル） */}
                <img
                  src={getCharacterImage(charId as CharacterId, unlockedCharacters.has(charId))}
                  alt={charId === 0 && !unlockedCharacters.has(0) ? '？？？' : character.name}
                  className="character-image"
                />

                {/* ロック状態表示 */}
                {!unlockedCharacters.has(charId) && charId !== 1 && (
                  <div className="lock-badge">🔒</div>
                )}

                {/* キャラクター情報 */}
                <div className="character-info">
                  <h3>{charId === 0 && !unlockedCharacters.has(0) ? '？？？' : character.name}</h3>
                  <p className="character-role">{character.role}</p>
                  {(unlockedCharacters.has(charId) || charId === 0) && <IntimacyHeart intimacy={cardIntimacy} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 選択中のキャラクター情報パネル */}
      <div className="selection-panel">
        <div className="panel-content">
          <p className="personality">{selectedCharacter.personality}</p>

          {stoneBalance !== null && (
            <p className="stone-cost-hint">
              <img src="/assets/stone.webp" alt="" className="stone-cost-icon" />
              所持: {stoneBalance}個
            </p>
          )}

          {/* ボタン */}
          <div className="action-buttons">
            {!isUnlocked && selectedCharacterId !== 1 ? (
              <>
              <button className="btn btn-locked" disabled>
                {selectedCharacterId === 0
                  ? '🔒 …まだ、そのときではないようだ'
                  : `🔒 親密度 Lv.${getUnlockLevel(selectedCharacterId)} で解放`}
              </button>
              {/* ムスビだけは、解放される前から、ちょっとした挨拶ができる */}
              {selectedCharacterId === 0 && canGift && (
                <button className="btn btn-secondary" onClick={handleGift} disabled={!canAffordGift || giftingCharacterId !== null}>
                  💌 ちょっとした挨拶（石{GIFT_STONE_COST}個）
                </button>
              )}
              </>
            ) : selectedCharacterId === 0 ? (
              <>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('consult')} disabled={stoneBalance !== null && stoneBalance < MUSUBI_STONE_COST}>
                  💬 総合相談をする（石{MUSUBI_STONE_COST}個）
                </button>
              </>
            ) : selectedCharacterId === 3 ? (
              <>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('palm')} disabled={!canAffordDiagnosis}>
                  🖐 手相を診てもらう（石{stoneCost}個）
                </button>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('seimei')} disabled={stoneBalance !== null && stoneBalance < SEIMEI_STONE_COST}>
                  ✍ 姓名判断をしてもらう（石{SEIMEI_STONE_COST}個）
                </button>
                {canGift && (
                  <button className="btn btn-secondary" onClick={handleGift} disabled={!canAffordGift || giftingCharacterId !== null}>
                    💌 ちょっとした挨拶（石{GIFT_STONE_COST}個）
                  </button>
                )}
              </>
            ) : selectedCharacterId === 2 ? (
              <>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis()} disabled={!canAffordDiagnosis}>
                  ♌ 西洋占星術で占ってもらう（石{stoneCost}個）
                </button>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('sukuyou')} disabled={!canAffordDiagnosis}>
                  🌙 宿曜占星術で占ってもらう（石{stoneCost}個）
                </button>
                {canGift && (
                  <button className="btn btn-secondary" onClick={handleGift} disabled={!canAffordGift || giftingCharacterId !== null}>
                    💌 ちょっとした挨拶（石{GIFT_STONE_COST}個）
                  </button>
                )}
              </>
            ) : selectedCharacterId === 4 ? (
              <>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('mbti')} disabled={!canAffordDiagnosis}>
                  🔮 性格タイプ診断で占ってもらう（石{stoneCost}個）
                </button>
                <button className="btn btn-primary" onClick={() => handleStartDiagnosis('love64')} disabled={!canAffordDiagnosis}>
                  💕 恋愛タイプ診断で占ってもらう（石{stoneCost}個）
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

          {/* 一度診断した結果の、最新のものは、ルーンストーンなしで見返せる */}
          {onViewLatest && (LATEST_BY_CHARACTER[selectedCharacterId] ?? []).some((x) => latestKinds.has(x.kind)) && (
            <div className="latest-results">
              <span className="latest-results-title">前回の結果を見る（無料）</span>
              {(LATEST_BY_CHARACTER[selectedCharacterId] ?? [])
                .filter((x) => latestKinds.has(x.kind))
                .map((x) => (
                  <button key={x.kind} type="button" className="latest-results-button" onClick={() => onViewLatest(x.kind)}>
                    {x.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* ナビゲーションヒント */}
      <div className="navigation-hint">
        ◀ ▶ のクリック、← → キー、マウスホイールで、占い師を切り替え
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
