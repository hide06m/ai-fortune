# -*- coding: utf-8 -*-
"""games/raw の生成画像を、背景を透明にして games/ に書き出す（ファイル名の拡張子は問わない）。
使い方: python tools/process_game_assets.py
"""
import glob
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'frontend', 'public', 'assets', 'games', 'raw')
OUT = os.path.join(HERE, '..', 'frontend', 'public', 'assets', 'games')
TOOL = os.path.join(HERE, 'chroma_key.py')

# 個別の指定（絵の中に、背景と同じ色の穴があるもの）
EXTRA = {
    'ui_hand_tap_1': ['--global-key'],
    # 背景の層（緑を抜く）：木や草の隙間に、つながっていない緑の部分があるので、全体から抜く
    'runbg_mid': ['--global-key'],
    'runbg_near': ['--global-key'],
    'run_ground': ['--global-key'],
    'run_puddle': ['--global-key'],
    'run_mushroom_1': ['--global-key'],
    'run_mushroom_2': ['--global-key'],
    'run_mushroom_3': ['--global-key'],
    # ゴールの門：アーチの上の、枝と幹の間に、背景の青が、つながらずに、残る
    'run_goal_gate': ['--global-key'],
    'run_log2': ['--global-key'],
    # 枠：中央の空きも、緑なので、中央からも抜く
    'frame_moon': ['--inner', '--global-key'],
    'frame_leaf': ['--inner', '--global-key'],
    'frame_simple': ['--inner', '--global-key'],
}

# 背景を、透明にしない（絵が、そのまま背景になる）もの：そのまま、PNGに変える
OPAQUE = {'runbg_sky', 'runbg_sky0'}

# 名前の直し（保存名の間違い）
RENAME = {'musubi_cheer_t_fron2': 'musubi_cheer_front_2'}

for path in sorted(glob.glob(os.path.join(RAW, '*'))):
    base = os.path.splitext(os.path.basename(path))[0]
    if base.endswith('.png'):
        base = base[:-4]
    name = RENAME.get(base, base)
    # 作り直し版（ファイル名の終わりに「'」が付いたもの）は、名前の終わりを「p」にして、元のものと並べて、使い分けられるようにする
    if name.endswith("'"):
        name = name[:-1] + 'p'
    dst = os.path.join(OUT, name + '.png')
    if name == 'runbg_far':
        # 遠景：上の空の部分は、空の層が見えるよう、少しずつ透明にする（上の約3割は、完全に透明、木が始まる位置までに、不透明になる）
        from PIL import Image
        im = Image.open(path).convert('RGBA')
        w, h = im.size
        a = Image.new('L', (w, h), 255)
        px = a.load()
        y0, y1 = int(h * 0.30), int(h * 0.42)
        for y in range(h):
            v = 0 if y < y0 else 255 if y >= y1 else int(255 * (y - y0) / (y1 - y0))
            for x in range(w):
                px[x, y] = v
        im.putalpha(a)
        im.save(dst)
        print(name, '-> far layer with top fade')
        continue
    if name in OPAQUE:
        from PIL import Image
        Image.open(path).convert('RGB').save(dst)
        print(name, '-> copied (opaque)')
        continue
    args = [sys.executable, TOOL, path, dst, '--thresh', '80']
    if name.startswith('fx_'):
        args.append('--black')
    if name in EXTRA:
        args += EXTRA[name]
    r = subprocess.run(args, capture_output=True, text=True)
    print(name, '->', r.stdout.strip() or r.stderr.strip())
