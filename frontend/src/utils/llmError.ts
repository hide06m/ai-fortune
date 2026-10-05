/**
 * backend は LLM 失敗時も success:true で「LLM生成に失敗しました: …」という文字列を analysis に入れて返す。
 * そのまま「総合結論」として表示するとエラー文が結果に見えてしまうので、画面用のメッセージに置き換える。
 */
const LLM_FAILURE_PREFIX = 'LLM生成に失敗しました'

export const LLM_FAILURE_MESSAGE =
  '占いの精霊が少し混み合っているようです。しばらく待ってから、もう一度お試しください。\n\n' +
  '（ログイン中にルーンストーンを使った場合は、自動でお返ししています）'

export function isLLMFailure(analysis: string | undefined | null): boolean {
  return !!analysis && analysis.startsWith(LLM_FAILURE_PREFIX)
}

export function displayAnalysis(analysis: string): string {
  return isLLMFailure(analysis) ? LLM_FAILURE_MESSAGE : analysis
}
