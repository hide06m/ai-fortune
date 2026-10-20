# -*- coding: utf-8 -*-
"""
BGM を、ほどよい長さに切り、つなぎ目の目立たない「ループ」にして、軽い mp3 にする。
- 曲の中から、「始めの場所 a」と「終わりの場所 b」を、探す（aのあとの音と、bのあとの音が、いちばん似ているところ）
- 終わりのあとの音と、始めのあとの音を、まぜて（クロスフェード）、つなぎ目をなくす
- 使い方:  python tools/make_bgm_loop.py 入力.mp3 出力.mp3 [--min 40] [--max 80] [--kbps 128] [--fade 1.5]
- 依存: av（PyAV）, numpy, lameenc
"""
import argparse
import sys

import av
import lameenc
import numpy as np

SR = 44100


def decode(path):
    c = av.open(path)
    rs = av.AudioResampler(format='flt', layout='stereo', rate=SR)
    chunks = []
    for fr in c.decode(audio=0):
        for o in rs.resample(fr):
            chunks.append(o.to_ndarray().reshape(-1, 2))
    for o in rs.resample(None):
        chunks.append(o.to_ndarray().reshape(-1, 2))
    return np.concatenate(chunks, 0)


def features(mono, hop=2048, bands=40):
    """音の特徴（時間ごとの、周波数の帯ごとの強さ）"""
    n = (len(mono) - hop * 2) // hop
    win = np.hanning(hop * 2)
    edges = np.unique(np.geomspace(2, hop, bands + 1).astype(int))
    feats = np.zeros((n, len(edges) - 1), dtype=np.float32)
    for i in range(n):
        spec = np.abs(np.fft.rfft(mono[i * hop:i * hop + hop * 2] * win))[:hop]
        for j in range(len(edges) - 1):
            feats[i, j] = np.log1p(spec[edges[j]:edges[j + 1]].mean() * 50)
    return feats, hop


def best_loop(audio, min_s, max_s, window_s=3.0):
    mono = audio.mean(1)
    f, hop = features(mono)
    w = int(window_s * SR / hop)  # 比べる窓の長さ（フレーム数）
    total = len(f)
    best = None
    a_range = range(0, int(min(30, total * hop / SR / 3) * SR / hop))
    for a in a_range:
        wa = f[a:a + w]
        if len(wa) < w:
            continue
        for b in range(a + int(min_s * SR / hop), min(total - w - 1, a + int(max_s * SR / hop))):
            wb = f[b:b + w]
            d = float(np.mean((wa - wb) ** 2))
            if best is None or d < best[0]:
                best = (d, a, b)
    d, a, b = best
    return a * hop, b * hop, d


def crossfade_loop(audio, a, b, fade_s):
    x = int(fade_s * SR)
    if b + x > len(audio):
        x = len(audio) - b
    t = np.linspace(0, 1, x, dtype=np.float32)[:, None]
    fo = np.cos(t * np.pi / 2)  # 等しいパワーで、まぜる
    fi = np.sin(t * np.pi / 2)
    blend = audio[b:b + x] * fo + audio[a:a + x] * fi
    return np.concatenate([audio[a + x:b], blend], 0)


def encode(audio, path, kbps):
    pcm = (np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(kbps)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    open(path, 'wb').write(enc.encode(pcm) + enc.flush())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--min', type=float, default=40)
    ap.add_argument('--max', type=float, default=80)
    ap.add_argument('--kbps', type=int, default=128)
    ap.add_argument('--fade', type=float, default=1.5)
    a = ap.parse_args()
    audio = decode(a.src)
    dur = len(audio) / SR
    print(f'入力 {dur:.1f}秒')
    if dur <= a.max + a.fade + 2:
        lo, hi = 0, len(audio) - int(a.fade * SR) - 1
        start, end = 0, hi
        print('短いので、そのまま、つなぎ目だけ直す')
    else:
        start, end, d = best_loop(audio, a.min, a.max)
        print(f'ループ: {start / SR:.2f}秒 → {end / SR:.2f}秒（長さ {(end - start) / SR:.1f}秒、ちがい {d:.4f}）')
    loop = crossfade_loop(audio, start, end, a.fade)
    encode(loop, a.dst, a.kbps)
    print(f'出力 {len(loop) / SR:.1f}秒 → {a.dst}')


if __name__ == '__main__':
    sys.exit(main())
