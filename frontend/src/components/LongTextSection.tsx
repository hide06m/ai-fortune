import type { TextBlock } from '../data/privateData'

/** 長い解説は、最初は閉じておき、読みたい人だけが開く */
export function LongTextSection({ blocks }: { blocks: TextBlock[] }) {
  return (
    <details className="analysis-section long-text-details">
      <summary>くわしい解説を読む（長文）</summary>
      <div className="long-text-section">
        {blocks.map((b, i) =>
          b.kind === 'heading' ? <h4 key={i}>{b.text}</h4> : <p key={i}>{b.text}</p>,
        )}
      </div>
    </details>
  )
}
