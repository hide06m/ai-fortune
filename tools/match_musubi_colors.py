"""
ムスビの、ゲーム用コマ（走る・ジャンプ・着地…）の色合いを、そろえる。
画像ごとに生成されるため、毛や服の色が少しずつ違い、走るアニメーションで色がちかちかする。
各コマの、色（Lab色空間の平均と広がり）を、全コマの平均に合わせる（アルファは、そのまま）。
使い方: python tools/process_game_assets.py のあとに、python tools/match_musubi_colors.py
（Pillow だけで動く。ImageCms で Lab に変換して、チャンネルごとに、平均と広がりを合わせる）
"""
import sys
from pathlib import Path

from PIL import Image, ImageCms, ImageStat

GAMES = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'assets' / 'games'
NAMES = [f'musubi_walk_{i:02d}' for i in range(1, 13)] + [
    'musubi_jump_up_right', 'musubi_fall_right', 'musubi_land_right', 'musubi_hit_right', 'musubi_idle_right',
]

SRGB = ImageCms.createProfile('sRGB')
LAB = ImageCms.createProfile('LAB')
TO_LAB = ImageCms.buildTransform(SRGB, LAB, 'RGB', 'LAB')
FROM_LAB = ImageCms.buildTransform(LAB, SRGB, 'LAB', 'RGB')


def stats(lab: Image.Image, mask: Image.Image):
    st = ImageStat.Stat(lab, mask)
    return st.mean, st.stddev


def main():
    frames = {}
    for n in NAMES:
        p = GAMES / f'{n}.png'
        if p.exists():
            im = Image.open(p).convert('RGBA')
            rgb = im.convert('RGB')
            alpha = im.split()[-1]
            mask = alpha.point(lambda v: 255 if v > 230 else 0)
            lab = ImageCms.applyTransform(rgb, TO_LAB)
            frames[n] = (alpha, mask, lab, *stats(lab, mask))
    means = [f[3] for f in frames.values()]
    stds = [f[4] for f in frames.values()]
    t_mean = [sum(m[c] for m in means) / len(means) for c in range(3)]
    t_std = [sum(s[c] for s in stds) / len(stds) for c in range(3)]
    print('target mean', [round(v, 1) for v in t_mean], 'std', [round(v, 1) for v in t_std])
    for n, (alpha, mask, lab, mean, std) in frames.items():
        chans = []
        for c, band in enumerate(lab.split()):
            gain = min(1.25, max(0.8, t_std[c] / max(std[c], 1e-6)))
            off = t_mean[c] - mean[c] * gain
            chans.append(band.point(lambda v, g=gain, o=off: max(0, min(255, int(round(v * g + o))))))
        out = ImageCms.applyTransform(Image.merge('LAB', chans), FROM_LAB)
        out = out.convert('RGBA')
        out.putalpha(alpha)
        out.save(GAMES / f'{n}.png')
        print(f'{n}: mean {[round(v, 1) for v in mean]} -> matched')


if __name__ == '__main__':
    sys.exit(main())
