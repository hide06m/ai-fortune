# ai-fortune 🔮

占いを「統計学の一種」と捉え、決定論的な占術計算(四柱推命・数秘術・九星気学)とLLMによる自然文生成を分離したAI占い診断アプリ。

## Phase 1 - Prototype (訓練校内配布)

### 機能概要

- **入力フォーム**: 生年月日・出生時刻(任意)・出生地・現在の悩み/状況(自由記述)
- **占術計算**: 
  - 四柱推命(干支・五行の算出)
  - 数秘術(ライフパスナンバー)
  - 九星気学(本命星)
- **LLM統合**: Claude APIで計算結果をもとに統合診断文を生成
- **感想収集**: 診断結果ページの感想フォーム(ログ出力)

### アーキテクチャ

```
ai-fortune/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Node.js + Express + TypeScript
│   └── src/
│       ├── fortune/   # 占術計算ロジック
│       ├── llm/       # Claude API統合
│       └── middleware/# レート制限等
└── .env.example       # 環境変数テンプレート
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

### 開発環境での実行

```bash
# Backend開発サーバー起動 (ポート3000)
cd backend
npm run dev

# 別のターミナルでFrontend開発サーバー起動 (ポート5173)
cd frontend
npm run dev
```

### テスト

```bash
cd backend
npm test          # 占術計算ロジックのユニットテスト
npm run test:ui   # テストUIで実行確認
```

### 環境変数設定

`.env`ファイルを作成(`.env.example`を参考に):

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
CLAUDE_MODEL=claude-3-5-haiku-20241022
NODE_ENV=development
PORT=3000
```

### LLMなしでの動作

`ANTHROPIC_API_KEY`が設定されていない場合、占術計算結果は返されますがLLM統合分析は生成されません。テスト/開発用として利用可能です。

### レート制限

- IP単位で「1日3回まで」の診断リクエスト制限
- ヘルスチェックエンドポイント(`/health`)は制限対象外

### キャッシング

- 同一の命式+悩みカテゴリの組み合わせは24時間メモリキャッシュ
- 同じLLM呼び出しを避けてコスト削減

### 本番デプロイ

**Render Blueprint**対応:
- Web Service(バックエンド): Node.js
- Static Site(フロントエンド): Vite build
- PostgreSQL(将来用)

環境変数を設定してデプロイボタンでワンクリック展開可能。

## コスト管理

- 計算とAI生成を分離し、LLM呼び出しを最小化
- Haiku系モデル使用でコスト削減
- キャッシング・レート制限で無駄なAPI呼び出しを削減

## Phase 2・3 への拡張

現在のモノレポ構成・技術スタックは以下に対応:
- **Phase 2**: ユーザーアカウント、診断履歴保存、UI/UX磨き込み
- **Phase 3**: Capacitor でReactをネイティブアプリ化、スマホアプリストア公開

## 参考

- 基準データ: ユーザー生年月日 1993-06-28 13:48 (北海道札幌市)
- 検証: `npm test` で占術計算ロジックが既知データと一致することを確認

---

**開発者**: hide06m@gmail.com  
**ライセンス**: MIT
