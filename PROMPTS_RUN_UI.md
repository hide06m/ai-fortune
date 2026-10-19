# 森ラン：ボタン・パネルの画像プロンプト（自然・ネイチャー感）

作成: 2026-10-20。いまは、CSSで、木の板のボタンを作っている。方向性（木の板・苔の緑・控えめ）はそのまま、**絵に置きかえて、質感を上げる**ための素材。
派手にしない。金の縁・宝石・光の演出は、使わない。**木・苔・小さな葉**だけ。

## 作る素材（5つ）
| # | 保存名 | 使いどころ | アスペクト比 |
|---|---|---|---|
| B1 | `ui_wood_btn` | 難易度ボタン・つづける・もういちど（ふだんの状態） | 21:9（横長） |
| B2 | `ui_wood_btn_on` | 選ばれている難易度（苔がふえた、緑の状態） | 21:9 |
| B3 | `ui_wood_btn_pressed` | 押している間（B1より、少し沈んで、暗い） | 21:9 |
| B4 | `ui_wood_start` | 「タップでスタート」の板（B1より、少し大きく、ロープなし） | 21:9 |
| B5 | `ui_wood_panel` | 「ゴール！」「ざんねん…」の大きなパネル（中は空き） | 4:3 |

【添付（全部に共通）】`run_stump_s`（木の色・質感の見本）、`frame_leaf`（葉・どんぐりの、絵柄の見本）、`ui_result_btn`（ボタンの形と大きさの見本。**飾りの派手さは、まねしない**）

## 共通の文（全部の先頭に入れる）

**COMMON**
```
COMMON: A flat, front-view UI element for a cozy forest-themed mobile game, drawn in the same hand-painted storybook illustration style, line weight and warm muted colors as the attached stump and leaf frame. The element is made of natural wood only (a smooth, slightly worn plank with fine grain), with very small natural accents: a little green moss on the edges and one or two tiny leaves. It must look calm, simple and natural: NO gold trim, NO gems, NO glowing, NO sparkles, NO ornate scrollwork, NO text. The straight middle part of the long edges is plain wood (so it can be stretched horizontally), and the small moss and leaf accents sit only near the left and right ends and corners. Soft dark-brown outline, gentle shading, no cast shadow.
```

**OUTPUT**
```
OUTPUT RULES: the element fills the image edge to edge with only a thin margin, centered, on a flat solid pure green (#00FF00) background with no gradient, no shadow, no glow outside the element, no text, no watermark. Do not use any green similar to #00FF00 on the element itself (use only muted, darker olive and moss greens).
```

---

## B1 ui_wood_btn
【アスペクト比】21:9　【保存名】`ui_wood_btn`
```
[COMMON]

STYLE: a wide horizontal rounded wooden plank button, about three times as wide as it is tall, warm medium-brown wood with soft vertical grain, slightly lighter top edge and darker bottom edge so it looks like a gentle raised plank. A thin strip of green moss grows along the very top-left corner, and one tiny leaf sprig at the right end. The center is completely plain wood, empty, for text.

[OUTPUT]
```

## B2 ui_wood_btn_on（選ばれている状態）
【添付】B1の結果を追加　【アスペクト比】21:9　【保存名】`ui_wood_btn_on`
```
[COMMON]

STYLE: the same plank as the attached B1 button (same shape, size and wood), but now "selected": the wood is covered with more fresh, soft green moss on the top edge and both ends, and a few small fresh leaves, so the whole button reads as a gentle mossy green-brown. Keep it calm and natural, no glow. The center stays plain and empty, for text.

[OUTPUT]
```

## B3 ui_wood_btn_pressed（押している状態）
【添付】B1の結果を追加　【アスペクト比】21:9　【保存名】`ui_wood_btn_pressed`
```
[COMMON]

STYLE: the same plank as the attached B1 button, but pressed down: slightly darker, flatter and a little smaller, with the lighter top edge removed and the shading reversed so it looks pushed into the page. The same small moss and leaf accents. The center stays plain and empty.

[OUTPUT]
```

## B4 ui_wood_start
【添付】B1の結果を追加　【アスペクト比】21:9　【保存名】`ui_wood_start`
```
[COMMON]

STYLE: a larger wide wooden plank sign, a little taller and wider than the attached B1 button, made of two or three horizontal boards joined together, with small dark nail heads at the four corners and soft moss growing along the top edge and the left and right ends, plus a tiny leaf sprig at the left end. Natural and quiet. The center is completely plain wood, empty, for text.

[OUTPUT]
```

## B5 ui_wood_panel（大きなパネル。9分割で使う）
【添付】`frame_leaf`、`run_stump_s`　【アスペクト比】4:3　【保存名】`ui_wood_panel`
```
[COMMON]

STYLE: a large rectangular wooden board panel with a thick wooden frame made of rough branches or logs around the edge, the inside of the frame is a flat, smooth, slightly darker brown wooden board that is completely EMPTY (no text, no decoration) so text can be placed on it. Small moss patches and a few tiny leaves and one tiny acorn grow only at the four corners of the frame. The four corners use the same design, mirrored. The straight middle parts of the four sides are plain wood, so the frame can be stretched.

[OUTPUT]
```

---

## できあがりの確認
1. 派手でない（金・宝石・光・渦の飾りが、ない）。木と、苔と、小さな葉だけ。
2. B1〜B3 は、**同じ形・大きさ・位置**で、状態の違いだけが分かる（B1：ふつう、B2：苔が多い緑、B3：沈んで暗い）。
3. 長い辺のまん中が、無地の木（横に引き伸ばしても崩れない）。
4. 背景が、均一な緑（#00FF00）。板の中に、同じ緑がない。

## 直しのコツ
- 飾りが派手 → `Remove every gold, gem, glow and scroll ornament. Only plain wood, a little moss and tiny leaves.`
- 3枚の形がずれる → B2・B3 は、必ず B1 の結果を添付し、`Use exactly the same plank shape, size and position as the attached image.` を入れる。
- 中に文字のような模様が出た → `The center must be plain wood with no marks, text, or decoration.`
- 辺のまん中にも苔が出た → `Moss only at the left and right ends and the top-left corner; the middle of the long edges is plain wood.`

できたら `frontend/public/assets/games/raw/` に、保存名で入れてください。高画質なら `_2x` を付けて同じ名前で。私が、背景を抜いて、9分割（border-image）で、ボタンとパネルに組み込みます。

---

## 追加：待ち画面のボタンと、「占いができました」の板（シンプル）
2026-10-20。どちらも、**木・苔・葉の、控えめな板**。文字は、あとから載せるので、中は無地。`COMMON`/`OUTPUT` は、上のものをそのまま使う。

### B6 ui_wait_btn（待ち画面の「ミニゲームで待つ」ボタン）
診断を待つ画面（紫の背景）の上に載る。背景が、明るい紫なので、**木の色は、少し濃いめ**にして、板の輪郭を、はっきりさせる。
【添付】`ui_wood_btn`（形・質感の見本）　【アスペクト比】21:9　【保存名】`ui_wait_btn`
```
[COMMON]

STYLE: a wide horizontal rounded wooden plank button in the same style, size and shape as the attached wooden button, but a slightly darker warm brown wood so it stands out clearly against a light purple background. Soft moss on the top-left corner and one small leaf at the right end. The center is completely plain wood, empty, for text.

[OUTPUT]
```

### B7 ui_done_banner（「占いができました。結果を見る」の板）
画面の上に出る、お知らせ。少し横に長く、**うれしい知らせ**だと分かるよう、**苔が少し多め・小さな新芽（黄緑の葉）を、左右に1枚ずつ**。ただし、派手にしない。
【添付】`ui_wood_btn_on`（苔の多い状態の見本）　【アスペクト比】21:9　【保存名】`ui_done_banner`
```
[COMMON]

STYLE: a wide horizontal wooden plank banner, a little longer than the attached mossy button, made of one smooth board with soft green moss along the top edge and a tiny fresh yellow-green sprout of two leaves at each end (left and right), as a quiet, cheerful notice. Calm and natural, no glow, no sparkles. The center is completely plain wood, empty, for text.

[OUTPUT]
```

できたら `raw` に、保存名で入れてください。高画質は、そのまま（`_2x` は不要です）。私が、背景を抜いて、ボタンと、お知らせに、組み込みます。
