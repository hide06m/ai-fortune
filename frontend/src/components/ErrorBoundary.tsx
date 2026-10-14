/**
 * 画面の描画中に、予期しないエラーが起きたとき、真っ白な画面にせず、案内と「もう一度読み込む」を出す
 * （診断の結果は、サーバーに保存されているので、読み込み直しても、石を使わずに見返せる）
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 画面でエラーが起きました', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', color: '#fff', background: '#1b1530', minHeight: '100vh' }}>
        <h2 style={{ color: '#ffd166' }}>うまく表示できませんでした</h2>
        <p>ご不便をおかけします。読み込み直すと、元に戻ることがほとんどです。</p>
        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
          診断が終わっていたときは、占い師選択の画面から、「前回の結果を見る」で、ルーンストーンを使わずに見返せます。
        </p>
        <button
          type="button"
          style={{ marginTop: 16, padding: '10px 28px', fontSize: '1rem', borderRadius: 8, border: 'none', background: '#ffd166', color: '#2a1a05', fontWeight: 700, cursor: 'pointer' }}
          onClick={() => window.location.reload()}
        >
          もう一度読み込む
        </button>
      </div>
    );
  }
}
