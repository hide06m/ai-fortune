# 全ゲーム共通素材：画像生成プロンプト（Google Flow / Nano Banana 用）

作成: 2026-10-18。1素材につき、1つのプロンプト。言語は、正確さを優先して英語（一部に日本語の補足）。
素材の一覧と大きさは [ASSETS_LIST.md](ASSETS_LIST.md) の「0. 全ゲーム共通」を参照。

## 使い方（共通の流れ）
1. **最初に #1 だけ作って、見た目を確認する**（ここで、ムスビの見た目が決まる）。良ければ、#2 以降へ。
2. 各プロンプトの **【添付】** に書いた画像を、プロンプトと一緒に添付する（パスは、このPCのプロジェクト内）。
3. 1回の生成で、**1つの絵だけ**を作る（コマ数のあるものは、コマごとに別のプロンプトで1枚ずつ）。
4. 背景は、**単色**で作ってもらい、あとで私が透明にする。
   - キャラ・どんぐり：**純粋な青（#0000FF）**
   - 石・ボタン・枠（金と紫の飾り）：**純粋な緑（#00FF00）**
   - 光の効果：**黒（#000000）**
5. できた画像は、下の「保存名」で、`C:\Users\hide0\Projects\frontend\public\assets\games\raw\` に保存してください（フォルダは無ければ作成）。保存したら教えてもらえれば、私が、背景を透明にして、大きさをそろえ、ゲームに組み込みます（`tools/chroma_key.py` を用意済み）。
6. 見た目が、ムスビと違ってきたら（色・体型・フードの形・線の太さ）、**そのまま次へ進まず**、作り直す。直しの指示のコツは、末尾にある。

## 共通の文（キャラクター用）— 以下を **CHARACTER ANCHOR** と呼び、キャラのプロンプトの先頭に付ける

```
CHARACTER ANCHOR:
Use the attached image as the exact character reference. The character is "Musubi": a chubby, round, anthropomorphic gray dwarf hamster with a white muzzle and white belly, a darker gray stripe on the forehead, small rounded gray ears with pink inside, round glossy black eyes, a small pink nose, long white whiskers, and pink paws and feet. He wears a long olive-green hooded linen robe with a visible woven fabric texture and a small oak-leaf brooch at the chest. The hood is DOWN (the face is fully visible). Keep the identical proportions, colors, face, robe, brooch, line weight and shading as the reference: thin dark-brown outlines, soft cel shading, warm storybook fantasy illustration. Do not change the design in any way. Only the pose and expression change as described below.
```

## 共通の文（出力の条件）— **OUTPUT RULES**（毎回、末尾に付ける）

```
OUTPUT RULES: a single subject only, fully visible and centered with generous empty margin on all sides (nothing cropped), flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no vignette, no text, no watermark, no border, no extra characters or props unless stated, crisp clean edges, high resolution.
```
（背景色を変えるものは、各プロンプトの中で指定します。）

---

## A. ムスビ（キャラクター）

### #1 musubi_idle_right — 立ち・右向き（まず、これを作る）
【添付】`frontend/public/assets/characters/0-musubi/ham001.webp`（正面・立ち）と、`ham004.webp`（笑顔）
【アスペクト比】3:4（縦長）　【保存名】`musubi_idle_right.png`
```
[CHARACTER ANCHOR]

POSE: Musubi standing, seen in a pure side profile facing to the RIGHT of the image (his nose points to the right edge). Both small paws are folded together at his chest, holding the front of the robe. His body is upright and relaxed, weight on both feet, both feet visible, tail not visible under the robe. Expression: calm, gentle closed-mouth smile, eyes open and looking to the right. The hood is down. Full body from ears to feet.

[OUTPUT RULES]
```
※ 正面の立ち（`musubi_idle_front`）は、**新しく作らず**、既存の `ham001.webp` をそのまま使います。

### #2 musubi_cheer_front_1 — 喜ぶ・1コマ目（しゃがむ）
【添付】`ham001.webp`、`ham004.webp`　【アスペクト比】3:4　【保存名】`musubi_cheer_front_1.png`
```
[CHARACTER ANCHOR]

POSE (frame 1 of 3, anticipation): Musubi seen from the front, slightly crouched, knees bent, both paws pulled in close to his chest as if gathering energy before jumping with joy. Eyes open wide and sparkling, a small excited smile. Body slightly compressed vertically.

[OUTPUT RULES]
```

### #3 musubi_cheer_front_2 — 喜ぶ・2コマ目（ばんざい）
【添付】`ham001.webp`、`ham004.webp`　【アスペクト比】3:4　【保存名】`musubi_cheer_front_2.png`
```
[CHARACTER ANCHOR]

POSE (frame 2 of 3, peak): Musubi seen from the front, jumping into the air with both arms raised high above his head, both paws open, feet off the ground with toes pointing down. Eyes closed in a big happy curve, mouth wide open in a joyful cheer showing his two small front teeth. The robe flares slightly upward. Maximum joy.

[OUTPUT RULES]
```

### #4 musubi_cheer_front_3 — 喜ぶ・3コマ目（着地）
【添付】`ham001.webp`、`ham004.webp`　【アスペクト比】3:4　【保存名】`musubi_cheer_front_3.png`
```
[CHARACTER ANCHOR]

POSE (frame 3 of 3, landing): Musubi seen from the front, just landed with both feet on the ground, knees slightly bent, both arms still raised in a V shape above his head, big happy smile with eyes closed in happy curves, mouth open. The robe settles downward.

[OUTPUT RULES]
```

### #5 musubi_sad_front — がっかり（正面）
【添付】`ham001.webp`　【アスペクト比】3:4　【保存名】`musubi_sad_front.png`
```
[CHARACTER ANCHOR]

POSE: Musubi seen from the front, standing but slumped, head bowed slightly downward, shoulders drooping, both arms hanging loosely at his sides with the paws pointing down. His small ears are drooping. Expression: disappointed, eyes half-closed and looking down, mouth a small downward curve, a tiny single teardrop at the corner of one eye. Not dramatic, just gently sad and a little sheepish.

[OUTPUT RULES]
```

### #6 musubi_hit_right — ぶつかる・ひるむ（右向き）
【添付】`ham001.webp`　【アスペクト比】3:4　【保存名】`musubi_hit_right.png`
```
[CHARACTER ANCHOR]

POSE: Musubi in side profile facing RIGHT, recoiling from an impact: his upper body leans backward (away from the right), one paw pressed to the top of his head, the other arm flung out slightly, one foot lifted off the ground. Expression: eyes squeezed shut in pain, mouth open in a small "ouch" grimace. No stars, no impact marks, no motion lines (those are added separately).

[OUTPUT RULES]
```

---

## B. どんぐり（アイテム）

（アイテムは、ムスビの絵の線の太さ・影のつけ方に合わせる。ムスビの画像を添付して、画風をそろえる）

### #7 acorn — どんぐり（通常）
【添付】`ham001.webp`（画風の見本）　【アスペクト比】1:1　【保存名】`acorn.png`
```
Match the line weight and soft cel-shading style of the attached reference illustration (thin dark-brown outlines, soft shading, warm storybook fantasy style). Draw ONE single acorn: a glossy warm-brown nut with a rounded body and a small pointed tip, topped with a textured, scaly, darker-brown cap and a short curved stem. Slightly cute and plump proportions. Seen straight from the side, upright, centered. Gentle highlight on the upper left of the nut. No face, no hands.
OUTPUT RULES: a single object only, fully visible and centered with generous empty margin, flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```

### #8 acorn_big — どんぐり（大。高得点）
【添付】生成した `acorn.png`（#7の結果）　【アスペクト比】1:1　【保存名】`acorn_big.png`
```
Use the attached acorn as the exact style reference. Draw ONE single acorn of the same design, but a LARGE, extra-plump, prized version: a rounder, fatter nut with a richer reddish-brown color, a larger deeper-brown textured cap, and a stronger glossy highlight, subtly more majestic. Same line weight and shading as the reference. Upright, side view, centered. No face, no hands.
OUTPUT RULES: a single object only, fully visible and centered with generous empty margin, flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```

### #9 acorn_gold — どんぐり（金。ボーナス）
【添付】生成した `acorn.png`　【アスペクト比】1:1　【保存名】`acorn_gold.png`
```
Use the attached acorn as the exact shape and style reference. Draw ONE single acorn of the same design, but made of polished shining gold: a golden nut with warm bright highlights and soft orange-gold shading, a slightly darker antique-gold textured cap, a few tiny four-point sparkle stars floating around it (at most three, small). Same line weight and shading style as the reference. Upright, side view, centered. No face, no hands.
OUTPUT RULES: a single object only (the sparkles are part of it), fully visible and centered with generous empty margin, flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```

---

## C. ルーンストーン

### #10 rune_stone — ルーンストーン（報酬の石）
【添付】`frontend/public/assets/stone.webp`（既存の石。形・色の見本）　【アスペクト比】1:1　【保存名】`rune_stone.png`
```
Redraw the attached stone as a larger, higher-resolution version with the exact same design: a smooth, rounded, slightly irregular egg-shaped dark crystal stone whose face contains a vivid spiral galaxy nebula in deep blue, purple, magenta and pink with tiny white stars, framed by a glossy black rim with a soft white reflection highlight on the upper left. Keep the same colors, shape, tilt and look as the reference. A single stone, centered, upright.
OUTPUT RULES: a single object only, fully visible and centered with generous empty margin, flat solid pure green (#00FF00) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```

---

## D. 効果（光・星くず・紙吹雪）— 背景は**黒**

### #11〜#14 fx_sparkle_1〜4 — きらめき（4コマ）
【添付】なし　【アスペクト比】1:1　【保存名】`fx_sparkle_1.png`〜`fx_sparkle_4.png`
（コマごとに、下の同じ文の、FRAME の行だけを替える）
```
A burst of magical golden-white sparkles, fantasy game visual effect, soft glowing four-pointed stars of varying sizes with small round glowing dots, warm gold and white with a faint hint of pale pink, centered composition, glow only (no objects, no characters, no hands).
FRAME: [1: a single small bright star in the center, just beginning / 2: the star larger with 3 small stars appearing around it / 3: full burst, 5 to 6 stars of different sizes spread evenly around the center, brightest moment / 4: the stars fading, smaller and dimmer, scattered a bit wider]
OUTPUT RULES: pure solid black (#000000) background filling the whole image, no ground, no text, no watermark, no border, no vignette, the effect centered with generous empty black margin.
```

### #15〜#18 fx_hit_1〜4 — ミスの星くず（4コマ）
【添付】なし　【アスペクト比】1:1　【保存名】`fx_hit_1.png`〜`fx_hit_4.png`
```
A cartoon impact burst game visual effect: small yellow and white star shapes and short round puffs radiating outward from the center, flat cartoon style with thin dark outlines, a few thin curved impact lines, no characters, no objects.
FRAME: [1: a tiny starburst at the center / 2: 5 small stars flying outward / 3: the stars at their widest spread, 6 to 8 stars and puffs / 4: stars small and faint, nearly gone]
OUTPUT RULES: pure solid black (#000000) background filling the whole image, no ground, no text, no watermark, no border, no vignette, the effect centered with generous empty black margin.
```

### #19〜#22 fx_confetti_1〜4 — 紙吹雪の粒（4色）
【添付】なし　【アスペクト比】1:1　【保存名】`fx_confetti_1.png`〜`fx_confetti_4.png`
```
ONE single small piece of celebration confetti, a thin glossy rectangular paper strip slightly curled in the air, with a soft highlight. Color: [1: warm gold / 2: rose pink / 3: sky blue / 4: leaf green]. Simple flat illustration with a very thin outline, centered, large in the frame.
OUTPUT RULES: pure solid black (#000000) background filling the whole image, no ground, no text, no watermark, no border, the single piece centered with generous empty black margin.
```

---

## E. 画面の部品（金と紫の飾りの様式）— 背景は**緑**

様式の見本として、次の2枚を **すべてのUIのプロンプトに添付**：
`frontend/public/assets/ui/flame-corner-tl.webp` と `frontend/public/assets/ui/flame-corner2-tl.webp`（角の飾り）

**UI STYLE（以下をUIの先頭に付ける）**
```
UI STYLE: Match the attached ornate corner decorations: dark indigo-purple panels with thin elegant antique-gold metal trim, subtle gold filigree, a crescent moon and four-pointed star motif, small purple gem accents, soft inner glow, mystical fortune-telling fantasy game UI, polished but not glossy-plastic. Flat front view, perfectly symmetrical, no perspective.
```

### #23 ui_pause_btn — 一時停止ボタン
【アスペクト比】1:1　【保存名】`ui_pause_btn.png`（押した状態は #24）
```
[UI STYLE]
A square button with rounded corners containing a clear "pause" symbol (two thick vertical bars) in glowing pale gold in the center. Dark indigo-purple button face, gold metal trim, small star accent at one corner. No other text.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, button centered with generous empty margin, crisp clean edges.
```
### #24 ui_pause_btn_pressed — 一時停止ボタン（押した状態）
【添付】#23の結果と、角の飾り2枚　【保存名】`ui_pause_btn_pressed.png`
```
Use the attached pause button as the exact reference (same shape, size and design). Draw the same button in its PRESSED state: the button face slightly darker and inset, the gold trim a little dimmer, the pause symbol a little brighter with a stronger glow. Identical position and size.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, button centered with generous empty margin, crisp clean edges.
```

### #25 ui_play_btn — 再開ボタン
【添付】#23の結果と、角の飾り2枚　【アスペクト比】1:1　【保存名】`ui_play_btn.png`
```
Use the attached pause button as the exact reference for shape, size and style. Draw the same button, but with a "play" symbol (a right-pointing triangle) in glowing pale gold instead of the pause bars.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, button centered with generous empty margin, crisp clean edges.
```

### #26 ui_result_btn — 「結果を見る」ボタンの枠（文字なし）
【アスペクト比】4:1（横長）　【保存名】`ui_result_btn.png`
```
[UI STYLE]
A wide horizontal rounded-rectangle button frame, with a luminous warm-gold glowing outline and an indigo-purple face, a small crescent moon and star ornament at the left end and a subtle shine sweeping across. The center of the button must be EMPTY (no text, no symbols) so that text can be added later. A hint of golden light radiating around the edge to draw attention.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, button centered with generous empty margin, crisp clean edges.
```
### #27 ui_result_btn_pressed — 同・押した状態
【添付】#26の結果と角の飾り2枚　【アスペクト比】4:1　【保存名】`ui_result_btn_pressed.png`
```
Use the attached button frame as the exact reference (same shape, size and design, center still empty, no text). Draw it in its PRESSED state: face slightly darker and inset, the gold outline a little dimmer.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, button centered with generous empty margin, crisp clean edges.
```

### #28 ui_status_chip — 「診断中…」の表示枠（文字なし）
【アスペクト比】4:1　【保存名】`ui_status_chip.png`
```
[UI STYLE]
A small wide pill-shaped (fully rounded ends) label frame, dark indigo-purple fill with a thin antique-gold trim and a tiny star ornament at the left end. The center must be EMPTY (no text). Understated, smaller and calmer than a button.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```

### #29 ui_panel — 得点・時間を入れる枠（文字なし）
【アスペクト比】4:1　【保存名】`ui_panel.png`
```
[UI STYLE]
A horizontal information panel frame: dark indigo-purple translucent-looking fill, antique-gold border with delicate filigree corners (small corner ornaments like the attached corner decorations), a tiny crescent moon at the top center edge. The center must be completely EMPTY (flat dark fill, no text, no symbols).
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```

### #30 ui_panel_big_clear — クリアの大きなパネル（文字なし）
【アスペクト比】8:5　【保存名】`ui_panel_big_clear.png`
```
[UI STYLE]
A large announcement panel frame for a "victory" screen: dark indigo-purple fill, thick antique-gold border with ornate corner decorations like the attached ones, a crescent moon and radiant sun-ray motif centered above the top edge, small gold sparkles around the border, a joyful warm golden glow. The center area must be completely EMPTY (flat dark fill, no text, no symbols).
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```
### #31 ui_panel_big_miss — ミスの大きなパネル（文字なし）
【添付】#30の結果と角の飾り2枚　【アスペクト比】8:5　【保存名】`ui_panel_big_miss.png`
```
Use the attached victory panel as the exact reference for shape, size and ornaments. Draw the same panel as a gentle "try again" version: the fill a deeper dark blue-indigo, the gold trim a little duller, no sun rays, a small drooping crescent moon at the top center, a few faint cool-blue sparkles, a calm quiet glow. The center must remain completely EMPTY (no text).
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```

### #32 ui_hand_tap_1 — 「ここをタップ」の指（押す前）
【アスペクト比】1:1　【保存名】`ui_hand_tap_1.png`
```
[UI STYLE]
A cute simplified cartoon hand with the index finger pointing upward-left as if about to tap a screen, soft white-cream skin with thin dark-brown outline matching the soft cel-shading of the attached style, a faint circular ripple ring (thin gold line) beneath the fingertip. Friendly, neutral hand with no jewelry, no sleeve.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```
### #33 ui_hand_tap_2 — 同（押した瞬間）
【添付】#32の結果　【アスペクト比】1:1　【保存名】`ui_hand_tap_2.png`
```
Use the attached hand as the exact reference (same hand, same style). Draw the same hand a moment later: the fingertip pressed down slightly lower and the whole hand a little smaller, with two concentric gold ripple rings expanding wider around the fingertip.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```

### #34 ui_arrows_lr — 左右の矢印（ドラッグの案内）
【アスペクト比】4:1　【保存名】`ui_arrows_lr.png`
```
[UI STYLE]
A horizontal double-headed arrow indicating left-right dragging: a slim glowing pale-gold line with a rounded triangular arrowhead at each end (one pointing left, one pointing right), thin outline, subtle star sparkle in the middle, symmetrical. No text.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```

---

## 作り直しのコツ（見た目がずれたとき）
- 色・形がずれた → 同じプロンプトに、`Stay strictly faithful to the attached reference. Do not redesign.` を足し、**ムスビの画像を2枚**（正面と笑顔）添付する。
- 線が太い／細い → `Thin dark-brown outlines only, the same thin line weight as the reference.`
- 背景に影や地面が入った → `Absolutely no ground plane, no shadow, no floor reflection; the subject floats on the flat blue background.`
- 背景が単色にならない → `The background must be one single flat color (#0000FF) with no variation at all.`
- キャラの手足が切れる → `Leave 15% empty margin on all four sides; the entire character must be fully inside the frame.`
- 左右が逆（右向きにならない）→ `His nose points to the RIGHT edge of the image.`（もしくは、左向きに出たものを、私が左右反転して使う）

## できあがりの確認（1枚ごと）
1. ムスビなら、フードがかぶっていない（顔が見える）、ブローチ、体の比率が、見本と同じ。
2. 背景が、指定の単色で、全面が均一。
3. 絵が、枠内に収まり、四方に余白がある。
4. 文字・透かし・余計な小物がない。
5. 同じ素材の別コマは、大きさ・色・位置の基準がそろっている（コマの間で、ムスビの大きさが変わっていない）。
