import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PalmRelayCapturePage } from './pages/PalmRelayCapturePage.tsx'
import { PalmLab } from './dev/PalmLab.tsx'

// 手相診断のQR連携用：PCが表示したQRコードをスマホで読み取った際の着地ページ。
// 通常のApp本体（画面遷移が複雑なステートマシン）とは切り離し、単独で表示する
const palmCaptureMatch = window.location.pathname.match(/^\/palm-capture\/([^/]+)$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && window.location.pathname === '/palm-lab' ? (
      <PalmLab />
    ) : palmCaptureMatch ? (
      <PalmRelayCapturePage token={palmCaptureMatch[1]} />
    ) : (
      <App />
    )}
  </StrictMode>,
)
