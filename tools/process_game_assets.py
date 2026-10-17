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
EXTRA = {'ui_hand_tap_1': ['--global-key']}

# 名前の直し（保存名の間違い）
RENAME = {'musubi_cheer_t_fron2': 'musubi_cheer_front_2'}

for path in sorted(glob.glob(os.path.join(RAW, '*'))):
    base = os.path.splitext(os.path.basename(path))[0]
    if base.endswith('.png'):
        base = base[:-4]
    name = RENAME.get(base, base)
    dst = os.path.join(OUT, name + '.png')
    args = [sys.executable, TOOL, path, dst, '--thresh', '80']
    if name.startswith('fx_'):
        args.append('--black')
    if name in EXTRA:
        args += EXTRA[name]
    r = subprocess.run(args, capture_output=True, text=True)
    print(name, '->', r.stdout.strip() or r.stderr.strip())
