// Cloudflare へ公開する。公開してはいけないローカル専用データを、ビルドの間だけ退避して含めない。
//  - src/data/private/ … 個人利用の抽出データ（他サイト由来）。無くても動く作り（privateData.ts）
//  - public/dev-samples/ … 手相の写真など。public/.assetsignore で配信から除外
import { execSync } from 'node:child_process'
import { existsSync, renameSync } from 'node:fs'

const priv = 'src/data/private'
const bak = 'src/data/.private_bak'
const run = (c, env = {}) => execSync(c, { stdio: 'inherit', env: { ...process.env, ...env } })

let moved = false
try {
  if (existsSync(priv)) { renameSync(priv, bak); moved = true }
  run('npx vite build', { VITE_API_URL: process.env.VITE_API_URL ?? 'https://ai-fortune-api.ai-ludo.workers.dev' })
} finally {
  if (moved) renameSync(bak, priv)
}
run('npx wrangler deploy')
