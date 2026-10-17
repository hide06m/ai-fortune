# -*- coding: utf-8 -*-
"""単色の背景で生成した画像から、背景を透明にして、余白を切り詰める。
使い方: python tools/chroma_key.py 入力.png 出力.png [--inner] [--thresh 60] [--keep-margin 8]
  背景は、画像の四隅と同じ色の、つながった部分を透明にする（--inner を付けると、中央からも透明にする。枠の絵用）。
  縁は少しだけぼかして、色の混じりを減らす。
  --black を付けると、黒い背景で作った「光の効果」用：明るさをそのまま透明度にする（光・きらめき・星くず用）。
"""
import argparse
from PIL import Image, ImageDraw, ImageFilter, ImageChops


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--inner', action='store_true', help='中央からも背景を抜く（枠の絵）')
    ap.add_argument('--thresh', type=int, default=60, help='背景色と見なす色の差の許容')
    ap.add_argument('--global-key', action='store_true', help='背景色に近い画素を、つながっていなくても、すべて透明にする（絵の中に、背景と同じ色の穴があるとき）')
    ap.add_argument('--black', action='store_true', help='黒背景の光の効果：明るさを透明度にする')
    ap.add_argument('--keep-margin', type=int, default=8, help='切り詰めた後に残す余白（px）')
    a = ap.parse_args()

    im = Image.open(a.src).convert('RGBA')
    w, h = im.size
    if a.black:
        rgb = im.convert('RGB')
        r, g, b = rgb.split()
        alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)
        # 黒のわずかな明るさ（圧縮のノイズ）は、透明にする
        alpha = alpha.point(lambda v: 0 if v < 16 else min(255, (v - 16) * 255 // 239))
        # 色は、透明度で割り戻して、明るく戻す
        out = Image.new('RGBA', (w, h))
        po, pa, pr = out.load(), alpha.load(), rgb.load()
        for y in range(h):
            for x in range(w):
                av = pa[x, y]
                if av == 0:
                    po[x, y] = (0, 0, 0, 0)
                else:
                    c = pr[x, y]
                    po[x, y] = (min(255, c[0] * 255 // av), min(255, c[1] * 255 // av), min(255, c[2] * 255 // av), av)
        box = alpha.point(lambda v: 255 if v > 12 else 0).getbbox()
        if box:
            m = a.keep_margin
            out = out.crop((max(0, box[0] - m), max(0, box[1] - m), min(w, box[2] + m), min(h, box[3] + m)))
        out.save(a.dst)
        print('saved', a.dst, out.size)
        return
    marker = (255, 0, 255, 0)  # 透明にした目印
    work = im.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    if a.inner:
        seeds.append((w // 2, h // 2))
    for s in seeds:
        ImageDraw.floodfill(work, s, marker, thresh=a.thresh)
    if a.global_key:
        bg0 = im.convert('RGB').getpixel((0, 0))
        src_px = im.load()
        wp = work.load()
        for y in range(h):
            for x in range(w):
                c = src_px[x, y]
                if abs(c[0] - bg0[0]) + abs(c[1] - bg0[1]) + abs(c[2] - bg0[2]) < a.thresh * 2:
                    wp[x, y] = marker
    alpha = Image.new('L', (w, h), 255)
    px = work.load()
    ap_ = alpha.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0:
                ap_[x, y] = 0
    # 縁：1px ほど内側へ削り、少しぼかす（背景色の縁取りを減らす）
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(alpha)
    # 縁の色かぶり（背景色のにじみ）を取る：縁の近くの画素で、背景色の成分が飛び出しているものを、他の成分に合わせて落とす
    bgc = Image.open(a.src).convert('RGB').getpixel((0, 0))
    dom = max(range(3), key=lambda i: bgc[i])
    near_edge = alpha.filter(ImageFilter.MinFilter(9))  # これが255でない画素＝縁の近く
    pix, ne, al = im.load(), near_edge.load(), alpha.load()
    for y in range(h):
        for x in range(w):
            if al[x, y] > 0 and ne[x, y] < 255:
                r, g, b, aa = pix[x, y]
                c = [r, g, b]
                others = max(c[i] for i in range(3) if i != dom)
                if c[dom] > others + 12:
                    c[dom] = others + 4
                    pix[x, y] = (c[0], c[1], c[2], aa)
    box = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        m = a.keep_margin
        box = (max(0, box[0] - m), max(0, box[1] - m), min(w, box[2] + m), min(h, box[3] + m))
        im = im.crop(box)
    im.save(a.dst)
    print('saved', a.dst, im.size)


if __name__ == '__main__':
    main()
