import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // IPv4で待ち受ける。既定だとこのPCでは IPv6（[::1]）だけで待ち受け、localhost を IPv4 で引くブラウザが "接続が拒否されました" になる。
    // 画面外（同じネットワークの他の端末）には公開しない
    host: '127.0.0.1',
    // スマホ実機テスト用：外部トンネル（Cloudflare Tunnel）経由のアクセスを許可する
    allowedHosts: ['.trycloudflare.com'],
    // VITE_API_URL を空にして起動した場合、/api はここから backend へ中継される
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
