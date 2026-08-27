# GitHub セットアップ手順

## 前提条件
- GitHub アカウント作成済み (https://github.com)
- Git がインストール済み (確認済み: `git --version`)

## セットアップ手順

### 1. GitHub 上に空のリポジトリを作成

1. https://github.com/new にアクセス
2. Repository name: **ai-fortune**
3. Description: AI占いアプリ - 統計学的占術計算 + LLM統合診断
4. Visibility: **Private** を選択
5. その他の設定は デフォルトのまま
6. **Create repository** をクリック

### 2. GitHub CLI のセットアップ(PowerShell で実行)

```powershell
# GitHub CLI のインストール確認
winget install GitHub.cli

# インストール後、ターミナルを再起動して PATH を更新
```

### 3. GitHub 認証(PowerShell で実行)

```powershell
# GitHub CLI で認証
gh auth login

# 以下の質問に答える:
# - What account do you want to log into? → GitHub.com
# - What is your preferred protocol? → HTTPS
# - How would you like to authenticate GitHub CLI? → Login with a web browser
# 
# ブラウザが開いてGitHubログインページが表示されます
# ログインして認証コードをコピー → ターミナルに貼付
```

### 4. ローカルリポジトリを GitHub にプッシュ (PowerShell で実行)

```powershell
cd C:\Users\hide0\Projects\ai-fortune

# リモートリポジトリを追加
git remote add origin https://github.com/YOUR_USERNAME/ai-fortune.git

# ブランチ名を main に統一(Git設定による)
git branch -M main

# GitHub にプッシュ
git push -u origin main
```

### 5. GitHub Web サイトで確認

- https://github.com/YOUR_USERNAME/ai-fortune
- コミット履歴・ファイル一覧が表示されれば成功

---

## トラブルシューティング

### GitHub CLI がインストールされない場合

**代替方法**: HTTPS 認証情報を使用した Git 認証

```powershell
# 初回 push 時に以下が求められます:
# - Username: YOUR_GITHUB_USERNAME
# - Password: [personal access token]
#
# Personal Access Token 作成:
# 1. https://github.com/settings/tokens/new にアクセス
# 2. Token name: Claude Code
# 3. Expiration: 90 days
# 4. Scopes: repo (full control of private repositories)
# 5. Generate token
# 6. トークンをコピーして保管(再度表示されません)
```

### 認証失敗時

```powershell
# Git 認証情報を保存(Windows 認証マネージャー)
git config --global credential.helper wincred

# または SSH を使用する場合:
# 1. https://github.com/settings/keys でSSHキーを登録
# 2. git remote set-url origin git@github.com:YOUR_USERNAME/ai-fortune.git
# 3. git push -u origin main
```

---

## 確認コマンド

```powershell
# リモート設定を確認
git remote -v

# ブランチ情報を確認
git branch -a

# 最新コミットを確認
git log --oneline -3
```

---

**完了後**: GitHub Web ページで https://github.com/YOUR_USERNAME/ai-fortune を開いて、ファイル・コミット履歴が表示されることを確認してください。
