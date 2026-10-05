import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // スマホ実機テスト用：外部トンネル（Cloudflare Tunnel）経由のアクセスを許可する
    allowedHosts: ['.trycloudflare.com'],
    // VITE_API_URL を空にして起動した場合、/api はここから backend へ中継される
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
