# -*- coding: utf-8 -*-
"""待ち時間ミニゲームの絵コンテ（画面の配置図）を作る。素材づくりの参考用で、完成の絵ではない。
実行: python make_storyboards.py   → 同じフォルダに 01_forest_run.png など（1080x1920）を書き出す
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'frontend', 'public', 'assets')
W, H = 1080, 1920
F = lambda size, bold=False: ImageFont.truetype('C:/Windows/Fonts/meiryob.ttc' if bold else 'C:/Windows/Fonts/meiryo.ttc', size)
INK = (255, 255, 255)
RED = (255, 90, 90)


def load(path, size=None, crop=None):
    im = Image.open(os.path.join(ASSETS, path)).convert('RGBA')
    if crop:
        im = im.crop(crop)
    if size:
        im = im.resize(size, Image.LANCZOS)
    return im


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def base(bg_path, tint=None, crop_center=None):
    bg = load(bg_path)
    if crop_center:
        cx = int(bg.width * crop_center)
        bg = bg.crop((max(0, cx - bg.height * 9 // 32), 0, min(bg.width, cx + bg.height * 9 // 32), bg.height))
    img = cover(bg, W, H).convert('RGBA')
    if tint:
        img = Image.alpha_composite(img, Image.new('RGBA', (W, H), tint))
    return img


def text(d, xy, s, size=40, fill=INK, bold=False, anchor='la', stroke=0):
    d.text(xy, s, font=F(size, bold), fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=(0, 0, 0))


def pill(d, box, fill=(20, 12, 40, 200), outline=(201, 162, 75, 255), r=28, w=3):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=w)


def hud(img, title, status='診断中…'):
    """共通の画面の部品：一時停止、状況、結果ボタンの出る場所"""
    d = ImageDraw.Draw(img, 'RGBA')
    pill(d, (36, 36, 176, 150))
    d.rectangle((84, 66, 98, 118), fill=INK)
    d.rectangle((114, 66, 128, 118), fill=INK)
    text(d, (196, 92), title, 44, bold=True, anchor='lm', stroke=3)
    pill(d, (W - 330, 46, W - 36, 138))
    text(d, (W - 183, 92), status, 36, anchor='mm')
    # 結果ボタンの出る場所
    d.rounded_rectangle((W - 520, H - 190, W - 36, H - 60), radius=34, outline=(255, 214, 102, 255), width=5)
    for i in range(0, 484, 28):
        d.line((W - 520 + i, H - 190, W - 520 + i + 14, H - 190), fill=(20, 12, 40, 255), width=5)
    text(d, (W - 278, H - 125), '診断ができたら\n「結果を見る」', 36, fill=(255, 214, 102), anchor='mm')
    return d


def note(d, xy, s, to=None, size=34):
    """素材の注釈（赤）"""
    x, y = xy
    lines = s.split('\n')
    w = max(d.textlength(l, font=F(size)) for l in lines) + 28
    h = len(lines) * (size + 10) + 18
    x = max(16, min(x, W - 16 - w))
    d.rounded_rectangle((x, y, x + w, y + h), radius=14, fill=(0, 0, 0, 190), outline=RED, width=3)
    for i, l in enumerate(lines):
        text(d, (x + 14, y + 10 + i * (size + 10)), l, size, fill=(255, 190, 190))
    if to:
        d.line((x + w / 2, y + h, to[0], to[1]), fill=RED, width=4)
        d.ellipse((to[0] - 9, to[1] - 9, to[0] + 9, to[1] + 9), fill=RED)


def acorn(d, cx, cy, r=46, gold=False):
    body = (222, 160, 80) if not gold else (255, 214, 60)
    d.ellipse((cx - r * .8, cy - r * .5, cx + r * .8, cy + r * 1.1), fill=body, outline=(110, 70, 30), width=4)
    d.pieslice((cx - r * .95, cy - r * 1.05, cx + r * .95, cy + r * .45), 180, 360, fill=(120, 80, 40), outline=(70, 40, 20), width=4)
    d.line((cx, cy - r * 1.05, cx + 6, cy - r * 1.4), fill=(70, 40, 20), width=6)


def stump(d, x, y, w=150, h=120):
    d.rectangle((x, y - h, x + w, y), fill=(120, 80, 50), outline=(60, 35, 20), width=4)
    d.ellipse((x - 4, y - h - 22, x + w + 4, y - h + 22), fill=(170, 120, 80), outline=(60, 35, 20), width=4)


def rock(d, x, y, w=150, h=100):
    d.ellipse((x, y - h, x + w, y + 10), fill=(120, 125, 135), outline=(60, 62, 70), width=4)


def glow(img, cx, cy, r, color):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(r / 2))
    img.alpha_composite(layer)


def musubi(img, x, y, h, path='run/frames/f00.webp', flip=False):
    m = load(path)
    s = h / m.height
    m = m.resize((int(m.width * s), h), Image.LANCZOS)
    if flip:
        m = m.transpose(Image.FLIP_LEFT_RIGHT)
    img.alpha_composite(m, (x - m.width // 2, y - m.height))
    return m


def save(img, name):
    img.convert('RGB').save(os.path.join(HERE, name))
    print('saved', name)


# ---- 01 森ラン ----
def runner():
    img = base('tree005.jpg', tint=(10, 30, 10, 60))
    d = ImageDraw.Draw(img, 'RGBA')
    gy = 1500
    d.rectangle((0, gy, W, H), fill=(70, 100, 50, 255))
    d.rectangle((0, gy, W, gy + 18), fill=(110, 150, 70, 255))
    for i in range(0, W, 90):
        d.line((i, gy + 60, i + 40, gy + 60), fill=(50, 75, 40, 255), width=6)
    stump(d, 640, gy + 6)
    rock(d, 880, gy + 6)
    d.ellipse((330, gy - 6, 520, gy + 36), fill=(90, 150, 200, 220))  # 水たまり
    musubi(img, 300, gy + 40, 230)
    d = hud(img, 'ムスビの森ラン')
    text(d, (W // 2, 230), '120 m', 96, bold=True, anchor='mm', stroke=5)
    text(d, (W // 2, 330), 'ゴールまで あと 80 m', 38, anchor='mm', stroke=3)
    text(d, (W // 2, 1690), '画面のどこかをタップで ジャンプ', 44, bold=True, anchor='mm', stroke=4)
    note(d, (60, 400), '背景：森の道（横にループ）\n奥・中・手前の3層\n高さ1920×幅2160以上', to=(300, 700))
    note(d, (60, 1000), '障害物：切り株・石・水たまり\n低い枝（くぐる）・キノコ', to=(700, 1450))
    note(d, (60, 1600), 'ムスビ：右向きで走る（連番）\nジャンプ・着地・ミス・喜ぶ', to=(300, 1420))
    note(d, (520, 560), '地面：道のタイル\n（繰り返し）', to=(540, 1520))
    save(img, '01_forest_run.png')


# ---- 02 どんぐりキャッチ ----
def catch():
    img = base('tree005.jpg', tint=(30, 20, 5, 80))
    d = ImageDraw.Draw(img, 'RGBA')
    import random
    random.seed(7)
    for (x, y, g) in [(200, 420, False), (520, 560, False), (820, 380, True), (350, 880, False), (700, 1000, False), (900, 1250, False), (140, 1180, False)]:
        acorn(d, x, y, 50 if not g else 60, g)
    # 毒キノコ
    d.ellipse((560, 1180, 720, 1280), fill=(200, 50, 60, 255), outline=(90, 20, 30), width=5)
    d.rectangle((616, 1260, 664, 1340), fill=(240, 230, 210, 255), outline=(120, 110, 90), width=4)
    for (px, py) in [(600, 1215), (650, 1200), (690, 1230)]:
        d.ellipse((px - 10, py - 10, px + 10, py + 10), fill=(255, 255, 255, 255))
    m = musubi(img, 540, 1760, 560, 'characters/0-musubi/ham002.webp')
    d = hud(img, 'どんぐりキャッチ')
    pill(d, (W // 2 - 220, 190, W // 2 + 220, 290))
    text(d, (W // 2, 240), 'どんぐり 7 / 20', 44, bold=True, anchor='mm')
    d.line((300, 1400, 780, 1400), fill=(255, 255, 255, 220), width=8)
    d.polygon([(280, 1400), (330, 1370), (330, 1430)], fill=(255, 255, 255, 220))
    d.polygon([(800, 1400), (750, 1370), (750, 1430)], fill=(255, 255, 255, 220))
    text(d, (W // 2, 1470), 'ドラッグで 左右に移動', 40, bold=True, anchor='mm', stroke=4)
    note(d, (40, 330), 'どんぐり：通常／大／金', to=(200, 420))
    note(d, (40, 700), '避けるもの：毒キノコ・虫', to=(640, 1200))
    note(d, (40, 1500), 'ムスビ：左右移動（右向き＋反転）\n受け止める・ほおばる・ミス', to=(420, 1600))
    note(d, (560, 330), '背景：木の下（1枚）\n1080×2400', to=(800, 480))
    save(img, '02_acorn_catch.png')


# ---- 03 どんぐり積み ----
def stack():
    img = base('room001.jpg', tint=(10, 10, 40, 120), crop_center=0.5)
    d = ImageDraw.Draw(img, 'RGBA')
    gy = 1650
    d.rectangle((0, gy, W, H), fill=(60, 45, 35, 255))
    d.rectangle((330, gy - 20, 750, gy + 60), fill=(130, 90, 55, 255), outline=(60, 35, 20), width=5)  # 切り株の土台
    cols = [(224, 170, 110), (210, 150, 90), (232, 185, 120), (200, 140, 85), (225, 165, 100)]
    x0, w, h = 340, 400, 120
    xs = [0, 30, -20, 40, 10]
    for i in range(5):
        y = gy - 20 - (i + 1) * h
        d.rounded_rectangle((x0 + xs[i], y, x0 + xs[i] + w - i * 14, y + h - 6), radius=18, fill=cols[i] + (255,), outline=(100, 60, 30), width=5)
        acorn(d, x0 + xs[i] + (w - i * 14) // 2, y + 58, 28)
    # 動く箱
    y = 340
    d.rounded_rectangle((200, y, 600, y + 114), radius=18, fill=(240, 195, 130, 255), outline=(100, 60, 30), width=5)
    acorn(d, 400, y + 56, 28)
    d.line((120, y + 57, 190, y + 57), fill=(255, 255, 255, 220), width=8)
    d.polygon([(100, y + 57), (140, y + 30), (140, y + 84)], fill=(255, 255, 255, 220))
    d.polygon([(900, y + 57), (860, y + 30), (860, y + 84)], fill=(255, 255, 255, 220))
    d.line((610, y + 57, 860, y + 57), fill=(255, 255, 255, 220), width=8)
    # 高さの目標線
    d.line((60, 520, W - 60, 520), fill=(255, 214, 102, 255), width=5)
    text(d, (W - 60, 490), '目標の高さ（10段）', 34, fill=(255, 214, 102), anchor='rm', stroke=3)
    musubi(img, 880, 1700, 300, 'characters/0-musubi/ham004.webp')
    d = hud(img, 'どんぐり積み')
    pill(d, (W // 2 - 200, 190, W // 2 + 200, 290))
    text(d, (W // 2, 240), '5 / 10 段', 48, bold=True, anchor='mm')
    text(d, (W // 2, 1720), 'タップで 箱を落とす', 44, bold=True, anchor='mm', stroke=4)
    note(d, (40, 640), '積む箱：木の板／どんぐり箱など\n3〜4種（同じ幅で積める形）', to=(420, 1300))
    note(d, (40, 1740 - 120), '土台：切り株', to=(500, 1650))
    note(d, (40, 900), '背景：夜の森の広場', to=(160, 800))
    note(d, (640, 1450), 'ムスビ：てっぺんを見上げる\n喜ぶ／がっかり', to=(880, 1560))
    save(img, '03_acorn_stack.png')


# ---- 04 ルーン神経衰弱 ----
def memory():
    img = base('room001.jpg', tint=(40, 20, 10, 110), crop_center=0.3)
    d = ImageDraw.Draw(img, 'RGBA')
    # 机の布
    d.rounded_rectangle((60, 300, W - 60, 1400), radius=50, fill=(50, 20, 60, 230), outline=(201, 162, 75, 255), width=6)
    glyphs = ['☆', '☾', '✿', '☼', '❖', '♨', '☁', '◆']
    open_idx = {1: 0, 6: 0, 9: 3}
    cols, rows = 3, 4
    cw, ch, gap = 280, 235, 26
    ox = (W - (cols * cw + (cols - 1) * gap)) // 2
    oy = 340
    n = 0
    for r in range(rows):
        for c in range(cols):
            x = ox + c * (cw + gap)
            y = oy + r * (ch + gap)
            if n in open_idx:
                d.rounded_rectangle((x, y, x + cw, y + ch), radius=26, fill=(250, 240, 215, 255), outline=(201, 162, 75, 255), width=5)
                text(d, (x + cw // 2, y + ch // 2), glyphs[open_idx[n] % len(glyphs)], 120, fill=(90, 40, 120), anchor='mm')
            else:
                d.rounded_rectangle((x, y, x + cw, y + ch), radius=26, fill=(90, 50, 140, 255), outline=(201, 162, 75, 255), width=5)
                text(d, (x + cw // 2, y + ch // 2), '✦', 90, fill=(201, 162, 75), anchor='mm')
            n += 1
    musubi(img, 200, 1840, 420, 'characters/0-musubi/ham001.webp')
    d = hud(img, 'ルーン神経衰弱')
    pill(d, (W // 2 - 380, 190, W // 2 - 20, 290))
    text(d, (W // 2 - 200, 240), 'のこり 1:12', 44, bold=True, anchor='mm')
    pill(d, (W // 2 + 20, 190, W // 2 + 380, 290))
    text(d, (W // 2 + 200, 240), 'そろえた 2 / 6', 44, bold=True, anchor='mm')
    note(d, (60, 1450), 'カード裏面（1種）／表面のルーン8種\n（星・月・花・太陽・葉・水・火・石 など）', to=(400, 1380))
    note(d, (60, 1620), 'ムスビ：指さし／喜ぶ', to=(200, 1560))
    note(d, (560, 1450), '背景：机の上の布（紫）\n＋ 揃ったときの きらめき効果', to=(700, 600))
    save(img, '04_rune_memory.png')


# ---- 05 ほたる光らせ ----
def fireflies():
    img = base('indexNight001.jpg', tint=(0, 0, 20, 60), crop_center=0.3)
    d = ImageDraw.Draw(img, 'RGBA')
    ring = (540, 900)
    glow(img, ring[0], ring[1], 220, (255, 240, 150, 110))
    d = ImageDraw.Draw(img, 'RGBA')
    d.ellipse((ring[0] - 170, ring[1] - 170, ring[0] + 170, ring[1] + 170), outline=(255, 240, 150, 255), width=10)
    d.ellipse((ring[0] - 120, ring[1] - 120, ring[0] + 120, ring[1] + 120), outline=(255, 240, 150, 120), width=4)
    flies = [(130, 700, 1.0), (330, 790, 1.0), (540, 880, 1.4), (800, 1000, 1.0), (960, 1080, 0.8)]
    for (x, y, s) in flies:
        glow(img, x, y, int(46 * s), (200, 255, 120, 200))
    d = ImageDraw.Draw(img, 'RGBA')
    for (x, y, s) in flies:
        d.ellipse((x - 14 * s, y - 14 * s, x + 14 * s, y + 14 * s), fill=(255, 255, 200, 255))
        d.ellipse((x - 30 * s, y - 14 * s, x - 8 * s, y + 4 * s), fill=(220, 240, 255, 150))
        d.ellipse((x + 8 * s, y - 14 * s, x + 30 * s, y + 4 * s), fill=(220, 240, 255, 150))
    d.line((130, 700, 960, 1080), fill=(255, 255, 255, 60), width=3)
    musubi(img, 300, 1860, 640, 'characters/0-musubi/ham003.webp')
    glow(img, 420, 1500, 130, (255, 200, 100, 150))
    d = hud(img, 'ほたる光らせ')
    pill(d, (W // 2 - 200, 190, W // 2 + 200, 290))
    text(d, (W // 2, 240), '成功 4 / 10', 46, bold=True, anchor='mm')
    text(d, (W // 2, 1250), '光の輪に入ったら タップ！', 46, bold=True, anchor='mm', stroke=5)
    note(d, (40, 340), '背景：暗い森の夜（1枚）', to=(200, 500))
    note(d, (40, 520), 'ほたる：光る体／光らない体\n（羽ばたく連番2〜3コマ）', to=(330, 770))
    note(d, (620, 560), '光の輪：2状態\n（待機／成功で広がる）', to=(640, 760))
    note(d, (560, 1400), 'ムスビ：ランタンを持って見守る\n（ランタンの灯りの効果）', to=(430, 1520))
    save(img, '05_firefly_tap.png')


if __name__ == '__main__':
    runner()
    catch()
    stack()
    memory()
    fireflies()
