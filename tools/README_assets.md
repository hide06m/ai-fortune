# ゲーム素材の処理の手順（画像を作り直したら、この順に実行）

1. `python tools/process_game_assets.py` — raw の画像の背景（青・緑・黒）を抜いて、games/ に書き出す
2. `python tools/split_run_sheet.py` — ムスビの走りシート（`musubi_run_sheet_2x` があれば、それ）を12コマに切り分ける
3. `python tools/match_musubi_colors.py` — ムスビのコマの色をそろえる
4. `python tools/musubi_sizes.py` — 顔の高さ（耳の上〜あご）と、顔の中心の横位置を測り、全コマの顔の大きさ・位置をそろえる倍率（musubi_scale.json）を作る
5. `python tools/make_loop.py runbg_mid2 0.22` / `run_ground 0.2` / `runbg_near 0.2` — 横にループする背景の、つなぎ目を直した絵（`*_loop.png`）を作る
6. `python tools/split_bird_sheet.py run_bird_high_sheet` — 鳥の羽ばたきシート（4コマ）を切り分け、左向きにして run_bird_1..4 を作る（低空・高空とも、青い鳥を使用。赤茶の run_bird_low_sheet は、予備）
