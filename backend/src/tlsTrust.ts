/**
 * OS の証明書ストアも信頼する（index.ts の一番最初に読み込む）。
 *
 * セキュリティソフト（HTTPS通信を検査するもの）が入っているPCでは、外向きのHTTPS通信の証明書が、
 * そのソフト独自のものに差し替えられる。Node は既定でOSの証明書ストアを見ないため、
 * Gemini などへの通信が "UNABLE_TO_VERIFY_LEAF_SIGNATURE"（fetch failed）で毎回失敗していた。
 * ブラウザ（OSのストアを使う）では動くのに、サーバーだけ失敗するので気づきにくい。
 * OSのストアを足すだけで、通常の（公開の）証明書の検証は、これまでと同じように行われる。
 * Node 24.5 未満など、この関数が無い環境では何もしない。
 */

import tls from 'tls'

try {
  const t = tls as unknown as {
    getCACertificates?: (type: string) => string[]
    setDefaultCACertificates?: (certs: string[]) => void
  }
  if (t.getCACertificates && t.setDefaultCACertificates) {
    t.setDefaultCACertificates([...t.getCACertificates('bundled'), ...t.getCACertificates('system')])
  }
} catch (error) {
  console.warn('OSの証明書ストアを読み込めませんでした（無視して続けます）:', error)
}
