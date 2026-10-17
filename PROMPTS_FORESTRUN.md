# 森ラン：素材の画像生成プロンプト（Google Flow / Nano Banana 用）

作成: 2026-10-18。素材の一覧とサイズは [ASSETS_LIST.md](ASSETS_LIST.md) の「1. 森ラン」。共通素材（[PROMPTS_COMMON.md](PROMPTS_COMMON.md)）と同じやり方で、**1素材1プロンプト**。
**保存場所**：`C:\Users\hide0\Projects\frontend\public\assets\games\raw\`（拡張子は何でも可。保存名は、各項目の「保存名」）

## 先に知っておくこと
- **背景色**（あとで私が透明にする）：
  - ムスビ・切り株・石・丸太・看板：**純粋な青（#0000FF）**
  - 水たまり・キノコ・近景の草・UI：**純粋な緑（#00FF00）**（青や紫の絵と、色がぶつからないように）
  - 土ぼこり・光の効果：**黒（#000000）**
  - 空・遠景：背景なし（絵がそのまま背景）
- **ループする背景**（遠景・中景・近景・道）：生成した1枚を、私が**左右反転して、つなげて**、切れ目のない、無限に流れる絵にします。そのため、**左右の端が、同じ高さ・同じ種類の絵**であること、**目立つ目印（大きな岩・特別な木など）を、1つだけ置かない**ことが、大事です。
- **ムスビの走り**は、1枚で全コマは作れないので、**6コマ**を、1枚ずつ作ります（下の #R1〜#R6）。**全コマに、右向き立ちの絵 `musubi_idle_right`（青背景の元画像）を添付**して、同じ見た目にします。
- 画風の見本：ムスビの絵（`ham001.webp`／`musubi_idle_right`）。背景は、**あたたかい絵本風の、ファンタジーの森**。やわらかい色、細い線。
- 最初に **#B1（空）と #B2（遠景）** を作って、見た目の方向を確認してください。

## 共通の文

**CHARACTER ANCHOR**（ムスビの絵の先頭に付ける）
```
Use the attached image as the exact character reference. The character is "Musubi": a chubby, round, anthropomorphic gray dwarf hamster with a white muzzle and belly, small rounded gray ears with pink inside, round glossy black eyes, a small pink nose, long white whiskers, and pink paws and feet. He wears a long olive-green hooded linen robe with a visible woven fabric texture and a small oak-leaf brooch at the chest. The hood is DOWN (the face is fully visible). Keep the identical proportions, head shape (round and chubby), colors, face, robe, brooch, line weight and shading as the reference: thin dark-brown outlines, soft cel shading, warm storybook fantasy illustration. Do not change the design. Only the pose changes as described below.
```

**OUTPUT（青）**
```
OUTPUT RULES: a single subject only, fully visible and centered with generous empty margin on all sides (nothing cropped), flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no vignette, no text, no watermark, no border, crisp clean edges, high resolution.
```
**OUTPUT（緑）** … 上の文の、`pure blue (#0000FF)` を `pure green (#00FF00)` に替えたもの。
**OUTPUT（黒）** … `flat solid pure black (#000000) background`、`the effect centered with generous empty black margin` に替えたもの。

**WORLD STYLE**（背景・小物の画風。背景の先頭に付ける）
```
WORLD STYLE: warm storybook fantasy illustration of a gentle enchanted forest, soft painterly shading with thin dark-brown outlines on objects, harmonious muted greens, golds and soft purples, dappled sunlight, a cozy and calm mood, matching the attached reference illustration of the hamster character (same line quality and soft cel shading). No characters, no text, no UI.
```

---

## 背景（ループして流れる）

### #B1 runbg_sky — 空（動かない1枚）
【添付】なし（先に、画風を見たいときは、ムスビの `ham001.webp`）　【アスペクト比】9:16（縦長）　【保存名】`runbg_sky`
```
[WORLD STYLE]
A tall vertical background of a bright soft morning sky seen through the far edge of a forest: pale warm-gold and soft sky-blue gradient, a few gentle cream clouds, faint rays of light, very distant misty blue-green hills near the bottom third. Calm and uncluttered. The lower 40% should be softly hazy so that tree layers can be placed in front of it. No trees in the foreground, no ground.
OUTPUT: a full-bleed illustration filling the whole image, no border.
```

### #B2 runbg_far — 遠景の木々（ゆっくり流れる。横にループ）
【添付】#B1の結果　【アスペクト比】16:9（横長）　【保存名】`runbg_far`
```
[WORLD STYLE]
Match the attached sky background. A wide horizontal strip of DISTANT forest: soft, misty, low-contrast blue-green tree silhouettes of many different sizes, evenly spread across the whole width, with a hazy light-gold glow between the trunks. The composition must loop seamlessly: the left edge and the right edge show the same kind of trees at the same height, with no single unique landmark (no one big special tree). The top 35% of the image is plain pale sky color (same as the attached sky) and the trees fill the lower 65%, ending at the very bottom edge. Soft, atmospheric, low detail.
OUTPUT: a full-bleed illustration filling the whole image, no border, no ground line, no characters.
```

### #B3 runbg_mid — 中景の木々・茂み（中くらいの速さ）
【添付】#B2の結果　【アスペクト比】16:9　【保存名】`runbg_mid`
```
[WORLD STYLE]
Match the attached distant forest. A wide horizontal strip of MID-DISTANCE forest: medium-sized tree trunks with leafy canopies, ferns and bushes, richer greens, clearer outlines and more detail than the distant layer, evenly spread across the whole width with a similar rhythm everywhere. The composition must loop seamlessly: the left and right edges show the same kind of elements at the same height, with no single unique landmark. The trees stand on the bottom edge of the image (the ground is NOT drawn; the trunks and bushes simply end at the bottom edge). Everything outside the trees and bushes is flat solid pure green (#00FF00) so it can be removed (the green must contain no gradient). Do not use any green in the trees that is similar to pure #00FF00: use muted, darker olive and teal greens only.
OUTPUT: no border, no text, no characters.
```

### #B4 runbg_near — 手前の草・シダ・低木（速く流れる。画面の下に重なる）
【添付】#B3の結果　【アスペクト比】21:9 または 16:9　【保存名】`runbg_near`
```
[WORLD STYLE]
Match the attached mid-distance layer but in the FOREGROUND: a wide low horizontal strip of tall grass blades, ferns, clover, small wildflowers and a few tiny mushrooms, large and detailed, with warm backlight. They grow from the bottom edge and rise only to about the lower third of the image; the rest is empty. The pattern is evenly spread so the left and right edges match and loop seamlessly, no unique landmark. The empty area (everything above and between the plants) is flat solid pure green (#00FF00). Use only muted olive, warm yellow-green and teal greens for the plants (not pure #00FF00).
OUTPUT: no border, no text, no characters.
```

### #B5 run_ground — 走る道（土の道。上の縁が「走る面」）
【添付】なし　【アスペクト比】21:9（細長い）　【保存名】`run_ground`
```
[WORLD STYLE]
A wide flat strip of a forest dirt path seen from the side: the TOP EDGE is a perfectly straight, perfectly horizontal line (the running surface) with a thin band of mossy grass and tiny pebbles along it; below it, warm brown packed earth with soft darker soil layers, small embedded stones and a few thin roots, evenly textured across the whole width. The left and right edges match so the strip loops seamlessly; no unique landmark. The strip fills the whole image from left to right and from the top edge line down to the bottom edge. Above the top edge line, the area is flat solid pure green (#00FF00).
OUTPUT: no border, no text, no characters.
```

---

## スタートとゴール

### #S1 run_start_sign — スタートの看板
【添付】なし　【アスペクト比】3:4　【保存名】`run_start_sign`
```
[WORLD STYLE]
A cute wooden signpost standing upright: a thick wooden post with a rounded rectangular wooden board attached near the top, a small leafy sprig and a tiny crescent-moon carving on the board, a small acorn hanging from a string. The board has NO text and NO writing (blank wood grain with only the moon carving). Seen straight from the front, upright, full object visible.
OUTPUT RULES: a single object only, fully visible and centered with generous empty margin, flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```

### #S2 run_goal_gate — ゴールの門
【添付】なし　【アスペクト比】3:4　【保存名】`run_goal_gate`
```
[WORLD STYLE]
A large cheerful wooden goal gate: an arch made of two thick natural tree trunks joined by an arched branch on top, decorated with leaves, small hanging golden acorns and warm lantern lights, a festive ribbon of soft gold and cream cloth tied across the top and hanging in two tails, a small crescent-moon ornament at the top center. The opening of the gate is empty and open (we see the background color through it). No text. Seen straight from the front, symmetrical, full object visible.
OUTPUT RULES: a single object only, fully visible and centered with generous empty margin, flat solid pure blue (#0000FF) background filling the whole image (also visible through the opening), no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```

### #S3 run_marker — 距離の目印の立て札（何も書かない板）
【添付】#S1の結果　【アスペクト比】1:1　【保存名】`run_marker`
```
Use the attached signpost as the exact style reference. Draw a smaller, simpler wooden marker post: one thin wooden post with a small flat rectangular blank wooden board on top (completely blank, no carving, no text, no symbols) and a tiny leaf at the base. Upright, front view, full object visible.
OUTPUT RULES: a single object only, fully visible and centered with generous empty margin, flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```

---

## 障害物（すべて、道の上に置く。横から見た絵。地面に接する底が、まっすぐ）

共通の文：
```
OBSTACLE STYLE: Match the attached reference illustration style (thin dark-brown outlines, soft cel shading, warm storybook fantasy). A single obstacle object for a side-scrolling runner game, seen from the side at eye level, the bottom of the object is flat so it can sit on the ground. No grass or ground around it, no character.
```
【添付】ムスビ `ham001.webp`（画風の見本）。2つめ以降は、#O1 の結果も添付。
アスペクト比はすべて **1:1**（横長の丸太だけ **16:9**）。出力の条件は、青（石・切り株・丸太）、緑（水たまり・キノコ）。

### #O1 run_stump_s — 小さい切り株　【保存名】`run_stump_s`
```
[OBSTACLE STYLE]
A small tree stump: a short cut trunk with visible growth rings on the flat top (seen slightly from above), rough bark sides, a couple of small roots at the base and a tiny green moss patch. Roughly as wide as it is tall.
[OUTPUT blue]
```
### #O2 run_stump_l — 大きい切り株（高い）　【保存名】`run_stump_l`
```
[OBSTACLE STYLE]
Use the attached small stump as the exact style reference. Draw a TALL, larger tree stump of the same design: noticeably taller than wide (about 1.6 times as tall as wide), jagged broken top edge with light wood showing, bark sides, moss, a small mushroom growing at the side.
[OUTPUT blue]
```
### #O3 run_rock_s — 小さい石　【保存名】`run_rock_s`
```
[OBSTACLE STYLE]
A small rounded gray boulder with soft highlights, a few cracks and a patch of moss on top and a tiny flower sprouting at the side. Wider than tall.
[OUTPUT blue]
```
### #O4 run_rock_l — 大きい石　【保存名】`run_rock_l`
```
[OBSTACLE STYLE]
Use the attached small rock as the exact style reference. Draw a LARGE tall gray boulder of the same design: about twice the height of the small one, layered angular stone faces, moss and small ferns on top, a few cracks.
[OUTPUT blue]
```
### #O5 run_log — 長い丸太（横に長い。大ジャンプ）　【アスペクト比】16:9　【保存名】`run_log`
```
[OBSTACLE STYLE]
A fallen tree log lying horizontally: a thick cylindrical trunk seen from the side, about 3.5 times as long as it is tall, with rough bark, both cut ends showing growth rings at the left and right ends (slightly visible), moss patches, a couple of small shelf mushrooms on top, the bottom is flat.
[OUTPUT blue]
```
### #O6 run_puddle — 水たまり（平たい）　【アスペクト比】16:9　【保存名】`run_puddle`
```
[OBSTACLE STYLE]
A flat puddle of clear blue water seen from the side at eye level as a thin low oval mound of water lying on the ground: glossy surface with soft white highlights, a tiny ripple ring, a few small pebbles and a leaf floating at its edge. Very low and wide (about 5 times as wide as tall).
[OUTPUT green]
```
### #O7 run_mushroom_1〜3 — キノコの群れ（3色）　【保存名】`run_mushroom_1`〜`3`
```
[OBSTACLE STYLE]
A small cluster of three round-capped mushrooms of different heights growing together, cream stems, soft white spots on the caps. Cap color: [1: red / 2: purple / 3: brown].
[OUTPUT green]
```

---

## ムスビ（右向き）— 全コマに、`musubi_idle_right`（青背景の元画像）を添付

**OUTPUT（青）**は、上の共通の文のとおり。アスペクト比はすべて **3:4**（走りのコマは、横に動くので、**4:3** も可。向きと大きさは、全コマで、同じにすること）。

### #R1〜#R6 musubi_run_right_1〜6 — 走る（6コマ）
```
[CHARACTER ANCHOR]

POSE (run cycle frame [N] of 6): Musubi in pure side profile facing RIGHT, running at a brisk cheerful pace, body leaning slightly forward, both small paws swinging at his sides, the robe fluttering behind him. Keep the SAME size, same camera distance, same horizontal position and the same ground line (feet at the same level) in every frame of the cycle. Leg and arm positions for this frame: [N=1: contact — the right leg stretched forward touching the ground, the left leg stretched back, arms opposite; N=2: down — the body at its lowest, both legs bent under the body, weight absorbing; N=3: passing — the back leg swinging forward under the body, the other foot pushing off; N=4: up — both feet off the ground, body at its highest, legs tucked; N=5: contact (opposite) — the left leg forward touching the ground, the right leg stretched back; N=6: down (opposite) — the body at its lowest, legs bent, mirror of frame 2]. Expression: happy open-mouth smile, eyes bright.

[OUTPUT]
```
※ 6枚を、**同じ会話・同じ設定**で続けて作ると、揃いやすいです。1枚目ができたら、**2枚目からは、1枚目の結果も添付**してください。

### #R7 musubi_jump_up_right — ジャンプで上がる
```
[CHARACTER ANCHOR]

POSE: Musubi in pure side profile facing RIGHT, in mid-air jumping upward: both legs tucked up, both arms raised forward and up, the robe flaring downward, eyes wide and cheerful, mouth open in a small "hup!" shout. Same size and camera distance as the idle reference.

[OUTPUT]
```
### #R8 musubi_fall_right — 落ちる
```
[CHARACTER ANCHOR]

POSE: Musubi in pure side profile facing RIGHT, falling downward after a jump: legs extended down with toes pointing to the ground, arms stretched out to the sides for balance, the robe lifting upward from the fall, wide eyes, small round mouth. Same size and camera distance as the idle reference.

[OUTPUT]
```
### #R9 musubi_land_right — 着地（しゃがむ）
```
[CHARACTER ANCHOR]

POSE: Musubi in pure side profile facing RIGHT, just landed: knees deeply bent in a crouch, body low and compressed, both paws touching the ground in front, the robe pooling around him, determined smiling face. Same size and camera distance as the idle reference.

[OUTPUT]
```
（ぶつかる `musubi_hit_right`、喜ぶ・がっかりは、共通素材で作成済みです。）

---

## 効果（黒背景）

### #E1〜#E4 fx_dust_1〜4 — 走るときの土ぼこり（4コマ）　【アスペクト比】3:2　【保存名】`fx_dust_1`〜`4`
```
A small puff of dust kicked up by a running foot, cartoon game visual effect: soft warm-beige and cream round puffs with thin darker outlines, a few tiny grit specks, flat cartoon style, no objects, no characters.
FRAME: [1: one small round puff / 2: two puffs, slightly bigger, drifting backward (to the left) / 3: three soft puffs spread out and fading / 4: tiny faint puffs almost gone]
[OUTPUT black]
```
### #E5〜#E8 fx_land_1〜4 — 着地の砂ぼこり（4コマ）　【アスペクト比】3:2　【保存名】`fx_land_1`〜`4`
```
A ring-shaped burst of dust on the ground when something lands, seen from the side, cartoon game visual effect: soft warm-beige and cream puffs spreading outward left and right along a flat ground line, thin darker outlines, flat cartoon style, no objects, no characters.
FRAME: [1: a small compact puff at the center / 2: puffs spreading outward both ways, medium / 3: wide spread, largest, puffs thinning / 4: faint small puffs at both far ends, almost gone]
[OUTPUT black]
```

---

## 画面の部品（緑背景）

【添付】`frontend/public/assets/ui/flame-corner-tl.webp` と `flame-corner2-tl.webp`、できれば、作成済みの `ui_panel`（`games/raw/ui_panel.jpg`）

### #U1 ui_run_progress — 距離の目盛り（スタートからゴールまでの帯）　【アスペクト比】16:9（細長く使う）　【保存名】`ui_run_progress`
```
[UI STYLE: dark indigo-purple elements with thin antique-gold trim, subtle gold filigree, a crescent moon and star motif, small purple gem accents, matching the attached ornate corner decorations and panel]
A long thin horizontal progress track for a distance meter: a slim rounded capsule bar with a dark indigo inside (EMPTY, no fill, no marks) and a gold trim, a small gold crescent-moon ornament at the left end (the start) and a small gold flag ornament at the right end (the goal), perfectly horizontal and symmetrical. About 12 times as wide as it is tall. No text, no numbers.
OUTPUT RULES: flat solid pure green (#00FF00) background filling the whole image, no cast shadow, no gradient, no text, no watermark, centered with generous empty margin, crisp clean edges.
```
### #U2 ui_run_head — 目盛りの上を動く、ムスビの顔アイコン　【アスペクト比】1:1　【保存名】`ui_run_head`
【添付】ムスビ `ham004.webp`（笑顔）と、角の飾り2枚
```
A round badge icon: a circular gold-rimmed frame with a dark indigo background, containing the face and ears of Musubi (the chubby gray dwarf hamster with a white muzzle, black round eyes, pink nose, olive-green hood DOWN behind his head), smiling happily, drawn in the same soft cel-shaded storybook style as the attached reference, head only, centered in the circle.
OUTPUT RULES: a single icon only, fully visible and centered with generous empty margin, flat solid pure green (#00FF00) background filling the whole image (outside the circle), no cast shadow, no gradient, no text, no watermark, crisp clean edges.
```

---

## 作る順番のおすすめ
1. **#B1 空 → #B2 遠景**（見た目の方向の確認）→ #B3 中景 → #B4 近景 → #B5 道
2. **#R1（走り1コマ目）** と **#R7（ジャンプ）**（ムスビの見た目の確認）→ 残りの走り・着地・落下
3. 障害物（#O1〜#O7）→ スタート・ゴール（#S1〜#S3）→ 効果（#E1〜#E8）→ 部品（#U1・#U2）

## 確認のポイント（1枚ごと）
- 背景（ループ用）：左右の端が、同じ種類の絵で、目立つ目印がない／空と遠景の色が、つながる。
- 近景・中景・道：背景の単色（緑）が、均一で、絵の中に同じ緑が、使われていない。
- ムスビ：頭が丸くてふっくら、顔の見える（フードをかぶっていない）、全コマで、大きさと地面の位置が、そろっている。
- 障害物：地面に接する底が、まっすぐ／影や地面が、入っていない。
