# -*- coding: utf-8 -*-
"""
走り（musubi_walk_01〜）のコマごとの、色の違いを、部位ごとにそろえる。
- 全体の色をそろえる match_musubi_colors.py のあとに、実行する（ムスビの走りコマ専用）
- 部位（マント・灰色の毛・白い毛・ピンクの手足）ごとに、Lab色空間で、平均と広がりを、全コマの中央値にそろえる
  （マントが、コマによって、明るかったり暗かったりするのを、直す）
- 輪郭は、なめらかに混ぜる（マスクを、ぼかして、境目が、目立たないように）
使い方: python tools/match_walk_regions.py   （依存: numpy, Pillow）
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

GAMES = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'assets' / 'games'
CLASSES = ['cloak', 'fur_grey', 'fur_light', 'skin']
MIN_PIXELS = 3000  # これより少ない部位は、そろえない（統計が、あてにならない）
STD_CLAMP = (0.85, 1.15)


def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab_to_srgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200

    def inv(f):
        return np.where(f ** 3 > 216 / 24389, f ** 3, (116 * f - 16) / (24389 / 27))

    xyz = np.stack([inv(fx), inv(fy), inv(fz)], -1) * np.array([0.95047, 1.0, 1.08883])
    m = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560], [0.0556434, -0.2040259, 1.0572252]])
    c = xyz @ m.T
    c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return np.clip(c * 255, 0, 255)


def hsv(rgb):
    x = rgb / 255.0
    mx = x.max(-1)
    mn = x.min(-1)
    d = mx - mn + 1e-9
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return h, d / np.maximum(mx, 1e-9), mx


def masks(a):
    rgb = a[..., :3].astype(float)
    h, s, v = hsv(rgb)
    solid = a[..., 3] > 200
    cloak = solid & (h > 35) & (h < 110) & (s > 0.3) & (v < 0.75)
    skin = solid & ~cloak & (rgb[..., 0] > rgb[..., 1] + 25) & (rgb[..., 0] > rgb[..., 2] + 25) & (rgb[..., 0] > 170)
    rest = solid & ~cloak & ~skin & (s < 0.25)
    return {'cloak': cloak, 'skin': skin, 'fur_grey': rest & (v <= 0.72), 'fur_light': rest & (v > 0.72)}


def soft(mask):
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.0))
    return np.asarray(im).astype(float) / 255.0


def stats(lab, m):
    px = lab[m]
    return px.mean(0), px.std(0) + 1e-6


def main():
    paths = sorted(GAMES.glob('musubi_walk_*.png'))
    arrs = [np.array(Image.open(p).convert('RGBA')) for p in paths]
    labs = [srgb_to_lab(a[..., :3].astype(float)) for a in arrs]
    ms = [masks(a) for a in arrs]
    target = {}
    for cl in CLASSES:
        pairs = [stats(l, m[cl]) for l, m in zip(labs, ms) if m[cl].sum() >= MIN_PIXELS]
        if pairs:
            target[cl] = (np.median([p[0] for p in pairs], 0), np.median([p[1] for p in pairs], 0))
    for p, a, lab, m in zip(paths, arrs, labs, ms):
        out = lab.copy()
        for cl in CLASSES:
            if cl not in target or m[cl].sum() < MIN_PIXELS:
                continue
            mean, std = stats(lab, m[cl])
            tmean, tstd = target[cl]
            ratio = np.clip(tstd / std, *STD_CLAMP)
            moved = (lab - mean) * ratio + tmean
            w = soft(m[cl])[..., None]
            out = out * (1 - w) + moved * w
        rgb = lab_to_srgb(out)
        res = a.copy()
        res[..., :3] = np.where((a[..., 3] > 0)[..., None], rgb, a[..., :3]).astype(np.uint8)
        Image.fromarray(res, 'RGBA').save(p)
        print(p.name, 'ok', {cl: int(m[cl].sum()) for cl in CLASSES})


if __name__ == '__main__':
    sys.exit(main())
