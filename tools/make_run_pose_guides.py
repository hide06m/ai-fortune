# -*- coding: utf-8 -*-
"""
走りの姿勢ガイド（骨格図）を8枚作る。画像生成AIに「この姿勢で描いて」と添付する。
出力: frontend/public/assets/games/pose_guides/run_pose_1.png … run_pose_8.png と、8枚をならべた run_pose_all.png

ガイドの見方（右向き・横から見た図）
- 赤い太い線 ＝ カメラに近い側（手前）の腕と脚　／　青い細い線 ＝ 遠い側（奥）の腕と脚
- 丸＝頭、灰色の線＝背骨（前傾）。緑の横線＝地面
- 姿勢の基準（アニメーションの走りの8コマ）:
    1 接地（コンタクト）  2 沈み（ダウン）  3 すれちがい（パッシング）  4 跳ね（アップ・両足が浮く）
    5〜8 は、1〜4 の、手前と奥の、手足を入れかえたもの
"""
import math
import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public', 'assets', 'games', 'pose_guides')
W, H = 768, 1024
GROUND = 900
THIGH, SHIN, UPPER, FORE, TORSO, NECK = 150, 150, 85, 80, 230, 60
LEAN = 12  # 前傾（度）。走りは、歩きより、前に傾く

# 各角度は「真下からの角度」。前（右）が＋、後ろ（左）が−。
# near/far = 手前/奥。 leg = (もも, すね)、arm = (上腕, 前腕)
# lift = 両足を、地面から、浮かせる量（px）。none なら、いちばん低い足が、地面につく
POSES = {
    1: dict(name='contact', lift=0,
            near_leg=(32, 28), far_leg=(-38, -80),
            near_arm=(-40, -85), far_arm=(40, 100)),
    2: dict(name='down', lift=0,
            near_leg=(58, -28), far_leg=(-20, -105),
            near_arm=(-48, -95), far_arm=(25, 95)),
    3: dict(name='passing', lift=0,
            near_leg=(6, -4), far_leg=(52, -45),
            near_arm=(-12, 85), far_arm=(10, 85)),
    4: dict(name='up', lift=46,
            near_leg=(-32, -65), far_leg=(58, 22),
            near_arm=(55, 110), far_arm=(-55, -85)),
}


def pt(origin, length, deg):
    r = math.radians(deg)
    return (origin[0] + length * math.sin(r), origin[1] + length * math.cos(r))


def limb(d, origin, a1, a2, l1, l2, color, width):
    j = pt(origin, l1, a1)
    e = pt(j, l2, a2)
    d.line([origin, j, e], fill=color, width=width, joint='curve')
    d.ellipse([j[0] - width / 2, j[1] - width / 2, j[0] + width / 2, j[1] + width / 2], fill=color)
    d.ellipse([e[0] - width * 0.6, e[1] - width * 0.6, e[0] + width * 0.6, e[1] + width * 0.6], fill=color)
    return e


def foot_low(hip, a, b):
    k = pt(hip, THIGH, a)
    return pt(k, SHIN, b)[1]


def draw_pose(p, swap):
    img = Image.new('RGB', (W, H), (245, 245, 240))
    d = ImageDraw.Draw(img)
    d.line([(0, GROUND), (W, GROUND)], fill=(70, 150, 70), width=4)
    nl, fl = p['near_leg'], p['far_leg']
    na, fa = p['near_arm'], p['far_arm']
    if swap:  # 5〜8：手前と奥を、入れかえる
        nl, fl, na, fa = fl, nl, fa, na
    # 腰の高さ：いちばん低い足が、地面（＋浮き）にくるように
    hip0 = (W / 2, 0)
    low = max(foot_low(hip0, *nl), foot_low(hip0, *fl))
    hip_y = GROUND - p['lift'] - low + p.get('sink', 0)
    hip = (W / 2, hip_y)
    # 背骨・頭
    sh = pt(hip, -TORSO, -LEAN)  # 上へ（前に傾く）
    sh = (hip[0] + TORSO * math.sin(math.radians(LEAN)), hip[1] - TORSO * math.cos(math.radians(LEAN)))
    head = (sh[0] + NECK * math.sin(math.radians(LEAN)) + 20, sh[1] - NECK * math.cos(math.radians(LEAN)) - 55)
    d.line([hip, sh], fill=(110, 110, 110), width=14)
    # 奥（青・細い）→ 体 → 手前（赤・太い）の順に描く
    BLUE, RED = (60, 90, 220), (220, 50, 50)
    limb(d, hip, *fl, THIGH, SHIN, BLUE, 12)
    limb(d, sh, *fa, UPPER, FORE, BLUE, 10)
    d.ellipse([head[0] - 80, head[1] - 80, head[0] + 80, head[1] + 80], outline=(110, 110, 110), width=8)
    d.polygon([(head[0] + 80, head[1] - 4), (head[0] + 118, head[1] + 8), (head[0] + 80, head[1] + 22)], fill=(110, 110, 110))  # 鼻（向き）
    limb(d, hip, *nl, THIGH, SHIN, RED, 20)
    limb(d, sh, *na, UPPER, FORE, RED, 16)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    imgs = []
    for n in range(1, 9):
        base = POSES[(n - 1) % 4 + 1]
        img = draw_pose(base, swap=n > 4)
        img.save(os.path.join(OUT, f'run_pose_{n}.png'))
        imgs.append(img)
    sheet = Image.new('RGB', (W * 4 // 2, H * 2 // 2), (255, 255, 255))
    for i, im in enumerate(imgs):
        sheet.paste(im.resize((W // 2, H // 2)), ((i % 4) * (W // 2), (i // 4) * (H // 2)))
    sheet.save(os.path.join(OUT, 'run_pose_all.png'))
    print('ok', OUT)


if __name__ == '__main__':
    main()
