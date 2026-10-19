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


def cut_sheet(sheet):
    """シート1枚から、コマを切り出す（左から右、上の行から下の行）"""
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
    return crops


def main():
    # 高解像度版：musubi_run_sheet_hq1.png, _hq2.png … があれば、その順に全部使う（コマは、シートの順につなぐ）
    hq = sorted(GAMES.glob('musubi_run_sheet_hq*.png'))
    big = GAMES / 'musubi_run_sheet_2x.png'
    if hq:
        srcs = hq
    else:
        srcs = [big if big.exists() else GAMES / 'musubi_run_sheet.png']
    crops = []
    for src in srcs:
        sheet = Image.open(src).convert('RGBA')
        part = cut_sheet(sheet)
        print('source', src.name, sheet.size, '->', len(part), 'frames')
        crops += part
    # 出力の大きさの倍率：切り出したコマの、体の高さ（中央値）から決める。基準（k=1）は、体の高さ約290。
    # 大きすぎると、スマホで重いので、最大3倍（900×1140）まで
    hs = sorted(f.size[1] for f in crops)
    if hq:
        k = max(1.0, min(3.0, round(hs[len(hs) // 2] / 290 * 2) / 2))
    else:
        k = 2 if big.exists() else 1
    CW, CH, BASE = int(CW0 * k), int(CH0 * k), int(BASE0 * k)
    print('k =', k, 'canvas', CW, CH)

    # 顔の大きさが、コマごとに違うので、顔の高さ（耳の上から、白い口まわりの下まで）を、全コマの中央値にそろえる
    def head_height(f):
        px = f.load()
        a_ = f.split()[-1]
        bb = a_.point(lambda v: 255 if v > 128 else 0).getbbox()
        lim = bb[1] + int((bb[3] - bb[1]) * 0.42)
        ys = []
        for y in range(bb[1], lim):
            for x in range(bb[0], bb[2]):
                r, g, b, al = px[x, y]
                if al > 200 and r > 205 and g > 190 and b > 150 and 12 < r - b < 75:
                    ys.append(y)
        ys.sort()
        return (ys[int(len(ys) * 0.98)] - bb[1]) if ys else f.size[1] * 0.2

    heights = sorted(head_height(f) for f in crops)
    median = heights[len(heights) // 2]
    frames = []
    for f in crops:
        kk = min(1.3, max(0.8, median / head_height(f)))
        if abs(kk - 1) > 0.01:
            f = f.resize((round(f.size[0] * kk), round(f.size[1] * kk)), Image.LANCZOS)
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
