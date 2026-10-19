/**
 * 利用規約・プライバシーポリシーに載せる、運営者の情報（ここだけ、本人が書きかえる）
 * 公開（Google ログインの本番申請）の前に、必ず、実際の値に直す。
 */
export const LEGAL = {
  appName: '占いの森',
  /** 運営者の名前（個人なら、ハンドルネームでもよい） */
  operator: '前崎秀奈',
  /** 問い合わせ先のメールアドレス（公開される） */
  contactEmail: 'soecontact.maezaki@gmail.com',
  /** 制定日・最終改定日 */
  updated: '2026年10月20日',
} as const;
