# Quick Start Guide - AI占いアプリ Phase 1

**所要時間**: 5分

## 📋 前提条件

- Node.js v24.18.1 以上がインストール済み (`node -v` で確認)
- npm 11.16.0 以上がインストール済み (`npm -v` で確認)
- Git がインストール済み

## 🚀 セットアップ

### ステップ 1: 依存関係インストール (2分)

```powershell
cd C:\Users\hide0\Projects\ai-fortune

# バックエンド
cd backend
npm install

# フロントエンド
cd ../frontend
npm install

# プロジェクトルートに戻る
cd ..
```

### ステップ 2: 環境変数設定 (1分)

**backend/.env ファイルを作成:**

```bash
NODE_ENV=development
PORT=3000
ANTHROPIC_API_KEY=sk-ant-xxxxx  # (オプション)
CLAUDE_MODEL=claude-3-5-haiku-20241022
```

> **注意**: `ANTHROPIC_API_KEY` がない場合、占術計算は動作しますがLLM分析は生成されません。テスト用途には十分です。

**frontend/.env ファイルを作成:**

```bash
VITE_API_URL=http://localhost:3000
```

### ステップ 3: テスト実行 (1分)

```powershell
cd backend
npm test
```

期待結果:
```
 Test Files  3 passed (3)
      Tests  12 passed (12)
```

## 🎮 開発サーバー起動 (1分)

### ターミナル 1: バックエンド起動

```powershell
cd C:\Users\hide0\Projects\ai-fortune\backend
npm run dev
```

表示: `🔮 Fortune Telling API Server running on http://localhost:3000`

### ターミナル 2: フロントエンド起動 (別ターミナル)

```powershell
cd C:\Users\hide0\Projects\ai-fortune\frontend
npm run dev
```

表示: `VITE v8.2.2 ready in xxx ms` と `Local: http://localhost:5173/`

## 🌐 ブラウザでアクセス

1. ブラウザを開く
2. URL: **http://localhost:5173/**
3. 以下の画面が表示されれば成功:

```
🔮 AI占い診断
統計学的占術計算とAIによる統合診断

[入力フォーム]
- 生年月日: 
- 出生時刻:
- 出生地:
- 現在の悩み・状況:
[診断を受ける] ボタン
```

## 📝 テスト入力例

**生年月日**: 1993-06-28  
**出生時刻**: 13:48  
**出生地**: 北海道札幌市  
**悩み**: キャリアチェンジ中です。今後の進むべき道が見えません。

→ **送信**

期待結果:
1. 「診断中...」の読み込み表示
2. 占術計算結果の表示:
   - 四柱推命の命式(年月日時柱)
   - 数秘術ライフパスナンバー
   - 九星気学本命星
3. AI統合診断文が表示される(または以下のメッセージ):
   - "LLM API が未設定です。占術計算結果は以下の通りです。"(API KEY未設定時)

## 🔧 トラブルシューティング

### バックエンドが起動しない

```powershell
# ポート 3000 が使用中の可能性
# 別のポートで起動:
$env:PORT=3001
npm run dev
```

### フロントエンドが起動しない

```powershell
# npm cache クリア
npm cache clean --force

# 再インストール
npm install

npm run dev
```

### API が呼び出せない

1. バックエンドが http://localhost:3000 で起動しているか確認
2. ブラウザの Developer Console (F12) でエラーを確認
3. CORS エラーの場合、バックエンド src/index.ts の `cors()` 設定を確認

### テストが失敗する

```powershell
cd backend

# TypeScript コンパイル
npm run build

# テスト再実行
npm test -- --reporter=verbose
```

## 📚 ファイル構成確認

```
C:\Users\hide0\Projects\ai-fortune\
├── backend/
│   ├── src/fortune/         # 占術計算ロジック
│   ├── src/llm/             # LLM統合
│   ├── src/index.ts         # Expressサーバー
│   └── package.json
├── frontend/
│   ├── src/App.tsx          # メインUI
│   ├── src/api.ts           # APIクライアント
│   └── package.json
├── README.md                # 詳細ドキュメント
└── .git/                    # Gitリポジトリ初期化完了
```

## ✅ 動作確認チェックリスト

- [ ] npm install が両ディレクトリで成功
- [ ] npm test で 12/12 テスト合格
- [ ] バックエンド起動: http://localhost:3000/health でOKレスポンス
- [ ] フロントエンド起動: http://localhost:5173 で入力フォーム表示
- [ ] 診断リクエスト送信で結果表示
- [ ] 感想フォーム送信で成功メッセージ表示

## 🔗 次のステップ

1. **GitHub へのプッシュ**: `GITHUB_SETUP.md` を参照
2. **LLM API キーの設定**: `.env` に `ANTHROPIC_API_KEY` を追加
3. **Render へのデプロイ**: README.md の「本番デプロイ」セクション参照
4. **Phase 2 計画**: ユーザーアカウント・診断履歴保存機能の実装

## 💡 開発ヒント

### ホットリロード対応

- **フロントエンド**: ファイル保存で自動リロード (Vite)
- **バックエンド**: ファイル保存で自動再起動 (`tsx watch`)

### デバッグ

```powershell
# バックエンド: リクエストログ確認
# → console.log が npm run dev の出力に表示

# フロントエンド: ブラウザ Developer Tools
# F12 キー → Console タブ

# API テスト (curl)
curl -X POST http://localhost:3000/api/fortune `
  -H "Content-Type: application/json" `
  -d '{
    "birthDate": "1993-06-28",
    "birthTime": "13:48",
    "concern": "キャリアについて"
  }' | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

## 📞 サポート

- README.md: 詳細なドキュメント
- 各ソースファイル: インラインコメントで処理内容を説明
- backend/src/fortune/*.test.ts: 占術計算ロジックの使用例

---

**問題が発生したら、console ログと error メッセージを確認してください。** 🚀
