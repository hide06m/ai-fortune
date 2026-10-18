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
**OUTPUT（緑）**
```
OUTPUT RULES: a single subject only, fully visible and centered with generous empty margin on all sides (nothing cropped), flat solid pure green (#00FF00) background filling the whole image, no ground, no cast shadow, no gradient, no vignette, no text, no watermark, no border, crisp clean edges, high resolution.
```
**OUTPUT（黒）**（光・土ぼこりなどの効果用。上の青の文の、背景の色と、余白の言い方を替えたもの）
```
OUTPUT RULES: a single visual effect only, centered with generous empty black margin on all sides (nothing cropped), flat solid pure black (#000000) background filling the whole image, no ground, no cast shadow, no gradient, no vignette, no text, no watermark, no border, high resolution.
```
（青の文のうち、`flat solid pure blue (#0000FF) background` を `flat solid pure black (#000000) background` に、`a single subject only, fully visible and centered with generous empty margin on all sides (nothing cropped)` を `a single visual effect only, centered with generous empty black margin on all sides (nothing cropped)` に、替えています。）

**WORLD STYLE**（背景・小物の画風。背景の先頭に付ける）
```
WORLD STYLE: warm storybook fantasy illustration of a gentle enchanted forest, soft painterly shading with thin dark-brown outlines on objects, harmonious muted greens, golds and soft purples, dappled sunlight, a cozy and calm mood, matching the attached reference illustration of the hamster character (same line quality and soft cel shading). No characters, no text, no UI.
```

---

## 背景（ループして流れる）

### #B1 runbg_sky — 空（動かない1枚）【作り直し：木も、枝も、入れない】
【添付】前に作った空の絵（画風・色の見本として。**木と枝は、入れないでください**）　【アスペクト比】9:16（縦長）　【保存名】`runbg_sky`
```
[WORLD STYLE]
Use the attached image only as a reference for the painterly style, soft colors and light. Draw a tall vertical background of a bright soft morning SKY ONLY: a pale warm-gold and soft sky-blue gradient from the top to the horizon, a few gentle cream clouds drifting in the upper and middle parts, soft faint rays of light, and a low horizon at about 75% of the height with a band of very distant misty blue hills and a soft sea of low clouds below them. 
ABSOLUTELY NO trees, NO branches, NO leaves, NO foliage, NO plants, NO frame or vignette of any kind anywhere in the image, including at the top corners and the left and right edges: the picture must be a clean, open sky that continues evenly to all four edges (the left and right edges must look the same as the center, with no objects touching them). The lowest 25% is soft haze and clouds so that tree layers can be placed in front of it.
OUTPUT: a full-bleed illustration filling the whole image, no border, no characters, no text.
```
※ 前に作った絵は、木の枝が、四隅に大きく入っていて、走る背景（動く木々が、手前にある）と、**動かない枝が重なる**ため、不自然になります。空は、**木のない、広い空**にしてください。前の絵は、**ゲームのタイトル画面などの、別の用途**に使えます（捨てずに、取っておいてください）。

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

---

## 【点検の結果にもとづく、作り直し】（2026-10-18）

### ムスビの走り（#R1〜#R6）：6コマが、ほぼ同じ姿勢になっていた
**原因**：6枚とも、前足が前・後ろ足が後ろの、歩幅の姿勢で、**足が地面を離れるコマ**・**足が入れ替わるコマ**が、できていません（コマ同士の違いの数値も、小さい）。このまま回すと、**足踏みのように見えます**。

**直し方（おすすめ）**：6コマを、作り直すのではなく、**足のちがう「ポーズ」を3種類**作り、プログラムで、体の上下（跳ねる動き）を足して、走りに見せます。
- **ポーズA（接地・前後に開く）**：いまの #R1 をそのまま使います。
- **ポーズB（空中・足がそろって地面を離れる）**：作り直し。
- **ポーズC（足が入れ替わる・通過）**：作り直し。

作り直しは、**#R1 の結果を添付**して、「足だけを変えて、ほかは同じ」と指示します（画像の編集に近い使い方）。

#### #R3' musubi_run_right_3（通過：足が体の下で、そろいかける）
【添付】`musubi_run_right_1`（青背景の元画像）と、`musubi_idle_right`
```
Edit the attached running Musubi image. Keep EVERYTHING identical (the same face, expression, head, robe, brooch, hood, outlines, colors, size and position in the frame, the same ground line) EXCEPT the legs, arms and the robe hem: draw the "passing" moment of a run cycle. The two feet are both close together under the body, one foot planted flat on the ground and the other foot just lifted a little off the ground and swinging forward past it, knees bent. The small front paw and back paw are swung to the opposite sides from the attached image. The robe hem sways slightly. Do not change anything else.
OUTPUT RULES: a single subject only, fully visible and centered with generous empty margin on all sides (nothing cropped), flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```
#### #R4' musubi_run_right_4（空中：4本の足が、地面から離れる）
【添付】`musubi_run_right_1`、`musubi_idle_right`
```
Edit the attached running Musubi image. Keep EVERYTHING identical (the same face, expression, head, robe, brooch, hood, outlines, colors and size) EXCEPT the pose: draw the "airborne" moment of a run cycle. Musubi is fully in the air, both feet clearly OFF the ground with a visible gap under them, the front foot reaching forward and the back foot trailing behind, knees bent, his whole body shifted UP in the frame by about 8% of the image height compared with the attached image, the robe hem lifted and fluttering backward. Do not change anything else.
OUTPUT RULES: a single subject only, fully visible and centered with generous empty margin on all sides (nothing cropped), flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```
#### #R5' musubi_run_right_5（入れ替わった足の接地：前後の足が、逆になる）
【添付】`musubi_run_right_1`、`musubi_idle_right`
```
Edit the attached running Musubi image. Keep EVERYTHING identical (the same face, expression, head, robe, brooch, hood, outlines, colors, size and position, the same ground line) EXCEPT the legs and arms: draw the same "contact" moment but with the legs SWAPPED: the leg that was reaching forward is now stretched BACK behind the body (toes just leaving the ground), and the leg that was behind is now reaching FORWARD to touch the ground. The arms are swung to the opposite sides. Do not change anything else.
OUTPUT RULES: a single subject only, fully visible and centered with generous empty margin on all sides (nothing cropped), flat solid pure blue (#0000FF) background filling the whole image, no ground, no cast shadow, no gradient, no text, no watermark, crisp clean edges, high resolution.
```
→ 結果として、**A（#R1）／C（#R3'）／B（#R4'）／A'（#R5'）**の4つで、**接地 → 通過 → 空中 → 逆の接地**の、走りの、サイクルが作れます（#R2・#R6 は、いまのもので、代用できるか、あとで確認）。

### 中景（#B3 runbg_mid）：左右を反転して、つなぐと、大きな木が「2本の、左右対称の木」になる
**原因**：右端に、大きな木の幹が、あり、左右反転してつなぐと、つなぎ目で、同じ木が、対称に、並びます（つなぎ目そのものは、見えないが、**対称の木**が、目立つ）。
**直し方（どちらか）**：
1. **このまま使う**（つなぎ目の「対称の木」が、ときどき、流れる、だけ。気にならない場合）。
2. **作り直す**：#B3 の末尾に、次の1文を足す。
```
IMPORTANT for seamless looping: along the far left edge and the far right edge of the image, show ONLY low bushes, ferns and thin small tree trunks (no large thick trunk, no big canopy touching or cut by either edge); keep the big trees in the middle 70% of the width.
```

---

## #B3-R2 runbg_mid 再生成（2026-10-18・中景が「全面の大木の森」になった問題の直し）
【添付】#B2の結果（遠景）と、今回できた `runbg_mid'` は**添付しない**（引きずられるため）　【アスペクト比】16:9　【保存名】`runbg_mid2`（`'`を付けるなら `runbg_mid2'`）
```
[WORLD STYLE]
Match the attached distant forest. A wide, LOW horizontal strip of mid-distance forest, like a theatre set-piece band for a side-scrolling game. ONLY the bottom 45% of the image contains anything: many SLIM tree trunks of similar thickness and height with small rounded leafy canopies, standing close together in an evenly spaced row, with a continuous dense understory of bushes and ferns filling every gap between the trunks, so there are NO see-through gaps in the band. All trees and bushes are medium-small, softly outlined, in muted desaturated olive and teal greens with low contrast (clearly calmer and less detailed than a foreground), no huge tree, no giant canopy, no tree taller than 45% of the image height, no single special landmark: the same rhythm repeats across the whole width, and the left edge and right edge show the same kind of trunks and bushes at the same height. The band ends at the bottom edge of the image (no ground drawn). Everything above the tree band and everywhere else outside the trees and bushes is flat solid pure green (#00FF00) with no gradient; do not use any bright or similar green inside the trees (muted, darker olive and teal only).
OUTPUT: no border, no text, no characters, no shadow, no sky.
```
できあがりの確認：①木と茂みが画面の下45%までに収まり、上の55%が単色の緑 ②幹と幹のあいだに緑の抜けがない ③大きな木がなく、同じリズムが続く


---

## 走りのコマ（#R1〜R8）を、動きから作り直すプロンプト（2026-10-19）

### なぜ、動きが不自然だったか
- これまでの6コマは、「走っている絵」を6枚、別々に頼んだだけで、**走りの、決まった体の動き（キーポーズ）**を、指定していなかった。そのため、足の位置が毎回バラバラで、体の上下も、ついていなかった。
- 横スクロールのドットゲーム（マリオ、ロックマン、星のカービィ、ソニックなど）の走りは、どれも、**少ないコマで、決まった「型」**を繰り返している。ここでは、その型（アニメーションの基本の、4つの姿勢）を使う。

### 走りの基本の型（4つの姿勢 × 左右 ＝ 8コマ）
| コマ | 姿勢 | 体の動き |
|---|---|---|
| 1 | **接地（コンタクト）** 右足が前 | 右足のかかとが前でついた瞬間。左足は、後ろに、のびて、つま先だけ地面。両腕は、足と逆に振る（左腕が前、右腕が後ろ）。体は、少し高め |
| 2 | **沈み（ダウン）** | 体が、いちばん低い。右足に体重がのり、ひざが曲がる。左足は、後ろから、浮きはじめる。頭と体が、少し下がる |
| 3 | **すれちがい（パッシング）** | 右足で立ち、左足が、体の下を、前へ通りすぎる（ひざを曲げて、足を引きつける）。体は、中くらいの高さ。両腕は、体の横 |
| 4 | **跳ね（アップ）** | 体が、いちばん高い。右足で地面をけって、少し浮く（足は地面から離れる）。左足が前にのびる準備。頭が、いちばん上 |
| 5 | **接地** 左足が前 | 1の左右反対。左足のかかとが前でついた瞬間。右足は、後ろにのびる。右腕が前、左腕が後ろ |
| 6 | **沈み** | 2の左右反対 |
| 7 | **すれちがい** | 3の左右反対 |
| 8 | **跳ね** | 4の左右反対 |

- 1コマ目の左右反対が、5コマ目、…と、**前半4コマと、後半4コマは、同じ形の、左右の足だけ入れ替えた絵**になる。
- 全体は、1→2→3→4→5→6→7→8→1…と、ぐるぐる回る（8コマ、1秒に10〜12コマ）。
- **体の上下**：4（跳ね）がいちばん高く、2・6（沈み）が、いちばん低い。差は、体の高さの、約8%。
- **マントのゆれ**：体より、すこし遅れて、動く（沈みのときは、後ろに、ふくらみ、跳ねのときは、ふわっと、持ち上がる）。
- **尻尾**：体と逆に、少し、ゆれる（1コマごとに、小さく）。

### 作り方（おすすめ：1枚のシートで、8コマを、まとめて作る）
色や絵柄が、コマごとに変わらないよう、**1枚の絵に、8コマを横1列で、まとめて作ってもらう**。できたら、私が、8つに切り分けて、ゲームに入れる。（うまくいかないときは、下の「1コマずつ」の方法）

【添付】`musubi_idle_right`（ムスビの右向きの見本。顔・色・服の見本）、`musubi_run_right_1`（走りの絵柄の見本）
【アスペクト比】21:9 または 16:9（横長）　【保存名】`musubi_run_sheet`

**RUN SHEET PROMPT**
```
Using the attached character as the exact reference (same face, same grey-and-white hamster, same olive-green hooded cloak with the small leaf brooch, same pink hands and feet, same line weight and shading style), draw a horizontal sprite sheet of 8 frames of a side-view RUN CYCLE facing right, arranged in one row from left to right, each frame in its own equal-width cell, with the character the same size in every cell, feet resting on the same invisible baseline (except frames 4 and 8, which are slightly above it), and generous empty space between cells so that no frame touches another.

The 8 frames, in order:
1. CONTACT (right foot forward): the right heel has just touched the ground in front, the left leg is stretched behind with only the toes on the ground. Left arm swings forward, right arm swings back. Body slightly high.
2. DOWN: the body is at its lowest, weight on the right leg with the knee bent, the left foot lifting off behind. Head and body dip slightly. The cloak bulges backward.
3. PASSING: standing on the right leg, the left leg swings forward under the body with the knee bent. Body at middle height. Arms close to the body.
4. UP (airborne): the body is at its highest, pushed off the right foot, both feet just above the ground, the left leg reaching forward. The cloak lifts and floats up lightly.
5. CONTACT (left foot forward): the mirror of frame 1 with the legs and arms swapped: the left heel touches the ground in front, the right leg stretched behind, the right arm forward, the left arm back.
6. DOWN: the mirror of frame 2 (weight on the left leg).
7. PASSING: the mirror of frame 3 (standing on the left leg, the right leg swings forward).
8. UP (airborne): the mirror of frame 4 (pushed off the left foot).

The up-down difference between the lowest frames (2, 6) and the highest frames (4, 8) is about 8% of the body height. The cloak and tail trail slightly behind the body's motion. Facial expression: happy, mouth slightly open, the same in all frames. Keep exactly the same colors and the same lighting in all 8 frames.

OUTPUT: the whole background is flat solid pure blue (#0000FF) with no gradient, no ground line, no shadow, no text, no frame numbers, no border, no watermark. Do not use any blue inside the character.
```

### うまくいかないとき：1コマずつ作る（8回）
- 毎回、**同じ見本2枚**（`musubi_idle_right`、`musubi_run_right_1`）を添付し、**直前に作ったコマ**も、添付する。
- 文は、下の `[COMMON]` ＋ 各コマの `FRAME` の1行。
```
[COMMON]: Using the attached character as the exact reference (same face, grey-and-white hamster, olive-green hooded cloak with the small leaf brooch, pink hands and feet, same line weight and shading), draw ONE frame of a side-view run cycle facing right, full body, with the same size as the attached previous frame, the same colors and the same lighting as the previous frame. Flat solid pure blue (#0000FF) background, no ground, no shadow, no text, no blue inside the character.

FRAME 1: CONTACT, right foot forward (heel just touching down in front), left leg stretched behind with toes on the ground, left arm forward, right arm back, body slightly high.
FRAME 2: DOWN, body at its lowest, weight on the right leg with the knee bent, left foot lifting behind, cloak bulging backward.
FRAME 3: PASSING, standing on the right leg, left leg swinging forward under the body with a bent knee, body at middle height.
FRAME 4: UP, body at its highest, both feet just above the ground, left leg reaching forward, cloak floating up.
FRAME 5〜8: the mirror of frames 1〜4 (left and right legs and arms swapped).
```

### できあがりの確認
1. 8コマを並べたとき、**色・服の濃さ・大きさ**が、そろっている。
2. 1と5、2と6、3と7、4と8が、**足と腕だけ入れ替わった**形になっている。
3. 4と8が、いちばん高く、2と6が、いちばん低い。
4. ぐるぐる回して見たとき、足が、すべるように見えない（接地のコマで、前足が、前にある）。

---

## 丸太の作り直し（#O5'）
今の丸太は、真横から見た絵なのに、**両端の切り口が見える**ため、不自然。切り口が見えない描き方にする。
【添付】`run_stump_s`（絵柄の見本）　【アスペクト比】16:9　【保存名】`run_log2`
```
[WORLD STYLE]
Match the attached stump in style, color and line weight. A fallen tree log lying on the ground, seen from a perfectly flat SIDE view (like a 2D side-scrolling game). The log is a long horizontal cylinder of rough brown bark with a few small moss patches, a couple of knots and short broken branch stubs. Both ends of the log must NOT show their round cut faces and no tree rings: instead the two ends fade out of view, hidden behind tufts of tall grass and ferns that overlap the end of the log on the left and on the right. The log rests directly on the ground, with its underside touching the bottom edge of the image (no floating, no gap). Low and long, about three times as wide as it is tall.
OUTPUT: the whole background is flat solid pure green (#00FF00) with no gradient, no shadow on the background, no text, no border. Do not use any green similar to #00FF00 on the log or the plants (muted olive greens only).
```
