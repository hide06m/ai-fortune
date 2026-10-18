"""
ムスビの、各コマ（歩き12・ジャンプ・落下・着地・ぶつかる・がっかり・喜ぶ・待機）の、表示される大きさを、そろえる。
コマごとに、頭の大きさが少しずつ違い、アニメーションや、ポーズの切り替えで、大きさが変わって見える。
頭の幅（頭の上の部分の、横幅）を、ゲームでの表示の大きさで測り、全コマの中央値に、合わせる倍率を書き出す。
出力: frontend/public/assets/games/musubi_scale.json  （ゲームが、読みこんで、倍率をかける）
使い方: split_run_sheet.py と match_musubi_colors.py のあとに、python tools/musubi_sizes.py
"""
import json
import sys
from pathlib import Path

from PIL import Image

GAMES = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'assets' / 'games'
MUSUBI_H = 132  # ゲームでの、人物の高さの目安
HEAD_UNITS = 38  # 頭の高さ（ゲームの表示の大きさ）。この範囲の横幅を、頭の幅とする
WALK = [f'musubi_walk_{i:02d}' for i in range(1, 13)]
POSES = ['musubi_jump_up_right', 'musubi_fall_right', 'musubi_land_right', 'musubi_hit_right', 'musubi_sad_front', 'musubi_cheer_front_1', 'musubi_idle_right']


def base_scale(name, width):
    """ゲームの、基本の倍率（ForestRun.tsx と同じ式）"""
    if name.startswith('musubi_walk'):
        return (MUSUBI_H / 290) * (300 / width)
    return MUSUBI_H / 945


def head_width_display(name):
    im = Image.open(GAMES / f'{name}.png').convert('RGBA')
    a = im.split()[-1].point(lambda v: 255 if v > 40 else 0)
    bb = a.getbbox()
    sc = base_scale(name, im.width)
    rows = int(HEAD_UNITS / sc)
    band = a.crop((0, bb[1], im.width, min(im.height, bb[1] + rows)))
    hb = band.getbbox()
    return (hb[2] - hb[0]) * sc


def main():
    names = [n for n in WALK + POSES if (GAMES / f'{n}.png').exists()]
    widths = {n: head_width_display(n) for n in names}
    target = sorted(widths.values())[len(widths) // 2]
    adj = {n: round(max(0.8, min(1.25, target / w)), 4) for n, w in widths.items()}
    for n in names:
        print(f'{n}: head {widths[n]:.1f} -> x{adj[n]}')
    (GAMES / 'musubi_scale.json').write_text(json.dumps(adj, indent=1), encoding='utf-8')
    print('target head width', round(target, 1))


if __name__ == '__main__':
    sys.exit(main())
