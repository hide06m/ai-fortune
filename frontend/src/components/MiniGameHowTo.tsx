/**
 * ミニゲームの遊び方：スタートの前に、絵つきの一枚で見せる（パーティーゲームの説明のように）
 */

const BASE = '/assets/games/';

export interface HowToStep {
  /** 絵（/assets/games/ の下のファイル名。拡張子なし）。横に並べる */
  images: string[];
  title: string;
  text: string;
}

export interface HowToContent {
  title: string;
  steps: HowToStep[];
}

export const FOREST_RUN_HOWTO: HowToContent = {
  title: '森ラン　遊び方',
  steps: [
    { images: ['ui_hand_tap_1', 'musubi_jump_up_right'], title: 'タップでジャンプ', text: '画面をタップするとムスビがジャンプするよ' },
    { images: ['run_log', 'run_rock_s', 'run_bird_1'], title: '障害物をよけよう', text: 'ぶつかるとハートが1つ減る　ハートがなくなるとミス' },
    { images: ['run_goal_gate', 'rune_stone'], title: 'ゴールまで走ろう', text: 'ゴールするとクリア　診断を待っている間のクリアはルーンストーンがもらえる' },
  ],
};

export const ACORN_CATCH_HOWTO: HowToContent = {
  title: 'どんぐりキャッチ　遊び方',
  steps: [
    { images: ['ui_arrows_lr', 'musubi_idle_right'], title: 'ゆびで左右に動く', text: 'ゆびを置いた方へムスビが動くよ　PCは左右キー' },
    { images: ['acorn', 'acorn_big', 'acorn_gold'], title: 'どんぐりをキャッチ', text: '大きいほど高い得点　金色は5点　時間内に目標の数を集めよう' },
    { images: ['run_mushroom_1'], title: 'キノコはさけよう', text: '受け止めるとハートが1つ減る　ハートがなくなるとミス' },
  ],
};

export const ACORN_STACK_HOWTO: HowToContent = {
  title: 'どんぐり積み　遊び方',
  steps: [
    { images: ['ui_hand_tap_1', 'acorn'], title: 'タップで落とす', text: '左右にゆれるどんぐりを、よいところでタップして落とそう　PCはクリックかスペースキー' },
    { images: ['run_stump_l', 'acorn_gold'], title: '切り株の上に積む', text: 'ぴったり重ねるほど安定するよ　目標の数まで積んだらクリア' },
    { images: ['musubi_sad_front'], title: 'ずれすぎると落ちる', text: '落ちるとハートが1つ減る　ハートがなくなるとミス' },
  ],
};

export function MiniGameHowTo({ content, onClose }: { content: HowToContent; onClose: () => void }) {
  return (
    <div className="run-overlay run-howto" onPointerDown={(e) => e.stopPropagation()}>
      <div className="run-howto-card">
        <h3>{content.title}</h3>
        <ol>
          {content.steps.map((s, i) => (
            <li key={s.title}>
              <span className="run-howto-no">{i + 1}</span>
              <div className="run-howto-pics">
                {s.images.map((img) => (
                  <img key={img} src={`${BASE}${img}.png`} alt="" draggable={false} />
                ))}
              </div>
              <div className="run-howto-text">
                <b>{s.title}</b>
                <span>{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="run-howto-ok" onClick={onClose}>
          わかった
        </button>
      </div>
    </div>
  );
}
