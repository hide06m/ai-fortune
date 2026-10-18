"""
横にループする背景を、左右反転でつなぐと、中央の木が「双子」になる。
かといって、左右の端を、そのまま混ぜる（クロスフェード）と、二重に透けて、にごる。
そこで、左右の端が重なる部分で、絵の違いが、いちばん小さい「つなぎ線」を、探して（上から下へ、1列ずつ左右にずれてよい）、
その線の左は、右端の絵、右は、左端の絵を使い、線のまわりだけ、ほんの少し、ぼかして、つなぐ。
  python tools/make_loop.py runbg_mid2 [重ねる割合=0.22]   →  runbg_mid2_loop.png
絵の幅は、重ねた分だけ、短くなる。
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

GAMES = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'assets' / 'games'


def find_seam(tail: Image.Image, head: Image.Image):
    """重なる部分（tail と head、同じ大きさ）で、違いが最小になる、上から下への線（各行の x）"""
    w, h = tail.size
    diff = ImageChops.difference(tail, head)
    px = list(diff.getdata())
    cost = [[sum(px[y * w + x]) for x in range(w)] for y in range(h)]
    # 動的計画法：各行で、前の行の、左・真上・右から、いちばん安いものを選ぶ
    acc = [row[:] for row in cost]
    back = [[0] * w for _ in range(h)]
    for y in range(1, h):
        for x in range(w):
            best, bx = acc[y - 1][x], x
            if x > 0 and acc[y - 1][x - 1] < best:
                best, bx = acc[y - 1][x - 1], x - 1
            if x < w - 1 and acc[y - 1][x + 1] < best:
                best, bx = acc[y - 1][x + 1], x + 1
            acc[y][x] += best
            back[y][x] = bx
    x = min(range(w), key=lambda i: acc[h - 1][i])
    seam = [0] * h
    for y in range(h - 1, -1, -1):
        seam[y] = x
        x = back[y][x]
    return seam


def main():
    name = sys.argv[1]
    frac = float(sys.argv[2]) if len(sys.argv) > 2 else 0.22
    im = Image.open(GAMES / f'{name}.png').convert('RGBA')
    W, H = im.size
    ov = int(W * frac)
    out_w = W - ov
    out = im.crop((0, 0, out_w, H))
    tail = im.crop((W - ov, 0, W, H))  # 右の端
    head = im.crop((0, 0, ov, H))  # 左の端
    seam = find_seam(tail, head)
    # つなぎ線の左は tail、右は head（マスク 255 = tail）
    mask = Image.new('L', (ov, H), 0)
    mp = mask.load()
    for y in range(H):
        for x in range(seam[y]):
            mp[x, y] = 255
    mask = mask.filter(ImageFilter.GaussianBlur(2.5))
    blended = Image.composite(tail, head, mask)
    out.paste(blended, (0, 0))
    out.save(GAMES / f'{name}_loop.png')
    print(f'{name}_loop.png', out.size, 'seam x range', min(seam), max(seam))


if __name__ == '__main__':
    sys.exit(main())
