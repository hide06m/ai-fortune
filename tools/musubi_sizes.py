"""
ムスビの、各コマ（歩き12・ジャンプ・落下・着地・ぶつかる・がっかり・喜ぶ・待機）の、顔の大きさと位置を、そろえる。
- 大きさ：顔の高さ（耳の上から、あご＝白い口まわりの下まで）を、ゲームでの表示の大きさで測り、歩きのコマの中央値に合わせる倍率
- 位置：顔の中心（白い口まわり）の横の位置を測り、ゲームで、どのコマも、顔が同じ場所に来るようにする
出力: frontend/public/assets/games/musubi_scale.json  { 名前: { a: 倍率, fx: 顔の中心の横位置（画像の幅に対する割合） } }
使い方: split_run_sheet.py と match_musubi_colors.py のあとに、python tools/musubi_sizes.py
"""
import json
import sys
from pathlib import Path

from PIL import Image

GAMES = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'assets' / 'games'
MUSUBI_H = 132
CLOAK_W = 0.6  # 走りのコマの、位置をそろえる点：顔とマントの重心の、混ぜ方（1に近いほど、マント寄り）
WALK = [p.stem for p in sorted(GAMES.glob('musubi_walk_*.png'))]
POSES = ['musubi_jump_up_right', 'musubi_fall_right', 'musubi_land_right', 'musubi_hit_right', 'musubi_sad_front', 'musubi_cheer_front_1', 'musubi_idle_right']


def base_scale(name, width):
    """ゲームの、基本の倍率（ForestRun.tsx と同じ式）"""
    if name.startswith('musubi_walk'):
        return (MUSUBI_H / 290) * (300 / width)
    return MUSUBI_H / 945


def face_metrics(name):
    """(顔の高さ［ゲームでの表示の大きさ］, 顔の中心の横の割合)"""
    im = Image.open(GAMES / f'{name}.png').convert('RGBA')
    px = im.load()
    bb = im.split()[-1].point(lambda v: 255 if v > 128 else 0).getbbox()
    lim = bb[1] + int((bb[3] - bb[1]) * 0.42)  # 頭の部分（上から42%）
    ys, xs = [], []
    for y in range(bb[1], lim):
        for x in range(bb[0], bb[2]):
            r, g, b, al = px[x, y]
            if al > 200 and r > 205 and g > 190 and b > 150 and 12 < r - b < 75:  # 白〜クリーム色（口まわり）
                ys.append(y)
                xs.append(x)
    ys.sort()
    chin = ys[int(len(ys) * 0.98)]
    sc = base_scale(name, im.width)
    face_x = (sum(xs) / len(xs)) / im.width
    if True:  # 全コマに適用（コマが変わったときに、顔が、ぴょこんと、ずれないように）
        # 走りのコマは、体が前に傾くコマと、起きているコマがある。顔だけで位置をそろえると、傾いたコマで、おしり・マントが、後ろに、出すぎる。
        # マント（オリーブ色）の重心も、基準に混ぜる（顔とマントの、まん中を、そろえる点にする）
        cx, cn = 0, 0
        for y in range(bb[1], bb[3]):
            for x in range(bb[0], bb[2], 2):
                r, g, b, al = px[x, y]
                if al > 200 and g > r and g > b + 15 and r < 150:
                    cx += x
                    cn += 1
        if cn:
            cloak_x = cx / cn / im.width
            face_x = face_x * (1 - CLOAK_W) + cloak_x * CLOAK_W
    return (chin - bb[1]) * sc, face_x


def main():
    names = [n for n in WALK + POSES if (GAMES / f'{n}.png').exists()]
    m = {n: face_metrics(n) for n in names}
    walk_heights = sorted(m[n][0] for n in names if n in WALK)
    target = walk_heights[len(walk_heights) // 2]
    out = {}
    for n in names:
        h, fx = m[n]
        out[n] = {'a': round(max(0.8, min(1.3, target / h)), 4), 'fx': round(fx, 4)}
        print(f'{n}: face height {h:.1f} -> x{out[n]["a"]}, face x {fx:.3f}')
    (GAMES / 'musubi_scale.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
    print('target face height', round(target, 1))


if __name__ == '__main__':
    sys.exit(main())
