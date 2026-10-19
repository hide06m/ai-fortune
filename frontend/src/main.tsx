import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PalmRelayCapturePage } from './pages/PalmRelayCapturePage.tsx'
import { PalmLab } from './dev/PalmLab.tsx'
import { PalmReport } from './dev/PalmReport.tsx'
import { InvitePage } from './pages/InvitePage.tsx'
import { ForestRun } from './components/ForestRun.tsx'
import { MiniGameShell } from './minigames/MiniGameShell.tsx'
import { acornCatchSpec } from './minigames/acornCatch.ts'
import { BirthDateInput } from './components/BirthDateInput.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// 手相診断のQR連携用：PCが表示したQRコードをスマホで読み取った際の着地ページ。
// 通常のApp本体（画面遷移が複雑なステートマシン）とは切り離し、単独で表示する
const palmCaptureMatch = window.location.pathname.match(/^\/palm-capture\/([^/]+)$/)

// 縁むすび：招待された本人が、ログインなしで答えるページ
const inviteMatch = window.location.pathname.match(/^\/invite\/([^/]+)$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    {import.meta.env.DEV && window.location.pathname === '/palm-lab' ? (
      <PalmLab />
    ) : import.meta.env.DEV && window.location.pathname === '/palm-report' ? (
      <PalmReport />
    ) : import.meta.env.DEV && window.location.pathname === '/forest-run' ? (
      // 開発用：ログインなしで、森ランだけを開く（スマホでの確認用）
      <ForestRun onClose={() => { window.location.href = '/' }} />
    ) : import.meta.env.DEV && window.location.pathname === '/acorn-catch' ? (
      <MiniGameShell spec={acornCatchSpec} onClose={() => { window.location.href = '/' }} />
    ) : import.meta.env.DEV && window.location.pathname === '/birthdate-lab' ? (
      // 開発用：生年月日のカレンダーだけを、開く
      <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}><BirthDateInput id="lab" value="" onChange={() => {}} /></div>
    ) : palmCaptureMatch ? (
      <PalmRelayCapturePage token={palmCaptureMatch[1]} />
    ) : inviteMatch ? (
      <InvitePage token={inviteMatch[1]} />
    ) : (
      <App />
    )}
    </ErrorBoundary>
  </StrictMode>,
)
