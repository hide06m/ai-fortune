# ai-fortune 進捗メモ（トークン節約用・要点のみ）

**実プロジェクトの場所は `C:\Users\hide0\Projects\ai-fortune`（git管理下）。**
`G:\マイドライブ\AI-project\ai-fortune` はスペック文書・素材・作業ログ置き場（コードなし）。
過去ログ `G:\マイドライブ\AI-project\ai-fortune\Implement this plan.md` は13,403行/500KB超の全文チャットログなので、
**丸ごと読まないこと。** 必要な時は `grep -n "キーワード"` で該当行を探し、その周辺だけ `Read` する。

## ハムスターローディングアニメーション：現在の実装（完成）

- コンポーネント: [HamsterLoading.tsx](frontend/src/components/HamsterLoading.tsx)
- スタイル: [hamster-loading.css](frontend/src/styles/hamster-loading.css)
- 素材: `frontend/public/assets/run/wheel_centered_alpha.webp`（車輪、132KB）、
  `frontend/public/assets/run/frames/f00.webp`〜`f17.webp`（ハムスター18コマ個別画像、計617KB）

**実装方式**: 車輪はCSSで無限回転（`transform:rotate`）。ハムスターは18枚の個別webp画像を
`requestAnimationFrame`で経過時間ベースに切り替えて`<img>`のsrcを差し替える方式（JS駆動）。

**なぜスプライトシート方式をやめたか**（重要・再実装時に同じ罠を踏まないこと）:
最初はCSS 1枚絵スプライトシート＋`background-position`アニメーションで実装したが、以下の問題が続発した。
1. `@keyframes`の`background-position`が`-1800%`という誤った値になっており、アニメーション中は常に透明になるバグ
   （`background-size:1800%`の場合、position 0%→100%が正しい。`(container-image)*percent/100`の計算式のため）
2. CSS%の登録点計算を「画像ファイルの縮小後ピクセル数」で行ってしまい、ハムスターが車輪の1/9サイズにしか
   表示されないバグ（表示サイズは車輪空間での実寸(886x578, 車輪キャンバス1580基準)で計算すべきで、
   ファイル自体の解像度とは無関係）
3. 上記を両方直した後も、**ブラウザが1枚の巨大スプライト画像を大きく縮小表示する際に隣接コマが滲んで混ざる
   （ブリード）問題**が発生し、走っているハムスターが二重にゴーストして見える壊れ方になった。
   これは`background-size`でスプライト全体を一括縮小する手法に内在する限界で、パディングを増やす等の
   微調整では確実に直せないと判断し、**コマごとの個別画像＋JS切り替え方式に作り直して解決した。**

新しく素材を作り直す場合は `%TEMP%\hamster-sprite-gen\generate_frames.js` を参考にすること
（Node.js + sharpで、白背景JPEGから透過カットアウト→18コマ個別webpとして書き出す。
sharpは `sharp({create}).composite().resize()` を1チェーンで繋ぐと
"Image to composite must have same dimensions or smaller" エラーになる罠があるので、
composite→toBuffer()→別チェーンでresizeと2段階に分けること）。

**動作確認済み**（実際のフォーム送信フローで、デスクトップ・モバイル幅どちらも確認）:
- ハムスターが車輪の走行面にちゃんと乗ったサイズ・位置で表示される
- アニメーション中もゴースト/二重表示なし、コマが正しく切り替わって走って見える
- 素材合計 約750KB（車輪132KB + ハムスター18コマ617KB）

**速度**: ユーザーレビューで初期速度（1秒4回転）が速すぎると指摘があり、**1秒に2回転（0.5秒/1回転）**に調整済み。
`.wheel`の`animation`と`HamsterLoading.tsx`の`CYCLE_DURATION_MS`を両方`0.5s`/`500`に統一している（車輪とハムスターの周期は必ず一致させること）。
ユーザーはこの速度で了承済み（2026-09-16時点、これ以上の速度調整依頼なし）。

## 完了済み（その他）
- Backend: `db/client.ts` に `query()` export追加済み（動作確認済み、DB初期化・API起動まで正常）
- Backend: キャラクター機能（DB/型/ルート）、TTS（Google Cloud TTS）実装済み
- Frontend: `HamsterLoading` は [App.tsx:413](frontend/src/App.tsx:413) 付近、`screen === 'form'` かつ
  `loading` state が true の時に表示されるよう配線済み
- Frontend 起動時に発覚した実バグ3件を修正：
  1. [CharacterSelectionPage.tsx](frontend/src/pages/CharacterSelectionPage.tsx) が未インストールの
     `react-router-dom` の `useNavigate` を使っていた → `onCharacterSelected` コールバックpropsに置き換え、
     `App.tsx` 側で `setSelectedCharacterId` + `setScreen('form')` するよう配線
  2. [api/character.ts](frontend/src/api/character.ts) の import先が存在しないファイルを指していた
     （`./index` → `../api` に修正）
  3. `tsconfig.app.json` の `verbatimModuleSyntax: true` により、型だけの import は `import type` を
     付けないとランタイムエラーになる。`CharacterId` importを修正、未使用の `Character` import削除
- ゲスト診断フォーム送信 → Gemini API連携 → 四柱推命/数秘術/九星気学の結果表示、を一気通貫で確認済み

## 完了済み（親密度・TTS実装セッション、2026-09-16）
以前「未実装」だった機能を実装した：

1. **親密度インクリメント + 自動キャラ解放**（[backend/src/index.ts](backend/src/index.ts) `/api/fortune`ハンドラ内）
   - `characterId`をリクエストボディで受け取り、ログインユーザーなら診断成功時に
     `incrementCharacterIntimacy()`を呼ぶ。`INTIMACY_UNLOCKS`のしきい値（Lv.3→ツキ, Lv.5→コクウ, Lv.7→クリ）
     に達したら`unlockCharacter()`を自動実行し、レスポンスに`intimacy: {characterId, intimacyLevel, justUnlocked}`を含める
   - ついでに発見した型バグ修正: `backend/src/db/character.ts`・`backend/src/types/character.ts`の
     `userId`が全部`number`型になっていたが、実際のDBスキーマ（`users.id UUID`）・JWTペイロードは`string`。
     `tsc --noEmit`で検出、`string`に修正済み（実害はJS実行時には出ないが型として誤りだった）
   - `POST /api/character/:id/unlock`に親密度しきい値チェックを追加（以前は未達成でも解放できてしまうガバガバ仕様だった）
2. **フロント→バックエンドへのcharacterId連携**（[frontend/src/api.ts](frontend/src/api.ts), [App.tsx](frontend/src/App.tsx)の`handleSubmit`）
   - `FortuneRequest`に`characterId`追加、`selectedCharacterId`を送信。`IntimacyResult`型追加
   - 結果画面に「🎉 ◯◯が解放されました！」バナー追加（[App.css](frontend/src/App.css) `.unlock-notice`）
3. **TTS配線**（以前は`textToSpeech.ts`が実装済みなのにどこからも呼ばれていない死んだコードだった）
   - 結果画面表示時に`speakResult(selectedCharacterId, analysis)`を呼ぶよう[App.tsx](frontend/src/App.tsx)に追加
   - キャラ選択画面で選択キャラが変わるたびに`speakGreeting()`を呼ぶよう[CharacterSelectionPage.tsx](frontend/src/pages/CharacterSelectionPage.tsx)に追加
   - どちらも`isVoiceEnabled()`（localStorage設定）を尊重

`npx tsc --noEmit`をbackend/frontend両方で実行し、上記の変更が新規の型エラーを出していないことを確認済み
（既存の無関係なエラー数件は元からあったもの、今回のセッションでは触っていない）。

## ✅ 認証済みフローを実ブラウザで検証済み（2026-09-16）

ユーザー許可のもと、`backend/.env`の`JWT_SECRET`でローカルDB用テストユーザー（test-local@example.com）と
テストJWTを発行し（本番/実ユーザーには一切影響しない）、実ブラウザで一連のフローを確認した。
この過程で**3件の実バグ**を新たに発見・修正した：

1. **`api/character.ts`・`services/textToSpeech.ts`が相対パスでfetchしていたバグ（重要）**
   `fetch('/api/character/list')`のように相対URLで書かれていたため、vite dev serverにプロキシ設定がなく
   Vite自身（5173番）にリクエストが飛び、backend（3000番）には一切届いていなかった
   （`/api/fortune`等を呼ぶ`api.ts`だけは`API_URL`プレフィックス付きだったため気づきにくかった）。
   これによりキャラ選択画面の親密度表示・TTS再生が常に失敗していた。
   `api.ts`から`API_URL`をexportし、両ファイルのfetch呼び出しに`${API_URL}`を追加して修正。
2. **TTSのGoogle Cloud認証エラーでbackendプロセスごとクラッシュするバグ（重要）**
   このdev環境にはGCPの認証情報（Application Default Credentials）が設定されておらず、
   `@google-cloud/text-to-speech`のライブラリ内部が`try/catch`の外側でreject/uncaughtExceptionを
   発生させ、**TTSを1回叩いただけでサーバー全体が落ちる**という致命的な問題があった。
   [backend/src/index.ts](backend/src/index.ts)に`process.on('unhandledRejection'/'uncaughtException', ...)`の
   ログ出力ハンドラを追加し、1機能の障害でサーバー全体が落ちないようにした（TTS自体は認証情報がない限り
   引き続き失敗するが、500エラーを返すだけでサーバーは生き続ける）。本番でGCP認証情報を設定すればTTSも動く。
3. **`incrementCharacterIntimacy`等がDBの行(snake_case)をそのままcamelCase型にキャストしていたバグ（重要）**
   `result.rows[0] as CharacterIntimacy`のように書かれていたため、実行時には`intimacy_level`という
   キーのままで、`.intimacyLevel`は常に`undefined`だった。これにより：
   - `/api/fortune`のレスポンスの`intimacy.intimacyLevel`が常に`undefined`
   - 親密度しきい値到達判定（`INTIMACY_UNLOCKS`との比較）が`undefined === 3`のように常に`false`になり、
     **自動キャラ解放が一度も発火しない**
   - `routes/character.ts`の解放API・キャラ選択画面の親密度表示も同様に壊れていた
   [backend/src/db/character.ts](backend/src/db/character.ts)に`mapIntimacyRow()`を追加し、
   snake_case→camelCaseへ正しく変換するよう全関数を修正。
   - ついでに[CharacterSelectionPage.tsx:160](frontend/src/pages/CharacterSelectionPage.tsx:160)の
     表示バグも修正（カード内の親密度Lv.表示が、そのカード自身の値ではなく「現在選択中のキャラの値」を
     誤って参照していた）

**修正後、実ブラウザで以下を目視確認済み：**
- ドア→キャラ選択画面：ログイン中ユーザーの実データ（親密度Lv., ロック状態）が正しく表示される
- テストユーザーで診断を6回実行 → ナツメの親密度がLv.1→Lv.6まで正しく加算されるのをDB照会で確認
- 7回目の診断でLv.7に到達 → **「🎉 クリ が解放されました！」バナーが結果画面に実際に表示される**のを確認
- DB照会でも`character_id=3,4`の`unlocked_at`が正しいタイミングでセットされることを確認
- TTS: 認証情報が無い環境なので実音声は鳴らないが、500エラーを返すだけでアプリ全体は問題なく動作を継続

dev サーバーは現在バックグラウンドで起動中（backend:3000, frontend:5173）。次回セッションで既に動いていなければ
`cd backend && npm run dev` / `cd frontend && npm run dev` で再起動する。

## 完了済み（最終仕上げセッション、2026-09-18）
- 文字化けしたゴミファイル2件（過去の壊れたコマンドの残骸）を削除
- 一度も実行されず型バグ（`user_id INT`だが実際は`UUID`）も持っていた死んだマイグレーションファイル
  `backend/src/db/migrations/002_add_character_intimacy.sql`を削除（実装は`db/client.ts`内の
  `initializeDatabase()`が正しく担っているので実害なし）
- ゲスト診断フローを再検証（前回セッションで1日1回の制限を使い切っていたが、日付が変わりリセット済み）→
  診断実行・結果表示・**感想送信**まで正常動作を確認
- 感想送信（`POST /api/feedback`）は意図的なPhase1実装で、DBには保存せずログ出力のみ
  （[backend/src/index.ts:343](backend/src/index.ts:343)にコメントあり、`readingId`もダミー値。バグではなく仕様）

## ✅ TTSをGoogle Cloud→VOICEVOXに切り替え・実機確認済み（2026-09-18）

Google Cloud TTSはAPI有効化の途中で課金設定（カード登録）が必要になり、ユーザーとの相談の結果、
**完全無料・カード登録不要のVOICEVOX**に切り替えることにした。

**やったこと：**
- VOICEVOX Engine（CPU版、v0.25.2、約1.9GB）を公式GitHubリリースからダウンロードし、
  `G:\マイドライブ\AI-project\ai-fortune\voicevox_engine\extracted\` に展開
  （容量が大きいためGドライブに配置。gitリポジトリ外＝コミット対象外）
- `backend/src/services/textToSpeech.ts` を全面書き換え：Google Cloud SDK → VOICEVOX Engineの
  ローカルHTTP API（`POST /audio_query` → `POST /synthesis`、port 50021）を直接呼ぶ実装に変更
- `backend/src/routes/tts.ts`：リクエストパラメータを `voiceId/languageCode/pitch/speakingRate`（Google形式）
  から `speakerId/speed`（VOICEVOX形式）に変更。レスポンスも `audio/mpeg`→`audio/wav`に変更
- `frontend/src/services/textToSpeech.ts`：`getCharacterVoiceId()`→`getCharacterSpeakerId()`に変更、
  5キャラクターにVOICEVOX話者を割り当て（下記）
- `backend/src/types/character.ts` / `frontend/src/types/character.ts`：`voiceId`フィールドを
  `string`(Google voice名)→`number`(VOICEVOX speaker id)に変更
- `backend/.env`に`VOICEVOX_ENGINE_URL=http://localhost:50021`を追記
- 不要になった`@google-cloud/text-to-speech`をbackendから`npm uninstall`
- `backend/start-voicevox.sh`を追加（次回以降、エンジン起動を簡単にするための起動スクリプト）

**キャラクター→VOICEVOX話者の割り当て：**
| キャラ | 話者ID | 話者名 |
|---|---|---|
| ムスビ(0) | 11 | 玄野武宏・ノーマル |
| ナツメ(1) | 2 | 四国めたん・ノーマル |
| ツキ(2) | 9 | 波音リツ・ノーマル |
| コクウ(3) | 13 | 青山龍星・ノーマル |
| クリ(4) | 12 | 白上虎太郎・ふつう |

（好みに合わなければ`GET http://localhost:50021/speakers`で全話者一覧が見られるので、
上記2ファイルの`voiceId`とfrontend `getCharacterSpeakerId()`の数値を差し替えるだけで変更可能）

**実ブラウザで確認済み：** キャラ選択画面の挨拶読み上げ、結果画面の読み上げ、両方とも
`POST /api/tts/speak → 200 OK`となり、実際に音声（WAV, 24kHz）が再生されることを確認した。

**⚠️ 次回セッションで引き継ぐ注意点：**
VOICEVOX Engineは`npm run dev`では自動起動しない。**TTSを使う前に手動起動が必要：**
```bash
cd backend && bash start-voicevox.sh
# または直接: "/g/マイドライブ/AI-project/ai-fortune/voicevox_engine/extracted/run.exe" &
```
起動確認: `curl http://localhost:50021/version`（初回は音声モデル読み込みで数秒〜十数秒かかる）

## ✅ リリース準備セッション（2026-09-18）

ユーザーから「リリースまで何が残っているか」と聞かれ、コードとREADMEを精査。以下を実施・コミット済み：

1. **セキュリティ強化**：`JWT_SECRET`未設定時に固定値へフォールバックしていたのを、本番(`NODE_ENV=production`)では
   起動を拒否するように変更。CORSを`CORS_ORIGINS`環境変数で本番ドメインを指定できるように変更（従来はlocalhost決め打ち）
2. **`.env.example`整備**：backend/frontend両方に作成・不足していた変数（`VITE_GOOGLE_CLIENT_ID`等）を追記
3. **README/QUICK_START.md更新**：Claude API(Anthropic)という古い記述をGemini APIに修正、レート制限の記述を実態に合わせた
4. **🚨重大バグ発見・削除：Googleログイン時の危険なGCP自動操作**
   ログインのたびに、ユーザー本人のOAuthアクセストークン（`cloud-platform`という非常に強力なスコープ）を使って
   [backend/src/gcp/billing.ts](backend/src/gcp/billing.ts)（削除済み）が**ユーザー本人のGCP請求quotaを勝手に$0に設定**し、
   [backend/src/gcp/apiKey.ts](backend/src/gcp/apiKey.ts)（削除済み）が**ユーザー本人のGCPプロジェクトにAPIキーを自動生成**していた。
   しかも生成したキーはどこにも保存されず実際の診断には一切使われていなかった（`// TODO: DBに保存する`のまま放置された未完成機能）。
   公開リリースするとGoogleの厳格な審査が必須になる上、一般ユーザーのほとんどはGCPプロジェクトを持っていないため
   恩恵もない、実害だけがある機能だった。`frontend/src/App.tsx`のOAuthスコープも`openid email profile`のみに削減。
5. **ログイン済みユーザーにも利用上限を追加**：以前は認証済みユーザーはレート制限を完全スキップしており、
   コスト青天井になっていた。[backend/src/middleware/rateLimit.ts](backend/src/middleware/rateLimit.ts)を変更し、
   ゲスト1日1回（IP単位）／ログイン済み1日3回（ユーザー単位）に統一。

**LLMプロバイダの検討経緯（重要・変更しないこと）：**
一時的にOpenAI(ChatGPT)への切り替えを試みたが、ユーザーが用意した職業訓練校提供のAPIキーは
「ChatGPT契約とは別会計のAPIクレジットが$0」で使えないことが判明（ChatGPT契約とOpenAI API利用は別物）。
訓練校側にAPI用組織が無いことも確認済み。**最終的にGeminiに戻すことで確定**（ユーザー了承済み）。
今後もし別プロバイダへの切り替えを検討する場合は、事前に「そのAPIキーで実際にクレジットが使えるか」を
真っ先に確認すること（契約と実際のAPI課金は別ということが多くのユーザーにとって分かりにくい落とし穴）。

## 残タスク（リリースに向けて）

ユーザーは「誰でもアクセス可能な公開リリース」かつ「デプロイ先はRender」を希望。VOICEVOXは本番でも
動かす方法を検討する方針。次回以降、以下が未着手：

1. **`render.yaml`（Render Blueprint）の作成** — backend(Web Service) / frontend(Static Site) / PostgreSQLの構成。
   まだ1行も書かれていない
2. **VOICEVOXの本番運用方法の設計** — 現状はこのPCのGドライブに置いた1.9GBのエンジンを手動起動する構成で、
   本番サーバーではそのままでは動かない。VOICEVOX公式のDockerイメージ（`voicevox/voicevox_engine`）を
   Render上で別Web Serviceとして動かし、backendから内部URLで呼ぶ方式が有力候補（未着手・未検証）
3. **Google OAuth同意画面を「テスト」から「本番」へ切り替え** — ユーザー自身がGoogle Cloud Consoleで行う必要がある
   （Claude側では代行不可。スコープを`openid email profile`のみに絞ったので、審査は不要か軽微で済むはず）
4. **本番用の環境変数を実際に設定** — `JWT_SECRET`（ランダム生成必要）、本番の`GOOGLE_CLIENT_ID/SECRET`の
   リダイレクトURI追加、`CORS_ORIGINS`、`DATABASE_URL`（Render PostgreSQL）等
5. （任意）感想フォームのDB永続化、プライバシーポリシー等の法的ページ
