# ai-fortune 🔮

占いを「統計学の一種」と捉え、決定論的な占術計算(四柱推命・数秘術・九星気学)とLLMによる自然文生成を分離したAI占い診断アプリ。

## 機能概要

- **入力フォーム**: 生年月日・出生時刻(任意)・出生地・現在の悩み/状況(自由記述)
- **占術計算**:
  - 四柱推命(干支・五行の算出)
  - 数秘術(ライフパスナンバー)
  - 九星気学(本命星)
- **LLM統合**: Gemini APIで計算結果をもとに統合診断文を生成
- **Googleログイン**: ログインするとゲスト制限(1日1回)なく何度でも診断可能
- **キャラクター占い師システム**: 5体のキャラクター(ムスビ・ナツメ・ツキ・コクウ・クリ)から選んで診断。
  診断のたびに親密度が上がり、一定レベルで新しいキャラクターが解放される
- **キャラクターボイス**: VOICEVOXによる音声読み上げ(挨拶・診断結果)
- **ローディングアニメーション**: ハムスターが滑車を走る独自アニメーション
- **感想収集**: 診断結果ページの感想フォーム(現状ログ出力のみ、DB保存は未実装)

### アーキテクチャ

```
ai-fortune/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Node.js + Express + TypeScript
│   └── src/
│       ├── fortune/     # 占術計算ロジック
│       ├── llm/         # Gemini API統合
│       ├── auth/        # Google OAuth / JWT
│       ├── db/          # PostgreSQL（ユーザー・親密度）
│       ├── routes/      # キャラクター・TTS API
│       ├── services/    # TTS（VOICEVOX連携）
│       └── middleware/  # レート制限・認証等
├── backend/.env.example    # バックエンド環境変数テンプレート
└── frontend/.env.example   # フロントエンド環境変数テンプレート
```

### セットアップ

```bash
# Backend依存関係のインストール
cd backend
npm install

# Frontend依存関係のインストール
cd ../frontend
npm install
```

### 環境変数設定

`backend/.env.example` と `frontend/.env.example` を参考に、それぞれ `backend/.env` / `frontend/.env`（または `.env.local`）を作成する。
最低限必要なもの:

- `backend/.env`: `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, `DATABASE_URL`
- `frontend/.env`: `VITE_GOOGLE_CLIENT_ID`

`GEMINI_API_KEY`が未設定の場合、占術計算結果は返されますがLLM統合分析は生成されません（テスト/開発用として利用可能）。

音声読み上げを使う場合は、事前に VOICEVOX Engine を起動しておく必要がある(`backend/start-voicevox.sh` 参照)。
未起動でもアプリ自体は問題なく動作する(音声が鳴らないだけ)。

### 開発環境での実行

```bash
# Backend開発サーバー起動 (ポート3000)
cd backend
npm run dev

# 別のターミナルでFrontend開発サーバー起動 (ポート5173)
cd frontend
npm run dev

# 音声読み上げを使うなら別のターミナルでVOICEVOXも起動
cd backend
bash start-voicevox.sh
```

### テスト

```bash
cd backend
npm test          # 占術計算ロジックのユニットテスト
npm run test:ui   # テストUIで実行確認
```

### レート制限

- ゲスト（未ログイン）: IP単位で1日1回まで
- ログイン済みユーザー: ユーザー単位で1日3回まで
- ヘルスチェックエンドポイント(`/health`)は制限対象外

### キャッシング

- 同一の命式+悩みカテゴリの組み合わせは24時間メモリキャッシュ
- 同じLLM呼び出しを避けてコスト削減

### 本番デプロイ

未着手。想定していた Render Blueprint（Web Service + Static Site + PostgreSQL）構成のデプロイ設定
（`render.yaml`等）はまだ存在しない。デプロイ時は以下も要対応:

- `CORS_ORIGINS`環境変数に本番フロントエンドURLを設定（未設定時はlocalhostのみ許可）
- `JWT_SECRET`を必ず設定（未設定だと本番モードでは起動時にエラーで落ちる仕様）
- Google Cloud ConsoleのOAuth同意画面を「テスト」から「本番」へ切り替え（多数のユーザーに公開する場合）
- VOICEVOX Engineをデプロイ先でどう動かすか（別サーバー/Dockerでの同梱など）の検討

## コスト管理

- 計算とAI生成を分離し、LLM呼び出しを最小化
- キャッシング・レート制限で無駄なAPI呼び出しを削減
- 音声合成はVOICEVOX（無料・ローカル実行）を使用し、クラウドTTSの課金を回避

## 今後の拡張候補

- 感想フォームのDB永続化
- Capacitorなどを使ったネイティブアプリ化

## 参考

- 基準データ: ユーザー生年月日 1993-06-28 13:48 (北海道札幌市)
- 検証: `npm test` で占術計算ロジックが既知データと一致することを確認

---

**開発者**: hide06m@gmail.com
**ライセンス**: MIT
