# 枠（フレーム）の画像生成プロンプト：診断結果・パネル用（Google Flow / Nano Banana 用）

作成: 2026-10-18。いまの角の飾り（大きな月）は、**角の飾りだけを、枠の線とつながらない形で、置いている**ため、枠から、見切れたように見えます。
そこで、**角の飾りと、枠の線が、最初から、つながった「枠そのもの」**を作ってもらい、CSS の「9分割（border-image）」で、どんな大きさの枠にも、使えるようにします。
（角の飾りだけが必要な場合は、できた枠の、四隅を、私が切り出します）

## 作る枠（3種類）
| # | 名前 | 雰囲気 | 使いどころ |
|---|---|---|---|
| F1 | frame_moon | 月と星（既存の飾りの様式）。ただし、控えめ | 診断結果の大きな枠 |
| F2 | frame_leaf | 蔦・葉・どんぐり（森の世界観） | 日常のパネル・ホームの記録 |
| F3 | frame_simple | 細い金の二重線と、小さな宝石だけ | 続けて並ぶ、補足の枠・小さなパネル |

## 共通の決まり（つなぎのために、とても大事）
- **枠は、正方形の画像の、四辺いっぱいにある**。**中央は、何もない（中の空きも、背景と同じ緑）**。
- **四辺の「まん中あたり」は、飾りなしの、まっすぐな細い線**だけ（左右・上下に引き伸ばしても崩れないように）。
- **四隅の飾りは、小さめ**（枠の1辺の、約15%以内）。飾りは、**必ず、2本の枠線が出会う角に、つながって**いること（飾りが、枠から、はみ出したり、浮いたりしない）。
- 4つの角は、**同じデザインを、向きだけ、変えた形**（左右・上下の対称）。
- 添付：`frontend/public/assets/ui/flame-corner-tl.webp` と `flame-corner2-tl.webp`（金と紫の、様式の見本）、できれば、作成済みの `games/raw/ui_panel.jpg`。

## 共通の文

**FRAME COMMON**
```
FRAME COMMON: A perfectly symmetrical, flat front-view UI border frame for a mystical fortune-telling fantasy game, drawn as a square image where the frame runs along all four edges of the image and the CENTER IS COMPLETELY EMPTY (the empty center and everything outside the frame are the same flat solid pure green #00FF00). The straight middle sections of all four sides are a plain, uniform, thin border line with NO ornament at all (so they can be stretched). Ornaments appear ONLY at the four corners, small (each corner ornament fits within about 15% of the image width), and each ornament is firmly joined to the two border lines that meet at that corner, as one continuous piece (nothing floating, nothing sticking out past the frame). All four corners use the same design, mirrored. Dark indigo-purple border band with thin antique-gold metal trim, matching the attached ornate reference decorations in color, material and line quality. No text, no characters, no shadow, no gradient in the background.
```
**OUTPUT（枠）**
```
OUTPUT RULES: square image (1:1), the frame fills the image edge to edge with no outer margin, flat solid pure green (#00FF00) background in the center and outside the frame, no cast shadow, no glow outside the frame, no text, no watermark, crisp clean edges, high resolution.
```

---

## F1 frame_moon — 月と星
【添付】角の飾り2枚　【アスペクト比】1:1　【保存名】`frame_moon`
```
[FRAME COMMON]

STYLE: Each corner has a small gold crescent moon with two or three tiny four-pointed stars, set into the corner where the two border lines meet, with one small purple gem at the inner corner. The border band itself is a dark indigo band with a thin gold line along each edge and a subtle faint starry texture. Elegant and restrained, not heavy.

[OUTPUT（枠）]
```

## F2 frame_leaf — 蔦・葉・どんぐり
【添付】角の飾り2枚　【アスペクト比】1:1　【保存名】`frame_leaf`
```
[FRAME COMMON]

STYLE: Each corner has a small cluster of oak leaves with one tiny acorn and a short curling vine tendril that grows out of the corner and follows the border lines for a short distance (no more than 15% of the image width), in muted olive and gold-bronze tones. The border band itself is a dark indigo-green band with a thin gold line along each edge. Warm, cozy forest mood, restrained.

[OUTPUT（枠）]
```

## F3 frame_simple — 細い金の二重線
【添付】角の飾り2枚　【アスペクト比】1:1　【保存名】`frame_simple`
```
[FRAME COMMON]

STYLE: The border is two parallel thin antique-gold lines (an outer slightly thicker line and an inner thinner line) with a narrow dark indigo band between them. At each corner the lines turn with a small rounded notch, and a single tiny purple diamond-shaped gem sits at the corner on the diagonal. Minimal, quiet, very restrained; no other ornament.

[OUTPUT（枠）]
```

---

## できあがりの確認
1. 四辺のまん中に、飾りがない（引き伸ばしても崩れない）。
2. 四隅の飾りが、枠線とつながっていて、浮いていない・はみ出していない。
3. 中の空きと、外が、同じ単色の緑で、均一。
4. 4つの角が、同じデザインで、向きだけ違う。
5. 既存のUI（`ui_panel` など）と、色・質感が、そろっている。

## 直しのコツ
- 飾りが大きすぎる → `Make the corner ornaments 30% smaller; they must stay within 12% of the image width.`
- 角が、枠線と、つながって見えない → `The corner ornament must be built INTO the corner of the border band, overlapping both lines, never placed on top as a separate sticker.`
- 辺のまん中にも、飾りが出た → `The middle of each side must be only a plain thin line. Remove every ornament from the middle of the sides.`
- 中の空きが、緑でない → `The empty center must be exactly the same flat pure green #00FF00 as the outside; no fill, no texture.`
