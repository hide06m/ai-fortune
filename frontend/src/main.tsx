import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PalmRelayCapturePage } from './pages/PalmRelayCapturePage.tsx'
import { PalmLab } from './dev/PalmLab.tsx'
import { PalmReport } from './dev/PalmReport.tsx'
import { InvitePage } from './pages/InvitePage.tsx'
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
