// 運営から、受信箱へ、お知らせ・お詫びの石を送る
//
// 使い方（PowerShell）:
//   $env:ADMIN_TOKEN = "（Render の ADMIN_TOKEN と同じ値）"
//   node tools/send_notice.mjs --title "メンテナンスのお知らせ" --body "10/25 2:00〜3:00 に、メンテナンスをします" --kind maintenance --home
//   node tools/send_notice.mjs --title "お詫び" --body "診断が不安定でした。お詫びに石を配ります" --kind apology --stones 3 --days 30
//   node tools/send_notice.mjs --to someone@gmail.com --title "プレゼント" --body "ありがとう" --kind gift --stones 5
//
// オプション:
//   --title   題名（80文字まで）　　--body  本文
//   --kind    notice | maintenance | update | event | apology | gift
//   --stones  配る石の数（省略すると、お知らせだけ）　　--days  何日で、消すか（省略すると、ずっと）
//   --to      特定の1人（メールアドレス）。省略すると、全員　　--home  ホームの上にも、帯で出す
//   --api     送り先（省略すると、本番）。ローカルなら http://127.0.0.1:3000
//   --list    最近の全員向けを見る　　--delete <id>  取り消す

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const flag = (name) => args.includes(`--${name}`)

const api = opt('api', 'https://ai-fortune-backend.onrender.com')
const token = process.env.ADMIN_TOKEN
if (!token) {
  console.error('環境変数 ADMIN_TOKEN を設定してください（Render の ADMIN_TOKEN と同じ値）')
  process.exit(1)
}
const headers = { 'Content-Type': 'application/json', 'x-admin-token': token }

async function main() {
  if (flag('list')) {
    const r = await fetch(`${api}/api/admin/inbox`, { headers })
    console.log(JSON.stringify(await r.json(), null, 2))
    return
  }
  const del = opt('delete')
  if (del) {
    const r = await fetch(`${api}/api/admin/inbox/${del}`, { method: 'DELETE', headers })
    console.log(await r.json())
    return
  }
  const title = opt('title')
  const body = opt('body')
  if (!title || !body) {
    console.error('--title と --body が必要です')
    process.exit(1)
  }
  const payload = {
    title,
    body,
    kind: opt('kind', 'notice'),
    stones: Number(opt('stones', 0)),
    expiresInDays: opt('days') ? Number(opt('days')) : undefined,
    userEmail: opt('to'),
    showOnHome: flag('home'),
  }
  console.log('送信内容:', payload, '→', api)
  const r = await fetch(`${api}/api/admin/inbox`, { method: 'POST', headers, body: JSON.stringify(payload) })
  console.log(r.status, await r.json())
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
