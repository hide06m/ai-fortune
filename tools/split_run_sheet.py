"""
ムスビの、走り（歩き）シート（背景を抜いた musubi_run_sheet.png）を、1コマずつに切り分ける。
- 横のまとまり（列）と、縦のまとまり（行）を、透明な隙間から、自動で見つける
- 各コマは、同じ大きさのキャンバスに、足もとを下の端にそろえ、上半身（頭・マント）の重心を、中央にそろえて置く
出力: frontend/public/assets/games/musubi_walk_01.png … （左から右、上の行から下の行の順）
使い方: python tools/process_game_assets.py のあとに、python tools/split_run_sheet.py
"""
import sys
from pathlib import Path

from PIL import Image

GAMES = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'assets' / 'games'
CW0, CH0 = 300, 380  # 基準の大きさ（シートが2倍なら、全部2倍にする）
BASE0 = 360  # 足もとの基準線（キャンバスの上から）
BOB_KEEP = 0.2  # 体の上下のゆれを、残す割合（小さいほど、上下しない）


def runs(flags):
    out, s = [], None
    for i, f in enumerate(list(flags) + [False]):
        if f and s is None:
            s = i
        if not f and s is not None:
            out.append((s, i))
            s = None
    return out


def main():
    # 高画質版（musubi_run_sheet_2x.png）があれば、そちらを使い、切り出すコマも、2倍の大きさにする
    big = GAMES / 'musubi_run_sheet_2x.png'
    src = big if big.exists() else GAMES / 'musubi_run_sheet.png'
    sheet = Image.open(src).convert('RGBA')
    k = 2 if big.exists() else 1
    CW, CH, BASE = CW0 * k, CH0 * k, BASE0 * k
    print('source', src.name, sheet.size, 'k =', k)
    W, H = sheet.size
    a = sheet.split()[-1].point(lambda v: 255 if v > 128 else 0)
    rows = runs([a.crop((0, y, W, y + 1)).getbbox() is not None for y in range(H)])
    crops = []
    for (y0, y1) in rows:
        band = a.crop((0, y0, W, y1))
        cols = runs([band.crop((x, 0, x + 1, y1 - y0)).getbbox() is not None for x in range(W)])
        for (x0, x1) in cols:
            frame = sheet.crop((x0, y0, x1, y1))
            # 背景の青が、しっぽの半透明の部分に残るので、青っぽい画素は消す
            px0 = frame.load()
            for yy in range(frame.height):
                for xx in range(frame.width):
                    r, g, b, al = px0[xx, yy]
                    if al and b > r + 40 and b > g + 40:
                        px0[xx, yy] = (r, g, b, 0)
            frame = frame.crop(frame.split()[-1].getbbox())
            crops.append(frame)

    # 顔の大きさが、コマごとに少し違い、顔がぶるぶる動いて見えるので、頭の幅を、全コマの中央値にそろえる
    def head_width(f):
        h = f.split()[-1].crop((0, 0, f.size[0], 85 * k)).point(lambda v: 255 if v > 128 else 0)
        bb = h.getbbox()
        return (bb[2] - bb[0]) if bb else f.size[0]

    widths = sorted(head_width(f) for f in crops)
    median = widths[len(widths) // 2]
    frames = []
    for f in crops:
        k = min(1.18, max(0.85, median / head_width(f)))
        if abs(k - 1) > 0.01:
            f = f.resize((round(f.size[0] * k), round(f.size[1] * k)), Image.LANCZOS)
        fa = f.split()[-1]
        fw, fh = f.size
        # 上半身（上から45%）の、重心の横位置
        top = fa.crop((0, 0, fw, int(fh * 0.45))).point(lambda v: 255 if v > 128 else 0)
        xs, tot = 0, 0
        px = top.load()
        for yy in range(top.height):
            for xx in range(top.width):
                if px[xx, yy]:
                    xs += xx
                    tot += 1
        frames.append((f, xs / tot if tot else fw / 2))

    # 体の上下のゆれが大きすぎるので、頭の高さを、平均に近づける（足の高さは、そのぶん、動く）
    tops = [BASE - f.size[1] for f, _ in frames]
    mean_top = sum(tops) / len(tops)
    for n, ((frame, cx), top) in enumerate(zip(frames, tops), start=1):
        target_top = mean_top + (top - mean_top) * BOB_KEEP
        canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        ox = int(round(CW / 2 - cx))
        canvas.alpha_composite(frame, (ox, int(round(target_top))))
        canvas.save(GAMES / f'musubi_walk_{n:02d}.png')
    print(f'{len(frames)} frames -> musubi_walk_01..{len(frames):02d}')


if __name__ == '__main__':
    sys.exit(main())
