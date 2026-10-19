"""
鳥の羽ばたきシート（背景を抜いた run_bird_high_sheet.png など。横1列の4コマ）を、1コマずつに切り分ける。
- ゲームの中の鳥は、左へ飛ぶので、左右を反転して書き出す（シートの鳥は右向き）
- 各コマは、同じ大きさのキャンバスに、足もとを下にそろえ、体の中心を横にそろえて置く
出力: frontend/public/assets/games/run_bird_1.png … run_bird_4.png
使い方: python tools/process_game_assets.py のあとに、python tools/split_bird_sheet.py [シート名=run_bird_high_sheet] [出力の名前の頭=run_bird_]
"""
import sys
from pathlib import Path

from PIL import Image

GAMES = Path(__file__).resolve().parent.parent / 'frontend' / 'public' / 'assets' / 'games'


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
    name = sys.argv[1] if len(sys.argv) > 1 else 'run_bird_high_sheet'
    prefix = sys.argv[2] if len(sys.argv) > 2 else 'run_bird_'  # 出力の名前の頭（赤茶は run_bird_red_）
    sheet = Image.open(GAMES / f'{name}.png').convert('RGBA')
    W, H = sheet.size
    a = sheet.split()[-1].point(lambda v: 255 if v > 128 else 0)
    cols = runs([a.crop((x, 0, x + 1, H)).getbbox() is not None for x in range(W)])
    # 細かい切れはしを除く（小さな幅の列）
    cols = [c for c in cols if c[1] - c[0] > 40]
    if len(cols) != 4:
        print('コマの数が4ではありません:', len(cols), cols)
        return 1
    frames = []
    for (x0, x1) in cols:
        f = sheet.crop((x0, 0, x1, H))
        f = f.crop(f.split()[-1].getbbox())
        fa = f.split()[-1].point(lambda v: 255 if v > 128 else 0)
        fw, fh = f.size
        # 体の中心：下半分（体・足）の、横の重心
        low = fa.crop((0, fh // 2, fw, fh)).load()
        xs, n = 0, 0
        for yy in range(fh - fh // 2):
            for xx in range(fw):
                if low[xx, yy]:
                    xs += xx
                    n += 1
        frames.append((f, xs / n if n else fw / 2))
    left = max(c for _, c in frames)
    right = max(f.size[0] - c for f, c in frames)
    ch = max(f.size[1] for f, _ in frames)
    cw = int(left + right) + 2
    for i, (f, c) in enumerate(frames, start=1):
        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        canvas.alpha_composite(f, (int(round(left - c)), ch - f.size[1]))
        canvas = canvas.transpose(Image.FLIP_LEFT_RIGHT)  # 左向きにする
        canvas.save(GAMES / f'{prefix}{i}.png')
    print(f'4 frames -> {prefix}1..4 ({cw}x{ch}) from {name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
